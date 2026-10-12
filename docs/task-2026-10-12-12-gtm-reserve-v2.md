# 2026-10-12 v2.2.190 見学クラウドの GTM タグ（保存 v2・送信 v3）

## 依頼
- 追加: 実際のブランドのアカウントは `/yoyaku/khkagoshima/`・`/yoyaku/djhsendai/`・`/yoyaku/ngmkagoshima/`・`/yoyaku/2lkagoshima/` のような URL。これでも動くように
- 「送信のあと指定のページへ移動しない」→ GTM タグの問題
- kokubuhousinggroup でも動く gtm_reserve_save.html を作る。ブランド指定の URL と kokubuhousinggroup のどちらでも動くように

## 調べたこと（公開中の GTM-5B9M9KGV を gtm.js から読んだ）
| タグ | トリガー | 中身 |
|---|---|---|
| 予約内容の保存 | URL に `/reserve/confirm` を含む・DOM Ready | ⚠️ 全体が `/\/yoyaku\/(djh\|kh\|ngm\|2l)/i.test(pathname)` の中。`/cms/yoyaku/kokubuhousinggroup/…` では**何もしない**（reserveData も url_params も保存されない）。ブランドは URL から（kh→KH, djh→DJH, ngm→なごみ, 2l→2L） |
| 予約内容の送信 | URL に `/complete` と `/kokubuhousinggroup` を含む・Window Loaded | gtm_reserve_send_v2.html と同じ。⚠️ ブランド指定の URL では動かない |
- 送信タグは動けば必ず移動する（データが空でも即移動）。偽のページで確認済み → 移動しないのは完了画面でタグが動いていない（URL に /complete が無い、または Window Loaded にならない）と考えられる。完了画面の URL は未確認

## 作ったもの（Downloads。リポジトリ外）
| ファイル | 内容 |
|---|---|
| **gtm_reserve_save_v2.html** | 動く条件 `/yoyaku/(kokubuhousinggroup\|(djh\|kh\|ngm\|2l)[a-z0-9_-]*)(/\|$)`（ブランドのアカウントは khkagoshima・djhsendai・ngmkagoshima・2lkagoshima のように**頭がブランド**）。ブランドはブランドのアカウントなら頭の kh・djh・ngm・2l から、kokubuhousinggroup なら `<title>` の【】から（分からなければ KH）。URL パラメータは `/reserve/` を含むページでは保存しない（予約画面の reserve_event[date]・commit・_gl で utm を上書きしないため）。それ以外は公開版と同じ |
| **gtm_reserve_send_v3.html** | v2 の動く条件を上と同じに。サンクスページに なごみ（nagomi-koumuten.jp/event_ok/）・2L（2lhome.net/thanks/?referer=reserve）・JH（jusfy-home.com/reservation_ok/）を追加（form_get の brands.ts と同じ） |
- GTM のトリガー（ファイル冒頭に記載）
  - 保存: DOM Ready、Page Path が正規表現 `/yoyaku/(kokubuhousinggroup|(djh|kh|ngm|2l)[^/]*)(/|$)` に一致（⚠️ 確認画面だけに絞らない）
  - 送信: Window Loaded、Page Path が正規表現 `/yoyaku/(kokubuhousinggroup|(djh|kh|ngm|2l)[^/]*)/.*/complete` に一致

## 確認（Playwright。⚠️ 偽の見学クラウドのページ、通信はすべて横取り）
| # | ページ | 結果 |
|---|---|---|
| 1 | `/cms/yoyaku/kokubuhousinggroup/events/1?utm_source=instagram&utm_campaign=autumn` | url_params `{"utm_source":"instagram","utm_campaign":"autumn"}` |
| 2 | `…/reserve/new?reserve_event[date]=…&commit=…&_gl=…` | url_params は 1 のまま（上書きしない） |
| 3 | `/kokubuhousinggroup/…/reserve/confirm`（title【デイジャストハウス】） | brand DJH、shop `DJH霧島店`、line_id、reserved_date `2026-10-15`・reserved_time `10:00`、full_address |
| 4 | `/khkagoshima/`・`/djhsendai/`・`/ngmkagoshima/`・`/2lkagoshima/` の `…/reserve/confirm`（title はすべて【国分ハウジング】） | brand KH・DJH・なごみ・2L（アカウント名が優先）、shop の頭もそれぞれ補正 |
| 4b | `/djhsendai/events/146108?utm_source=google` | url_params `{"utm_source":"google"}` |
| 5 | `/other/…`（対象外） | 何も保存しない |
| 6 | `/ngmkagoshima/…/reserve/complete` | api.khg-marketing.info へ送信（request=kengaku_cloud…url_params=JSON）→ nagomi-koumuten.jp/event_ok/ へ移動 |

