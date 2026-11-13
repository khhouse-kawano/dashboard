# 2026-11-13-03 読み出し API：conversions をやめて customers（顧客）を追加（v2.2.266）

## 依頼
1. 広告運用エンジニア向けの読み出し API（v2.2.265）の **conversions（tracking_conversions）をやめる**。touches はそのまま。
2. 代わりに **顧客の API** を足す。注文 `master_data`・建売 `master_data_kaeru` のうち `landing_params` が空でない顧客を返す。
   返す項目：landing_params・店舗・ステータス・反響取得日・初回来場日・次アポ日・契約日・販促媒体・注文/建売の区別。顧客ID（個人を特定しない番号）は可、個人情報は返さない。landing_params の khg_vid を `visitor_id` として取り出す。
3. 仕様書 `docs/api-tracking-export.md` を書き直す（khg_vid で touches と顧客を突き合わせて KPI を出す手順・例・注意。conversions の説明を消す。管理者向けの節は残す）。

## 決めたこと
- パス：`GET /api/export/tracking/customers?category=order|spec`。**category は必須**（`id` ＝ 各表の `no` で、注文と建売で別に振られているため。1本の after_id で2つの表をまたいで続きを取れない）。
- パラメータ：`category`・`from`・`to`・`after_id`・`limit`。**from/to は反響取得日**（`YYYY-MM-DD` の日付だけ。以上・未満）。`updated_at`・`created_at` はローカルの対象行ですべて NULL だったので使えない。touches 用の `site_id`・`brand` は customers では 400。
- 対象：`TRIM(COALESCE(landing_params,'')) <> ''` かつ `show_dashboard = 1`（名寄せで隠した顧客を除く。CustomerTrendKaeru の既定・推移画面と同じ）かつ `COALESCE(delete_dashboard,0) = 0`（個人情報削除の顧客を除く。database/queries.ts の NOT_DELETED と同じ）。`status = '重複'` は返し、仕様書で「除いて数える」と案内。
- 日付：列は text で `/` と `-` が混在 → analysis/columns.ts の `phaseDateOf()`（`STR_TO_DATE(REPLACE(...))`、複数列は最古）で読み、`DATE_FORMAT(..., '%Y-%m-%d')` で返す（時刻のない列なので +09:00 は付けない）。
- **事業ごとの列の違いを analysis/columns.ts の PHASE_COLUMNS に合わせた**（建売の契約は 01JP74…＋01JV6AVXQ…、01J82Z5F1RR18… は建売では申込）。建売用に `application_date` を足した（注文は常に null）。
- `visitor_id`：landing_params を `parseLandingParams()`（tracking/params.ts）で読み、`khg_vid` を小文字にして UUID の形なら返す（他の処理の SQL `LOWER(SUBSTRING(... 'khg_vid=' ...,36))` と同じ値になることを全行で確認）。
- `category` は DB の `category` 列ではなく表ごとの定数（`'order'`／`'spec'`）を入れる（ローカルでは DB の列も同じ値だった）。
- conversions のルートを外した → `404`。CONVERSION_COLUMNS と真偽値の変換も削除。tracking_conversions の表・cvMatch はそのまま（API で返さなくなっただけ）。
- ① のゲートウェイは通さない API（v2.2.265 から。GET の口）なので express_proxy.php の許可リストは対象外。

## 列の対応表と根拠
| 返事の項目 | 注文（master_data） | 建売（master_data_kaeru） |
|---|---|---|
| `id` | `no` | `no` |
| `customer_id` | `id` | `id` |
| `category` | 定数 `'order'` | 定数 `'spec'` |
| `store` | `in_charge_store` | `in_charge_store` |
| `status` | `status` | `status` |
| `promotion_medium` | `sales_promotion_name` | `sales_promotion_name` |
| `inquiry_date`（反響取得日） | `step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99` | 同左 |
| `visit_date`（初回来場日） | `step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7` | `01J82Z5F1GQB02S1DEBZPBFDW7`（面談）と `01JV6AVXR4X6HW3JQ0G53Y26GG`（物件案内）の早い方 |
| `next_appointment_date`（次アポ日） | `step_migration_item_01JSENACS2FC422ZHEZWNSXNYA` | 同左 |
| `application_date`（申込日） | なし（常に null） | `step_migration_item_01J82Z5F1RR18Z792C7KZS88QG` |
| `contract_date`（契約日） | `step_migration_item_01J82Z5F1RR18Z792C7KZS88QG` | `01JP74NGRTT95X4Z8AQZ2QK2PW`（自社契約）と `01JV6AVXQMJY6XR4STWCHNKVE0`（仲介契約）の早い方 |
| `visitor_id` | landing_params の `khg_vid` | 同左 |
| `landing_params` | `landing_params` | `landing_params` |

