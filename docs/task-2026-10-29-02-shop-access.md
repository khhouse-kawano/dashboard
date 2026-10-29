# 2026-10-29 担当事業の入れる範囲を「注文／建売／中古・不動産企画係」に（v2.2.228）

## 依頼
- 「sql を間違えた。used も realty も一括にしたかった」→「要するに order と order 以外」→ 範囲の一覧を確かめたうえで
- 「やはりやめる。以下の内容で: order 注文／spec 建売／used realty 中古 不動産企画係」
- 本番の状況:「一旦ながしたあと間違いに気がついて戻す sql 実行した。念のためそこまで考えられた sql にしてほしい」

## 決めたこと
- utils/shopAccess.ts の canEnterCategory を「担当事業 → 入れる事業」の表に（order→注文、spec→建売、used・realty→中古・不動産企画係、all→すべて）
- v2.2.227 で足した担当事業 **estate はなくした**（権限編集の選択肢・② の AUTH_SHOPS・REALTY_SHOPS・BROKER_SHOPS・① の authz.php・入口・日報）
  - ⚠️ estate という名前は、担当者の「土地新着ネット」フラグ（staff.estate）とも重なっていた。そちらには触っていない
- 不動産企画係のデータ（② の REALTY_SHOPS・① の AUTHZ_REALTY_SHOPS）に used を入れる
- 日報: realty の人は中古の人として扱う（初期表示は中古リノベ・中古の行）。今までは realty の人に何も出ていなかった
- 業務ガイドのボタン: realty の人にも出す
- SQL `2026-10-29_staff_shop_estate_cleanup.sql`: estate の人が残っていれば控え（staff_shop_bk_227）から戻す。控えに無い estate の人は名前を出す。誰もいなければ何も変わらない。2回流しても壊れない
- v2.2.227 の estate の SQL と戻しの SQL の先頭に「もう流さない」

## 確認したこと
- 後始末の SQL をローカルで: 1回目で estate の34人が元の担当事業に（控えと違う人 0）、2回目は何も変わらない
- 画面（Playwright。開発サーバーは 3100）: テスト用の spec・used・realty の担当者で、入れる事業（spec＝建売だけ、used・realty＝中古・不動産企画係）・チームサマリーが読める（② の権限）・業務ガイドのボタン（spec・realty とも出る）・日報の初期表示（realty・used＝中古リノベ、spec＝建売分譲事業）。ページのエラー 0。テスト用の担当者は消した
- ② の型チェック・① の php -l・本番ビルド・変えた画面の型チェック

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/utils | shopAccess.ts・version.ts | 担当事業 → 入れる事業の表／2.2.228 |
| frontend/src/components | Category.tsx・realty/RealtyRoute.tsx・header/EditAuth.tsx・header/DailyReports.tsx・guide/openGuide.ts・guide/guideScreens.ts | estate を外し、used ↔ realty |
| backend-express/src/features | realty/index.ts・staffAdmin.ts | REALTY_SHOPS に used、estate を外す |
| backend/src/core | authz.php | 同じ |
| backend/scripts/sql | **2026-10-29_staff_shop_estate_cleanup.sql・2026-10-29_update_log_2.2.228.sql（新規）**・2026-10-29_staff_shop_estate.sql・_restore.sql | 後始末／更新履歴＋記事1本／「もう流さない」 |
| backend/scripts/guide/articles/common | screen-230.md | 入れる人を「不動産企画係・中古・全事業」に。estate の説明を消した |

## コード

