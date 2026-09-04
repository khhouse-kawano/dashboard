import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from '../../db/pool';
import type { SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';
import { DIVISIONS, insertCustomer, parseDivision } from '../inquirySync';

/**
 * お友達紹介キャンペーンの反響管理。
 *
 * ─────────────────────────────────────────────
 * 反響の入り口は **① の PHP**、画面は **② の Express**。
 *
 *   受付: GAS（Gmail監視）→ ① backend/src/handlers/introductory.php
 *         request: 'introductory'。重複排除は dedupKey の UNIQUE キー。
 *   閲覧・担当割り当て・同期: ここ（request: 'inquiry_introductory'）
 *
 * ⚠️ 受付と画面で request 名が違う（'introductory' / 'inquiry_introductory'）。
 *   受付だけは ① に置いている。GAS からの経路に ② を挟むと、
 *   ② が落ちている間の反響が失われる（GAS は再送しないため）。
 *
 * ⚠️ この request に PHP ハンドラは無い（受付の introductory.php は別物）。
 *   ② が落ちるとこの画面だけ動かなくなる。① にフォールバック先は無い。
 * ─────────────────────────────────────────────
 *
 * テーブル: backend/scripts/sql/2026-09-05_inquiry_introductory.sql
 *           backend/scripts/sql/2026-09-06_inquiry_assign_division.sql
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** ハンドラの戻り値。ステータスコードを出し分けるため本文と一緒に持つ */
export interface IntroductoryResult {
  httpStatus: number;
  body: unknown;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/** 空文字は NULL として保存する */
const orNull = (value: unknown): string | null => {
  const s = asString(value).trim();
  return s === '' ? null : s;
};

const toInt = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

// ---------------------------------------------------------------------------
// 一覧
// ---------------------------------------------------------------------------

/**
 * 反響の一覧。
 *
 * ⚠️ `registered`（メールの受信日時）で並べる。`no` 順にすると、
 *   GAS のトリガーが遅れて回った分がまとまって最後に付き、
 *   実際の反響の順番と合わない。
 *
 * ⚠️ `SELECT *` にしている。列は運用に合わせて増える前提であり
 *   （カラム名は GAS の key 名そのまま）、列挙すると追加のたびに
 *   ここを直す必要が出る。画面側は必要な列だけ読む。
 */
const LIST_SQL = `
  SELECT *
    FROM inquiry_introductory
   ORDER BY registered DESC, no DESC
`;

export const runInquiryIntroductoryList = async (): Promise<IntroductoryResult> => {
  const inquiry = await query<DynamicRow>(LIST_SQL);
  return { httpStatus: 200, body: { status: 'ok', inquiry } };
};

// ---------------------------------------------------------------------------
// 担当の割り当て
// ---------------------------------------------------------------------------

/**
 * 担当店舗・担当営業・事業区分を更新する。
 *
 * ⚠️ 更新できるのはこの3列だけ。紹介者名や連絡先は**メール本文から取り込んだ
 *   原本**であり、社内で書き換えると「本当は何が届いたのか」が分からなくなる。
 *   誤りがあれば同期後に顧客側で直す。
 *
 * ⚠️ 同期済み（sync = 1）の行は拒否する。
 *   既に作られた顧客の担当は変わらないため、反響側だけ変えると
 *   **画面上は正しいのに実態と食い違う**という最も気づきにくい状態になる。
 */
const EDITABLE_COLUMNS = ['shop', 'staff', 'division'] as const;

export const runInquiryIntroductoryUpdate = async (
  body: Record<string, unknown>
): Promise<IntroductoryResult> => {
  const no = toInt(body.no);
  if (no <= 0) {
    return { httpStatus: 400, body: { status: 'error', message: '反響IDが不正です。' } };
  }

  const columns = EDITABLE_COLUMNS.filter((col) => col in body);
  if (columns.length === 0) {
    return { httpStatus: 400, body: { status: 'error', message: '更新する項目がありません。' } };
  }

  // ⚠️ division は NOT NULL であり、同期先のテーブルを決める値でもある。
  //   空や未知の値を通すと INSERT が落ちるか、別の事業の顧客が作られる。
  if ('division' in body && parseDivision(body.division) === null) {
    return { httpStatus: 400, body: { status: 'error', message: '事業区分が不正です。' } };
  }

  const rows = await query<DynamicRow>(
    'SELECT sync FROM inquiry_introductory WHERE `no` = ?',
    [no]
  );
  const current = rows[0];

  if (current === undefined) {
    return { httpStatus: 404, body: { status: 'error', message: '該当する反響が見つかりません。' } };
  }
  if (toInt(current.sync) === 1) {
    return {
      httpStatus: 400,
      body: {
        status: 'error',
        message: '同期済みの反響は変更できません。担当の変更は顧客情報側で行ってください。',
      },
    };
  }

  const setClause = columns.map((col) => `\`${col}\` = ?`).join(', ');
  const values: SqlParam[] = [...columns.map((col) => orNull(body[col])), no];

  await execute(`UPDATE inquiry_introductory SET ${setClause} WHERE \`no\` = ?`, values);

  return { httpStatus: 200, body: { status: 'ok' } };
};

// ---------------------------------------------------------------------------
// 同期
// ---------------------------------------------------------------------------

/** 紹介者区分の表示名。GAS の introductoryReferrerTypeMap と対応する */
const REFERRER_LABELS: Record<string, string> = {
  owner: 'オーナー様',
  employee: '社員',
  partner: '業者様',
};

const referrerLabel = (value: unknown): string => {
  const key = asString(value).trim();
  return REFERRER_LABELS[key] ?? key;
};

/**
 * 反響を顧客として取り込む（同期）。
 *
 * ⚠️ **同期先のテーブルは事業区分（division）で変わる。**
 *     注文 → master_data ／ 建売 → master_data_kaeru ／ 中古 → master_data_resale
 *   分岐は features/inquirySync.ts に集約している。ここで書き分けないこと。
 *
 * ⚠️ トランザクションで囲む。顧客テーブルへの INSERT だけ成功して
 *   sync が 0 のまま残ると、次に押したときに**顧客が二重に作られる**。
 *
 * ⚠️ 既に sync = 1 の行は拒否する。画面側でもボタンを隠すが、
 *   連打や古い画面からのリクエストで二重実行されうる。
 */
export const runInquiryIntroductorySync = async (
  body: Record<string, unknown>
): Promise<IntroductoryResult> => {
  const no = toInt(body.no);
  if (no <= 0) {
    return { httpStatus: 400, body: { status: 'error', message: '反響IDが不正です。' } };
  }

  const rows = await query<DynamicRow>(
    'SELECT * FROM inquiry_introductory WHERE `no` = ?',
    [no]
  );
  const inquiry = rows[0];

  if (inquiry === undefined) {
    return { httpStatus: 404, body: { status: 'error', message: '該当する反響が見つかりません。' } };
  }

  if (toInt(inquiry.sync) === 1) {
    // ⚠️ 二重同期の防止。エラーにせず「済み」として返す（連打で赤いエラーが出ると混乱する）
    return {
      httpStatus: 200,
      body: { status: 'ok', message: 'この反響は既に同期済みです。', alreadySynced: true },
    };
  }

  const shop = asString(inquiry.shop).trim();
  if (shop === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '担当店舗が未設定のため同期できません。' },
    };
  }

  // ⚠️ 事業区分は**保存済みの値**を使う。リクエストからは受け取らない。
  //   古い画面から送られた値で、画面に見えているのとは違うテーブルへ
  //   顧客が作られるのを防ぐ。変更は roll: 'update' 側で行う。
  const division = parseDivision(inquiry.division);
  if (division === null) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '事業区分が不正です。担当を再設定してください。' },
    };
  }

  /**
   * ⚠️ 顧客として作るのは**お友達（紹介された人）**であり、紹介者ではない。
   *   ここを取り違えると、既存顧客である紹介者が新規反響として二重に登録される。
   */
  const friendName = asString(inquiry.friendName).trim();
  if (friendName === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: 'お友達の氏名が無いため同期できません。' },
    };
  }

  const registrant = asString(inquiry.registrantName).trim();
  const referrer = referrerLabel(inquiry.referrerType);

  // ⚠️ 紹介元・希望内容を備考に残す。顧客テーブルに対応する列が無いため、
  //   ここで落とすと**顧客に作った瞬間に消える**（反響側には残るが、
  //   営業は顧客情報しか見ない）。
  const remarksLines = [
    registrant === '' ? '' : `紹介者: ${registrant}${referrer === '' ? '' : `（${referrer}）`}`,
    asString(inquiry.campaignName).trim() === '' ? '' : `キャンペーン: ${asString(inquiry.campaignName).trim()}`,
    asString(inquiry.friendLineId).trim() === '' ? '' : `お友達LINE ID: ${asString(inquiry.friendLineId).trim()}`,
    asString(inquiry.guideStaff).trim() === '' ? '' : `ご案内担当者: ${asString(inquiry.guideStaff).trim()}`,
    asString(inquiry.note).trim() === '' ? '' : `ご希望内容: ${asString(inquiry.note).trim()}`,
    // ⚠️ 中古は in_charge_store に取引区分が入り、店舗名が顧客側に残らない。
    //   どの店舗へ割り振った反響なのかを備考で追えるようにする
    DIVISIONS[division].storeIsShop ? '' : `担当店舗: ${shop}`,
  ].filter((line) => line !== '');

  let id = '';

  try {
    await withTransaction(async (tx) => {
      id = await insertCustomer(tx, division, {
        shop,
        staff: asString(inquiry.staff).trim(),
        // ⚠️ お友達の情報を入れる。紹介者の氏名・連絡先ではない
        name: friendName,
        kana: orNull(inquiry.friendKana),
        mobile: orNull(inquiry.friendTel),
        // ⚠️ メールアドレスは紹介者のものしか届かない（お友達の欄が無い）。
        //   紹介者のアドレスを顧客に入れると、お友達宛のメールが
        //   紹介者に届く。空のままにする
        mail: null,
        // ⚠️ 郵便番号・住所も紹介者のもの。お友達の住所は届かない
        zip: null,
        address: null,
        // ⚠️ medium_list に実在する名前（id:11 / list_medium = 1）。
        //   ここを実在しない名前にすると媒体別集計に出てこない
        salesPromotionName: '紹介',
        remarks: remarksLines.length === 0 ? null : remarksLines.join('\n'),
        // ⚠️ メールの受信日時が反響日。'YYYY-MM-DD HH:MM:SS' で保存されている
        inquiryDate: orNull(inquiry.registered),
      });

      await tx.execute(
        'UPDATE inquiry_introductory SET sync = 1, master_data_id = ? WHERE `no` = ?',
        [id, no]
      );
    });
  } catch (error) {
    // ⚠️ 例外メッセージをそのまま返さない。SQLや列名が外部に漏れる
    logger.error(`inquiry_introductory sync failed no=${no}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '同期に失敗しました。時間をおいて再度お試しください。' },
    };
  }

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      id,
      message: `${friendName}様を${division}事業の顧客として作成しました。`,
    },
  };
};
