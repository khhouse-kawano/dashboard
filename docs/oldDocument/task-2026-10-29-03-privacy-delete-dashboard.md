# 2026-10-29 個人情報削除を「削除済み」の印に（v2.2.229）

## 依頼
- ReadMeClaude.md（v2.2.229）
  - information の erasePersonalInfo() で show_dashboard = 0 にするのをやめ、master_data・master_data_kaeru・master_data_resale に delete_dashboard（TINYINT DEFAULT 0）を足して 1 にする
  - delete_dashboard = 1 の顧客は database・information の各処理に返さない
  - それ以外（customerTrend・shopTrend・rank・company）は返す（KPI の歩留まりを正しく）。歩留まりを押して出る一覧では「削除済み顧客」と出す。共通の関数 isDelete を用意し、顧客名・編集ボタンを押せなくする
- 追加: HP の Description（タブの名前）を「Dashboard|PG-CLOUD」→「Dashboard - KHG」（途中で「KHG-Dashboard」から変更）
- 追加: 共通関数を作るなら一覧のモーダルも共通化（工数次第でエージェントが判断）
- 確認への回答: v2.2.227 で削除済みの顧客も戻す SQL を作る／計画どおり着手

## 決めたこと
- **削除済みの印**: privacy_erase:master は伏せ字のあと `delete_dashboard = 1`（show_dashboard は変えない）。履歴（master_data_log）の source = 'privacy_erase' は変えない（直しの SQL が使う）
- **顧客DB・顧客詳細に返さない**
  - database（② 注文・建売／① 中古・① の注文・建売の控え）: `COALESCE(delete_dashboard, 0) = 0`
  - information（② と ① の控え）: 削除済みなら customer・call・interview を `{}`、pdf を `[]`、中古の broker を false にして `deleted: true` を付ける。画面は「この顧客は個人情報を削除済みのため開けません。」と出して閉じる（空の入力欄のまま保存されないように）
  - 保存（② の customer_info・① の customer_info.php）: 削除済みなら「削除済みの顧客のため保存できません。」（① は PDF の保存より前で止める）
  - 同じフォルダのほかの読み込み: 媒介の顧客選び（② realty/index.ts・① broker_customer.php）、過去の顧客（① past_customer.php）も除く
- **集計には返す**: ② の customerTrend・shopTrend・rank・company の顧客の SELECT に `COALESCE(delete_dashboard, 0) AS delete_dashboard` を足しただけ。絞り込み（show_dashboard = 1）は変えない
  - ⚠️ ① の集計の PHP（控え）には足していない。② が落ちている間は名前の欄が伏せ字のまま出る（押すと顧客詳細が「開けません」で閉じる）
- **画面の共通の関数**（utils/deletedCustomer.tsx）: `isDelete(row)`・`CustomerName`（削除済みなら灰色の「削除済み顧客」で押せない。それ以外は今までどおりの点線の名前）・`DELETED_CUSTOMER_LABEL`
  - 商談ステップの「表示」も削除済みでは出さない（商談の記録に名前などが書かれていることがあるため）
- **モーダルの共通化（判断）**
  - shopTrend の3画面の一覧は CustomerListModal と同じ作り（列・10件ずつ）だったので置き換えた。通し番号がページをまたいで続く・見出しに件数が出る、の2点は CustomerListModal に合わせて変わる
  - rank の一覧（ランク・見込み月をその場で直す）と company の CustomerDetail（契約日・仲介）は作りが違うので、まとめずに CustomerName だけ当てた
- **v2.2.227〜228 の削除分の直し**（2026-10-29_master_delete_dashboard.sql）: 履歴に privacy_erase がある顧客のうち、まだ非表示（show_dashboard = 0）で、伏せ字の列がある顧客だけを delete_dashboard = 1・show_dashboard = 1 に

## 確認したこと
- ① を通して ② まで届くか（トークン無しで 401）: database（注文）・shopTrend・rank・company・customerTrend・broker:customer
- ① を通した API（テスト用の担当者と顧客だけ）24件すべて期待どおり
  - 個人情報削除（建売・注文・中古）→ 顧客DB 3つに出ない・残す顧客は出る
  - 顧客詳細 3つ → deleted: true・中身が空。残す顧客は deleted 無しで中身あり
  - shopTrend・rank・customerTrend（各事業）・company → 削除済みも返り delete_dashboard = 1
  - customer_info（② JSON・① multipart の両方）→ 削除済みは断る
  - 媒介の顧客選び → 出ない
- 画面（Playwright。集計の応答はテスト顧客だけに絞って表示）: 店舗別反響推移（建売）・店舗・担当別反響（建売）・全社報告用フォーマットの一覧で「削除済み顧客」と出て伏せ字が出ない・押しても顧客詳細を開かない・残す顧客は開く。ページのエラー 0
- 列の SQL をローカルで2回: 1回目はローカルの削除済み1件が直り、2回目は 0 件
- ② の型チェック・① の php -l・本番ビルド・変えた画面の型チェック
- リファクタリング（置き換えで使わなくなった shopTrend の型 InterviewLog・InterviewAction を削除）のあと、API・画面のテストをもう一度通した
- テスト用の担当者・顧客は消した

## 既にあった問題（今回は直していない・判断待ち）
- 顧客詳細の初期データ（information）は ② で `auth: 'none'`、中古の顧客DB は ① の PHP に認証が無い。トークン無しでも ID が分かれば顧客の情報を取れる
- past_customer（① PHP）はトークン無しで呼ぶと memory_limit を超える

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/scripts/sql | **2026-10-29_master_delete_dashboard.sql・2026-10-29_update_log_2.2.229.sql（新規）** | 列の追加と削除済みの直し／更新履歴＋記事10本 |
| backend-express/src/features | privacy.ts | runPrivacyEraseMaster を delete_dashboard = 1 に |
| backend-express/src/features/database | queries.ts | NOT_DELETED（顧客一覧から除く） |
| backend-express/src/features/information | index.ts・save.ts | fetchIndividual に deleted、withDeleted（新規）／runInformationCustomerInfo で削除済みを断る |
| backend-express/src/features | customerTrend・shopTrend・rank・company の queries.ts | 顧客の SELECT に delete_dashboard |
| backend-express/src/features/realty | index.ts | 媒介の顧客選びから除く |
| backend/src/handlers | databaseAction/database_order・spec・used.php、informationAction/information_order・spec・used.php・customer_info.php、brokerAction/broker_customer.php、past_customer.php | 同じ考え方（① の分） |
| frontend/src/utils | **deletedCustomer.tsx（新規）**・privacyErase.ts・version.ts | isDelete・CustomerName／説明／2.2.229 |
| frontend/src/components | CustomerListModal.tsx | 削除済み顧客の表示 |
| frontend/src/components/shopTrend | ShopTrendOrder・Kaeru・Resale.tsx | 一覧を CustomerListModal に置き換え |
| frontend/src/components/rank | RankOrder・Kaeru・Resale.tsx | 顧客名に CustomerName（注文は商談ステップの「表示」も） |
| frontend/src/components/company | CustomerDetail.tsx | 顧客名に CustomerName |
| frontend/src/components/information | InformationEdit・Kaeru・Resale.tsx | deleted なら知らせて閉じる／確認文 |
| frontend/public | index.html | タブの名前「Dashboard - KHG」 |
| backend/scripts/guide/articles | order・spec・used の screen-020、order/screen-030・070・100、spec/screen-030・060、used/screen-030・040 | 記事（下） |

## 業務ガイドの記事
- 「顧客DB」「顧客DB（建売営業）」「顧客DB（中古リノベ）」: 個人情報削除の節に「顧客DB・詳細に出なくなる（開くと開けませんと出る）」「集計の数には入り、一覧では削除済み顧客と出る」を足した
- 「店舗・担当別反響」「反響推移（販促媒体別・店舗別）」「全社報告用フォーマット」と建売・中古の同じ記事（計7本）: 「削除済み顧客」の節を足した

## コード

### 新規 frontend/src/utils/deletedCustomer.tsx
```tsx
import React from 'react';

/**
 * 個人情報削除で「削除済み」にした顧客（v2.2.229）。
 *
 * ⚠️ 顧客DB（database）・顧客詳細（information）には ② が返さない。
 * ⚠️ 集計（customerTrend・shopTrend・rank・company）には返る（歩留まりに数えるため）。
 *   歩留まりを押して出る一覧では、名前の代わりに「削除済み顧客」と出し、顧客名・編集ボタンを押せなくする。
 * ⚠️ 判定は ② が集計の行に付ける delete_dashboard（1 = 削除済み）。
 */

export const DELETED_CUSTOMER_LABEL = '削除済み顧客';

/** ⚠️ 引数は object で受ける（画面ごとの行の型に delete_dashboard が書かれていなくても渡せるように） */
export const isDelete = (row: object | null | undefined): boolean =>
    Number((row as { delete_dashboard?: unknown } | null | undefined)?.delete_dashboard) === 1;

type NameProps = {
    /** 集計の1行（delete_dashboard を見る） */
    row: object;
    /** 押したとき（顧客詳細を開く）。⚠️ 削除済みなら呼ばない */
    onClick?: () => void;
    /** 名前の部分（「様」や王冠のアイコンを含めてよい） */
    children: React.ReactNode;
    style?: React.CSSProperties;
};

/**
 * 歩留まりの一覧の顧客名。削除済みなら灰色の「削除済み顧客」で押せない。
 * それ以外は今までどおり点線の下線つきで押せる（onClick が無ければただの文字）。
 */
export const CustomerName = ({ row, onClick, children, style }: NameProps) => {
    if (isDelete(row)) {
        return <span className="text-secondary" style={{ cursor: 'not-allowed', ...style }}
            title="個人情報を削除した顧客です。開けません">{DELETED_CUSTOMER_LABEL}</span>;
    }
    if (!onClick) return <>{children}</>;
    return <span onClick={onClick} style={{ cursor: 'pointer', textDecoration: 'underline dotted', ...style }}>{children}</span>;
};
```

### 新規 backend/scripts/sql/2026-10-29_master_delete_dashboard.sql
```sql
-- =====================================================================
-- v2.2.229 顧客DB の「削除済み」の印（delete_dashboard）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 実行順: ② の再ビルドより**前**に流す（② が delete_dashboard を読むため。無いと顧客DB・集計が 500 になる）
--
-- 1) master_data・master_data_kaeru・master_data_resale に delete_dashboard（TINYINT DEFAULT 0）を足す
--    ⚠️ IF NOT EXISTS なので2回流しても壊れない
-- 2) v2.2.227〜228 の個人情報削除で show_dashboard = 0（非表示）にした顧客を、
--    delete_dashboard = 1（削除済み）・show_dashboard = 1（集計に数える）に直す
--    対象: 顧客の変更履歴（master_data_log）に「個人情報削除」（source = privacy_erase）がある顧客のうち、
--          まだ非表示で、伏せ字（********）の列がある顧客
--    ⚠️ 2回目以降は対象 0 件（delete_dashboard = 0 の条件があるため）
-- =====================================================================

-- 1) 列を足す
ALTER TABLE master_data        ADD COLUMN IF NOT EXISTS delete_dashboard TINYINT DEFAULT 0;
ALTER TABLE master_data_kaeru  ADD COLUMN IF NOT EXISTS delete_dashboard TINYINT DEFAULT 0;
ALTER TABLE master_data_resale ADD COLUMN IF NOT EXISTS delete_dashboard TINYINT DEFAULT 0;

-- 2) 直す前の確認（件数だけ）
SELECT 'master_data' AS tbl, COUNT(*) AS cnt FROM master_data m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address)
UNION ALL
SELECT 'master_data_kaeru', COUNT(*) FROM master_data_kaeru m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address)
UNION ALL
SELECT 'master_data_resale', COUNT(*) FROM master_data_resale m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address);

-- 3) 直す
UPDATE master_data m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  SET m.delete_dashboard = 1, m.show_dashboard = 1
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address);
UPDATE master_data_kaeru m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  SET m.delete_dashboard = 1, m.show_dashboard = 1
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address);
UPDATE master_data_resale m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  SET m.delete_dashboard = 1, m.show_dashboard = 1
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address);

-- 4) 終わったあとの確認（削除済みの件数。2) の件数ぶん増えていればよい）
SELECT 'master_data' AS tbl, SUM(delete_dashboard = 1) AS deleted FROM master_data
UNION ALL SELECT 'master_data_kaeru', SUM(delete_dashboard = 1) FROM master_data_kaeru
UNION ALL SELECT 'master_data_resale', SUM(delete_dashboard = 1) FROM master_data_resale;
```

### 変更（差分。追加・修正した関数と前後）
```diff
diff --git a/backend-express/src/features/company/queries.ts b/backend-express/src/features/company/queries.ts
index 9bc4aaff..185d0c66 100644
--- a/backend-express/src/features/company/queries.ts
+++ b/backend-express/src/features/company/queries.ts
@@ -59,17 +59,17 @@ export const CONTRACT_SQL = `
   customer_contacts_name as customer,
   '注文' as category,
   in_charge_store as shop,
   in_charge_user as staff,
   customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
   step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
   '' as contract_broker,
   status,