### frontend/src/utils/shopAccess.ts（全文）
```ts
/**
 * 担当事業（staff.shop）で入れる事業（category）（v2.2.227 で作成・v2.2.228 で変更）。
 *
 * ⚠️ staff.shop は店舗名ではなく事業区分（order / spec / used / realty / all）。
 * ⚠️ 2026-10-29 の指示（v2.2.228）: 「order 注文／spec 建売／used・realty 中古・不動産企画係」
 *   → 中古（used）の人と不動産企画係（realty）の人は、どちらも中古リノベと不動産企画係の両方に入れる。
 *   ⚠️ v2.2.227 で足した estate（建売・中古・不動産企画係）はなくした（本番の担当事業も戻した。2026-10-29_staff_shop_estate_cleanup.sql）。
 * ⚠️ ② の features/realty/index.ts（REALTY_SHOPS・BROKER_SHOPS）・staffAdmin.ts（AUTH_SHOPS）、
 *   ① の core/authz.php（AUTHZ_REALTY_SHOPS・AUTHZ_BROKER_SHOPS）も同じ考え方でそろえること。
 */

/** 担当事業 → 入れる事業。⚠️ all はすべて（下の canEnterCategory） */
const SHOP_CATEGORIES: Record<string, string[]> = {
    order: ['order'],
    spec: ['spec'],
    used: ['used', 'realty'],
    realty: ['used', 'realty'],
};

/** その事業に入れるか（Category.tsx の入場判定・業務ガイドの切り替え） */
export const canEnterCategory = (shop: string, category: string): boolean =>
    shop === 'all' || (SHOP_CATEGORIES[shop] ?? []).includes(category);
```

### backend/scripts/sql/2026-10-29_staff_shop_estate_cleanup.sql（全文）
```sql
-- =====================================================================
-- v2.2.228 担当事業 estate（v2.2.227 で足した「建売・中古・不動産企画係」）をなくす前の後始末
--
-- v2.2.228 で担当事業の入れる範囲を「order 注文／spec 建売／used・realty 中古・不動産企画係」にし、estate はなくした。
-- estate の人が残っていると、v2.2.228 ではどの事業にも入れなくなるので、元の担当事業に戻す。
--
-- 本番の状況（2026-10-29）: 2026-10-29_staff_shop_estate.sql を流したあと、2026-10-29_staff_shop_estate_restore.sql で戻した。
--   → ふつうは estate の人は 0 人で、このファイルを流しても何も変わらない（念のための確かめと後始末）。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ v2.2.228 の ② と ① PHP・フロントを出す**前**に流す
-- ⚠️ 2回流しても壊れない（estate の人だけを戻す）
-- ⚠️ 控えの表 staff_shop_bk_227 は 2026-10-29_staff_shop_estate.sql が作ったもの。
--   無い環境（estate の SQL を一度も流していない）では 1) と 2) が「Table ... doesn't exist」になる。そのときは 3) だけ流せばよい
-- =====================================================================

-- 1) 確認: いま estate の人と、控えにある元の担当事業（0行ならよい。2) は何も変えない）
SELECT s.id, s.name, s.brand, s.shop AS 今, b.shop AS 控えの元の担当事業
  FROM staff s
  LEFT JOIN staff_shop_bk_227 b ON b.id = s.id
 WHERE s.shop = 'estate'
 ORDER BY s.id;

-- 2) 控えにある人を元の担当事業に戻す（estate の人だけ）
UPDATE staff s JOIN staff_shop_bk_227 b ON b.id = s.id
   SET s.shop = b.shop
 WHERE s.shop = 'estate';

-- 3) 確認: まだ estate の人（0行ならよい）。⚠️ 出たら、控えに無い人（あとから権限編集で estate にした人）。
--    ヘッダーの「システム管理 → 権限編集」で、order / spec / used / realty / all のどれかに直す
SELECT id, name, brand, shop FROM staff WHERE shop = 'estate' ORDER BY id;

-- 4) 確認: 担当事業ごとの人数（estate が出なければよい）
SELECT shop AS 担当事業, COUNT(*) AS 人数 FROM staff GROUP BY shop ORDER BY shop;
```

### 直したファイル（差分）

