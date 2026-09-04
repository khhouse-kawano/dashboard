import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from '../../db/pool';
import type { SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';
import { DIVISIONS, insertCustomer, parseDivision } from '../inquirySync';

/**
 * Instagram 公式アンバサダー管理。
 *
 * ─────────────────────────────────────────────
 * ⚠️ この機能は **Express のみ**で実装している。PHPハンドラは存在しない。
 *
 *   そのため
 *     ・差分比較（cli/compareBackends）は使えない（比較相手が無い）
 *     ・② が落ちるとこの画面だけ動かなくなる（① にフォールバック先が無い）
 *     ・⚠️ ② のDBユーザーに **INSERT / UPDATE 権限が必要**
 *
 *   逆に、PHPハンドラが無いおかげで**書き込み系を ① の転送許可リストに
 *   入れても安全**である。① が自動フォールバックしても実行するPHPが無く、
 *   404 になるだけで二重実行にならない。
 *   （PHPハンドラがある request では二重実行になるため入れてはいけない）
 * ─────────────────────────────────────────────
 *
 * テーブル: backend/scripts/sql/2026-09-03_ambassador.sql
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** PHP の (string) と同じ寄せ方。数値や null で落ちないようにする */
const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/** 空文字は NULL として保存する。TEXT 列に '' と NULL が混在すると絞り込みが面倒になる */
const orNull = (value: unknown): string | null => {
  const s = asString(value).trim();
  return s === '' ? null : s;
};

const toInt = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/** ハンドラの戻り値。ステータスコードを出し分けるため本文と一緒に持つ */
export interface AmbassadorResult {
  httpStatus: number;
  body: unknown;
}

// ---------------------------------------------------------------------------
// アンバサダー台帳
// ---------------------------------------------------------------------------

/**
 * 編集・追加で受け付ける列。
 *
 * ⚠️ ホワイトリストにすること。リクエストのキーをそのまま列名に使うと、
 *   `no` や未知の列を書き換えられる。
 */
const AMBASSADOR_COLUMNS = [
  'name',
  'kana',
  'address',
  'mobile',
  'mail',
  'account',
  'shop',
  'staff',
  'remarks',
  'registered_at',
] as const;

/**
 * 台帳の一覧。反響数を付けて返す。
 *
 * ⚠️ `inquiry`（反響数）は列として保存していない。ここで数える。
 *   列に持つと、反響の登録・削除で更新を忘れた瞬間に実態とずれ、
 *   どちらが正しいか分からなくなる（エラーにならないので気づけない）。
 *
 * ⚠️ 紐づけは `ambassador_no`。`account` では紐づけない。
 *   アカウント名が変わると過去の反響との紐づきが切れる。
 */
const AMBASSADOR_LIST_SQL = `
  SELECT a.*,
         (SELECT COUNT(*) FROM inquiry_ambassador i WHERE i.ambassador_no = a.no) AS inquiry,
         (SELECT COUNT(*) FROM inquiry_ambassador i
           WHERE i.ambassador_no = a.no AND i.sync = 0) AS inquiry_unsynced
    FROM ambassador_list a
   ORDER BY a.no DESC
`;

export const runAmbassadorList = async (): Promise<AmbassadorResult> => {
  const ambassador = await query<DynamicRow>(AMBASSADOR_LIST_SQL);
  return { httpStatus: 200, body: { status: 'ok', ambassador } };
};

/**
 * 台帳の新規追加。
 *
 * ⚠️ `no` は AUTO_INCREMENT。採番した値を返すこと。
 *   返さないと画面側が「保存したのに no が分からない」状態になり、
 *   直後の編集が別レコードを更新する事故につながる。
 */
export const runAmbassadorInsert = async (
  body: Record<string, unknown>
): Promise<AmbassadorResult> => {
  const name = asString(body.name).trim();
  if (name === '') {
    return { httpStatus: 400, body: { status: 'error', message: '氏名は必須です。' } };
  }

  const columns = [...AMBASSADOR_COLUMNS];
  const values: SqlParam[] = columns.map((col) => orNull(body[col]));

  const sql = `INSERT INTO ambassador_list (${columns.map((c) => `\`${c}\``).join(', ')})
               VALUES (${columns.map(() => '?').join(', ')})`;

  const result = await execute(sql, values);

  return {
    httpStatus: 200,
    body: { status: 'ok', no: result.insertId },
  };
};

/**
 * 台帳の更新。送られてきた列だけを更新する。
 *
 * ⚠️ 送られていない列を NULL で潰さないこと。画面は1セルずつ保存するため、
 *   全列を書くと他のセルの入力が消える。
 */
export const runAmbassadorUpdate = async (
  body: Record<string, unknown>
): Promise<AmbassadorResult> => {
  const no = toInt(body.no);
  if (no <= 0) {
    return { httpStatus: 400, body: { status: 'error', message: 'アンバサダーIDが不正です。' } };
  }

  const columns = AMBASSADOR_COLUMNS.filter((col) => col in body);
  if (columns.length === 0) {
    return { httpStatus: 400, body: { status: 'error', message: '更新する項目がありません。' } };
  }

  const setClause = columns.map((col) => `\`${col}\` = ?`).join(', ');
  const values: SqlParam[] = [...columns.map((col) => orNull(body[col])), no];

  const result = await execute(
    `UPDATE ambassador_list SET ${setClause} WHERE \`no\` = ?`,
    values
  );

  if (result.affectedRows === 0) {
    return {
      httpStatus: 404,
      body: { status: 'error', message: '該当するアンバサダーが見つかりません。' },
    };
  }

  return { httpStatus: 200, body: { status: 'ok' } };
};

