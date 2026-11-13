import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, type SqlParam } from '../db/pool';
import type { AuthenticatedStaff } from '../types/staff';
import { logger } from '../utils/logger';
import { clientOf } from './securityLog';

/**
 * 画面のアクセス記録（v2.2.266。表 staff_access_log）。
 *
 * ─────────────────────────────────────────────
 *   access_log:open   … 画面を移ったとき（ActiveUser.tsx）。1行足して id を返す
 *   heartbeat         … 20秒ごと（ActiveUser.tsx）。staff.heartbeat（オンラインの表示）と、その行の last_seen_at を更新する
 *   access_log_list   … 一覧（ヘッダーの「システム管理 → アクセス記録」。Master だけ）
 *
 * ⚠️⚠️ heartbeat は ① の heartbeat.php から移した。**staff.log（JSON の配列）への書き足しはやめた。**
 *   ⚠️ 以前は 20秒ごとに JSON 全体を読んで1件足して書き戻していた（ローカルの写しで1人最大 9.5MB・合計 272MB）。
 *   ⚠️ ① の heartbeat.php は ② が止まったときの予備として残してある（予備も staff.log には書かない）。
 * ⚠️ 担当者は、画面から送られた名前ではなく、トークンから決めた staff（ctx.staff）を使う。
 * ⚠️ path は ? と # から後ろを残さない（お客様の ID などが入ることがあるため）。
 * ⚠️ 日時は日本時間を ② で作って書く（⚠️ DB の NOW() は DB の時刻帯に左右される。ローカルの DB は UTC）。
 * ⚠️ 13か月より古い行は毎日消す（startAccessLogMaintenance）。
 * ⚠️ 記録に失敗しても画面は止めない（呼ぶ側の ActiveUser.tsx が失敗を無視する）。
 * ─────────────────────────────────────────────
 */

const KEEP_MONTHS = 13;
/** 一覧に返す行の上限（新しい順） */
const MAX_ROWS = 2000;
/** 同じ人が同じ画面をこの秒数の内にもう一度開いたら、同じ行とみなす（開発中の React の二重実行・素早い戻る進む） */
const SAME_OPEN_SECONDS = 3;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown, max: number): string =>
  String(value ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, max);