#### frontend/src/components/Category.tsx
```diff
diff --git a/frontend/src/components/Category.tsx b/frontend/src/components/Category.tsx
index ada01747..4ca55d37 100644
--- a/frontend/src/components/Category.tsx
+++ b/frontend/src/components/Category.tsx
@@ -30,7 +30,7 @@ const Category = () => {
     }, []);
 
     const goToDashboard = async (categoryValue: string) => {
-        // ⚠️ v2.2.227: estate（建売・中古・不動産企画係）も見る（utils/shopAccess.ts）
+        // ⚠️ v2.2.228: 中古（used）と不動産企画係（realty）の人は、どちらも中古リノベと不動産企画係に入れる（utils/shopAccess.ts）
         if (!canEnterCategory(shopValue, categoryValue)) {
             alert('閲覧権限がありません');
             return;
@@ -77,9 +77,9 @@ const Category = () => {
                 </div>
                 {/*
                   ⚠️ v2.2.194: 業務ガイド（⚠️ 4つのボタンの下・指示）。⚠️ 別ウインドウで開く（guide/openGuide.ts）。
-                    ⚠️ この画面ではまだ事業を選んでいないので、⚠️ **担当事業（shopValue）が注文営業・建売営業・中古リノベ・全事業の人にだけ**出す。
+                    ⚠️ この画面ではまだ事業を選んでいないので、⚠️ **担当事業（shopValue）が注文営業・建売営業・中古リノベ・不動産企画係（v2.2.228 から。中古にも入れるため）・全事業の人にだけ**出す。
                 */}
-                {['order', 'spec', 'used', 'estate', 'all'].includes(shopValue) && (
+                {['order', 'spec', 'used', 'realty', 'all'].includes(shopValue) && (
                     <div className="text-center mt-2">
                         <button type="button" onClick={() => openGuide()}
                             style={{ background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', borderRadius: 999,
```

#### frontend/src/components/realty/RealtyRoute.tsx
```diff
diff --git a/frontend/src/components/realty/RealtyRoute.tsx b/frontend/src/components/realty/RealtyRoute.tsx
index 51893aeb..8800ca53 100644
--- a/frontend/src/components/realty/RealtyRoute.tsx
+++ b/frontend/src/components/realty/RealtyRoute.tsx
@@ -5,11 +5,11 @@ import AuthContext from '../../context/AuthContext';
 /**
  * 不動産企画係（category = realty）の画面の入口（v2.2.221）。
  *
- * ⚠️ 担当事業（staff.shop）が `realty`（不動産企画係）・`estate`（建売・中古・不動産企画係。v2.2.227）・`all`（全事業）の人だけが入れる。
+ * ⚠️ 担当事業（staff.shop）が `realty`（不動産企画係）・`used`（中古。v2.2.228 から）・`all`（全事業）の人だけが入れる。
  *   それ以外の人が URL を直接開いたら、事業を選ぶ画面へ戻す。
  * ⚠️ これは見た目の入口。データの読み書きは ② / ① が同じ条件で確かめている（REALTY_SHOPS）。
  */
-export const REALTY_SHOPS = ['realty', 'estate', 'all'];
+export const REALTY_SHOPS = ['realty', 'used', 'all'];
 
 const RealtyRoute = ({ children }: { children: React.ReactElement }) => {
     const { shopName } = useContext(AuthContext);
```

#### frontend/src/components/header/EditAuth.tsx
```diff
diff --git a/frontend/src/components/header/EditAuth.tsx b/frontend/src/components/header/EditAuth.tsx
index 19b481d7..3cc92fd8 100644
--- a/frontend/src/components/header/EditAuth.tsx
+++ b/frontend/src/components/header/EditAuth.tsx
@@ -65,11 +65,10 @@ const BRAND_OPTIONS = [
 const SHOP_OPTIONS = [
     { value: 'order', label: '注文' },
     { value: 'spec', label: '建売' },
+    // ⚠️ v2.2.228: 中古と不動産企画係は、どちらを選んでも中古リノベと不動産企画係の両方に入れる（utils/shopAccess.ts）
     { value: 'used', label: '中古' },
     // ⚠️ v2.2.221: 不動産企画係だけを見る人（入れるのは不動産企画係の画面だけ）
     { value: 'realty', label: '不動産企画係' },
-    // ⚠️ v2.2.227: 建売・中古・不動産企画係の3つに入れる人（utils/shopAccess.ts）
-    { value: 'estate', label: '建売・中古・不動産企画係' },
     { value: 'all', label: '全事業' },
 ] as const;
```