## 追記: 店舗（shop）が送られない
- 実際のページのタイトル（公開ページを読んで確認）
  | アカウント | `<title>` |
  |---|---|
  | khmiyazaki | 【全店舗開催】国分ハウジングのモデルハウス見学会 \| 国分ハウジング 宮崎店 |
  | djhsendai | 《薩摩川内市中郷町》お客様のお家完成見学会 \| DAY JUST HOUSE 薩摩川内店 |
  | ngmkagoshima | 新生活が見える！出水市完成見学会へ \| なごみ工務店 鹿児島店 |
  | 2lkagoshima | シングルマザーのためのおうちづくり相談会 \| 2Lhome 鹿児島店 |
  | kokubuhousinggroup | 【国分ハウジング】無人モデルハウス 自由に見学DAY！ \| 株式会社国分ハウジング |
- 変更（gtm_reserve_save_v2.html）
  - 予約内容の表で、見出しに「店舗」を含む行は `shop` として読む（keyMap に無い場合）
  - 表に店舗が無く、kokubuhousinggroup 以外なら、`<title>` の最後の `|` のあとの末尾「○○店」を `shop` に → 既存の補正でブランドの頭が付く（例 KH宮崎店）
  - ⚠️ kokubuhousinggroup は表に店舗の行が無いと空のまま（タイトルに店舗名が無いため）
- 確認（偽のページに実際のタイトル）: khmiyazaki → `KH宮崎店`、djhsendai → `DJH薩摩川内店`、ngmkagoshima → `なごみ鹿児島店`、2lkagoshima → `2L鹿児島店`、kokubuhousinggroup → 空、kokubuhousinggroup ＋ 表に「ご来場店舗：霧島店」（タイトル【デイジャストハウス】）→ `DJH霧島店`
- ⚠️ 確認画面の `<title>` も同じ形であることは未確認（予約入力・イベントのページで確認）