-  rank_period FROM master_data
+  rank_period, COALESCE(delete_dashboard, 0) AS delete_dashboard FROM master_data
   WHERE show_dashboard = 1 and (step_migration_item_01J82Z5F1RR18Z792C7KZS88QG <> '' or customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク'))`;
 
 /**
  * 契約者一覧（建売分譲事業）。
  *
  * ─────────────────────────────────────────────
  * ⚠️⚠️ **2026-09-10 に契約日の条件を外した。**
  *
@@ -103,17 +103,17 @@ export const CONTRACT_KAERU_SQL = `
   customer_contacts_name as customer,
   '建売' as category,
   in_charge_store as shop,
   in_charge_user as staff,
   customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
   step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract,
   step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as contract_broker,
   status,
-  rank_period FROM master_data_kaeru
+  rank_period, COALESCE(delete_dashboard, 0) AS delete_dashboard FROM master_data_kaeru
   WHERE show_dashboard = 1 AND customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク')`;
 
 /**
  * 契約者一覧（中古リノベ事業）。
  *
  * ⚠️⚠️ **`'中専鹿児島店' as shop` は固定値。** in_charge_store を見ていない。
  *   中古リノベは1店舗しかない前提。店舗が増えたらここを直す必要がある。
  *
@@ -132,13 +132,13 @@ export const CONTRACT_RESALE_SQL = `
   step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract_reform,
   step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract_buy,
   step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as contract_sell,
   contract_land_application_date,
   contract_building_application_date,
   status,
   contraction_contract_price,
   additional_contraction_contract_price,
-  rank_period FROM master_data_resale
+  rank_period, COALESCE(delete_dashboard, 0) AS delete_dashboard FROM master_data_resale
   WHERE show_dashboard = 1`;
 
 /** 契約目標。⚠️ 絞り込みなしの全件（フロントが期で絞る） */
 export const ACHIEVEMENT_SQL = `SELECT category, name, period, value FROM company_achievement`;
diff --git a/backend-express/src/features/customerTrend/queries.ts b/backend-express/src/features/customerTrend/queries.ts
index 60927d32..461422df 100644
--- a/backend-express/src/features/customerTrend/queries.ts
+++ b/backend-express/src/features/customerTrend/queries.ts
@@ -92,17 +92,18 @@ const CUSTOMER_SQL: Record<CustomerTrendCategory, string> = {
       COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
       COALESCE(sales_promotion_name, '') as medium,
       COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG , '')as contract,
       COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
       COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
       COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
       COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
       COALESCE(reserved_interview, '') as reserved_interview,
-      COALESCE(status , '') as status
+      COALESCE(status , '') as status,
+      COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data WHERE show_dashboard = 1`,
   spec: `
     SELECT id,
       COALESCE(customer_contacts_name, '') as customer,
       COALESCE(in_charge_store, '') as shop,
       COALESCE(in_charge_user, '') as staff,
       COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
       COALESCE(sales_promotion_name, '') as medium,
@@ -113,17 +114,18 @@ const CUSTOMER_SQL: Record<CustomerTrendCategory, string> = {
       COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
       COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as application,
       COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
       COALESCE(step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '') as obtain,
       COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
       COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '') as contact,
       COALESCE(hp_campaign, '') as hp_campaign,
       COALESCE(show_dashboard, 0) as show_dashboard,
-      COALESCE(status , '') as status
+      COALESCE(status , '') as status,
+      COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data_kaeru`,
 };
 
 /**
  * 販促媒体。
  * ⚠️ order は列を絞り `response_medium = 0`。spec は medium_kaeru の全列。
  */
 const MEDIUM_SQL: Record<CustomerTrendCategory, string> = {
diff --git a/backend-express/src/features/database/queries.ts b/backend-express/src/features/database/queries.ts
index 44186fff..761a5007 100644
--- a/backend-express/src/features/database/queries.ts
+++ b/backend-express/src/features/database/queries.ts
@@ -47,16 +47,22 @@ const SHOP_SQL: Record<DatabaseCategory, string> = {
  * 販促媒体。
  * ⚠️ 事業ごとに別テーブル。order は medium_list、spec は medium_kaeru。
  */
 const MEDIUM_SQL: Record<DatabaseCategory, string> = {
   order: `SELECT medium, list_medium FROM medium_list WHERE response_medium = 0`,
   spec: `SELECT * FROM medium_kaeru`,
 };
 
+/**
+ * 個人情報削除で削除済みにした顧客（delete_dashboard = 1。v2.2.229）は顧客DB に返さない。
+ * ⚠️ show_dashboard（ゴミ箱）とは別。ゴミ箱の顧客は今までどおり返す（画面が trash で分ける）。
+ */
+const NOT_DELETED = 'COALESCE(delete_dashboard, 0) = 0';
+
 /**
  * 顧客一覧。
  * ⚠️ `gift_base`（条件①②）だけをここで取り、残りは giftApplyToCustomers が付ける。
  */
 const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
   order: `SELECT
   id,
   ${giftBaseSelectSql()},
@@ -109,17 +115,18 @@ const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
       ⚠️ ① の database_order.php にも同じ2行を足してある。
       ⚠️⚠️ **ここはSQLの中なのでバッククォートを書かないこと**（文字列が終わる）。
   */
   COALESCE(competitor_price_gap, '') AS competitor_price_gap,
   COALESCE(competitor_countermeasure, '') AS competitor_countermeasure,
   COALESCE(call_log, '') AS call_log,
   COALESCE(hotlead_id, '') AS hotlead_id,
   COALESCE(k_snap, '') AS k_snap
- FROM master_data`,
+ FROM master_data
+ WHERE ${NOT_DELETED}`,
 
   spec: `SELECT
   id,
   ${giftBaseSelectSql()},
   COALESCE(customer_contacts_name, '') AS customer,
   COALESCE(customer_contacts_name_2, '') AS customer_2,
   COALESCE(customer_contacts_name_kana, '') AS customer_contacts_name_kana,
   COALESCE(in_charge_store, '') AS shop,
@@ -143,17 +150,18 @@ const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
   COALESCE(property_tour_name, '') AS property_tour_name,
   COALESCE(introduction_person_category, '') AS introduction_person_category,
   COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number_2,
   COALESCE(customer_contacts_phone_number, '') AS phone_number,
   COALESCE(customer_contacts_email, '') AS mail,
   COALESCE(extra_address_info, '') AS mail_2,
   COALESCE(integration, '') AS integration,
   COALESCE(call_log, '') AS call_log
- FROM master_data_kaeru`,
+ FROM master_data_kaeru
+ WHERE ${NOT_DELETED}`,
 };
 
 /**
  * 家族情報。
  * ⚠️ order は `family_info IS NOT NULL` で絞り、spec は全件（PHP のまま）。
  *   ⚠️ 揃えると件数が変わる。画面側の使い方も違う
  *   （order は中身を検索に使い、spec は id の有無しか見ていない）。
  */
diff --git a/backend-express/src/features/information/index.ts b/backend-express/src/features/information/index.ts
index af7e53b8..84e66922 100644
--- a/backend-express/src/features/information/index.ts
+++ b/backend-express/src/features/information/index.ts
@@ -152,80 +152,95 @@ const hasIndividualData = (id: string): boolean => id !== '' && id !== 'new';
 const fetchOne = async (
   sql: string,
   id: string
 ): Promise<Record<string, unknown> | EmptyObject> => {
   const rows = await query<DynamicRow>(sql, [id]);
   return rows[0] ?? EMPTY;
 };
 
-/** 個別データ4点（顧客・架電・面談・競合PDF）をまとめて引く */
+/**
+ * 個別データ4点（顧客・架電・面談・競合PDF）をまとめて引く。
+ *
+ * ⚠️ v2.2.229: 個人情報削除で削除済み（delete_dashboard = 1）の顧客は、4点とも返さず deleted: true だけを付ける。
+ *   画面は「削除済みの顧客です」と出して閉じる（空の入力欄のまま保存されないように）。
+ */
 const fetchIndividual = async (
   tableName: string,
   id: string
 ): Promise<{
   customer: Record<string, unknown> | EmptyObject;
   call: Record<string, unknown> | EmptyObject;
   interview: Record<string, unknown> | EmptyObject;
   // ⚠️ pdf だけ配列。⚠️ 2026-09-21 に1ファイル1行へ変えた（PDF_SQL のコメント参照）
   pdf: Record<string, unknown>[];
+  deleted: boolean;
 }> => {
   if (!hasIndividualData(id)) {
-    return { customer: EMPTY, call: EMPTY, interview: EMPTY, pdf: [] };
+    return { customer: EMPTY, call: EMPTY, interview: EMPTY, pdf: [], deleted: false };
   }
 
   const [customer, call, interview, pdf] = await Promise.all([
     fetchOne(`SELECT * FROM ${tableName} WHERE id = ?`, id),
     fetchOne(CALL_SQL, id),
     fetchOne(INTERVIEW_SQL, id),
     query<DynamicRow>(PDF_SQL, [id]),
   ]);
 
-  return { customer, call, interview, pdf };
+  if (Number((customer as Record<string, unknown>).delete_dashboard) === 1) {
+    return { customer: EMPTY, call: EMPTY, interview: EMPTY, pdf: [], deleted: true };
+  }
+  return { customer, call, interview, pdf, deleted: false };
 };
 
+/** 削除済みのときだけ応答に deleted: true を足す（⚠️ それ以外は PHP と同じ形のまま） */
+const withDeleted = <T extends object>(body: T, deleted: boolean): T & { deleted?: true } =>
+  deleted ? { ...body, deleted: true } : body;
+
 // ---------------------------------------------------------------------------
 // 注文（order）
 // ---------------------------------------------------------------------------
 
 export interface InformationOrderResponse {
   staff: Record<string, unknown>[];
   shop: Record<string, unknown>[];
   medium: Record<string, unknown>[];
   customer: Record<string, unknown> | EmptyObject;
   call: Record<string, unknown> | EmptyObject;
   interview: Record<string, unknown> | EmptyObject;
   maker: Record<string, unknown>[];
   introductory: Record<string, unknown>[];
   pdf: Record<string, unknown>[];
+  /** v2.2.229: 個人情報削除で削除済みの顧客のときだけ true（顧客・架電・面談・PDF は空） */
+  deleted?: true;
 }
 
 const runInformationOrder = async (id: string): Promise<InformationOrderResponse> => {
   const [staff, shop, medium, maker, introductory, individual] = await Promise.all([
     query<DynamicRow>(STAFF_SQL),
     query<DynamicRow>(SHOP_SQL_ORDER),
     query<DynamicRow>(MEDIUM_SQL_ORDER),
     query<DynamicRow>(MAKER_SQL),
     query<DynamicRow>(INTRODUCTORY_SQL),
     fetchIndividual(CUSTOMER_TABLES.order, id),
   ]);
 
   // ⚠️ キーの順序も PHP の $result と同じにする。
   //   JSON のキー順が変わるとバイト単位の比較で差分になる。
-  return {
+  return withDeleted({
     staff,
     shop,
     medium,
     customer: individual.customer,
     call: individual.call,
     interview: individual.interview,
     maker,
     introductory,
     pdf: individual.pdf,
-  };
+  }, individual.deleted);
 };
 
 // ---------------------------------------------------------------------------
 // 建売（spec）
 // ---------------------------------------------------------------------------
 
 export interface InformationSpecResponse {
   staff: Record<string, unknown>[];
@@ -233,42 +248,44 @@ export interface InformationSpecResponse {
   medium: Record<string, unknown>[];
   property: Record<string, unknown>[];
   customer: Record<string, unknown> | EmptyObject;
   call: Record<string, unknown> | EmptyObject;
   interview: Record<string, unknown> | EmptyObject;
   maker: Record<string, unknown>[];
   introductory: Record<string, unknown>[];
   pdf: Record<string, unknown>[];
+  /** v2.2.229: 個人情報削除で削除済みの顧客のときだけ true（顧客・架電・面談・PDF は空） */
+  deleted?: true;
 }
 
 const runInformationSpec = async (id: string): Promise<InformationSpecResponse> => {
   const [staff, shop, medium, property, maker, introductory, individual] = await Promise.all([
     query<DynamicRow>(STAFF_SQL),
     query<DynamicRow>(SHOP_SQL_SPEC),
     query<DynamicRow>(MEDIUM_SQL_SPEC),
     query<DynamicRow>(PROPERTY_SQL),
     query<DynamicRow>(MAKER_SQL),
     query<DynamicRow>(INTRODUCTORY_SQL),
     fetchIndividual(CUSTOMER_TABLES.spec, id),
   ]);
 
   // ⚠️ order と違い property が shop の次に入る。PHP の順序どおり
-  return {
+  return withDeleted({
     staff,
     shop,
     medium,
     property,
     customer: individual.customer,
     call: individual.call,
     interview: individual.interview,
     maker,
     introductory,
     pdf: individual.pdf,
-  };
+  }, individual.deleted);
 };
 
 // ---------------------------------------------------------------------------
 // 中古（used）
 // ---------------------------------------------------------------------------
 
 export interface InformationUsedResponse {
   staff: Record<string, unknown>[];
@@ -285,16 +302,18 @@ export interface InformationUsedResponse {
    *
    *   PHP は `$stmt->fetch()` の結果をそのまま入れており、
    *   他の4点（customer / call / interview / pdf）にある
    *   `?: new stdClass()` が **broker には付いていない**。
    *   `{}` に揃えると InformationEditResale.tsx の
    *   真偽判定（`if (response.data.broker)`）の結果が変わる。
    */
   broker: Record<string, unknown> | false;
+  /** v2.2.229: 個人情報削除で削除済みの顧客のときだけ true（顧客・架電・面談・PDF・媒介は空） */
+  deleted?: true;
 }
 
 const runInformationUsed = async (id: string): Promise<InformationUsedResponse> => {
   const [staff, medium, property, maker, introductory, brokerRows, individual] =
     await Promise.all([
       query<DynamicRow>(STAFF_SQL_USED),
       query<DynamicRow>(MEDIUM_SQL_USED),
       query<DynamicRow>(PROPERTY_SQL),
@@ -305,28 +324,29 @@ const runInformationUsed = async (id: string): Promise<InformationUsedResponse>
       //   id が空でも 'new' でも問い合わせが走る（当然ヒットしない）。
       //   ブロックの中に移すと、無駄なクエリは減るが挙動は同じ。
       //   PHP と1対1に保つためここに置いている。
       query<DynamicRow>(BROKER_SQL, [id]),
       fetchIndividual(CUSTOMER_TABLES.used, id),
     ]);
 
   // ⚠️ shop キーは無い。足さないこと（PHP に無いため）
-  return {
+  return withDeleted({
     staff,
     medium,
     property,
     customer: individual.customer,
     call: individual.call,
     interview: individual.interview,
     maker,
     introductory,
     pdf: individual.pdf,
-    broker: brokerRows[0] ?? false,
-  };
+    // ⚠️ 削除済みなら媒介も返さない
+    broker: individual.deleted ? false : (brokerRows[0] ?? false),
+  }, individual.deleted);
 };
 
 // ---------------------------------------------------------------------------
 // 入口
 // ---------------------------------------------------------------------------
 
 export type InformationInitResponse =
   | InformationOrderResponse
diff --git a/backend-express/src/features/information/save.ts b/backend-express/src/features/information/save.ts
index 0275d5cb..04306c7a 100644
--- a/backend-express/src/features/information/save.ts
+++ b/backend-express/src/features/information/save.ts
@@ -125,17 +125,25 @@ export const runInformationCustomerInfo = async (
     if (!(col in data)) continue;
     columns.push(col);
     const v = data[col];
     // ⚠️ 空文字は NULL。undefined / null もそのまま NULL
     values.push(v === '' || v === undefined ? null : (v as SqlParam));
   }
 
   try {
-    const exists = await query<DynamicRow>(`SELECT id FROM ${tableName} WHERE id = ?`, [id]);
+    const exists = await query<DynamicRow>(`SELECT id, delete_dashboard FROM ${tableName} WHERE id = ?`, [id]);
+
+    // ⚠️ v2.2.229: 個人情報削除で削除済みの顧客は上書きしない（伏せ字が戻るのを防ぐ）
+    if (Number(exists[0]?.delete_dashboard) === 1) {
+      return {
+        httpStatus: 200,
+        body: { status: 'error', message: '削除済みの顧客のため保存できません。' },
+      };
+    }
 
     if (exists.length > 0) {
       // --- UPDATE ---
       if (columns.length === 0) {
         // ⚠️ PHP は更新対象が無いとき success を返している。同じにする
         return {
           httpStatus: 200,
           body: {
diff --git a/backend-express/src/features/privacy.ts b/backend-express/src/features/privacy.ts
index eeb22e7d..aceb1bc6 100644
--- a/backend-express/src/features/privacy.ts
+++ b/backend-express/src/features/privacy.ts
@@ -8,16 +8,18 @@ import { logger } from '../utils/logger';
  *
  * ─────────────────────────────────────────────
  * 2026-10-29 の指示:
  *   ・顧客DB（InformationEdit / InformationEditKaeru / InformationEditResale のヘッダー）… 氏名・電話番号・メールアドレス・住所を
  *     アスタリスク8個にして show_dashboard = 0（privacy_erase:master）
  *   ・反響一覧（ListOrder / ListKaeru / ListResale の各行）… 同じ列をアスタリスクにして sync = 1（privacy_erase:inquiry）
  *   ・対象の列は「同じ種類の列も含める」（ふりがな・2人目の氏名・固定電話・郵便番号も）。押せるのはその画面を使える全員
  *   ・2026-10-29 追加: 注文の顧客DB（InformationEdit・master_data）にも
+ *   ・v2.2.229: 顧客DB は show_dashboard = 0 をやめ、delete_dashboard = 1（削除済み）にする。
+ *     顧客DB・顧客詳細には返さず、集計（歩留まり）には数える。集計の一覧では「削除済み顧客」と出す（画面の utils/deletedCustomer.ts）
  *
  * ⚠️⚠️ **元に戻せない。** 画面は「元に戻せません」の確認を出してから送る。
  * ⚠️ 値が入っている列だけ伏せる（空の列に入れると、2人目の氏名などが居るように見えるため）。
  * ⚠️ 誰がいつ消したかを残す: 顧客DB は master_data_log（顧客の変更履歴）、反響は ② のログ（反響には履歴の表が無い）。
  *   ⚠️ 履歴にも消した人の名前と日時だけを書き、消した値は書かない。
  * ⚠️ 表の名前は下の許可リストからだけ選ぶ（リクエストの値を SQL に入れない）。
  * ─────────────────────────────────────────────
  */
@@ -84,21 +86,23 @@ export const runPrivacyEraseMaster = async (staff: AuthenticatedStaff, category:
   const table = MASTER_TABLES[category];
   const id = idOf(body.id);
   if (!table) return fail(400, '事業区分が正しくありません');
   if (id === '' || id === 'new') return fail(400, '顧客IDがありません');
 
   const done = await withTransaction(async (tx) => {
     const rows = await tx.query<DynamicRow>(`SELECT id FROM ${table} WHERE id = ? FOR UPDATE`, [id]);
     if (rows.length === 0) return false;
-    await tx.execute(`UPDATE ${table} SET ${maskSets(MASTER_COLUMNS)}, show_dashboard = 0 WHERE id = ?`, [id]);
+    // ⚠️ v2.2.229: show_dashboard は変えない（集計の歩留まりに数え続ける）。delete_dashboard = 1 で顧客DB・顧客詳細から外す
+    await tx.execute(`UPDATE ${table} SET ${maskSets(MASTER_COLUMNS)}, delete_dashboard = 1 WHERE id = ?`, [id]);
     // ⚠️ log は JSON でないと入らない（CHECK json_valid）。資金計画書の書き戻しと同じく source と columns の形。⚠️ 値は書かない
+    // ⚠️ source = 'privacy_erase' は 2026-10-29_master_delete_dashboard.sql が v2.2.227〜228 の削除分を探すのに使う。変えないこと
     await tx.execute(
       'INSERT INTO master_data_log (id, customer, staff, updated_at, log) VALUES (?, ?, ?, ?, ?)',
-      [id, MASK, staff.name, nowForLog(), JSON.stringify({ source: 'privacy_erase', columns: [...MASTER_COLUMNS, 'show_dashboard'], note: `個人情報削除（${MASK} にして非表示）` })]
+      [id, MASK, staff.name, nowForLog(), JSON.stringify({ source: 'privacy_erase', columns: [...MASTER_COLUMNS, 'delete_dashboard'], note: `個人情報削除（${MASK} にして削除済み）` })]
     );
     return true;
   });
   if (!done) return fail(404, '顧客が見つかりません');
   logger.info(`privacy_erase:master ${category} id=${id} by=${staff.name}`);
   return { httpStatus: 200, body: { status: 'success', mask: MASK } };
 };
 
diff --git a/backend-express/src/features/rank/queries.ts b/backend-express/src/features/rank/queries.ts
index 7c3b982d..86675fde 100644
--- a/backend-express/src/features/rank/queries.ts
+++ b/backend-express/src/features/rank/queries.ts
@@ -86,17 +86,18 @@ const CUSTOMER_SQL: Record<RankCategory, string> = {
            first_interviewed_user as prev_staff,
            customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
            step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
            step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR as screening,
            step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
            step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
            status,
-           rank_period
+           rank_period,
+           COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data
      WHERE show_dashboard = 1`,
 
   spec: `
     SELECT id,
            customer_contacts_name as customer,
            in_charge_store as shop,
            in_charge_user as staff,
@@ -107,17 +108,18 @@ const CUSTOMER_SQL: Record<RankCategory, string> = {
            step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
            step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as application,
            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
            step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG as tour,
            step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
            step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR as screening,
            step_migration_item_01J95TGVT725CV1Z4HTWB22DAV as obtain,
            status,
-           rank_period
+           rank_period,
+           COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data_kaeru
      WHERE show_dashboard = 1 AND in_charge_store <> ''`,
 
   used: `
     SELECT id,
            customer_contacts_name as customer,
            in_charge_store as shop,
            in_charge_user as staff,
@@ -128,17 +130,18 @@ const CUSTOMER_SQL: Record<RankCategory, string> = {
            step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR as screening,
            step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
            step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
            contraction_contract_price as budget_total,
            contract_land_application_date as budget_reform,
            contract_building_application_date as budget_apply,
            status,
-           rank_period
+           rank_period,
+           COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data_resale
      WHERE show_dashboard = 1`,
 };
 
 const ACHIEVEMENT_SQL = `SELECT category, name, period, value FROM company_achievement`;
 const EXPECTED_SQL = `SELECT * FROM contract_expected`;
 
 /**
@@ -164,45 +167,48 @@ const UPDATED_CUSTOMER_SQL: Record<RankCategory, string> = {
            in_charge_store as shop,
            in_charge_user as staff,
            first_interviewed_user as prev_staff,
            customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
            step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
            step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
            status,
-           rank_period
+           rank_period,
+           COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data
      WHERE show_dashboard = 1`,
 
   spec: `
     SELECT id,
            customer_contacts_name as customer,
            in_charge_store as shop,
            in_charge_user as staff,
            customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
            step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
            step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
            status,
-           rank_period
+           rank_period,
+           COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data_kaeru
      WHERE show_dashboard = 1`,
 
   used: `
     SELECT id,
            customer_contacts_name as customer,
            in_charge_store as shop,
            in_charge_user as staff,
            customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
            step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
            step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
            status,
-           rank_period
+           rank_period,
+           COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data_resale
      WHERE show_dashboard = 1`,
 };
 
 /**
  * ランクを保存する列。
  * ⚠️ 3事業とも同じ列（customized_input_01J82Z5F366ZQ897PXWF6H5ZAM）。
  */
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index 46e2f1d4..4ac64e9a 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -133,17 +133,18 @@ export const runBrokerList = async (): Promise<Result> => {
     query<DynamicRow>('SELECT * FROM staff_list WHERE rank = 1'),
   ]);
   return ok({ brokerage, staff });
 };
 
 /** 移植元: brokerAction/broker_customer.php */
 export const runBrokerCustomer = async (): Promise<Result> => {
   const [customer, property] = await Promise.all([
-    query<DynamicRow>('SELECT * FROM master_data_resale WHERE show_dashboard = 1'),
+    // ⚠️ v2.2.229: 個人情報削除で削除済みの顧客（delete_dashboard = 1）は出さない（① の broker_customer.php も同じ）
+    query<DynamicRow>('SELECT * FROM master_data_resale WHERE show_dashboard = 1 AND COALESCE(delete_dashboard, 0) = 0'),
     query<DynamicRow>('SELECT * FROM property_db'),
   ]);
   return ok({ customer, property });
 };
 
 /**
  * 保存してよい列（移植元: broker_update.php の $allowedColumns と同じ）。
  * ⚠️ ここに無いキーは黙って捨てる。列を足したらここにも足す。
diff --git a/backend-express/src/features/shopTrend/queries.ts b/backend-express/src/features/shopTrend/queries.ts
index 6b53dc9a..33649451 100644
--- a/backend-express/src/features/shopTrend/queries.ts
+++ b/backend-express/src/features/shopTrend/queries.ts
@@ -95,17 +95,18 @@ const CUSTOMER_SQL: Record<ShopTrendCategory, string> = {
       COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
       COALESCE(sales_promotion_name, '') as medium,
       COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG , '')as contract,
       COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
       COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
       COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
       COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
       COALESCE(reserved_interview, '') as reserved_interview,
-      COALESCE(status , '') as status
+      COALESCE(status , '') as status,
+      COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data WHERE show_dashboard = 1`,
 
   spec: `
     SELECT id,
       COALESCE(customer_contacts_name, '') as customer,
       COALESCE(in_charge_store, '') as shop,
       COALESCE(in_charge_user, '') as staff,
       COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
@@ -116,17 +117,18 @@ const CUSTOMER_SQL: Record<ShopTrendCategory, string> = {
       COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
       COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as application,
       COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
       COALESCE(step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '') as obtain,
       COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
       COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '') as contact,
       COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
       COALESCE(reserved_interview, '') as reserved_interview,
-      COALESCE(status , '') as status
+      COALESCE(status , '') as status,
+      COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data_kaeru WHERE show_dashboard = 1`,
 
   used: `
     SELECT id,
       COALESCE(customer_contacts_name, '') as customer,
       COALESCE(in_charge_store, '') as shop,
       COALESCE(in_charge_user, '') as staff,
       COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
@@ -141,17 +143,18 @@ const CUSTOMER_SQL: Record<ShopTrendCategory, string> = {
       COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
       COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
       COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
       COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
       COALESCE(step_migration_item_01J82Z5F1WE8SKEES6VNN37B22, '') as appraisal,
       COALESCE(step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '') as negotiation_apo,
       COALESCE(contraction_contract_price, '') as profit,
       COALESCE(reserved_interview, '') as reserved_interview,
-      COALESCE(status , '') as status
+      COALESCE(status , '') as status,
+      COALESCE(delete_dashboard, 0) AS delete_dashboard
       FROM master_data_resale WHERE show_dashboard = 1`,
 };
 
 /**
  * 販促媒体。
  * ⚠️ order だけ列を2つに絞る（medium / list_medium）。
  *   spec / used は専用テーブルの全列（SELECT *）。
  */