#### frontend/src/components/header/DailyReports.tsx
```diff
diff --git a/frontend/src/components/header/DailyReports.tsx b/frontend/src/components/header/DailyReports.tsx
index a6f887fc..d6cde605 100644
--- a/frontend/src/components/header/DailyReports.tsx
+++ b/frontend/src/components/header/DailyReports.tsx
@@ -152,12 +152,12 @@ const authorityMapping: Record<string, string> = {
     'order': '注文事業',
     'spec': '建売分譲事業',
     'used': '中古リノベ',
-    // ⚠️ v2.2.227: estate（建売・中古・不動産企画係）は建売の人として扱う（日報は建売の分）
-    'estate': '建売分譲事業',
+    // ⚠️ v2.2.228: 不動産企画係（realty）の人は中古の人として扱う（中古リノベと不動産企画係の両方に入れるため）
+    'realty': '中古リノベ',
 };
 
-/** 日報の書き手（authority）と突き合わせる担当事業。⚠️ estate は建売（spec）として見る */
-const reportShopOf = (shopName: string): string => (shopName === 'estate' ? 'spec' : shopName);
+/** 日報の行（authority ＝ 事業）と突き合わせる担当事業。⚠️ realty は中古（used）として見る */
+const reportShopOf = (shopName: string): string => (shopName === 'realty' ? 'used' : shopName);
 
 const positions = ['常務', '部長', '課長', '課長代理', '店長', '店長代理', '一般'];
```

#### frontend/src/components/guide/openGuide.ts
```diff
diff --git a/frontend/src/components/guide/openGuide.ts b/frontend/src/components/guide/openGuide.ts
index 13ec4c2b..973afc98 100644
--- a/frontend/src/components/guide/openGuide.ts
+++ b/frontend/src/components/guide/openGuide.ts
@@ -31,7 +31,7 @@ export const GUIDE_COMMON = 'common';
 export const isGuideCategory = (category: string): boolean => GUIDE_DIVISIONS.some((d) => d.value === category);
 
 /**
- * 見られる事業。⚠️ shopName は担当事業（order / spec / used / estate / all）。
+ * 見られる事業。⚠️ shopName は担当事業（order / spec / used / realty / all）。
  * ⚠️ Master と全事業（all）の人はすべて。⚠️ 選んでいる事業（category）も足す（⚠️ 事業の権限はトップ画面が確かめている）。
  */
 export const allowedGuideDivisions = (authority: string, category: string, shopName: string): string[] =>
```

#### frontend/src/components/guide/guideScreens.ts
```diff
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index f666e0ff..61b9618d 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -174,7 +174,7 @@ export type ScreenPlan =
  * どの事業で・どのページを開くかを決める（⚠️ ダッシュボードの窓で呼ぶ）。
  * @param articleDivision 記事の事業（⚠️ 全事業共通の記事は null。そのときはいま選んでいる事業を優先）
  * @param category ダッシュボードで選んでいる事業
- * @param shopName 担当事業（order / spec / used / estate / all）。⚠️ 切り替えてよいかの判定は Category.tsx の goToDashboard と同じ（utils/shopAccess.ts）
+ * @param shopName 担当事業（order / spec / used / realty / all）。⚠️ 切り替えてよいかの判定は Category.tsx の goToDashboard と同じ（utils/shopAccess.ts）
  */
 export const planScreen = (name: string, articleDivision: string | null, category: string, shopName: string): ScreenPlan => {
     const screen = GUIDE_SCREENS[name];
```