## gtm_reserve_save_v2.html（全文）
```html
<!--
  GTM カスタムHTMLタグ: URLパラメータ保存 ＋ 予約内容の保存（確認画面）  v2

  【v2 の変更点】
  - 動くページ: ブランドのアカウント（/yoyaku/khkagoshima/ ・ /yoyaku/djhsendai/ ・ /yoyaku/ngmkagoshima/ ・
                /yoyaku/2lkagoshima/ のように kh・djh・ngm・2l で始まるもの）と
                /yoyaku/kokubuhousinggroup/（グループ共通）のどちらでも動く
  - ブランドの決め方:
      ブランドのアカウント        → アカウント名の頭から（kh→KH / djh→DJH / ngm→なごみ / 2l→2L）
      kokubuhousinggroup の URL  → <title> の【】から（国分ハウジング→KH ／ デイジャストハウス→DJH ／
                                    なごみ工務店→なごみ ／ ジャスフィーホーム→JH ／ ニーエルホーム→2L。分からなければ KH）
  - 店舗（shop）: ブランドのアカウントは <title> の「… | 国分ハウジング 宮崎店」の最後の「○○店」から（→ KH宮崎店）。
      予約内容の表に「店舗」を含む見出しの行があればそちらを優先（kokubuhousinggroup はこの行が無いと空のまま）
  - URL パラメータ（? 以降）は「予約の手続き中のページ（/reserve/ を含む）」では保存しない
    （予約画面の URL には reserve_event[date]・commit・_gl などが付き、広告から来たときの utm_… を上書きしてしまうため）
  - それ以外（見出しで key を決める・LINE ID・予約日時の読み取り・店舗名の補正）は今の公開版と同じ

  【GTM設定】
  - トリガー: ページビュー - DOM Ready
      条件: Page Path が 正規表現に一致 /yoyaku/(kokubuhousinggroup|(djh|kh|ngm|2l)[^/]*)(/|$)
      ⚠️ 確認画面だけに絞らないこと（流入ページの URL パラメータを覚えるため）。予約内容の保存は確認画面でだけ動く
-->
<script>
(function () {
  var pathMatch = window.location.pathname.match(/\/yoyaku\/(kokubuhousinggroup|(?:djh|kh|ngm|2l)[a-z0-9_-]*)(\/|$)/i);
  if (!pathMatch) return;
  var account = pathMatch[1].toLowerCase();

  // ========================================================
  // 0. URLパラメータ（?以降）を url_params として保存
  //    ⚠️ 予約の手続き中のページ（/reserve/）では保存しない
  // ========================================================
  var query = window.location.search.replace(/^\?/, "");
  if (query && window.location.pathname.indexOf("/reserve/") === -1) {
    var urlParams = {};
    var pairs = query.split("&");
    for (var p = 0; p < pairs.length; p++) {
      if (!pairs[p]) continue;
      var eq = pairs[p].indexOf("=");
      var pk = eq >= 0 ? pairs[p].slice(0, eq) : pairs[p];
      var pv = eq >= 0 ? pairs[p].slice(eq + 1) : "";
      try {
        pk = decodeURIComponent(pk.replace(/\+/g, " "));
        pv = decodeURIComponent(pv.replace(/\+/g, " "));
      } catch (e) {}
      if (pk) urlParams[pk] = pv;
    }
    try {
      localStorage.setItem("url_params", JSON.stringify(urlParams));
    } catch (e) {
      console.error("url_paramsの保存に失敗しました", e);
    }
  }

  // 予約内容テーブルが無いページではここで終了
  var table = document.querySelector(".reserve-form__customer-info-table");
  if (!table) return;

  var postData = {};

  // 1. OGPタイトルの取得とキャンペーン名の抽出
  var meta = document.querySelector('meta[property="og:title"]');
  var ogTitle = meta ? meta.getAttribute("content") : "";
  var titleParts = ogTitle.split("|");
  postData.campaign = titleParts.length > 0 ? titleParts[0].trim() : "";

  // ========================================================
  // ブランド: ブランドのアカウント（khkagoshima など）なら頭の kh・djh・ngm・2l から、kokubuhousinggroup なら <title> の【】から
  // ========================================================
  var accountBrand = { kh: "KH", djh: "DJH", ngm: "なごみ", "2l": "2L" };
  var titleBrand = {
    "国分ハウジング": "KH",
    "デイジャストハウス": "DJH",
    "なごみ工務店": "なごみ",
    "ジャスフィーホーム": "JH",
    "ニーエルホーム": "2L",
  };
  var detectedBrand = "KH"; // 分からなければ KH
  var accountPrefix = account.match(/^(djh|kh|ngm|2l)/);
  if (account !== "kokubuhousinggroup" && accountPrefix) {
    detectedBrand = accountBrand[accountPrefix[1]];
  } else {
    var titleMatch = (document.title || "").match(/【([^】]+)】/);
    if (titleMatch && titleBrand[titleMatch[1].trim()]) {
      detectedBrand = titleBrand[titleMatch[1].trim()];
    }
  }
  postData.brand = detectedBrand;

  // ========================================================
  // 2. フォームデータの取得（先頭列の見出しで key を判断）
  // ========================================================
  // 見出し → key。未登録の見出しは見出し文字列をそのまま key にする
  var keyMap = {
    "姓名": "name",
    "せいめい": "kana",
    "メールアドレス": "mail",
    "電話番号": "mobile",
    "都道府県": "pref",
    "市区町村": "town",
    "番地": "street",
    "建物名・部屋番号": "building",
    "ご年齢": "age",
    "ご予約のきっかけ": "medium",
    "来場予約特典条件": "benefit_agreement",
    "質問・ご連絡事項": "message",
    "LINEID": "line_id",
  };

  // 見出しの表記ゆれ吸収: 空白・【】を除去し、全角英数を半角に（LINE ID は "LINEID" に統一）
  function normalizeLabel(text) {
    return text
      .replace(/[【】\s　]/g, "")
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
      })
      .replace(/^lineid$/i, "LINEID");
  }

  function cellValue(td) {
    var multi = td.querySelectorAll(".custom-form__multiple-value");
    if (multi.length) {
      var values = [];
      for (var m = 0; m < multi.length; m++) {
        values.push(multi[m].textContent.trim());
      }
      return values.join(",");
    }
    return td.textContent.replace(/\s+/g, " ").trim();
  }

  var rows = table.querySelectorAll("tr");
  for (var r = 0; r < rows.length; r++) {
    var cells = rows[r].querySelectorAll("td, th");
    if (cells.length < 2) continue;
    var label = normalizeLabel(cells[0].textContent);
    if (!label) continue;
    var key = keyMap.hasOwnProperty(label) ? keyMap[label] : /店舗/.test(label) ? "shop" : label;
    var text = cellValue(cells[1]);

    if (key === "pref" || key === "town" || key === "street" || key === "building") {
      postData["full_address"] = (postData["full_address"] || "") + text;
    } else {
      postData[key] = text;
    }
  }

  // 予約日時（テーブル外の見出し）
  var dateNode = document.evaluate(
    "/html/body/div[3]/div/h3",
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
  postData.reserved_date = dateNode && dateNode.textContent ? dateNode.textContent.trim() : "";

  // 店舗: 表に無ければ、ブランドのアカウントは <title> の最後の「| ブランド名 ○○店」から
  //   例）「【全店舗開催】… | 国分ハウジング 宮崎店」→「宮崎店」（下の補正で KH宮崎店 になる）
  if (!postData.shop && account !== "kokubuhousinggroup") {
    var titleParts2 = (document.title || "").split("|");
    var shopMatch = titleParts2[titleParts2.length - 1].trim().match(/(\S+店)$/);
    if (titleParts2.length > 1 && shopMatch) {
      postData.shop = shopMatch[1];
    }
  }

  // 補正: shop のブランド名を正しいもの（postData.brand）に強制補正
  if (postData.shop) {
    var pureShopName = postData.shop.replace(/^(KH|DJH|JH|2L|なごみ)/, "");
    postData.shop = postData.brand + pureShopName;
  }

  // 3. 予約日時のパース処理
  if (postData.reserved_date) {
    var dateText = postData.reserved_date;
    var match = dateText.match(/(\d{4})年(\d{2})月(\d{2})日/);
    if (match) {
      postData.reserved_date = match[1] + "-" + match[2] + "-" + match[3];
    }
    var timeMatch = dateText.match(/(\d{2}:\d{2})/);
    if (timeMatch) {
      postData.reserved_time = timeMatch[1];
    }
  }

  // 4. 取得したデータをlocalStorageに保存
  try {
    localStorage.setItem("reserveData", JSON.stringify(postData));
  } catch (e) {
    console.error("localStorageへの保存に失敗しました", e);
  }

  console.log(postData);
  if (!postData.name) {
    console.log("顧客情報の取得に失敗しました");
  }
})();
</script>
```