// ---------------------------------------------------------------------------
// 反響
// ---------------------------------------------------------------------------

/**
 * 反響の一覧。台帳の氏名・アカウントを添えて返す。
 *
 * ⚠️ LEFT JOIN にする。台帳が未登録の反響（`ambassador_no` が NULL）も
 *   一覧に出す必要がある。INNER JOIN にすると黙って消える。
 *
 * ⚠️ 反響時点の `account` は反響側にも保存されている。
 *   台帳側の現在値（`ambassador_account`）とは別物なので、
 *   どちらを表示しているかを画面側で取り違えないこと。
 */
const INQUIRY_LIST_SQL = `
  SELECT i.*,
         a.name    AS ambassador_name,
         a.account AS ambassador_account,
         a.shop    AS ambassador_shop
    FROM inquiry_ambassador i
    LEFT JOIN ambassador_list a ON a.no = i.ambassador_no
   ORDER BY i.inquiry_date DESC, i.no DESC
`;

export const runInquiryAmbassadorList = async (): Promise<AmbassadorResult> => {
  const inquiry = await query<DynamicRow>(INQUIRY_LIST_SQL);
  return { httpStatus: 200, body: { status: 'ok', inquiry } };
};

/**
 * 反響の担当店舗・担当営業を更新する。
 *
 * ⚠️ 更新できるのはこの2列だけ。氏名や連絡先は**顧客本人が入力した値**であり、
 *   社内で書き換えると、後から「本当は何と入力されたのか」が分からなくなる。
 *   誤りがあれば同期後に master_data 側で直す。
 *
 * ⚠️ 同期済み（sync = 1）の行は拒否する。
 *   ここを許すと、既に作られた master_data の担当は変わらないまま
 *   反響側の表示だけが変わり、**画面上は正しいのに実態と食い違う**
 *   という最も気づきにくい状態になる。
 *
 * ⚠️ `division`（事業区分）も同期前だけ変更できる。同期先のテーブルが
 *   変わる項目なので、同期後の変更は意味を持たない（顧客は移動しない）。
 */
const INQUIRY_EDITABLE_COLUMNS = ['shop', 'staff', 'division'] as const;