#### backend-express/src/features/realty/index.ts
```diff
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index ed962ac9..46e2f1d4 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -24,10 +24,10 @@ import type { AuthenticatedStaff } from '../../types/staff';
  */
 
 /** 不動産企画係の画面を使える担当事業 */
-// ⚠️ v2.2.227: estate（建売・中古・不動産企画係）も入れる（frontend/src/utils/shopAccess.ts）
-export const REALTY_SHOPS = ['realty', 'estate', 'all'];
+// ⚠️ v2.2.228: 中古（used）の人も入れる（中古と不動産企画係は両方に入れる。frontend/src/utils/shopAccess.ts）
+export const REALTY_SHOPS = ['realty', 'used', 'all'];
 /** 媒介台帳（broker:*）を使える担当事業。⚠️ 中古の顧客DB・顧客詳細も台帳を読み書きする */
-export const BROKER_SHOPS = ['realty', 'estate', 'all', 'used'];
+export const BROKER_SHOPS = ['realty', 'all', 'used'];
 
 interface DynamicRow extends RowDataPacket {
   [key: string]: unknown;
```

#### backend-express/src/features/staffAdmin.ts
```diff
diff --git a/backend-express/src/features/staffAdmin.ts b/backend-express/src/features/staffAdmin.ts
index 7f0b0780..f8600439 100644
--- a/backend-express/src/features/staffAdmin.ts
+++ b/backend-express/src/features/staffAdmin.ts
@@ -65,8 +65,8 @@ export const AUTH_BRANDS = ['Master', 'BrandAdmin', 'Manager', 'ordinary', 'Cons
  *   （2026-10-05 に利用者と確認済み）。
  */
 // ⚠️ v2.2.221: realty（不動産企画係）を追加。⚠️ realty の人は不動産企画係の画面にだけ入れる
-// ⚠️ v2.2.227: estate（建売・中古・不動産企画係の3つに入れる人）を追加
-export const AUTH_SHOPS = ['order', 'spec', 'used', 'realty', 'estate', 'all'] as const;
+// ⚠️ v2.2.228: v2.2.227 で足した estate はなくした（used と realty が互いに入れる形にした）
+export const AUTH_SHOPS = ['order', 'spec', 'used', 'realty', 'all'] as const;
 
 const isAuthBrand = (value: string): boolean => (AUTH_BRANDS as readonly string[]).includes(value);
 const isAuthShop = (value: string): boolean => (AUTH_SHOPS as readonly string[]).includes(value);
```

#### backend/src/core/authz.php
```diff
diff --git a/backend/src/core/authz.php b/backend/src/core/authz.php
index 40ec2b5f..95974f23 100644
--- a/backend/src/core/authz.php
+++ b/backend/src/core/authz.php
@@ -93,9 +93,9 @@ const AUTHZ_KPI_ANALYSIS = ['Master', 'BrandAdmin', 'Manager'];
  * 不動産企画係（realty）の画面を使える担当事業（v2.2.221）。② の REALTY_SHOPS / BROKER_SHOPS と同じ値にすること。
  *   媒介台帳（broker）は中古の顧客DB・顧客詳細も読み書きするため used も可。
  */
-// ⚠️ v2.2.227: estate（建売・中古・不動産企画係）も入れる（② の features/realty/index.ts と同じ）
-const AUTHZ_REALTY_SHOPS = ['realty', 'estate', 'all'];
-const AUTHZ_BROKER_SHOPS = ['realty', 'estate', 'all', 'used'];
+// ⚠️ v2.2.228: 中古（used）の人も不動産企画係に入れる（② の features/realty/index.ts と同じ）
+const AUTHZ_REALTY_SHOPS = ['realty', 'used', 'all'];
+const AUTHZ_BROKER_SHOPS = ['realty', 'all', 'used'];
 
 /**
  * 認証と「担当事業（staff.shop）が許されていること」の確認（v2.2.221）。
```

