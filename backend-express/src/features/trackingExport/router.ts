import { createHash, timingSafeEqual } from 'node:crypto';
import { type Request, type Response, Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { query, type SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';
import { type AnalysisDivision, type AnalysisPhase, phaseDateOf } from '../analysis/columns';
import { parseLandingParams, UUID_PATTERN } from '../tracking/params';

/**
 * 広告運用の担当者向けの読み出し API（v2.2.265）。⚠️ 読むだけ。
 *
 *   GET /api/export/tracking/touches    … tracking_touches（着地 1回 = 1行。広告のパラメータが無い訪問も入る）
 *   GET /api/export/tracking/customers  … 顧客（v2.2.266。注文 master_data・建売 master_data_kaeru の landing_params がある顧客）
 *   ⚠️ v2.2.266 で conversions（tracking_conversions）はやめた（利用者の指示）。
 *
 * ⚠️ customers は個人情報（氏名・電話・メール・住所など）を返さない。返す列は CUSTOMER_PHASES と customerColumns() だけ。
 * ⚠️ customers の工程の日付は analysis/columns.ts の PHASE_COLUMNS（分析 API・推移画面と同じ定義）を使う。
 *   ⚠️ 同じ列が事業で意味が違う（01J82Z5F1RR18… は 注文＝契約日／建売＝申込日）。列名を直書きしないこと。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **鍵はヘッダー `Authorization: Bearer <鍵>` だけで受ける。URL（?key=）では受けない。**
 *   ⚠️ URL は Caddy・② のアクセスログ、ブラウザの履歴、社内のプロキシに残る。ヘッダーは Caddy がログから消す（docker/caddy/Caddyfile）。
 * ⚠️ 鍵は ② VPS の .env.prod の TRACKING_EXPORT_KEYS（カンマ区切りで複数。人・ツールごとに分ける／入れ替えのときは新旧を両方入れる）。
 *   ⚠️ 32文字より短い鍵は使わない（起動時に警告を出して捨てる）。⚠️ 1つも無ければ全部 401（開きっぱなしにしない）。
 * ⚠️ ① のゲートウェイは通さない（GET の口のため）。express_proxy.php の許可リストには入れない。
 * ⚠️ app.ts で全体の CORS より前に置く。ブラウザから呼ばせない（ACAO を付けない）。サーバー・スクリプトから使う前提。
 * ⚠️ 期間・件数の上限は設けない（利用者の指示）。⚠️ limit を省くと 1000 件。続きは after_id で取る。
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

type Kind = 'touches' | 'customers';

/** 顧客の事業。⚠️ 返事の category にもこの値を入れる */
type CustomerCategory = 'order' | 'spec';

type Filters = {
  from: string | null;
  to: string | null;
  siteId: number | null;
  brand: string | null;
  category: CustomerCategory | null;
  afterId: number;
  limit: number;
};

const ALLOWED_PARAMS: Record<Kind, ReadonlySet<string>> = {
  touches: new Set(['from', 'to', 'site_id', 'brand', 'after_id', 'limit']),
  customers: new Set(['category', 'from', 'to', 'after_id', 'limit']),
};

/**
 * 顧客の表。⚠️ SQL に直接埋め込むので、この定数以外の値を入れないこと。
 * ⚠️ 表ごとに no（行の番号）が別に振られているので、after_id で続きを取るため category を必須にする。
 */
const CUSTOMER_TABLES: Record<CustomerCategory, { table: string; division: AnalysisDivision }> = {
  order: { table: 'master_data', division: 'order' },
  spec: { table: 'master_data_kaeru', division: 'kaeru' },
};

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

/**
 * 顧客の from・to（反響取得日）。⚠️ 日付だけ（時刻なし）を受ける → 'YYYY-MM-DD'。
 * ⚠️ 反響取得日は日付だけの列なので、時刻を受けると「その日の途中から」が意味を持たない。
 */
const parseDay = (name: string, raw: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequest(`${name} は YYYY-MM-DD で指定してください（顧客は反響取得日で絞ります）`);
  return parseJst(name, raw).slice(0, 10);
};

/** URL のパラメータを読む。⚠️ 知らない名前・同じ名前の重複は 400（書き間違いに気づけるように） */
const parseFilters = (req: Request, kind: Kind): Filters => {
  const allowed = ALLOWED_PARAMS[kind];
  const q = req.query as Record<string, unknown>;
  for (const [name, value] of Object.entries(q)) {
    if (!allowed.has(name)) throw new BadRequest(`知らないパラメータです: ${name}（使えるのは ${[...allowed].join('・')}）`);
    if (typeof value !== 'string') throw new BadRequest(`${name} は1つだけ指定してください`);
  }
  const get = (name: string): string | null => {
    const v = q[name];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  };
  const parseWhen = kind === 'customers' ? parseDay : parseJst;
  const fromRaw = get('from');
  const toRaw = get('to');
  const from = fromRaw === null ? null : parseWhen('from', fromRaw);
  const to = toRaw === null ? null : parseWhen('to', toRaw);
  if (from !== null && to !== null && from >= to) throw new BadRequest('to は from より後にしてください（from 以上、to 未満）');
  const siteRaw = get('site_id');
  const brand = get('brand');
  if (brand !== null && !/^[A-Za-z0-9_-]{1,32}$/.test(brand)) throw new BadRequest('brand は英数字で指定してください（kh・djh など）');
  const categoryRaw = get('category');
  if (kind === 'customers' && categoryRaw !== 'order' && categoryRaw !== 'spec') {
    throw new BadRequest('category は order（注文）か spec（建売）で指定してください（必須）');
  }
  const afterRaw = get('after_id');
  const limitRaw = get('limit');
  return {
    from,
    to,
    siteId: siteRaw === null ? null : parseInteger('site_id', siteRaw, 1),
    brand,
    category: categoryRaw === 'order' || categoryRaw === 'spec' ? categoryRaw : null,
    afterId: afterRaw === null ? 0 : parseInteger('after_id', afterRaw, 0),
    limit: limitRaw === null ? DEFAULT_LIMIT : parseInteger('limit', limitRaw, 1),
  };
};

/** 日本時間の DATETIME → ISO 8601（+09:00 付き）。NULL はそのまま */
const isoJst = (column: string): string => `DATE_FORMAT(${column}, '%Y-%m-%dT%H:%i:%s+09:00')`;

const TOUCH_COLUMNS = `t.id, ${isoJst('t.created_at')} AS created_at, t.site_id, s.name AS site_name, s.brand,
  t.visitor_id, t.source, t.gclid, t.gbraid, t.wbraid, t.fbclid, t.yclid, t.gad_source, t.gad_campaignid,
  t.utm_source, t.utm_medium, t.utm_campaign, t.utm_term, t.utm_content, t.flyer, t.landing_url, t.referrer, t.user_agent`;

/** limit + 1 件読んだ結果 → 1ページぶんと、続きがあるか（has_more） */
const toPage = <T>(rows: T[], limit: number): { rows: T[]; hasMore: boolean } => {
  const hasMore = rows.length > limit;
  return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
};

/**
 * 着地を1ページぶん読む。⚠️ id の小さい順。limit + 1 件読んで、続きがあるか（has_more）を決める。
 * ⚠️ LIMIT は検査済みの整数をそのまま埋める（mysql2 の execute は LIMIT ? を受けないことがあるため）。
 */
const readTouches = async (f: Filters): Promise<{ rows: ExportRow[]; hasMore: boolean }> => {
  const where: string[] = ['t.id > ?'];
  const params: SqlParam[] = [f.afterId];
  if (f.from !== null) { where.push('t.created_at >= ?'); params.push(f.from); }
  if (f.to !== null) { where.push('t.created_at < ?'); params.push(f.to); }
  if (f.siteId !== null) { where.push('t.site_id = ?'); params.push(f.siteId); }
  if (f.brand !== null) { where.push('s.brand = ?'); params.push(f.brand); }
  const rows = await query<ExportRow>(
    `SELECT ${TOUCH_COLUMNS}
       FROM tracking_touches t
       LEFT JOIN tracking_sites s ON s.id = t.site_id
      WHERE ${where.join(' AND ')}
      ORDER BY t.id
      LIMIT ${f.limit + 1}`,
    params
  );
  return toPage(rows, f.limit);
};

/**
 * 顧客で返す工程の日付（返事の項目名 → 工程）。⚠️ 列は analysis/columns.ts の PHASE_COLUMNS で事業ごとに決まる。
 *   ⚠️ 建売の来場＝面談＋物件案内、契約＝自社契約＋仲介契約の、いちばん古い日。
 *   ⚠️ application_date（申込）は建売だけ。注文は常に null。
 */
const CUSTOMER_PHASES: ReadonlyArray<[string, AnalysisPhase]> = [
  ['inquiry_date', 'reaction'],
  ['visit_date', 'visit'],
  ['next_appointment_date', 'nextAppointment'],
  ['application_date', 'application'],
  ['contract_date', 'contract'],
];

/**
 * 顧客の列。⚠️ 個人情報（氏名・電話・メール・住所など）は入れないこと。
 * ⚠️ id は表の no（続きを取る番号）、customer_id は顧客DB の顧客ID（顧客情報の画面と同じ）。
 * ⚠️ 空文字は null にそろえる。⚠️ 日付は 'YYYY-MM-DD'（列は文字列で `/` と `-` が混ざるので phaseDateOf で読む）。
 */
const customerColumns = (category: CustomerCategory): string => {
  const { division } = CUSTOMER_TABLES[category];
  const phases = CUSTOMER_PHASES.map(([name, phase]) => `DATE_FORMAT(${phaseDateOf(division, phase)}, '%Y-%m-%d') AS ${name}`);
  return [
    'm.no AS id',
    'm.id AS customer_id',
    `'${category}' AS category`,
    "NULLIF(TRIM(m.in_charge_store), '') AS store",
    "NULLIF(TRIM(m.status), '') AS status",
    "NULLIF(TRIM(m.sales_promotion_name), '') AS promotion_medium",
    ...phases,
    'm.landing_params',
  ].join(',\n  ');
};

/** 顧客の1行（返事） */
type CustomerRow = ExportRow & { landing_params: string };

/**
 * 顧客を1ページぶん読む。⚠️ landing_params が空でない顧客だけ。
 * ⚠️ 名寄せで隠した顧客（show_dashboard = 0）と、個人情報削除で削除済みの顧客（delete_dashboard = 1）は返さない（推移画面・顧客DB と同じ）。
 * ⚠️ status＝重複 は返す（使う側が status で除く）。⚠️ from・to は反響取得日（読めない顧客は、指定したときは返らない）。
 */
const readCustomers = async (f: Filters, category: CustomerCategory): Promise<{ rows: ExportRow[]; hasMore: boolean }> => {
  const { table, division } = CUSTOMER_TABLES[category];
  const inquiry = phaseDateOf(division, 'reaction');
  const where: string[] = [
    'm.no > ?',
    "TRIM(COALESCE(m.landing_params, '')) <> ''",
    'm.show_dashboard = 1',
    'COALESCE(m.delete_dashboard, 0) = 0',
  ];
  const params: SqlParam[] = [f.afterId];
  if (f.from !== null) { where.push(`${inquiry} >= ?`); params.push(f.from); }
  if (f.to !== null) { where.push(`${inquiry} < ?`); params.push(f.to); }
  const rows = await query<CustomerRow>(
    `SELECT ${customerColumns(category)}
       FROM ${table} m
      WHERE ${where.join(' AND ')}
      ORDER BY m.no
      LIMIT ${f.limit + 1}`,
    params
  );
  // ⚠️ landing_params の khg_vid（ビジターID）を visitor_id として出す（touches の visitor_id と同じ小文字の UUID。形が違えば null）
  const withVisitor = rows.map(({ landing_params: landingParams, ...rest }) => {
    const vid = (parseLandingParams(landingParams).khg_vid ?? '').trim().toLowerCase();
    return { ...rest, visitor_id: UUID_PATTERN.test(vid) ? vid : null, landing_params: landingParams } as ExportRow;
  });
  return toPage(withVisitor, f.limit);
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
      const filters = parseFilters(req, kind);
      const { rows, hasMore } = kind === 'customers' && filters.category !== null
        ? await readCustomers(filters, filters.category)
        : await readTouches(filters);
      const nextAfterId = rows.length > 0 ? rows[rows.length - 1].id : filters.afterId;
      logger.info(
        `tracking export: ${kind} key=${label} ip=${req.ip ?? ''} category=${filters.category ?? '-'} from=${filters.from ?? '-'} to=${filters.to ?? '-'} site_id=${filters.siteId ?? '-'} brand=${filters.brand ?? '-'} after_id=${filters.afterId} limit=${filters.limit} rows=${rows.length} ${Date.now() - startedAt}ms`
      );
      res.json({ data: rows, count: rows.length, next_after_id: nextAfterId, has_more: hasMore });
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
  router.get(`${PATH_PREFIX}/customers`, exportLimiter, handle('customers'));
  return router;
};
