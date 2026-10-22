# v2.2.201 見学クラウド（ie-miru）の予約にも顧客ID・広告の情報を付ける（2026-10-20）

## 依頼
- 見学クラウドはコンテンツ部分とフォーム部分が別の画面のため、今の仕様ではフォームに移ったときにパラメータが取れない。最初のページ（コンテンツ部分）で取る必要がある。
- 見学クラウドにも自社の GTM が入っているので発火は可能。どうしたらいいか → 計画（tracker.js を見学クラウドでも動かし、ドメインをまたぐリンクに顧客IDを付ける）を承認。
- 「中身を見てよい」「（見学クラウドから自社サイトへ戻るリンクにも）付けて返す」「新たな v2.2.201 へ」

## 調べたこと（公開中の GTM）
- 見学クラウドのページ（/cms/yoyaku/khkirishima/…）には GTM-5B9M9KGV・GTM-KRKCML59・GTM-WPZMW2H（見学クラウド側）が入っている。
- 予約関係のタグは GTM-KRKCML59（tag id 23 送信・25 保存）と GTM-5B9M9KGV（id 17 送信・19 保存。/kokubuhousinggroup のときだけ）にある。
- 保存のタグ（`url_params` を覚える処理を含む）は「/reserve/confirm」でしか動かない → コンテンツページのパラメータは覚えない（依頼の内容どおり）。
- 送信のタグは `reserveData` ＋ `url_params`（JSON 文字列）を ② の gateway（kengaku_cloud / entry）へ送る。
- ⚠️ 気づいた点（今回は変えていない）：/kokubuhousinggroup の完了画面では、2つのコンテナの送信タグが両方動く条件になっている（予約が2件届く可能性）。

## 仕組み
```
自社サイト（広告で着地 → tracker.js が顧客ID・広告の情報を保存し、着地を記録）
   │ 見学クラウドへのリンクを押した瞬間、tracker.js がリンクに khg_vid と広告の情報を付け足す
   ▼
見学クラウドのコンテンツページ（GTM → tracker.js：見学クラウド用のサイトキー）
   │ URL の khg_vid を顧客IDとして引き継ぎ、landing_params に保存（引き継ぎのときは着地を記録しない）
   ▼
確認 → 完了（GTM の送信タグ v5 が landing_params も送る）
   ▼
② kengaku_cloud / entry：landing_params が届けば inquiry_customer.landing_params に入れる → 反響一覧の「流入」で着地と結びつく
```
- 見学クラウドに広告で直接来た人は、見学クラウドの着地として記録する（見学クラウドで顧客IDを振る）。
- 見学クラウドから自社サイトへ戻るリンクにも khg_vid を付ける → 自社サイトでも同じ顧客IDになる。

## 変えたもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/public | **tracker.js** | 定数 `UUID`・`LINK_HOSTS`、関数 `bare`・`decorate` を追加。URL の `khg_vid` の引き継ぎ（`passed`）。`repair` を URLSearchParams で khg_vid を差し替える形に。引き継ぎのときは着地を送らない |
| backend-express/src/features/kengakuCloud | **entry.ts** | 関数 `readLandingParams` を追加。`FORM_KEYS` に `landing_params`。landing_params が届けばそれを保存（無ければ url_params と同じ値＝これまでどおり）。utm 列は url_params を優先し、無ければ landing_params から |
| （リポジトリ外）Downloads | **gtm_reserve_send_v5.html**（新規。v4 は残す） | localStorage の `landing_params` も送る |
| frontend/src/utils | **version.ts** | `2.2.201` |
| backend/scripts/guide/articles/common | **screen-200.md**（記事「トラッキング設定」） | 「## 見学クラウド（ie-miru）」を追加 |
| backend/scripts/sql | **2026-10-20_update_log_2.2.201.sql**（新規） | update_log 1行 ＋ 記事。ローカル DB に流した（no=300） |
| docs | **deploy-v2.2.201.md**（新規） | 手順書 |

