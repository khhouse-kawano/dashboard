# 2026-10-12 v2.2.190 見学クラウドの予約を ② で受ける（kengaku_cloud:entry）

## 依頼
- `Downloads/gtm_reserve_send.html`・`gtm_reserve_save.html`（見学クラウドの GTM カスタム HTML）の送信先を `api.khg-marketing.info` に向けたい
- そのためのバックエンドを新しいブランチで作る（inquiry_customer へ保存）
- カスタム HTML は別のエンジニアが作るので、新しい送信先も伝える
- 移植元（① `khg-marketing.info/api/kengakuCloud/all/`）の PHP は利用者から受け取った（リポジトリには無い）

## 移植元（①）の動き
- `$_POST` の name / kana / mail / mobile / full_address / brand / shop / campaign / medium / reserved_date / age / reserved_time
- 必須: name・kana・mail・mobile（空なら `{"status":"error","message":"未入力項目があります"}`）
- inquiry_id `kengakucloud_Ymd_His`（Asia/Tokyo）、inquiry_date `Y/m/d`
- INSERT 13 列: first_name=name, first_name_kana=kana, mail, mobile, building=full_address, inquiry_date, brand, shop, hp_campaign=campaign, medium='ホームページ反響', response_medium=medium, reserved_date
- 社内通知（HTML）: To `marketing@kh-group.jp`、Cc は店舗ごとの表、件名 `{shop}/{campaign}からの登録がありました。`、差出人表示名は店舗名。age・reserved_time はメールにだけ載る
- CORS: `https://www.ie-miru.jp`

## 作ったもの（② `kengaku_cloud:entry`、認証なし）
| 項目 | 内容 |
|---|---|
| 送信先 | `https://api.khg-marketing.info/api/gateway`（本文に `request=kengaku_cloud`・`roll=entry`） |
| 受け方 | フォーム形式（`sendBeacon` ／ fetch ／ XHR）・JSON のどちらも（app.ts に `express.urlencoded` が元からある） |
| 保存（移植元と同じ） | 上の 13 列と同じ割り当て。inquiry_id の頭 `kengakucloud_Ymd_His`（日本時間で作る） |
| 保存（追加） | `reserved_time`・`line_id`（空白除去、空は NULL）・`remarks`（`message`＝質問・ご連絡事項）・`url_params` と `landing_params`（同じ値）・URL パラメータに utm_source〜utm_content があれば `utm_*` 列 |
| 保存（直した） | NOT NULL の列をすべて埋める（campaign_form と同じ `NOT_NULL_COLUMNS`。sync・delete_flag は 0）。inquiry_id の末尾にミリ秒 `_mmm`（同じ秒に2件来ると重なり、同期で別の反響まで同期済みになるため。inquiry_id を解析しているコードは無いことを確認） |
| URL パラメータ | `url_params` が JSON（GTM の localStorage そのまま）なら `k=v&…` に直す。`k=v&…` でも受ける。⚠️ `url_params` が無いときは、予約内容以外の英数字の名前を URL パラメータとみなす（今の GTM の「展開して送る」形でも拾える。日本語の見出しは拾わない） |
| 社内通知 | 移植元と同じ宛先・Cc・件名・差出人表示名・項目の並び。② の方針でプレーンテキスト。LINE ID の行を追加。⚠️ 保存に失敗したら送らない（移植元は送っていた） |
| 応答 | 成功 `{"status":"success","message":"… のデータが正常に追加されました。","id":"…"}`、必須の未入力は移植元と同じく 200 で `status:error`、保存失敗は 500 |
| 流量制限 | publicFormRateLimit の `GUARDED_REQUESTS` に `kengaku_cloud`（IP ごと 10 分 5 件。campaign_form と同じ） |

### 別のエンジニアへ渡すもの
- **`Downloads/gtm_reserve_send_v2.html`**（元のファイルはそのまま）
  - 送信先 `https://khg-marketing.info/api/kengakuCloud/all/` → **`https://api.khg-marketing.info/api/gateway`**
  - 送信データに `request: "kengaku_cloud"`・`roll: "entry"`
  - localStorage の `url_params` は展開せず、JSON 文字列のまま `url_params` 1項目で送る
- `gtm_reserve_save.html` は変更なし