根拠：
- **初回来場日**：利用者のメモは 反響取得日と同じ `01J82Z5F13B6…` になっていたが書き間違いと判断。`01J82Z5F1GQB02S1DEBZPBFDW7` を使った。
  - backend-express/src/features/analysis/columns.ts:56-58（firstInterview＝初回面談）・:154（order.visit）・:165-168（kaeru.visit＝面談＋物件案内）
  - backend-express/src/features/duplicateSummary.ts:40（「初回面談（＝来場）」）、dailyAction.ts:151（「初回来場」）、eventSummary.ts:80（「店舗来場者数」）
- **次アポ日**：`01JSENACS2FC422ZHEZWNSXNYA`（メモどおり）。memory の master-data-step-columns-to-avoid（第二面談＝01JSENACS。DB コメントは「※次回アポ」）、analysis/columns.ts:31-34・:155・:169、campaignSummary.ts:21（「次アポ（appointment）」）、eventSummary.ts:83（「次アポ数」）。
- **契約日**：注文は `01J82Z5F1RR18Z792C7KZS88QG`（メモどおり。analysis/columns.ts:69・:158、eventSummary.ts:85）。**建売は違う**：analysis/columns.ts:111-118・:175-181、customerTrend/queries.ts:75-78・:110-115 で、建売の `01J82Z5F1RR18…` は**申込日**、契約は `01JP74NGRTT95X4Z8AQZ2QK2PW`＋`01JV6AVXQMJY6XR4STWCHNKVE0`。→ 建売の contract_date はこの2列、RR18 は application_date に入れた。
  - ⚠️ 既存の tracking/vendorFunnel.ts（業者別の歩留まり）は建売にも RR18 を「契約」として使っている（今回は触っていない）。
- **反響取得日**：`01J82Z5F13B6QVM6X0TCWZHW99`（メモどおり。analysis/columns.ts:45、duplicateSummary.ts:39）。
- 列名は master_data と master_data_kaeru で同じ（`SHOW COLUMNS` で確認。landing_params・show_dashboard・delete_dashboard・in_charge_store・status・sales_promotion_name・no・id とも両方にある。並びだけ違う）。

## 変えたファイル
- `backend-express/src/features/trackingExport/router.ts`（conversions を削除、customers を追加）
- `backend-express/src/app.ts`（1-3 のコメント1行だけ）
- `docs/api-tracking-export.md`（全面的に書き直し）
- `docs/task-2026-11-13-03-tracking-export-customers.md`（この記録）

追加した関数・定数（router.ts）：`Kind`（型）・`CustomerCategory`（型）・`CUSTOMER_TABLES`・`parseDay`・`toPage`・`CUSTOMER_PHASES`・`customerColumns`・`CustomerRow`（型）・`readCustomers`
変更した関数（router.ts）：`ALLOWED_PARAMS`（種類ごと）・`Filters`（category を追加）・`parseFilters`（kind を受ける）・`readPage` → `readTouches`（着地専用に）・`createTrackingExportRouter` の `handle`・ルートの登録
削除：`CONVERSION_COLUMNS`・`SOURCES`・conversions のルート

業務ガイドの記事：画面の追加・修正ではない（社外エンジニア向けの API）ので対象外。

## 追加・変更した関数（全文）
```ts
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
```

## テスト結果（ローカル ② に直接 http://localhost:3001/api/export/tracking/…、開発用ダミー鍵）
スクリプト：scratchpad の `c266-export/test.mjs`（API）・`compare.mjs`（DB と1行ずつ突き合わせ）・`doc_example.py`（仕様書の Python 例をそのまま実行）。

