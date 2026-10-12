# 2026-10-12 v2.2.187 顧客一覧：氏名②（customer_contacts_name_2）を2行目に表示・名前検索の対象に

## 依頼（ReadMeClaude.md ＋ 回答）
- `frontend/src/components/database/` の DatabaseOrder.tsx / DatabaseKaeru.tsx / DatabaseResale.tsx
- **顧客名**の列を2行に（master_data / master_data_kaeru / master_data_resale の `customer_contacts_name_2` が真の場合のみ）
- バックエンドが customer_contacts_name_2 を返しているか確認 → **返していなかった**（①②とも）
- 回答: 版は **v2.2.187**（指示書の v2.2.186 は誤り）／「顧客名で検索」で氏名②も対象 ／ 注文も氏名②があれば2行でよい

## バックエンド（`COALESCE(customer_contacts_name_2, '') AS customer_2` を `customer` の次に追加）
| サーバー | ディレクトリ | ファイル | 用途 |
|---|---|---|---|
| ② | backend-express/src/features/database | **queries.ts** | 注文・建売の一覧（CUSTOMER_SQL の order / spec） |
| ① | backend/src/handlers/databaseAction | **database_order.php** | 注文（② が落ちたときのフォールバック） |
| ① | 同上 | **database_spec.php** | 建売（同上） |
| ① | 同上 | **database_used.php** | 中古（⚠️ ② に移植されていないので ① だけ） |
| ① | 同上 | **database_order_trash.php** / **database_spec_trash.php** / **database_used_trash.php** | 非表示・戻す の後に返す一覧（⚠️ 画面がこれで入れ替わるため、入れないと操作後に2行目が消える） |
| ① | 同上 | **database_used_copy.php** | 中古のコピー後に返す一覧（同上） |

## フロント
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/database | **customerName2.tsx**（新規） | `cleanCustomerName` / `hasCustomerName2` / `CustomerName2`（2行目の表示。少し小さい灰色。値が無ければ何も出さない） |
| 同上 | **DatabaseOrder.tsx** | 型 `customer_2`、顧客名のマスに `<CustomerName2>`、名前検索に氏名②（空白を消して比較） |
| 同上 | **DatabaseKaeru.tsx** | 顧客名のマスに `<CustomerName2>`、名前検索に氏名②（空白を消して比較） |
| 同上 | **DatabaseResale.tsx** | 顧客名のマスに `<CustomerName2>`、名前検索に氏名②（⚠️ この画面の既存の規則どおり空白は消さずに比較） |

⚠️ 注文の画面のコメント「Nexus アイコンの隣で改行しないこと」は、アイコンの並びは変えていない。氏名②がある行だけ高くなる（2026-10-12 了承）。

## その他
- version.ts 2.2.187、`backend/scripts/sql/2026-10-12_update_log_2.2.187.sql`
- ローカル DB に update_log 181〜187 を投入（Docker 復旧後。no=277〜283）

## 確認（ローカル）
- ② `tsc --noEmit` OK、① PHP 7ファイル `php -l` OK、eslint 新規警告なし、`npm run build` 成功 → **`main.625b3c40.js`**（※ その後 task-2026-10-12-02 で `main.590cf219.js` に）
- DB の氏名②あり: 注文 86 ／ 建売 84 ／ 中古 9
- ② `runDatabase('order')`: 25,856行すべてに customer_2、値あり 86 ／ `runDatabase('spec')`: 11,294行、値あり 84
- ① database_used.php: 2,674行、値あり 9 ／ database_spec.php: 11,294行、値あり 84 ／ database_order.php: 25,856行、値あり 88（※ 実行時点の差）
- ⚠️ database_order.php は CLI の memory_limit 128M では足りず（ピーク約151MB）。今回の追加は1列（JSON で約0.4MB）で、既存の作りの問題。本番 ① の memory_limit は未確認。注文は通常 ② が応答するのでフォールバック時だけの話
- 画面での見た目は未確認

