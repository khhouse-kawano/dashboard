# v2.2.265 広告運用の担当者向けの読み出し API（tracking_touches・tracking_conversions）

日付：2026-11-13　ブランチ：v2.2.265

## 依頼
- 社内の広告運用エンジニア向けに、`tracking_touches`・`tracking_conversions` のデータを GET で渡す API を作る。安全な設計（秘密の合い言葉）と GET の仕様を提案し、新しいブランチで行う。
- 利用者の決定：
  1. メール・電話の SHA-256（`email_hash`・`tel_hash`）も**渡す**
  2. IP では**絞らない**。鍵（トークン）で認証
  3. **JSON のみ**
  4. 期間・件数の**上限は設定しない**

## 設計
- 入口：`GET https://api.khg-marketing.info/api/export/tracking/touches`・`/conversions`（② に直接。① のゲートウェイは通さない → `express_proxy.php` は変えない）
- 鍵：`Authorization: Bearer <鍵>` のヘッダーだけで受ける（URL では受けない。Caddy は Authorization をログから消すが、URL は残すため）
  - ② VPS の `.env.prod` の `TRACKING_EXPORT_KEYS`（カンマ区切りで複数。32文字未満は使わない。無ければ全部 401）
  - `timingSafeEqual` で比べる。ログには鍵の SHA-256 の先頭8文字（目印）だけを残す
- 同じ IP から1分に60回まで（総当たり対策。利用者の 4 は期間・件数の上限のことなので、回数の上限は残した）
- CORS：全体の CORS より前に置き、ACAO を付けない（ブラウザから読ませない）
- `Cache-Control: no-store`
- パラメータ：`from`・`to`（日本時間。以上・未満）・`site_id`・`brand`・`after_id`・`limit`（既定 1000、上限なし）。知らない名前・重複は 400
- 返事：`{ data, count, next_after_id, has_more }`。id の小さい順。日時は `+09:00` 付き
- 返さない列：`tracking_touches.ip_hash`
- エンジニア向けの仕様書：**`docs/api-tracking-export.md`**（鍵の扱い・パラメータ・項目・例・管理者向けの鍵の発行と止め方）

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/trackingExport/ | **router.ts（新規）** | `createTrackingExportRouter`・`loadKeys`・`keyLabel`・`matchKey`・`exportLimiter`・`parseJst`・`parseInteger`・`parseFilters`・`isoJst`・`readPage` |
| backend-express/src/ | app.ts | 1-3 として `createTrackingExportRouter()` を CORS の前に |
| backend-express/src/config/ | env.ts | `trackingExportKeys` |
| / | docker-compose.prod.yml | `TRACKING_EXPORT_KEYS=${TRACKING_EXPORT_KEYS:-}` |
| / | docker-compose.yml | 開発用のダミーの鍵2つ |
| frontend/src/utils/ | version.ts | 2.2.265 |
| backend/scripts/sql/ | **2026-11-13_update_log_2.2.265.sql（新規）** | 更新履歴（ローカル no=364） |
| docs/ | **api-tracking-export.md（新規）**・deploy-v2.2.265.md（新規） | 仕様書・手順書 |
| docs/ → docs/oldDocument/ | 11/10・11/11 の作業記録と手順書 | 2日たったので移した（参照している realty-handoff.md・companyAggregate.ts のコメントも直した） |

- DB・① の PHP・画面は変えていない。業務ガイドの記事は無し（画面が無いため）。

## テスト（ローカルの ② に直接。`scratchpad/c265/api.cjs`・`limit.cjs`）
- ⚠️ CLAUDE.md の「① 経由で 401」は、この API が ① を通らない作りのため当てはまらない。代わりに ② に直接送って確かめた。画面の変更が無いので Playwright も無し。
- api.cjs：**38項目 OK**
  - 認証：鍵なし・違う鍵・短い鍵・URL の `?key=`・Bearer なし → 401（`WWW-Authenticate: Bearer`）。鍵1・鍵2 → 200
  - `Cache-Control: no-store`、ACAO を付けない（許可されたオリジンからでも）
  - 既定 1000件・has_more・id の順・next_after_id・after_id の続きが DB と同じ
  - 列（touches に ip_hash が無い、conversions の14列）、`+09:00`、値が DB と同じ
  - from/to・site_id・brand の件数が DB と同じ、大きな limit も可
  - 400：日付の形・無い日付・to ≦ from・limit=0・limit が数でない・after_id が負・site_id が数でない・brand に記号・知らないパラメータ・同じ名前を2つ
  - conversions：件数・matched（true/false と数）・email_hash の空は null
  - POST・DELETE → 404
- limit.cjs：違う鍵 62回 → 401 が60回・429 が2回、上限の中では正しい鍵でも 429。全件（130,813件）→ 200・約100MB・約6秒
- ② のログに鍵の文字列が出ないこと（0回）。目印 `4ef3ddc7` が `printf '%s' <鍵> | sha256sum | cut -c1-8` と一致
- 型チェック（`tsc --noEmit`）エラー 0
- リファクタリング：今回のコードに重複・不要な処理・使っていない import は無かった（テストのやり直しは不要）
- 仮スタッフ 999999・3100 は使っていない

