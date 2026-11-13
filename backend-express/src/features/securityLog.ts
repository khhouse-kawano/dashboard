import type { Request } from 'express';
import { isIP } from 'node:net';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/pool';
import type { SqlParam } from '../db/pool';
import { logger } from '../utils/logger';

/**
 * セキュリティログ（security_log）。v2.2.242 新規。
 *
 * ─────────────────────────────────────────────
 *   recordSecurityEvent … ② で起きた 401・403・ループ検知（502）・500・存在しないパス（404）・不正な request（400）を書く
 *   listSecurityLog     … security_log_list（⚠️ Master だけ）。画面: frontend/src/components/header/system/SecurityLog.tsx
 *
 *   表 : backend/scripts/sql/2026-11-04_security_log.sql
 *   ① 側の同じ処理 : backend/src/core/security_log.php（⚠️ まとめ方・列の長さを揃えること）
 *
 * ⚠️⚠️ **書くのに失敗しても本来の処理を止めない。** 待たずに投げ、失敗は logger にだけ残す。
 * ⚠️ message にパスワード・トークン・メールアドレス・お客様の情報を入れないこと。
 * ⚠️ 画面からの通信は ① を経由するので、② から見た接続元は ① になる。
 *   ⚠️ ① が付ける X-Client-IP は、X-Forwarded-By（xserver-php）が付いているときだけ接続元として使い、
 *     ⚠️ 直接の相手（req.ip。Caddy の後ろなので trust proxy で実際の相手）を via_ip に残す（名乗りは偽れるため）。
 * ─────────────────────────────────────────────
 */

export type SecurityEvent =
  | 'login' | 'login_failed' | 'logout'
  | 'auth_failed' | 'forbidden' | 'bad_request' | 'unknown_request'
  | 'server_error' | 'proxy_error';

/** まとめる種類（⚠️ ① の SECURITY_LOG_AGGREGATE と同じ） */
const AGGREGATE_EVENTS: ReadonlySet<SecurityEvent> = new Set(['auth_failed', 'forbidden', 'bad_request', 'unknown_request']);

/** 古い行を消す日数と、書くときに掃除する確率（⚠️ ① と同じ） */
const KEEP_DAYS = 180;
const CLEANUP_ONE_IN = 500;

/** 長さで切る（⚠️ 表の列の長さ。⚠️ 改行などの制御文字は空白に） */
const text = (value: unknown, max: number): string =>
  String(value ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, max);

/** IP の形をしているときだけ返す（⚠️ IPv4 を表す IPv6（::ffff:）は IPv4 に戻す） */
const ipOf = (value: unknown): string => {
  const raw = String(value ?? '').trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');
  return isIP(raw) === 0 ? '' : raw;
};

const pathOf = (referer: string): string => {
  if (referer === '') return '';
  try {
    return new URL(referer).pathname;
  } catch {
    return '';
  }
};

/** 接続元（上の注記）。⚠️ v2.2.266 から accessLog.ts でも使う */
export const clientOf =(req: Request): { ip: string; viaIp: string; userAgent: string; path: string } => {
  const direct = ipOf(req.ip);
  const fromPhp = (req.header('X-Forwarded-By') ?? '').includes('xserver-php');
  const claimed = fromPhp ? ipOf(req.header('X-Client-IP')) : '';
  const viaPhp = claimed !== '';
  return {
    ip: viaPhp ? claimed : direct,
    viaIp: viaPhp ? direct : '',
    userAgent: text(viaPhp ? req.header('X-Client-UA') : req.header('User-Agent'), 255),
    path: text(pathOf(String((viaPhp ? req.header('X-Client-Referer') : req.header('Referer')) ?? '')), 255),
  };
};

export interface SecurityEventInput {
  event: SecurityEvent;
  status?: number;
  request?: string;
  roll?: string;
  staff?: { id?: number | string | null; name?: string | null } | null;
  message?: string;
}

/**
 * 1件書く。⚠️ 待たない（呼び出し側は await しない）。⚠️ 失敗しても例外を投げない。
 */
export const recordSecurityEvent = (req: Request, input: SecurityEventInput): void => {
  void (async () => {
    try {
      const client = clientOf(req);
      const request = text(input.request, 100);
      const roll = text(input.roll, 100);
      const staffId = input.staff?.id === undefined || input.staff?.id === null ? null : Number(input.staff.id);
      // ⚠️ まとめる鍵（⚠️ 1分は DB の NOW() で区切る。① と同じ並び）
      const key = AGGREGATE_EVENTS.has(input.event)
        ? ['express', input.event, client.ip, request, roll, staffId === null ? '' : String(staffId)].join('|')
        : '';
      const params: SqlParam[] = [
        input.event, input.status ?? null, request, roll, staffId, text(input.staff?.name, 100),
        client.ip, client.viaIp, client.userAgent, client.path, text(input.message, 500), key, key,
      ];
      await execute(
        `INSERT INTO security_log
           (occurred_at, last_at, count, server, event, status, request, roll, staff_id, staff_name, ip, via_ip, user_agent, path, message, bucket)
         VALUES (NOW(), NOW(), 1, 'express', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 IF(? = '', NULL, SHA1(CONCAT(?, '|', DATE_FORMAT(NOW(), '%Y%m%d%H%i')))))
         ON DUPLICATE KEY UPDATE count = count + 1, last_at = NOW()`,
        params
      );
      if (Math.floor(Math.random() * CLEANUP_ONE_IN) === 0) await cleanup();
    } catch (error) {
      logger.error('security_log: 書き込みに失敗しました', error instanceof Error ? error.message : error);
    }
  })();
};

