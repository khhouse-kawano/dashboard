import { createHash, timingSafeEqual } from 'node:crypto';
import { type Request, type Response, Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { query, type SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';

/**
 * 広告運用の担当者向けの読み出し API（v2.2.265）。⚠️ 読むだけ。
 *
 *   GET /api/export/tracking/touches      … tracking_touches（パラメータ付きの着地 1回 = 1行）
 *   GET /api/export/tracking/conversions  … tracking_conversions（自社のフォームでないサイトの CV）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **鍵はヘッダー `Authorization: Bearer <鍵>` だけで受ける。URL（?key=）では受けない。**
 *   ⚠️ URL は Caddy・② のアクセスログ、ブラウザの履歴、社内のプロキシに残る。ヘッダーは Caddy がログから消す（docker/caddy/Caddyfile）。
 * ⚠️ 鍵は ② VPS の .env.prod の TRACKING_EXPORT_KEYS（カンマ区切りで複数。人・ツールごとに分ける／入れ替えのときは新旧を両方入れる）。
 *   ⚠️ 32文字より短い鍵は使わない（起動時に警告を出して捨てる）。⚠️ 1つも無ければ全部 401（開きっぱなしにしない）。
 * ⚠️ ① のゲートウェイは通さない（GET の口のため）。express_proxy.php の許可リストには入れない。
 * ⚠️ app.ts で全体の CORS より前に置く。ブラウザから呼ばせない（ACAO を付けない）。サーバー・スクリプトから使う前提。
 * ⚠️ 期間・件数の上限は設けない（利用者の指示）。⚠️ limit を省くと 1000 件。続きは after_id で取る。
 * ⚠️ email_hash・tel_hash（メール・電話の SHA-256）も返す（利用者の指示。広告の拡張コンバージョン用）。
 *   ⚠️ 電話の SHA-256 は総当たりで元に戻せる。実質の個人情報として扱うよう、仕様書（docs/api-tracking-export.md）に書いてある。
 * ─────────────────────────────────────────────
 */

const PATH_PREFIX = '/api/export/tracking';
const MIN_KEY_LENGTH = 32;
const DEFAULT_LIMIT = 1000;

/** 返事の1行 */
type ExportRow = RowDataPacket & { id: number };

/** 使える鍵（短いものは捨てる）。⚠️ 起動時に1回だけ決める */
const loadKeys = (): Buffer[] => {
  const all = env.trackingExportKeys;
  const usable = all.filter((key) => key.length >= MIN_KEY_LENGTH);
  if (usable.length !== all.length) {
    logger.warn(`tracking export: ${MIN_KEY_LENGTH}文字より短い鍵を ${all.length - usable.length}個 使いません（TRACKING_EXPORT_KEYS）`);
  }
  if (usable.length === 0) {
    logger.warn('tracking export: TRACKING_EXPORT_KEYS が無いので、すべて 401 にします');
  }
  return usable.map((key) => Buffer.from(key));
};

/** ログに残す鍵の目印（鍵そのものは残さない） */
const keyLabel = (key: Buffer): string => createHash('sha256').update(key).digest('hex').slice(0, 8);

/** 合っていれば、どの鍵かの目印。⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる */
const matchKey = (keys: Buffer[], header: string | undefined): string | null => {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  if (!m) return null;
  const input = Buffer.from(m[1]);
  let found: Buffer | null = null;
  for (const key of keys) {
    if (input.length === key.length && timingSafeEqual(input, key)) found = key;
  }
  return found === null ? null : keyLabel(found);
};

/** 同じ IP から1分に60回まで（鍵の総当たりを遅らせる。⚠️ 鍵が違うものも数える） */
const exportLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`tracking export: 回数の上限 ip=${req.ip ?? ''}`);
    res.status(429).json({ error: 'too_many_requests', message: '1分に60回までです。少し待ってから送ってください。' });
  },
});

class BadRequest extends Error {}

type Filters = { from: string | null; to: string | null; siteId: number | null; brand: string | null; afterId: number; limit: number };

const ALLOWED_PARAMS = new Set(['from', 'to', 'site_id', 'brand', 'after_id', 'limit']);

/** 'YYYY-MM-DD' か 'YYYY-MM-DDTHH:MM(:SS)'（T の代わりに空白も可）→ 'YYYY-MM-DD HH:MM:SS'（日本時間） */
const parseJst = (name: string, raw: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
  if (!m) throw new BadRequest(`${name} は YYYY-MM-DD か YYYY-MM-DDTHH:MM:SS（日本時間）で指定してください`);
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)
    || Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) {
    throw new BadRequest(`${name} の日付・時刻がありません（${raw}）`);
  }
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
};

/** 0 以上の整数（15桁まで） */
const parseInteger = (name: string, raw: string, min: number): number => {
  if (!/^\d{1,15}$/.test(raw) || Number(raw) < min) throw new BadRequest(`${name} は ${min} 以上の整数で指定してください`);
  return Number(raw);
};