## 追加した関数（全文）
`backend-express/src/features/trackingExport/router.ts`
```ts
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
```

## git diff（既存ファイル）
```diff
diff --git a/backend-express/src/app.ts b/backend-express/src/app.ts
index fabcfaf7b..71b400c0a 100644
--- a/backend-express/src/app.ts
+++ b/backend-express/src/app.ts
@@ -9,6 +9,7 @@ import type { RouteSummary } from './core/registry';
 import { createSystemRouter } from './core/systemRouter';
 import { features } from './features';
 import { createTrackingPublicRouter } from './features/tracking/publicRouter';
+import { createTrackingExportRouter } from './features/trackingExport/router';
 import { createGatewayRouter } from './gateway';
 import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
 import { requestContext } from './middlewares/requestContext';
@@ -66,6 +67,14 @@ export const createApp = (): BuiltApp => {
   // ---------------------------------------------------------------
   app.use(createTrackingPublicRouter());
 
+  // ---------------------------------------------------------------
+  // 1-3. 広告運用の担当者向けの読み出し（v2.2.265。GET /api/export/tracking/touches・conversions）
+  //
+  //   ⚠️ 鍵（Authorization: Bearer）で認証する。⚠️ 全体の CORS より前に置き、ブラウザから読ませない（ACAO を付けない）。
+  //   ⚠️ この2つのパス以外は素通しする（features/trackingExport/router.ts）。
+  // ---------------------------------------------------------------
+  app.use(createTrackingExportRouter());
+
   // ---------------------------------------------------------------
   // 2. CORS
   //    React開発サーバー（別オリジン）から叩けるようにする。
diff --git a/backend-express/src/config/env.ts b/backend-express/src/config/env.ts
index 65530eb56..6e14fb4d6 100644
--- a/backend-express/src/config/env.ts
+++ b/backend-express/src/config/env.ts
@@ -214,6 +214,18 @@ export const env = {
    */
   metaScraperKey: (process.env.META_SCRAPER_KEY ?? '').trim(),
 
+  /**
+   * 広告運用の担当者向けの読み出し API（GET /api/export/tracking/…）の鍵。（v2.2.265。features/trackingExport/router.ts）
+   *
+   * ⚠️ カンマ区切りで複数（人・ツールごとに分ける／入れ替えのときは新旧を両方入れる）。⚠️ 32文字より短いものは使わない。
+   * ⚠️ **未設定なら全部 401**（素通しにしない）。⚠️ requireEnv にはしない（他の機能まで止めないため）。
+   * ⚠️ 設定先は ② VPS の .env.prod のみ。⚠️ **リポジトリに書かないこと。**
+   */
+  trackingExportKeys: (process.env.TRACKING_EXPORT_KEYS ?? '')
+    .split(',')
+    .map((key) => key.trim())
+    .filter((key) => key !== ''),
+
   /**
    * 「Claudeによる分析」（v2.2.217）が使う Anthropic の API キー。
    *
diff --git a/docker-compose.prod.yml b/docker-compose.prod.yml
index 92e06b89d..08d02491a 100644
--- a/docker-compose.prod.yml
+++ b/docker-compose.prod.yml
@@ -139,6 +139,13 @@ services:
       # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
       - SYNC_LOG_SECRET=${SYNC_LOG_SECRET:-}
 
+      # 広告運用の担当者向けの読み出し API（GET /api/export/tracking/…）の鍵（v2.2.265）。
+      #
+      # ⚠️ カンマ区切りで複数持てる（人・ツールごとに分ける）。1つ64文字（openssl rand -hex 32 で作る）。32文字より短いものは使われない。
+      # ⚠️ 未設定だと全件 401（素通しにしない）。
+      # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。** 渡し方・入れ替え方は docs/api-tracking-export.md
+      - TRACKING_EXPORT_KEYS=${TRACKING_EXPORT_KEYS:-}
+
       # 「Claudeによる分析」（v2.2.217）が使う Anthropic の API キー（Claude Console で発行したもの）。
       #
       # ⚠️ 未設定だと分析の開始が 503 になる（他の機能は動く）。
diff --git a/docker-compose.yml b/docker-compose.yml
index ddca10c9c..63527abac 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -80,6 +80,8 @@ services:
       - META_SCRAPER_KEY=localtest
       # sync（Heroku の自動取り込み）が実行結果を書くときの合い言葉。⚠️ 開発用のダミー値。本番の値は ② VPS の .env.prod にのみ書く（v2.2.259）
       - SYNC_LOG_SECRET=localtest
+      # 広告運用の担当者向けの読み出し API の鍵（カンマ区切り）。⚠️ 開発用のダミー値（32文字以上）。本番の値は ② VPS の .env.prod にのみ書く（v2.2.265）
+      - TRACKING_EXPORT_KEYS=localtest-tracking-export-key-000001,localtest-tracking-export-key-000002
     env_file:
       # Meta 広告 API のトークンと対象の ID（v2.2.203。META_ACCESS_TOKEN・META_AD_ACCOUNTS）。
       #
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 1c0fd5c24..5939b53a5 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.264';
+export const newVersion = '2.2.265';
```