- `npx tsc --noEmit -p .`（backend-express）：エラー 0
- test.mjs：34 項目すべて OK（リファクタリング後にもう一度実行して同じ）
  - 鍵なし 401／鍵違い 401／`/conversions` 404／`/touches?limit=2` 200（count=2・has_more=true）
  - 400：category なし・`category=used`・customers に `site_id`・from に時刻・from ≥ to・category の重複・touches に `category`
  - order：200・`Cache-Control: no-store`・ACAO なし、**115 件**（DB：landing_params あり 120 − 名寄せで隠した 5 − 削除済み 0 ＝ 115 と一致）
  - spec：同上、**65 件**（DB：86 − 名寄せ 21 − 削除済み 0 ＝ 65 と一致）
  - 列は `id,customer_id,category,store,status,promotion_medium,inquiry_date,visit_date,next_appointment_date,application_date,contract_date,visitor_id,landing_params` だけ（氏名・電話・メール・住所の列なし）
  - category はすべて order／spec、id 昇順、日付はすべて `YYYY-MM-DD` か null、order の application_date はすべて null
  - after_id：limit=10 で1ページ目 → next_after_id で2ページ目、合わせた 20 件の id が全件取得の先頭 20 件と一致。最後の id の次は 0 件・next_after_id そのまま・has_more=false
  - from=2026-10-01&to=2026-11-01（反響取得日）：order 104 件・spec 59 件（全件から反響取得日で数えた数と一致）
  - visitor_id あり：order 99／115、spec 65／65
- compare.mjs：DB の生の列（`/` と `-` を正規化、建売は2列の早い方）と、180 行すべてで inquiry/visit/next_appointment/application/contract の日付・customer_id・visitor_id（DB の SUBSTRING で取り出した値）が一致
  - ローカルの対象行は契約・申込の日付が 0 件のため、建売の contract_date の「2列の早い方」は、master_data_kaeru 全体の 676 行（2列のどちらかに値がある行。うち2行は両方）で、`phaseDateOf('kaeru','contract')` の式と JS で計算した早い方が全行一致することを別に確認
- 仕様書の Python 例（BASE を localhost に変えただけ）：touches 130,813 行・customers 180 行を取得 → ビジターIDあり・重複除く 163 人 → 反響日までの広告の着地と結べた 117 人を source×utm_campaign で集計できた（合計 反響 117・来場 32・次アポ 13・契約 0）

## 未確認
- 仕様書の SQL 例（BigQuery の書き方）は実行していない（手元に BigQuery が無い）。
- 本番の件数・処理時間（顧客の表は全件を読む。from/to は計算した日付で絞るので索引は効かない。ローカル 2.7 万行では一瞬）。
- 本番へのデプロイ手順書（② だけ。`dcp up -d --build express-api` 系）は今回作っていない。① の変更は無い。

