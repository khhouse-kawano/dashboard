# 2026-10-12 v2.2.189 フォームを埋め込んだページの URL パラメータ（? 以降）を保存する

## 依頼
- フォームの回答時に、**フォームが埋め込まれているページ**の URL パラメータ（? 以降の全文字列）を取得して保存する
- 対象: react/form_get ／ inquiry_customer ／ master_data ／ ListOrder.tsx の handleSync
- ページを移ってから送った場合も取りたい → localStorage の内容も取る。列を分けるかはこちらで判断
- 列名 `url_params` は OK

## 判断（列を分けた）
| 列 | 中身 |
|---|---|
| `url_params` | 送信したページの ? 以降（# より前）をそのまま |
| `landing_params` | フォームを見た中で**最後のパラメータ付きページ**の ? 以降（親ページの localStorage `landing_params` に覚える。空のページでは上書きしない） |
- 1列にまとめると「送信したページの値」か「前に見たページの値」か後から区別できないため
- ⚠️ 覚えられるのは**フォームが埋め込まれたページを開いたときだけ**（フォームの中で動くため）。フォームの無い LP だけでパラメータを受けて移った場合は拾えない（拾うには各ブランドのサイト全体にスクリプトが要る）
- かえる・中古（inquiry_customer_kaeru / _resale、master_data_kaeru / _resale）は対象外
- 画面への表示は作っていない（保存だけ）
- ② が落ちて ① に回ったときは保存されない（① の本体はリポジトリに無い。LINE ID と同じ）

## 変更
| 場所 | ファイル | 内容 |
|---|---|---|
| 版 | frontend/src/utils/**version.ts** | 2.2.189 |
| ① DB | backend/scripts/sql/**2026-10-12_update_log_2.2.189.sql**（新規） | update_log（ローカルに流した: no=285） |
| ① DB | backend/scripts/sql/**2026-10-12_url_params_columns.sql**（新規） | `inquiry_customer`（hotlead_url の次）と `master_data`（line_id の次）に `url_params`・`landing_params`（TEXT、NULL 可）。ローカルに流した |
| 公開フォーム | form_get/src/api/**pageParams.ts**（新規） | `parentQuery()`（親ページの ? 以降）・`rememberLandingParams()`（空でなければ覚える）・`landingParams()`（覚えた値）。親を読めない環境では例外を握って空 |
| 公開フォーム | form_get/src/components/**Form.tsx** | 読み込み時に `rememberLandingParams(parentQuery())`。確認画面へ渡すデータに `url_params`・`landing_params` |
| 公開フォーム | form_get/src/components/**Confirm.tsx** | `PostData` の型と初期値に `url_params`・`landing_params`（送信は `...postData` でそのまま送られる） |
| ② | campaignForm/**entry.ts** | `Answers` に `urlParams`・`landingParams`（`clean(…, 2000)`）。空は NULL で inquiry_customer に保存 |
| ② | list/**queries.ts** | 反響一覧（注文）の SELECT に `url_params, landing_params` |
| ① | handlers/listAction/**list_order.php** | 同上（フォールバック） |
| ② | information/**masterDataColumns.ts** | 保存してよい列に `url_params`・`landing_params` |
| ① | core/**allowed_columns.php** | 同上。⚠️ 3テーブル共通の表だが、送られた列だけ使う作り（② save.ts・① customer_info.php / list_insert.php とも `in data` / `array_key_exists`）なので、列の無いかえる・中古には影響しない |
| フロント | list/**listUtils.ts** | `filledField(key, value)`（値があるときだけ `{ [key]: value }`）を追加。`lineIdField` はこれを使う形に |
| フロント | list/**ListOrder.tsx** | `InquiryCustomer` 型に 2 列。handleSync で `...filledField('url_params', …)`・`...filledField('landing_params', …)` |

## 確認（ローカル）
- ② tsc OK ／ ① `php -l` OK ／ form_get `tsc -p tsconfig.app.json --noEmit` OK ／ dashboard `npm run build` 成功 → **`main.2ce64ef1.js` ／ `main.b8a7c60b.css`**（CSS は変わらず）
- ② `runCampaignFormEntry`（⚠️ ローカルは SMTP 未設定でメールは出ない）
  - `url_params: 'utm_source=instagram&utm_campaign=autumn&x=%E3%81%82'`・`landing_params: 'gclid=abc123'` → そのまま保存
  - 送らない（古いフォーム）→ 両方 NULL、反響は保存される
- ② `runListInsert`（order）→ master_data に 2 列とも保存
- 試験で作った行（inquiry_customer・form_cv・pgcloud・master_data）は削除、一時スクリプトも削除
- 公開フォーム（Playwright。⚠️ 通信はすべて横取り）: 偽の親ページに iframe で埋め込んで送信
  - `/lp-test/a?utm_source=instagram&utm_campaign=autumn#top` で送信 → url_params・landing_params とも `utm_source=instagram&utm_campaign=autumn`（# 以降は入らない）
  - そのあと `/lp-test/b`（パラメータ無し）で送信 → url_params 空、landing_params `utm_source=instagram&utm_campaign=autumn`
  - `/lp-test/c?gclid=xyz` を見たあと `/lp-test/d` で送信 → landing_params `gclid=xyz`（最後に見たものに上書き）

## 差分: 公開フォーム（form_get、⚠️ git 管理外。変更前は スクラッチの form_get_backup_2026-10-12_v189/）
### src/api/pageParams.ts（新規）
```ts
/**
 * フォームを埋め込んだページ（親）の URL パラメータ（? 以降、# より前）。
 *
 * - url_params     … 送信したページの ? 以降をそのまま
 * - landing_params … フォームを見た中で最後のパラメータ付きページの ? 以降（親の localStorage に覚える）
 *   ⚠️ 覚えられるのはフォームが埋め込まれたページを開いたときだけ（フォームの無い LP は拾えない）。
 *
 * ⚠️ 親を読めない環境（別ドメインの iframe・保存を禁止したブラウザ）では例外になるので、空として扱う。
 *   ⚠️ パラメータが取れなくても反響は送れるようにしておく。
 */