## gtm_reserve_send_v3.html（v2 との差分）
```diff
--- /c/Users/shinji-kawano/Downloads/gtm_reserve_send_v2.html	2026-10-12 18:14:27.734637000 +0900
+++ /c/Users/shinji-kawano/Downloads/gtm_reserve_send_v3.html	2026-10-12 18:55:10.996660000 +0900
@@ -1,6 +1,14 @@
 <!--
   GTM カスタムHTMLタグ: 予約内容のAPI送信 → サンクスページへリダイレクト
 
+  【変更点（v3）】
+  - 動くページ: ブランドのアカウント（/yoyaku/khkagoshima/ など kh・djh・ngm・2l で始まるもの）と
+                /yoyaku/kokubuhousinggroup/ のどちらでも動く（gtm_reserve_save_v2.html と同じ条件）
+  - 送信後のサンクスページに なごみ・2L・JH を追加（今まではどれも国分ハウジングのトップへ移っていた）
+  - GTM のトリガー: ページビュー - ウィンドウの読み込み（Window Loaded）
+      条件: Page Path が 正規表現に一致 /yoyaku/(kokubuhousinggroup|(djh|kh|ngm|2l)[^/]*)/.*/complete
+      ⚠️ 完了画面の URL に /complete が入っていることを確認すること
+
   【変更点（v2）】
   - 送信先を https://api.khg-marketing.info/api/gateway に変更（旧: https://khg-marketing.info/api/kengakuCloud/all/）
   - 送信データに request=kengaku_cloud / roll=entry を追加（新しい送信先はこの2つで受け口を決める）
@@ -9,7 +17,7 @@
   （トリガー等の GTM 設定・gtm_reserve_save.html は変更なし）
 -->
 <script>
-if (window.location.href.indexOf("kokubuhousinggroup") !== -1) {
+if (/\/yoyaku\/(kokubuhousinggroup|(?:djh|kh|ngm|2l)[a-z0-9_-]*)(\/|$)/i.test(window.location.pathname)) {
   (function () {
     // 1. データの読み込み
     try {
@@ -29,6 +37,9 @@
     var brandMap = {
       KH: "https://kh-house.jp/event_ok/",
       DJH: "https://day-just-house.com/thanks-event/",
+      "なごみ": "https://www.nagomi-koumuten.jp/event_ok/",
+      "2L": "https://2lhome.net/thanks/?referer=reserve",
+      JH: "https://jusfy-home.com/reservation_ok/",
     };
 
     // 正しいサンクスURLを決定（brandValueがなければKHのトップへ）
```
