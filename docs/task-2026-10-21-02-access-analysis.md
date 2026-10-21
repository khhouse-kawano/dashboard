# v2.2.203 アクセス解析：詳細のモーダル・Meta 広告の取り込み・ページの閲覧の記録（2026-10-21）

## 依頼（ReadMeClaude.md）
- Header.tsx：「トラッキング設定」→「アクセス解析」
- TrackingSettings.tsx
  - 着地ページの右にリンクアイコン（遷移）
  - 着地ページを押すと size='lg' のモーダルで詳細な解析（重ければ onClick で fetch）。表は tracking_touches からエージェント側で生成。Meta のトークンを使った解析も
  - 流入元を押しても同じく。meta・Facebook/Instagram のときは Meta のトークンを使った解析
  - Meta 用の表を作り、トークンと ID でデータを取得し続ける
- 計画の確認：1. 画面の見出し・記事のタイトルも「アクセス解析」に → OK、2. 自動の取り込みは6時間ごと → OK、3. CV の一覧に名前を出さない → OK
- 途中の指示（MA）：「tracking_touches は遷移した全ページを保存すると思っていた」→ 全ページの記録を追加。保存の仕方は「案1（行数の上限を超えたら古い行から消す）」。
  「MA は CV が起きて有効名簿化（master_data に保存）した顧客に絞ればよい。master_data に保存された or CV が起きたらフラグを立てて消さないように」→ 消さない顧客ID の表（tracking_keep_visitors）で実装。上限は50万行。

## 仕組み
- **Meta 広告の取り込み**（② features/metaAds/）
  - .env の META_ACCESS_TOKEN・META_AD_ACCOUNTS（ブランド:キャンペーンID）で、{ID}/ads（広告の一覧）と {ID}/insights（level=ad・日別・直近35日）を読む → meta_ad_items・meta_ad_daily に上書き（500行ずつまとめて）。
  - ② の起動1分後と6時間ごとに自動（scheduler.ts）。画面の「Meta から取り込む」（meta_ads_import）は待たずに返す。2つ同時には動かない。
  - トークンは Authorization ヘッダーで送り、ログ・エラーでは伏せる（mask）。続きのページは cursors.after で自分で URL を作る（paging.next はトークン入りのため使わない）。
  - 実測（ローカル）：広告 2,331件・日別 13,218行、約4分半（時間の大半は Meta API の読み込み）。
- **ページの閲覧**（② features/tracking/pageview.ts、公開の口 POST /api/track/pv）
  - tracker.js がページを開くたびに送る（顧客ID・訪問ID（khg_sid。30分で新しく）・URL（? 以降なし）・タイトル・ひとつ前のページ（khg_prev））。タグの貼り直しは不要。
  - 受け口の検査は着地と同じ（登録・有効・許可オリジン・UUID・ロボット除外）。URL・前のページはそのオリジンのものだけ。流量は同じ IP から1分に120件まで。
- **整理**（② features/tracking/maintenance.ts。起動1分半後と6時間ごと）
  1. 反響（inquiry_customer）と有効名簿（master_data）の landing_params の khg_vid を tracking_keep_visitors に足す（cv／master）
  2. tracking_pageviews が50万行を超えたら、新しい50万行より古い行のうち、消さない顧客ID に無い人の行を1万行ずつ消す
- **詳細**（② features/tracking/detail.ts、request tracking_detail）：サイト1つの着地ページ1つ／流入元1つの直近30日。
  - 上の数字（PV・広告・訪問者・2回以上来た人・CV）、日別の PV と CV、時間帯、端末（UA から）、流入元別／着地ページ別、広告別（utm_content）、CV の一覧（個人情報なし）
  - 着地ページのときは閲覧の記録から閲覧回数・前に見ていたページ・次に見たページ
  - Meta の数字（費用・表示・クリック）は utm_content＝広告ID でつなぐ。流入元が meta 等のときは、そのサイトのブランドで費用・表示のある広告も全部
- **画面**：TrackingDetail.tsx（新規。size="lg"。後ろの幕を z-index 1055 に上げる）。TrackingSettings.tsx は着地ページ・流入元の文字をボタンにして詳細を開き、着地ページの右にリンクのアイコン。上に Meta の最後の取り込み日時と「Meta から取り込む」。

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/scripts/sql | **2026-10-21_meta_ad_tables.sql**・**_rollback.sql**（新規） | meta_ad_items・meta_ad_daily（utf8mb4_general_ci。⚠️ 最初 unicode_ci で作り tracking_touches と照合順序が合わなかったので直した） |
| 〃 | **2026-10-21_tracking_pageviews.sql**・**_rollback.sql**（新規） | tracking_pageviews・tracking_keep_visitors |
| 〃 | **2026-10-20_update_log_2.2.203.sql** | 文面を確定。記事のタイトル変更の UPDATE ＋ 記事2本 |
| backend-express/src/config | **env.ts** | `metaAccessToken`・`metaAdAccounts` |
| backend-express/src/features/metaAds | **importer.ts**（新規） | `importMetaAds`・`isMetaConfigured`・`META_IMPORT_DAYS`・`fetchAll`・`upsert`・`mask` |
| 〃 | **scheduler.ts**（新規） | `startMetaAdsScheduler` |
| backend-express/src/features/tracking | **detail.ts**（新規） | `trackingDetail`・`deviceOf`・`META_SOURCE_PATTERN`・`loadMetaAds`・`loadPageFlow`・`bucketize` |
| 〃 | **pageview.ts**（新規） | `recordPageview`・`sameOriginPath` |
| 〃 | **maintenance.ts**（新規） | `runTrackingMaintenance`・`startTrackingMaintenance`・`PAGEVIEW_CAP` |
| 〃 | **conversions.ts** | `Conversion` に inquiryDay・adId・campaign |
| 〃 | **sites.ts** | 一覧に `meta: { configured, lastImportedAt }` |
| 〃 | **publicRouter.ts** | POST /api/track/pv・`pageviewLimiter` |
| backend-express/public | **tracker.js** | 訪問ID（khg_sid）・前のページ（khg_prev）・`post`・ページを開くたびに /api/track/pv |
| backend-express/src | **server.ts** | 起動後に `startMetaAdsScheduler`・`startTrackingMaintenance` |
| backend-express/src/gateway | **registry.ts** | request `tracking_detail`・`meta_ads_import` |
| backend/src/core | **express_proxy.php** | 2つのリストに `tracking_detail`・`meta_ads_import` |
| （ルート） | **docker-compose.prod.yml** | `META_ACCESS_TOKEN`・`META_AD_ACCOUNTS` |
| frontend/src/components/header | **TrackingDetail.tsx**（新規） | 詳細のモーダル（`BucketTable`・`FlowTable`） |
| 〃 | **TrackingSettings.tsx** | 見出し「アクセス解析」、着地ページ・流入元のボタン＋リンクアイコン、Meta の行（`importMeta`）。⚠️ v2.2.202 の誤り（着地ページのリンク判定の正規表現が `/^https?:///` になりコメント扱い）も直した |
| 〃 | **Header.tsx** | メニュー名「アクセス解析」（menuMapping・editMapping・isFullscreenMenu） |
| frontend/src/components/guide | **guideScreens.ts** | キー「アクセス解析」 |
| backend/scripts/guide/articles | **common/screen-200.md** | タイトル「アクセス解析」、閲覧の記録・詳細・Meta 広告の節 |
| 〃 | **order/screen-010.md** | リンク [[トラッキング設定]] → [[アクセス解析]] |

## 確認
- SQL：4つの表とも2回流しても安全。
- ② 型チェック OK。① 経由でトークン無しの tracking_detail・meta_ads_import → 401。
- Meta の取り込み（ローカル。本物の API）：成功（広告 2,331・日別 13,218）。2つ同時に呼んでも1回にまとまる。着地の utm_content の多くが取り込んだ広告ID と一致（PG 111/111、国分 94/122）。
- tracking_detail（実データ）：PG の流入元 meta → PV 111・訪問者 57・2回以上 18・CV 2・Meta 広告 38件。権限なし 403・サイトなし 404・指定の誤り 400。
- ページの閲覧（Playwright で kh-house.jp を模擬）：1ページ1行、? 以降（テストの email=…）は保存しない、31分あけると訪問ID が変わる、前のページが正しい、ロボットは保存しない。
- 整理（上限を2行にして実行）：名簿にも CV にもいない人の古い行だけ消え、CV がある人の行は古くても残る。2回目は 0。
- 画面（ビルド結果を Playwright で表示。② の返答は実データで書き出したもの）
  - メニューに「アクセス解析」（旧名なし）、見出し「アクセス解析」、Meta の行と取り込みボタン（押すと meta_ads_import・案内の文）
  - 着地ページの行：文字のボタンとリンクアイコン（http の行だけ）。押すと size lg のモーダル、後ろの幕 1055 で全画面の上、モーダルが一番上
  - 着地ページ /lp/：閲覧回数・ページの前後（前：訪問の最初、次：/plan/）・流入元別・Meta 広告・端末・時間帯・CV
  - PG の流入元 meta：Meta 広告の合計（費用 1,839,498円・表示 555,522・クリック 30,489・CV 2）、38件の広告、CPA で並べ替え、CV の一覧（名前なし）
  - 閉じてもサマリーは開いたまま。幅 390px でモーダルも画面も横にはみ出さない
- 記事：ローカル DB でタイトルが「アクセス解析」に変わり（id 91 のまま、増えていない）、本文を更新。
- 後片付け：テストの反響・閲覧・消さない顧客ID・テストの着地を削除（CSV の実データ・Meta の実データは残した）。
- フロント：TrackingSettings.tsx・TrackingDetail.tsx・Header.tsx を直接指定した型チェック OK。ビルド `main.be71da09.js`。