## 差分（全文）
```diff
diff --git a/backend-express/public/tracker.js b/backend-express/public/tracker.js
index 1f757dee..87f16735 100644
--- a/backend-express/public/tracker.js
+++ b/backend-express/public/tracker.js
@@ -1,4 +1,4 @@
-// 広告流入トラッキング（v2.2.199）。各ブランドサイトのフッターに貼る:
+// 広告流入トラッキング（v2.2.199）。各ブランドサイトに入れる（GTM 用・フッター用のタグはトラッキング設定が出す）:
 //   <script src="https://api.khg-marketing.info/t/v1/tracker.js" data-site="SITE_KEY" defer></script>
 // ⚠️ フォーム（form_get）は改修しない。フォームが読む localStorage のキー（landing_params / source / campaign）に書く。
 // ⚠️ 訪問者ID（khg_vid）を全員に振り、landing_params に付ける。ほかのスクリプト（MA など）は window.khgVisitorId で読める。
@@ -17,6 +17,11 @@
       'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'flyer'];
     var MAX = 500;
     var ENDPOINT = 'https://api.khg-marketing.info/api/track/touch';
+    var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
+    // ⚠️ v2.2.201 自社のサイトどうし（見学クラウドを含む）は、リンクに顧客IDと広告の情報を付けて渡す。www の有無は同じとみなす
+    var LINK_HOSTS = ['ie-miru.jp', 'kh-house.jp', 'day-just-house.com', 'nagomi-koumuten.jp', 'furukomi-home.com',
+      '2lhome.net', 'miyazaki.pg-house.jp', 'jusfy-home.com'];
+    var bare = function (host) { return host.toLowerCase().replace(/^www\./, ''); };
     var uuid = function () {
       if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
       var b = new Uint8Array(16);
@@ -27,23 +32,29 @@
       for (var i = 0; i < 16; i++) h.push((b[i] + 256).toString(16).slice(1));
       return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
     };
+    var url = new URL(window.location.href);
+    // ⚠️ v2.2.201 別の自社サイトから khg_vid 付きで来たら、その顧客IDを引き継ぐ（ドメインが違っても同じ人として結びつける）
+    var passed = (url.searchParams.get('khg_vid') || '').toLowerCase();
+    if (!UUID.test(passed)) passed = '';
+    if (passed) store.setItem('khg_vid', passed);
     var visitor = function () {
       var id = store.getItem('khg_vid');
-      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
+      if (!id || !UUID.test(id)) {
         id = uuid();
         store.setItem('khg_vid', id);
       }
       return id;
     };
     // ⚠️⚠️ 訪問者ID（khg_vid）は広告で来た人だけでなく全員に振る（2026-10-20 の追加指示。MA で顧客を識別するため）。
-    // ⚠️ landing_params に必ず khg_vid を入れる → フォームがそのまま送るので、どの反響にも ID が付く。
-    // ⚠️ 空なら khg_vid だけ、あれば末尾に付ける（§5-1-8 の補修。フォームのあるページはフォームが ? 以降で上書きするため）。
-    // ⚠️ ID はサイト（ドメイン）ごと。localStorage はドメインをまたげない。
+    // ⚠️ landing_params に必ず今の khg_vid を入れる → フォームがそのまま送るので、どの反響にも ID が付く。
+    // ⚠️ 無ければ足し、引き継ぎで ID が変わっていたら差し替える（§5-1-8 の補修。フォームのあるページはフォームが ? 以降で上書きするため）。
     var repair = function () {
       var id = visitor();
-      var lp = store.getItem('landing_params') || '';
-      if (lp === '') store.setItem('landing_params', 'khg_vid=' + encodeURIComponent(id));
-      else if (lp.indexOf('khg_vid=') < 0) store.setItem('landing_params', lp + '&khg_vid=' + encodeURIComponent(id));
+      var lp = new URLSearchParams(store.getItem('landing_params') || '');
+      if (lp.get('khg_vid') !== id) {
+        lp.set('khg_vid', id);
+        store.setItem('landing_params', lp.toString());
+      }
       window.khgVisitorId = id;
     };
     // ⚠️ フォームのページでは、フォーム（iframe）が後から landing_params を上書きして khg_vid を消す。
@@ -55,7 +66,27 @@
         if (++n >= 1800) window.clearInterval(timer);
       }, 1000);
     };
-    var url = new URL(window.location.href);
+    // ⚠️ v2.2.201 自社の別ドメインへのリンクを押したら、その瞬間に khg_vid と覚えている広告の情報を付け足す（行き先に既にあるキーは変えない）
+    var decorate = function (e) {
+      try {
+        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
+        if (!a) return;
+        var to = new URL(a.href, window.location.href);
+        if (!/^https?:$/.test(to.protocol) || bare(to.hostname) === bare(window.location.hostname)) return;
+        if (LINK_HOSTS.indexOf(bare(to.hostname)) < 0) return;
+        var lp = new URLSearchParams(store.getItem('landing_params') || '');
+        KEYS.forEach(function (k) {
+          var v = lp.get(k);
+          if (v && !to.searchParams.has(k)) to.searchParams.set(k, v);
+        });
+        to.searchParams.set('khg_vid', visitor());
+        a.href = to.toString();
+      } catch (err) {
+        // 何もしない（リンクはそのまま開く）
+      }
+    };
+    document.addEventListener('mousedown', decorate, true);
+    document.addEventListener('click', decorate, true);
     var params = {};
     var found = false;
     KEYS.forEach(function (k) {
@@ -75,6 +106,8 @@
       || (params.gclid || params.wbraid || params.gbraid ? 'Google' : '') || (params.yclid ? 'Yahoo' : '') || (params.flyer ? 'Flyer' : '');
     if (source) store.setItem('source', source);
     if (params.utm_campaign) store.setItem('campaign', params.utm_campaign);
+    // ⚠️ v2.2.201 自社サイトから引き継いだ広告の情報は、元のサイトで着地を記録済み。二重に数えないよう送らない
+    if (passed) return;
     var body = JSON.stringify({
       site_key: siteKey, visitor_id: vid, params: params,
       landing_url: (url.origin + url.pathname).slice(0, 2000),
diff --git a/backend-express/src/features/kengakuCloud/entry.ts b/backend-express/src/features/kengakuCloud/entry.ts
index 90eaf53d..7a35a0ff 100644
--- a/backend-express/src/features/kengakuCloud/entry.ts
+++ b/backend-express/src/features/kengakuCloud/entry.ts
@@ -29,6 +29,7 @@ export interface KengakuCloudResult {
 const FORM_KEYS = new Set([
     'request', 'roll', 'name', 'kana', 'mail', 'mobile', 'full_address', 'brand', 'shop', 'campaign',
     'medium', 'reserved_date', 'reserved_time', 'age', 'line_id', 'message', 'benefit_agreement', 'url_params',
+    'landing_params',
 ]);
 
 const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
@@ -101,6 +102,13 @@ export const readUrlParams = (body: Record<string, unknown>): string => {
         .map(([k, v]) => encodePair(k, v)).join('&').slice(0, 2000);
 };
 
+/**
+ * 見学クラウドに置いた tracker.js が保存した landing_params（v2.2.201）。GTM（gtm_reserve_send_v5）が `a=1&b=2` の形で送る。
+ * ⚠️ 顧客ID（khg_vid）と広告の情報が入っている。⚠️ 無ければ空（古い GTM のまま・タグが動かなかったとき）。
+ */
+export const readLandingParams = (body: Record<string, unknown>): string =>
+    clean(typeof body.landing_params === 'string' ? body.landing_params.trim().replace(/^\?/, '') : '', 2000);
+
 /** 予約日時の行（移植元のメールと同じ並び。空の項目は出さない） */
 const line = (label: string, value: string): string => (value === '' ? '' : `${label}：${value}\n`);
 
@@ -131,7 +139,9 @@ export const runKengakuCloudEntry = async (
     const lineId = clean(body.line_id, 200).replace(/\s+/g, '').slice(0, 100);
     const message = cleanMultiline(body.message, 2000);
     const urlParams = readUrlParams(body);
+    const landingParams = readLandingParams(body);
     const query = new URLSearchParams(urlParams);
+    const landingQuery = new URLSearchParams(landingParams);
 
     const now = new Date();
     const t = jstParts(now);
@@ -160,14 +170,16 @@ export const runKengakuCloudEntry = async (
     values.reserved_date = reservedDate;
     values.reserved_time = reservedTime;
     values.remarks = message;
-    for (const key of UTM_KEYS) values[key] = clean(query.get(key), 200);
+    // ⚠️ utm は url_params を優先し、無ければ landing_params（tracker.js が最初のページで覚えたもの）から
+    for (const key of UTM_KEYS) values[key] = clean(query.get(key) ?? landingQuery.get(key), 200);
     values.line_id = lineId === '' ? null : lineId;
     /**
-     * ⚠️ 見学クラウドで取れるのは「最後に見たパラメータ付きページ」の ? 以降だけ（GTM が localStorage に覚えたもの）。
-     *   ⚠️ 公開フォームの url_params / landing_params どちらで探しても見つかるよう、両方に同じ値を入れる。
+     * ⚠️ url_params は GTM が覚えた「最後に見たパラメータ付きページ」の ? 以降（⚠️ 確認画面より前のページでは覚えない）。
+     * ⚠️ landing_params は tracker.js が覚えたもの（v2.2.201〜。顧客ID khg_vid 入り）。届けばこちらを入れる。
+     *   ⚠️ 届かなければ、公開フォームの url_params / landing_params どちらで探しても見つかるよう、両方に同じ値を入れる（v2.2.190 のまま）。
      */
     values.url_params = urlParams === '' ? null : urlParams;
-    values.landing_params = values.url_params;
+    values.landing_params = landingParams !== '' ? landingParams : values.url_params;
 
     const columns = [...(NOT_NULL_COLUMNS as unknown as string[]), 'line_id', 'url_params', 'landing_params'];
 
```

