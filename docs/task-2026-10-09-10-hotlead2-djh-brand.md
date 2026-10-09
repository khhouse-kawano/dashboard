# 2026-10-09 v2.2.180 hotlead_2 の追客情報を DJH ブランドとして紐付ける

## 依頼
- sync の `hotlead_2` で POST されたデータは DJH ブランド
- `backend/src/handlers/hotlead.php` と、Express 側が開通していればそちらも改修
- 新しいブランチ（v2.2.180）

## 調査
- ② Express には `request: 'hotlead'` のハンドラが無い（express_proxy の許可リストにも無い）→ **① PHP だけ**を改修
- hotlead.php は master_data への紐付けで担当店舗を `'KH' . store_name` に固定していた
  - HOTLEAD の store_name は「霧島店」のようにブランドが付かない → hotlead_2（DJH）の顧客は `KH霧島店` で探され、**紐付かなかった**
- POST の本文にどちらのアカウントかの情報が無いため、**sync 側で送り元のブランドを付ける**必要がある
- hotlead_db に brand 列は無い（保存はしない。紐付けにだけ使う）

## 変更
| リポジトリ | ディレクトリ | ファイル | 内容 |
|---|---|---|---|
| dashboard | backend/src/handlers | **hotlead.php** | `hotlead_brand`（'KH' / 'DJH'、それ以外・無しは 'KH'）を担当店舗名の頭に使う。応答に `brand` を追加 |
| sync | src/services | **portalService.ts** | hotlead に `brand: 'KH'`、hotlead_2 に `brand: 'DJH'` |
| sync | src/services | **runHotlead.ts** | `runHotlead(id, pass, brand = 'KH')`、`postTicketsToPhpApi(ticketsData, brand)` で `hotlead_brand` を付けて送る |
| dashboard | frontend/src/utils | version.ts | 2.2.180 |
| dashboard | backend/scripts/sql | **2026-10-09_update_log_2.2.180.sql**（新規） | update_log（ローカル投入済み no=276） |

### 追加した変数・引数
- hotlead.php: `$hotleadBrands` / `$hotleadBrand`
- runHotlead.ts: `runHotlead` の第3引数 `brand`、`postTicketsToPhpApi` の第2引数 `brand`

⚠️ 送るキーは `brand` ではなく `hotlead_brand`（ゲートウェイ・他の項目とぶつけないため）。
⚠️ hotlead_brand は `$allowedColumns` に入れていない（hotlead_db には保存しない）。

## 確認（ローカル）
- PHP lint OK、sync `tsc --noEmit` OK
- PHP ハーネスで hotlead.php を実行（担当店舗 `DJH霧島店` のテスト顧客を用意）
  - hotlead_brand なし → brand KH、紐付け 0件（従来どおり）
  - hotlead_brand 'XX' → brand KH、紐付け 0件
  - hotlead_brand 'DJH' → brand DJH、**紐付け 1件**（master_data.hotlead_id に入った）
  - テスト行（master_data / hotlead_db）は削除済み

## 既知のこと（今回は変えていない）
- runHotlead は取得結果を `tickets_MM.json` に保存しており、hotlead と hotlead_2 で同じファイル名（後に走った方で上書き）
- store_name「★振り分け窓口」は店舗に当たらないため紐付かない（従来どおり）

## 差分: dashboard（hotlead.php）
```diff
diff --git a/backend/src/handlers/hotlead.php b/backend/src/handlers/hotlead.php
index da9f2d63..c6248b38 100644
--- a/backend/src/handlers/hotlead.php
+++ b/backend/src/handlers/hotlead.php
@@ -88,8 +88,17 @@ try {
     }
 
     // 4. master_data テーブルの hotlead_id 紐付け更新処理
+    //
+    // ⚠️ v2.2.180: 店舗名の頭（ブランド）は ⚠️ **送り元のアカウントで決める**。
+    //   sync の runHotlead が `hotlead_brand` を付けて送る（hotlead → 'KH' ／ hotlead_2 → 'DJH'）。
+    //   ⚠️ HOTLEAD の store_name は「霧島店」のようにブランドが付かないため、
+    //     それまでは 'KH' 固定で、⚠️ hotlead_2（DJH）の顧客が紐付かなかった。
+    // ⚠️ 無い・知らない値は 'KH'（⚠️ 古い sync から届いても従来どおり動く）。
+    // ⚠️ hotlead_brand は hotlead_db の列ではない（⚠️ $allowedColumns に入れない。保存はしない）。
+    $hotleadBrands = ['KH', 'DJH'];
+    $hotleadBrand  = in_array($data['hotlead_brand'] ?? '', $hotleadBrands, true) ? $data['hotlead_brand'] : 'KH';
     $storeName    = $filteredData['store_name'] ?? '';
-    $inChargeStore= 'KH' . $storeName;
+    $inChargeStore= $hotleadBrand . $storeName;
     $cleanName    = preg_replace('/\s+/u', '', $filteredData['name'] ?? '');
     $cleanPhone   = preg_replace('/\D/', '', $filteredData['phone'] ?? '');
     $email        = trim($filteredData['email'] ?? '');
@@ -123,6 +132,7 @@ try {
         'status' => 'success',
         'action' => $action,
         'id'     => $targetId,
+        'brand'  => $hotleadBrand,
         'master_data_linked' => $masterUpdatedCount > 0,
         'master_data_updated_count' => $masterUpdatedCount
     ]);
```