const cleanup = async (): Promise<void> => {
  await execute(`DELETE FROM security_log WHERE occurred_at < NOW() - INTERVAL ${KEEP_DAYS} DAY LIMIT 5000`);
};

// ---------------------------------------------------------------------------
// 一覧（security_log_list）
// ---------------------------------------------------------------------------

/**
 * 「要注意」の目印の基準（初期値。2026-11-04 に利用者が了承）。⚠️ 画面にもこの値を出す（thresholds）。
 *   ⚠️ 記録しているのは失敗・エラーだけ（正常なアクセスは残していない）。⚠️ なので回数は「失敗の回数」。
 */
const THRESHOLDS = {
  /** 同じ IP から1分の失敗（401・403・400・404）がこの回数以上 */
  failuresPerMinute: 30,
  /** 同じ IP から5分のログインの失敗がこの回数以上 */
  loginFailuresPer5Min: 5,
  /** 同じ IP から1時間の「存在しない request・パス」（400・404）がこの回数以上 */
  probesPerHour: 10,
};

/** ツールや自動操作の User-Agent（⚠️ 空も含める） */
const TOOL_AGENT = /curl|wget|python|httpclient|go-http|java\/|okhttp|axios\/|node-fetch|undici|headless|phantomjs|selenium|puppeteer|playwright|bot\b|crawl|spider|scan|zgrab|masscan|nmap|sqlmap|nikto/i;

/** 一度に返す行の上限（⚠️ 画面に出すのは新しい順にこの数まで） */
const MAX_ROWS = 2000;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EVENTS: ReadonlySet<string> = new Set([
  'login', 'login_failed', 'logout', 'auth_failed', 'forbidden', 'bad_request', 'unknown_request', 'server_error', 'proxy_error',
]);

interface LogRow extends RowDataPacket {
  id: number; occurred_at: string; last_at: string; count: number; server: string; event: string; status: number | null;
  request: string; roll: string; staff_id: number | null; staff_name: string; ip: string; via_ip: string;
  user_agent: string; path: string; message: string;
}
interface CountRow extends RowDataPacket { event: string; total: string | number }
interface IpRow extends RowDataPacket { ip: string; peak: string | number }
interface NumRow extends RowDataPacket { n: string | number }
interface AgentRow extends RowDataPacket { ip: string; user_agent: string }
interface RangeRow extends RowDataPacket { from_day: string; to_day: string }

/**
 * 一覧。⚠️ 期間（from・to。日付）は既定で直近7日。⚠️ 開いたときに古い行も消す。
 * 本文: from / to（YYYY-MM-DD）・event・ip・q（人・request・パス・メッセージの一部）
 */