## gtm_reserve_send_v5.html（v4 との差分）
```diff
3a4,8
>   【変更点（v5）】
>   - 見学クラウドに置いた tracker.js（広告流入トラッキング）が localStorage に保存した "landing_params" も送る
>     （顧客ID khg_vid と、最初のページで覚えた広告の情報が入っている。無ければ送らない）
>   - それ以外・GTM の設定（トリガー）は v4 と同じ
> 
85a91,99
>     }
>     // 2-3. tracker.js が保存した landing_params（顧客ID khg_vid ＋ 広告の情報）。a=1&b=2 の形のまま送る
>     try {
>       var landingParamsRaw = localStorage.getItem("landing_params");
>       if (landingParamsRaw) {
>         sendData.landing_params = landingParamsRaw;
>       }
>     } catch (e) {
>       console.error("landing_params read error:", e);
```

## 確認
- ② 型チェック OK。ローカル ② を再起動して新しい tracker.js を配信。
- Playwright（kh-house.jp と www.ie-miru.jp を模擬。tracker.js・着地・gateway はローカル ② へ。送信タグは gtm_reserve_send_v5.html の中身そのもの）
  - H：自社 LP に広告で着地（着地1件）→ 見学クラウドへのリンク → URL に `gclid`・`utm_source`・`utm_campaign`・`khg_vid` が付く（元の `kc_source` 等は残る）→ 見学クラウドでも同じ顧客ID、着地は増えない → 確認 → 完了で v5 が `landing_params` を送信 → ② が保存（200）→ サンクスへ移動。ページのエラー 0
    - 保存された行：landing_params `gclid=g201&utm_source=google&utm_campaign=autumn&khg_vid=…`、utm_source `google`、utm_campaign `autumn`
    - 流入履歴（listInquiryTouches）：matchedBy `khg_vid` で、自社サイトでの着地が出る
  - I：見学クラウドに広告で直接着地 → 見学クラウドの着地として記録 → 戻るリンクで自社サイトへ → URL に `yclid`・`khg_vid` → 自社サイトでも同じ顧客ID、着地は増えない
  - J：同じドメインのリンク・自社以外（example.com）のリンクは書き換えない。行き先に既にあるキー（utm_source=keep）は上書きしない
  - 古い送信タグの形（landing_params 無し・url_params が JSON）→ これまでどおり url_params と landing_params に同じ値
