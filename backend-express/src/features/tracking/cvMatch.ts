import { createHash } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { CV_TARGETS } from './conversion';

/**
 * 自社のフォームでないサイトの CV と反響の突き合わせ（v2.2.205）。② の起動から2分後に1回、その後5分ごと（startCvMatch）。
 *
 * ─────────────────────────────────────────────
 * 1. ブランドごとに（conversion.ts の CV_TARGETS）、直近14日の CV（tracking_conversions）を読む
 * 2. 反響の表から、landing_params が空の、直近15日のホームページ反響（削除を除く）を読む
 *    ⚠️ 反響は通知メールから GAS が入れる（届く順番は CV と前後する。だから CV を別の表に貯めておく）
 * 3. 反響のメール・携帯・固定電話を cv.js と同じ方法でハッシュにし、どれかが一致して、CV の日が反響の日以前のものを探す
 *    ⚠️ 一致が複数あれば最後の CV。⚠️ 同じ人が別のフォームでも送っていれば、その反響にも同じ CV を使う
 * 4. 反響の landing_params に、CV が覚えていた流入の情報（khg_vid を含む）を書く。CV に結びついた反響を書く（最初の1件）
 *    ⚠️ 反響がもう顧客DBに取り込まれていたら（pg_id あり）、顧客の landing_params にも書く（空のときだけ。顧客情報の「HP閲覧履歴」が読む）
 *    ⚠️ 取り込みがあとなら、反響一覧の「取込」が反響の landing_params を顧客へ引き継ぐ（ListKaeru.tsx）
 * 5. 14日たっても結びつかない CV を消す（確認画面で止めた人など）
 * ⚠️ 正規化は public/cv.js と必ず同じにすること（メールは前後の空白を除いて小文字、電話は数字だけ。全角の数字・記号は半角に）。
 * ─────────────────────────────────────────────
 */

const KEEP_DAYS = 14;
const INQUIRY_DAYS = 15;
const FIRST_DELAY_MS = 120_000;
const INTERVAL_MS = 5 * 60 * 1000;

const halfWidth = (s: string): string => s.replace(/[０-９＠．＿－＋]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

export const emailHashOf = (value: string | null): string => {
  const email = halfWidth(value ?? '').trim().toLowerCase();
  return email.indexOf('@') < 1 ? '' : sha256(email);
};

export const telHashOf = (value: string | null): string => {
  const tel = halfWidth(value ?? '').replace(/[^0-9]/g, '');
  return tel.length < 10 ? '' : sha256(tel);
};

interface CvRow extends RowDataPacket {
  id: number;
  email_hash: string;
  tel_hash: string;
  landing_params: string | null;
  visitor_id: string;
  day: string;
  matched_at: string | null;
}

interface InquiryRow extends RowDataPacket {
  inquiry_id: string;
  pg_id: string | null;
  mail: string | null;
  mobile: string | null;
  landline: string | null;
  day: string | null;
}

export interface CvMatchResult {
  matched: number;
  removed: number;
}

export const runCvMatch = async (): Promise<CvMatchResult> => {
  let matched = 0;
  for (const [brand, { inquiry: table, master }] of Object.entries(CV_TARGETS)) {
    // ⚠️ 新しい順（一致が複数あれば最初に見つかったものが最後の CV）
    const cvs = await query<CvRow>(
      `SELECT c.id, c.email_hash, c.tel_hash, c.landing_params, c.visitor_id, DATE_FORMAT(c.created_at, '%Y-%m-%d') AS day, c.matched_at
         FROM tracking_conversions c JOIN tracking_sites s ON s.id = c.site_id
        WHERE s.brand = ? AND c.created_at >= NOW() - INTERVAL ${KEEP_DAYS} DAY
        ORDER BY c.created_at DESC, c.id DESC`,
      [brand]
    );
    if (cvs.length === 0) continue;
    const byHash = new Map<string, CvRow[]>();
    for (const cv of cvs) {
      for (const hash of [cv.email_hash, cv.tel_hash]) {
        if (hash === '') continue;
        const list = byHash.get(hash) ?? [];
        list.push(cv);
        byHash.set(hash, list);
      }
    }

    const inquiries = await query<InquiryRow>(
      `SELECT inquiry_id, pg_id, mail, mobile, landline, DATE_FORMAT(STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d'), '%Y-%m-%d') AS day
         FROM ${table}
        WHERE delete_flag = 0 AND medium = 'ホームページ反響' AND (landing_params IS NULL OR landing_params = '')
          AND STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d') >= CURDATE() - INTERVAL ${INQUIRY_DAYS} DAY`
    );
    for (const inquiry of inquiries) {
      if (inquiry.day === null) continue;
      const hashes = [emailHashOf(inquiry.mail), telHashOf(inquiry.mobile), telHashOf(inquiry.landline)].filter((h) => h !== '');
      const hits = new Map<number, CvRow>();
      for (const hash of hashes) for (const cv of byHash.get(hash) ?? []) if (cv.day <= (inquiry.day as string)) hits.set(cv.id, cv);
      if (hits.size === 0) continue;
      const chosen = [...hits.values()].sort((a, b) => b.day.localeCompare(a.day) || b.id - a.id)[0];
      const landing = chosen.landing_params && chosen.landing_params.includes('khg_vid=') ? chosen.landing_params : `khg_vid=${chosen.visitor_id}`;
      const updated = await execute(
        `UPDATE ${table} SET landing_params = ? WHERE inquiry_id = ? AND (landing_params IS NULL OR landing_params = '')`,
        [landing, inquiry.inquiry_id]
      );
      if (updated.affectedRows === 0) continue;
      matched += 1;
      if (inquiry.pg_id) {
        await execute(`UPDATE ${master} SET landing_params = ? WHERE id = ? AND (landing_params IS NULL OR landing_params = '')`, [landing, inquiry.pg_id]);
      }
      const open = [...hits.values()].filter((cv) => cv.matched_at === null).map((cv) => cv.id);
      if (open.length > 0) {
        await execute(
          `UPDATE tracking_conversions SET matched_inquiry_id = ?, matched_at = NOW() WHERE matched_at IS NULL AND id IN (${open.map(() => '?').join(', ')})`,
          [inquiry.inquiry_id, ...open]
        );
        for (const cv of hits.values()) cv.matched_at = cv.matched_at ?? 'now';
      }
    }
  }

  const removed = await execute(`DELETE FROM tracking_conversions WHERE matched_at IS NULL AND created_at < NOW() - INTERVAL ${KEEP_DAYS} DAY`);
  if (matched > 0 || removed.affectedRows > 0) {
    logger.info(`tracking: CV を反響に結びつけました（${matched} 件・結びつかずに消した CV ${removed.affectedRows} 件）`);
  }
  return { matched, removed: removed.affectedRows };
};

export const startCvMatch = (): void => {
  const run = (): void => {
    runCvMatch().catch((error: unknown) => logger.error('tracking: CV の突き合わせに失敗しました', error));
  };
  setTimeout(run, FIRST_DELAY_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
};
