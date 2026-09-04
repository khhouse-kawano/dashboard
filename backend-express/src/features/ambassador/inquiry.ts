import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';
import type { AmbassadorResult } from './index';

/**
 * アンバサダー反響の公開受付。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **これはこのシステムで唯一の「認証なしの書き込み口」である。**
 *
 *   反響元: https://kh-house.jp/ambassador/?id=<ambassador_list.no>
 *   受け口: POST https://api.khg-marketing.info/api/gateway
 *           { "request": "ambassador_inquiry", ... }
 *
 *   社外の誰でも、ブラウザでもcurlでも叩ける。したがって
 *
 *     ・**リクエストの値を一切信用しない。** 特に id は改ざんできる
 *     ・shop / staff / sync / master_data_id は**受け付けない**
 *       （受け付けると「同期済み」に偽装され、追客から消える）
 *     ・全項目に長さ上限を掛ける（TEXT列を無限に太らせない）
 *     ・例外の内容を応答に含めない（SQLや列名が漏れる）
 *     ・流量制限を掛ける（middlewares/publicFormRateLimit.ts）
 * ─────────────────────────────────────────────
 *
 * ⚠️ 検証に失敗しても**握りつぶして 400 を返すだけにしない。**
 *   反響1件は営業の機会そのものであり、失われると気づけない。
 *   「弾く」のは明らかな不正だけにし、迷う値は保存して画面側で直させる。
 *
 * 対になるフォーム: 国分ハウジングで叶える夢のおうち_修正01_フォルダー/form.js
 *   ⚠️ フォームの `key` を変えるとここも直す必要がある（型では検出できない）。
 */

// ---------------------------------------------------------------------------
// 入力の正規化
// ---------------------------------------------------------------------------

/**
 * 文字列として取り出し、長さで切る。
 *
 * ⚠️ 上限を超えたらエラーにせず**切り詰める。**
 *   長すぎるという理由で反響を捨てるのは損失が大きい。
 *   目的は「TEXT列を無限に太らせないこと」であって入力の拒否ではない。
 *
 * ⚠️ 制御文字を除去する。フォームからは来ないが、curl では送れる。
 *   混入すると一覧の表示やCSV出力が壊れる。
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

interface AmbassadorNoRow extends RowDataPacket {
  no: number;
}

const clean = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
};

/** 空文字は NULL で保存する。'' と NULL が混在すると絞り込みが面倒になる */
const orNull = (value: string): string | null => (value === '' ? null : value);

/**
 * 電話番号。ハイフンや全角空白を落として数字だけにする。
 *
 * ⚠️ 数字以外が残っていても保存する。国際番号や内線付きで来ることがあり、
 *   弾くと反響を失う。整形できたときだけ整形する、という方針。
 */
const normalizePhone = (value: string): string => {
  const digits = value.replace(/[-－\s　()（）]/g, '');
  return /^\+?\d{9,15}$/.test(digits) ? digits : value;
};

/** 郵便番号。ハイフンを外して7桁に寄せる（master_data 側の形式に合わせる） */
const normalizeZip = (value: string): string => {
  const digits = value.replace(/[^0-9]/g, '');
  return digits.length === 7 ? digits : value;
};

/**
 * インスタのアカウント名。先頭の @ を外して保存する。
 *
 * ⚠️ 台帳（ambassador_list.account）が @ 無しで登録されているため、
 *   ここで揃えておかないと目視での突き合わせができなくなる。
 *   フォーム側は表示のために @ を付けて送ってくる。
 */
const normalizeAccount = (value: string): string => value.replace(/^@+/, '');

/** 今日の日付（YYYY-MM-DD）。DATE 列にそのまま入る */
const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// 受付
// ---------------------------------------------------------------------------

/**
 * 公開フォームからの反響を受け付ける。
 *
 * ⚠️ 応答に**内部の情報を含めない。** 採番した no すら返さない。
 *   返すと、連番を数えて反響の総数を推測されうる。
 *   フォーム側は成功・失敗しか見ていない。
 */