/** 日本時間の 'YYYY-MM-DD HH:MM:SS'（ms だけずらした時刻） */
const jst = (offsetMs = 0): string => new Date(Date.now() + offsetMs + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');

/** 画面の URL（/ で始まる。? と # から後ろは捨てる）。読めなければ null */
const pathOf = (value: unknown): string | null => {
  const path = text(String(value ?? '').split(/[?#]/)[0], 255);
  return path.startsWith('/') ? path : null;
};

interface IdRow extends RowDataPacket { id: number }

/** 画面を開いた（1行足す）。⚠️ 直前に同じ画面を開いた行があれば、その id を返す */
export const openAccess = async (
  staff: AuthenticatedStaff,
  body: Record<string, unknown>,
  req: Request
): Promise<{ httpStatus: number; body: Record<string, unknown> }> => {
  const path = pathOf(body.path);
  if (path === null) return { httpStatus: 400, body: { status: 'error', message: 'path は / で始まる画面の URL を送ってください' } };

  const now = jst();
  const [recent] = await query<IdRow>(
    'SELECT id FROM staff_access_log WHERE staff_id = ? AND path = ? AND opened_at >= ? ORDER BY id DESC LIMIT 1',
    [staff.id, path, jst(-SAME_OPEN_SECONDS * 1000)]
  );
  if (recent !== undefined) return { httpStatus: 200, body: { status: 'ok', id: recent.id } };

  const client = clientOf(req);
  const result = await execute(
    `INSERT INTO staff_access_log (staff_id, staff_name, authority, division, path, opened_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [staff.id, staff.name.slice(0, 100), staff.brand.slice(0, 32), staff.shop.slice(0, 16), path, now, client.ip, client.userAgent]
  );
  return { httpStatus: 200, body: { status: 'ok', id: result.insertId } };
};

/**
 * 20秒ごと。staff.heartbeat を更新し、access_id があればその行の last_seen_at も更新する。
 * ⚠️ 他の人の行は更新しない（staff_id も条件に入れる）。
 */
export const heartbeat = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const now = jst();
  await execute('UPDATE staff SET heartbeat = ? WHERE id = ?', [now, staff.id]);
  const accessId = Number(body.access_id);
  if (Number.isSafeInteger(accessId) && accessId > 0) {
    await execute('UPDATE staff_access_log SET last_seen_at = ? WHERE id = ? AND staff_id = ?', [now, accessId, staff.id]);
  }
  return { status: 'ok' };
};

interface LogRow extends RowDataPacket {
  id: number;
  staffId: number;
  staffName: string;
  authority: string;
  division: string;
  path: string;
  openedAt: string;
  lastSeenAt: string | null;
  seconds: number | null;
  ip: string;
  userAgent: string;
}
interface PathRow extends RowDataPacket { path: string; views: number; staffCount: number; avgSeconds: number | null; lastAt: string }
interface StaffRow extends RowDataPacket { staffId: number; staffName: string; views: number; screens: number; lastAt: string }
interface NumRow extends RowDataPacket { views: number; staffCount: number; screens: number }
interface NameRow extends RowDataPacket { staffName: string }

/**
 * 一覧（Master だけ）。
 * 本文: from / to（YYYY-MM-DD。既定は直近7日）・staff（担当者の名前。完全一致）・path（画面の URL。完全一致）・q（名前・URL・IP の一部）
 * ⚠️ 行は新しい順に MAX_ROWS まで。⚠️ 集計（KPI・画面ごと・担当者ごと）は絞り込み後の全件で数える。
 */
export const listAccessLog = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const today = jst().slice(0, 10);
  const weekAgo = jst(-6 * 24 * 3600_000).slice(0, 10);
  const from = DAY.test(String(body.from ?? '')) ? String(body.from) : weekAgo;
  const to = DAY.test(String(body.to ?? '')) ? String(body.to) : today;
  const staffName = text(body.staff, 100);
  const path = text(body.path, 255);
  const q = text(body.q, 100);

  const where = ['opened_at >= ?', 'opened_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params: SqlParam[] = [from, to];
  if (staffName !== '') { where.push('staff_name = ?'); params.push(staffName); }
  if (path !== '') { where.push('path = ?'); params.push(path); }
  if (q !== '') {
    where.push('(staff_name LIKE ? OR path LIKE ? OR ip LIKE ?)');
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like, like);
  }
  const cond = where.join(' AND ');

  const [rows, totals, byPath, byStaff, names] = await Promise.all([
    query<LogRow>(
      `SELECT id, staff_id AS staffId, staff_name AS staffName, authority, division, path,
              DATE_FORMAT(opened_at, '%Y-%m-%d %H:%i:%s') AS openedAt,
              DATE_FORMAT(last_seen_at, '%Y-%m-%d %H:%i:%s') AS lastSeenAt,
              TIMESTAMPDIFF(SECOND, opened_at, last_seen_at) AS seconds, ip, user_agent AS userAgent
         FROM staff_access_log WHERE ${cond}
        ORDER BY opened_at DESC, id DESC LIMIT ${MAX_ROWS + 1}`,
      params
    ),
    query<NumRow>(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT staff_id) AS staffCount, COUNT(DISTINCT path) AS screens
         FROM staff_access_log WHERE ${cond}`,
      params
    ),
    query<PathRow>(
      `SELECT path, COUNT(*) AS views, COUNT(DISTINCT staff_id) AS staffCount,
              ROUND(AVG(TIMESTAMPDIFF(SECOND, opened_at, last_seen_at))) AS avgSeconds,
              DATE_FORMAT(MAX(opened_at), '%Y-%m-%d %H:%i') AS lastAt
         FROM staff_access_log WHERE ${cond} GROUP BY path ORDER BY views DESC, path`,
      params
    ),
    query<StaffRow>(
      `SELECT staff_id AS staffId, MAX(staff_name) AS staffName, COUNT(*) AS views, COUNT(DISTINCT path) AS screens,
              DATE_FORMAT(MAX(opened_at), '%Y-%m-%d %H:%i') AS lastAt
         FROM staff_access_log WHERE ${cond} GROUP BY staff_id ORDER BY views DESC, staffName`,
      params
    ),
    // 担当者の選択肢（⚠️ 期間だけで出す。担当者で絞っても選択肢が1人にならないように）
    query<NameRow>(
      `SELECT DISTINCT staff_name AS staffName FROM staff_access_log
        WHERE opened_at >= ? AND opened_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY staff_name`,
      [from, to]
    ),
  ]);

  const num = (v: unknown): number => Number(v ?? 0);
  return {
    status: 'ok',
    from,
    to,
    totals: { views: num(totals[0]?.views), staffCount: num(totals[0]?.staffCount), screens: num(totals[0]?.screens) },
    byPath: byPath.map((r) => ({ ...r, views: num(r.views), staffCount: num(r.staffCount), avgSeconds: r.avgSeconds === null ? null : num(r.avgSeconds) })),
    byStaff: byStaff.map((r) => ({ ...r, views: num(r.views), screens: num(r.screens) })),
    staffNames: names.map((r) => r.staffName),
    rows: rows.slice(0, MAX_ROWS).map((r) => ({ ...r, seconds: r.seconds === null ? null : num(r.seconds) })),
    truncated: rows.length > MAX_ROWS,
    maxRows: MAX_ROWS,
    keepMonths: KEEP_MONTHS,
  };
};

/** 13か月より古い行を消す（起動の5分後と、その後1日ごと。⚠️ 一度に消すのは5万行まで） */
export const startAccessLogMaintenance = (): void => {
  const run = (): void => {
    const limit = new Date(Date.now() + 9 * 3600_000);
    limit.setUTCMonth(limit.getUTCMonth() - KEEP_MONTHS);
    const border = limit.toISOString().slice(0, 19).replace('T', ' ');
    execute('DELETE FROM staff_access_log WHERE opened_at < ? LIMIT 50000', [border])
      .then((r) => { if (r.affectedRows > 0) logger.info(`access_log: ${KEEP_MONTHS}か月より古い記録 ${r.affectedRows} 件を消しました`); })
      .catch((error: unknown) => logger.error('access_log: 古い記録の削除に失敗しました', error));
  };
  setTimeout(run, 5 * 60_000).unref();
  setInterval(run, 24 * 3600_000).unref();
};