## 差分（全文。新しいファイルを含む）
```diff
diff --git a/backend-express/public/tracker.js b/backend-express/public/tracker.js
index a12daf93..3c2fd585 100644
--- a/backend-express/public/tracker.js
+++ b/backend-express/public/tracker.js
@@ -17,6 +17,7 @@
       'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'flyer'];
     var MAX = 500;
     var ENDPOINT = 'https://api.khg-marketing.info/api/track/touch';
+    var PV_ENDPOINT = 'https://api.khg-marketing.info/api/track/pv';
     var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
     // ⚠️ v2.2.201 自社のサイトどうし（見学クラウドを含む）は、リンクに顧客IDと広告の情報を付けて渡す。www の有無は同じとみなす
     var LINK_HOSTS = ['ie-miru.jp', 'kh-house.jp', 'day-just-house.com', 'nagomi-koumuten.jp', 'furukomi-home.com',
@@ -89,11 +90,17 @@
     document.addEventListener('click', decorate, true);
     // ⚠️ v2.2.201 広告以外の訪問も数える（アクセス数の解析用）。1回の訪問につき1件。最後に開いたページから30分たったら次の訪問
     var VISIT_MS = 30 * 60 * 1000;
+    // ⚠️ v2.2.203 新しい訪問のときは訪問ID（khg_sid）を作り直し、ひとつ前のページ（khg_prev）を消す
     var visit = function () {
       var now = Date.now();
       var last = Number(store.getItem('khg_last') || 0);
       store.setItem('khg_last', String(now));
-      return !(last > 0 && now - last < VISIT_MS);
+      var isNew = !(last > 0 && now - last < VISIT_MS);
+      if (isNew || !UUID.test(store.getItem('khg_sid') || '')) {
+        store.setItem('khg_sid', uuid());
+        store.removeItem('khg_prev');
+      }
+      return isNew;
     };
     // ⚠️ 流入元はどこから来たか（リファラー）で決める。⚠️ ② の ORGANIC_SOURCE_PATTERN と同じ形。自社サイトからの移動は '' （数えない）
     var channel = function (ref) {
@@ -113,24 +120,34 @@
       return 'referral/' + h.replace(/[^a-z0-9.-]/g, '').slice(0, 150);
     };
     // ⚠️ text/plain で送る（CORS のプリフライトを起こさない）。⚠️ 結果は使わない
-    var send = function (extra) {
-      var payload = {
-        site_key: siteKey, visitor_id: visitor(),
-        landing_url: (url.origin + url.pathname).slice(0, 2000),
-        referrer: (document.referrer || '').slice(0, 2000),
-      };
-      Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });
+    var post = function (endpoint, payload) {
       var body = JSON.stringify(payload);
       var sent = false;
       try {
-        if (navigator.sendBeacon) sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
+        if (navigator.sendBeacon) sent = navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
       } catch (e) { sent = false; }
       if (!sent && window.fetch) {
-        window.fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
+        window.fetch(endpoint, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
           .catch(function () { return null; });
       }
     };
+    var send = function (extra) {
+      var payload = {
+        site_key: siteKey, visitor_id: visitor(),
+        landing_url: (url.origin + url.pathname).slice(0, 2000),
+        referrer: (document.referrer || '').slice(0, 2000),
+      };
+      Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });
+      post(ENDPOINT, payload);
+    };
     var isNewVisit = visit();
+    // ⚠️ v2.2.203 ページの閲覧はすべて送る（広告・自然検索・回遊とも。MA と PV・ページ遷移のため）。⚠️ ? 以降は送らない
+    var here = (url.origin + url.pathname).slice(0, 2000);
+    post(PV_ENDPOINT, {
+      site_key: siteKey, visitor_id: visitor(), visit_id: store.getItem('khg_sid'),
+      url: here, title: (document.title || '').slice(0, 255), prev: store.getItem('khg_prev') || '',
+    });
+    store.setItem('khg_prev', here);
     var params = {};
     var found = false;
     KEYS.forEach(function (k) {
diff --git a/backend-express/src/config/env.ts b/backend-express/src/config/env.ts
index ae6bdc25..2941556f 100644
--- a/backend-express/src/config/env.ts
+++ b/backend-express/src/config/env.ts
@@ -57,6 +57,21 @@ export const env = {
    */
   trackingIpSalt: (process.env.TRACKING_IP_SALT ?? '').trim(),
 
+  /**
+   * Meta 広告（自社）の成果の取り込み（v2.2.203。features/metaAds/）。
+   * ⚠️ トークンは .env にのみ書く（開発は backend-express/.env.local、本番は .env.prod）。⚠️ 画面・ログに出さない。
+   * ⚠️ META_AD_ACCOUNTS は「ブランドキー:ID」をカンマでつなぐ（例 kh:120202114039520198,djh:120242527269730489）。
+   *   ID はキャンペーンID でも広告アカウント（act_…）でもよい。⚠️ ブランドキーは tracking_sites.brand と同じ。
+   * ⚠️ どちらかが空なら取り込みをしない（起動は止めない）。
+   */
+  metaAccessToken: (process.env.META_ACCESS_TOKEN ?? '').trim(),
+  metaAdAccounts: (process.env.META_AD_ACCOUNTS ?? '')
+    .split(',')
+    .map((pair) => pair.trim())
+    .filter((pair) => pair.includes(':'))
+    .map((pair) => ({ brand: pair.slice(0, pair.indexOf(':')).trim(), id: pair.slice(pair.indexOf(':') + 1).trim() }))
+    .filter((a) => a.brand !== '' && /^(act_)?\d+$/.test(a.id)),
+
   /** リクエストボディの上限。PDF等のアップロードを見込んで少し大きめ */
   bodyLimit: process.env.BODY_LIMIT ?? '10mb',
 
diff --git a/backend-express/src/features/metaAds/importer.ts b/backend-express/src/features/metaAds/importer.ts
new file mode 100644
index 00000000..cdb56061
--- /dev/null
+++ b/backend-express/src/features/metaAds/importer.ts
@@ -0,0 +1,155 @@
+import { env } from '../../config/env';
+import { execute, type SqlParam } from '../../db/pool';
+import { logger } from '../../utils/logger';
+
+/**
+ * Meta 広告（自社）の一覧と日別の数字の取り込み（v2.2.203）。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️ .env の META_ACCESS_TOKEN と META_AD_ACCOUNTS（ブランド:キャンペーンID）を使う（config/env.ts）。
+ * ⚠️ 取り込むもの
+ *   - meta_ad_items：{ID}/ads の広告ID・広告名・広告セット・キャンペーン・配信状態・画像（取り込むたびに上書き）
+ *   - meta_ad_daily：{ID}/insights（level=ad・1日ごと）の直近 DAYS 日の表示回数・リンクのクリック・費用
+ *     ⚠️ Meta は数日あとまで数字を直すので、毎回 DAYS 日分を上書きする。
+ * ⚠️⚠️ トークンはヘッダー（Authorization: Bearer）で送る。⚠️ URL・ログ・エラーの文面に出さない（mask）。
+ *   ⚠️ 続きのページは paging.cursors.after で自分で URL を作る（paging.next はトークン入りの URL なので使わない）。
+ * ⚠️ 2つ同時には動かさない（running）。⚠️ 自動（scheduler.ts）と画面のボタン（meta_ads_import）の両方から呼ばれる。
+ * ─────────────────────────────────────────────
+ */
+
+const GRAPH = 'https://graph.facebook.com/v24.0';
+export const META_IMPORT_DAYS = 35;
+const PAGE_LIMIT = 200;
+/** 1つの ID で読むページの上限（⚠️ 無限に続かないための安全装置） */
+const MAX_PAGES = 50;
+/** 1回の INSERT にまとめる行数（⚠️ 本番の DB は SSH トンネルの先。1行ずつだと遅い：2026-10-21 ローカルで 2,331 件＋13,218 行に 5 分半） */
+const BATCH = 500;
+
+/** まとめて INSERT … ON DUPLICATE KEY UPDATE（⚠️ updates は VALUES() で上書きする列） */
+const upsert = async (table: string, columns: string[], updates: string[], rows: SqlParam[][]): Promise<void> => {
+  for (let i = 0; i < rows.length; i += BATCH) {
+    const part = rows.slice(i, i + BATCH);
+    const one = `(${columns.map(() => '?').join(', ')})`;
+    await execute(
+      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${part.map(() => one).join(', ')}
+       ON DUPLICATE KEY UPDATE ${updates.map((c) => `${c} = VALUES(${c})`).join(', ')}`,
+      part.flat()
+    );
+  }
+};
+
+export const isMetaConfigured = (): boolean => env.metaAccessToken !== '' && env.metaAdAccounts.length > 0;
+
+const mask = (text: string): string => (env.metaAccessToken ? text.split(env.metaAccessToken).join('***') : text);
+
+interface Paged<T> {
+  data?: T[];
+  paging?: { cursors?: { after?: string }; next?: string };
+  error?: { message?: string; code?: number };
+}
+
+/** 1ページずつ読み、すべての data をつなげて返す */
+const fetchAll = async <T>(path: string, params: Record<string, string>): Promise<T[]> => {
+  const rows: T[] = [];
+  let after = '';
+  for (let page = 0; page < MAX_PAGES; page++) {
+    const url = new URL(`${GRAPH}/${path}`);
+    for (const [k, v] of Object.entries({ ...params, limit: String(PAGE_LIMIT) })) url.searchParams.set(k, v);
+    if (after !== '') url.searchParams.set('after', after);
+    const response = await fetch(url, { headers: { Authorization: `Bearer ${env.metaAccessToken}` } });
+    const body = (await response.json()) as Paged<T>;
+    if (!response.ok || body.error) {
+      throw new Error(`Meta API ${response.status} ${path.split('/').pop()}: ${mask(body.error?.message ?? 'エラー')}`);
+    }
+    rows.push(...(body.data ?? []));
+    after = body.paging?.next ? body.paging.cursors?.after ?? '' : '';
+    if (after === '') return rows;
+  }
+  logger.warn(`metaAds: ${path} のページが ${MAX_PAGES} を超えたため途中で止めました`);
+  return rows;
+};
+
+interface AdNode {
+  id: string;
+  name?: string;
+  effective_status?: string;
+  campaign?: { id?: string; name?: string };
+  adset?: { id?: string; name?: string };
+  creative?: { thumbnail_url?: string; image_url?: string };
+}
+
+interface InsightRow {
+  ad_id?: string;
+  date_start?: string;
+  impressions?: string;
+  inline_link_clicks?: string;
+  spend?: string;
+}
+
+/** 日本時間の YYYY-MM-DD（⚠️ コンテナの TZ に頼らない） */
+const jstDay = (offsetDays: number): string =>
+  new Date(Date.now() + 9 * 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);
+
+const nowSql = (): string => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
+
+export interface MetaImportResult {
+  ok: boolean;
+  ads: number;
+  days: number;
+  errors: string[];
+  startedAt: string;
+  finishedAt: string;
+}
+
+let running: Promise<MetaImportResult> | null = null;
+
+const runImport = async (): Promise<MetaImportResult> => {
+  const startedAt = nowSql();
+  const result: MetaImportResult = { ok: true, ads: 0, days: 0, errors: [], startedAt, finishedAt: startedAt };
+  const since = jstDay(META_IMPORT_DAYS - 1);
+  const until = jstDay(0);
+
+  for (const { brand, id } of env.metaAdAccounts) {
+    try {
+      const ads = await fetchAll<AdNode>(`${id}/ads`, {
+        fields: 'id,name,effective_status,campaign{id,name},adset{id,name},creative{thumbnail_url,image_url}',
+      });
+      const importedAt = nowSql();
+      const itemColumns = ['ad_id', 'brand', 'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_name', 'status', 'thumbnail_url', 'image_url', 'imported_at'];
+      await upsert('meta_ad_items', itemColumns, itemColumns.slice(1), ads.map((ad) => [
+        ad.id, brand, ad.campaign?.id ?? '', (ad.campaign?.name ?? '').slice(0, 255), ad.adset?.id ?? '', (ad.adset?.name ?? '').slice(0, 255),
+        (ad.name ?? '').slice(0, 255), (ad.effective_status ?? '').slice(0, 40), ad.creative?.thumbnail_url ?? null, ad.creative?.image_url ?? null, importedAt,
+      ]));
+      result.ads += ads.length;
+
+      const insights = await fetchAll<InsightRow>(`${id}/insights`, {
+        level: 'ad',
+        time_increment: '1',
+        time_range: JSON.stringify({ since, until }),
+        fields: 'ad_id,impressions,inline_link_clicks,spend',
+      });
+      await upsert('meta_ad_daily', ['ad_id', 'day', 'impressions', 'clicks', 'spend', 'imported_at'], ['impressions', 'clicks', 'spend', 'imported_at'],
+        insights.filter((row) => row.ad_id && row.date_start).map((row) => [
+          row.ad_id, row.date_start, Number(row.impressions ?? 0), Number(row.inline_link_clicks ?? 0), Number(row.spend ?? 0), importedAt,
+        ]));
+      result.days += insights.length;
+    } catch (error) {
+      result.ok = false;
+      result.errors.push(`${brand}: ${mask((error as Error).message)}`);
+    }
+  }
+
+  result.finishedAt = nowSql();
+  const summary = `metaAds: 取り込み ${result.ok ? '完了' : '一部失敗'}（広告 ${result.ads} 件・日別 ${result.days} 行・${since}〜${until}）`;
+  if (result.ok) logger.info(summary);
+  else logger.error(`${summary} ${result.errors.join(' / ')}`);
+  return result;
+};
+
+/** 取り込む。⚠️ 動いている最中に呼ばれたら、その結果を待って返す（2つ同時には動かさない） */
+export const importMetaAds = (): Promise<MetaImportResult> => {
+  if (running === null) {
+    running = runImport().finally(() => { running = null; });
+  }
+  return running;
+};
diff --git a/backend-express/src/features/metaAds/scheduler.ts b/backend-express/src/features/metaAds/scheduler.ts
new file mode 100644
index 00000000..b0ead48c
--- /dev/null
+++ b/backend-express/src/features/metaAds/scheduler.ts
@@ -0,0 +1,23 @@
+import { logger } from '../../utils/logger';
+import { importMetaAds, isMetaConfigured } from './importer';
+
+/**
+ * Meta 広告の自動取り込み（v2.2.203）。② の起動から少し待って1回、その後 INTERVAL ごとに取り込み続ける。
+ * ⚠️ cron の設定は要らない。⚠️ ② を再起動すると、起動のたびに1回取り込む。
+ * ⚠️ .env の META_ACCESS_TOKEN・META_AD_ACCOUNTS が無ければ何もしない。
+ */
+const FIRST_DELAY_MS = 60_000;
+const INTERVAL_MS = 6 * 60 * 60 * 1000;
+
+export const startMetaAdsScheduler = (): void => {
+  if (!isMetaConfigured()) {
+    logger.info('metaAds: META_ACCESS_TOKEN / META_AD_ACCOUNTS が無いため、自動取り込みはしません');
+    return;
+  }
+  const run = (): void => {
+    importMetaAds().catch((error: unknown) => logger.error('metaAds: 自動取り込みに失敗しました', error));
+  };
+  setTimeout(run, FIRST_DELAY_MS).unref();
+  setInterval(run, INTERVAL_MS).unref();
+  logger.info('metaAds: 自動取り込みを始めます（起動の1分後と、その後6時間ごと）');
+};
diff --git a/backend-express/src/features/tracking/conversions.ts b/backend-express/src/features/tracking/conversions.ts
index b213fa90..920951ad 100644
--- a/backend-express/src/features/tracking/conversions.ts
+++ b/backend-express/src/features/tracking/conversions.ts
@@ -29,12 +29,19 @@ interface TouchRow extends RowDataPacket {
   created_at: string;
   landing_url: string | null;
   source: string | null;
+  utm_content: string | null;
+  utm_campaign: string | null;
 }
 
 export interface Conversion {
   inquiryId: number;
+  /** 反響の日（YYYY-MM-DD） */
+  inquiryDay: string;
   landingUrl: string;
   source: string;
+  /** v2.2.203 最後の訪問の utm_content（Meta 広告なら広告ID）・utm_campaign */
+  adId: string;
+  campaign: string;
 }
 
 /** サイトID → そのサイトの CV（反響1件につき、最後の訪問1つ） */