- v2.2.199 の自社フォームの通しテスト（A〜G）をもう一度流し、結果は前回と同じ
- ① 経由：トークン無しで `tracking_touches` → 401
- 後片付け：テストの予約2件・tracking_* のテスト行を削除（テスト前は 0 件）
- ⚠️ メモ：リンクを書き換えると、元からある値は URL エンコードし直される（`kc_source=kh-house.jp/` → `kh-house.jp%2F`）。意味は同じ。

## 追記（2026-10-20）：GTM 担当者への依頼文 ／ 全ブランドのコンテナに同じタグ
- 見学クラウドは全ブランドが使い、ブランドのページによって GTM のコンテナが違う。送信タグ v5・トラッキングのタグとも、全ブランドのコンテナに同じものを入れてよい（送信タグはブランドをタグの中で判定、見学クラウドはドメインが1つなのでサイトキーも1つ）。
- 1ページに自社のコンテナが2つ入るページでは tracker.js が2回動き、見学クラウドへの直接の広告着地が2回記録される。対策（同じページで2回目は何もしない）を提案したが「そのままでよい」との判断。tracker.js は変えていない。
- 依頼文：`Downloads/GTM担当者への依頼_見学クラウド_v2.2.201.txt`（リポジトリ外）。ファイル名だと漏れが出るため、送信タグ v5 とトラッキングのタグの script 全文を文面に入れた（添付なし）。トラッキングのタグのサイトキーは `【見学クラウドのサイトキー】` のままなので、本番で登録してから置き換えて送る。
- 見学クラウド用のタグは、ダッシュボードのトラッキング設定で見学クラウドを登録して発行する（デプロイ手順書の手順4）。
- docs/deploy-v2.2.201.md の手順5を「全ブランドのコンテナに同じファイル・同じタグ」に書き直した。

## 追記（2026-10-20）：依頼文に保存タグ（gtm_reserve_save_v3）も入れる
- 指摘「save のファイルの script がない」。公開中の GTM（GTM-KRKCML59 tag id 25 ／ GTM-5B9M9KGV id 19）の保存タグは v3 より前の版で、トリガーが /reserve/confirm だけ → 最初のページの URL パラメータを覚えない（依頼の「今の仕様では params が取れない」の原因）。
- 手元の `Downloads/gtm_reserve_save_v3.html`（2026-10-12 作成。トリガー DOM Ready・すべてのページ）はこれを直した版だが、GTM には未反映だった。
- 確認（Playwright、v3 の中身そのもの）：イベントページ `?kc_source=…&utm_source=google&khg_vid=…` → url_params に3つとも保存。予約画面 `/reserve/new?reserve_event[date]=…&_gl=…` に移っても前の値は消えず足される。ページのエラー 0。構文チェック OK。
- 依頼文を3タグ（1 保存 v3 ＋ トリガー変更、2 送信 v5、3 トラッキング）の全文入りに作り直した。手順書の手順5に 0（保存タグ）を足した。

