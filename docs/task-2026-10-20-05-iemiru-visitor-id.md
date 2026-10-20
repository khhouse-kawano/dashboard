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
