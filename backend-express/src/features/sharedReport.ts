import { randomBytes } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, executeLarge, query } from '../db/pool';
import type { AuthenticatedStaff } from '../types/staff';
import { logger } from '../utils/logger';
import { AI_ANALYSIS_AUTHORITY } from './aiAnalysis';
import { getJobHtml, getJobSummary } from './aiAnalysis/job';

/**
 * レポートの共有（v2.2.268。表 shared_report）。
 *
 * ─────────────────────────────────────────────
 *   shared_report_create  … 共有URLを作る。Claudeによる分析から（実行した本人か Master）／HTML の登録から（Master）
 *   shared_report_get     … 共有URL（/report?k=…）の画面が呼ぶ。⚠️ ログインしていれば誰でも見られる
 *   shared_report_list    … 共有したレポートの一覧（Master は全員分、ほかの人は自分の分）
 *   shared_report_revoke  … 共有を止める（共有した本人か Master）
 *
 * ⚠️ 見るのにログインが必要なのは、登録の auth: 'staff'（トークンを毎回 DB で確かめる）で担保する。
 *   ⚠️ URL を知っているだけでは見られない。
 * ⚠️ share_key は 128bit の乱数（base64url で22文字）。連番の id は画面に出すが、id では見られない。
 * ⚠️ html は共有した時点の写し。元の分析を消しても見られる。共有を止めると html を消す（NULL）。
 * ⚠️ 画面は html を iframe（sandbox="allow-scripts" だけ）で表示する。レポートのスクリプトからログイン情報は読めない。
 * ⚠️ ログに html は出さない（個人情報が入ることがあるため）。
 * ⚠️ 日時は日本時間を ② で作って書く（ローカルの DB は UTC）。
 * ─────────────────────────────────────────────
 */

/** 登録できる HTML の大きさの上限（バイト）。⚠️ ① の転送・② の本文の上限（10mb）より十分小さくする */
export const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_TITLE = 200;
const KEY = /^[A-Za-z0-9_-]{22}$/;

interface Result<T> {
  httpStatus: number;
  body: T | { status: 'error'; message: string };
}

const fail = (httpStatus: number, message: string): Result<never> => ({ httpStatus, body: { status: 'error', message } });

const jst = (): string => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');

const idOf = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const titleOf = (value: unknown): string =>
  String(value ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, MAX_TITLE);

const isMaster = (staff: AuthenticatedStaff): boolean => staff.brand === 'Master';

interface Row extends RowDataPacket {
  id: number;
  share_key: string;
  title: string;
  source: string;
  source_id: number | null;
  html_bytes: number;
  staff_id: number;
  staff_name: string;
  created_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
}

export interface SharedReportSummary {
  id: number;
  key: string;
  title: string;
  source: string;
  sourceId: number | null;
  htmlBytes: number;
  staffId: number;
  staffName: string;
  createdAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
}

const COLUMNS = `id, share_key, title, source, source_id, html_bytes, staff_id, staff_name,
  created_at, revoked_at, view_count, last_viewed_at`;

const toSummary = (r: Row): SharedReportSummary => ({
  id: r.id,
  key: r.share_key,
  title: r.title,
  source: r.source,
  sourceId: r.source_id,
  htmlBytes: r.html_bytes,
  staffId: r.staff_id,
  staffName: r.staff_name,
  createdAt: r.created_at,
  revokedAt: r.revoked_at,
  viewCount: r.view_count,
  lastViewedAt: r.last_viewed_at,
});

/**
 * 1行足して共有キーを返す。
 * ⚠️ キーが重なる確率は事実上0だが、重なったら（一意制約の違反）作り直す。
 */