## 差分: sync（portalService.ts / runHotlead.ts）
```diff
diff --git a/src/services/portalService.ts b/src/services/portalService.ts
index da0ac70..985f70f 100644
--- a/src/services/portalService.ts
+++ b/src/services/portalService.ts
@@ -112,8 +112,10 @@ export const portalService = {
       { name: 'property', id: process.env.IELOVE_MAIL ?? "", pass: process.env.IELOVE_PASS ?? "" },
       { name: 'pg_mail', id: process.env.GMAIL ?? "", pass: process.env.GMAIL_APP_PASS ?? "" },
       { name: 'kaeeru', id: process.env.GMAIL ?? "", pass: process.env.GMAIL_PASS ?? "" },
-      { name: 'hotlead', id: process.env.HOTLEAD_ID ?? "", pass: process.env.HOTLEAD_PASS ?? ""},
-      { name: 'hotlead_2', id: process.env.HOTLEAD_ID_2 ?? "", pass: process.env.HOTLEAD_PASS_2 ?? ""},
+      // ⚠️ 2026-10-09: brand は Dashboard の hotlead.php が担当店舗名の頭に使う（'KH' + 霧島店 → KH霧島店）。
+      //   ⚠️ hotlead_2 は DJH のアカウント。⚠️ hotlead.php が受けるのは 'KH' / 'DJH' だけ（それ以外は KH 扱い）。
+      { name: 'hotlead', id: process.env.HOTLEAD_ID ?? "", pass: process.env.HOTLEAD_PASS ?? "", brand: 'KH' },
+      { name: 'hotlead_2', id: process.env.HOTLEAD_ID_2 ?? "", pass: process.env.HOTLEAD_PASS_2 ?? "", brand: 'DJH' },
       { name: 'geoCode' },
       // ⚠️⚠️ 自社店舗の Google クチコミ（google_review テーブル）。
       //   ⚠️ ログインを伴わないので id / pass を持たない。**geoCode と同じ形**である。
diff --git a/src/services/runHotlead.ts b/src/services/runHotlead.ts
index ff242bc..85b769e 100644
--- a/src/services/runHotlead.ts
+++ b/src/services/runHotlead.ts
@@ -58,7 +58,13 @@ const findTickets = async (token: string) => {
 }
 
 
-const postTicketsToPhpApi = async (ticketsData: any) => {
+/**
+ * ⚠️ 2026-10-09: brand は portalService の brand（hotlead → 'KH' ／ hotlead_2 → 'DJH'）。
+ *   `hotlead_brand` として送る。Dashboard の hotlead.php が担当店舗名の頭に使う
+ *   （⚠️ HOTLEAD の store_name は「霧島店」のようにブランドが付かない）。
+ *   ⚠️ キー名を `brand` にしないこと（⚠️ ゲートウェイや他の項目とぶつからないように専用の名前にしている）。
+ */
+const postTicketsToPhpApi = async (ticketsData: any, brand: string) => {
     if (!POST_API_URL) {
         console.warn('⚠️ POST_API_URL が設定されていないため、POST送信をスキップします。');
         return;
@@ -75,7 +81,7 @@ const postTicketsToPhpApi = async (ticketsData: any) => {
 
     for (const [index, item] of list.entries()) {
         try {
-            const response = await axios.post(POST_API_URL, { ...item, request: 'hotlead' }, {
+            const response = await axios.post(POST_API_URL, { ...item, hotlead_brand: brand, request: 'hotlead' }, {
                 headers: {
                     'Content-Type': 'application/json'
                 }
@@ -119,7 +125,7 @@ const postTicketsToPhpApi = async (ticketsData: any) => {
 }
 
 
-export async function runHotlead(id: string, pass: string) {
+export async function runHotlead(id: string, pass: string, brand: string = 'KH') {
     try {
         console.log('認証トークンを取得中...');
         const token = await getAccessToken(id, pass);
@@ -128,8 +134,8 @@ export async function runHotlead(id: string, pass: string) {
         console.log('追客情報(Tickets)を取得・保存中...');
         const ticketsData = await findTickets(token);
 
-        console.log('\nPHP APIへデータのPOST送信を開始します...');
-        await postTicketsToPhpApi(ticketsData);
+        console.log(`\nPHP APIへデータのPOST送信を開始します...（ブランド: ${brand}）`);
+        await postTicketsToPhpApi(ticketsData, brand);
 
     } catch (error: any) {
         const msg = `❌ エラー発生: ${error?.message ?? error}`;
```