---

## 追記（2026-10-20）：広告以外の訪問（自然検索・直接など）も記録する（② だけ）

### 依頼
- 「パラメータなし（オーガニック）でもカウントしたい（アクセス数解析のため）」
- 「タグを埋め込み直す必要があるなら計画はやめる。② だけで実装可能なら進めたい」→ タグは tracker.js を読み込むだけなので貼り直し不要。DB の構造も変えない計画を承認。「同じブランチでよい」
- 「201 の次にページビュー実装及び TrackingSettings.tsx の改修をする」→ 次の版（v2.2.202）で行う。今回はやらない。

### 仕組み
- tracker.js：1回の訪問（最後に開いたページから30分以内は同じ訪問。localStorage `khg_last`）につき1件、広告のパラメータが無くても送る。
  - 流入元はリファラーから：`direct` ／ `organic/google|yahoo|bing` ／ `social/instagram|facebook|x|line|youtube|tiktok` ／ `referral/ドメイン`
  - 自社サイト（同じドメイン・LINK_HOSTS）からの移動、顧客IDを引き継いで来たときは数えない。広告のパラメータ付きは今までどおり毎回記録。
- ②：パラメータが無くても、流入元が決まった形（`ORGANIC_SOURCE_PATTERN`）なら `tracking_touches` に保存（広告の列はすべて NULL、source に流入元）。ロボット（User-Agent に bot・crawl・spider・headless など）は広告も含めて保存しない。
- 今の画面は変えない：トラッキング設定の件数・最後の着地、反響一覧の流入履歴は、広告の分（`AD_TOUCH_SQL`：広告の列のどれかが NULL でない）だけ。
- DB の構造・① の PHP・フロント・タグは変更なし。

### 変えたファイル・関数
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/public | **tracker.js** | `VISIT_MS`・`visit`（訪問の判定）・`channel`（流入元）・`send`（送信を広告と共通に）を追加。広告が無いページでも新しい訪問なら `source` を付けて送る |
| backend-express/src/features/tracking | **params.ts** | `AD_TOUCH_SQL`・`ORGANIC_SOURCE_PATTERN`・`BOT_UA_PATTERN` を追加 |
| 〃 | **touch.ts** | `recordTouch`：ロボットを捨てる。パラメータが無いときは `source` を検査して保存 |
| 〃 | **sites.ts** | `listTrackingSites`：件数・最後の着地を広告の分だけに |
| 〃 | **touches.ts** | `listInquiryTouches`：広告の着地だけを返す |