const insertReport = async (
  staff: AuthenticatedStaff,
  input: { title: string; source: 'ai_analysis' | 'upload'; sourceId: number | null; html: string; bytes: number }
): Promise<string> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const key = randomBytes(16).toString('base64url');
    try {
      // ⚠️ html は 64KB を超えうるので executeLarge（db/pool.ts の注記）
      await executeLarge(
        `INSERT INTO shared_report (share_key, title, source, source_id, html, html_bytes, staff_id, staff_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [key, input.title, input.source, input.sourceId, input.html, input.bytes, staff.id, staff.name, jst()]
      );
      return key;
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error;
    }
  }
  throw new Error('shared_report: 共有キーを作れませんでした');
};

const findByKey = async (key: string): Promise<Row | null> =>
  (await query<Row>(`SELECT ${COLUMNS} FROM shared_report WHERE share_key = ? LIMIT 1`, [key]))[0] ?? null;

export const createSharedReport = async (
  staff: AuthenticatedStaff,
  body: Record<string, unknown>
): Promise<Result<{ status: 'ok'; item: SharedReportSummary; reused: boolean }>> => {
  if (body.source === 'ai_analysis') {
    if (!AI_ANALYSIS_AUTHORITY.includes(staff.brand)) return fail(403, 'この操作の権限がありません。');
    const jobId = idOf(body.id);
    if (jobId === null) return fail(400, 'id が正しくありません。');
    const job = await getJobSummary(jobId);
    if (job === null) return fail(404, 'この分析は見つかりません。');
    if (job.status !== 'done') return fail(409, 'この分析はまだ終わっていません。');
    if (!isMaster(staff) && job.staffId !== staff.id) return fail(403, '共有できるのは、分析を実行した本人か Master だけです。');

    // ⚠️ 同じ分析をすでに共有していれば、そのURLを返す（押すたびに増やさない）
    const existing = await query<Row>(
      `SELECT ${COLUMNS} FROM shared_report
        WHERE source = 'ai_analysis' AND source_id = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1`,
      [jobId]
    );
    if (existing[0] !== undefined) return { httpStatus: 200, body: { status: 'ok', item: toSummary(existing[0]), reused: true } };

    const html = (await getJobHtml(jobId)) ?? '';
    const bytes = Buffer.byteLength(html, 'utf8');
    if (bytes === 0) return fail(409, 'この分析のレポートが空です。');
    if (bytes > MAX_HTML_BYTES) return fail(413, 'レポートが大きすぎるため共有できません（5MBまで）。');

    const title = titleOf(job.title) || 'Claudeによる分析';
    const key = await insertReport(staff, { title, source: 'ai_analysis', sourceId: jobId, html, bytes });
    logger.info(`shared_report: 共有を作りました（Claudeによる分析 id=${jobId}、staff_id=${staff.id}）`);
    const row = await findByKey(key);
    return row === null ? fail(500, '共有を作れませんでした。') : { httpStatus: 200, body: { status: 'ok', item: toSummary(row), reused: false } };
  }

  if (body.source === 'upload') {
    if (!isMaster(staff)) return fail(403, 'HTML の登録は Master だけができます。');
    const title = titleOf(body.title);
    if (title === '') return fail(400, '題を入れてください。');
    const html = typeof body.html === 'string' ? body.html : '';
    const bytes = Buffer.byteLength(html, 'utf8');
    if (bytes === 0) return fail(400, 'HTML ファイルを選んでください。');
    if (bytes > MAX_HTML_BYTES) return fail(413, 'HTML が大きすぎます（5MBまで）。');
    if (!/<(html|body|div|table|main|section|h1|p)[\s>]/i.test(html)) return fail(400, 'HTML ファイルではないようです。');

    const key = await insertReport(staff, { title, source: 'upload', sourceId: null, html, bytes });
    logger.info(`shared_report: HTML を登録しました（${bytes} バイト、staff_id=${staff.id}）`);
    const row = await findByKey(key);
    return row === null ? fail(500, '登録できませんでした。') : { httpStatus: 200, body: { status: 'ok', item: toSummary(row), reused: false } };
  }

  return fail(400, '共有する元（source）が正しくありません。');
};

/** 共有URLの画面が呼ぶ。⚠️ ログインしていれば誰でも見られる（auth: 'staff'） */
export const getSharedReport = async (
  body: Record<string, unknown>
): Promise<Result<{ status: 'ok'; title: string; staffName: string; createdAt: string; source: string; html: string }>> => {
  const key = String(body.key ?? '');
  if (!KEY.test(key)) return fail(404, 'このURLのレポートは見つかりません。URLをもう一度確かめてください。');

  const rows = await query<Row & { html: string | null }>(
    `SELECT ${COLUMNS}, html FROM shared_report WHERE share_key = ? LIMIT 1`,
    [key]
  );
  const row = rows[0];
  if (row === undefined) return fail(404, 'このURLのレポートは見つかりません。URLをもう一度確かめてください。');
  if (row.revoked_at !== null || row.html === null) return fail(410, 'このレポートの共有は止められました。共有した人に確かめてください。');

  // ⚠️ 閲覧回数の記録に失敗しても、レポートは見せる
  execute('UPDATE shared_report SET view_count = view_count + 1, last_viewed_at = ? WHERE id = ?', [jst(), row.id])
    .catch((error: unknown) => logger.error('shared_report: 閲覧回数を記録できませんでした', error));

  return {
    httpStatus: 200,
    body: { status: 'ok', title: row.title, staffName: row.staff_name, createdAt: row.created_at, source: row.source, html: row.html },
  };
};

/** 一覧。Master は全員分、ほかの人は自分が共有した分 */
export const listSharedReports = async (
  staff: AuthenticatedStaff
): Promise<{ status: 'ok'; items: SharedReportSummary[]; isMaster: boolean; myStaffId: number }> => {
  const master = isMaster(staff);
  const rows = await query<Row>(
    `SELECT ${COLUMNS} FROM shared_report ${master ? '' : 'WHERE staff_id = ?'} ORDER BY id DESC LIMIT 500`,
    master ? [] : [staff.id]
  );
  return { status: 'ok', items: rows.map(toSummary), isMaster: master, myStaffId: staff.id };
};

/** 共有を止める（共有した本人か Master）。⚠️ html も消す */
export const revokeSharedReport = async (
  staff: AuthenticatedStaff,
  body: Record<string, unknown>
): Promise<Result<{ status: 'ok' }>> => {
  const id = idOf(body.id);
  if (id === null) return fail(400, 'id が正しくありません。');
  const rows = await query<Row>(`SELECT ${COLUMNS} FROM shared_report WHERE id = ? LIMIT 1`, [id]);
  const row = rows[0];
  if (row === undefined) return fail(404, 'この共有は見つかりません。');
  if (!isMaster(staff) && row.staff_id !== staff.id) return fail(403, '止められるのは、共有した本人か Master だけです。');
  if (row.revoked_at !== null) return { httpStatus: 200, body: { status: 'ok' } };

  await execute('UPDATE shared_report SET revoked_at = ?, revoked_by = ?, html = NULL WHERE id = ?', [jst(), staff.id, id]);
  logger.info(`shared_report: 共有を止めました（id=${id}、staff_id=${staff.id}）`);
  return { httpStatus: 200, body: { status: 'ok' } };
};