export const listSecurityLog = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  await cleanup().catch((error) => logger.error('security_log: 古い行の削除に失敗しました', error));

  // ⚠️ 既定の期間は DB の日付で決める（⚠️ occurred_at は DB の NOW()。サーバーの時計と DB の時計がずれていても合う）
  const [today] = await query<RangeRow>(
    "SELECT DATE_FORMAT(CURDATE() - INTERVAL 6 DAY, '%Y-%m-%d') AS from_day, DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS to_day"
  );
  const from = DAY.test(String(body.from ?? '')) ? String(body.from) : today.from_day;
  const to = DAY.test(String(body.to ?? '')) ? String(body.to) : today.to_day;
  const event = EVENTS.has(String(body.event ?? '')) ? String(body.event) : '';
  const ip = text(body.ip, 45);
  const q = text(body.q, 100);

  // ⚠️ 期間は to の日の終わりまで（⚠️ 文字列で比べる。occurred_at は DATETIME）
  const range = ['occurred_at >= ?', 'occurred_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const rangeParams: SqlParam[] = [from, to];
  const where = [...range];
  const params: SqlParam[] = [...rangeParams];
  if (event !== '') { where.push('event = ?'); params.push(event); }
  if (ip !== '') { where.push('(ip = ? OR via_ip = ?)'); params.push(ip, ip); }
  if (q !== '') {
    where.push('(staff_name LIKE ? OR request LIKE ? OR path LIKE ? OR message LIKE ? OR user_agent LIKE ?)');
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like, like, like, like);
  }

  const rows = await query<LogRow>(
    `SELECT id, DATE_FORMAT(occurred_at, '%Y-%m-%d %H:%i:%s') AS occurred_at, DATE_FORMAT(last_at, '%Y-%m-%d %H:%i:%s') AS last_at,
            count, server, event, status, request, roll, staff_id, staff_name, ip, via_ip, user_agent, path, message
       FROM security_log WHERE ${where.join(' AND ')}
      ORDER BY occurred_at DESC, id DESC LIMIT ${MAX_ROWS + 1}`,
    params
  );
  const truncated = rows.length > MAX_ROWS;

  // ⚠️ KPI と目印は ⚠️ **期間だけ**で数える（⚠️ 種類・IP・キーワードの絞り込みに左右されない）
  const totals = await query<CountRow>(
    `SELECT event, SUM(count) AS total FROM security_log WHERE ${range.join(' AND ')} GROUP BY event`,
    rangeParams
  );
  const ipCount = await query<NumRow>(
    `SELECT COUNT(DISTINCT ip) AS n FROM security_log WHERE ${range.join(' AND ')} AND ip <> ''`,
    rangeParams
  );

  const flags: Record<string, string[]> = {};
  const flag = (target: string, reason: string): void => {
    if (target === '') return;
    (flags[target] ??= []).push(reason);
  };
  const failureBursts = await query<IpRow>(
    `SELECT ip, MAX(c) AS peak FROM (
        SELECT ip, DATE_FORMAT(occurred_at, '%Y%m%d%H%i') AS m, SUM(count) AS c FROM security_log
         WHERE ${range.join(' AND ')} AND event IN ('auth_failed', 'forbidden', 'bad_request', 'unknown_request') GROUP BY ip, m
      ) t GROUP BY ip HAVING MAX(c) >= ?`,
    [...rangeParams, THRESHOLDS.failuresPerMinute]
  );
  failureBursts.forEach((r) => flag(r.ip, `1分に失敗 ${Number(r.peak)} 回`));
  const loginBursts = await query<IpRow>(
    `SELECT ip, MAX(c) AS peak FROM (
        SELECT ip, FLOOR(UNIX_TIMESTAMP(occurred_at) / 300) AS w, SUM(count) AS c FROM security_log
         WHERE ${range.join(' AND ')} AND event = 'login_failed' GROUP BY ip, w
      ) t GROUP BY ip HAVING MAX(c) >= ?`,
    [...rangeParams, THRESHOLDS.loginFailuresPer5Min]
  );
  loginBursts.forEach((r) => flag(r.ip, `5分にログイン失敗 ${Number(r.peak)} 回`));
  const probes = await query<IpRow>(
    `SELECT ip, MAX(c) AS peak FROM (
        SELECT ip, DATE_FORMAT(occurred_at, '%Y%m%d%H') AS h, SUM(count) AS c FROM security_log
         WHERE ${range.join(' AND ')} AND event IN ('bad_request', 'unknown_request') GROUP BY ip, h
      ) t GROUP BY ip HAVING MAX(c) >= ?`,
    [...rangeParams, THRESHOLDS.probesPerHour]
  );
  probes.forEach((r) => flag(r.ip, `1時間に存在しない処理を ${Number(r.peak)} 回`));
  const agents = await query<AgentRow>(
    `SELECT DISTINCT ip, user_agent FROM security_log
      WHERE ${range.join(' AND ')} AND event NOT IN ('login', 'logout') LIMIT 5000`,
    rangeParams
  );
  agents.forEach((r) => {
    if (r.user_agent === '') flag(r.ip, 'User-Agent が空');
    else if (TOOL_AGENT.test(r.user_agent)) flag(r.ip, 'ツールの User-Agent');
  });

  const out = rows.slice(0, MAX_ROWS).map((r) => ({
    id: Number(r.id), occurredAt: r.occurred_at, lastAt: r.last_at, count: Number(r.count), server: r.server, event: r.event,
    status: r.status === null ? null : Number(r.status), request: r.request, roll: r.roll,
    staffId: r.staff_id === null ? null : Number(r.staff_id), staffName: r.staff_name,
    ip: r.ip, viaIp: r.via_ip, userAgent: r.user_agent, path: r.path, message: r.message,
  }));
  // ⚠️ 同じ理由が何度も入らないように
  Object.keys(flags).forEach((k) => { flags[k] = Array.from(new Set(flags[k])); });

  return {
    status: 'ok',
    from, to,
    totals: Object.fromEntries(totals.map((t) => [t.event, Number(t.total)])),
    ipCount: Number(ipCount[0]?.n ?? 0),
    flags,
    thresholds: THRESHOLDS,
    rows: out,
    truncated,
    maxRows: MAX_ROWS,
  };
};