export const runAmbassadorInquiry = async (
  body: Record<string, unknown>
): Promise<AmbassadorResult> => {
  const name = clean(body.name, 100);
  const mail = clean(body.mail, 255);
  const phone = normalizePhone(clean(body.phone, 30));

  // ⚠️ 氏名と、連絡が取れる手段が1つも無い反響は受け付けない。
  //   保存しても営業が誰にも連絡できず、一覧に「連絡先不明」が
  //   溜まっていくだけになる。ここだけは弾く。
  if (name === '') {
    return { httpStatus: 400, body: { status: 'error', message: 'お名前を入力してください。' } };
  }
  if (mail === '' && phone === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: 'メールアドレスまたは電話番号を入力してください。' },
    };
  }

  // -------------------------------------------------------------------------
  // アンバサダーの照合
  //
  // ⚠️ URL の ?id= は社外の誰でも書き換えられる。生の値は ambassador_id に
  //   保存しつつ、台帳に実在したときだけ ambassador_no を入れる。
  //
  // ⚠️ 照合できなくても**反響は保存する。** ここで弾くと、
  //   URLからidが落ちただけの正当な反響を丸ごと失う。
  //   画面側は ambassador_no が NULL の行を「台帳に未登録」と警告表示する。
  // -------------------------------------------------------------------------
  const ambassadorId = clean(body.id, 64);
  let ambassadorNo: number | null = null;

  if (/^\d{1,9}$/.test(ambassadorId)) {
    const rows = await query<AmbassadorNoRow>(
      'SELECT `no` FROM ambassador_list WHERE `no` = ? LIMIT 1',
      [Number(ambassadorId)]
    );
    ambassadorNo = rows[0]?.no ?? null;
  }

  if (ambassadorNo === null && ambassadorId !== '') {
    // ⚠️ 握りつぶさない。台帳から削除された・URLが古いといった
    //   運用上の問題がここでしか分からない
    logger.warn(`ambassador_inquiry: 台帳に無い id を受信しました id="${ambassadorId}"`);
  }

  // ⚠️ shop / staff / sync / master_data_id はリクエストから受け取らない。
  //   担当店舗は建築希望地を見て社内で割り振る運用のため、
  //   ここでは空のまま保存する（画面側で「未設定」と赤字表示される）。
  const values: SqlParam[] = [
    ambassadorNo,
    orNull(ambassadorId),
    orNull(name),
    orNull(clean(body.kana, 100)),
    orNull(normalizeZip(clean(body.zip, 20))),
    orNull(clean(body.address, 255)),
    orNull(clean(body.area, 255)),
    orNull(phone),
    orNull(mail),
    orNull(normalizeAccount(clean(body.insta, 100))),
    today(),
    // ⚠️ 同意は真偽値で届く。文字列 'false' が来ても偽として扱う
    body.agree === true || body.agree === 'true' || body.agree === 1 ? 1 : 0,
  ];

  const INSERT_SQL = `
    INSERT INTO inquiry_ambassador (
      ambassador_no,
      ambassador_id,
      name,
      kana,
      zip,
      address,
      build_area,
      mobile,
      mail,
      account,
      inquiry_date,
      agreed,
      sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `;

  try {
    await execute(INSERT_SQL, values);
  } catch (error) {
    // ⚠️ 例外メッセージをそのまま返さない。SQLや列名が外部に漏れる。
    //   ⚠️ ログには必ず内容を残す。ここが唯一の記録であり、
    //     失われた反響を後から復元する手段は無い
    logger.error(
      `ambassador_inquiry の登録に失敗しました name="${name}" mail="${mail}" phone="${phone}" ` +
        `id="${ambassadorId}": ${(error as Error).message}`
    );
    return {
      httpStatus: 500,
      body: {
        status: 'error',
        message: '送信に失敗しました。お手数ですが時間をおいて再度お試しください。',
      },
    };
  }

  logger.info(
    `ambassador_inquiry を受け付けました name="${name}" ambassador_no=${ambassadorNo ?? '(未照合)'}`
  );

  return { httpStatus: 200, body: { status: 'ok' } };
};