## 差分（全文）
```diff
diff --git a/backend-express/src/features/database/queries.ts b/backend-express/src/features/database/queries.ts
index bcd1b2b6..44186fff 100644
--- a/backend-express/src/features/database/queries.ts
+++ b/backend-express/src/features/database/queries.ts
@@ -61,6 +61,7 @@ const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
   id,
   ${giftBaseSelectSql()},
   COALESCE(customer_contacts_name, '') AS customer,
+  COALESCE(customer_contacts_name_2, '') AS customer_2,
   /*
     ⚠️ 2026-09-25 に追加。DatabaseOrder.tsx の Nexus アイコンの判定で使う。
       ⚠️ 返さないと画面側が undefined になり、⚠️ **アイコンが一切出なくなる。**
@@ -119,6 +120,7 @@ const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
   id,
   ${giftBaseSelectSql()},
   COALESCE(customer_contacts_name, '') AS customer,
+  COALESCE(customer_contacts_name_2, '') AS customer_2,
   COALESCE(customer_contacts_name_kana, '') AS customer_contacts_name_kana,
   COALESCE(in_charge_store, '') AS shop,
   COALESCE(in_charge_user, '') AS staff,
diff --git a/backend/src/handlers/databaseAction/database_order.php b/backend/src/handlers/databaseAction/database_order.php
index ee72e76d..84c142f7 100644
--- a/backend/src/handlers/databaseAction/database_order.php
+++ b/backend/src/handlers/databaseAction/database_order.php
@@ -43,6 +43,7 @@ $sql_customer = "SELECT
   id,
   " . giftBaseSelectSql() . ",
   COALESCE(customer_contacts_name, '') AS customer,
+  COALESCE(customer_contacts_name_2, '') AS customer_2,
   -- 2026-09-25 に追加。DatabaseOrder.tsx の Nexus アイコンの判定で使う。
   -- 返さないと画面側が undefined になり、アイコンが一切出なくなる。
   -- ② の backend-express/src/features/database/queries.ts にも同じ1行がある。
diff --git a/backend/src/handlers/databaseAction/database_order_trash.php b/backend/src/handlers/databaseAction/database_order_trash.php
index 57b34955..e3ff42d3 100644
--- a/backend/src/handlers/databaseAction/database_order_trash.php
+++ b/backend/src/handlers/databaseAction/database_order_trash.php
@@ -13,6 +13,7 @@ if ($stmt_trash->execute([$data['show_dashboard'], $data['id']])) {
 $sql_customer = "SELECT
   id,
   COALESCE(customer_contacts_name, '') AS customer,
+  COALESCE(customer_contacts_name_2, '') AS customer_2,
   COALESCE(in_charge_store, '') AS shop,
   COALESCE(in_charge_user, '') AS staff,
   COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
diff --git a/backend/src/handlers/databaseAction/database_spec.php b/backend/src/handlers/databaseAction/database_spec.php
index c4eeb2c3..5b2c6d43 100644
--- a/backend/src/handlers/databaseAction/database_spec.php
+++ b/backend/src/handlers/databaseAction/database_spec.php
@@ -45,6 +45,7 @@ $sql_customer = "SELECT
   id,
   " . giftBaseSelectSql() . ",
   COALESCE(customer_contacts_name, '') AS customer,
+  COALESCE(customer_contacts_name_2, '') AS customer_2,
   COALESCE(customer_contacts_name_kana, '') AS customer_contacts_name_kana,
   COALESCE(in_charge_store, '') AS shop,
   COALESCE(in_charge_user, '') AS staff,
diff --git a/backend/src/handlers/databaseAction/database_spec_trash.php b/backend/src/handlers/databaseAction/database_spec_trash.php
index bdbd8d08..b7fcda4c 100644
--- a/backend/src/handlers/databaseAction/database_spec_trash.php
+++ b/backend/src/handlers/databaseAction/database_spec_trash.php
@@ -13,6 +13,7 @@ if ($stmt_trash->execute([$data['show_dashboard'], $data['id']])) {
 $sql_customer = "SELECT
   id,
   COALESCE(customer_contacts_name, '') AS customer,
+  COALESCE(customer_contacts_name_2, '') AS customer_2,
   COALESCE(in_charge_store, '') AS shop,
   COALESCE(in_charge_user, '') AS staff,
   COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
diff --git a/backend/src/handlers/databaseAction/database_used.php b/backend/src/handlers/databaseAction/database_used.php
index 47ee60e6..30820ed9 100644
--- a/backend/src/handlers/databaseAction/database_used.php
+++ b/backend/src/handlers/databaseAction/database_used.php
@@ -27,6 +27,7 @@ $response_call = $stmt_call->fetchAll(PDO::FETCH_ASSOC);
 $sql_customer = "SELECT
   id,
   COALESCE(customer_contacts_name, '') AS customer,
+  COALESCE(customer_contacts_name_2, '') AS customer_2,
   COALESCE(in_charge_store, '') AS shop,
   COALESCE(in_charge_user, '') AS staff,
   COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
diff --git a/backend/src/handlers/databaseAction/database_used_copy.php b/backend/src/handlers/databaseAction/database_used_copy.php
index 112685d3..5655edbe 100644
--- a/backend/src/handlers/databaseAction/database_used_copy.php
+++ b/backend/src/handlers/databaseAction/database_used_copy.php
@@ -73,6 +73,7 @@ try {
     $sql_customer = "SELECT
     id,
     COALESCE(customer_contacts_name, '') AS customer,
+    COALESCE(customer_contacts_name_2, '') AS customer_2,
     COALESCE(in_charge_store, '') AS shop,
     COALESCE(in_charge_user, '') AS staff,
     COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
diff --git a/backend/src/handlers/databaseAction/database_used_trash.php b/backend/src/handlers/databaseAction/database_used_trash.php
index dd2d6865..0d2ff433 100644
--- a/backend/src/handlers/databaseAction/database_used_trash.php
+++ b/backend/src/handlers/databaseAction/database_used_trash.php
@@ -13,6 +13,7 @@ if ($stmt_trash->execute([$data['show_dashboard'], $data['id']])) {
 $sql_customer = "SELECT
   id,
   COALESCE(customer_contacts_name, '') AS customer,
+  COALESCE(customer_contacts_name_2, '') AS customer_2,
   COALESCE(in_charge_store, '') AS shop,
   COALESCE(in_charge_user, '') AS staff,
   COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
diff --git a/frontend/src/components/database/DatabaseKaeru.tsx b/frontend/src/components/database/DatabaseKaeru.tsx
index 2902c243..b848ef46 100644
--- a/frontend/src/components/database/DatabaseKaeru.tsx
+++ b/frontend/src/components/database/DatabaseKaeru.tsx
@@ -16,6 +16,7 @@ import { thisYear } from '../../utils/thisYear';
 // ⚠️ 役職→社員番号の並びを借りている。同じ並びを2箇所に書くと片方だけ腐る
 import { sortStaff } from '../header/useAmbassadorMaster';
 import { GiftDot, GiftLegend } from './GiftMark';
+import { CustomerName2, cleanCustomerName } from './customerName2';
 
 type shopList = { brand: string, shop: string, section: string };
 // ⚠️ position / khg_id は担当営業セレクトの並べ替えに使う（2026-09-14 追加）。
@@ -180,7 +181,8 @@ const DatabaseKaeru = ({ }: Props) => {
                 && (selectedRank ? arrIncludes(item.rank, selectedRank) : true)
                 && (selectedMedium === 'SUUMO(ポータル反響)' ? (item.medium === 'SUUMO' && !item.hp_campaign) : selectedMedium ? arrIncludes(item.medium, selectedMedium) : true)
                 && (selectedStatus ? arrIncludes(item.status, selectedStatus) : true)
-                && (nameSearch.debouncedValue ? strIncludes(item._cleanCustomer, cleanFormattedName) : true)
+                // ⚠️ v2.2.187: 氏名②（customer_2）も名前検索の対象
+                && (nameSearch.debouncedValue ? (strIncludes(item._cleanCustomer, cleanFormattedName) || strIncludes(cleanCustomerName(item.customer_2), cleanFormattedName)) : true)
                 // 💡 修正: 正規化されたデータ同士で比較する
                 && (kanaSearch.debouncedValue ? strIncludes(targetKana, normalizedKanaSearch) : true)
                 && (staffSearch.debouncedValue ? strIncludes(item.staff, staffSearch.debouncedValue.split(' ')[0]) : true)
@@ -654,7 +656,9 @@ const DatabaseKaeru = ({ }: Props) => {
                                                 }}>編集</div></td>
                                             <td>{item.shop}</td>
                                             <td><GiftDot gift={item.gift} />{(isDuplicate && item.integration) && <span style={{ cursor: 'pointer' }}
-                                                onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}{item.customer ?? ''}</td>
+                                                onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}{item.customer ?? ''}
+                                                {/* ⚠️ v2.2.187: 氏名②があるときだけ2行目 */}
+                                                <CustomerName2 value={item.customer_2} /></td>
                                             <td>{item.staff ?? ''}</td>
                                             <td>{item.status ?? ''}</td>
                                             <td>{formate(item.register)}</td>
diff --git a/frontend/src/components/database/DatabaseOrder.tsx b/frontend/src/components/database/DatabaseOrder.tsx
index 346018cf..41f11632 100644
--- a/frontend/src/components/database/DatabaseOrder.tsx
+++ b/frontend/src/components/database/DatabaseOrder.tsx
@@ -19,6 +19,7 @@ import { missingLostFields } from '../../utils/informationUtils';
 import { sortStaff } from '../header/useAmbassadorMaster';
 import NexusBadge from '../NexusBadge';
 import { isNexusRow } from '../../utils/nexusUtils';
+import { CustomerName2, cleanCustomerName } from './customerName2';
 
 // --- 型定義 ---
 type ShopList = { brand: string; shop: string; section: string };
@@ -42,6 +43,8 @@ interface CustomerItem extends Record<string, any> {
     medium?: string;
     status?: string;
     customer?: string;
+    /** 氏名②（customer_contacts_name_2）。⚠️ v2.2.187 追加。⚠️ 値があるときだけ顧客名の2行目に出す・名前検索の対象 */
+    customer_2?: string;
     /** フリガナ。⚠️ Nexus アイコンの判定にだけ使う（検索には使っていない） */
     customer_contacts_name_kana?: string;
     staff?: string;
@@ -267,7 +270,8 @@ const DatabaseOrder = ({ onReload }: Props) => {
                 && (selectedMedium === 'SUUMO(ポータル反響)' ? (item.medium === 'SUUMO' && !item.reserved_interview) : selectedMedium ? arrIncludes(item.medium, selectedMedium) : true)
                 && (selectedIntroductory ? arrIncludes(item.introduction_person_category, selectedIntroductory) : true)
                 && (selectedStatus ? arrIncludes(item.status, selectedStatus) : true)
-                && (nameSearch.debouncedValue ? strIncludes(item._cleanCustomer, cleanFormattedName) : true)
+                // ⚠️ v2.2.187: 氏名②（customer_2）も名前検索の対象
+                && (nameSearch.debouncedValue ? (strIncludes(item._cleanCustomer, cleanFormattedName) || strIncludes(cleanCustomerName(item.customer_2), cleanFormattedName)) : true)
                 && (staffSearch.debouncedValue ? strIncludes(item.staff, staffSearch.debouncedValue.split(' ')[0]) : true)
                 && ((phoneSearch.debouncedValue || nameSearch.debouncedValue) ? strIncludes(item.phone_number, formattedNumber) : true)
                 && (formattedAddress ? strIncludes(item.full_address, formattedAddress) : true)
@@ -680,7 +684,9 @@ const DatabaseOrder = ({ onReload }: Props) => {
                                             <td><GiftDot gift={item.gift} />
                                                 {/* ⚠️ `item.rank` は `Sランク` の形。⚠️ **表示用に「ランク」を落とす前の値**を渡すこと */}
                                                 {isNexusRow(item.customer, item.customer_contacts_name_kana, item.rank) && <NexusBadge className='me-1' />}
-                                                {item.k_snap && <i className="fa-solid fa-camera me-1 text-warning"></i>}{safeFormate(item.customer)}</td>
+                                                {item.k_snap && <i className="fa-solid fa-camera me-1 text-warning"></i>}{safeFormate(item.customer)}
+                                                {/* ⚠️ v2.2.187: 氏名②があるときだけ2行目（⚠️ その行だけ高くなる。2026-10-12 に了承済み） */}
+                                                <CustomerName2 value={item.customer_2} /></td>
                                             <td>{safeFormate(item.staff)}</td>
                                             <td>{safeFormate(item.status)}</td>
                                             <td>{safeFormate(item.register)}</td>
diff --git a/frontend/src/components/database/DatabaseResale.tsx b/frontend/src/components/database/DatabaseResale.tsx
index 427a4453..2f5fe476 100644
--- a/frontend/src/components/database/DatabaseResale.tsx
+++ b/frontend/src/components/database/DatabaseResale.tsx
@@ -14,6 +14,7 @@ import { toHalfWidth } from './databaseUtils';
 import PropertyRegister from './PropertyRegister';
 import { BrokerData } from './PropertyRegister';
 import { generateNewId } from './databaseUtils';
+import { CustomerName2 } from './customerName2';
 
 type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number, position: string };
 type CustomerList = Record<string, string>;
@@ -152,7 +153,8 @@ const DatabaseResale = ({ onReload, key }: Props) => {
                 && (selectedRank ? arrIncludes(item.rank, selectedRank) : true)
                 && (selectedMedium === 'SUUMO(ポータル反響)' ? (item.medium === 'SUUMO' && !item.hp_campaign) : selectedMedium ? arrIncludes(item.medium, selectedMedium) : true)
                 && (selectedStatus ? arrIncludes(item.status, selectedStatus) : true)
-                && (searchedName ? strIncludes(item.customer, formattedName) : true)
+                // ⚠️ v2.2.187: 氏名②（customer_2）も名前検索の対象（⚠️ この画面は空白を消さずに比べる既存の規則に合わせる）
+                && (searchedName ? (strIncludes(item.customer, formattedName) || strIncludes(item.customer_2, formattedName)) : true)
                 && (searchedStaff ? strIncludes(item.staff, searchedStaff.split(' ')[0]) : true)
                 && ((searchedPhone || searchedName) ? strIncludes(item.phone_number, formattedNumber) : true)
                 && (searchedMail ? strIncludes(item.mail, searchedMail) : true)
@@ -615,6 +617,8 @@ const DatabaseResale = ({ onReload, key }: Props) => {
                                             <td>{item.shop}</td>
                                             <td>{isDuplicate && <span style={{ cursor: 'pointer' }}
                                                 onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}{item.customer ?? ''}
+                                                {/* ⚠️ v2.2.187: 氏名②があるときだけ2行目 */}
+                                                <CustomerName2 value={item.customer_2} />
                                                 {isBroker && <span className='bg-warning rounded ms-1 p-1 fw-bold'
                                                     style={{ fontSize: '9px', textDecoration: 'underline dotted', cursor: 'pointer' }}
                                                     onClick={() => {
diff --git a/frontend/src/components/database/customerName2.tsx b/frontend/src/components/database/customerName2.tsx
new file mode 100644
index 00000000..4971ea8e
--- /dev/null
+++ b/frontend/src/components/database/customerName2.tsx
@@ -0,0 +1,31 @@
+import React from 'react';
+
+/**
+ * 氏名②（customer_contacts_name_2）の表示と検索（v2.2.187 新規）。
+ *
+ * ⚠️ 顧客一覧（DatabaseOrder.tsx / DatabaseKaeru.tsx / DatabaseResale.tsx）の3画面で使う。
+ * ⚠️ サーバーは `customer_2` という名前で返す（⚠️ ② features/database/queries.ts と
+ *   ① handlers/databaseAction/database_*.php の両方。⚠️ 片方だけだと、どちらが応答したかで出たり出なかったりする）。
+ * ⚠️ 値が無い（NULL は '' で返る）・空白だけのときは何も出さない（⚠️ 1行のまま）。
+ */
+
+/** 空白（半角・全角）を消した名前。⚠️ 検索の比較に使う（既存の _cleanCustomer と同じ規則） */
+export const cleanCustomerName = (value: unknown): string =>
+    String(value ?? '').replace(/[\s　]+/g, '');
+
+/** 氏名② があるか */
+export const hasCustomerName2 = (value: unknown): boolean => cleanCustomerName(value) !== '';
+
+/**
+ * 顧客名のマスの2行目（氏名②）。⚠️ 値が無ければ null。
+ * ⚠️ 1行目（氏名①）と区別するため、少し小さい灰色の文字にする。
+ */
+export const CustomerName2 = ({ value }: { value: unknown }) => {
+    if (!hasCustomerName2(value)) return null;
+    const text = String(value).trim();
+    return (
+        <div style={{ fontSize: '0.85em', color: '#6c757d', lineHeight: 1.3 }} title={`氏名②：${text}`}>
+            {text}
+        </div>
+    );
+};
```
