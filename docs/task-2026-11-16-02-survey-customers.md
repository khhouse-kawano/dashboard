# v2.2.270 面談アンケート（survey）で新しいお客様が出ない

日付：2026-11-16　ブランチ：v2.2.270

## 依頼
- 「新たなブランチで至急。survey プロジェクトで顧客が古いものしか取得できない」（survey は /mnt/c/Users/shinji-kawano/react/survey）。
- 「customers は使わない。master_data から使う」。

## 原因
- survey は `interview_survey:customers`（② `features/survey/staff.ts` の `runSurveyCustomers`）でお客様を読む。これが `customers` 表から読んでいた。
- `customers` は 2026-07-22 を最後に更新されていない（ローカルの本番の写し：23,009件、2026/11/17 の1件は入力の誤りとみられる）。

## 変えたもの
- `backend-express/src/features/survey/staff.ts`：`runSurveyCustomers` を `master_data` から読むように変えた。列名は旧と同じ（name・id・shop・register・staff）。反響日は `/` と `-` の両方を日付にして 'YYYY/MM/DD' で返し、日付の新しい順（反響日の無い行は最後、同じ日は id の降順）。show_dashboard = 1 かつ delete_dashboard が 1 でない顧客だけ。定数 `REGISTER_DATE` を足した。
- 版：`version.ts` 2.2.270、`2026-11-16_update_log_2.2.270.sql`（ローカル no=369）。
- survey の画面（react/survey）は変えていない（返す形が同じ。店舗名の書き方も customers と同じ「KH鹿児島店」など）。
- 業務ガイドの記事：Dashboard の画面は変えていないので無し。

## テスト
- 型チェック（backend-express）エラー 0。
- ① 経由でトークン無し → 401（② まで届く）。仮スタッフ（ordinary）のトークンで 200・26,590件・約3.6MB・0.86秒。先頭の反響日 2026/11/04（ローカルの写しの最新）、新しい順に並んでいる、書き方の崩れ 0、反響日の空 102件（最後）、2026/07/22 より後の反響 3,968件が出るようになった。
- 仮スタッフは消した。
- ⚠️ 未確認：survey の画面（react/survey）をブラウザで開いての確認（本番の survey で確かめる）。

## 変更（差分）
```diff
diff --git a/backend-express/src/features/survey/staff.ts b/backend-express/src/features/survey/staff.ts
index a1b9ff42b..946c41c9e 100644
--- a/backend-express/src/features/survey/staff.ts
+++ b/backend-express/src/features/survey/staff.ts
@@ -16,9 +16,33 @@ import type { DynamicRow } from './clean';
  * ─────────────────────────────────────────────
  */
 
-/** 検索の一覧（旧 survey_list と同じ列・同じ並び） */
+/**
+ * 反響日（master_data の step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99）を日付にする。
+ * ⚠️ 文字の列で「2026/11/04」と「2026-11-04」が混ざっているため、両方を読む（文字のまま並べると新しい順にならない）
+ */
+const REGISTER_DATE = `COALESCE(
+    STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'),
+    STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'))`;
+
+/**
+ * 検索の一覧（旧 survey_list と同じ列名 name・id・shop・register・staff）。
+ *
+ * ⚠️⚠️ v2.2.270: `customers` 表ではなく `master_data`（注文の顧客DB）から読む。
+ *   ⚠️ `customers` は 2026-07-22 を最後に更新されておらず、7月以降の反響が検索に出ていなかった（2026-11-16 の指示）。
+ * ⚠️ 顧客DBに表示している顧客だけ（show_dashboard = 1）。個人情報を削除した顧客（delete_dashboard = 1）は出さない。
+ * ⚠️ register は 'YYYY/MM/DD' にそろえて返す（survey の画面がそのまま表に出すため。旧 customers と同じ形）。新しい順。
+ */
 export const runSurveyCustomers = async (): Promise<Record<string, unknown>[]> =>
-  query<DynamicRow>('SELECT name, id, shop, register, staff FROM customers ORDER BY register DESC');
+  query<DynamicRow>(
+    `SELECT COALESCE(customer_contacts_name, '') AS name,
+            id,
+            COALESCE(in_charge_store, '') AS shop,
+            COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y/%m/%d'), '') AS register,
+            COALESCE(in_charge_user, '') AS staff
+       FROM master_data
+      WHERE show_dashboard = 1 AND COALESCE(delete_dashboard, 0) = 0
+      ORDER BY ${REGISTER_DATE} IS NULL, ${REGISTER_DATE} DESC, id DESC`
+  );
 
 /** 担当の一覧（旧 staff_list の、survey が使う列だけ） */
 export const runSurveyStaff = async (): Promise<Record<string, unknown>[]> =>
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 8f27a347a..8a1a33e4e 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.269';
+export const newVersion = '2.2.270';
```
