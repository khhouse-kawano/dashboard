import { timingSafeEqual } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env';
import { execute, query } from '../db/pool';
import { logger } from '../utils/logger';

/**
 * sync（Heroku の自動取り込み。projects/sync）の実行結果（v2.2.259）。表は sync_run_log。
 *
 * ─────────────────────────────────────────────
 *   書く … sync_log:write（sync が ② へ直接送る。ログイン無し・合い言葉 SYNC_LOG_SECRET）
 *          ⚠️ 以前は失敗をメールで送っていた（sendErrorMail）。Gmail の認証が切れて届かなくなり、
 *             成功は残らず、店舗ごとの失敗は「成功」に隠れていた（2026-11-10 の ielove の 403）
 *   読む … sync_log_list（Master だけ。システム管理 →「同期の実行結果」header/system/SyncLog.tsx）
 *   消す … 180日より古い行を、起動の5分後と毎日（startSyncLogMaintenance）
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface SyncLogResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const KEEP_DAYS = 180;
const STATUSES = ['success', 'partial', 'failure'] as const;
type SyncStatus = (typeof STATUSES)[number];
/** 1回に受ける行の上限（portal の全タスクでも 40 に届かない） */
const MAX_ROWS = 100;
/** 理由の1件・件数の上限（画面のスクリーンショットの HTML などが丸ごと来ても表を膨らませない） */
const MAX_ERROR_LEN = 4000;
const MAX_ERRORS = 50;
/** 一覧で返す行の上限 */
const LIST_LIMIT = 2000;

const fail = (httpStatus: number, message: string): SyncLogResult => ({ httpStatus, body: { status: 'error', message } });
const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const cut = (v: unknown, max: number): string => str(v).slice(0, max);

/** 合い言葉。⚠️ 未設定なら必ず false。⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる（meta_scrape と同じ） */
const keyMatches = (input: string): boolean => {
  const expected = env.syncLogSecret;
  if (expected === '') return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** ISO の日時（sync は UTC の toISOString で送る）→ 日本時間の 'YYYY-MM-DD HH:MM:SS'。読めなければ null */
const toJst = (v: unknown): string | null => {
  const ms = Date.parse(str(v));
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
};

type CleanRow = [string, string, string, SyncStatus, string, string | null, string, string, number];

/** 1行を確かめて、INSERT の値にする。⚠️ 形が違う行は null（その行だけ捨てる） */
const cleanRow = (raw: unknown): CleanRow | null => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const status = str(r.status) as SyncStatus;
  const runId = cut(r.runId, 40).trim();
  const task = cut(r.task, 100).trim();
  const started = toJst(r.startedAt);
  const finished = toJst(r.finishedAt);
  if (!STATUSES.includes(status) || runId === '' || task === '' || started === null || finished === null) return null;
  const errors = Array.isArray(r.errors)
    ? r.errors.slice(0, MAX_ERRORS).map((e) => cut(e, MAX_ERROR_LEN)).filter((e) => e !== '')
    : [];
  const duration = Math.max(0, Math.min(2_147_483_647, Math.round(Date.parse(str(r.finishedAt)) - Date.parse(str(r.startedAt)))));
  return [runId, cut(r.route, 100).trim() || '(不明)', task, status, cut(r.message, 500), errors.length ? JSON.stringify(errors) : null, started, finished, duration];
};

/**
 * sync_log:write。body = { key, rows: [{ runId, route, task, status, message, errors[], startedAt, finishedAt }] }
 * 応答: { status: 'success', saved, skipped }。合い言葉が違えば 401（流量の上限は失敗だけを数える。publicFormRateLimit.ts）
 */