## 追記: 住所は任意
- 必須は氏名・かな・メール・電話の4つだけ（移植元と同じ）。住所（full_address）は任意で、あれば building に入れ、無ければ空のまま保存する
  - ⚠️ いったん「building に入れない」と取り違えて変えたが、利用者の意図は「必須にしなくてよい」だったので戻した（git revert）
- 必須の確認のコメントに「住所は任意」を明記

## 変更ファイル
| 場所 | ファイル | 内容 |
|---|---|---|
| 版 | frontend/src/utils/**version.ts** | 2.2.190 |
| ① DB | backend/scripts/sql/**2026-10-12_update_log_2.2.190.sql**（新規） | update_log（ローカルに流した: no=286） |
| ② | features/kengakuCloud/**entry.ts**（新規） | `runKengakuCloudEntry`・`readUrlParams`・`jstParts` |
| ② | features/campaignForm/**entry.ts** | `NOT_NULL_COLUMNS` を export（見学クラウドでも使う） |
| ② | gateway/**registry.ts** | `kengaku_cloud:entry` を登録 |
| ② | middlewares/**publicFormRateLimit.ts** | `GUARDED_REQUESTS` に `kengaku_cloud` |
- DB の列追加は無し（v2.2.188 の `line_id`、v2.2.189 の `url_params`・`landing_params` を使う）

## 確認（ローカル）
- ② tsc OK
- GTM と同じ形（フォーム形式、`Origin: https://www.ie-miru.jp`）でローカル ② の `/api/gateway` へ送信（⚠️ ローカルは SMTP 未設定でメールは出ない。ログに「社内通知を送れませんでした」が出るのは想定どおり）
  - A（`url_params` を JSON で、LINE ID に空白）→ 保存。url_params / landing_params `utm_source=instagram&utm_campaign=%E7%A7%8B&gclid=abc`、utm_source `instagram`・utm_campaign `秋`、line_id `taroline`、remarks に質問、reserved_time `10:00`
  - B（URL パラメータを展開して送る今の形＋日本語の見出し）→ url_params `utm_source=google&fbclid=xyz`（日本語の見出しは入らない）
  - C（氏名が空）→ 200 `{"status":"error","message":"未入力項目があります"}`、保存されない
  - 同じ秒の2件で inquiry_id が `_671`・`_736` と分かれる
- 試験で作った行は削除

## 差分: GTM（Downloads/gtm_reserve_send.html → gtm_reserve_send_v2.html）
```diff
--- /c/Users/shinji-kawano/Downloads/gtm_reserve_send.html	2026-10-12 17:52:51.957069000 +0900
+++ /c/Users/shinji-kawano/Downloads/gtm_reserve_send_v2.html	2026-10-12 18:14:27.734637000 +0900
@@ -1,11 +1,12 @@
 <!--
   GTM カスタムHTMLタグ: 予約内容のAPI送信 → サンクスページへリダイレクト
 
-  【変更点】
-  - 送信時に localStorage の "url_params" のプロパティも合わせて POST する
-    （reserveData と同じ key がある場合は reserveData を優先）
+  【変更点（v2）】
+  - 送信先を https://api.khg-marketing.info/api/gateway に変更（旧: https://khg-marketing.info/api/kengakuCloud/all/）
+  - 送信データに request=kengaku_cloud / roll=entry を追加（新しい送信先はこの2つで受け口を決める）
+  - localStorage の "url_params" は展開せず、JSON 文字列のまま url_params として1項目で送る
   - line_id は gtm_reserve_save.html 側で reserveData に入るため、そのまま送信される
-  （トリガー等の GTM 設定は変更なし）
+  （トリガー等の GTM 設定・gtm_reserve_save.html は変更なし）
 -->
 <script>
 if (window.location.href.indexOf("kokubuhousinggroup") !== -1) {
@@ -51,23 +52,19 @@
       }
     } catch (e) {}
 
-    // 2-2. url_params のプロパティを送信データに追加（reserveData を優先）
-    var sendData = {};
+    // 2-2. 送信データ（受け口の指定 ＋ 予約内容 ＋ url_params を JSON 文字列のまま1項目で）
+    var sendData = { request: "kengaku_cloud", roll: "entry" };
+    for (var j = 0; j < keys.length; j++) {
+      sendData[keys[j]] = reserveData[keys[j]];
+    }
     try {
       var urlParamsRaw = localStorage.getItem("url_params");
-      var urlParams = urlParamsRaw ? JSON.parse(urlParamsRaw) : {};
-      if (urlParams && typeof urlParams === "object") {
-        var urlKeys = Object.keys(urlParams);
-        for (var u = 0; u < urlKeys.length; u++) {
-          sendData[urlKeys[u]] = urlParams[urlKeys[u]];
-        }
+      if (urlParamsRaw) {
+        sendData.url_params = urlParamsRaw;
       }
     } catch (e) {
       console.error("url_params read error:", e);
     }
-    for (var j = 0; j < keys.length; j++) {
-      sendData[keys[j]] = reserveData[keys[j]];
-    }
     var sendKeys = Object.keys(sendData);
 
     // 3. 送信データの整形（URLエンコード）
@@ -81,7 +78,7 @@
       );
     }
     var bodyString = paramsArr.join("&");
-    var url = "https://khg-marketing.info/api/kengakuCloud/all/";
+    var url = "https://api.khg-marketing.info/api/gateway";
 
     // 4. データ送信処理
 
```

## 差分: dashboard（git diff）
```diff
diff --git a/backend-express/src/features/campaignForm/entry.ts b/backend-express/src/features/campaignForm/entry.ts
index 30470875..e1f26b2d 100644
--- a/backend-express/src/features/campaignForm/entry.ts
+++ b/backend-express/src/features/campaignForm/entry.ts
@@ -89,7 +89,7 @@ const KHG_BRAND: Record<string, string> = {
  *   ⚠️ 移植元は20列しか指定しておらず、**sql_mode が緩いから通っていた**だけである。
  *     STRICT なら全件失敗する。ここでは全部埋める。
  */