#### backend/scripts/sql/2026-10-29_staff_shop_estate.sql
```diff
diff --git a/backend/scripts/sql/2026-10-29_staff_shop_estate.sql b/backend/scripts/sql/2026-10-29_staff_shop_estate.sql
index f661f675..449cae61 100644
--- a/backend/scripts/sql/2026-10-29_staff_shop_estate.sql
+++ b/backend/scripts/sql/2026-10-29_staff_shop_estate.sql
@@ -1,3 +1,4 @@
+-- ⚠️⚠️ v2.2.228 で廃止。**もう流さない**（担当事業 estate はなくした。後始末は 2026-10-29_staff_shop_estate_cleanup.sql）
 -- =====================================================================
 -- v2.2.227 担当事業（staff.shop）の差し替え: 建売（spec）と以前の不動産企画係アプリのユーザーを estate にまとめる
 --
```

#### backend/scripts/sql/2026-10-29_staff_shop_estate_restore.sql
```diff
diff --git a/backend/scripts/sql/2026-10-29_staff_shop_estate_restore.sql b/backend/scripts/sql/2026-10-29_staff_shop_estate_restore.sql
index c1d6c152..0111e7b6 100644
--- a/backend/scripts/sql/2026-10-29_staff_shop_estate_restore.sql
+++ b/backend/scripts/sql/2026-10-29_staff_shop_estate_restore.sql
@@ -1,3 +1,4 @@
+-- ⚠️⚠️ v2.2.228 で廃止。**もう流さない**（担当事業 estate はなくした。後始末は 2026-10-29_staff_shop_estate_cleanup.sql）
 -- =====================================================================
 -- v2.2.227 担当事業の差し替えを戻す（2026-10-29_staff_shop_estate.sql の控え staff_shop_bk_227 から）
 --
```

#### backend/scripts/guide/articles/common/screen-230.md
```diff
diff --git a/backend/scripts/guide/articles/common/screen-230.md b/backend/scripts/guide/articles/common/screen-230.md
index d6065a29..aaaae6bb 100644
--- a/backend/scripts/guide/articles/common/screen-230.md
+++ b/backend/scripts/guide/articles/common/screen-230.md
@@ -17,12 +17,12 @@ summary: 不動産企画係の画面に入れる人と、入り方。
 
 ## 入れる人
 - 担当事業が「**不動産企画係**」の人
-- 担当事業が「**建売・中古・不動産企画係**」の人（建売営業・中古リノベにも入れます）
+- 担当事業が「**中古**」の人
 - 担当事業が「**全事業**」の人
 
-ほかの担当事業（注文・建売・中古）の人は入れません。画面のアドレスを直接開いても、事業を選ぶ画面に戻ります。
+担当事業が「中古」の人と「不動産企画係」の人は、どちらも**中古リノベと不動産企画係の両方**に入れます。
 
-> 注意：媒介獲得台帳のデータは、中古リノベの顧客DB・顧客詳細からも読み書きします。そのため中古リノベの人も、その画面からは今までどおり使えます。
+ほかの担当事業（注文・建売）の人は入れません。画面のアドレスを直接開いても、事業を選ぶ画面に戻ります。
 
 ## 入り方
 1. Dashboard にログインする
@@ -30,9 +30,7 @@ summary: 不動産企画係の画面に入れる人と、入り方。
 3. チームサマリーが開く。左のメニューから各画面へ移る
 
 ## 担当事業を「不動産企画係」にする
-ヘッダーの「システム管理 → 権限編集」で、その人の担当事業を「不動産企画係」か「建売・中古・不動産企画係」に変えます（変えられるのは管理者だけです）。
-
-> 注意：v2.2.227 の更新で、建売営業の人と、以前の不動産企画係アプリを使っていた人の担当事業を「建売・中古・不動産企画係」にまとめました。
+ヘッダーの「システム管理 → 権限編集」で、その人の担当事業を「不動産企画係」か「中古」に変えます（変えられるのは管理者だけです。どちらでも中古リノベと不動産企画係の両方に入れます）。
 
 > 注意：変えたあと、本人が次に画面を移ったときに反映されます。ログインし直す必要はありません。
```

#### frontend/src/utils/version.ts
```diff
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 62211931..f355a38a 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.227';
+export const newVersion = '2.2.228';
```