## git diff（コード）
```diff
diff --git a/backend-express/src/app.ts b/backend-express/src/app.ts
index 71b400c0a..ee8dcb2d1 100644
--- a/backend-express/src/app.ts
+++ b/backend-express/src/app.ts
@@ -68,7 +68,7 @@ export const createApp = (): BuiltApp => {
   app.use(createTrackingPublicRouter());
 
   // ---------------------------------------------------------------
-  // 1-3. 広告運用の担当者向けの読み出し（v2.2.265。GET /api/export/tracking/touches・conversions）
+  // 1-3. 広告運用の担当者向けの読み出し（v2.2.265。GET /api/export/tracking/touches・customers。v2.2.266 で conversions をやめた）
   //
   //   ⚠️ 鍵（Authorization: Bearer）で認証する。⚠️ 全体の CORS より前に置き、ブラウザから読ませない（ACAO を付けない）。
   //   ⚠️ この2つのパス以外は素通しする（features/trackingExport/router.ts）。
diff --git a/backend-express/src/features/trackingExport/router.ts b/backend-express/src/features/trackingExport/router.ts
index b94061738..a727ee159 100644
--- a/backend-express/src/features/trackingExport/router.ts
+++ b/backend-express/src/features/trackingExport/router.ts
@@ -5,12 +5,19 @@ import type { RowDataPacket } from 'mysql2/promise';
 import { env } from '../../config/env';
 import { query, type SqlParam } from '../../db/pool';
 import { logger } from '../../utils/logger';
+import { type AnalysisDivision, type AnalysisPhase, phaseDateOf } from '../analysis/columns';
+import { parseLandingParams, UUID_PATTERN } from '../tracking/params';
 
 /**
  * 広告運用の担当者向けの読み出し API（v2.2.265）。⚠️ 読むだけ。
  *
- *   GET /api/export/tracking/touches      … tracking_touches（パラメータ付きの着地 1回 = 1行）
- *   GET /api/export/tracking/conversions  … tracking_conversions（自社のフォームでないサイトの CV）
+ *   GET /api/export/tracking/touches    … tracking_touches（着地 1回 = 1行。広告のパラメータが無い訪問も入る）
+ *   GET /api/export/tracking/customers  … 顧客（v2.2.266。注文 master_data・建売 master_data_kaeru の landing_params がある顧客）
+ *   ⚠️ v2.2.266 で conversions（tracking_conversions）はやめた（利用者の指示）。
+ *
+ * ⚠️ customers は個人情報（氏名・電話・メール・住所など）を返さない。返す列は CUSTOMER_PHASES と customerColumns() だけ。
+ * ⚠️ customers の工程の日付は analysis/columns.ts の PHASE_COLUMNS（分析 API・推移画面と同じ定義）を使う。
+ *   ⚠️ 同じ列が事業で意味が違う（01J82Z5F1RR18… は 注文＝契約日／建売＝申込日）。列名を直書きしないこと。
  *
  * ─────────────────────────────────────────────
  * ⚠️⚠️ **鍵はヘッダー `Authorization: Bearer <鍵>` だけで受ける。URL（?key=）では受けない。**
@@ -20,8 +27,6 @@ import { logger } from '../../utils/logger';
  * ⚠️ ① のゲートウェイは通さない（GET の口のため）。express_proxy.php の許可リストには入れない。
  * ⚠️ app.ts で全体の CORS より前に置く。ブラウザから呼ばせない（ACAO を付けない）。サーバー・スクリプトから使う前提。
  * ⚠️ 期間・件数の上限は設けない（利用者の指示）。⚠️ limit を省くと 1000 件。続きは after_id で取る。
- * ⚠️ email_hash・tel_hash（メール・電話の SHA-256）も返す（利用者の指示。広告の拡張コンバージョン用）。
- *   ⚠️ 電話の SHA-256 は総当たりで元に戻せる。実質の個人情報として扱うよう、仕様書（docs/api-tracking-export.md）に書いてある。
  * ─────────────────────────────────────────────
  */
 
@@ -75,9 +80,34 @@ const exportLimiter = rateLimit({
 
 class BadRequest extends Error {}
 
-type Filters = { from: string | null; to: string | null; siteId: number | null; brand: string | null; afterId: number; limit: number };
+type Kind = 'touches' | 'customers';
+
+/** 顧客の事業。⚠️ 返事の category にもこの値を入れる */
+type CustomerCategory = 'order' | 'spec';
 
-const ALLOWED_PARAMS = new Set(['from', 'to', 'site_id', 'brand', 'after_id', 'limit']);
+type Filters = {
+  from: string | null;
+  to: string | null;
+  siteId: number | null;
+  brand: string | null;
+  category: CustomerCategory | null;
+  afterId: number;
+  limit: number;
+};
+
+const ALLOWED_PARAMS: Record<Kind, ReadonlySet<string>> = {
+  touches: new Set(['from', 'to', 'site_id', 'brand', 'after_id', 'limit']),
+  customers: new Set(['category', 'from', 'to', 'after_id', 'limit']),
+};
+
+/**
+ * 顧客の表。⚠️ SQL に直接埋め込むので、この定数以外の値を入れないこと。
+ * ⚠️ 表ごとに no（行の番号）が別に振られているので、after_id で続きを取るため category を必須にする。
+ */
+const CUSTOMER_TABLES: Record<CustomerCategory, { table: string; division: AnalysisDivision }> = {
+  order: { table: 'master_data', division: 'order' },
+  spec: { table: 'master_data_kaeru', division: 'kaeru' },
+};
 
 /** 'YYYY-MM-DD' か 'YYYY-MM-DDTHH:MM(:SS)'（T の代わりに空白も可）→ 'YYYY-MM-DD HH:MM:SS'（日本時間） */
 const parseJst = (name: string, raw: string): string => {
@@ -98,25 +128,40 @@ const parseInteger = (name: string, raw: string, min: number): number => {
   return Number(raw);
 };
 
+/**
+ * 顧客の from・to（反響取得日）。⚠️ 日付だけ（時刻なし）を受ける → 'YYYY-MM-DD'。
+ * ⚠️ 反響取得日は日付だけの列なので、時刻を受けると「その日の途中から」が意味を持たない。
+ */
+const parseDay = (name: string, raw: string): string => {
+  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequest(`${name} は YYYY-MM-DD で指定してください（顧客は反響取得日で絞ります）`);
+  return parseJst(name, raw).slice(0, 10);
+};
+
 /** URL のパラメータを読む。⚠️ 知らない名前・同じ名前の重複は 400（書き間違いに気づけるように） */
-const parseFilters = (req: Request): Filters => {
+const parseFilters = (req: Request, kind: Kind): Filters => {
+  const allowed = ALLOWED_PARAMS[kind];
   const q = req.query as Record<string, unknown>;
   for (const [name, value] of Object.entries(q)) {
-    if (!ALLOWED_PARAMS.has(name)) throw new BadRequest(`知らないパラメータです: ${name}（使えるのは ${[...ALLOWED_PARAMS].join('・')}）`);
+    if (!allowed.has(name)) throw new BadRequest(`知らないパラメータです: ${name}（使えるのは ${[...allowed].join('・')}）`);
     if (typeof value !== 'string') throw new BadRequest(`${name} は1つだけ指定してください`);
   }
   const get = (name: string): string | null => {
     const v = q[name];
     return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
   };
+  const parseWhen = kind === 'customers' ? parseDay : parseJst;
   const fromRaw = get('from');
   const toRaw = get('to');
-  const from = fromRaw === null ? null : parseJst('from', fromRaw);
-  const to = toRaw === null ? null : parseJst('to', toRaw);
+  const from = fromRaw === null ? null : parseWhen('from', fromRaw);
+  const to = toRaw === null ? null : parseWhen('to', toRaw);
   if (from !== null && to !== null && from >= to) throw new BadRequest('to は from より後にしてください（from 以上、to 未満）');
   const siteRaw = get('site_id');
   const brand = get('brand');
   if (brand !== null && !/^[A-Za-z0-9_-]{1,32}$/.test(brand)) throw new BadRequest('brand は英数字で指定してください（kh・djh など）');
+  const categoryRaw = get('category');
+  if (kind === 'customers' && categoryRaw !== 'order' && categoryRaw !== 'spec') {
+    throw new BadRequest('category は order（注文）か spec（建売）で指定してください（必須）');
+  }
   const afterRaw = get('after_id');
   const limitRaw = get('limit');
   return {
@@ -124,6 +169,7 @@ const parseFilters = (req: Request): Filters => {
     to,
     siteId: siteRaw === null ? null : parseInteger('site_id', siteRaw, 1),
     brand,
+    category: categoryRaw === 'order' || categoryRaw === 'spec' ? categoryRaw : null,
     afterId: afterRaw === null ? 0 : parseInteger('after_id', afterRaw, 0),
     limit: limitRaw === null ? DEFAULT_LIMIT : parseInteger('limit', limitRaw, 1),
   };
@@ -136,24 +182,17 @@ const TOUCH_COLUMNS = `t.id, ${isoJst('t.created_at')} AS created_at, t.site_id,
   t.visitor_id, t.source, t.gclid, t.gbraid, t.wbraid, t.fbclid, t.yclid, t.gad_source, t.gad_campaignid,
   t.utm_source, t.utm_medium, t.utm_campaign, t.utm_term, t.utm_content, t.flyer, t.landing_url, t.referrer, t.user_agent`;
 
-/** ⚠️ email_hash・tel_hash は、無いとき空文字で入っているので null にそろえる */
-const CONVERSION_COLUMNS = `t.id, ${isoJst('t.created_at')} AS created_at, t.site_id, s.name AS site_name, s.brand,
-  t.visitor_id, t.form, NULLIF(t.email_hash, '') AS email_hash, NULLIF(t.tel_hash, '') AS tel_hash,
-  t.landing_params, t.page_url, (t.matched_at IS NOT NULL) AS matched, ${isoJst('t.matched_at')} AS matched_at, t.matched_inquiry_id`;
-
-const SOURCES = {
-  touches: { table: 'tracking_touches', columns: TOUCH_COLUMNS },
-  conversions: { table: 'tracking_conversions', columns: CONVERSION_COLUMNS },
-} as const;
-
-type Kind = keyof typeof SOURCES;
+/** limit + 1 件読んだ結果 → 1ページぶんと、続きがあるか（has_more） */
+const toPage = <T>(rows: T[], limit: number): { rows: T[]; hasMore: boolean } => {
+  const hasMore = rows.length > limit;
+  return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
+};
 
 /**
- * 1ページぶん読む。⚠️ id の小さい順。limit + 1 件読んで、続きがあるか（has_more）を決める。
+ * 着地を1ページぶん読む。⚠️ id の小さい順。limit + 1 件読んで、続きがあるか（has_more）を決める。
  * ⚠️ LIMIT は検査済みの整数をそのまま埋める（mysql2 の execute は LIMIT ? を受けないことがあるため）。
  */
-const readPage = async (kind: Kind, f: Filters): Promise<{ rows: ExportRow[]; hasMore: boolean }> => {
-  const { table, columns } = SOURCES[kind];
+const readTouches = async (f: Filters): Promise<{ rows: ExportRow[]; hasMore: boolean }> => {
   const where: string[] = ['t.id > ?'];
   const params: SqlParam[] = [f.afterId];
   if (f.from !== null) { where.push('t.created_at >= ?'); params.push(f.from); }
@@ -161,16 +200,84 @@ const readPage = async (kind: Kind, f: Filters): Promise<{ rows: ExportRow[]; ha
   if (f.siteId !== null) { where.push('t.site_id = ?'); params.push(f.siteId); }
   if (f.brand !== null) { where.push('s.brand = ?'); params.push(f.brand); }
   const rows = await query<ExportRow>(
-    `SELECT ${columns}
-       FROM ${table} t
+    `SELECT ${TOUCH_COLUMNS}
+       FROM tracking_touches t
        LEFT JOIN tracking_sites s ON s.id = t.site_id
       WHERE ${where.join(' AND ')}
       ORDER BY t.id
       LIMIT ${f.limit + 1}`,
     params
   );