/** URL のパラメータを読む。⚠️ 知らない名前・同じ名前の重複は 400（書き間違いに気づけるように） */
const parseFilters = (req: Request): Filters => {
  const q = req.query as Record<string, unknown>;
  for (const [name, value] of Object.entries(q)) {
    if (!ALLOWED_PARAMS.has(name)) throw new BadRequest(`知らないパラメータです: ${name}（使えるのは ${[...ALLOWED_PARAMS].join('・')}）`);
    if (typeof value !== 'string') throw new BadRequest(`${name} は1つだけ指定してください`);
  }
  const get = (name: string): string | null => {
    const v = q[name];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  };
  const fromRaw = get('from');
  const toRaw = get('to');
  const from = fromRaw === null ? null : parseJst('from', fromRaw);
  const to = toRaw === null ? null : parseJst('to', toRaw);
  if (from !== null && to !== null && from >= to) throw new BadRequest('to は from より後にしてください（from 以上、to 未満）');
  const siteRaw = get('site_id');
  const brand = get('brand');
  if (brand !== null && !/^[A-Za-z0-9_-]{1,32}$/.test(brand)) throw new BadRequest('brand は英数字で指定してください（kh・djh など）');
  const afterRaw = get('after_id');
  const limitRaw = get('limit');
  return {
    from,
    to,
    siteId: siteRaw === null ? null : parseInteger('site_id', siteRaw, 1),
    brand,
    afterId: afterRaw === null ? 0 : parseInteger('after_id', afterRaw, 0),
    limit: limitRaw === null ? DEFAULT_LIMIT : parseInteger('limit', limitRaw, 1),
  };
};

/** 日本時間の DATETIME → ISO 8601（+09:00 付き）。NULL はそのまま */
const isoJst = (column: string): string => `DATE_FORMAT(${column}, '%Y-%m-%dT%H:%i:%s+09:00')`;

const TOUCH_COLUMNS = `t.id, ${isoJst('t.created_at')} AS created_at, t.site_id, s.name AS site_name, s.brand,
  t.visitor_id, t.source, t.gclid, t.gbraid, t.wbraid, t.fbclid, t.yclid, t.gad_source, t.gad_campaignid,
  t.utm_source, t.utm_medium, t.utm_campaign, t.utm_term, t.utm_content, t.flyer, t.landing_url, t.referrer, t.user_agent`;

/** ⚠️ email_hash・tel_hash は、無いとき空文字で入っているので null にそろえる */
const CONVERSION_COLUMNS = `t.id, ${isoJst('t.created_at')} AS created_at, t.site_id, s.name AS site_name, s.brand,
  t.visitor_id, t.form, NULLIF(t.email_hash, '') AS email_hash, NULLIF(t.tel_hash, '') AS tel_hash,
  t.landing_params, t.page_url, (t.matched_at IS NOT NULL) AS matched, ${isoJst('t.matched_at')} AS matched_at, t.matched_inquiry_id`;

const SOURCES = {
  touches: { table: 'tracking_touches', columns: TOUCH_COLUMNS },
  conversions: { table: 'tracking_conversions', columns: CONVERSION_COLUMNS },
} as const;

type Kind = keyof typeof SOURCES;

/**
 * 1ページぶん読む。⚠️ id の小さい順。limit + 1 件読んで、続きがあるか（has_more）を決める。
 * ⚠️ LIMIT は検査済みの整数をそのまま埋める（mysql2 の execute は LIMIT ? を受けないことがあるため）。
 */
const readPage = async (kind: Kind, f: Filters): Promise<{ rows: ExportRow[]; hasMore: boolean }> => {
  const { table, columns } = SOURCES[kind];
  const where: string[] = ['t.id > ?'];
  const params: SqlParam[] = [f.afterId];
  if (f.from !== null) { where.push('t.created_at >= ?'); params.push(f.from); }
  if (f.to !== null) { where.push('t.created_at < ?'); params.push(f.to); }
  if (f.siteId !== null) { where.push('t.site_id = ?'); params.push(f.siteId); }
  if (f.brand !== null) { where.push('s.brand = ?'); params.push(f.brand); }
  const rows = await query<ExportRow>(
    `SELECT ${columns}
       FROM ${table} t
       LEFT JOIN tracking_sites s ON s.id = t.site_id
      WHERE ${where.join(' AND ')}
      ORDER BY t.id
      LIMIT ${f.limit + 1}`,
    params
  );
  const hasMore = rows.length > f.limit;
  return { rows: hasMore ? rows.slice(0, f.limit) : rows, hasMore };
};

export const createTrackingExportRouter = (): Router => {
  const router = Router();
  const keys = loadKeys();

  const handle = (kind: Kind) => async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const label = matchKey(keys, req.get('authorization'));
    if (label === null) {
      logger.warn(`tracking export: 鍵が違う・無い ${kind} ip=${req.ip ?? ''}`);
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'unauthorized', message: '鍵が違うか、ありません（Authorization: Bearer <鍵>）' });
      return;
    }
    const startedAt = Date.now();
    try {
      const filters = parseFilters(req);
      const { rows, hasMore } = await readPage(kind, filters);
      const data = kind === 'conversions' ? rows.map((r) => ({ ...r, matched: Number(r.matched) === 1 })) : rows;
      const nextAfterId = rows.length > 0 ? rows[rows.length - 1].id : filters.afterId;
      logger.info(
        `tracking export: ${kind} key=${label} ip=${req.ip ?? ''} from=${filters.from ?? '-'} to=${filters.to ?? '-'} site_id=${filters.siteId ?? '-'} brand=${filters.brand ?? '-'} after_id=${filters.afterId} limit=${filters.limit} rows=${rows.length} ${Date.now() - startedAt}ms`
      );
      res.json({ data, count: rows.length, next_after_id: nextAfterId, has_more: hasMore });
    } catch (error) {
      if (error instanceof BadRequest) {
        res.status(400).json({ error: 'bad_request', message: error.message });
        return;
      }
      logger.error(`tracking export: ${kind} の読み出しに失敗: ${(error as Error).message}`);
      res.status(500).json({ error: 'internal_error', message: '読み出しに失敗しました。時間をおいてもう一度送ってください。' });
    }
  };

  router.get(`${PATH_PREFIX}/touches`, exportLimiter, handle('touches'));
  router.get(`${PATH_PREFIX}/conversions`, exportLimiter, handle('conversions'));
  return router;
};