const LANDING_KEY = 'landing_params';

export const parentQuery = (): string => {
    try {
        return window.parent.location.search.replace(/^\?/, '');
    } catch {
        return '';
    }
};

/** 空なら何もしない（前に覚えたパラメータを消さない） */
export const rememberLandingParams = (query: string): void => {
    if (query === '') return;
    try {
        window.parent.localStorage.setItem(LANDING_KEY, query);
    } catch {
        // 覚えられなくても送信には影響しない
    }
};

export const landingParams = (): string => {
    try {
        return window.parent.localStorage.getItem(LANDING_KEY) ?? '';
    } catch {
        return '';
    }
};
```
### Form.tsx / Confirm.tsx
```diff
--- /c/Users/SHINJI~1/AppData/Local/Temp/claude/c--Users-shinji-kawano-react-dashboard/f17ffd00-1ebc-4533-a8d9-ede3c6283bd3/scratchpad/form_get_backup_2026-10-12_v189/Form.tsx	2026-10-12 16:39:14.251041500 +0900
+++ components/Form.tsx	2026-10-12 16:39:58.070723600 +0900
@@ -4,6 +4,7 @@
 import axios from "axios";
 import { post as postToGateway } from "../api/gateway";
 import { brandLogo, brandAccentStyle } from "../api/brands";
+import { parentQuery, rememberLandingParams, landingParams } from "../api/pageParams";
 import { FaArrowRotateLeft } from "react-icons/fa6";
 import "./publicForm.css";
 
@@ -322,6 +323,7 @@
                 }
 
                 window.parent.localStorage.setItem("url", window.parent.location.href);
+                rememberLandingParams(parentQuery());
 
                 const response = await postToGateway('form_get', String(getParam.brand ?? ''), getParam);
                 const row = response.data.data;
@@ -551,7 +553,9 @@
             ...postData,
             url: window.parent.location.href,
             source: sourceValue,
-            campaignName: sourceCampaign
+            campaignName: sourceCampaign,
+            url_params: parentQuery(),
+            landing_params: landingParams(),
         };
 
         console.log(confirmedData);
--- /c/Users/SHINJI~1/AppData/Local/Temp/claude/c--Users-shinji-kawano-react-dashboard/f17ffd00-1ebc-4533-a8d9-ede3c6283bd3/scratchpad/form_get_backup_2026-10-12_v189/Confirm.tsx	2026-10-12 16:39:14.269141700 +0900
+++ components/Confirm.tsx	2026-10-12 16:39:58.072737600 +0900
@@ -16,6 +16,9 @@
     phone: string;
     mail: string;
     line_id: string;