export const runInquiryAmbassadorUpdate = async (
  body: Record<string, unknown>
): Promise<AmbassadorResult> => {
  const no = toInt(body.no);
  if (no <= 0) {
    return { httpStatus: 400, body: { status: 'error', message: '反響IDが不正です。' } };
  }

  const columns = INQUIRY_EDITABLE_COLUMNS.filter((col) => col in body);
  if (columns.length === 0) {
    return { httpStatus: 400, body: { status: 'error', message: '更新する項目がありません。' } };
  }

  // ⚠️ division は NOT NULL であり、同期先のテーブルを決める値でもある。
  //   空や未知の値を通すと INSERT が落ちるか、別の事業の顧客が作られる。
  if ('division' in body && parseDivision(body.division) === null) {
    return { httpStatus: 400, body: { status: 'error', message: '事業区分が不正です。' } };
  }

  const rows = await query<DynamicRow>(
    'SELECT sync FROM inquiry_ambassador WHERE `no` = ?',
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

  await execute(`UPDATE inquiry_ambassador SET ${setClause} WHERE \`no\` = ?`, values);

  return { httpStatus: 200, body: { status: 'ok' } };
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
export const runInquiryAmbassadorSync = async (
  body: Record<string, unknown>
): Promise<AmbassadorResult> => {
  const no = toInt(body.no);
  if (no <= 0) {
    return { httpStatus: 400, body: { status: 'error', message: '反響IDが不正です。' } };
  }

  const rows = await query<DynamicRow>(
    'SELECT * FROM inquiry_ambassador WHERE `no` = ?',
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
    // ⚠️ 店舗が無いと in_charge_store が空の顧客ができ、どの店舗の案件か分からなくなる。
    //   ListOrder も同じ理由で店舗未設定を弾いている。
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

  const staff = asString(inquiry.staff).trim();
  const account = asString(inquiry.account).trim();

  // ⚠️ 建築希望地を備考に含める。master_data 側に専用の列が無いため、
  //   ここで落とすと**顧客に作った瞬間に消える**（反響側には残るが、
  //   営業は master_data しか見ない）。
  const buildArea = asString(inquiry.build_area).trim();

  const remarksLines = [
    account === '' ? '' : `紹介アンバサダー: ${account}`,
    buildArea === '' ? '' : `建築希望地: ${buildArea}`,
    // ⚠️ 中古は in_charge_store に取引区分が入り、店舗名が顧客側に残らない。
    //   どの店舗へ割り振った反響なのかを備考で追えるようにする
    DIVISIONS[division].storeIsShop ? '' : `担当店舗: ${shop}`,
  ].filter((line) => line !== '');

  let id = '';

  try {
    await withTransaction(async (tx) => {
      id = await insertCustomer(tx, division, {
        shop,
        staff,
        name: orNull(inquiry.name),
        kana: orNull(inquiry.kana),
        mobile: orNull(inquiry.mobile),
        mail: orNull(inquiry.mail),
        zip: orNull(inquiry.zip),
        address: orNull(inquiry.address),
        // ⚠️ 媒体名。medium_list に同じ名前が無いと媒体別集計に出てこない。
        //   マスタ側の登録を確認すること
        salesPromotionName: '公式アンバサダー',
        // ⚠️ どのアンバサダー経由かを顧客側にも残す。
        //   これが無いと、顧客だけ見たときに紹介元が分からない
        remarks: remarksLines.length === 0 ? null : remarksLines.join('\n'),
        inquiryDate: orNull(inquiry.inquiry_date),
      });

      await tx.execute(
        'UPDATE inquiry_ambassador SET sync = 1, master_data_id = ? WHERE `no` = ?',
        [id, no]
      );
    });
  } catch (error) {
    // ⚠️ 例外メッセージをそのまま返さない。SQLや列名が外部に漏れる
    logger.error(`inquiry_ambassador sync failed no=${no}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '同期に失敗しました。時間をおいて再度お試しください。' },
    };
  }

  return {
    httpStatus: 200,
    // ⚠️ どの事業の顧客になったかを必ず伝える。3つのテーブルに分かれるため、
    //   区分を出さないと「作ったのに一覧に無い」と誤解される
    body: {
      status: 'ok',
      id,
      message: `${asString(inquiry.name)}様を${division}事業の顧客として作成しました。`,
    },
  };
};
