# 2026-10-09 v2.2.178 イベント予約一覧（EventList.tsx）の同期先も店舗の事業区分で決める

## 依頼
- EventList.tsx の保存テーブルのマッピングも FestaDashboard と同じ仕様か確認 → **違っていた**（画面の category をそのまま送っていた。フェスタ画面の修正前と同じ不具合）
- 選択店舗の事業部とテーブルをマッピングする

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/header | **divisions.ts** | `SyncCategory` 型・`syncCategoryOfShop(shop, shopList)` を追加（2画面で共通にするため、FestaDashboard.tsx から移動） |
| frontend/src/components/header | **EventList.tsx** | `syncStart` の `category` を `syncCategoryOfShop(syncShop, shopList)` に |
| frontend/src/components/header | **FestaDashboard.tsx** | ローカルの `SYNC_CATEGORY_OF_DIVISION` / `syncCategoryOfShop` を削除し divisions.ts から import（動作は同じ） |

### 追加した関数・型（divisions.ts）
- `SyncCategory`（型）
- `syncCategoryOfShop(shop, shopList)`

### 修正した関数
- EventList.tsx `syncStart()`

## マッピング（shop_list.division）
| division | category | テーブル |
|---|---|---|
| 注文事業 | order | master_data |
| 建売分譲事業 | spec | master_data_kaeru |
| 中古リノベ | used | master_data_resale |
| それ以外（不動産企画室など）・未設定 | order | master_data |

⚠️ EventList の同期後の `updateField(id, 'sync', 1)`（event_db の更新）は従来どおり画面の category（event_db は共通テーブル）。

## 確認
- eslint: 新規の警告なし（EventList.tsx 316行の exhaustive-deps は既存）
- `npm run build` 成功 → **`main.8894fd07.js`**（deploy-v2.2.178.md を更新）

## 差分（全文）
```diff
diff --git a/frontend/src/components/header/EventList.tsx b/frontend/src/components/header/EventList.tsx
index e5ac2b06..ef24a666 100644
--- a/frontend/src/components/header/EventList.tsx
+++ b/frontend/src/components/header/EventList.tsx
@@ -8,6 +8,7 @@ import { generateULID } from '../../utils/createULID';
 import { thisYear } from '../../utils/thisYear';
 import AuthContext from '../../context/AuthContext';
 import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';
+import { syncCategoryOfShop } from './divisions';
 
 /**
  * イベント予約1件。
@@ -639,7 +640,8 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
             in_charge_store: syncShop,
             request: 'list',
             roll: 'insert',
-            category
+            // ⚠️ v2.2.178: 取り込み先は ⚠️ **選んだ店舗の事業区分**（⚠️ 画面の category ではない。divisions.ts の syncCategoryOfShop）
+            category: syncCategoryOfShop(syncShop, shopList)
         };
 
         try {
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index ed64ea1f..29e3effb 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -7,7 +7,7 @@ import { thisYear } from '../../utils/thisYear';
 import AuthContext from '../../context/AuthContext';
 import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';
 import { setStyleClass } from '../../utils/setStyleClass';
-import { SHOP_DIVISION } from './divisions';
+import { syncCategoryOfShop } from './divisions';
 
 /**
  * おうちづくりフェスタ2026（v2.2.172 新規）。ヘッダー → 集客イベント → おうちづくりフェスタ2026。
@@ -229,23 +229,6 @@ const createSyncPayload = (item: FestaRow, shop: string): Record<string, string>
     brand: brands[shop.slice(0, 2)] || ''
 });
 
-/**
- * 取り込み先の顧客台帳（v2.2.178）。⚠️ **選んだ店舗の shop_list.division で決める。**
- *   注文事業 → order（master_data）／ 建売分譲事業 → spec（master_data_kaeru）／ 中古リノベ → used（master_data_resale）
- * ⚠️ それまでは ⚠️ **開いている画面の category** で決めていたため、建売・中古の画面から開いて
- *   注文の店舗へ同期すると ⚠️ master_data に入らなかった（⚠️「成功」と出るので気づけない）。
- * ⚠️ division が無い・知らない値の店舗は order（⚠️ divisions.ts の asDivision と同じく注文に寄せる）。
- */
-const SYNC_CATEGORY_OF_DIVISION: Record<string, 'order' | 'spec' | 'used'> = {
-    [SHOP_DIVISION['注文']]: 'order',
-    [SHOP_DIVISION['建売']]: 'spec',
-    [SHOP_DIVISION['中古']]: 'used',
-};
-const syncCategoryOfShop = (shop: string, shopList: MasterShop[]): 'order' | 'spec' | 'used' => {
-    const master = shopList.find(s => (s.shop ?? '').trim() === shop);
-    return SYNC_CATEGORY_OF_DIVISION[(master?.division ?? '').trim()] ?? 'order';
-};
-
 /**
  * 同期した店舗（v2.2.174）。⚠️ event_db.shop に `,` 区切りで入っている（② の sync_shop が足す）。
  * ⚠️ 店舗が違えば何度でも同期できる。⚠️ 同じ店舗には2回同期できない。
diff --git a/frontend/src/components/header/divisions.ts b/frontend/src/components/header/divisions.ts
index 97ac8ec8..4ee23ad3 100644
--- a/frontend/src/components/header/divisions.ts
+++ b/frontend/src/components/header/divisions.ts
@@ -34,3 +34,26 @@ export const asDivision = (value: unknown): DivisionKey => {
     const text = typeof value === 'string' ? value.trim() : '';
     return (DIVISION_KEYS as readonly string[]).includes(text) ? (text as DivisionKey) : '注文';
 };
+
+/**
+ * イベント予約の同期（roll: 'insert'）の取り込み先（v2.2.178）。
+ * ⚠️ **選んだ店舗の shop_list.division で決める**（⚠️ 開いている画面の category ではない）。
+ *   注文事業 → order（master_data）／ 建売分譲事業 → spec（master_data_kaeru）／ 中古リノベ → used（master_data_resale）
+ * ⚠️ 画面の category で決めていたため、建売・中古の画面から開いて注文の店舗へ同期すると
+ *   ⚠️ master_data に入らなかった（⚠️「成功」と出るので気づけない）。
+ * ⚠️ division が無い・知らない値（不動産企画室など）の店舗は order（⚠️ asDivision と同じく注文に寄せる）。
+ * ⚠️ 使っている画面: FestaDashboard.tsx / EventList.tsx
+ */
+export type SyncCategory = 'order' | 'spec' | 'used';
+const SYNC_CATEGORY_OF_DIVISION: Record<string, SyncCategory> = {
+    [SHOP_DIVISION['注文']]: 'order',
+    [SHOP_DIVISION['建売']]: 'spec',
+    [SHOP_DIVISION['中古']]: 'used',
+};
+export const syncCategoryOfShop = (
+    shop: string,
+    shopList: { shop: string | null; division: string | null }[],
+): SyncCategory => {
+    const master = shopList.find(s => (s.shop ?? '').trim() === shop.trim());
+    return SYNC_CATEGORY_OF_DIVISION[(master?.division ?? '').trim()] ?? 'order';
+};
```