export const writeSyncLog = async (body: Record<string, unknown>): Promise<SyncLogResult> => {
  if (!keyMatches(str(body.key))) {
    if (env.syncLogSecret === '') logger.warn('sync_log: SYNC_LOG_SECRET が未設定のため、sync の実行結果を断りました。');
    return fail(401, '合い言葉が正しくありません');
  }
  const list = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  const rows = list.map(cleanRow).filter((r): r is CleanRow => r !== null);
  if (rows.length > 0) {
    await execute(
      `INSERT INTO sync_run_log (run_id, route, task, status, message, errors, started_at, finished_at, duration_ms)
       VALUES ${rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      rows.flat()
    );
  }
  return { httpStatus: 200, body: { status: 'success', saved: rows.length, skipped: list.length - rows.length } };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * sync_log_list。body = { from?, to?（YYYY-MM-DD。既定は直近7日）, task?, status? }
 * 応答:
 *   rows    … 期間・絞り込みの行（新しい順・最大 LIST_LIMIT 件）
 *   latest  … タスクごとの最新の結果・最後の成功（⚠️ 期間に関係なく、残っている 180日分から）
 *   tasks   … 残っているタスクの名前
 */
export const listSyncLog = async (body: Record<string, unknown>): Promise<SyncLogResult> => {
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() + 9 * 3600_000 - 6 * 86400_000).toISOString().slice(0, 10);
  const from = DATE_RE.test(str(body.from)) ? str(body.from) : weekAgo;
  const to = DATE_RE.test(str(body.to)) ? str(body.to) : today;
  const where = ['started_at >= ?', 'started_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params: string[] = [from, to];
  const task = str(body.task).trim();
  if (task !== '') { where.push('task = ?'); params.push(task); }
  const status = str(body.status);
  if ((STATUSES as readonly string[]).includes(status)) { where.push('status = ?'); params.push(status); }

  const [rows, latestRows, successes, failures] = await Promise.all([
    query<DynamicRow>(
      `SELECT id, run_id, route, task, status, message, errors,
              DATE_FORMAT(started_at, '%Y-%m-%d %H:%i:%s') AS started_at,
              DATE_FORMAT(finished_at, '%Y-%m-%d %H:%i:%s') AS finished_at, duration_ms
         FROM sync_run_log WHERE ${where.join(' AND ')}
        ORDER BY started_at DESC, id DESC LIMIT ${LIST_LIMIT}`,
      params
    ),
    // ⚠️ タスクごとの最新の1行。⚠️ id は書き込んだ順（sync はタスクが終わったときに送る）なので、MAX(id) を最新とする
    query<DynamicRow>(
      `SELECT l.task, l.status, l.message, l.errors, l.route,
              DATE_FORMAT(l.started_at, '%Y-%m-%d %H:%i:%s') AS started_at, l.duration_ms
         FROM sync_run_log l
         JOIN (SELECT task, MAX(id) AS id FROM sync_run_log GROUP BY task) m ON m.id = l.id
        ORDER BY l.task`
    ),
    query<DynamicRow>(
      `SELECT task, DATE_FORMAT(MAX(started_at), '%Y-%m-%d %H:%i:%s') AS last_success
         FROM sync_run_log WHERE status = 'success' GROUP BY task`
    ),
    query<DynamicRow>(
      `SELECT task, COUNT(*) AS c FROM sync_run_log
        WHERE status <> 'success' AND started_at >= NOW() - INTERVAL 7 DAY GROUP BY task`
    ),
  ]);
  const lastSuccess = new Map(successes.map((r) => [str(r.task), str(r.last_success)]));
  const failures7d = new Map(failures.map((r) => [str(r.task), Number(r.c)]));
  const latest = latestRows.map((r) => ({
    ...r,
    last_success: lastSuccess.get(str(r.task)) || null,
    failures_7d: failures7d.get(str(r.task)) ?? 0,
  }));
  return {
    httpStatus: 200,
    body: { status: 'success', from, to, rows, latest, tasks: latestRows.map((r) => str(r.task)), limit: LIST_LIMIT },
  };
};

/** 180日より古い行を消す（起動の5分後と、その後1日ごと） */
export const startSyncLogMaintenance = (): void => {
  const run = (): void => {
    execute(`DELETE FROM sync_run_log WHERE started_at < NOW() - INTERVAL ${KEEP_DAYS} DAY LIMIT 10000`)
      .then((r) => { if (r.affectedRows > 0) logger.info(`sync_log: ${KEEP_DAYS}日より古い実行結果 ${r.affectedRows} 件を消しました`); })
      .catch((error: unknown) => logger.error('sync_log: 古い実行結果の削除に失敗しました', error));
  };
  setTimeout(run, 5 * 60_000).unref();
  setInterval(run, 24 * 3600_000).unref();
};