-const NOT_NULL_COLUMNS = [
+export const NOT_NULL_COLUMNS = [
     'inquiry_id', 'pg_id', 'mhl_id', 'mhl_url', 'mhl_mail', 'inquiry_date',
     'medium', 'response_medium',
     'first_name', 'last_name', 'first_name_kana', 'last_name_kana',
diff --git a/backend-express/src/features/kengakuCloud/entry.ts b/backend-express/src/features/kengakuCloud/entry.ts
new file mode 100644
index 00000000..2e1b1d8e
--- /dev/null
+++ b/backend-express/src/features/kengakuCloud/entry.ts
@@ -0,0 +1,217 @@
+import { execute } from '../../db/pool';
+import { logger } from '../../utils/logger';
+import { sanitizeHeader, sendMail } from '../../utils/mailer';
+import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
+import { clean, cleanMultiline } from '../campaignForm/text';
+
+/**
+ * 見学クラウド（www.ie-miru.jp）の予約を inquiry_customer へ保存する。認証なし。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️ 送ってくるのは見学クラウドの完了画面に置いた GTM のカスタム HTML
+ *   （gtm_reserve_save.html で予約内容を localStorage に保存 → gtm_reserve_send.html が送信）。
+ *   ⚠️ `sendBeacon` ／ fetch ／ XHR で **フォーム形式（x-www-form-urlencoded）** で届く。JSON でも受ける。
+ * ⚠️ 移植元は ① `khg-marketing.info/api/kengakuCloud/all/`。保存する列・inquiry_id の形・社内通知は同じにした。
+ *   違うところ:
+ *   - NOT NULL の列をすべて埋める（移植元は 13 列だけで、sql_mode が緩いから通っていた）
+ *   - reserved_time・line_id・URL パラメータ・質問（remarks）も保存する
+ *   - 保存に失敗したらメールを送らない（移植元は失敗しても送っていた）
+ *   - inquiry_id の末尾にミリ秒（同じ秒に2件来ると inquiry_id が重なり、同期で別の反響まで同期済みになるため）
+ * ─────────────────────────────────────────────
+ */
+
+export interface KengakuCloudResult {
+    httpStatus: number;
+    body: { status: 'success' | 'error'; message: string; id?: string };
+}
+
+/** 予約内容として受ける名前。⚠️ これ以外の英数字の名前は URL パラメータとして扱う（url_params が無いとき） */
+const FORM_KEYS = new Set([
+    'request', 'roll', 'name', 'kana', 'mail', 'mobile', 'full_address', 'brand', 'shop', 'campaign',
+    'medium', 'reserved_date', 'reserved_time', 'age', 'line_id', 'message', 'benefit_agreement', 'url_params',
+]);
+
+const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
+
+/** 店舗 → 社内通知の Cc（移植元と同じ） */
+const SHOP_CC: Record<string, string> = {
+    'KH鹿児島店': 'hs_kh-kagoshima@kh-group.jp',
+    'KH霧島店': 'hs_kh-kirishima@kh-group.jp',
+    'KH姶良店': 'hs_kh-aira@kh-group.jp',
+    'KH鹿屋店': 'hs_kh-kanoya@kh-group.jp',
+    'KH薩摩川内店': 'hs_kh-sendai@kh-group.jp',
+    'KH出水阿久根店': 'hs_kh-izumi-akune@kh-group.jp',
+    'KH加世田店': 'hs_kh-kaseda@kh-group.jp',
+    'KH八代店': 'hs_kh-yatsushiro@kh-group.jp',
+    'KH熊本店': 'hs_kh-kumamoto@kh-group.jp',
+    'KH都城店': 'hs_kh-miyakonojo@kh-group.jp',
+    'KH宮崎店': 'hs_kh-miyazaki@kh-group.jp',
+    'KH延岡店': 'hs_kh-nobeoka@kh-group.jp',
+    'KH大分店': 'hs_kh-ooita@kh-group.jp',
+    'KH佐賀店': 'hs_kh-saga@kh-group.jp',
+    'KH久留米店': 'hs_kh-kurume@kh-group.jp',
+    'DJH鹿児島北店': 'hs_djh-kagoshima-kita@kh-group.jp',
+    'DJH霧島店': 'hs_djh-kirishima@kh-group.jp',
+    'DJH鹿屋店': 'hs_kh-kanoya@kh-group.jp',
+    'DJH薩摩川内店': 'hs_djh-kirishima@kh-group.jp',
+    'DJH加世田店': 'hs_kh-kaseda@kh-group.jp',
+    'DJH都城店': 'hs_djh-miyakonojo@kh-group.jp',
+    'DJH宮崎店': 'hs_djh-miyazaki@kh-group.jp',
+    'DJH延岡店': 'hs_kh-nobeoka@kh-group.jp',
+};
+
+const MAIL_TO = 'marketing@kh-group.jp';
+
+/** ⚠️ サーバーの時刻帯に関係なく日本時間で作る（移植元も Asia/Tokyo） */
+const jstParts = (d: Date): Record<'y' | 'mo' | 'd' | 'h' | 'mi' | 's', string> => {
+    const parts = new Intl.DateTimeFormat('en-CA', {
+        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
+        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
+    }).formatToParts(d);
+    const get = (type: string): string => parts.find(p => p.type === type)?.value ?? '';
+    return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
+};
+
+const encodePair = (key: string, value: unknown): string =>
+    `${encodeURIComponent(key)}=${encodeURIComponent(String(value ?? ''))}`;
+
+/**
+ * URL パラメータを `a=1&b=2` の形にそろえる（公開フォームの url_params と同じ形）。
+ * - `url_params` があればそれを使う。⚠️ GTM は localStorage の JSON（`{"utm_source":"…"}`）のまま送ってくる。`a=1&b=2` の形でも受ける
+ * - 無ければ、予約内容以外の英数字の名前を URL パラメータとみなす（GTM が予約内容と同じ階層に展開して送ってくる形）
+ */
+export const readUrlParams = (body: Record<string, unknown>): string => {
+    const raw = typeof body.url_params === 'string' ? body.url_params.trim() : '';
+    if (raw !== '') {
+        if (raw.startsWith('{')) {
+            try {
+                const parsed: unknown = JSON.parse(raw);
+                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
+                    return Object.entries(parsed as Record<string, unknown>)
+                        .map(([k, v]) => encodePair(k, v)).join('&').slice(0, 2000);
+                }
+            } catch {
+                logger.warn(`kengaku_cloud:entry: url_params を読めませんでした: ${raw.slice(0, 80)}`);
+            }
+        }
+        return clean(raw.replace(/^\?/, ''), 2000);
+    }
+    return Object.entries(body)
+        .filter(([k]) => !FORM_KEYS.has(k) && /^[A-Za-z0-9_.-]+$/.test(k))
+        .map(([k, v]) => encodePair(k, v)).join('&').slice(0, 2000);
+};
+
+/** 予約日時の行（移植元のメールと同じ並び。空の項目は出さない） */
+const line = (label: string, value: string): string => (value === '' ? '' : `${label}：${value}\n`);
+
+export const runKengakuCloudEntry = async (
+    raw: Record<string, unknown>
+): Promise<KengakuCloudResult> => {
+    const body = raw ?? {};
+    const name = clean(body.name, 120);
+    const kana = clean(body.kana, 120);
+    const mail = clean(body.mail, 190);
+    const mobile = clean(body.mobile, 30);
+
+    // ⚠️ 移植元と同じ必須項目。⚠️ 応答も 200（GTM の XHR が 200 以外で警告を出すため、移植元に合わせる）
+    if (name === '' || kana === '' || mail === '' || mobile === '') {
+        logger.warn('kengaku_cloud:entry: 未入力項目があります');
+        return { httpStatus: 200, body: { status: 'error', message: '未入力項目があります' } };
+    }
+
+    const address = clean(body.full_address, 300);
+    const brand = clean(body.brand, 30);
+    const shop = clean(body.shop, 80);
+    const campaign = clean(body.campaign, 200);
+    const medium = clean(body.medium, 120);
+    const reservedDate = clean(body.reserved_date, 20);
+    const reservedTime = clean(body.reserved_time, 20);
+    const age = clean(body.age, 20);
+    const lineId = clean(body.line_id, 200).replace(/\s+/g, '').slice(0, 100);
+    const message = cleanMultiline(body.message, 2000);
+    const urlParams = readUrlParams(body);
+    const query = new URLSearchParams(urlParams);
+
+    const now = new Date();
+    const t = jstParts(now);
+    const ms = String(now.getMilliseconds()).padStart(3, '0');
+    const id = `kengakucloud_${t.y}${t.mo}${t.d}_${t.h}${t.mi}${t.s}_${ms}`;
+
+    const values: Record<string, string | number | null> = {};
+    for (const column of NOT_NULL_COLUMNS) values[column] = '';
+    // ⚠️ 数値列。空文字だと INSERT ごと失敗する
+    values.sync = 0;
+    values.delete_flag = 0;
+
+    values.inquiry_id = id;
+    values.inquiry_date = `${t.y}/${t.mo}/${t.d}`;
+    values.medium = 'ホームページ反響';
+    values.response_medium = medium;
+    // ⚠️ 移植元と同じく氏名・かなは分けずに first_name / first_name_kana、住所はまとめて building
+    values.first_name = name;
+    values.first_name_kana = kana;
+    values.mail = mail;
+    values.mobile = mobile;
+    values.building = address;
+    values.brand = brand;
+    values.shop = shop;
+    values.hp_campaign = campaign;
+    values.reserved_date = reservedDate;
+    values.reserved_time = reservedTime;
+    values.remarks = message;
+    for (const key of UTM_KEYS) values[key] = clean(query.get(key), 200);
+    values.line_id = lineId === '' ? null : lineId;
+    /**
+     * ⚠️ 見学クラウドで取れるのは「最後に見たパラメータ付きページ」の ? 以降だけ（GTM が localStorage に覚えたもの）。
+     *   ⚠️ 公開フォームの url_params / landing_params どちらで探しても見つかるよう、両方に同じ値を入れる。
+     */
+    values.url_params = urlParams === '' ? null : urlParams;
+    values.landing_params = values.url_params;
+
+    const columns = [...(NOT_NULL_COLUMNS as unknown as string[]), 'line_id', 'url_params', 'landing_params'];
+
+    try {
+        await execute(
+            `INSERT INTO inquiry_customer (${columns.join(', ')})`
+            + ` VALUES (${columns.map(() => '?').join(', ')})`,
+            columns.map(c => values[c])
+        );
+    } catch (error) {
+        logger.error(`kengaku_cloud:entry: inquiry_customer への保存に失敗: ${(error as Error).message}`);
+        return { httpStatus: 500, body: { status: 'error', message: 'データ追加に失敗しました。' } };
+    }
+
+    logger.info(`kengaku_cloud:entry を受け付けました id="${id}" brand="${brand}" shop="${shop}"`);
+
+    // ---- 社内通知（移植元と同じ宛先・件名・本文。② の方針でプレーンテキスト） ----
+    const cc = SHOP_CC[shop];
+    const text = `${campaign}からの登録がありました。\n\n`
+        + `お問合わせ日時：${t.y}/${t.mo}/${t.d} ${t.h}:${t.mi}:${t.s}\n\n`
+        + '====================\nお客様情報\n====================\n'
+        + line('来場希望場所', shop)
+        + line('お名前', name)
+        + line('お名前（カナ）', kana)
+        + line('来場希望日', reservedDate)
+        + line('来場希望時間', reservedTime)
+        + line('携帯番号', mobile)
+        + line('メールアドレス', mail)
+        + line('LINE ID', lineId)
+        + line('年齢', age)
+        + line('住所', address)
+        + line('お問い合わせのきっかけ', medium)
+        + '====================\n※のちほどDashboardへ反映されます。\n';
+
+    const ok = await sendMail({
+        to: cc === undefined ? [MAIL_TO] : [MAIL_TO, cc],
+        subject: sanitizeHeader(`${shop}/${campaign}からの登録がありました。`),
+        text,
+        // ⚠️ 移植元と同じく差出人の表示名は店舗名
+        fromName: sanitizeHeader(shop),
+    });
+    if (!ok) {
+        // ⚠️ 反響は保存済み。⚠️ 社内が気づけるよう必ず残す
+        logger.error(`kengaku_cloud:entry: 社内通知を送れませんでした id="${id}" shop="${shop}"`);
+    }
+
+    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが正常に追加されました。`, id } };
+};
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index e0c9bb80..dc1fcc09 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -102,6 +102,7 @@ import {
   runCampaignFormUpdate,
 } from '../features/campaignForm';
 import { runCampaignFormEntry, runCampaignFormPublic } from '../features/campaignForm/entry';
+import { runKengakuCloudEntry } from '../features/kengakuCloud/entry';
 import { runCampaignSummary } from '../features/campaignSummary';
 import { runDailyReport } from '../features/dailyReport';
 import { runLostList } from '../features/lostList';
@@ -2013,6 +2014,25 @@ register({
   },
 });
 
+/**
+ * ⚠️⚠️ **見学クラウド（www.ie-miru.jp）の予約受付。認証なしの書き込み口である。**
+ *   ⚠️ 見学クラウドの完了画面の GTM（gtm_reserve_send.html）が `sendBeacon` などでフォーム形式で送ってくる。
+ *   ⚠️ 防御は campaign_form:entry と同じ（publicFormRateLimit の流量制限・全項目の長さ制限・通知先はコード内の表）。
+ *   ⚠️ 本番の CORS_ORIGINS に `https://www.ie-miru.jp` が要る（無いと fetch / XHR に回ったとき応答を読めず、二重送信やエラー表示になりうる）。
+ */
+register({
+  request: 'kengaku_cloud',
+  roll: 'entry',
+  summary: '【書き込み・認証なし】見学クラウドの予約受付（inquiry_customer）',
+  phpSource: 'khg-marketing.info/api/kengakuCloud/all/index.php',
+  auth: 'none',
+  handler: async (ctx) => {
+    const result = await runKengakuCloudEntry(ctx.body as Record<string, unknown>);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 // ---------------------------------------------------------------------------
 // 他社広告ライブラリ（meta_ads）
 //
diff --git a/backend-express/src/middlewares/publicFormRateLimit.ts b/backend-express/src/middlewares/publicFormRateLimit.ts
index 826cb128..f0757159 100644
--- a/backend-express/src/middlewares/publicFormRateLimit.ts
+++ b/backend-express/src/middlewares/publicFormRateLimit.ts
@@ -44,6 +44,8 @@ const GUARDED_REQUESTS = new Set([
      *     ⚠️ そのため下で roll を見て、表示は対象から外している。
      */
     'campaign_form',
+    // ⚠️ 見学クラウドの予約受付（kengaku_cloud:entry）。認証なしの書き込み口
+    'kengaku_cloud',
 ]);
 
 const WINDOW_MS = 10 * 60_000;
diff --git a/backend/scripts/sql/2026-10-12_update_log_2.2.190.sql b/backend/scripts/sql/2026-10-12_update_log_2.2.190.sql
new file mode 100644
index 00000000..e4e514eb
--- /dev/null
+++ b/backend/scripts/sql/2026-10-12_update_log_2.2.190.sql
@@ -0,0 +1,9 @@
+-- =====================================================================
+-- update_log に v2.2.190 を追加する
+--
+-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
+-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
+-- =====================================================================
+
+INSERT INTO update_log (version, date, note) VALUES
+('2.2.190', '2026-10-12', '見学クラウドの予約の受け取り先を新しいサーバーへ移した。予約時間・LINE ID・URLパラメータ・質問も保存するようにした。');
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 5f945e1a..d42ed20f 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.189';
+export const newVersion = '2.2.190';
```
