# 2026-10-16-05 分析レポートの閲覧記録（v2.2.194・同じブランチ）

## 指示
- CompetitorAnalysisReports.tsx で記事（レポート）を閲覧した staff のログを取りたい。
- 確認への回答：1. 案B（記録だけ取り、画面には出さない） 2. Master の閲覧は記録しない。

## やったこと
- **表** `analysis_report_view_log`（新規）… `backend/scripts/sql/2026-10-16_analysis_report_view_log.sql`
  - 列：no・report_no・staff_id・staff_name・authority・division・viewed_at（名前・権限・事業は開いた時点の写し）
  - レポートを消しても記録は残す（外部キーなし）。見方の SQL の例はファイルの先頭に書いた。
- **② ファイル** `backend-express/src/features/analysis/report.ts`
  - **追加した関数** `logReportView(reportNo, staff)`：1行足す。Master と未認証は記録しない。失敗しても例外を投げずログだけ（レポートは出す）。
- **② ファイル** `backend-express/src/gateway/registry.ts`：`analysis_report_get` が本文を返す直前に `logReportView` を呼ぶ。
  - 画面ではなく ② で記録するので、「Claudeによる分析」に埋め込まれた一覧から開いた分も記録される。
- **② ファイル** `backend-express/src/gateway/auth.ts`：`AUTHZ_MASTER` を export（判定を同じ定数でそろえるため。中身は変えていない）。
- **フロント** `CompetitorAnalysisReports.tsx`：記録の場所を示すコメントだけ（動きは変えていない。ビルド結果も同じ）。
- **業務ガイド** `common/screen-150.md`「Claudeによる分析」：レポートを開くと記録されること・他社動向からも読めることを追記。v2.2.194 の update_log SQL を作り直した（記事58本）。
- **更新履歴の文言**に「Claudeによる分析のレポートを開いた記録を残すようにした」を追加（ローカルも UPDATE 済み）。
- ① の許可リストは変更なし（`analysis_report_get` は以前から両方に入っている）。

## テスト
- ローカルDBに表を作成。
- `logReportView` を直接実行：ordinary・BrandAdmin は記録された／Master と未認証（null）は記録されない／例外は出ない。テストの行は削除した。
- ① 経由でトークン無しの `analysis_report_get` → 401（② まで届く。経路は変わっていない）。
- ② の型チェック通過。フロントのビルド `main.5ae2ef2c.js`（変化なし）。
- ⚠️ 未確認：ログインした状態で実際にレポートを開き、1行増えること（開発環境で確認してください）。

## 追加・修正したコード
### backend/scripts/sql/2026-10-16_analysis_report_view_log.sql
```sql
-- ===========================================================
-- 分析レポートの閲覧記録（analysis_report_view_log）
--
-- 2026-10-16 新規（v2.2.194）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 既存の表は変更しない（新規1表のみ）。
--
-- ─────────────────────────────────────────────
-- 何のテーブルか
--
--   「他社動向 → Claudeによる競合分析」「Claudeによる分析」の上部の一覧
--   （frontend/src/components/header/CompetitorAnalysisReports.tsx）でレポートを開いた人の記録。
--   ⚠️ ② の analysis_report_get（features/analysis/report.ts の logReportView）が、本文を返すたびに1行足す。
--
-- ⚠️⚠️ **画面には出さない**（2026-10-16 の指示。⚠️ 見るときは DB で見る）。
-- ⚠️⚠️ **authority が Master の人は記録しない**（指示。⚠️ 確認のたびに数が増えて現場の閲覧が分かりにくくなるため）。
-- ⚠️ 名前・権限・事業は開いた時点の写し（⚠️ あとで異動・改名しても当時の値が残る）。
-- ⚠️ レポートを消しても記録は消さない（⚠️ 外部キーを張らない）。
--
-- 見方の例:
--   SELECT v.report_no, r.title, v.staff_name, COUNT(*) AS 回数, MAX(v.viewed_at) AS 最終閲覧
--     FROM analysis_report_view_log v LEFT JOIN analysis_report r ON r.no = v.report_no
--    GROUP BY v.report_no, r.title, v.staff_name ORDER BY 最終閲覧 DESC;
-- ===========================================================

CREATE TABLE IF NOT EXISTS `analysis_report_view_log` (
   `no`         INT          NOT NULL AUTO_INCREMENT
  ,`report_no`  INT          NOT NULL COMMENT 'analysis_report.no'
  ,`staff_id`   INT          NOT NULL COMMENT 'staff.id'
  ,`staff_name` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '開いた時点の staff.name'
  ,`authority`  VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '開いた時点の権限（staff.brand。BrandAdmin / ordinary など）'
  ,`division`   VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '開いた時点の担当事業（staff.shop。order / spec / used / all）'
  ,`viewed_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,PRIMARY KEY (`no`)
  ,KEY `idx_report_view_report` (`report_no`, `viewed_at`)
  ,KEY `idx_report_view_staff` (`staff_id`, `viewed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='分析レポートの閲覧記録（Master は記録しない）';
```

### backend-express/src/features/analysis/report.ts（差分）
```diff
diff --git a/backend-express/src/features/analysis/report.ts b/backend-express/src/features/analysis/report.ts
index b3a270b2..65b557f9 100644
--- a/backend-express/src/features/analysis/report.ts
+++ b/backend-express/src/features/analysis/report.ts
@@ -1,6 +1,9 @@
 import type { RowDataPacket } from 'mysql2/promise';
 // ⚠️ `executeLarge` は HTML を書くところだけ。⚠️ 他は従来どおり `execute`
 import { execute, executeLarge, query } from '../../db/pool';
+import { AUTHZ_MASTER } from '../../gateway/auth';
+import type { AuthenticatedStaff } from '../../types/staff';
+import { logger } from '../../utils/logger';
 
 /**
  * Claude が書いた分析レポート（HTML）の保存と取り出し。
@@ -103,6 +106,25 @@ export const getReport = async (no: number): Promise<DynamicRow | null> => {
   return rows[0] ?? null;
 };
 
+/**
+ * レポートを開いた人を記録する（v2.2.194）。⚠️ analysis_report_get が本文を返すたびに呼ぶ。
+ *
+ * ⚠️⚠️ **Master は記録しない**（2026-10-16 の指示。⚠️ 確認のたびに数が増えて現場の閲覧が分かりにくくなる）。
+ * ⚠️⚠️ **記録に失敗してもレポートは出す**（⚠️ ここで例外を投げない。⚠️ ログにだけ残す）。
+ * ⚠️ 記録は画面に出さない（指示）。⚠️ 見方は backend/scripts/sql/2026-10-16_analysis_report_view_log.sql の先頭。
+ */
+export const logReportView = async (reportNo: number, staff: AuthenticatedStaff | null): Promise<void> => {
+  if (staff === null || staff.brand === AUTHZ_MASTER) return;
+  try {
+    await execute(
+      'INSERT INTO analysis_report_view_log (report_no, staff_id, staff_name, authority, division) VALUES (?, ?, ?, ?, ?)',
+      [reportNo, staff.id, staff.name.slice(0, 128), staff.brand.slice(0, 32), staff.shop.slice(0, 16)]
+    );
+  } catch (error) {
+    logger.error(`analysis_report_view_log insert failed: report_no=${reportNo} staff_id=${staff.id} ${String(error)}`);
+  }
+};
+
 /** 削除。⚠️ 取り消せないので、呼ぶ側で確認すること */
 export const deleteReport = async (no: number): Promise<void> => {
   await execute('DELETE FROM analysis_report WHERE no = ?', [no]);
```

### backend-express/src/gateway/registry.ts（差分）
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 2cada8e7..dda25353 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -125,6 +125,7 @@ import {
   deleteReport,
   getReport,
   listReports,
+  logReportView,
   MAX_HTML_BYTES,
   saveReport,
 } from '../features/analysis/report';
@@ -2358,6 +2359,8 @@ register({
       return { status: 'error', message: 'レポートが見つかりませんでした。' };
     }
 
+    // ⚠️ v2.2.194: 開いた人を記録する（⚠️ Master は記録しない・⚠️ 失敗してもレポートは返す。features/analysis/report.ts）
+    await logReportView(no, ctx.staff);
     return { report };
   },
 });