+    /** フォームを埋め込んだページの ? 以降（src/api/pageParams.ts） */
+    url_params: string;
+    landing_params: string;
     zip: string;
     pref: string;
     city: string;
@@ -48,6 +51,8 @@
         phone: '',
         mail: '',
         line_id: '',
+        url_params: '',
+        landing_params: '',
         zip: '',
         pref: '',
         city: '',
```

## 差分: dashboard（git diff）
```diff
diff --git a/backend-express/src/features/campaignForm/entry.ts b/backend-express/src/features/campaignForm/entry.ts
index 8d4bfe5b..30470875 100644
--- a/backend-express/src/features/campaignForm/entry.ts
+++ b/backend-express/src/features/campaignForm/entry.ts
@@ -112,6 +112,8 @@ interface Answers {
     medium: string; question: string;
     campaign: string; campaignId: string;
     url: string; source: string;
+    /** フォームを埋め込んだページの ? 以降（url_params: 送信したページ ／ landing_params: 最後に見たパラメータ付きページ） */
+    urlParams: string; landingParams: string;
 }
 
 /**
@@ -144,6 +146,8 @@ const readAnswers = (body: Record<string, unknown>): Answers => ({
     campaignId: clean(body.campaign_id, 120),
     url: clean(body.url, 500),
     source: clean(body.source, 200),
+    urlParams: clean(body.url_params, 2000),
+    landingParams: clean(body.landing_params, 2000),
 });
 
 /**
@@ -289,8 +293,11 @@ export const runCampaignFormEntry = async (
      * ⚠️⚠️ 列が無い DB だと Unknown column で **反響ごと保存できない**（2026-10-12_line_id_columns.sql を先に流す）。
      */
     values.line_id = a.lineId === '' ? null : a.lineId;
+    // ⚠️ URL パラメータも NULL 可。列が無い DB だと同じく反響ごと保存できない（2026-10-12_url_params_columns.sql を先に流す）
+    values.url_params = a.urlParams === '' ? null : a.urlParams;
+    values.landing_params = a.landingParams === '' ? null : a.landingParams;
 