diff --git a/backend/src/handlers/brokerAction/broker_customer.php b/backend/src/handlers/brokerAction/broker_customer.php
index 3b70d349..c5c8d448 100644
--- a/backend/src/handlers/brokerAction/broker_customer.php
+++ b/backend/src/handlers/brokerAction/broker_customer.php
@@ -1,11 +1,12 @@
 <?php
 // 最新のデータを取得して返す (既存コードのまま)
-$sql_customer = "SELECT * FROM master_data_resale WHERE show_dashboard = 1";
+// v2.2.229: 個人情報削除で削除済みの顧客（delete_dashboard = 1）は出さない
+$sql_customer = "SELECT * FROM master_data_resale WHERE show_dashboard = 1 AND COALESCE(delete_dashboard, 0) = 0";
 $stmt_customer = $pdo->prepare($sql_customer);
 $stmt_customer->execute();
 $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);
 
 // 物件連携用のデータ
 $sql_property = "SELECT * FROM property_db";
 $stmt_property = $pdo->prepare($sql_property);
 $stmt_property->execute();
diff --git a/backend/src/handlers/databaseAction/database_order.php b/backend/src/handlers/databaseAction/database_order.php
index 84c142f7..86c90370 100644
--- a/backend/src/handlers/databaseAction/database_order.php
+++ b/backend/src/handlers/databaseAction/database_order.php
@@ -82,17 +82,18 @@ $sql_customer = "SELECT
   COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH,
   -- ⚠️ 2026-09-17 に追加。DatabaseOrder.tsx の「要回答」件数で使う。
   -- ⚠️ ② の backend-express/src/features/database/queries.ts と**必ず揃えること**。
   COALESCE(competitor_price_gap, '') AS competitor_price_gap,
   COALESCE(competitor_countermeasure, '') AS competitor_countermeasure,
   COALESCE(call_log, '') AS call_log,
   COALESCE(hotlead_id, '') AS hotlead_id,
   COALESCE(k_snap, '') AS k_snap