```

### backend-express/src/gateway/auth.ts（差分）
```diff
diff --git a/backend-express/src/gateway/auth.ts b/backend-express/src/gateway/auth.ts
index 0e577088..f84238bc 100644
--- a/backend-express/src/gateway/auth.ts
+++ b/backend-express/src/gateway/auth.ts
@@ -26,7 +26,7 @@ import type { GatewayAuth } from './types';
  */
 
 /** 移植元: backend/src/core/authz.php の AUTHZ_MASTER */
-const AUTHZ_MASTER = 'Master';
+export const AUTHZ_MASTER = 'Master';
 
 interface StaffRow extends RowDataPacket, AuthenticatedStaff {}
 
```

### frontend/src/components/header/CompetitorAnalysisReports.tsx（差分）
```diff
diff --git a/frontend/src/components/header/CompetitorAnalysisReports.tsx b/frontend/src/components/header/CompetitorAnalysisReports.tsx
index 98aad644..d7199762 100644
--- a/frontend/src/components/header/CompetitorAnalysisReports.tsx
+++ b/frontend/src/components/header/CompetitorAnalysisReports.tsx
@@ -198,6 +198,7 @@ const CompetitorAnalysisReports = ({ embedded = false }: Props) => {
         setStep(seen.current.has(row.no) ? STEPS.length : 0);
 
         try {
+            // ⚠️ v2.2.194: 開いた人は ② が記録する（analysis_report_view_log。⚠️ Master は記録しない・⚠️ 画面には出さない）
             const res = await apiClient.post('', { request: 'analysis_report_get', no: row.no });
             const report = res.data?.report as ReportBody | undefined;
             if (report === undefined) {
```

### backend/scripts/guide/articles/common/screen-150.md（差分）
```diff
diff --git a/backend/scripts/guide/articles/common/screen-150.md b/backend/scripts/guide/articles/common/screen-150.md
index 8f8f1ec0..c8d114d4 100644
--- a/backend/scripts/guide/articles/common/screen-150.md
+++ b/backend/scripts/guide/articles/common/screen-150.md
@@ -7,7 +7,9 @@ summary: 保存された競合分析のレポートを読む。
 ヘッダーの左上「Claudeによる分析」。だれでも開けます。
 
 ## 上：競合分析のレポート
-保存されている競合分析のレポートを読めます。読むだけで、登録・削除は管理者だけができます。
+保存されている競合分析のレポートを読めます。読むだけで、登録・削除は管理者だけができます。ヘッダーの「他社動向 → Claudeによる競合分析」からも同じレポートを読めます。
+
+> レポートを開くと、だれがいつ開いたかが記録されます（どのレポートがよく読まれているかを知るためです）。
 
 ## 下：管理者専用
 「分析したい内容を選んでください」から下は、**管理者専用**の印が付いた部分です。管理者以外には表示されません。ダッシュボードの数字をもとに、Claude が新しく分析します。
```