-  const hasMore = rows.length > f.limit;
-  return { rows: hasMore ? rows.slice(0, f.limit) : rows, hasMore };
+  return toPage(rows, f.limit);
+};
+
+/**
+ * 顧客で返す工程の日付（返事の項目名 → 工程）。⚠️ 列は analysis/columns.ts の PHASE_COLUMNS で事業ごとに決まる。
+ *   ⚠️ 建売の来場＝面談＋物件案内、契約＝自社契約＋仲介契約の、いちばん古い日。
+ *   ⚠️ application_date（申込）は建売だけ。注文は常に null。
+ */
+const CUSTOMER_PHASES: ReadonlyArray<[string, AnalysisPhase]> = [
+  ['inquiry_date', 'reaction'],
+  ['visit_date', 'visit'],
+  ['next_appointment_date', 'nextAppointment'],
+  ['application_date', 'application'],
+  ['contract_date', 'contract'],
+];
+
+/**
+ * 顧客の列。⚠️ 個人情報（氏名・電話・メール・住所など）は入れないこと。
+ * ⚠️ id は表の no（続きを取る番号）、customer_id は顧客DB の顧客ID（顧客情報の画面と同じ）。
+ * ⚠️ 空文字は null にそろえる。⚠️ 日付は 'YYYY-MM-DD'（列は文字列で `/` と `-` が混ざるので phaseDateOf で読む）。
+ */
+const customerColumns = (category: CustomerCategory): string => {
+  const { division } = CUSTOMER_TABLES[category];
+  const phases = CUSTOMER_PHASES.map(([name, phase]) => `DATE_FORMAT(${phaseDateOf(division, phase)}, '%Y-%m-%d') AS ${name}`);
+  return [
+    'm.no AS id',
+    'm.id AS customer_id',
+    `'${category}' AS category`,
+    "NULLIF(TRIM(m.in_charge_store), '') AS store",
+    "NULLIF(TRIM(m.status), '') AS status",
+    "NULLIF(TRIM(m.sales_promotion_name), '') AS promotion_medium",
+    ...phases,
+    'm.landing_params',
+  ].join(',\n  ');
+};
+
+/** 顧客の1行（返事） */
+type CustomerRow = ExportRow & { landing_params: string };
+
+/**
+ * 顧客を1ページぶん読む。⚠️ landing_params が空でない顧客だけ。
+ * ⚠️ 名寄せで隠した顧客（show_dashboard = 0）と、個人情報削除で削除済みの顧客（delete_dashboard = 1）は返さない（推移画面・顧客DB と同じ）。
+ * ⚠️ status＝重複 は返す（使う側が status で除く）。⚠️ from・to は反響取得日（読めない顧客は、指定したときは返らない）。
+ */
+const readCustomers = async (f: Filters, category: CustomerCategory): Promise<{ rows: ExportRow[]; hasMore: boolean }> => {
+  const { table, division } = CUSTOMER_TABLES[category];
+  const inquiry = phaseDateOf(division, 'reaction');
+  const where: string[] = [
+    'm.no > ?',
+    "TRIM(COALESCE(m.landing_params, '')) <> ''",
+    'm.show_dashboard = 1',
+    'COALESCE(m.delete_dashboard, 0) = 0',
+  ];
+  const params: SqlParam[] = [f.afterId];
+  if (f.from !== null) { where.push(`${inquiry} >= ?`); params.push(f.from); }
+  if (f.to !== null) { where.push(`${inquiry} < ?`); params.push(f.to); }
+  const rows = await query<CustomerRow>(
+    `SELECT ${customerColumns(category)}
+       FROM ${table} m
+      WHERE ${where.join(' AND ')}
+      ORDER BY m.no
+      LIMIT ${f.limit + 1}`,
+    params
+  );
+  // ⚠️ landing_params の khg_vid（ビジターID）を visitor_id として出す（touches の visitor_id と同じ小文字の UUID。形が違えば null）
+  const withVisitor = rows.map(({ landing_params: landingParams, ...rest }) => {
+    const vid = (parseLandingParams(landingParams).khg_vid ?? '').trim().toLowerCase();
+    return { ...rest, visitor_id: UUID_PATTERN.test(vid) ? vid : null, landing_params: landingParams } as ExportRow;
+  });
+  return toPage(withVisitor, f.limit);
 };
 
 export const createTrackingExportRouter = (): Router => {
@@ -188,14 +295,15 @@ export const createTrackingExportRouter = (): Router => {
     }
     const startedAt = Date.now();
     try {
-      const filters = parseFilters(req);
-      const { rows, hasMore } = await readPage(kind, filters);
-      const data = kind === 'conversions' ? rows.map((r) => ({ ...r, matched: Number(r.matched) === 1 })) : rows;
+      const filters = parseFilters(req, kind);
+      const { rows, hasMore } = kind === 'customers' && filters.category !== null
+        ? await readCustomers(filters, filters.category)
+        : await readTouches(filters);
       const nextAfterId = rows.length > 0 ? rows[rows.length - 1].id : filters.afterId;
       logger.info(
-        `tracking export: ${kind} key=${label} ip=${req.ip ?? ''} from=${filters.from ?? '-'} to=${filters.to ?? '-'} site_id=${filters.siteId ?? '-'} brand=${filters.brand ?? '-'} after_id=${filters.afterId} limit=${filters.limit} rows=${rows.length} ${Date.now() - startedAt}ms`
+        `tracking export: ${kind} key=${label} ip=${req.ip ?? ''} category=${filters.category ?? '-'} from=${filters.from ?? '-'} to=${filters.to ?? '-'} site_id=${filters.siteId ?? '-'} brand=${filters.brand ?? '-'} after_id=${filters.afterId} limit=${filters.limit} rows=${rows.length} ${Date.now() - startedAt}ms`
       );
-      res.json({ data, count: rows.length, next_after_id: nextAfterId, has_more: hasMore });
+      res.json({ data: rows, count: rows.length, next_after_id: nextAfterId, has_more: hasMore });
     } catch (error) {
       if (error instanceof BadRequest) {
         res.status(400).json({ error: 'bad_request', message: error.message });
@@ -207,6 +315,6 @@ export const createTrackingExportRouter = (): Router => {
   };
 
   router.get(`${PATH_PREFIX}/touches`, exportLimiter, handle('touches'));
-  router.get(`${PATH_PREFIX}/conversions`, exportLimiter, handle('conversions'));
+  router.get(`${PATH_PREFIX}/customers`, exportLimiter, handle('customers'));
   return router;
 };
```

- `docs/api-tracking-export.md` は全面的に書き直したので diff は省略（ファイルを直接見てください）。主な変更：conversions の節を削除、customers のパラメータ・項目、差分の取り込み方（customers は毎回全件）、「5. 流入と顧客の KPI を結びつける」（考え方・手順・SQL 例・Python 例・landing_params が入る条件などの注意）を追加。管理者向けの節は残し、ログの例を customers に変更。