-    const columns = [...(NOT_NULL_COLUMNS as unknown as string[]), 'line_id'];
+    const columns = [...(NOT_NULL_COLUMNS as unknown as string[]), 'line_id', 'url_params', 'landing_params'];
 
     try {
         await execute(
diff --git a/backend-express/src/features/information/masterDataColumns.ts b/backend-express/src/features/information/masterDataColumns.ts
index 5c3e5b02..34eeeb81 100644
--- a/backend-express/src/features/information/masterDataColumns.ts
+++ b/backend-express/src/features/information/masterDataColumns.ts
@@ -79,6 +79,8 @@ export const MASTER_DATA_COLUMNS: readonly string[] = [
   'last_action_step_migration_item_date', 'last_action_step_migration_item_name', 'lat_lng',
   // LINE ID（3テーブルとも列あり）
   'line_id',
+  // ⚠️ フォームを埋め込んだページの URL パラメータ。⚠️ master_data にだけ列がある（送られた列だけ使うので、かえる・中古には影響しない）
+  'url_params', 'landing_params',
   'memo_developer_application_company', 'memo_fire_insurance', 'memo_ground_survey',
   'memo_lawyer', 'memo_marketing', 'memo_other_related_person', 'memo_site_survey', 'monthly_repayment_amount',
   // ⚠️ v2.2.175 追加（次回アクション日。⚠️ 3テーブルとも 2026-10-08_master_next_action_date.sql で追加）
diff --git a/backend-express/src/features/list/queries.ts b/backend-express/src/features/list/queries.ts
index 4beed11e..aab50f1d 100644
--- a/backend-express/src/features/list/queries.ts
+++ b/backend-express/src/features/list/queries.ts
@@ -125,7 +125,7 @@ const INQUIRY_SQL: Record<ListCategory, string> = {
     SELECT id, inquiry_id, pg_id, mhl_id, mhl_url, mhl_mail, inquiry_date, medium, response_medium,
            first_name, last_name, first_name_kana, last_name_kana, mobile, landline, mail, line_id,
            zip, pref, city, town, street, building, brand, shop, sync, staff, area,
-           reserved_date, hp_campaign, duplicate, hotlead_url,
+           reserved_date, hp_campaign, duplicate, hotlead_url, url_params, landing_params,
            duplicate_flag, gift_flag, support_flag, black_flag
       FROM inquiry_customer
      WHERE first_name <> ''
diff --git a/backend/scripts/sql/2026-10-12_update_log_2.2.189.sql b/backend/scripts/sql/2026-10-12_update_log_2.2.189.sql
new file mode 100644
index 00000000..a21746ef
--- /dev/null
+++ b/backend/scripts/sql/2026-10-12_update_log_2.2.189.sql
@@ -0,0 +1,9 @@
+-- =====================================================================
+-- update_log に v2.2.189 を追加する
+--
+-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
+-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
+-- =====================================================================
+
+INSERT INTO update_log (version, date, note) VALUES
+('2.2.189', '2026-10-12', 'キャンペーンフォームの反響に、フォームを埋め込んだページのURLパラメータ（?以降）を保存するようにした。注文の顧客へ同期するときにも引き継ぐ。');
diff --git a/backend/scripts/sql/2026-10-12_url_params_columns.sql b/backend/scripts/sql/2026-10-12_url_params_columns.sql
new file mode 100644
index 00000000..8329b7e0
--- /dev/null
+++ b/backend/scripts/sql/2026-10-12_url_params_columns.sql
@@ -0,0 +1,27 @@
+-- =====================================================================
+-- v2.2.189: フォームを埋め込んだページの URL パラメータ（? 以降）の列を追加する
+--
+-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ローカルも同じSQL。
+-- ⚠️ ② VPS・① PHP より **先に** 流すこと。
+--   （⚠️ ② が url_params を保存・取得しに行ったとき、列が無いと Unknown column で反響ごと保存できない）
+-- ⚠️ 何度流しても壊れない（ADD COLUMN IF NOT EXISTS）。
+--
+-- url_params     … 送信したページの ? 以降（# より前）をそのまま
+-- landing_params … フォームを見た中で最後のパラメータ付きページの ? 以降（ページを移ってから送ったときのため）
+-- ⚠️ どちらも空なら NULL。注文（inquiry_customer → master_data）だけ。かえる・中古は対象外。
+-- =====================================================================
+
+ALTER TABLE inquiry_customer
+    ADD COLUMN IF NOT EXISTS url_params TEXT DEFAULT NULL COMMENT 'フォームを送信したページのURLパラメータ（?以降）' AFTER hotlead_url,
+    ADD COLUMN IF NOT EXISTS landing_params TEXT DEFAULT NULL COMMENT '最後に見たパラメータ付きページのURLパラメータ（?以降）' AFTER url_params;
+
+ALTER TABLE master_data
+    ADD COLUMN IF NOT EXISTS url_params TEXT DEFAULT NULL COMMENT 'フォームを送信したページのURLパラメータ（?以降）' AFTER line_id,
+    ADD COLUMN IF NOT EXISTS landing_params TEXT DEFAULT NULL COMMENT '最後に見たパラメータ付きページのURLパラメータ（?以降）' AFTER url_params;
+
+-- ---------------------------------------------------------------------
+-- 確認（⚠️ information_schema は ① で使えないので使わない）。⚠️ どれも 0（まだ値が無い）
+-- ---------------------------------------------------------------------
+SELECT 'inquiry_customer' AS t, COUNT(url_params) AS url_params, COUNT(landing_params) AS landing_params FROM inquiry_customer
+UNION ALL
+SELECT 'master_data', COUNT(url_params), COUNT(landing_params) FROM master_data;
diff --git a/backend/src/core/allowed_columns.php b/backend/src/core/allowed_columns.php
index e6feffbe..1e2eabad 100644
--- a/backend/src/core/allowed_columns.php
+++ b/backend/src/core/allowed_columns.php
@@ -149,6 +149,9 @@ return [
 'lat_lng',
 // LINE ID（3テーブルとも列あり）
 'line_id',
+// フォームを埋め込んだページの URL パラメータ。master_data にだけ列がある（送られた列だけ使うので、かえる・中古には影響しない）
+'url_params',
+'landing_params',
 'memo_developer_application_company',
 'memo_fire_insurance',
 'memo_ground_survey',
diff --git a/backend/src/handlers/listAction/list_order.php b/backend/src/handlers/listAction/list_order.php
index e897dec9..9cf04791 100644
--- a/backend/src/handlers/listAction/list_order.php
+++ b/backend/src/handlers/listAction/list_order.php
@@ -38,7 +38,7 @@ $response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);
 // 反響一覧
 $sql_inquiry = "SELECT id, inquiry_id, pg_id, mhl_id, mhl_url, mhl_mail, inquiry_date, medium, response_medium, first_name, last_name,
         first_name_kana, last_name_kana, mobile, landline, mail, line_id, zip, pref, city, town, street, building, brand, shop, sync, staff, area, 
-        reserved_date, hp_campaign, duplicate, hotlead_url,
+        reserved_date, hp_campaign, duplicate, hotlead_url, url_params, landing_params,
         duplicate_flag, gift_flag, support_flag, black_flag
         FROM inquiry_customer WHERE first_name <> '' ORDER By inquiry_date DESC";
 $stmt_inquiry = $pdo->prepare($sql_inquiry);
diff --git a/frontend/src/components/list/ListOrder.tsx b/frontend/src/components/list/ListOrder.tsx
index 8b85a044..e84a0076 100644
--- a/frontend/src/components/list/ListOrder.tsx
+++ b/frontend/src/components/list/ListOrder.tsx
@@ -9,7 +9,7 @@ import { mediumFormate } from '../../utils/mediumFormate';
 import InformationEdit from '../information/InformationEdit';
 import { generateULID } from '../../utils/createULID';
 import { positions } from './listUtils';
-import { monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField } from './listUtils';
+import { monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField, filledField } from './listUtils';
 import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './listTags';
 import type { TagKey } from './listTags';
 import { useIsSp } from '../../utils/isSp';
@@ -25,6 +25,8 @@ type InquiryCustomer = {
     first_name_kana: string, last_name_kana: string, mobile: string, landline: string, mail: string, line_id?: string | null, zip: string, pref: string, city: string, town: string, street: string,
     building: string, brand: string, shop: string, sync: number, staff: string, area: string, reserved_date: string, hp_campaign: string,
     duplicate: string, hotlead_url: string,
+    // フォームを埋め込んだページの URL パラメータ（? 以降）
+    url_params?: string | null, landing_params?: string | null,
     // 顧客タグ。判定は listTags.ts に集約している
     duplicate_flag: number, gift_flag: number, support_flag: number, black_flag: number,
 };
@@ -437,6 +439,8 @@ const ListOrder = ({ onReload }: Props) => {
                 customer_contacts_phone_number: phone_number_2,
                 customer_contacts_email: mailValue,
                 ...lineIdField(filteredCustomer.line_id),
+                ...filledField('url_params', filteredCustomer.url_params),
+                ...filledField('landing_params', filteredCustomer.landing_params),
                 postal_code: filteredCustomer.zip || '',
                 full_address: `${filteredCustomer.pref || ''} ${filteredCustomer.city || ''} ${filteredCustomer.town || ''} ${filteredCustomer.street || ''} ${filteredCustomer.building || ''}`,
                 sales_promotion_name: filteredCustomer.response_medium || '',
diff --git a/frontend/src/components/list/listUtils.ts b/frontend/src/components/list/listUtils.ts
index ffa094a9..00ee60ab 100644
--- a/frontend/src/components/list/listUtils.ts
+++ b/frontend/src/components/list/listUtils.ts
@@ -195,8 +195,10 @@ export const summaryTableWidth = (columns: number, labelWidth: number): number =
 /** 1列の幅。⚠️ ここを変えるときは各テーブルの td の width も合わせること */
 export const SUMMARY_COLUMN_WIDTH = 100;
 
-/** 同期で顧客へ送る LINE ID。⚠️ 値があるときだけ返す（空なら列ごと送らない＝顧客側は NULL のまま） */
-export const lineIdField = (value: unknown): { line_id?: string } => {
-    const lineId = String(value ?? '').trim();
-    return lineId === '' ? {} : { line_id: lineId };
+/** 同期で顧客へ送る任意の列。⚠️ 値があるときだけ返す（空なら列ごと送らない＝顧客側は NULL のまま） */
+export const filledField = <K extends string>(key: K, value: unknown): Partial<Record<K, string>> => {
+    const text = String(value ?? '').trim();
+    return (text === '' ? {} : { [key]: text }) as Partial<Record<K, string>>;
 };
+
+export const lineIdField = (value: unknown) => filledField('line_id', value);
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index a282ebf4..5f945e1a 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.188';
+export const newVersion = '2.2.189';
```