### 差分（v2.2.201 のこれまでの分を含む backend-express 全体）
```diff
diff --git a/backend-express/public/tracker.js b/backend-express/public/tracker.js
index 87f16735..a12daf93 100644
--- a/backend-express/public/tracker.js
+++ b/backend-express/public/tracker.js
@@ -87,14 +87,64 @@
     };
     document.addEventListener('mousedown', decorate, true);
     document.addEventListener('click', decorate, true);
+    // ⚠️ v2.2.201 広告以外の訪問も数える（アクセス数の解析用）。1回の訪問につき1件。最後に開いたページから30分たったら次の訪問
+    var VISIT_MS = 30 * 60 * 1000;
+    var visit = function () {
+      var now = Date.now();
+      var last = Number(store.getItem('khg_last') || 0);
+      store.setItem('khg_last', String(now));
+      return !(last > 0 && now - last < VISIT_MS);
+    };
+    // ⚠️ 流入元はどこから来たか（リファラー）で決める。⚠️ ② の ORGANIC_SOURCE_PATTERN と同じ形。自社サイトからの移動は '' （数えない）
+    var channel = function (ref) {
+      var h = '';
+      try { h = ref ? bare(new URL(ref).hostname) : ''; } catch (e) { h = ''; }
+      if (!h) return 'direct';
+      if (h === bare(window.location.hostname) || LINK_HOSTS.indexOf(h) >= 0) return '';
+      if (/google/.test(h)) return 'organic/google';
+      if (/yahoo/.test(h)) return 'organic/yahoo';
+      if (/(^|\.)bing\.com$/.test(h)) return 'organic/bing';
+      if (/instagram/.test(h)) return 'social/instagram';
+      if (/facebook|^fb\.me$/.test(h)) return 'social/facebook';
+      if (/^(t\.co|x\.com|twitter\.com)$/.test(h)) return 'social/x';
+      if (/(^|\.)line\.me$|naver\.line/.test(h)) return 'social/line';
+      if (/youtube/.test(h)) return 'social/youtube';
+      if (/tiktok/.test(h)) return 'social/tiktok';
+      return 'referral/' + h.replace(/[^a-z0-9.-]/g, '').slice(0, 150);
+    };
+    // ⚠️ text/plain で送る（CORS のプリフライトを起こさない）。⚠️ 結果は使わない
+    var send = function (extra) {
+      var payload = {
+        site_key: siteKey, visitor_id: visitor(),
+        landing_url: (url.origin + url.pathname).slice(0, 2000),
+        referrer: (document.referrer || '').slice(0, 2000),
+      };
+      Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });
+      var body = JSON.stringify(payload);
+      var sent = false;
+      try {
+        if (navigator.sendBeacon) sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
+      } catch (e) { sent = false; }
+      if (!sent && window.fetch) {
+        window.fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
+          .catch(function () { return null; });
+      }
+    };
+    var isNewVisit = visit();
     var params = {};
     var found = false;
     KEYS.forEach(function (k) {
       var v = url.searchParams.get(k);
       if (v !== null && v !== '') { params[k] = v.slice(0, MAX); found = true; }
     });
-    // ⚠️ 広告のパラメータが無いページ（自然検索・直接・回遊）では、前の値を消さない・送らない
-    if (!found) { repair(); keep(); return; }
+    // ⚠️ 広告のパラメータが無いページ（自然検索・直接・回遊）では、前の値を消さない。⚠️ 新しい訪問のときだけ流入元を付けて送る
+    if (!found) {
+      repair();
+      keep();
+      var ch = passed || !isNewVisit ? '' : channel(document.referrer);
+      if (ch) send({ params: {}, source: ch });
+      return;
+    }
     var vid = visitor();
     window.khgVisitorId = vid;
     var query = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); });
@@ -108,20 +158,7 @@
     if (params.utm_campaign) store.setItem('campaign', params.utm_campaign);
     // ⚠️ v2.2.201 自社サイトから引き継いだ広告の情報は、元のサイトで着地を記録済み。二重に数えないよう送らない
     if (passed) return;
-    var body = JSON.stringify({
-      site_key: siteKey, visitor_id: vid, params: params,
-      landing_url: (url.origin + url.pathname).slice(0, 2000),
-      referrer: (document.referrer || '').slice(0, 2000),
-    });
-    // ⚠️ text/plain で送る（CORS のプリフライトを起こさない）。⚠️ 結果は使わない
-    var sent = false;
-    try {
-      if (navigator.sendBeacon) sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
-    } catch (e) { sent = false; }
-    if (!sent && window.fetch) {
-      window.fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
-        .catch(function () { return null; });
-    }
+    send({ params: params });
   } catch (e) {
     // 何もしない（プライベートブラウズで localStorage が使えないときなど）
   }
diff --git a/backend-express/src/features/tracking/params.ts b/backend-express/src/features/tracking/params.ts
index 48dc1680..47cb28ec 100644
--- a/backend-express/src/features/tracking/params.ts
+++ b/backend-express/src/features/tracking/params.ts
@@ -66,4 +66,19 @@ export const parseLandingParams = (text: string | null | undefined): Record<stri
   return result;
 };
 
-export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
+/**
+ * 広告の着地か（v2.2.201）。⚠️ 広告以外の訪問（自然検索・直接など）は、対象のキーの列がすべて NULL。
+ * ⚠️ tracking_touches の別名を t にして使う。⚠️ 今の画面（設定の件数・流入履歴）は広告の分だけを出す。
+ */
+export const AD_TOUCH_SQL = `(${Object.keys(TRACKING_KEYS).map((k) => `t.${k} IS NOT NULL`).join(' OR ')})`;
+
+/**
+ * 広告以外の訪問の流入元（v2.2.201）。⚠️ tracker.js の channel() が作る形だけを受ける。
+ *   direct ／ organic/google ／ social/instagram ／ referral/example.com
+ */
+export const ORGANIC_SOURCE_PATTERN = /^(direct|organic\/[a-z]{1,20}|social\/[a-z]{1,20}|referral\/[a-z0-9.-]{1,150})$/;
+
+/** ロボット（検索エンジンの巡回・表示確認の道具）。⚠️ 訪問として数えない */
+export const BOT_UA_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse|preview/i;
+
+export const UUID_PATTERN =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
diff --git a/backend-express/src/features/tracking/sites.ts b/backend-express/src/features/tracking/sites.ts
index c927cef2..3b2fdeed 100644
--- a/backend-express/src/features/tracking/sites.ts
+++ b/backend-express/src/features/tracking/sites.ts
@@ -2,6 +2,7 @@ import { randomBytes } from 'crypto';
 import type { RowDataPacket } from 'mysql2/promise';
 import { execute, query } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
+import { AD_TOUCH_SQL } from './params';
 import { clearTrackingSiteCache, normalizeOrigin, parseOrigins } from './touch';
 
 /**
@@ -42,14 +43,14 @@ export interface TrackingResult {
 const ok = (body: Record<string, unknown>): TrackingResult => ({ httpStatus: 200, body: { status: 'ok', ...body } });
 const fail = (httpStatus: number, message: string): TrackingResult => ({ httpStatus, body: { status: 'error', message } });
 
-/** 一覧（⚠️ 運用の確認用に、直近30日の着地数と最後の着地も返す） */
+/** 一覧（⚠️ 運用の確認用に、直近30日の着地数と最後の着地も返す。⚠️ 画面の見出しが「広告からの着地」なので広告の分だけ数える） */
 export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promise<TrackingResult> => {
   if (!canManageTracking(staff)) return fail(403, 'この画面は管理者だけが使えます。');
   const rows = await query<SiteRow>(
     `SELECT s.id, s.site_key, s.name, s.brand, s.allowed_origins, s.is_active, s.memo, s.updated_by,
             DATE_FORMAT(s.updated_at, '%Y-%m-%d %H:%i') AS updated_at,
