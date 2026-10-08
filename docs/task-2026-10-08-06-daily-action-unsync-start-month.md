# v2.2.175 修正: 建売・中古の未同期は 2026年8月以降だけ数える

## 依頼
- category が spec / used の場合、未同期に「2026年8月以降」の条件を加える
- 2026年7月までの inquiry_customer_kaeru / inquiry_customer_resale の顧客は未同期として数えない

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features/` | **dailyAction.ts** | `SYNC_START_MONTH` を事業別 `{ order: '2025/06', spec: '2026/08', used: '2026/08' }`。`unsyncSql` の期間比較を `REPLACE(SUBSTRING(i.inquiry_date, 1, 7), '-', '/')` に |
| `backend/src/handlers/` | **daily_action.php** | 同じ（`$sync_start_months`） |

### ⚠️ ついでに直したこと（同じ条件の取りこぼし）
- ⚠️ inquiry_customer_kaeru の inquiry_date に **`YYYY-MM-DD` が405件**混ざっている（ローカル実測。2025-09〜2026-10）。
- ⚠️ 従来の `SUBSTRING(...,1,7) BETWEEN '2026/08' AND …` だと `'2026-09' < '2026/08'`（`-` は `/` より小さい）で ⚠️ **黙って期間外になる**。
- ⚠️ `-` を `/` に揃えてから比べるようにした。⚠️ 注文（inquiry_customer）は `-` が0件なので ⚠️ **件数は変わらない**（menu.ts のバッジとも一致したまま）。
- ⚠️ inquiry_customer_resale は `-` が0件。

## 確認（ローカル）
- PHP `php -l` OK ／ ② `tsc --noEmit` OK
- ① と ② の応答: order / spec / used とも **完全一致**
- 未同期: 注文 11件（変化なし）／ ⚠️ 建売 881 → **11件**（反響日 2026-09-28〜）／ ⚠️ 中古 669 → **121件**（反響日 2026-08-02〜）。上限（200）に届かない
- フロントの変更なし（main.79f19c9a.js のまま）

## 差分
```diff
diff --git a/backend-express/src/features/dailyAction.ts b/backend-express/src/features/dailyAction.ts
index 6288d603..582c6b4a 100644
--- a/backend-express/src/features/dailyAction.ts
+++ b/backend-express/src/features/dailyAction.ts
@@ -254,7 +254,12 @@ const unsyncSql = (inquiry: string): string => `
      AND COALESCE(i.support_flag, 0) <> 1
      AND COALESCE(i.black_flag, 0) <> 1
      AND TRIM(COALESCE(i.first_name, '')) <> ''
-     AND SUBSTRING(i.inquiry_date, 1, 7) BETWEEN ? AND DATE_FORMAT(NOW(), '%Y/%m')
+     /*
+       ⚠️ v2.2.175: '-' を '/' に揃えてから比べる。⚠️ 建売（inquiry_customer_kaeru）に 'YYYY-MM-DD' が混ざっている
+         （ローカル実測 405件）。⚠️ 揃えないと '-' は '/' より小さいので ⚠️ **期間の判定から黙って落ちる。**
+       ⚠️ 注文（inquiry_customer）は '-' が0件なので結果は変わらない（⚠️ menu.ts の件数とも一致したまま）。
+     */
+     AND REPLACE(SUBSTRING(i.inquiry_date, 1, 7), '-', '/') BETWEEN ? AND DATE_FORMAT(NOW(), '%Y/%m')
      AND DATEDIFF(CURDATE(), ${INQUIRY_DATE}) > 0
    ORDER BY days DESC
    LIMIT ?
@@ -449,9 +454,17 @@ const fetchContacts = async (master: string): Promise<ContactRow[]> => {
 
 /**
  * 未同期を数え始める月。
- * ⚠️ menu.ts の `SYNC_START_MONTH` と同じ。⚠️ **片方だけ変えると件数がずれる。**
+ * ⚠️ 注文は menu.ts の `SYNC_START_MONTH` と同じ。⚠️ **片方だけ変えると件数がずれる。**
+ * ⚠️⚠️ v2.2.175 修正: **建売・中古は 2026/08 から**（指示）。
+ *   ⚠️ 2026年7月までの inquiry_customer_kaeru / inquiry_customer_resale は未同期として数えない
+ *     （⚠️ 建売・中古は反響を全部は同期しない運用で、⚠️ 過去分を数えると数百件になっていた）。
+ * ⚠️ ① の daily_action.php の $sync_start_months と同じにすること。
  */
-const SYNC_START_MONTH = '2025/06';
+const SYNC_START_MONTH: Record<DailyCategory, string> = {
+  order: '2025/06',
+  spec: '2026/08',
+  used: '2026/08',
+};
 
 /**
  * 1つの表に出す上限。
@@ -573,7 +586,7 @@ export const runDailyAction = async (
   // ⚠️ クエリは互いに独立しているので並列で投げる
   const [contact, unsync, cancel, todayRaw, checked] = await Promise.all([
     fetchContacts(source.master),
-    query<AttentionRow>(unsyncSql(source.inquiry), [SYNC_START_MONTH, ROW_LIMIT]),
+    query<AttentionRow>(unsyncSql(source.inquiry), [SYNC_START_MONTH[category], ROW_LIMIT]),
     // ⚠️ 来場日未入力は注文だけ（v2.2.175 合意）。⚠️ reserved_interview は注文の運用
     source.hasCancel ? query<AttentionRow>(CANCEL_SQL, [ROW_LIMIT]) : Promise.resolve([] as AttentionRow[]),
     query<TodayRow>(todaySql(source), [...source.columns, ROW_LIMIT]),
diff --git a/backend/src/handlers/daily_action.php b/backend/src/handlers/daily_action.php
index d74435e5..e1fc5022 100644
--- a/backend/src/handlers/daily_action.php
+++ b/backend/src/handlers/daily_action.php
@@ -183,9 +183,12 @@ $step_label_of = function (string $column, string $deal) use ($daily_category, $
 
 /**
  * 未同期を数え始める月。
- * ⚠️ menu.php の $sync_start_month と同じ。⚠️ **片方だけ変えると件数がずれる。**
+ * ⚠️ 注文は menu.php の $sync_start_month と同じ。⚠️ **片方だけ変えると件数がずれる。**
+ * ⚠️⚠️ v2.2.175 修正: **建売・中古は 2026/08 から**（指示）。2026年7月までは未同期として数えない。
+ * ⚠️ Express の dailyAction.ts の SYNC_START_MONTH と同じにすること。
  */
-$sync_start_month = '2025/06';
+$sync_start_months = ['order' => '2025/06', 'spec' => '2026/08', 'used' => '2026/08'];
+$sync_start_month = $sync_start_months[$daily_category];
 
 /**
  * 1つの表に出す上限。
@@ -217,7 +220,8 @@ $sql_unsync = "SELECT 'unsync' AS kind,
      AND COALESCE(i.support_flag, 0) <> 1
      AND COALESCE(i.black_flag, 0) <> 1
      AND TRIM(COALESCE(i.first_name, '')) <> ''
-     AND SUBSTRING(i.inquiry_date, 1, 7) BETWEEN :start_month AND DATE_FORMAT(NOW(), '%Y/%m')
+     /* ⚠️ v2.2.175: '-' を '/' に揃えて比べる（⚠️ 建売に 'YYYY-MM-DD' が混ざる。⚠️ 注文は0件なので結果は同じ） */
+     AND REPLACE(SUBSTRING(i.inquiry_date, 1, 7), '-', '/') BETWEEN :start_month AND DATE_FORMAT(NOW(), '%Y/%m')
      AND DATEDIFF(CURDATE(), $inquiry_date) > 0
    ORDER BY days DESC
    LIMIT $row_limit";
```