- FROM master_data;
+ FROM master_data
+ WHERE COALESCE(delete_dashboard, 0) = 0; -- v2.2.229: 個人情報削除で削除済みの顧客は返さない（② の database/queries.ts と同じ）
 ";
 $stmt_customer = $pdo->prepare($sql_customer);
 $stmt_customer->execute();
 $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);
 
 // ギフト進呈可否を確定させる（条件③④の突き合わせ）
 giftApplyToCustomers($pdo, $response_customer);
 
diff --git a/backend/src/handlers/databaseAction/database_spec.php b/backend/src/handlers/databaseAction/database_spec.php
index 5b2c6d43..2b1931bf 100644
--- a/backend/src/handlers/databaseAction/database_spec.php
+++ b/backend/src/handlers/databaseAction/database_spec.php
@@ -68,17 +68,18 @@ $sql_customer = "SELECT
   COALESCE(property_tour_name, '') AS property_tour_name,
   COALESCE(introduction_person_category, '') AS introduction_person_category,
   COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number_2,
   COALESCE(customer_contacts_phone_number, '') AS phone_number,
   COALESCE(customer_contacts_email, '') AS mail,
   COALESCE(extra_address_info, '') AS mail_2,
   COALESCE(integration, '') AS integration,
   COALESCE(call_log, '') AS call_log
-  FROM master_data_kaeru;
+  FROM master_data_kaeru
+  WHERE COALESCE(delete_dashboard, 0) = 0; -- v2.2.229: 個人情報削除で削除済みの顧客は返さない（② の database/queries.ts と同じ）
 ";
 $stmt_customer = $pdo->prepare($sql_customer);
 $stmt_customer->execute();
 $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);
 
 // ギフト進呈可否を確定させる（条件③④の突き合わせ）
 giftApplyToCustomers($pdo, $response_customer);
 
diff --git a/backend/src/handlers/databaseAction/database_used.php b/backend/src/handlers/databaseAction/database_used.php
index 30820ed9..b83edf40 100644
--- a/backend/src/handlers/databaseAction/database_used.php
+++ b/backend/src/handlers/databaseAction/database_used.php
@@ -51,17 +51,18 @@ $sql_customer = "SELECT
   COALESCE(property_tour_name, '') AS property_tour_name,
   COALESCE(introduction_person_category, '') AS introduction_person_category,
   COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number_2,
   COALESCE(customer_contacts_phone_number, '') AS phone_number,
   COALESCE(customer_contacts_email, '') AS mail,
   COALESCE(extra_address_info, '') AS mail_2,
   COALESCE(integration, '') AS integration,
   COALESCE(call_log, '') AS call_log
-  FROM master_data_resale;
+  FROM master_data_resale
+  WHERE COALESCE(delete_dashboard, 0) = 0; -- v2.2.229: 個人情報削除で削除済みの顧客は返さない
 ";
 $stmt_customer = $pdo->prepare($sql_customer);
 $stmt_customer->execute();
 $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);
 
 
 // 家族情報
 $sql_family = "SELECT * FROM family_info";