-            (SELECT COUNT(*) FROM tracking_touches t WHERE t.site_id = s.id AND t.created_at >= NOW() - INTERVAL 30 DAY) AS touches_30d,
-            (SELECT DATE_FORMAT(MAX(t.created_at), '%Y-%m-%d %H:%i') FROM tracking_touches t WHERE t.site_id = s.id) AS last_touch
+            (SELECT COUNT(*) FROM tracking_touches t WHERE t.site_id = s.id AND t.created_at >= NOW() - INTERVAL 30 DAY AND ${AD_TOUCH_SQL}) AS touches_30d,
+            (SELECT DATE_FORMAT(MAX(t.created_at), '%Y-%m-%d %H:%i') FROM tracking_touches t WHERE t.site_id = s.id AND ${AD_TOUCH_SQL}) AS last_touch
        FROM tracking_sites s
       ORDER BY s.is_active DESC, s.id`
   );
diff --git a/backend-express/src/features/tracking/touch.ts b/backend-express/src/features/tracking/touch.ts
index 0ac8b682..81b707f3 100644
--- a/backend-express/src/features/tracking/touch.ts
+++ b/backend-express/src/features/tracking/touch.ts
@@ -3,14 +3,15 @@ import type { RowDataPacket } from 'mysql2/promise';
 import { env } from '../../config/env';
 import { execute, query } from '../../db/pool';
 import { logger } from '../../utils/logger';
-import { TRACKING_KEYS, UUID_PATTERN, pickTrackingParams, sourceOf } from './params';
+import { BOT_UA_PATTERN, ORGANIC_SOURCE_PATTERN, TRACKING_KEYS, UUID_PATTERN, pickTrackingParams, sourceOf } from './params';
 
 /**
  * 着地の受け付け（v2.2.199。`POST /api/track/touch`。⚠️ 公開・認証なし）。
  *
  * ─────────────────────────────────────────────
  * ⚠️⚠️ **社外の誰でも叩ける書き込み口。リクエストの値を信用しない。**
- *   ⚠️ 保存するのは、登録済み・有効なサイトの・許可したオリジンからの・UUID の訪問者の・対象キーがある着地だけ。
+ *   ⚠️ 保存するのは、登録済み・有効なサイトの・許可したオリジンからの・UUID の訪問者の、
+ *     対象キーがある着地（広告）か、決まった形の流入元（自然検索・直接など。v2.2.201〜）がある訪問だけ。⚠️ ロボットは保存しない。
  * ⚠️ 応答は成功・失敗とも 204（publicRouter.ts）。⚠️ 理由はログにだけ出す（ブラウザは結果を使わない）。
  * ⚠️ IP は保存しない。⚠️ SHA-256（ソルト付き）だけ。ソルトは `.env` の TRACKING_IP_SALT（未設定なら ip_hash は NULL）。
  * ─────────────────────────────────────────────
@@ -111,13 +112,22 @@ export const recordTouch = async ({ body, origin, ip, userAgent }: TouchInput):
   if (origin === '' || !site.origins.includes(normalizeOrigin(origin))) return reject(`許可していないオリジン site_id=${site.id}`);
   const visitorId = typeof b.visitor_id === 'string' ? b.visitor_id.toLowerCase() : '';
   if (!UUID_PATTERN.test(visitorId)) return reject('訪問者IDが UUID ではない');
+  if (BOT_UA_PATTERN.test(userAgent)) return reject('ロボットのアクセス');
   const params = pickTrackingParams(b.params);
-  if (Object.keys(params).length === 0) return reject('対象のパラメータが無い');
+  let source: string | null;
+  if (Object.keys(params).length > 0) {
+    source = sourceOf(params);
+  } else {
+    // ⚠️ v2.2.201 広告以外の訪問。⚠️ 流入元は tracker.js が決めた形だけを受ける（自由な文字列は入れさせない）
+    const organic = typeof b.source === 'string' ? b.source : '';
+    if (!ORGANIC_SOURCE_PATTERN.test(organic)) return reject('対象のパラメータも流入元も無い');
+    source = organic;
+  }
 
   const keys = Object.keys(TRACKING_KEYS);
   const columns = ['site_id', 'visitor_id', 'source', ...keys, 'landing_url', 'referrer', 'user_agent', 'ip_hash'];
   const values = [
-    site.id, visitorId, sourceOf(params), ...keys.map((k) => params[k] ?? null),
+    site.id, visitorId, source, ...keys.map((k) => params[k] ?? null),
     text(b.landing_url, 2000), text(b.referrer, 2000), text(userAgent, 500), hashIp(ip),
   ];
   await execute(`INSERT INTO tracking_touches (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
diff --git a/backend-express/src/features/tracking/touches.ts b/backend-express/src/features/tracking/touches.ts
index fde58738..b301d325 100644
--- a/backend-express/src/features/tracking/touches.ts
+++ b/backend-express/src/features/tracking/touches.ts
@@ -1,6 +1,6 @@
 import type { RowDataPacket } from 'mysql2/promise';
 import { query } from '../../db/pool';
-import { CLICK_ID_KEYS, TRACKING_KEYS, UUID_PATTERN, parseLandingParams, sourceOf } from './params';
+import { AD_TOUCH_SQL, CLICK_ID_KEYS, TRACKING_KEYS, UUID_PATTERN, parseLandingParams, sourceOf } from './params';
 
 /**
  * 反響に結びつく着地の履歴（v2.2.199）。画面は list/TrackingTouches.tsx（反響一覧（注文）の「流入」）。
@@ -11,6 +11,7 @@ import { CLICK_ID_KEYS, TRACKING_KEYS, UUID_PATTERN, parseLandingParams, sourceO
  *   2. 無ければ gclid / gbraid / wbraid / fbclid / yclid のどれかが一致する行
  *     ⚠️ タグを貼る前の反響など、khg_vid が無いとき用（⚠️ tracker.js が landing_params に khg_vid を付け直し続けるので、タグのあるページからの反響には付く）
  * ⚠️ url_params（送信したページの ? 以降）は見ない。⚠️ tracker.js は URL を書き換えないので khg_vid は入らない。
+ * ⚠️ 広告の着地だけを返す（v2.2.201〜 広告以外の訪問も記録しているが、画面の見出しが「広告からの着地」のため）。
  * ⚠️ landing_params が空・見つからなければ、空の配列（⚠️ エラーにしない）。
  * ⚠️ 流入元（source）・キャンペーンは反響に保存されていないので、landing_params から読み取って返す（2026-10-20 の指示）。
  * ─────────────────────────────────────────────
@@ -64,7 +65,7 @@ export const listInquiryTouches = async (inquiryIdValue: unknown): Promise<{ htt
       `SELECT t.id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, s.name AS site_name, t.source,
               ${Object.keys(TRACKING_KEYS).map((k) => `t.${k}`).join(', ')}, t.landing_url, t.referrer
          FROM tracking_touches t LEFT JOIN tracking_sites s ON s.id = t.site_id
-        WHERE ${where}
+        WHERE (${where}) AND ${AD_TOUCH_SQL}
         ORDER BY t.created_at DESC, t.id DESC
         LIMIT ${LIMIT}`,
       params
```

### 確認
- ② 型チェック OK、tracker.js 構文 OK、ローカル ② 再起動。
- Playwright（kh-house.jp を模擬、ふつうのブラウザの User-Agent）
  - Google から → `organic/google` で1件。サイト内の移動・30分以内の再訪 → 増えない。31分後の直接 → `direct`。Instagram から → `social/instagram`。他のブログから → `referral/other-blog.example.com`。同じ訪問中に広告付き → 広告として1件（landing_params は広告の値＋khg_vid）。ページのエラー 0
  - Googlebot の User-Agent → ② が「ロボットのアクセス」で保存しない
- DB：保存された5件の source が上のとおり（広告以外は utm 等が NULL）
- トラッキング設定の件数：広告の1件だけ（広告以外の4件は数えない）
- 流入履歴（同じ顧客IDの反響）：広告の着地1件だけ（matchedBy khg_vid）
- 自社フォームの通し（A〜G）・見学クラウドの通し（H〜J）をもう一度流し、前と同じ結果。引き継いで来た訪問は数えない
- 後片付け：テストの予約・反響・tracking_* を削除（テスト前は 0 件）