@@ -55,7 +62,7 @@ export const attributeConversions = async (siteId?: number): Promise<Map<number,
   for (let i = 0; i < vids.length; i += CHUNK) {
     const part = vids.slice(i, i + CHUNK);
     const rows = await query<TouchRow>(
-      `SELECT t.site_id, t.visitor_id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, t.landing_url, t.source
+      `SELECT t.site_id, t.visitor_id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, t.landing_url, t.source, t.utm_content, t.utm_campaign
          FROM tracking_touches t
         WHERE t.visitor_id IN (${part.map(() => '?').join(', ')})${siteId === undefined ? '' : ' AND t.site_id = ?'}
         ORDER BY t.created_at, t.id`,
@@ -77,7 +84,10 @@ export const attributeConversions = async (siteId?: number): Promise<Map<number,
     }
     for (const [site, touch] of lastBySite) {
       const list = result.get(site) ?? [];
-      list.push({ inquiryId: Number(inquiry.id), landingUrl: touch.landing_url ?? '', source: touch.source ?? '' });
+      list.push({
+        inquiryId: Number(inquiry.id), inquiryDay: inquiry.inquiry_day ?? '', landingUrl: touch.landing_url ?? '', source: touch.source ?? '',
+        adId: touch.utm_content ?? '', campaign: touch.utm_campaign ?? '',
+      });
       result.set(site, list);
     }
   }
diff --git a/backend-express/src/features/tracking/detail.ts b/backend-express/src/features/tracking/detail.ts
new file mode 100644
index 00000000..d10b4099
--- /dev/null
+++ b/backend-express/src/features/tracking/detail.ts
@@ -0,0 +1,290 @@
+import type { RowDataPacket } from 'mysql2/promise';
+import { query } from '../../db/pool';
+import type { AuthenticatedStaff } from '../../types/staff';
+import { isMetaConfigured } from '../metaAds/importer';
+import { attributeConversions, DAYS, type Conversion } from './conversions';
+import { AD_TOUCH_SQL } from './params';
+import { canManageTracking, type TrackingResult } from './sites';
+
+/**
+ * アクセス解析の詳細（v2.2.203。request tracking_detail）。画面は header/TrackingDetail.tsx（サマリーの着地ページ・流入元を押すと開くモーダル）。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️ 期間は直近30日（DAYS）。⚠️ 対象はサイト1つの、着地ページ1つ（axis=landing）か流入元1つ（axis=source）。
+ * ⚠️ PV は tracking_touches の行数（30分以内のページの移動はまとめて1件。ページの閲覧回数そのものではない）。
+ * ⚠️ CV の数え方は conversions.ts（問い合わせの日までの最後の訪問の着地ページ・流入元・広告に1件）。
+ * ⚠️ CV の一覧は個人情報を出さない（日付・反響媒体・キャンペーン・店舗だけ。2026-10-21 の決定）。
+ * ⚠️ Meta 広告の数字（表示回数・クリック・費用）は meta_ad_items / meta_ad_daily（features/metaAds/ が取り込む）。
+ *   ⚠️ 広告ID は着地の utm_content（Meta の URL パラメータ {{ad.id}}）でつなぐ。
+ *   ⚠️ 着地ページ：そのページに着地した広告だけ。⚠️ 流入元が Meta のとき：そのサイトのブランドで費用・表示のある広告も全部出す。
+ * ⚠️ 着地ページのときは、ページの閲覧（tracking_pageviews。v2.2.203〜記録）から、本当の閲覧回数と前後のページも出す（loadPageFlow）。
+ * ─────────────────────────────────────────────
+ */
+
+/** Meta 広告の流入元（utm_source の書き方の揺れ・fbclid だけのとき） */
+export const META_SOURCE_PATTERN = /^(meta|fb|ig|facebook|instagram|facebook\/instagram)$/i;
+/** 1回に読む行の上限（⚠️ 画面が固まらないための安全装置） */
+const ROW_LIMIT = 50_000;
+
+interface TouchRow extends RowDataPacket {
+  visitor_id: string;
+  day: string;
+  hour: number;
+  landing_url: string | null;
+  source: string | null;
+  utm_campaign: string | null;
+  utm_content: string | null;
+  user_agent: string | null;
+  is_ad: number;
+}
+
+interface Bucket { key: string; visits: number; ad: number; cv: number }
+
+/** ブラウザの情報から端末の種類 */
+export const deviceOf = (ua: string | null): string => {
+  if (!ua) return '不明';
+  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'タブレット';
+  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'スマホ';
+  return 'PC';
+};
+
+const bucketize = (keys: string[], adFlags: boolean[], cvKeys: string[], fold: boolean): Bucket[] => {
+  const norm = (k: string): string => (fold ? k.toLowerCase() : k);
+  const map = new Map<string, Bucket>();
+  keys.forEach((k, i) => {
+    const b = map.get(norm(k)) ?? { key: k, visits: 0, ad: 0, cv: 0 };
+    b.visits += 1;
+    if (adFlags[i]) b.ad += 1;
+    map.set(norm(k), b);
+  });
+  for (const k of cvKeys) {
+    const b = map.get(norm(k)) ?? { key: k, visits: 0, ad: 0, cv: 0 };
+    b.cv += 1;
+    map.set(norm(k), b);
+  }
+  return [...map.values()].sort((a, b) => b.visits - a.visits || b.cv - a.cv);
+};
+
+interface MetaAdRow extends RowDataPacket {
+  ad_id: string;
+  ad_name: string;
+  campaign_name: string;
+  adset_name: string;
+  status: string;
+  thumbnail_url: string | null;
+  impressions: number | null;
+  clicks: number | null;
+  spend: number | null;
+}
+
+/** Meta 広告の数字（直近 DAYS 日）。⚠️ 表がまだ無い（① に SQL を流す前）なら null */
+const loadMetaAds = async (adIds: string[], brand: string | null): Promise<MetaAdRow[] | null> => {
+  const ids = adIds.filter((id) => /^\d+$/.test(id));
+  if (ids.length === 0 && brand === null) return [];
+  const where = [
+    ...(ids.length > 0 ? [`i.ad_id IN (${ids.map(() => '?').join(', ')})`] : []),
+    ...(brand !== null ? ['(i.brand = ? AND d.ad_id IS NOT NULL)'] : []),
+  ].join(' OR ');
+  try {
+    return await query<MetaAdRow>(
+      `SELECT i.ad_id, i.ad_name, i.campaign_name, i.adset_name, i.status, i.thumbnail_url,
+              SUM(d.impressions) AS impressions, SUM(d.clicks) AS clicks, SUM(d.spend) AS spend
+         FROM meta_ad_items i
+         LEFT JOIN meta_ad_daily d ON d.ad_id = i.ad_id AND d.day >= CURDATE() - INTERVAL ${DAYS} DAY
+        WHERE ${where}
+        GROUP BY i.ad_id, i.ad_name, i.campaign_name, i.adset_name, i.status, i.thumbnail_url`,
+      [...ids, ...(brand !== null ? [brand] : [])]
+    );
+  } catch {
+    return null;
+  }
+};
+
+interface FlowRow extends RowDataPacket {
+  url: string | null;
+  views: number;
+}
+
+/**
+ * ページの前後（v2.2.203）。⚠️ 表がまだ無い（① に SQL を流す前）なら null。
+ *   views：このページが見られた回数 ／ next：このページの次に見られたページ ／ prev：このページの前に見ていたページ（NULL＝訪問の最初のページ）
+ */
+const loadPageFlow = async (siteId: number, url: string): Promise<{ views: number; visitors: number; next: FlowRow[]; prev: FlowRow[] } | null> => {
+  const since = `created_at >= NOW() - INTERVAL ${DAYS} DAY`;
+  try {
+    const [total, next, prev] = await Promise.all([
+      query<RowDataPacket & { views: number; visitors: number }>(
+        `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors FROM tracking_pageviews WHERE site_id = ? AND url = ? AND ${since}`, [siteId, url]),
+      query<FlowRow>(
+        `SELECT url, COUNT(*) AS views FROM tracking_pageviews WHERE site_id = ? AND prev_url = ? AND url <> prev_url AND ${since} GROUP BY url ORDER BY views DESC LIMIT 20`, [siteId, url]),
+      query<FlowRow>(
+        `SELECT prev_url AS url, COUNT(*) AS views FROM tracking_pageviews WHERE site_id = ? AND url = ? AND (prev_url IS NULL OR prev_url <> url) AND ${since} GROUP BY prev_url ORDER BY views DESC LIMIT 20`, [siteId, url]),
+    ]);
+    return { views: Number(total[0]?.views ?? 0), visitors: Number(total[0]?.visitors ?? 0), next, prev };
+  } catch {
+    return null;
+  }
+};
+
+interface InquiryRow extends RowDataPacket {
+  id: number;
+  medium: string | null;
+  response_medium: string | null;
+  hp_campaign: string | null;
+  shop: string | null;
+}
+
+export const trackingDetail = async (
+  staff: AuthenticatedStaff | null,
+  input: { siteId: unknown; axis: unknown; key: unknown }
+): Promise<TrackingResult> => {
+  const fail = (httpStatus: number, message: string): TrackingResult => ({ httpStatus, body: { status: 'error', message } });
+  if (!canManageTracking(staff)) return fail(403, 'この画面は管理者だけが使えます。');
+  const siteId = Number(input.siteId);
+  if (!Number.isInteger(siteId) || siteId <= 0) return fail(400, 'サイトが指定されていません。');
+  const axis = input.axis === 'source' ? 'source' : input.axis === 'landing' ? 'landing' : null;
+  if (axis === null) return fail(400, '着地ページか流入元を指定してください。');
+  const key = typeof input.key === 'string' ? input.key.slice(0, 2000) : '';
+
+  const sites = await query<RowDataPacket & { brand: string | null }>('SELECT brand FROM tracking_sites WHERE id = ? LIMIT 1', [siteId]);
+  if (sites.length === 0) return fail(404, 'サイトが見つかりません。一覧を開き直してください。');
+
+  const column = axis === 'landing' ? 'landing_url' : 'source';
+  // ⚠️ 流入元は大文字・小文字を区別しない（照合順序が _ci なので = でよい）。⚠️ 空は NULL も含める
+  const filter = key === '' ? `(t.${column} IS NULL OR t.${column} = '')` : `t.${column} = ?`;
+  const rows = await query<TouchRow>(
+    `SELECT t.visitor_id, DATE_FORMAT(t.created_at, '%Y-%m-%d') AS day, HOUR(t.created_at) AS hour,
+            t.landing_url, t.source, t.utm_campaign, t.utm_content, t.user_agent, ${AD_TOUCH_SQL} AS is_ad
+       FROM tracking_touches t
+      WHERE t.site_id = ? AND t.created_at >= NOW() - INTERVAL ${DAYS} DAY AND ${filter}
+      ORDER BY t.created_at
+      LIMIT ${ROW_LIMIT}`,
+    key === '' ? [siteId] : [siteId, key]
+  );
+
+  const match = (c: Conversion): boolean => {
+    const value = axis === 'landing' ? c.landingUrl : c.source;
+    return axis === 'landing' ? value === key : value.toLowerCase() === key.toLowerCase();
+  };
+  const cv = ((await attributeConversions(siteId)).get(siteId) ?? []).filter(match);
+
+  // 上の数字
+  const perVisitor = new Map<string, number>();
+  for (const r of rows) perVisitor.set(r.visitor_id, (perVisitor.get(r.visitor_id) ?? 0) + 1);
+  const adFlags = rows.map((r) => Number(r.is_ad) === 1);
+
+  // 日別（⚠️ 来訪の無い日も 0 で並べる。日本時間）
+  const daily: { day: string; visits: number; cv: number }[] = [];
+  for (let i = DAYS - 1; i >= 0; i--) daily.push({ day: new Date(Date.now() + 9 * 3600_000 - i * 86_400_000).toISOString().slice(0, 10), visits: 0, cv: 0 });
+  const dayIndex = new Map(daily.map((d, i) => [d.day, i]));
+  for (const r of rows) { const i = dayIndex.get(r.day); if (i !== undefined) daily[i].visits += 1; }
+  for (const c of cv) { const i = dayIndex.get(c.inquiryDay); if (i !== undefined) daily[i].cv += 1; }
+
+  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, visits: 0 }));
+  for (const r of rows) hours[Number(r.hour)].visits += 1;
+
+  const breakdown = axis === 'landing'
+    ? bucketize(rows.map((r) => r.source ?? ''), adFlags, cv.map((c) => c.source), true)
+    : bucketize(rows.map((r) => r.landing_url ?? ''), adFlags, cv.map((c) => c.landingUrl), false);
+  const devices = bucketize(rows.map((r) => deviceOf(r.user_agent)), adFlags, [], false);
+
+  // 広告別（utm_content。⚠️ キャンペーン名は一番多く出た utm_campaign）
+  const adMap = new Map<string, { adId: string; campaign: string; visits: number; cv: number; campaigns: Map<string, number> }>();
+  for (const r of rows) {
+    const id = r.utm_content ?? '';
+    if (id === '') continue;
+    const a = adMap.get(id) ?? { adId: id, campaign: '', visits: 0, cv: 0, campaigns: new Map<string, number>() };
+    a.visits += 1;
+    const c = r.utm_campaign ?? '';
+    a.campaigns.set(c, (a.campaigns.get(c) ?? 0) + 1);
+    adMap.set(id, a);
+  }
+  for (const c of cv) {
+    if (c.adId === '') continue;
+    const a = adMap.get(c.adId) ?? { adId: c.adId, campaign: c.campaign, visits: 0, cv: 0, campaigns: new Map<string, number>() };
+    a.cv += 1;
+    adMap.set(c.adId, a);
+  }
+  for (const a of adMap.values()) a.campaign = [...a.campaigns.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? a.campaign;
+
+  // Meta 広告の数字
+  const isMetaSource = axis === 'source' && META_SOURCE_PATTERN.test(key);
+  const brand = sites[0].brand;
+  const metaRows = await loadMetaAds([...adMap.keys()], isMetaSource && brand ? brand : null);
+  const metaById = new Map((metaRows ?? []).map((m) => [m.ad_id, m]));
+  const ads = [...new Set([...adMap.keys(), ...metaById.keys()])].map((id) => {
+    const a = adMap.get(id);
+    const m = metaById.get(id);
+    return {
+      adId: id,
+      name: m?.ad_name ?? '',
+      campaign: m?.campaign_name || a?.campaign || '',
+      adset: m?.adset_name ?? '',
+      status: m?.status ?? '',
+      thumbnail: m?.thumbnail_url ?? '',
+      meta: m !== undefined,
+      impressions: Number(m?.impressions ?? 0),
+      clicks: Number(m?.clicks ?? 0),
+      spend: Number(m?.spend ?? 0),
+      landings: a?.visits ?? 0,
+      cv: a?.cv ?? 0,
+    };
+  }).sort((x, y) => y.spend - x.spend || y.landings - x.landings);
+
+  const flow = axis === 'landing' && key !== '' ? await loadPageFlow(siteId, key) : null;
+
+  // CV の一覧（⚠️ 個人情報は出さない）
+  const inquiries = cv.length === 0 ? [] : await query<InquiryRow>(
+    `SELECT id, medium, response_medium, hp_campaign, shop FROM inquiry_customer WHERE id IN (${cv.map(() => '?').join(', ')})`,
+    cv.map((c) => c.inquiryId)
+  );
+  const inquiryById = new Map(inquiries.map((r) => [Number(r.id), r]));
+  const cvList = cv.map((c) => {
+    const r = inquiryById.get(c.inquiryId);
+    return {
+      day: c.inquiryDay,
+      medium: r?.response_medium || r?.medium || '',
+      campaign: r?.hp_campaign ?? '',
+      shop: r?.shop ?? '',
+      source: c.source,
+      landingUrl: c.landingUrl,
+      adId: c.adId,
+    };
+  }).sort((x, y) => y.day.localeCompare(x.day));
+
+  return {
+    httpStatus: 200,
+    body: {
+      status: 'ok',
+      siteId,
+      axis,
+      key,
+      days: DAYS,
+      truncated: rows.length >= ROW_LIMIT,
+      kpi: {
+        visits: rows.length,
+        ad: adFlags.filter(Boolean).length,
+        visitors: perVisitor.size,
+        repeaters: [...perVisitor.values()].filter((n) => n >= 2).length,
+        cv: cv.length,
+      },
+      daily,
+      hours,
+      breakdown,
+      devices,
+      ads,
+      cvList,
+      pageFlow: flow === null ? null : {
+        views: flow.views,
+        visitors: flow.visitors,
+        next: flow.next.map((r) => ({ url: r.url ?? '', views: Number(r.views) })),
+        prev: flow.prev.map((r) => ({ url: r.url ?? '', views: Number(r.views) })),
+      },
+      meta: {
+        configured: isMetaConfigured(),
+        ready: metaRows !== null,
+        isMetaSource,
+      },
+    },
+  };
+};
diff --git a/backend-express/src/features/tracking/maintenance.ts b/backend-express/src/features/tracking/maintenance.ts
new file mode 100644
index 00000000..b38db42e
--- /dev/null
+++ b/backend-express/src/features/tracking/maintenance.ts
@@ -0,0 +1,73 @@
+import type { RowDataPacket } from 'mysql2/promise';
+import { execute, query } from '../../db/pool';
+import { logger } from '../../utils/logger';
+
+/**
+ * アクセス解析の表の整理（v2.2.203）。② の起動から少し待って1回、その後6時間ごと（startTrackingMaintenance）。
+ *
+ * ─────────────────────────────────────────────
+ * 1. 消さない顧客ID（tracking_keep_visitors）を足す
+ *    - cv：反響（inquiry_customer.landing_params）に khg_vid がある人
+ *    - master：有効名簿（master_data.landing_params）に khg_vid がある人（MA 用。2026-10-21 の指示）
+ * 2. tracking_pageviews が PAGEVIEW_CAP 行を超えていたら、新しい PAGEVIEW_CAP 行より古い行のうち、
+ *    消さない顧客ID に無い人の行を消す（⚠️ 一度に DELETE_CHUNK 行ずつ。DB を長く止めないため）
+ * ⚠️ 消さない人の行は上限に関係なく残る。⚠️ 増えすぎていないかは手順書の確認の SQL で見る。
+ * ⚠️ tracking_touches（訪問）は消さない（行数が少ないため）。
+ * ─────────────────────────────────────────────
+ */
+
+export const PAGEVIEW_CAP = 500_000;
+const DELETE_CHUNK = 10_000;
+const FIRST_DELAY_MS = 90_000;
+const INTERVAL_MS = 6 * 60 * 60 * 1000;
+
+/** landing_params から khg_vid（36文字）を取り出す SQL の式 */
+const VID_SQL = "LOWER(SUBSTRING(landing_params, LOCATE('khg_vid=', landing_params) + 8, 36))";
+const UUID_SQL = "'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'";
+
+export interface MaintenanceResult {
+  kept: number;
+  deleted: number;
+}
+
+/** ⚠️ cap は確かめるときだけ小さくして渡す（ふだんは PAGEVIEW_CAP） */
+export const runTrackingMaintenance = async (cap: number = PAGEVIEW_CAP): Promise<MaintenanceResult> => {
+  let kept = 0;
+  for (const [table, reason] of [['inquiry_customer', 'cv'], ['master_data', 'master']] as const) {
+    const result = await execute(
+      `INSERT IGNORE INTO tracking_keep_visitors (visitor_id, reason)
+       SELECT DISTINCT CONVERT(${VID_SQL} USING utf8mb4), '${reason}'
+         FROM ${table}
+        WHERE landing_params LIKE '%khg_vid=%' AND ${VID_SQL} REGEXP ${UUID_SQL}`
+    );
+    kept += result.affectedRows;
+  }
+
+  let deleted = 0;
+  const cutoff = await query<RowDataPacket & { id: number }>(
+    `SELECT id FROM tracking_pageviews ORDER BY id DESC LIMIT 1 OFFSET ${Math.max(0, Math.floor(cap))}`
+  );
+  if (cutoff.length > 0) {
+    const cutoffId = Number(cutoff[0].id);
+    for (;;) {
+      const result = await execute(
+        `DELETE FROM tracking_pageviews
+          WHERE id <= ? AND visitor_id NOT IN (SELECT visitor_id FROM tracking_keep_visitors)
+          LIMIT ${DELETE_CHUNK}`,
+        [cutoffId]
+      );
+      deleted += result.affectedRows;
+      if (result.affectedRows < DELETE_CHUNK) break;
+    }
+  }
+  logger.info(`tracking: 整理しました（消さない顧客ID を ${kept} 人追加・閲覧 ${deleted} 行を削除）`);
+  return { kept, deleted };
+};
+
+export const startTrackingMaintenance = (): void => {
+  const run = (): void => {
+    runTrackingMaintenance().catch((error: unknown) => logger.error('tracking: 整理に失敗しました', error));
+  };
+  setTimeout(run, FIRST_DELAY_MS).unref();
+  setInterval(run, INTERVAL_MS).unref();
+};
diff --git a/backend-express/src/features/tracking/pageview.ts b/backend-express/src/features/tracking/pageview.ts
new file mode 100644
index 00000000..4009d956
--- /dev/null
+++ b/backend-express/src/features/tracking/pageview.ts
@@ -0,0 +1,65 @@
+import { execute } from '../../db/pool';
+import { logger } from '../../utils/logger';
+import { BOT_UA_PATTERN, UUID_PATTERN } from './params';
+import { findTrackingSite, normalizeOrigin } from './touch';
+
+/**
+ * ページの閲覧の受け付け（v2.2.203。`POST /api/track/pv`。⚠️ 公開・認証なし）。tracker.js がページを開くたびに送る。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️⚠️ **社外の誰でも叩ける書き込み口。リクエストの値を信用しない。**（touch.ts と同じ考え方）
+ *   ⚠️ 保存するのは、登録済み・有効なサイトの・許可したオリジンからの・UUID の顧客ID と訪問ID の、
+ *     そのオリジンのページ（url）だけ。⚠️ ロボットは保存しない。
+ * ⚠️ url・prev_url は ? と # 以降を落とす（個人を特定できる値がパラメータに入ることがあるため）。
+ *   ⚠️ prev_url は同じオリジンのときだけ（別のサイトから来たときは NULL）。
+ * ⚠️ 応答は成功・失敗とも 204（publicRouter.ts）。⚠️ 理由はログにだけ出す。
+ * ⚠️ 行数の整理は maintenance.ts（CV・有効名簿の人は消さない）。
+ * ─────────────────────────────────────────────
+ */
+
+/** 同じオリジンの URL なら `origin + pathname`、違えば null */
+const sameOriginPath = (value: unknown, origin: string): string | null => {
+  if (typeof value !== 'string' || value === '') return null;
+  try {
+    const u = new URL(value);
+    if (normalizeOrigin(u.origin) !== origin) return null;
+    return `${u.origin}${u.pathname}`.slice(0, 2000);
+  } catch {
+    return null;
+  }
+};
+
+export interface PageviewInput {
+  body: unknown;
+  origin: string;
+  userAgent: string;
+}
+
+/** 保存したら true。⚠️ 保存しなかった理由はログに出す */
+export const recordPageview = async ({ body, origin, userAgent }: PageviewInput): Promise<boolean> => {
+  const reject = (reason: string): false => {
+    logger.info(`track/pv: 保存しません（${reason}） origin="${origin}"`);
+    return false;
+  };
+  if (body === null || typeof body !== 'object' || Array.isArray(body)) return reject('本文が JSON ではない');
+  if (BOT_UA_PATTERN.test(userAgent)) return reject('ロボットのアクセス');
+  const b = body as Record<string, unknown>;
+  const siteKey = typeof b.site_key === 'string' ? b.site_key : '';
+  const site = await findTrackingSite(siteKey);
+  if (site === null) return reject(`サイトが無い site_key="${siteKey.slice(0, 40)}"`);
+  if (!site.active) return reject(`無効のサイト site_id=${site.id}`);
+  const normalized = normalizeOrigin(origin);
+  if (normalized === '' || !site.origins.includes(normalized)) return reject(`許可していないオリジン site_id=${site.id}`);
+  const visitorId = typeof b.visitor_id === 'string' ? b.visitor_id.toLowerCase() : '';
+  const visitId = typeof b.visit_id === 'string' ? b.visit_id.toLowerCase() : '';
+  if (!UUID_PATTERN.test(visitorId) || !UUID_PATTERN.test(visitId)) return reject('顧客ID・訪問ID が UUID ではない');
+  const url = sameOriginPath(b.url, normalized);
+  if (url === null) return reject('ページの URL がサイトのものではない');
+  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 255) : '';
+
+  await execute(
+    'INSERT INTO tracking_pageviews (site_id, visitor_id, visit_id, url, title, prev_url) VALUES (?, ?, ?, ?, ?, ?)',
+    [site.id, visitorId, visitId, url, title === '' ? null : title, sameOriginPath(b.prev, normalized)]
+  );
+  return true;
+};
diff --git a/backend-express/src/features/tracking/publicRouter.ts b/backend-express/src/features/tracking/publicRouter.ts
index e56d7e13..8d828112 100644
--- a/backend-express/src/features/tracking/publicRouter.ts
+++ b/backend-express/src/features/tracking/publicRouter.ts
@@ -3,6 +3,7 @@ import path from 'path';
 import express, { type NextFunction, type Request, type Response, Router } from 'express';
 import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
 import { logger } from '../../utils/logger';
+import { recordPageview } from './pageview';
 import { isKnownOrigin, recordTouch } from './touch';
 
 /**
@@ -10,6 +11,7 @@ import { isKnownOrigin, recordTouch } from './touch';
  *
  *   GET  /t/v1/tracker.js    … 各ブランドサイトのフッターに貼るスクリプト（public/tracker.js）
  *   POST /api/track/touch    … 着地の記録（tracker.js が sendBeacon で送る）
+ *   POST /api/track/pv       … ページの閲覧（v2.2.203。tracker.js がページを開くたびに送る。pageview.ts）
  *
  * ─────────────────────────────────────────────
  * ⚠️⚠️ **app.ts で全体の CORS より前に置くこと。**
@@ -48,6 +50,22 @@ const touchLimiter = rateLimit({
   },
 });
 
+/**
+ * ページの閲覧は同じ IP から1分に120件まで（v2.2.203）。⚠️ 着地（30件）より多い：社内の回線など、1つの IP から何人も見るため。
+ * ⚠️ 超えても 204（保存しないだけ）
+ */
+const pageviewLimiter = rateLimit({
+  windowMs: 60_000,
+  limit: 120,
+  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
+  standardHeaders: false,
+  legacyHeaders: false,
+  handler: (req: Request, res: Response) => {
+    logger.info(`track/pv: 保存しません（流量の上限） origin="${req.get('origin') ?? ''}"`);
+    res.status(204).end();
+  },
+});
+
 /** 許可したオリジンにだけ ACAO を返す。⚠️ credentials は使わない */
 const trackingCors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
   const origin = req.get('origin') ?? '';
@@ -118,5 +136,26 @@ export const createTrackingPublicRouter = (): Router => {
     res.status(204).end();
   });
 
+  // v2.2.203 ページの閲覧（⚠️ 着地と同じ CORS・応答は常に 204）
+  router.options('/api/track/pv', trackingCors);
+  router.post(
+    '/api/track/pv',
+    trackingCors,
+    pageviewLimiter,
+    express.text({ type: () => true, limit: '16kb' }),
+    async (req: Request, res: Response) => {
+      try {
+        await recordPageview({ body: readBody(req.body), origin: req.get('origin') ?? '', userAgent: req.get('user-agent') ?? '' });
+      } catch (error) {
+        logger.error(`track/pv: 保存に失敗: ${(error as Error).message}`);
+      }
+      res.status(204).end();
+    }
+  );
+  router.use('/api/track/pv', (error: Error, _req: Request, res: Response, _next: NextFunction) => {
+    logger.info(`track/pv: 保存しません（本文を読めない: ${error.message}）`);
+    res.status(204).end();
+  });
+
   return router;
 };
diff --git a/backend-express/src/features/tracking/sites.ts b/backend-express/src/features/tracking/sites.ts
index 4d9325c0..e9d6ee09 100644
--- a/backend-express/src/features/tracking/sites.ts
+++ b/backend-express/src/features/tracking/sites.ts
@@ -2,6 +2,7 @@ import { randomBytes } from 'crypto';
 import type { RowDataPacket } from 'mysql2/promise';
 import { execute, query } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
+import { isMetaConfigured } from '../metaAds/importer';
 import { attributeConversions } from './conversions';
 import { AD_TOUCH_SQL } from './params';
 import { clearTrackingSiteCache, normalizeOrigin, parseOrigins } from './touch';
@@ -51,6 +52,10 @@ const fail = (httpStatus: number, message: string): TrackingResult => ({ httpSta
 export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promise<TrackingResult> => {
   if (!canManageTracking(staff)) return fail(403, 'この画面は管理者だけが使えます。');
   const conversions = await attributeConversions();
+  // ⚠️ v2.2.203 Meta 広告の最後の取り込み（⚠️ 表がまだ無い＝① に SQL を流す前なら null）
+  const lastImport = await query<RowDataPacket & { at: string | null }>("SELECT DATE_FORMAT(MAX(imported_at), '%Y-%m-%d %H:%i') AS at FROM meta_ad_items")
+    .then((r) => r[0]?.at ?? null)
+    .catch(() => null);
   const rows = await query<SiteRow>(
     `SELECT s.id, s.site_key, s.name, s.brand, s.allowed_origins, s.is_active, s.memo, s.updated_by,
             DATE_FORMAT(s.updated_at, '%Y-%m-%d %H:%i') AS updated_at,
@@ -61,6 +66,7 @@ export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promi
   );
   return ok({
     brands: TRACKING_BRANDS,
+    meta: { configured: isMetaConfigured(), lastImportedAt: lastImport },
     sites: rows.map((r) => ({
       id: Number(r.id), siteKey: r.site_key, name: r.name, brand: r.brand ?? '', origins: parseOrigins(r.allowed_origins),
       active: Number(r.is_active) === 1, memo: r.memo, updatedBy: r.updated_by, updatedAt: r.updated_at,
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index c1d64d6b..47732776 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -12,8 +12,10 @@ import { runStaffContract, toDepartment } from '../features/staffContract';
 import { runIntroductorySummary } from '../features/introductory/summary';
 import { runDuplicateSummary } from '../features/duplicateSummary';
 import { getGuide, listGuide, saveGuide } from '../features/guide';
-import { listTrackingSites, saveTrackingSite } from '../features/tracking/sites';
+import { canManageTracking, listTrackingSites, saveTrackingSite } from '../features/tracking/sites';
 import { trackingSiteSummary } from '../features/tracking/summary';
+import { trackingDetail } from '../features/tracking/detail';
+import { importMetaAds, isMetaConfigured } from '../features/metaAds/importer';
 import { listInquiryTouches } from '../features/tracking/touches';
 import {
   runAuthAccessTimes,
@@ -839,6 +841,42 @@ register({
   },
 });
 
+register({
+  request: 'tracking_detail',
+  summary: 'アクセス解析の詳細（サイト1つの着地ページ1つ／流入元1つ。直近30日の日別・時間帯・端末・広告別・CV。Meta 広告の数字つき。Master / BrandAdmin のみ）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await trackingDetail(ctx.staff, { siteId: ctx.body.site_id, axis: ctx.body.axis, key: ctx.body.key });
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
+/**
+ * Meta 広告（自社）の取り込みを今すぐ始める（v2.2.203）。
+ * ⚠️ 取り込みは数分かかる（2026-10-21 ローカルで約4分半）。⚠️ 待たずに「始めた」と返し、画面は最後の取り込み日時で終わりを見る。
+ * ⚠️ 自動の取り込み（features/metaAds/scheduler.ts）と重なっても、2つ同時には動かない（importer.ts）。
+ */
+register({
+  request: 'meta_ads_import',
+  summary: '【書き込み】Meta 広告（自社）の一覧と日別の数字の取り込みを始める（Master / BrandAdmin のみ。待たずに返す）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    if (!canManageTracking(ctx.staff)) {
+      ctx.res.status(403);
+      return { status: 'error', message: 'この画面は管理者だけが使えます。' };
+    }
+    if (!isMetaConfigured()) {
+      ctx.res.status(400);
+      return { status: 'error', message: 'Meta 広告のトークンが設定されていません。管理者に連絡してください。' };
+    }
+    void importMetaAds().catch(() => undefined);
+    return { status: 'ok', started: true };
+  },
+});
+
 register({
   request: 'tracking_touches',
   summary: '反響1件に結びつく広告流入の着地履歴（landing_params の khg_vid → クリックIDの順で探す）',
diff --git a/backend-express/src/server.ts b/backend-express/src/server.ts
index 9233fcf3..7da9d8f1 100644
--- a/backend-express/src/server.ts
+++ b/backend-express/src/server.ts
@@ -1,6 +1,8 @@
 import { createApp } from './app';
 import { env } from './config/env';
 import { closePool, pingDatabase } from './db/pool';
+import { startMetaAdsScheduler } from './features/metaAds/scheduler';
+import { startTrackingMaintenance } from './features/tracking/maintenance';
 import { gatewaySummary, logGatewayRoutes } from './gateway';
 import { logger } from './utils/logger';
 
@@ -27,6 +29,11 @@ const bootstrap = async (): Promise<void> => {
     // すべて失敗するため、起動時に必ず目に入る場所へ出す
     logger.info(gatewaySummary());
     logGatewayRoutes();
+
+    // Meta 広告（自社）の成果の自動取り込み（v2.2.203。.env に無ければ何もしない）
+    startMetaAdsScheduler();
+    // アクセス解析の表の整理（v2.2.203。消さない顧客ID の追加・閲覧の古い行の削除）
+    startTrackingMaintenance();
   });
 
   // 重い集計SQLの途中で切断されないよう、既定より長めに設定する
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 3821dfb7..5065e3ba 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -668,10 +668,13 @@ function expressProxyRequests(): array
         //   ⚠️ tracking_site_save は書き込み。⚠️ Master / BrandAdmin の判定は ② が行う。
         //   ⚠️ 各サイトの tracker.js・着地の記録（/t/v1/tracker.js・/api/track/touch）は ① を通らない（② へ直接）。
         //   ⚠️ tracking_site_summary は v2.2.202 で追加（サイト名を押すと開くサマリー）。
+        //   ⚠️ tracking_detail・meta_ads_import は v2.2.203 で追加（アクセス解析のモーダル・Meta 広告の取り込み。meta_ads_import は書き込み）。
         // -----------------------------------------------------------------
         'tracking_site_list',
         'tracking_site_save',
         'tracking_site_summary',
+        'tracking_detail',
+        'meta_ads_import',
         'tracking_touches',
     ];
 }
@@ -908,10 +911,12 @@ function expressProxyExclusive(): array
         'guide_list',
         'guide_article',
         'guide_save',
-        // ⚠️ 2026-10-20 新規（v2.2.199）。広告流入トラッキング。⚠️ 理由は上と同じ（tracking_site_summary は v2.2.202）
+        // ⚠️ 2026-10-20 新規（v2.2.199）。広告流入トラッキング。⚠️ 理由は上と同じ（tracking_site_summary は v2.2.202、tracking_detail・meta_ads_import は v2.2.203）
         'tracking_site_list',
         'tracking_site_save',
         'tracking_site_summary',
+        'tracking_detail',
+        'meta_ads_import',
         'tracking_touches',
     ];
 }
diff --git a/docker-compose.prod.yml b/docker-compose.prod.yml
index 5b4b2067..70168bc2 100644
--- a/docker-compose.prod.yml
+++ b/docker-compose.prod.yml
@@ -135,6 +135,15 @@ services:
       # ⚠️ 一度決めたら変えない（変えると同じ IP でも別のハッシュになる）。
       # ⚠️ 未設定でも動く（ip_hash が NULL になるだけ）。
       - TRACKING_IP_SALT=${TRACKING_IP_SALT:-}
+
+      # Meta 広告（自社）の成果の取り込み（v2.2.203。features/metaAds/）。
+      #
+      # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
+      # ⚠️ META_ACCESS_TOKEN：システムユーザーのトークン（権限 ads_read）。
+      # ⚠️ META_AD_ACCOUNTS：「ブランドキー:キャンペーンID」をカンマでつなぐ（例 kh:120202114039520198,djh:120242527269730489）。
+      # ⚠️ どちらかが空なら取り込みをしない（起動は止まらない。アクセス解析の Meta の数字が出ないだけ）。
+      - META_ACCESS_TOKEN=${META_ACCESS_TOKEN:-}
+      - META_AD_ACCOUNTS=${META_AD_ACCOUNTS:-}
     depends_on:
       ssh-tunnel:
         condition: service_started
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index d93ac656..47d0e6d1 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -69,7 +69,7 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     '事後アンケート': { menu: '反響管理/事後アンケート' },
     '広告費シミュレーター': { menu: '反響管理/広告費シミュレーター', authority: ['Master'] },
     // ⚠️ v2.2.199（広告流入トラッキング）。Header.tsx の menuMapping と同じく Master / BrandAdmin
-    'トラッキング設定': { menu: '反響管理/トラッキング設定', authority: ADMIN },
+    'アクセス解析': { menu: '反響管理/アクセス解析', authority: ADMIN },
     '紹介キャンペーンサマリー': { menu: '紹介キャンペーン/紹介キャンペーンサマリー' },
     '紹介キャンペーンの反響一覧': { menu: '紹介キャンペーン/反響一覧' },
     '月次日報': { menu: '活動サマリー/月次日報' },
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 4c29798f..99c6a0f0 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -158,12 +158,12 @@ const Header = ({ }) => {
             ? ['店舗編集', 'スタッフ編集・追加', '権限編集', 'ローン情報更新']
             : ['店舗編集', 'スタッフ編集・追加', '権限編集'],
         // ⚠️ v2.2.193: 「重複反響サマリー」を追加（⚠️ 全員。DuplicateInquirySummary.tsx）
-        // ⚠️ v2.2.199: 「トラッキング設定」を追加（⚠️ Master / BrandAdmin。TrackingSettings.tsx。⚠️ ② の tracking_site_* でも確かめる）
+        // ⚠️ v2.2.199: 「トラッキング設定」を追加（⚠️ Master / BrandAdmin。TrackingSettings.tsx。⚠️ ② の tracking_site_* でも確かめる）。⚠️ v2.2.203 で「アクセス解析」に改名（guideScreens.ts のキー・業務ガイドの記事のタイトルも同じ名前）
         '反響管理': [
             '販促媒体設定', 'ブラックリスト設定',
             ...(authority === 'Master' ? ['広告費シミュレーター'] : []),
             '事後アンケート', '重複反響サマリー',
-            ...((authority === 'Master' || authority === 'BrandAdmin') ? ['トラッキング設定'] : []),
+            ...((authority === 'Master' || authority === 'BrandAdmin') ? ['アクセス解析'] : []),
         ],
         // ⚠️⚠️ **2026-09-22 に土地情報同期・土地情報一覧をメニューから外した**（指示）。
         //   ⚠️ ⚠️ **コンポーネント（SyncEstate / Estate）は消していない。**
@@ -221,7 +221,7 @@ const Header = ({ }) => {
         'システム管理/店舗編集': <EditShop />,
         '反響管理/ブラックリスト設定': <EditBlackList />,
         '反響管理/重複反響サマリー': <DuplicateInquirySummary />,
-        '反響管理/トラッキング設定': <TrackingSettings />,
+        '反響管理/アクセス解析': <TrackingSettings />,
         '他社動向/他社広告ライブラリ': <MetaAdsDashboard />,
         '他社動向/他社資料': <CompetitorMaterials />,
         // ⚠️ 保存済みレポートを見るだけの画面。⚠️ **Claude は呼ばない（課金なし）**
@@ -391,8 +391,8 @@ const Header = ({ }) => {
         // ⚠️ 重複反響サマリー（v2.2.193）はカード9枚をグリッドで並べる（2026-10-16 の指示で全画面）。
         //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。** コンポーネント側に作らないこと。
         '反響管理/重複反響サマリー',
-        // ⚠️ トラッキング設定（v2.2.199）は表が8列＋タグの行。⚠️ この1行で「左上の閉じるボタン」も出る。コンポーネント側に作らないこと。
-        '反響管理/トラッキング設定',
+        // ⚠️ アクセス解析（v2.2.199 トラッキング設定 → v2.2.203 改名）は表が9列＋サマリー・タグの行。⚠️ この1行で「左上の閉じるボタン」も出る。コンポーネント側に作らないこと。
+        '反響管理/アクセス解析',
     ].includes(editMenu);
 
     // 見出しには項目名だけを出す（キーの `メニュー/` は表示に使わない）
diff --git a/frontend/src/components/header/TrackingDetail.tsx b/frontend/src/components/header/TrackingDetail.tsx
new file mode 100644
index 00000000..f1c2dfd1
--- /dev/null
+++ b/frontend/src/components/header/TrackingDetail.tsx
@@ -0,0 +1,346 @@
+import React, { useEffect, useMemo, useState } from 'react';
+import { Modal } from 'react-bootstrap';
+import apiClient from '../../utils/apiClient';
+
+/**
+ * アクセス解析の詳細（v2.2.203 新規）。TrackingSettings.tsx のサマリーで、着地ページ・流入元を押すと開く（size="lg"）。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️ 開いたときに ② の tracking_detail を取りに行く（features/tracking/detail.ts）。期間は直近30日。
+ * ⚠️ PV は訪問（30分以内の移動はまとめて1件）。⚠️ 着地ページでは、ページの閲覧の記録（v2.2.203〜）から閲覧回数と前後のページも出す。
+ * ⚠️ Meta 広告の数字は ② が取り込んだもの（features/metaAds/）。⚠️ Meta のクリックとこちらの着地は一致しない。
+ * ⚠️ 広告の画像の URL は数日で期限が切れる（② が取り込むたびに新しくする）。読めないときは隠す（場所は空けておく）。
+ * ⚠️ CV の一覧は個人情報を出さない（日付・反響媒体・キャンペーン・店舗だけ）。
+ * ⚠️ アクセス解析（全画面モーダル）の上に重ねるので、後ろを暗くする幕を z-index 1055 に上げる（AmbassadorList.tsx の歩留まりと同じ）。
+ * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 td_）。
+ * ─────────────────────────────────────────────
+ */
+
+export type DetailAxis = 'landing' | 'source';
+
+interface Bucket { key: string; visits: number; ad: number; cv: number }
+interface AdRow {
+    adId: string; name: string; campaign: string; adset: string; status: string; thumbnail: string; meta: boolean;
+    impressions: number; clicks: number; spend: number; landings: number; cv: number;
+}
+interface CvRow { day: string; medium: string; campaign: string; shop: string; source: string; landingUrl: string; adId: string }
+interface Flow { url: string; views: number }
+
+interface Detail {
+    days: number;
+    truncated: boolean;
+    kpi: { visits: number; ad: number; visitors: number; repeaters: number; cv: number };
+    daily: { day: string; visits: number; cv: number }[];
+    hours: { hour: number; visits: number }[];
+    breakdown: Bucket[];
+    devices: Bucket[];
+    ads: AdRow[];
+    cvList: CvRow[];
+    pageFlow: { views: number; visitors: number; next: Flow[]; prev: Flow[] } | null;
+    meta: { configured: boolean; ready: boolean; isMetaSource: boolean };
+}
+
+const yen = (n: number): string => `${Math.round(n).toLocaleString()}円`;
+const pct = (a: number, b: number): string => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
+const readable = (url: string): string => {
+    if (url === '') return '（不明）';
+    try { return decodeURI(url.replace(/^https?:\/\//, '')); } catch { return url.replace(/^https?:\/\//, ''); }
+};
+
+type AdSortKey = 'spend' | 'impressions' | 'clicks' | 'landings' | 'cv' | 'cpa';
+
+const TrackingDetail: React.FC<{ siteId: number; axis: DetailAxis; value: string; onClose: () => void }> = ({ siteId, axis, value, onClose }) => {
+    const [data, setData] = useState<Detail | null>(null);
+    const [error, setError] = useState('');
+    const [adSort, setAdSort] = useState<AdSortKey>('spend');
+
+    useEffect(() => {
+        let alive = true;
+        setData(null);
+        setError('');
+        apiClient.post('', { request: 'tracking_detail', site_id: siteId, axis, key: value })
+            .then((response) => { if (alive) setData(response.data as Detail); })
+            .catch((e) => {
+                console.error('tracking_detail failed:', e);
+                if (alive) setError('詳細を読み込めませんでした。閉じて開き直してください。');
+            });
+        return () => { alive = false; };
+    }, [siteId, axis, value]);
+
+    const ads = useMemo(() => {
+        const list = [...(data?.ads ?? [])];
+        const cpa = (a: AdRow): number => (a.cv > 0 ? a.spend / a.cv : Number.POSITIVE_INFINITY);
+        return list.sort((a, b) => (adSort === 'cpa' ? cpa(a) - cpa(b) : b[adSort] - a[adSort]));
+    }, [data, adSort]);
+
+    const maxDaily = Math.max(1, ...(data?.daily ?? []).map((d) => d.visits));
+    const maxHour = Math.max(1, ...(data?.hours ?? []).map((h) => h.visits));
+    const showMeta = data !== null && (data.meta.isMetaSource || data.ads.some((a) => a.meta));
+    const metaTotal = ads.filter((a) => a.meta).reduce((t, a) => ({ spend: t.spend + a.spend, imp: t.imp + a.impressions, clicks: t.clicks + a.clicks, cv: t.cv + a.cv }), { spend: 0, imp: 0, clicks: 0, cv: 0 });
+
+    const AdHead = ({ label, k }: { label: string; k: AdSortKey }) => (
+        <th className="td_th td_num td_sort" onClick={() => setAdSort(k)} title="クリックで並べ替え">
+            {label}<span className={`td_sort_icon${adSort === k ? ' is_active' : ''}`}>{adSort === k ? (k === 'cpa' ? '▲' : '▼') : '⇅'}</span>
+        </th>
+    );
+
+    return (
+        <Modal show onHide={onClose} size="lg" centered scrollable backdropClassName="td_backdrop" contentClassName="td_content">
+            <style>{CSS}</style>
+            <Modal.Header closeButton className="bg-light py-2">
+                <Modal.Title className="td_title">
+                    <span className="td_axis">{axis === 'landing' ? '着地ページ' : '流入元'}</span>
+                    {axis === 'landing' ? readable(value) : value || '（不明）'}
+                    <span className="td_sub">直近{data?.days ?? 30}日</span>
+                </Modal.Title>
+            </Modal.Header>
+            <Modal.Body className="td_body">
+                {error !== '' && <div className="td_error">{error}</div>}
+                {data === null && error === '' && <div className="td_sub">読み込み中…</div>}
+                {data !== null && (
+                    <>
+                        <div className="td_kpi">
+                            <div className="td_card"><div className="td_label">PV（訪問）</div><div className="td_value">{data.kpi.visits.toLocaleString()}</div></div>
+                            {data.pageFlow && <div className="td_card"><div className="td_label">閲覧回数</div><div className="td_value">{data.pageFlow.views.toLocaleString()}</div></div>}
+                            <div className="td_card"><div className="td_label">うち広告から</div><div className="td_value">{data.kpi.ad.toLocaleString()}</div></div>
+                            <div className="td_card"><div className="td_label">訪問者</div><div className="td_value">{data.kpi.visitors.toLocaleString()}<span className="td_unit">人</span></div></div>
+                            <div className="td_card"><div className="td_label">2回以上来た人</div><div className="td_value">{data.kpi.repeaters.toLocaleString()}<span className="td_unit">人</span></div></div>
+                            <div className="td_card"><div className="td_label">CV ／ CV率</div><div className="td_value">{data.kpi.cv.toLocaleString()}<span className="td_unit"> ／ {pct(data.kpi.cv, data.kpi.visits)}</span></div></div>
+                        </div>
+                        {data.truncated && <div className="td_note">※ 件数が多いため、先頭の5万件で集計しています。</div>}
+
+                        <section className="td_section">
+                            <h6 className="td_h">日別の PV と CV</h6>
+                            <div className="td_chart" role="img" aria-label="日別の PV と CV">
+                                {data.daily.map((d) => (
+                                    <div key={d.day} className="td_bar_col" title={`${d.day}　PV ${d.visits}・CV ${d.cv}`}>
+                                        <div className="td_bar" style={{ height: `${(d.visits / maxDaily) * 100}%` }} />
+                                        {d.cv > 0 && <div className="td_cv_dot">{d.cv}</div>}
+                                    </div>
+                                ))}
+                            </div>
+                            <div className="td_axis_row"><span>{data.daily[0]?.day.slice(5)}</span><span>{data.daily[data.daily.length - 1]?.day.slice(5)}</span></div>
+                        </section>
+
+                        {data.pageFlow && (
+                            <section className="td_section">
+                                <h6 className="td_h">ページの前後（閲覧の記録から）</h6>
+                                {data.pageFlow.views === 0 ? (
+                                    <div className="td_sub">まだ閲覧の記録がありません（記録は v2.2.203 から始まりました）。</div>
+                                ) : (
+                                    <div className="td_two">
+                                        <FlowTable title="前に見ていたページ" rows={data.pageFlow.prev} emptyLabel="（訪問の最初のページ）" />
+                                        <FlowTable title="次に見たページ" rows={data.pageFlow.next} emptyLabel="（不明）" />
+                                    </div>
+                                )}
+                            </section>
+                        )}
+
+                        <section className="td_section">
+                            <h6 className="td_h">{axis === 'landing' ? '流入元別' : '着地ページ別'}</h6>
+                            <BucketTable rows={data.breakdown} label={axis === 'landing' ? '流入元' : '着地ページ'} url={axis === 'source'} />
+                        </section>
+
+                        {(showMeta || ads.length > 0) && (
+                            <section className="td_section">
+                                <h6 className="td_h">{showMeta ? 'Meta 広告' : '広告別（utm_content）'}</h6>
+                                {showMeta && !data.meta.configured && <div className="td_note">※ Meta 広告のトークンが設定されていないため、表示回数・費用はありません。</div>}
+                                {showMeta && data.meta.configured && !data.meta.ready && <div className="td_note">※ Meta 広告の表がまだありません（データベースの準備が必要です）。</div>}
+                                {showMeta && metaTotal.spend > 0 && (
+                                    <div className="td_meta_sum">
+                                        費用 <b>{yen(metaTotal.spend)}</b>・表示 <b>{metaTotal.imp.toLocaleString()}</b>・クリック <b>{metaTotal.clicks.toLocaleString()}</b>（CTR {pct(metaTotal.clicks, metaTotal.imp)}）・CV <b>{metaTotal.cv}</b>・CPA <b>{metaTotal.cv > 0 ? yen(metaTotal.spend / metaTotal.cv) : '—'}</b>
+                                    </div>
+                                )}
+                                <div className="td_table_wrap">
+                                    <table className="td_table">
+                                        <thead>
+                                            <tr>
+                                                <th className="td_th">広告</th>
+                                                <AdHead label="費用" k="spend" />
+                                                <AdHead label="表示" k="impressions" />
+                                                <AdHead label="クリック" k="clicks" />
+                                                <th className="td_th td_num">CTR</th>
+                                                <AdHead label="着地" k="landings" />
+                                                <AdHead label="CV" k="cv" />
+                                                <AdHead label="CPA" k="cpa" />
+                                            </tr>
+                                        </thead>
+                                        <tbody>
+                                            {ads.length === 0 ? (
+                                                <tr><td className="td_td td_empty" colSpan={8}>直近30日に費用・表示・着地のある広告はありません。</td></tr>
+                                            ) : ads.map((a) => (
+                                                <tr key={a.adId}>
+                                                    <td className="td_td">
+                                                        <div className="td_ad">
+                                                            {a.thumbnail ? <img className="td_thumb" src={a.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"
+                                                                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <div className="td_thumb td_thumb_none" />}
+                                                            <div>
+                                                                <div className="td_ad_name">{a.name || a.adId}</div>
+                                                                <div className="td_sub">{a.campaign}{a.adset && ` ／ ${a.adset}`}{a.status && a.status !== 'ACTIVE' && <span className="td_status">{a.status === 'PAUSED' ? '停止中' : a.status}</span>}</div>
+                                                            </div>
+                                                        </div>
+                                                    </td>
+                                                    <td className="td_td td_num">{a.meta ? yen(a.spend) : '—'}</td>
+                                                    <td className="td_td td_num">{a.meta ? a.impressions.toLocaleString() : '—'}</td>
+                                                    <td className="td_td td_num">{a.meta ? a.clicks.toLocaleString() : '—'}</td>
+                                                    <td className="td_td td_num">{a.meta ? pct(a.clicks, a.impressions) : '—'}</td>
+                                                    <td className="td_td td_num">{a.landings.toLocaleString()}</td>
+                                                    <td className="td_td td_num">{a.cv > 0 ? <b>{a.cv}</b> : 0}</td>
+                                                    <td className="td_td td_num">{a.meta && a.cv > 0 ? yen(a.spend / a.cv) : '—'}</td>
+                                                </tr>
+                                            ))}
+                                        </tbody>
+                                    </table>
+                                </div>
+                                <div className="td_note">※ 費用・表示・クリックは Meta の数字、着地・CV はサイトの記録です。広告ブロッカーや表示前の離脱があるため、クリックと着地は一致しません。</div>
+                            </section>
+                        )}
+
+                        <div className="td_two">
+                            <section className="td_section">
+                                <h6 className="td_h">端末</h6>
+                                <BucketTable rows={data.devices} label="端末" url={false} noCv />
+                            </section>
+                            <section className="td_section">
+                                <h6 className="td_h">時間帯（PV）</h6>
+                                <div className="td_hours">
+                                    {data.hours.map((h) => (
+                                        <div key={h.hour} className="td_hour" title={`${h.hour}時台　${h.visits}`}>
+                                            <div className="td_hour_bar" style={{ height: `${(h.visits / maxHour) * 100}%` }} />
+                                            <div className="td_hour_label">{h.hour % 3 === 0 ? h.hour : ''}</div>
+                                        </div>
+                                    ))}
+                                </div>
+                            </section>
+                        </div>
+
+                        <section className="td_section">
+                            <h6 className="td_h">CV になった反響（{data.cvList.length}件）</h6>
+                            {data.cvList.length === 0 ? <div className="td_sub">直近30日の CV はありません。</div> : (
+                                <div className="td_table_wrap">
+                                    <table className="td_table">
+                                        <thead><tr><th className="td_th">反響の日</th><th className="td_th">反響媒体</th><th className="td_th">キャンペーン</th><th className="td_th">店舗</th><th className="td_th">{axis === 'landing' ? '流入元' : '着地ページ'}</th></tr></thead>
+                                        <tbody>
+                                            {data.cvList.map((c, i) => (
+                                                <tr key={`${c.day}-${i}`}>
+                                                    <td className="td_td td_date">{c.day}</td>
+                                                    <td className="td_td">{c.medium || '—'}</td>
+                                                    <td className="td_td">{c.campaign || '—'}</td>
+                                                    <td className="td_td">{c.shop || '—'}</td>
+                                                    <td className="td_td td_url">{axis === 'landing' ? c.source || '（不明）' : readable(c.landingUrl)}</td>
+                                                </tr>
+                                            ))}
+                                        </tbody>
+                                    </table>
+                                </div>
+                            )}
+                        </section>
+                        <div className="td_note">※ PV は1回の訪問（30分以内のページの移動はまとめて1件）を1件と数えます。閲覧回数は、ページが開かれた回数です。CV は、問い合わせの日までの最後の訪問で数えます。</div>
+                    </>
+                )}
+            </Modal.Body>
+        </Modal>
+    );
+};
+
+const BucketTable: React.FC<{ rows: Bucket[]; label: string; url: boolean; noCv?: boolean }> = ({ rows, label, url, noCv = false }) => (
+    <div className="td_table_wrap">
+        <table className="td_table">
+            <thead>
+                <tr>
+                    <th className="td_th">{label}</th>
+                    <th className="td_th td_num">PV</th>
+                    <th className="td_th td_num">うち広告</th>
+                    {!noCv && <th className="td_th td_num">CV</th>}
+                    {!noCv && <th className="td_th td_num">CV率</th>}
+                </tr>
+            </thead>
+            <tbody>
+                {rows.length === 0 ? (
+                    <tr><td className="td_td td_empty" colSpan={noCv ? 3 : 5}>記録がありません。</td></tr>
+                ) : rows.map((r) => (
+                    <tr key={r.key}>
+                        <td className="td_td td_url" title={r.key}>
+                            {url && /^https?:\/\//.test(r.key)
+                                ? <a className="td_link" href={r.key} target="_blank" rel="noopener noreferrer">{readable(r.key)}</a>
+                                : url ? readable(r.key) : r.key || '（不明）'}
+                        </td>
+                        <td className="td_td td_num">{r.visits.toLocaleString()}</td>
+                        <td className="td_td td_num">{r.ad.toLocaleString()}</td>
+                        {!noCv && <td className="td_td td_num">{r.cv > 0 ? <b>{r.cv}</b> : 0}</td>}
+                        {!noCv && <td className="td_td td_num">{pct(r.cv, r.visits)}</td>}
+                    </tr>
+                ))}
+            </tbody>
+        </table>
+    </div>
+);
+
+const FlowTable: React.FC<{ title: string; rows: Flow[]; emptyLabel: string }> = ({ title, rows, emptyLabel }) => (
+    <div className="td_table_wrap">
+        <table className="td_table">
+            <thead><tr><th className="td_th">{title}</th><th className="td_th td_num">回数</th></tr></thead>
+            <tbody>
+                {rows.length === 0 ? (
+                    <tr><td className="td_td td_empty" colSpan={2}>記録がありません。</td></tr>
+                ) : rows.map((r) => (
+                    <tr key={r.url || '-'}>
+                        <td className="td_td td_url" title={r.url}>{r.url === '' ? emptyLabel : readable(r.url)}</td>
+                        <td className="td_td td_num">{r.views.toLocaleString()}</td>
+                    </tr>
+                ))}
+            </tbody>
+        </table>
+    </div>
+);
+
+/** ⚠️ GoogleReview.tsx と同じ配色・余白・角丸（接頭辞 td_） */
+const CSS = `
+.td_backdrop.modal-backdrop { z-index: 1055; }
+.td_backdrop.modal-backdrop.show { opacity: .55; }
+.td_content.modal-content { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 24px 64px rgba(15,23,42,.45), 0 2px 8px rgba(15,23,42,.2); }
+.td_title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; word-break: break-all; }
+.td_axis { font-size: 10px; font-weight: 700; color: #1d4ed8; background: #eff6ff; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
+.td_sub { font-size: 11px; color: #6b7280; font-weight: 400; }
+.td_body { font-size: 12px; color: #1f2937; display: flex; flex-direction: column; gap: 14px; }
+.td_error { font-size: 12px; color: #b91c1c; font-weight: 700; }
+.td_note { font-size: 11px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 10px; }
+.td_kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
+.td_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; }
+.td_label { font-size: 11px; color: #6b7280; }
+.td_value { font-size: 17px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
+.td_unit { font-size: 11px; font-weight: 400; color: #6b7280; }
+.td_section { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
+.td_h { font-size: 12px; font-weight: 700; color: #374151; margin: 0; }
+.td_two { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
+.td_chart { display: flex; align-items: flex-end; gap: 2px; height: 90px; padding: 6px 4px 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; }
+.td_bar_col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; min-width: 0; }
+.td_bar { width: 100%; background: #93c5fd; border-radius: 3px 3px 0 0; min-height: 1px; }
+.td_cv_dot { position: absolute; top: 0; font-size: 9px; font-weight: 700; color: #fff; background: #f97316; border-radius: 999px; min-width: 14px; height: 14px; line-height: 14px; text-align: center; padding: 0 3px; }
+.td_axis_row { display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
+.td_hours { display: flex; align-items: flex-end; gap: 2px; height: 90px; padding: 6px 4px 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; }
+.td_hour { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; min-width: 0; }
+.td_hour_bar { width: 100%; background: #a5b4fc; border-radius: 3px 3px 0 0; min-height: 1px; }
+.td_hour_label { font-size: 9px; color: #9ca3af; height: 12px; }
+.td_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; max-height: 280px; }
+.td_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
+.td_th { position: sticky; top: 0; z-index: 1; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 7px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
+.td_sort { cursor: pointer; user-select: none; }
+.td_sort:hover { background: #eef2f7; }
+.td_sort_icon { margin-left: 4px; font-size: 10px; color: #cbd5e1; }
+.td_sort_icon.is_active { color: #2563eb; }
+.td_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
+.td_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
+.td_date { white-space: nowrap; font-variant-numeric: tabular-nums; }
+.td_url { word-break: break-all; }
+.td_link { color: #1d4ed8; text-decoration: none; }
+.td_link:hover { text-decoration: underline; }
+.td_empty { color: #9ca3af; text-align: center; padding: 16px; }
+.td_ad { display: flex; gap: 8px; align-items: center; min-width: 200px; }
+.td_thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: #f3f4f6; border: 1px solid #e5e7eb; }
+.td_ad_name { font-weight: 700; font-size: 12px; }
+.td_status { margin-left: 6px; font-size: 10px; color: #6b7280; background: #f3f4f6; border-radius: 999px; padding: 1px 6px; }
+.td_meta_sum { font-size: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; }
+`;
+
+export default TrackingDetail;
diff --git a/frontend/src/components/header/TrackingSettings.tsx b/frontend/src/components/header/TrackingSettings.tsx
index 8a50fc7b..16070c2c 100644
--- a/frontend/src/components/header/TrackingSettings.tsx
+++ b/frontend/src/components/header/TrackingSettings.tsx
@@ -1,8 +1,9 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import apiClient from '../../utils/apiClient';
+import TrackingDetail, { type DetailAxis } from './TrackingDetail';
 
 /**
- * 広告流入トラッキングの設定（v2.2.199 新規）。ヘッダー「反響管理 → トラッキング設定」（Master / BrandAdmin）。
+ * アクセス解析（v2.2.199 新規「トラッキング設定」→ v2.2.203 で「アクセス解析」に改名）。ヘッダー「反響管理 → アクセス解析」（Master / BrandAdmin）。
  *
  * ─────────────────────────────────────────────
  * ⚠️ サイトを登録すると site_key が発行され、各サイトに入れるタグ（tracker.js）を出す。
@@ -13,6 +14,8 @@ import apiClient from '../../utils/apiClient';
  * ⚠️ v2.2.202 サイト名を押すと、その行の下にサマリー（SiteSummary）が開く。⚠️ 開閉はサイトごと（ほかのサイトと連動しない）。
  *   ⚠️ サマリーは開いたときに取りに行く（tracking_site_summary。② は features/tracking/summary.ts）。⚠️「再読み込み」で一覧と開いているサマリーを取り直す。
  *   ⚠️ CV の数え方は ② の features/tracking/conversions.ts（直近30日の反響の khg_vid が、問い合わせの日までにそのサイトに来ていたもの）。
+ * ⚠️ v2.2.203 サマリーの着地ページ・流入元を押すと、詳細のモーダル（TrackingDetail.tsx）が開く。着地ページは右のアイコンでそのページを開く。
+ *   ⚠️ 上の「Meta から取り込む」は ② の meta_ads_import（待たずに返る。終わったかは「最後の取り込み」で見る）。⚠️ ② は6時間ごとにも自動で取り込む。
  * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
  * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
  * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tk_）。
@@ -123,6 +126,8 @@ const SiteSummary: React.FC<{ siteId: number; reloadKey: number }> = ({ siteId,
     const [tab, setTab] = useState<SummaryTab>('landing');
     const [sortKey, setSortKey] = useState<SummarySortKey>('visits');
     const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
+    /** 詳細を開いている着地ページ・流入元（v2.2.203） */
+    const [detail, setDetail] = useState<{ axis: DetailAxis; value: string } | null>(null);
 
     useEffect(() => {
         let alive = true;
@@ -195,10 +200,15 @@ const SiteSummary: React.FC<{ siteId: number; reloadKey: number }> = ({ siteId,
                         ) : rows.map((r) => (
                             <tr key={r.key} className="tk_row">
                                 <td className="tk_td tk_sum_key" title={r.key}>
-                                    {/* ⚠️ 着地ページは押すとそのページを別のタブで開く（⚠️ http(s) の URL だけ） */}
-                                    {tab === 'landing' && /^https?:///.test(r.key)
-                                        ? <a className="tk_url" href={r.key} target="_blank" rel="noopener noreferrer">{readableUrl(r.key)}<i className="fa-solid fa-arrow-up-right-from-square tk_url_icon" aria-hidden="true" /></a>
-                                        : tab === 'landing' ? readableUrl(r.key) : r.key || '（不明）'}
+                                    {/* ⚠️ v2.2.203 文字を押すと詳細（TrackingDetail）が開く。着地ページは右のアイコンでそのページを別のタブで開く（⚠️ http(s) の URL だけ） */}
+                                    <button type="button" className="tk_key_btn" onClick={() => setDetail({ axis: tab, value: r.key })}>
+                                        {tab === 'landing' ? readableUrl(r.key) : r.key || '（不明）'}
+                                    </button>
+                                    {tab === 'landing' && /^https?:\/\//.test(r.key) && (
+                                        <a className="tk_url_icon" href={r.key} target="_blank" rel="noopener noreferrer" title="このページを開く" aria-label="このページを別のタブで開く">
+                                            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
+                                        </a>
+                                    )}
                                 </td>
                                 <td className="tk_td tk_num">{r.visits.toLocaleString()}</td>
                                 <td className="tk_td tk_num">{r.ad.toLocaleString()}</td>
@@ -209,6 +219,7 @@ const SiteSummary: React.FC<{ siteId: number; reloadKey: number }> = ({ siteId,
                     </tbody>
                 </table>
             </div>
+            {detail !== null && <TrackingDetail siteId={siteId} axis={detail.axis} value={detail.value} onClose={() => setDetail(null)} />}
         </div>
     );
 };
@@ -227,6 +238,9 @@ const TrackingSettings: React.FC = () => {
     /** サマリーを開いているサイト（⚠️ サイトごとに開閉。ほかのサイトと連動しない） */
     const [openSummary, setOpenSummary] = useState<Set<number>>(new Set());
     const [reloadKey, setReloadKey] = useState(0);
+    /** Meta 広告の取り込みの状態（v2.2.203） */
+    const [meta, setMeta] = useState<{ configured: boolean; lastImportedAt: string | null }>({ configured: false, lastImportedAt: null });
+    const [importMessage, setImportMessage] = useState('');
 
     const load = useCallback(async () => {
         setLoading(true);
@@ -235,6 +249,7 @@ const TrackingSettings: React.FC = () => {
             const response = await apiClient.post('', { request: 'tracking_site_list' });
             setSites(response.data?.sites ?? []);
             if (Array.isArray(response.data?.brands)) setBrands(response.data.brands);
+            if (response.data?.meta) setMeta(response.data.meta);
         } catch (e) {
             console.error('tracking_site_list failed:', e);
             setError('サイトの一覧を読み込めませんでした。管理者の権限が必要です。');
@@ -252,6 +267,17 @@ const TrackingSettings: React.FC = () => {
         cv: sites.reduce((sum, s) => sum + s.cv30d, 0),
     }), [sites]);
 
+    const importMeta = async () => {
+        setImportMessage('');
+        try {
+            await apiClient.post('', { request: 'meta_ads_import' });
+            setImportMessage('取り込みを始めました。数分かかります。少し待ってから「再読み込み」を押してください。');
+        } catch (e: unknown) {
+            const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
+            setImportMessage(message ?? '取り込みを始められませんでした。');
+        }
+    };
+
     const reload = () => {
         load();
         setReloadKey((k) => k + 1);
@@ -312,7 +338,7 @@ const TrackingSettings: React.FC = () => {
             <style>{CSS}</style>
             <div className="tk_inner">
                 <div className="tk_head">
-                    <span className="tk_title"><i className="fa-solid fa-route me-2 text-primary" aria-hidden="true" />トラッキング設定</span>
+                    <span className="tk_title"><i className="fa-solid fa-route me-2 text-primary" aria-hidden="true" />アクセス解析</span>
                     {/* ⚠️ 右端に置かないこと（⚠️ 右上はアクティブユーザーの枠＝ActiveUser.tsx が重なって押せない） */}
                     <button type="button" className="tk_btn is_primary" onClick={() => startEdit(null)}>サイトを登録</button>
                     <button type="button" className="tk_btn" onClick={reload} disabled={loading}>
@@ -320,6 +346,13 @@ const TrackingSettings: React.FC = () => {
                     </button>
                     <span className="tk_note">広告から来た人の流入情報と、訪問者ごとのID（顧客ID）を、各サイトのタグで記録します</span>
                 </div>
+                {meta.configured && (
+                    <div className="tk_meta">
+                        <i className="fa-brands fa-meta me-1 text-primary" aria-hidden="true" />Meta 広告：最後の取り込み <b>{meta.lastImportedAt ?? 'まだありません'}</b>（6時間ごとに自動で取り込みます）
+                        <button type="button" className="tk_btn" onClick={importMeta}>Meta から取り込む</button>
+                        {importMessage !== '' && <span className="tk_sub">{importMessage}</span>}
+                    </div>
+                )}
 
                 <div className="tk_kpi">
                     <div className="tk_kpi_card"><div className="tk_kpi_label">登録サイト</div><div className="tk_kpi_value">{kpi.total}</div></div>
@@ -331,7 +364,7 @@ const TrackingSettings: React.FC = () => {
                 <div className="tk_caution">
                     ※ タグは、サイトの<b>すべてのページ</b>で1回だけ動くように入れます。GTM を使っているサイトは「GTM 用」を、使っていないサイトは「フッター用」を使ってください（GTM にフッター用を入れても動きません）。<br />
                     ※ 「許可するオリジン」は、タグを貼るサイトの <b>https://ドメイン</b> です（例：https://kh-house.jp）。ここに無いドメインからの記録は保存しません。<br />
-                    ※ サイト名を押すと、そのサイトの着地ページ別・流入元別の PV（広告以外も含む。30分以内のページの移動はまとめて1件）と CV が開きます。CV は、直近30日の反響のうち、問い合わせの日までにそのサイトに来ていた人の数です。<br />
+                    ※ サイト名を押すと、そのサイトの着地ページ別・流入元別の PV（広告以外も含む。30分以内のページの移動はまとめて1件）と CV が開きます。CV は、直近30日の反響のうち、問い合わせの日までにそのサイトに来ていた人の数です。サマリーの着地ページ・流入元を押すと、日別・端末・広告別などの詳細が開きます。<br />
                     ※ 訪問者ごとのID（顧客ID）はブラウザに保存されます。リリース前に、プライバシーポリシーへ利用目的の記載が必要です。
                 </div>
 
@@ -506,10 +539,12 @@ const CSS = `
 .tk_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
 .tk_sort_icon.is_active { color: #2563eb; }
 .tk_sum_key { max-width: 560px; word-break: break-all; font-size: 12px; }
-.tk_url { color: #1d4ed8; text-decoration: none; }
-.tk_url:hover { text-decoration: underline; }
-.tk_url:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; border-radius: 3px; }
-.tk_url_icon { font-size: 9px; margin-left: 5px; color: #94a3b8; }
+.tk_key_btn { color: #1d4ed8; background: none; border: none; padding: 0; text-align: left; cursor: pointer; font-size: 12px; word-break: break-all; }
+.tk_key_btn:hover { text-decoration: underline; }
+.tk_key_btn:focus-visible, .tk_url_icon:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; border-radius: 3px; }
+.tk_url_icon { font-size: 10px; margin-left: 6px; color: #64748b; text-decoration: none; }
+.tk_url_icon:hover { color: #1d4ed8; }
+.tk_meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #374151; }
 .tk_sub { font-size: 11px; color: #6b7280; }
 .tk_tag { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
 .tk_origin { font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
```

---

## 追記（2026-10-21）：見直し（コードの再読と動作確認のやり直し）

### コードの再読で直したもの
1. **importer.ts：Meta への問い合わせに待ち時間の上限（60秒）を付けた**（重要）
   - 無いと、Meta が返事をしないまま止まったとき取り込みが終わらず、2つ同時に動かさない仕組み（running）のせいで、以後の自動の取り込みも画面のボタンも何もしなくなる。
   - `REQUEST_TIMEOUT_MS = 60_000`、`fetch(…, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })`
2. **TrackingDetail.tsx：閲覧の記録が無いときの文言**から版の番号を外した（「閲覧の記録を始めた日より前の分はありません」）。
3. 整理：detail.ts の `deviceOf`・`META_SOURCE_PATTERN` はほかから使っていないので export を外した。tracker.js の先頭のコメントの旧名（トラッキング設定）を直した（コメント行は配信時に消える）。

### 再読で確かめて、直さなかったもの
- tracker.js の「ひとつ前のページ」（khg_prev）は localStorage なので、同じサイトをタブを2つで見ていると、別のタブのページが前のページになることがある（記録が壊れるわけではない）。
- 1ページを再読み込みすると、前のページが同じページの行ができる。前後のページの集計では、同じページどうしは除いている。
- 自動の取り込みの最中に6時間が来ても、2つ目は動かず、動いているほうを待つ。

### 動作確認（やり直し）
- ② 型チェック OK。tracker.js 構文 OK。
- ① 経由（トークン無し）：tracking_site_list・tracking_site_save・tracking_site_summary・tracking_detail・meta_ads_import・tracking_touches → すべて 401。公開の口 /api/track/touch・/api/track/pv → 204。配信中の tracker.js に /api/track/pv あり。
  - ⚠️ 1回目は 502 だったが、自分が流した ② の再起動の途中に送ったため（ログで SIGINT → 起動を確認）。② が落ちたのではない。
- Meta の取り込み（上限を付けたあと・本物の API）：成功（広告 2,331・日別 13,220・約4分半）。
- 前の版までの通し（一時的にテスト用のサイトを足して）：v2.2.199 自社フォーム A〜G、v2.2.201 見学クラウド H〜J、広告以外の訪問 L〜S → すべて前と同じ。⚠️ この3本は閲覧の送り先を用意していない古いテストで、閲覧を送れなくてもサイト・フォームに影響が無いことも確かめられた。
- ページの閲覧（pv.cjs）：前と同じ（1ページ1行・? 以降なし・31分で別の訪問・前のページ・ロボット除外）。
- 整理（上限2行）：前と同じ（CV の人は残る・それ以外の古い行だけ消える・2回目は 0）。
- 詳細（tracking_detail）：前と同じ。Meta の数字は取り込み直した分だけ少し増えた（PG の費用 1,839,498 → 1,840,431円）。権限なし 403・サイトなし 404・指定の誤り 400。
- 画面（再ビルド `main.d3b6bae7.js`・実データの返答で Playwright）：前と同じ（メニュー名・Meta の行・着地ページのボタンとアイコン・lg のモーダルが一番上・ページの前後・Meta 広告 38件と CPA の並べ替え・CV の一覧・幅 390px）。⚠️ 1回目はテスト用のサイト「テスト国分ハウジング」にもボタンの名前が部分一致して止まったので、テストを完全一致に直した（画面の誤りではない）。
- 記事「アクセス解析」を業務ガイドの画面で表示：新しい節（詳細・Meta 広告・ページの前後）が出る。
- 後片付け：テスト用のサイト・反響・予約・閲覧・消さない顧客ID・今日の着地を削除。CSV の実データ（7サイト・319件）と Meta の実データは残した。

### 差分（見直しの分）
```diff
diff --git a/backend-express/public/tracker.js b/backend-express/public/tracker.js
index 3c2fd585..44966075 100644
--- a/backend-express/public/tracker.js
+++ b/backend-express/public/tracker.js
@@ -1,4 +1,4 @@
-// 広告流入トラッキング（v2.2.199）。各ブランドサイトに入れる（GTM 用・フッター用のタグはトラッキング設定が出す）:
+// 広告流入トラッキング（v2.2.199）。各ブランドサイトに入れる（GTM 用・フッター用のタグはアクセス解析（旧トラッキング設定）が出す）:
 //   <script src="https://api.khg-marketing.info/t/v1/tracker.js" data-site="SITE_KEY" defer></script>
 // ⚠️ フォーム（form_get）は改修しない。フォームが読む localStorage のキー（landing_params / source / campaign）に書く。
 // ⚠️ 訪問者ID（khg_vid）を全員に振り、landing_params に付ける。ほかのスクリプト（MA など）は window.khgVisitorId で読める。
diff --git a/backend-express/src/features/metaAds/importer.ts b/backend-express/src/features/metaAds/importer.ts
index cdb56061..555dc285 100644
--- a/backend-express/src/features/metaAds/importer.ts
+++ b/backend-express/src/features/metaAds/importer.ts
@@ -22,6 +22,11 @@ export const META_IMPORT_DAYS = 35;
 const PAGE_LIMIT = 200;
 /** 1つの ID で読むページの上限（⚠️ 無限に続かないための安全装置） */
 const MAX_PAGES = 50;
+/**
+ * 1回の問い合わせの待ち時間の上限。⚠️ 無いと、Meta が返事をしないまま止まったとき取り込みが終わらず、
+ *   running のせいで以後の自動の取り込みも画面のボタンも何もしなくなる（2026-10-21 の見直しで追加）。
+ */
+const REQUEST_TIMEOUT_MS = 60_000;
 /** 1回の INSERT にまとめる行数（⚠️ 本番の DB は SSH トンネルの先。1行ずつだと遅い：2026-10-21 ローカルで 2,331 件＋13,218 行に 5 分半） */
 const BATCH = 500;
 
@@ -56,7 +61,10 @@ const fetchAll = async <T>(path: string, params: Record<string, string>): Promis
     const url = new URL(`${GRAPH}/${path}`);
     for (const [k, v] of Object.entries({ ...params, limit: String(PAGE_LIMIT) })) url.searchParams.set(k, v);
     if (after !== '') url.searchParams.set('after', after);
-    const response = await fetch(url, { headers: { Authorization: `Bearer ${env.metaAccessToken}` } });
+    const response = await fetch(url, {
+      headers: { Authorization: `Bearer ${env.metaAccessToken}` },
+      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
+    });
     const body = (await response.json()) as Paged<T>;
     if (!response.ok || body.error) {
       throw new Error(`Meta API ${response.status} ${path.split('/').pop()}: ${mask(body.error?.message ?? 'エラー')}`);
diff --git a/backend-express/src/features/tracking/detail.ts b/backend-express/src/features/tracking/detail.ts
index d10b4099..3a03378a 100644
--- a/backend-express/src/features/tracking/detail.ts
+++ b/backend-express/src/features/tracking/detail.ts
@@ -22,7 +22,7 @@ import { canManageTracking, type TrackingResult } from './sites';
  */
 
 /** Meta 広告の流入元（utm_source の書き方の揺れ・fbclid だけのとき） */
-export const META_SOURCE_PATTERN = /^(meta|fb|ig|facebook|instagram|facebook\/instagram)$/i;
+const META_SOURCE_PATTERN = /^(meta|fb|ig|facebook|instagram|facebook\/instagram)$/i;
 /** 1回に読む行の上限（⚠️ 画面が固まらないための安全装置） */
 const ROW_LIMIT = 50_000;
 
@@ -41,7 +41,7 @@ interface TouchRow extends RowDataPacket {
 interface Bucket { key: string; visits: number; ad: number; cv: number }
 
 /** ブラウザの情報から端末の種類 */
-export const deviceOf = (ua: string | null): string => {
+const deviceOf = (ua: string | null): string => {
   if (!ua) return '不明';
   if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'タブレット';
   if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'スマホ';
diff --git a/frontend/src/components/header/TrackingDetail.tsx b/frontend/src/components/header/TrackingDetail.tsx
index f1c2dfd1..8e87fd22 100644
--- a/frontend/src/components/header/TrackingDetail.tsx
+++ b/frontend/src/components/header/TrackingDetail.tsx
@@ -126,7 +126,7 @@ const TrackingDetail: React.FC<{ siteId: number; axis: DetailAxis; value: string
                             <section className="td_section">
                                 <h6 className="td_h">ページの前後（閲覧の記録から）</h6>
                                 {data.pageFlow.views === 0 ? (
-                                    <div className="td_sub">まだ閲覧の記録がありません（記録は v2.2.203 から始まりました）。</div>
+                                    <div className="td_sub">まだ閲覧の記録がありません（閲覧の記録を始めた日より前の分はありません）。</div>
                                 ) : (
                                     <div className="td_two">
                                         <FlowTable title="前に見ていたページ" rows={data.pageFlow.prev} emptyLabel="（訪問の最初のページ）" />
```