diff --git a/backend/src/handlers/informationAction/customer_info.php b/backend/src/handlers/informationAction/customer_info.php
index 95dfaa18..97f741c0 100644
--- a/backend/src/handlers/informationAction/customer_info.php
+++ b/backend/src/handlers/informationAction/customer_info.php
@@ -5,16 +5,27 @@ if (empty($data)) {
 
 $id = $data['id'] ?? null;
 
 if (!$id) {
     echo json_encode(['status' => 'error', 'message' => 'IDが指定されていません。']);
     exit;
 }
 
+// v2.2.229: 個人情報削除で削除済み（delete_dashboard = 1）の顧客は上書きしない（伏せ字が戻るのを防ぐ）。⚠️ PDF の保存より前で止める
+$deletedTables = ['order' => 'master_data', 'spec' => 'master_data_kaeru', 'used' => 'master_data_resale'];
+if (isset($deletedTables[$data['category'] ?? ''])) {
+    $deletedStmt = $pdo->prepare("SELECT delete_dashboard FROM {$deletedTables[$data['category']]} WHERE id = :id");
+    $deletedStmt->execute(['id' => $id]);
+    if ((int) $deletedStmt->fetchColumn() === 1) {
+        echo json_encode(['status' => 'error', 'message' => '削除済みの顧客のため保存できません。'], JSON_UNESCAPED_UNICODE);
+        exit;
+    }
+}
+
 // =========================================================
 // 【追加機能】 PDFファイルのアップロードと competitor_pdf テーブルへの保存（完全上書き版）
 // ※この部分は元のコードのまま変更していません
 // =========================================================
 $new_uploaded_pdfs = [];
 // 💡 検証強化: エラーチェック用の配列を用意
 $upload_errors = [];
 
diff --git a/backend/src/handlers/informationAction/information_order.php b/backend/src/handlers/informationAction/information_order.php
index 5cf25d12..2a7c2e63 100644
--- a/backend/src/handlers/informationAction/information_order.php
+++ b/backend/src/handlers/informationAction/information_order.php
@@ -80,21 +80,34 @@ if ($id !== '' && $id !== 'new') {
     $stmt_pdf->execute([$id]);
     // ⚠️ 1件も無ければ空配列。⚠️ new stdClass() に戻さないこと（画面が配列を期待する）
     $response_pdf = $stmt_pdf->fetchAll(PDO::FETCH_ASSOC) ?: [];
 }
 
 // ==========================================
 // JSON出力
 // ==========================================
+// v2.2.229: 個人情報削除で削除済み（delete_dashboard = 1）の顧客は中身を返さず deleted だけ付ける（② の information/index.ts と同じ）
+$deleted = is_array($response_customer) && (int)($response_customer['delete_dashboard'] ?? 0) === 1;
+if ($deleted) {
+    $response_customer = new stdClass();
+    $response_call = new stdClass();
+    $response_interview = new stdClass();
+    $response_pdf = [];
+}
+
 $result = [
         "staff" => $response_staff,
         "shop" => $response_shop,
         "medium" => $response_medium,
         "customer" => $response_customer,
         "call" => $response_call,
         "interview" => $response_interview,
         "maker" => $response_maker,
         "introductory" => $response_introductory,
         "pdf" => $response_pdf
 ];
 
+if ($deleted) {
+    $result['deleted'] = true;
+}
+
 echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
\ No newline at end of file
diff --git a/backend/src/handlers/informationAction/information_spec.php b/backend/src/handlers/informationAction/information_spec.php
index c11ae587..acd2ede8 100644
--- a/backend/src/handlers/informationAction/information_spec.php
+++ b/backend/src/handlers/informationAction/information_spec.php
@@ -88,22 +88,35 @@ if ($id !== '' && $id !== 'new') {
     $stmt_pdf->execute([$id]);
     // ⚠️ 1件も無ければ空配列。⚠️ new stdClass() に戻さないこと（画面が配列を期待する）
     $response_pdf = $stmt_pdf->fetchAll(PDO::FETCH_ASSOC) ?: [];
 }
 
 // ==========================================
 // JSON出力
 // ==========================================
+// v2.2.229: 個人情報削除で削除済み（delete_dashboard = 1）の顧客は中身を返さず deleted だけ付ける（② の information/index.ts と同じ）
+$deleted = is_array($response_customer) && (int)($response_customer['delete_dashboard'] ?? 0) === 1;
+if ($deleted) {
+    $response_customer = new stdClass();
+    $response_call = new stdClass();
+    $response_interview = new stdClass();
+    $response_pdf = [];
+}
+
 $result = [
     "staff" => $response_staff,
     "shop" => $response_shop,
     "medium" => $response_medium,
     "property" => $response_property,
     "customer" => $response_customer,
     "call" => $response_call,
     "interview" => $response_interview,
     "maker" => $response_maker,
     "introductory" => $response_introductory,
     "pdf" => $response_pdf
 ];
 
+if ($deleted) {
+    $result['deleted'] = true;
+}
+
 echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
diff --git a/backend/src/handlers/informationAction/information_used.php b/backend/src/handlers/informationAction/information_used.php
index 87265678..d3a675aa 100644
--- a/backend/src/handlers/informationAction/information_used.php
+++ b/backend/src/handlers/informationAction/information_used.php
@@ -90,22 +90,36 @@ if ($id !== '' && $id !== 'new') {
     $stmt_pdf->execute([$id]);
     // ⚠️ 1件も無ければ空配列。⚠️ new stdClass() に戻さないこと（画面が配列を期待する）
     $response_pdf = $stmt_pdf->fetchAll(PDO::FETCH_ASSOC) ?: [];
 }
 
 // ==========================================
 // JSON出力
 // ==========================================
+// v2.2.229: 個人情報削除で削除済み（delete_dashboard = 1）の顧客は中身を返さず deleted だけ付ける（② の information/index.ts と同じ）
+$deleted = is_array($response_customer) && (int)($response_customer['delete_dashboard'] ?? 0) === 1;
+if ($deleted) {
+    $response_customer = new stdClass();
+    $response_call = new stdClass();
+    $response_interview = new stdClass();
+    $response_pdf = [];
+    $response_broker = false;
+}
+
 $result = [
     "staff" => $response_staff,
     "medium" => $response_medium,
     "property" => $response_property,
     "customer" => $response_customer,
     "call" => $response_call,
     "interview" => $response_interview,
     "maker" => $response_maker,
     "introductory" => $response_introductory,
     "pdf" => $response_pdf,
     "broker" => $response_broker
 ];
 
+if ($deleted) {
+    $result['deleted'] = true;
+}
+
 echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
diff --git a/backend/src/handlers/past_customer.php b/backend/src/handlers/past_customer.php
index bd72292f..f9697e3f 100644
--- a/backend/src/handlers/past_customer.php
+++ b/backend/src/handlers/past_customer.php
@@ -52,17 +52,18 @@ $sql_customer = "SELECT
   COALESCE(full_address, '') AS full_address,
   COALESCE(hp_campaign, '') AS hp_campaign,
   COALESCE(property_name, '') AS property_name,
   COALESCE(property_tour_name, '') AS property_tour_name,
   COALESCE(introduction_person_category, '') AS introduction_person_category,
   COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
   COALESCE(customer_contacts_email, '') AS mail,
   COALESCE(integration, '') AS integration
-  FROM master_data_kaeru;
+  FROM master_data_kaeru
+  WHERE COALESCE(delete_dashboard, 0) = 0; -- v2.2.229: 個人情報削除で削除済みの顧客は返さない
 ";
 $stmt_customer = $pdo->prepare($sql_customer);
 $stmt_customer->execute();
 $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);
 
 
 $result = [
         "staff" => $response_staff,
diff --git a/frontend/public/index.html b/frontend/public/index.html
index b5bcde5b..81b215a9 100644
--- a/frontend/public/index.html
+++ b/frontend/public/index.html
@@ -15,15 +15,16 @@
       rel="stylesheet"
     />
     <!-- v2.2.227: アイコンを差し替え（favicon.ico と各サイズの PNG・apple-touch-icon） -->
     <link rel="icon" href="./favicon.ico" sizes="any" />
     <link rel="icon" type="image/png" sizes="16x16" href="./favicon-16x16.png" />
     <link rel="icon" type="image/png" sizes="32x32" href="./favicon-32x32.png" />
     <link rel="icon" type="image/png" sizes="48x48" href="./favicon-48x48.png" />
     <link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png" />
-    <title>Dashboard|PG-CLOUD</title>
+    <!-- v2.2.229: タブの名前を Dashboard - KHG に -->
+    <title>Dashboard - KHG</title>
   </head>
   <body>
     <noscript>You need to enable JavaScript to run this app.</noscript>
     <div id="root"></div>
   </body>
 </html>
diff --git a/frontend/src/components/CustomerListModal.tsx b/frontend/src/components/CustomerListModal.tsx
index 9c47b053..b4f5141e 100644
--- a/frontend/src/components/CustomerListModal.tsx
+++ b/frontend/src/components/CustomerListModal.tsx
@@ -1,13 +1,14 @@
 import React, { useEffect, useState } from 'react';
 import Modal from 'react-bootstrap/Modal';
 import Table from 'react-bootstrap/Table';
 import { ModalBody } from 'react-bootstrap';
 import InterviewLog from './InterviewLog';
+import { CustomerName, isDelete } from '../utils/deletedCustomer';
 
 /**
  * KPIの歩留まりに該当する顧客の一覧モーダル。
  *
  * ─────────────────────────────────────────────
  * ⚠️⚠️ **このコンポーネントは「表示」だけを担う。**
  *   どの顧客が該当するかを決めるのは呼び出し側である。
  *
@@ -20,16 +21,20 @@ import InterviewLog from './InterviewLog';
  *
  * ⚠️ 受け取る配列は「すでに絞り込み済みの顧客」である。
  *   このコンポーネントは並べ替えも絞り込みもしない。
  * ─────────────────────────────────────────────
  *
  * ⚠️ 顧客詳細（InformationEdit）は事業ごとに別コンポーネントなので、
  *   ここには置かず `onSelectCustomer` で呼び出し側へ渡す。
  *   商談ステップ（InterviewLog）は3事業共通なので、ここで持つ。
+ *
+ * 使っている画面: customerTrend（注文・建売）、shopTrend（注文・建売・中古。v2.2.229 で各画面の同じ作りの一覧から置き換え）
+ * ⚠️ v2.2.229: 個人情報削除で削除済みの顧客（delete_dashboard = 1）は「削除済み顧客」と出し、顧客名も商談ステップの「表示」も押せない
+ *   （商談の記録に名前などが書かれていることがあるため）。utils/deletedCustomer.tsx
  */
 
 /** ⚠️ 画面ごとに列が違うので Record で受ける。使うキーだけ下で読む */
 export type CustomerListRow = {
     id?: string;
     customer?: string;
     shop?: string;
     staff?: string;
@@ -100,30 +105,32 @@ const CustomerListModal: React.FC<Props> = ({ show, label, list, onHide, onSelec
                                 <td>販促媒体</td>
                                 <td>商談ステップ</td>
                             </tr>
                             {list.slice(page * PAGE_SIZE - PAGE_SIZE, page * PAGE_SIZE).map((item, index) =>
                                 <tr key={item.id ?? index}>
                                     {/* ⚠️ ページをまたいでも通し番号になるようにする */}
                                     <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                                     <td>
-                                        {onSelectCustomer
-                                            ? <span onClick={() => onSelectCustomer(item.id ?? '')}
-                                                style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{item.customer}</span>
-                                            : item.customer}
+                                        {/* ⚠️ v2.2.229: 削除済みの顧客は「削除済み顧客」で押せない */}
+                                        <CustomerName row={item} onClick={onSelectCustomer ? () => onSelectCustomer(item.id ?? '') : undefined}>
+                                            {item.customer}
+                                        </CustomerName>
                                     </td>
                                     <td>{item.shop}</td>
                                     <td>{item.staff}</td>
                                     {/* ⚠️ 未来場（反響・来場予約の一覧）では空になるので '-' を出す */}
                                     <td>{item.interview || '-'}</td>
                                     <td>{item.status}</td>
                                     <td>{item.rank}</td>
                                     <td>{item.medium}</td>
-                                    <td><div className="bg-danger text-white rounded text-center px-3 py-1 mx-auto" style={{ width: 'fit-content', cursor: 'pointer' }}
-                                        onClick={() => setInterviewId(item.id ?? '')}>表示</div></td>
+                                    <td>{isDelete(item)
+                                        ? <div className="text-secondary text-center">-</div>
+                                        : <div className="bg-danger text-white rounded text-center px-3 py-1 mx-auto" style={{ width: 'fit-content', cursor: 'pointer' }}
+                                            onClick={() => setInterviewId(item.id ?? '')}>表示</div>}</td>
                                 </tr>)}
                         </tbody>
                     </Table>
                     <div className="d-flex px-3 justify-content-around" style={{ fontSize: '12px' }}>
                         <div className={hasPrev ? 'text-primary' : ''}
                             style={{ cursor: hasPrev ? 'pointer' : 'text' }}
                             onClick={() => { if (hasPrev) setPage(page - 1); }}>前の{PAGE_SIZE}件</div>
                         <div className={hasNext ? 'text-primary' : ''}
diff --git a/frontend/src/components/company/CustomerDetail.tsx b/frontend/src/components/company/CustomerDetail.tsx
index edbcd281..cc6ea692 100644
--- a/frontend/src/components/company/CustomerDetail.tsx
+++ b/frontend/src/components/company/CustomerDetail.tsx
@@ -1,11 +1,12 @@
 import React from 'react';
 import Table from "react-bootstrap/Table";
 import Modal from 'react-bootstrap/Modal';
+import { CustomerName } from '../../utils/deletedCustomer';
 
 type Customer = Record<string, string>;
 
 type Props = {
     show: boolean,
     setShow: React.Dispatch<React.SetStateAction<boolean>>,
     contract: Customer[],
     setEditId: React.Dispatch<React.SetStateAction<Record<string, string>>>
@@ -36,24 +37,23 @@ const CustomerDetail = ({ show, setShow, contract, setEditId }: Props) => {
                                     '注文': 'order',
                                     '建売': 'kaeru',
                                     '中専': 'resale'
                                 };
                                 const contractDate = categoryValue === '中専' ? (c.contract_reform || c.contract_buy || c.contract_sell || '-')
                                     : c.contract || c.contract_broker || '-';
                                 return <tr key={index}>
                                     <td>{contractDate}</td>
-                                    <td><span onClick={() => {
+                                    {/* v2.2.229: 削除済みの顧客は「削除済み顧客」で押せない */}
+                                    <td><CustomerName row={c} onClick={() => {
                                         setEditId(prev => ({
                                             ...prev,
                                             [idMapping[c.category]]: c.id
                                         }));
-                                    }
-                                    }
-                                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{c.customer} 様</span>
+                                    }}>{c.customer} 様</CustomerName>
                                         {c.contract_broker && <span className='bg-success text-white rounded px-1 ms-1' style={{fontSize: '9px'}}>仲介</span>}</td>
                                     <td>{categoryValue === '中専' ? c.staff || '-' : c.shop}</td>
                                     <td>{categoryValue === '中専' ? `${c.contraction_contract_price || '-'}万円` : c.staff}</td>
                                 </tr>
                             }
                             )}
                         </tbody>
                     </Table>
diff --git a/frontend/src/components/information/InformationEdit.tsx b/frontend/src/components/information/InformationEdit.tsx
index 0c2bf70c..f4a63a2d 100644
--- a/frontend/src/components/information/InformationEdit.tsx
+++ b/frontend/src/components/information/InformationEdit.tsx
@@ -277,16 +277,22 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
             });
             setSending(false);
         }
 
         const fetchData = async () => {
             try {
 
                 const response = await apiClient.post("", { request: "information", category, id });
+                // v2.2.229: 個人情報削除で削除済みの顧客は ② が中身を返さない（deleted: true）。空の入力欄のまま保存されないよう閉じる
+                if (response.data.deleted) {
+                    alert('この顧客は個人情報を削除済みのため開けません。');
+                    modalClose();
+                    return;
+                }
 
                 const shopData = response.data.shop.filter(s => s.division === '注文事業' && !s.shop.includes('未設定') && !s.shop.includes('全店舗'));
                 setShopArray(shopData);
 
                 setStaffArray(response.data.staff.filter(s => s.category === 1 && s.period === String(thisYear)));
                 setMediumArray(response.data.medium);
                 setOriginalMakerList(response.data.maker);
                 setIntroductoryList(response.data.introductory.map(i => i.name));
@@ -676,17 +682,17 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
     });
 
     /**
      * 個人情報削除（v2.2.227）。氏名・電話番号・メールアドレス・住所を ******** にして、顧客DBの一覧から外す（show_dashboard = 0）。
      * ⚠️ 元に戻せない。⚠️ 入力中で保存していない内容は保存せずに閉じる
      */
     const erasePersonalInfo = async () => {
         if (!id || id === 'new') return;
-        if (!confirmPrivacyErase(String(information.customer_contacts_name ?? ''), '顧客DBの一覧から外します')) return;
+        if (!confirmPrivacyErase(String(information.customer_contacts_name ?? ''), '顧客DBから外します（集計の数には残ります）')) return;
         try {
             await postPrivacyErase('master', category, { id });
             alert('個人情報を削除しました。');
             modalClose();
             handleClose();
         } catch (e) {
             alert((e as Error).message);
         }
diff --git a/frontend/src/components/information/InformationEditKaeru.tsx b/frontend/src/components/information/InformationEditKaeru.tsx
index 368053d6..fbb00a25 100644
--- a/frontend/src/components/information/InformationEditKaeru.tsx
+++ b/frontend/src/components/information/InformationEditKaeru.tsx
@@ -243,16 +243,22 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
                 add: false
             });
             setSending(false);
         }
 
         const fetchData = async () => {
             try {
                 const response = await apiClient.post("", { request: "information", category, id });
+                // v2.2.229: 個人情報削除で削除済みの顧客は ② が中身を返さない（deleted: true）。空の入力欄のまま保存されないよう閉じる
+                if (response.data.deleted) {
+                    alert('この顧客は個人情報を削除済みのため開けません。');
+                    modalClose();
+                    return;
+                }
 
                 setShopArray(response.data.shop);
                 setStaffArray(response.data.staff.filter(s => s.category === 1 && Number(s.period) === thisYear));
                 setMediumArray(response.data.medium.map(m => ({ ...m, list_medium: 1 })));
                 setOriginalPropertyList(response.data.property.filter(p => p.store_name === '株式会社　国分ハウジング不動産　本店').map(p => p.property_name));
                 setIntroductoryList(response.data.introductory.map(i => i.name));
                 setOriginalMakerList(response.data.maker);
                 setIntroductoryList(response.data.introductory.map(i => i.name));
@@ -613,17 +619,17 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
         onClickCapture: openOnClickCapture(expand[key], () => setExpand(prev => ({ ...prev, [key]: true })))
     });
     /**
      * 個人情報削除（v2.2.227）。氏名・電話番号・メールアドレス・住所を ******** にして、顧客DBの一覧から外す（show_dashboard = 0）。
      * ⚠️ 元に戻せない。⚠️ 入力中で保存していない内容は保存せずに閉じる
      */
     const erasePersonalInfo = async () => {
         if (!id || id === 'new') return;
-        if (!confirmPrivacyErase(String(information.customer_contacts_name ?? ''), '顧客DBの一覧から外します')) return;
+        if (!confirmPrivacyErase(String(information.customer_contacts_name ?? ''), '顧客DBから外します（集計の数には残ります）')) return;
         try {
             await postPrivacyErase('master', category, { id });
             alert('個人情報を削除しました。');
             modalClose();
             handleClose();
         } catch (e) {
             alert((e as Error).message);
         }
diff --git a/frontend/src/components/information/InformationEditResale.tsx b/frontend/src/components/information/InformationEditResale.tsx
index bc84e4a8..812fa888 100644
--- a/frontend/src/components/information/InformationEditResale.tsx
+++ b/frontend/src/components/information/InformationEditResale.tsx
@@ -242,16 +242,22 @@ const InformationEditResale = ({ id, token, onClose, authority }: Props) => {
                 add: false
             });
             setSending(false);
         }
 
         const fetchData = async () => {
             try {
                 const response = await apiClient.post("", { request: "information", category, id });
+                // v2.2.229: 個人情報削除で削除済みの顧客は ② が中身を返さない（deleted: true）。空の入力欄のまま保存されないよう閉じる
+                if (response.data.deleted) {
+                    alert('この顧客は個人情報を削除済みのため開けません。');
+                    modalClose();
+                    return;
+                }
 
                 setShopArray(categoryList);
                 setStaffArray(response.data.staff
                     .sort((a, b) => {
                         const positionA = positions.indexOf(a.position);
                         const positionB = positions.indexOf(b.position);
                         return positionA - positionB
                     })
@@ -627,17 +633,17 @@ const InformationEditResale = ({ id, token, onClose, authority }: Props) => {
     });
 
     /**
      * 個人情報削除（v2.2.227）。氏名・電話番号・メールアドレス・住所を ******** にして、顧客DBの一覧から外す（show_dashboard = 0）。
      * ⚠️ 元に戻せない。⚠️ 入力中で保存していない内容は保存せずに閉じる
      */
     const erasePersonalInfo = async () => {
         if (!id || id === 'new') return;
-        if (!confirmPrivacyErase(String(information.customer_contacts_name ?? ''), '顧客DBの一覧から外します')) return;
+        if (!confirmPrivacyErase(String(information.customer_contacts_name ?? ''), '顧客DBから外します（集計の数には残ります）')) return;
         try {
             await postPrivacyErase('master', category, { id });
             alert('個人情報を削除しました。');
             modalClose();
             handleClose();
         } catch (e) {
             alert((e as Error).message);
         }
diff --git a/frontend/src/components/rank/RankKaeru.tsx b/frontend/src/components/rank/RankKaeru.tsx
index a6287a7a..8e3b2e38 100644
--- a/frontend/src/components/rank/RankKaeru.tsx
+++ b/frontend/src/components/rank/RankKaeru.tsx
@@ -12,16 +12,17 @@ import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import { getFiscalYearMonthsFromJune } from '../../utils/getFiscalYearMonthsFromJune';
 import InformationEditKaeru from '../information/InformationEditKaeru';
 import InterviewLog from '../InterviewLog';
 import StaffMemo from './StaffMemo';
 import { getYears } from '../../utils/getYears';
 import { staffSorter } from '../../utils/staffSorter';
 import { useIsSp } from '../../utils/isSp';
 import apiClient from '../../utils/apiClient';
+import { CustomerName } from '../../utils/deletedCustomer';
 
 type Customer = Record<string, string>;
 type Achievement = { category: string, name: string, period: string, value: string }
 type Expect = { date: string, shop: string, section: string, count: number };
 type Target = { [key: string]: boolean };
 type Shop = { brand: string, shop: string, section: string, area: string, division: string };
 type Label = { label: string, show: boolean, category: string };
 type Staff = { id: number, name: string, pg_id: string, shop: string, mail: string, status: string, category: number, rank: number, sort: number, period: string, position: string };
@@ -629,20 +630,20 @@ const RankOrder = () => {
                                         <td>契約日<span className='text-success'>(仲介)</span></td>
                                     </tr>
                                     {modalList.slice(page - 20, page).map((item, index) =>
                                         <tr key={index}>
                                             <td>{page - 20 + index + 1}</td>
                                             <td>{item.shop}</td>
                                             <td>{item.staff}</td>
                                             <td>
-                                                <div style={{ textDecoration: 'underline dotted', cursor: 'pointer', width: 'fit-content' }}
-                                                    onClick={() => setEditId(item.id)}>
+                                                {/* v2.2.229: 削除済みの顧客は「削除済み顧客」で押せない */}
+                                                <CustomerName row={item} onClick={() => setEditId(item.id)} style={{ display: 'inline-block' }}>
                                                     {item.status === '契約済み' && <i className="fa-solid fa-crown pe-1"></i>}{item.customer}
-                                                </div>
+                                                </CustomerName>
                                             </td>
                                             <td>
                                                 <select className='target' style={{ width: '80px' }} value={item.rank}
                                                     onChange={(e) => {
                                                         setNewRank(item.id, e.target.value, '');
                                                     }}>
                                                     <option value=''>未設定</option>
                                                     {['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク', 'Fランク'].map(rank => {
diff --git a/frontend/src/components/rank/RankOrder.tsx b/frontend/src/components/rank/RankOrder.tsx
index 87eac869..4bc13f51 100644
--- a/frontend/src/components/rank/RankOrder.tsx
+++ b/frontend/src/components/rank/RankOrder.tsx
@@ -12,16 +12,17 @@ import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import { getFiscalYearMonthsFromJune } from '../../utils/getFiscalYearMonthsFromJune';
 import InformationEdit from '../information/InformationEdit';
 import InterviewLog from '../InterviewLog';
 import StaffMemo from './StaffMemo';
 import { getYears } from '../../utils/getYears';
 import { staffSorter } from '../../utils/staffSorter';
 import { useIsSp } from '../../utils/isSp';
 import apiClient from '../../utils/apiClient';
+import { CustomerName, isDelete } from '../../utils/deletedCustomer';
 
 type Customer = { id: string, customer: string, date: string, status: string, rank: string, register: string, interview: string, shop: string, staff: string, section: string; contract: string, rank_period: string, appointment: string, screening: string, prev_staff: string };
 type Achievement = { category: string, name: string, period: string, value: string }
 type Expect = { date: string, shop: string, section: string, count: number };
 type Target = { [key: string]: boolean };
 type Shop = { brand: string, shop: string, section: string, division: string, };
 type Label = { label: string, show: boolean, category: string, shop?: string };
 type Staff = { id: number, name: string, pg_id: string, shop: string, mail: string, status: string, category: number, rank: number, sort: number, period: string, position: string };
@@ -618,20 +619,20 @@ const RankOrder = () => {
                                     {modalList.slice(page - 20, page).map((item, index) => {
                                         const currentStaff = item.staff[0] ?? '';
                                         const prevStaff = item.staff[1] ? `(${item.staff[1]})` : '';
                                         return <tr key={index}>
                                             <td>{page - 20 + index + 1}</td>
                                             <td>{item.shop}</td>
                                             <td>{currentStaff}{prevStaff}</td>
                                             <td>
-                                                <div style={{ textDecoration: 'underline dotted', cursor: 'pointer', width: 'fit-content' }}
-                                                    onClick={() => setEditId(item.id)}>
+                                                {/* v2.2.229: 削除済みの顧客は「削除済み顧客」で押せない */}
+                                                <CustomerName row={item} onClick={() => setEditId(item.id)} style={{ display: 'inline-block' }}>
                                                     {item.status === '契約済み' && <i className="fa-solid fa-crown pe-1"></i>}{item.customer}
-                                                </div>
+                                                </CustomerName>
                                             </td>
                                             <td>
                                                 <select className='target' style={{ width: '80px' }} value={item.rank}
                                                     onChange={(e) => {
                                                         setNewRank(item.id, e.target.value, '');
                                                     }}>
                                                     <option value=''>未設定</option>
                                                     {['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'].map(rank => {
@@ -650,18 +651,20 @@ const RankOrder = () => {
                                                         `${targetMonth.split('/')[0]}/${String(Number(targetMonth.split('/')[1]) + 2).padStart(2, '0')}`].map(period => {
                                                             return <option value={period} key={period} selected={period === item.rank_period}>{period}</option>
                                                         }
                                                         )}
                                                 </select></td>
                                             <td>{dateFormate(item.register)}</td>
                                             <td>{dateFormate(item.interview)}</td>
                                             <td>{dateFormate(item.contract)}</td>
-                                            <td><div className="bg-danger text-white rounded text-center px-3 py-1 mx-auto" style={{ width: 'fit-content', cursor: 'pointer' }}
-                                                onClick={() => setInterviewId(item.id)}>表示</div></td>
+                                            <td>{isDelete(item)
+                                                ? <div className="text-secondary text-center">-</div>
+                                                : <div className="bg-danger text-white rounded text-center px-3 py-1 mx-auto" style={{ width: 'fit-content', cursor: 'pointer' }}
+                                                    onClick={() => setInterviewId(item.id)}>表示</div>}</td>
                                         </tr>
                                     })}
                                 </tbody>
                             </Table>
                             <div className="d-flex justify-content-around" style={{ fontSize: '12px' }}>
                                 <div className="text-primary" style={{ cursor: 'pointer' }}
                                     onClick={() => setPage(page - 20)}>{(modalList.length > 20 && page > 20) && '前の20件'}</div>
                                 <div className="text-primary" style={{ cursor: 'pointer' }}
diff --git a/frontend/src/components/rank/RankResale.tsx b/frontend/src/components/rank/RankResale.tsx
index fbe3f100..220bd83f 100644
--- a/frontend/src/components/rank/RankResale.tsx
+++ b/frontend/src/components/rank/RankResale.tsx
@@ -11,16 +11,17 @@ import Tooltip from 'react-bootstrap/Tooltip';
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import { getFiscalYearMonthsFromJune } from '../../utils/getFiscalYearMonthsFromJune';
 import InformationEditResale from '../information/InformationEditResale';
 import StaffMemo from './StaffMemo';
 import { getYears } from '../../utils/getYears';
 import { staffSorter } from '../../utils/staffSorter';
 import { useIsSp } from '../../utils/isSp';
 import apiClient from '../../utils/apiClient';
+import { CustomerName } from '../../utils/deletedCustomer';
 
 type Customer = Record<string, string>;
 type Achievement = { category: string, name: string, period: string, value: string }
 type Expect = { date: string, shop: string, section: string, count: number };
 type Target = { [key: string]: boolean };
 type Shop = { shop: string, section: string };
 type Label = { label: string, show: boolean, category: string };
 type Staff = Record<string, string>;
@@ -583,20 +584,20 @@ const RankResale = () => {
                                         <td>契約日</td>
                                     </tr>
                                     {modalList.slice(page - 20, page).map((item, index) =>
                                         <tr key={index}>
                                             <td>{page - 20 + index + 1}</td>
                                             <td>{item.shop}</td>
                                             <td>{item.staff}</td>
                                             <td>
-                                                <div style={{ textDecoration: 'underline dotted', cursor: 'pointer', width: 'fit-content' }}
-                                                    onClick={() => setEditId(item.id)}>
+                                                {/* v2.2.229: 削除済みの顧客は「削除済み顧客」で押せない */}
+                                                <CustomerName row={item} onClick={() => setEditId(item.id)} style={{ display: 'inline-block' }}>
                                                     {item.status === '契約済み' && <i className="fa-solid fa-crown pe-1"></i>}{item.customer}
-                                                </div>
+                                                </CustomerName>
                                             </td>
                                             <td>
                                                 <select className='target' style={{ width: '80px' }} value={item.rank}
                                                     onChange={(e) => {
                                                         setNewRank(item.id, e.target.value, '');
                                                     }}>
                                                     <option value=''>未設定</option>
                                                     {['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'].map(rank => {
diff --git a/frontend/src/components/shopTrend/ShopTrendKaeru.tsx b/frontend/src/components/shopTrend/ShopTrendKaeru.tsx
index a549d623..5ccc669d 100644
--- a/frontend/src/components/shopTrend/ShopTrendKaeru.tsx
+++ b/frontend/src/components/shopTrend/ShopTrendKaeru.tsx
@@ -15,19 +15,18 @@ import {
     ResponsiveContainer,
 } from "recharts";
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import { setSection } from '../../utils/setSection';
 import { setStaffLength } from '../../utils/setStaffLength';
 import { budgetFilter } from '../../utils/budgetFilter';
 import { get11MonthsAgoString } from '../../utils/get11MonthsAgoString';
 import { isLastYear } from '../../utils/isLastYear';
-import { ModalBody } from 'react-bootstrap';
 import InformationEditKaeru from '../information/InformationEditKaeru';
-import InterviewLog from '../InterviewLog';
+import CustomerListModal from '../CustomerListModal';
 import { thisYear } from '../../utils/thisYear';
 import apiClient from '../../utils/apiClient';
 
 type Shop = { brand: string; shop: string; section: string; area: string; }
 type Customer = Record<string, string>;
 type Medium = { id: number; medium: string, list_medium: number };
 type Staff = { name: string; shop: string; rank: number, section: string };
 type ResponseData = { period: string, register: number, contact: number, interview: number, application: number, contract: number };
@@ -92,21 +91,18 @@ const ShopTrendKaeru = () => {
         application: { name: '申込み', show: true },
         contract: { name: '契約数', show: true },
         budget: { name: '広告費', show: false },
         comparison: { name: '昨年実績', show: false }
     });
     const [mediumChecked, setMediumChecked] = useState({});
     const [listShow, setListShow] = useState({ show: false, label: '' });
     const [modalList, setModalList] = useState<Customer[]>([]);
-    const [listPage, setListPage] = useState(1);
 
     const [editId, setEditId] = useState('');
-    /** 商談ステップ（InterviewLog）を開く顧客ID。'' なら閉じている */
-    const [interviewId, setInterviewId] = useState('');
     const [isReverse, setIsReverse] = useState(true);
 
     useEffect(() => {
         const fetchData = async () => {
             try {
                 const response = await apiClient.post("", { request: 'shopTrend', category });
                 await setOriginalCustomerList(response.data.customer);
                 await setOriginalShopArray(response.data.shop.filter(s => !s.shop.includes('全店舗')));
@@ -203,17 +199,16 @@ const ShopTrendKaeru = () => {
     };
 
     const modalClose = () => {
         setResponseLineData([]);
         setGemini('');
         setShow(false);
         setGeminiApi(false);
         setListShow({ show: false, label: '' });
-        setListPage(1);
     };
 
     const checkedChange = (e) => {
         const { name } = e.target;
 
         setChecked(prev => ({
             ...prev,
             [name]: {
@@ -904,66 +899,16 @@ const ShopTrendKaeru = () => {
                                         </tr>
                                     })}
                                 </tbody>
                             </Table>
                         </div>
                     </div>
                 </Modal.Body>
             </Modal>
-            <Modal show={listShow.show} onHide={modalClose} size='xl'>
-                <Modal.Header closeButton>{listShow.label}一覧</Modal.Header>
-                <ModalBody>
-                    <Table bordered striped>
-                        <tbody style={{ fontSize: '12px' }} className='align-middle'>
-                            <tr>
-                                <td>No</td>
-                                <td>顧客名</td>
-                                <td>店舗</td>
-                                <td>担当営業</td>
-                                <td>初回来場日</td>
-                                <td>ステータス</td>
-                                <td>ランク</td>
-                                <td>販促媒体</td>
-                                <td>商談ステップ</td>
-                            </tr>
-                            {modalList.slice(listPage * 10 - 10, listPage * 10).map((item, index) =>
-                                <tr key={index}>
-                                    <td>{index + 1}</td>
-                                    <td><span onClick={() => setEditId(item.id)} style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{item.customer}</span></td>
-                                    <td>{item.shop}</td>
-                                    <td>{item.staff}</td>
-                                    {/* ⚠️ 未来場（来場予約・キャンセルの一覧）では空になるので '-' を出す */}
-                                    <td>{item.interview || '-'}</td>
-                                    <td>{item.status}</td>
-                                    <td>{item.rank}</td>
-                                    <td>{item.medium}</td>
-                                    <td><div className="bg-danger text-white rounded text-center px-3 py-1 mx-auto" style={{ width: 'fit-content', cursor: 'pointer' }}
-                                        onClick={() => setInterviewId(item.id)}>表示</div></td>
-                                </tr>)}
-                        </tbody>
-                    </Table>
-                    <div className="d-flex px-3 justify-content-around" style={{ fontSize: '12px' }}>
-                        <div className={`${listPage > 1 ? 'text-primary' : ''}`}
-                            style={{ cursor: listPage > 1 ? 'pointer' : 'text' }}
-                            onClick={() => {
-                                if (listPage > 1) {
-                                    setListPage(listPage - 1);
-                                }
-                            }}>前の10件</div>
-                        <div className={`${modalList.length - listPage * 10 > 0 ? 'text-primary' : ''}`}
-                            style={{ cursor: modalList.length - listPage * 10 > 0 ? 'pointer' : 'text' }}
-                            onClick={() => {
-                                if (modalList.length - listPage * 10 > 0) {
-                                    setListPage(listPage + 1);
-                                }
-                            }}
-                        >次の10件</div>
-                    </div>
-                </ModalBody>
-            </Modal>
-            <InterviewLog idValue={interviewId} setInterviewId={setInterviewId} />
+            {/* v2.2.229: 同じ作りの一覧を共通の CustomerListModal にした（削除済み顧客の表示もそちら） */}
+            <CustomerListModal show={listShow.show} label={listShow.label} list={modalList} onHide={modalClose} onSelectCustomer={setEditId} />
             <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
         </>
     )
 }
 
 export default ShopTrendKaeru;
\ No newline at end of file
diff --git a/frontend/src/components/shopTrend/ShopTrendOrder.tsx b/frontend/src/components/shopTrend/ShopTrendOrder.tsx
index 4f158453..58afd0b1 100644
--- a/frontend/src/components/shopTrend/ShopTrendOrder.tsx
+++ b/frontend/src/components/shopTrend/ShopTrendOrder.tsx
@@ -15,19 +15,18 @@ import {
     ResponsiveContainer,
 } from "recharts";
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import { setSection } from '../../utils/setSection';
 import { setStaffLength } from '../../utils/setStaffLength';
 import { budgetFilter } from '../../utils/budgetFilter';
 import { get11MonthsAgoString } from '../../utils/get11MonthsAgoString';
 import { isLastYear } from '../../utils/isLastYear';
-import { ModalBody } from 'react-bootstrap';
 import InformationEdit from '../information/InformationEdit';
-import InterviewLog from '../InterviewLog';
+import CustomerListModal from '../CustomerListModal';
 import { thisYear } from '../../utils/thisYear';
 import apiClient from '../../utils/apiClient';
 
 /**
  * 店舗。
  * ⚠️ `multi` / `parent_shop` は shop_list 由来で、「併売店をまとめる」にだけ使う。
  *   ⚠️ `sections`（課を店舗に見立てた配列）にはこの2つが無いため任意にしている。
  */
@@ -39,28 +38,16 @@ type ResponseData = { period: string, register: number, reserve: number, intervi
 type CheckItem = {
     name: string;
     show: boolean;
 };
 type CheckedState = {
     [key: string]: CheckItem;
 };
 type Budget = { budget_period: string, shop: string, medium: string, budget_value: number, note: string, company: string, response_medium: number, section: string, order_section: string };
-type InterviewAction = {
-    day: string;
-    action: string;
-    note: string;
-};
-type InterviewLog = {
-    id: string,
-    shop: string,
-    name: string,
-    interview_log: InterviewAction[],
-    add: boolean
-};
 const ShopTrendOrder = () => {
     const { authority, category } = useContext(AuthContext);
     const [shopArray, setShopArray] = useState<Shop[]>([]);
     const [originalShopArray, setOriginalShopArray] = useState<Shop[]>([]);
     const [customerList, setCustomerList] = useState<Customer[]>([]);
     const [originalCustomerList, setOriginalCustomerList] = useState<Customer[]>([]);
     const startMonthValue = get11MonthsAgoString().replace(/-/g, '/');
     const [startMonth, setStartMonth] = useState(startMonthValue);
@@ -104,18 +91,16 @@ const ShopTrendOrder = () => {
         contract: { name: '契約数', show: true },
         cancel: { name: 'キャンセル数', show: true },
         budget: { name: '広告費', show: false },
         comparison: { name: '昨年実績', show: false }
     });
     const [mediumChecked, setMediumChecked] = useState({});
     const [listShow, setListShow] = useState({ show: false, label: '' });
     const [modalList, setModalList] = useState<Customer[]>([]);
-    const [listPage, setListPage] = useState(1);
-    const [interviewId, setInterviewId] = useState('');
 
     const [editId, setEditId] = useState('');
 
     /**
      * 併売店をまとめるか。
      *
      * ⚠️ 親店舗（shop_list.parent_shop）は**利用者が手作業で設定する**。
      *   1件も設定されていなければ、ONにしても表示・集計は一切変わらない
@@ -276,17 +261,16 @@ const ShopTrendOrder = () => {
     };
 
     const modalClose = () => {
         setResponseLineData([]);
         setGemini('');
         setShow(false);
         setGeminiApi(false);
         setListShow({ show: false, label: '' });
-        setListPage(1);
     };
 
     const checkedChange = (e) => {
         const { name } = e.target;
 
         setChecked(prev => ({
             ...prev,
             [name]: {
@@ -790,66 +774,16 @@ const ShopTrendOrder = () => {
                                         </tr>
                                     })}
                                 </tbody>
                             </Table>
                         </div>
                     </div>
                 </Modal.Body>
             </Modal>
-            <Modal show={listShow.show} onHide={modalClose} size='xl'>
-                <Modal.Header closeButton>{listShow.label}一覧</Modal.Header>
-                <ModalBody>
-                    <Table bordered striped>
-                        <tbody style={{ fontSize: '12px' }} className='align-middle'>
-                            <tr>
-                                <td>No</td>
-                                <td>顧客名</td>
-                                <td>店舗</td>
-                                <td>担当営業</td>
-                                <td>初回来場日</td>
-                                <td>ステータス</td>
-                                <td>ランク</td>
-                                <td>販促媒体</td>
-                                <td>商談ステップ</td>
-                            </tr>
-                            {modalList.slice(listPage * 10 - 10, listPage * 10).map((item, index) =>
-                                <tr key={index}>
-                                    <td>{index + 1}</td>
-                                    <td><span onClick={() => setEditId(item.id)} style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{item.customer}</span></td>
-                                    <td>{item.shop}</td>
-                                    <td>{item.staff}</td>
-                                    {/* ⚠️ 未来場（来場予約・キャンセルの一覧）では空になるので '-' を出す */}
-                                    <td>{item.interview || '-'}</td>
-                                    <td>{item.status}</td>
-                                    <td>{item.rank}</td>
-                                    <td>{item.medium}</td>
-                                    <td><div className="bg-danger text-white rounded text-center px-3 py-1 mx-auto" style={{ width: 'fit-content', cursor: 'pointer' }}
-                                        onClick={() => setInterviewId(item.id)}>表示</div></td>
-                                </tr>)}
-                        </tbody>
-                    </Table>
-                    <div className="d-flex px-3 justify-content-around" style={{ fontSize: '12px' }}>
-                        <div className={`${listPage > 1 ? 'text-primary' : ''}`}
-                            style={{ cursor: listPage > 1 ? 'pointer' : 'text' }}
-                            onClick={() => {
-                                if (listPage > 1) {
-                                    setListPage(listPage - 1);
-                                }
-                            }}>前の10件</div>
-                        <div className={`${modalList.length - listPage * 10 > 0 ? 'text-primary' : ''}`}
-                            style={{ cursor: modalList.length - listPage * 10 > 0 ? 'pointer' : 'text' }}
-                            onClick={() => {
-                                if (modalList.length - listPage * 10 > 0) {
-                                    setListPage(listPage + 1);
-                                }
-                            }}
-                        >次の10件</div>
-                    </div>
-                </ModalBody>
-            </Modal>
-            <InterviewLog idValue={interviewId} setInterviewId={setInterviewId} />
+            {/* v2.2.229: 同じ作りの一覧を共通の CustomerListModal にした（削除済み顧客の表示もそちら） */}
+            <CustomerListModal show={listShow.show} label={listShow.label} list={modalList} onHide={modalClose} onSelectCustomer={setEditId} />
             <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
         </>
     )
 }
 
 export default ShopTrendOrder;
\ No newline at end of file
diff --git a/frontend/src/components/shopTrend/ShopTrendResale.tsx b/frontend/src/components/shopTrend/ShopTrendResale.tsx
index a3899e6c..5d425772 100644
--- a/frontend/src/components/shopTrend/ShopTrendResale.tsx
+++ b/frontend/src/components/shopTrend/ShopTrendResale.tsx
@@ -15,46 +15,33 @@ import {
     Legend,
     ResponsiveContainer,
 } from "recharts";
 import { getYearMonthArray } from '../../utils/getYearMonthArray';
 import { setSection } from '../../utils/setSection';
 import { budgetFilter } from '../../utils/budgetFilter';
 import { get11MonthsAgoString } from '../../utils/get11MonthsAgoString';
 import { isLastYear } from '../../utils/isLastYear';
-import { ModalBody } from 'react-bootstrap';
 import InformationEditResale from '../information/InformationEditResale';
-import InterviewLog from '../InterviewLog';
+import CustomerListModal from '../CustomerListModal';
 import apiClient from '../../utils/apiClient';
 
 type Shop = Record<string, string>;
 type Customer = Record<string, string>;
 type Medium = { id: number; medium: string, list_medium: number };
 type Staff = { name: string; shop: string; rank: number, section: string };
 type ResponseData = { period: string, register: number, reserve: number, interview: number, appointment: number, cancel: number, contract: number };
 type CheckItem = {
     name: string;
     show: boolean;
 };
 type CheckedState = {
     [key: string]: CheckItem;
 };
 type Budget = { budget_period: string, shop: string, medium: string, budget_value: number, note: string, company: string, response_medium: number, section: string, order_section: string };
-type InterviewAction = {
-    day: string;
-    action: string;
-    note: string;
-};
-type InterviewLog = {
-    id: string,
-    shop: string,
-    name: string,
-    interview_log: InterviewAction[],
-    add: boolean
-};
 
 const originalShopArray = [{
     shop: '買い:中古リノベ', section: '中古住宅専門店'
 }, {
     shop: '買い:ポータル', section: '中古住宅専門店'
 }, {
     shop: '売り:ポータル', section: '中古住宅専門店'
 }];
@@ -95,18 +82,16 @@ const ShopTrendResale = () => {
         contract: { name: '契約数', show: true },
         profit: { name: '粗利総額', show: true },
         budget: { name: '広告費', show: false },
         comparison: { name: '昨年実績', show: false },
     });
     const [mediumChecked, setMediumChecked] = useState({});
     const [listShow, setListShow] = useState({ show: false, label: '' });
     const [modalList, setModalList] = useState<Customer[]>([]);
-    const [listPage, setListPage] = useState(1);
-    const [interviewId, setInterviewId] = useState('');
 
     const [editId, setEditId] = useState('');
 
     useEffect(() => {
         const fetchData = async () => {
             try {
                 const response = await apiClient.post("", { request: 'shopTrend', category });
                 await setOriginalCustomerList(response.data.customer);
@@ -246,17 +231,16 @@ const ShopTrendResale = () => {
     };
 
     const modalClose = () => {
         setResponseLineData([]);
         setGemini('');
         setShow(false);
         setGeminiApi(false);
         setListShow({ show: false, label: '' });
-        setListPage(1);
     };
 
     const checkedChange = (e) => {
         const { name } = e.target;
 
         setChecked(prev => ({
             ...prev,
             [name]: {
@@ -873,66 +857,16 @@ const formateSummary = (
                                         </tr>
                                     })}
                                 </tbody>
                             </Table>
                         </div>
                     </div>
                 </Modal.Body>
             </Modal>
-            <Modal show={listShow.show} onHide={modalClose} size='xl'>
-                <Modal.Header closeButton>{listShow.label}一覧</Modal.Header>
-                <ModalBody>
-                    <Table bordered striped>
-                        <tbody style={{ fontSize: '12px' }} className='align-middle'>
-                            <tr>
-                                <td>No</td>
-                                <td>顧客名</td>
-                                <td>店舗</td>
-                                <td>担当営業</td>
-                                <td>初回来場日</td>
-                                <td>ステータス</td>
-                                <td>ランク</td>
-                                <td>販促媒体</td>
-                                <td>商談ステップ</td>
-                            </tr>
-                            {modalList.slice(listPage * 10 - 10, listPage * 10).map((item, index) =>
-                                <tr key={index}>
-                                    <td>{index + 1}</td>
-                                    <td><span onClick={() => setEditId(item.id)} style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{item.customer}</span></td>
-                                    <td>{item.shop}</td>
-                                    <td>{item.staff}</td>
-                                    {/* ⚠️ 未来場（来場予約・キャンセルの一覧）では空になるので '-' を出す */}
-                                    <td>{item.interview || '-'}</td>
-                                    <td>{item.status}</td>
-                                    <td>{item.rank}</td>
-                                    <td>{item.medium}</td>
-                                    <td><div className="bg-danger text-white rounded text-center px-3 py-1 mx-auto" style={{ width: 'fit-content', cursor: 'pointer' }}
-                                        onClick={() => setInterviewId(item.id)}>表示</div></td>
-                                </tr>)}
-                        </tbody>
-                    </Table>
-                    <div className="d-flex px-3 justify-content-around" style={{ fontSize: '12px' }}>
-                        <div className={`${listPage > 1 ? 'text-primary' : ''}`}
-                            style={{ cursor: listPage > 1 ? 'pointer' : 'text' }}
-                            onClick={() => {
-                                if (listPage > 1) {
-                                    setListPage(listPage - 1);
-                                }
-                            }}>前の10件</div>
-                        <div className={`${modalList.length - listPage * 10 > 0 ? 'text-primary' : ''}`}
-                            style={{ cursor: modalList.length - listPage * 10 > 0 ? 'pointer' : 'text' }}
-                            onClick={() => {
-                                if (modalList.length - listPage * 10 > 0) {
-                                    setListPage(listPage + 1);
-                                }
-                            }}
-                        >次の10件</div>
-                    </div>
-                </ModalBody>
-            </Modal>
-            <InterviewLog idValue={interviewId} setInterviewId={setInterviewId} />
+            {/* v2.2.229: 同じ作りの一覧を共通の CustomerListModal にした（削除済み顧客の表示もそちら） */}
+            <CustomerListModal show={listShow.show} label={listShow.label} list={modalList} onHide={modalClose} onSelectCustomer={setEditId} />
             <InformationEditResale id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
         </>
     )
 }
 
 export default ShopTrendResale;
\ No newline at end of file
diff --git a/frontend/src/utils/privacyErase.ts b/frontend/src/utils/privacyErase.ts
index 04231647..4c545728 100644
--- a/frontend/src/utils/privacyErase.ts
+++ b/frontend/src/utils/privacyErase.ts
@@ -1,17 +1,18 @@
 import apiClient from './apiClient';
 
 /**
  * 個人情報削除（v2.2.227）。顧客DB（InformationEditKaeru / Resale）と反響一覧（ListOrder / Kaeru / Resale）で共通。
  *
  * ⚠️⚠️ 元に戻せない。必ず confirmPrivacyErase で確かめてから送る。
  * ⚠️ 処理は ② の features/privacy.ts（privacy_erase:master / privacy_erase:inquiry）。
  *   氏名・ふりがな・電話番号・メールアドレス・住所（郵便番号を含む）を ******** にする。
- *   顧客DB は show_dashboard = 0（一覧から消える）、反響は sync = 1（取込済み）。
+ *   顧客DB は delete_dashboard = 1（v2.2.229〜。顧客DB・顧客詳細から消え、集計には「削除済み顧客」として残る。utils/deletedCustomer.tsx）、
+ *   反響は sync = 1（取込済み）。
  */
 
 export const PRIVACY_MASK = '********';
 
 /** 確認（キャンセルなら false） */
 export const confirmPrivacyErase = (name: string, after: string): boolean =>
     window.confirm(
         `${name ? `${name} 様の` : ''}個人情報を削除します。\n\n`
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index f355a38a..0e4144fe 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.228';
+export const newVersion = '2.2.229';
```

### 業務ガイドの記事（差分）
```diff
diff --git a/backend/scripts/guide/articles/order/screen-020.md b/backend/scripts/guide/articles/order/screen-020.md
index c2b0bd61..96922032 100644
--- a/backend/scripts/guide/articles/order/screen-020.md
+++ b/backend/scripts/guide/articles/order/screen-020.md
@@ -57,8 +57,10 @@ summary: お客様の検索と、商談の日付・ステータス・ランク
 - [[ランク]]
 
 ## 個人情報削除
-顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBの一覧から外します。
+顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBから外します。
 - 誰がいつ消したかは、そのお客様の変更履歴に残ります（消した値は残りません）
+- 顧客DBの一覧にも、お客様の詳細にも出なくなります（詳細を開こうとすると「個人情報を削除済みのため開けません」と出ます）
+- 集計の画面（店舗・担当別反響・反響推移・全社報告用フォーマットなど）の数には、そのまま入ります。数を押して出る一覧では「削除済み顧客」と出て、開けません
 
 > 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。
 
diff --git a/backend/scripts/guide/articles/order/screen-030.md b/backend/scripts/guide/articles/order/screen-030.md
index 4807f242..7b4c9e1f 100644
--- a/backend/scripts/guide/articles/order/screen-030.md
+++ b/backend/scripts/guide/articles/order/screen-030.md
@@ -23,3 +23,10 @@ summary: 課・店舗・担当ごとの月の成績と、ランク別の見込
 ## 関係する記事
 - [[ランク]]
 - [[来場率・次アポ率・契約率]]
+
+## 削除済み顧客
+数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
+- 来場や契約などの数には、削除する前と同じく入ります
+- 名前は出ず、押してもお客様の詳細や商談ステップは開きません
+
+> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
diff --git a/backend/scripts/guide/articles/order/screen-070.md b/backend/scripts/guide/articles/order/screen-070.md
index 69fcb42c..8737639a 100644
--- a/backend/scripts/guide/articles/order/screen-070.md
+++ b/backend/scripts/guide/articles/order/screen-070.md
@@ -24,3 +24,10 @@ summary: 月ごとの反響・来場・次アポ・契約の推移。
 > 注意：[[販促媒体別広告費]] とは数え方が違うので、同じ月でも数字が合わないことがあります。
 
 数字を押すと、そのお客様の一覧が開きます。
+
+## 削除済み顧客
+数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
+- 来場や契約などの数には、削除する前と同じく入ります
+- 名前は出ず、押してもお客様の詳細や商談ステップは開きません
+
+> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
diff --git a/backend/scripts/guide/articles/order/screen-100.md b/backend/scripts/guide/articles/order/screen-100.md
index a5716659..26f7d81b 100644
--- a/backend/scripts/guide/articles/order/screen-100.md
+++ b/backend/scripts/guide/articles/order/screen-100.md
@@ -16,3 +16,10 @@ summary: 年度の予算と契約実績を、グループから担当まで。
 ## 関係する記事
 - [[契約したら（注文営業）]]
 - [[ランク]]
+
+## 削除済み顧客
+数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
+- 来場や契約などの数には、削除する前と同じく入ります
+- 名前は出ず、押してもお客様の詳細や商談ステップは開きません
+
+> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
diff --git a/backend/scripts/guide/articles/spec/screen-020.md b/backend/scripts/guide/articles/spec/screen-020.md
index ffaa2c80..b9193120 100644
--- a/backend/scripts/guide/articles/spec/screen-020.md
+++ b/backend/scripts/guide/articles/spec/screen-020.md
@@ -35,8 +35,10 @@ summary: お客様の検索と、商談ステップ・ステータス・ラン
 > 要確認：お客様に閲覧履歴の話をそのまま伝えるかどうかは、社内のルールに従ってください。
 
 ## 個人情報削除
-顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBの一覧から外します。
+顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBから外します。
 - 誰がいつ消したかは、そのお客様の変更履歴に残ります（消した値は残りません）
+- 顧客DBの一覧にも、お客様の詳細にも出なくなります（詳細を開こうとすると「個人情報を削除済みのため開けません」と出ます）
+- 集計の画面（店舗・担当別反響・反響推移・全社報告用フォーマットなど）の数には、そのまま入ります。数を押して出る一覧では「削除済み顧客」と出て、開けません
 
 > 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。
 
diff --git a/backend/scripts/guide/articles/spec/screen-030.md b/backend/scripts/guide/articles/spec/screen-030.md
index 792cf2ef..e56af917 100644
--- a/backend/scripts/guide/articles/spec/screen-030.md
+++ b/backend/scripts/guide/articles/spec/screen-030.md
@@ -18,3 +18,10 @@ summary: 課・店舗・担当ごとの月の成績と、ランク別の見込
 > 数え方は、その月に起きた数で数える「実績日起算」です（[[反響日起算と実績日起算]]）。
 
 > 注意：ランクを変えた直後、次アポ数などが一時的に0になることがあります。画面を開き直すと戻ります。
+
+## 削除済み顧客
+数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
+- 来場や契約などの数には、削除する前と同じく入ります
+- 名前は出ず、押してもお客様の詳細や商談ステップは開きません
+
+> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
diff --git a/backend/scripts/guide/articles/spec/screen-060.md b/backend/scripts/guide/articles/spec/screen-060.md
index 2ebfba99..c21b9acc 100644
--- a/backend/scripts/guide/articles/spec/screen-060.md
+++ b/backend/scripts/guide/articles/spec/screen-060.md
@@ -26,3 +26,10 @@ summary: 年度の予算と契約実績（建売営業）。
 
 ## 関係する記事
 - [[契約したら（建売営業）]]
+
+## 削除済み顧客
+数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
+- 来場や契約などの数には、削除する前と同じく入ります
+- 名前は出ず、押してもお客様の詳細や商談ステップは開きません
+
+> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
diff --git a/backend/scripts/guide/articles/used/screen-020.md b/backend/scripts/guide/articles/used/screen-020.md
index a29eb5fc..70682c11 100644
--- a/backend/scripts/guide/articles/used/screen-020.md
+++ b/backend/scripts/guide/articles/used/screen-020.md
@@ -21,8 +21,10 @@ summary: お客様の検索と編集（中古リノベ）。
 > 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。
 
 ## 個人情報削除
-顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBの一覧から外します。
+顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBから外します。
 - 誰がいつ消したかは、そのお客様の変更履歴に残ります（消した値は残りません）
+- 顧客DBの一覧にも、お客様の詳細にも出なくなります（詳細を開こうとすると「個人情報を削除済みのため開けません」と出ます）
+- 集計の画面（店舗・担当別反響・反響推移・全社報告用フォーマットなど）の数には、そのまま入ります。数を押して出る一覧では「削除済み顧客」と出て、開けません
 
 > 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。
 
diff --git a/backend/scripts/guide/articles/used/screen-030.md b/backend/scripts/guide/articles/used/screen-030.md
index a6e97456..f645b68b 100644
--- a/backend/scripts/guide/articles/used/screen-030.md
+++ b/backend/scripts/guide/articles/used/screen-030.md
@@ -19,3 +19,10 @@ summary: 月の成績を粗利で見る（中古リノベ）。
 - **契約**：ステータスが契約済みで、リフォーム契約日・売買契約日・媒介取得日のどれかがその月の人
 
 > 店舗の行の「中古住宅専門店」は買い:中古リノベ、「不動産企画係」はポータル（買い・売り）です。
+
+## 削除済み顧客
+数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
+- 来場や契約などの数には、削除する前と同じく入ります
+- 名前は出ず、押してもお客様の詳細や商談ステップは開きません
+
+> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
diff --git a/backend/scripts/guide/articles/used/screen-040.md b/backend/scripts/guide/articles/used/screen-040.md
index 1ffc9e81..2b9d6502 100644
--- a/backend/scripts/guide/articles/used/screen-040.md
+++ b/backend/scripts/guide/articles/used/screen-040.md
@@ -15,3 +15,10 @@ summary: 年度の予算と契約実績を金額で見る（中古リノベ）
 
 ## 関係する記事
 - [[契約したら（中古リノベ）]]
+
+## 削除済み顧客
+数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
+- 来場や契約などの数には、削除する前と同じく入ります
+- 名前は出ず、押してもお客様の詳細や商談ステップは開きません
+
+> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
```
