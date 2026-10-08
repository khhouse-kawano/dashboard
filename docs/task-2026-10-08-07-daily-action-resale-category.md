# v2.2.175 修正: 中古の未同期は 買い:中古リノベ の反響だけ

## 依頼
- category === used の場合、inquiry_customer_resale の category = 買い:中古リノベ のもののみを未同期の条件とする

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features/` | **dailyAction.ts** | `DailySource.inquiryCategory` を追加（used だけ `'買い:中古リノベ'`）。`unsyncSql(inquiry, withCategory)` で `AND TRIM(COALESCE(i.category, '')) = ?` を足す。プレースホルダは category → 開始月 → 上限 の順 |
| `backend/src/handlers/` | **daily_action.php** | 同じ（`$unsync_category`、`:inquiry_category`） |

- ⚠️ 開始月（2026/08）の条件はそのまま。注文・建売は変わらない。

## 確認（ローカル）
- inquiry_customer_resale.category の値: `買い:中古リノベ` 606件 ／ `買い:ポータル` 164件 ／ `売り:ポータル` 362件 ／ 空 12件（完全一致で入っている）
- 未同期（2026/08 以降）: 中古 121件 → **1件**（買い:ポータル 64・売り:ポータル 49・空 7 が外れた）
- ① と ② の応答: order / spec / used とも **完全一致**。注文 11・建売 11 は変化なし
- PHP `php -l` OK ／ ② `tsc --noEmit` OK ／ フロントの変更なし

## 差分
```diff
diff --git a/backend-express/src/features/dailyAction.ts b/backend-express/src/features/dailyAction.ts
index 582c6b4a..22e0c33e 100644
--- a/backend-express/src/features/dailyAction.ts
+++ b/backend-express/src/features/dailyAction.ts
@@ -129,6 +129,11 @@ interface DailySource {
   stepOrder: string[];
   /** ⚠️ 来場日未入力を出すか（⚠️ 注文だけ。v2.2.175 合意） */
   hasCancel: boolean;
+  /**
+   * ⚠️ 未同期を反響の category（取引区分）で絞るとき、その値（v2.2.175 修正）。
+   *   ⚠️ 中古だけ `買い:中古リノベ`（指示）。⚠️ 売り:ポータル・買い:ポータルは数えない。
+   */
+  inquiryCategory?: string;
 }
 
 const fixedLabels = (steps: [string, string][]) => {
@@ -197,6 +202,8 @@ const DAILY_SOURCES: Record<DailyCategory, DailySource> = {
     master: 'master_data_resale',
     inquiry: 'inquiry_customer_resale',
     hasCancel: false,
+    // ⚠️ 未同期は 買い:中古リノベ の反響だけ（v2.2.175 修正の指示）
+    inquiryCategory: '買い:中古リノベ',
     columns: [...new Set(Object.values(RESALE_STEPS).flat().map(([, column]) => column))],
     // ⚠️ 区分が空・未知の行は「買い:中古リノベ」の名前で出す（⚠️ 一番多い区分）
     labelOf: (column, deal) => {
@@ -231,7 +238,7 @@ const DAILY_SOURCES: Record<DailyCategory, DailySource> = {
  *     ⚠️ ⚠️ **同日中に「該当日を含まないを優先してよい」と訂正があった。**
  *   ⚠️ ⚠️ **そのぶんバッジより少なく出る。これは不具合ではない。**
  */
-const unsyncSql = (inquiry: string): string => `
+const unsyncSql = (inquiry: string, withCategory: boolean): string => `
   SELECT 'unsync' AS kind,
          DATEDIFF(CURDATE(), ${INQUIRY_DATE}) AS days,
          ${shopLabel('i.shop', 'i.brand')} AS shop,
@@ -254,6 +261,7 @@ const unsyncSql = (inquiry: string): string => `
      AND COALESCE(i.support_flag, 0) <> 1
      AND COALESCE(i.black_flag, 0) <> 1
      AND TRIM(COALESCE(i.first_name, '')) <> ''
+     ${withCategory ? "AND TRIM(COALESCE(i.category, '')) = ?" : ''}
      /*
        ⚠️ v2.2.175: '-' を '/' に揃えてから比べる。⚠️ 建売（inquiry_customer_kaeru）に 'YYYY-MM-DD' が混ざっている
          （ローカル実測 405件）。⚠️ 揃えないと '-' は '/' より小さいので ⚠️ **期間の判定から黙って落ちる。**
@@ -586,7 +594,11 @@ export const runDailyAction = async (
   // ⚠️ クエリは互いに独立しているので並列で投げる
   const [contact, unsync, cancel, todayRaw, checked] = await Promise.all([
     fetchContacts(source.master),
-    query<AttentionRow>(unsyncSql(source.inquiry), [SYNC_START_MONTH[category], ROW_LIMIT]),
+    // ⚠️ 中古は反響の category で絞る（⚠️ プレースホルダの順は SQL の ? の順: category → 開始月 → 上限）
+    query<AttentionRow>(
+      unsyncSql(source.inquiry, source.inquiryCategory !== undefined),
+      [...(source.inquiryCategory !== undefined ? [source.inquiryCategory] : []), SYNC_START_MONTH[category], ROW_LIMIT]
+    ),
     // ⚠️ 来場日未入力は注文だけ（v2.2.175 合意）。⚠️ reserved_interview は注文の運用
     source.hasCancel ? query<AttentionRow>(CANCEL_SQL, [ROW_LIMIT]) : Promise.resolve([] as AttentionRow[]),
     query<TodayRow>(todaySql(source), [...source.columns, ROW_LIMIT]),
diff --git a/backend/src/handlers/daily_action.php b/backend/src/handlers/daily_action.php
index e1fc5022..70db9299 100644
--- a/backend/src/handlers/daily_action.php
+++ b/backend/src/handlers/daily_action.php
@@ -162,6 +162,8 @@ $fixed_steps = [
 $daily_master  = ['order' => 'master_data', 'spec' => 'master_data_kaeru', 'used' => 'master_data_resale'][$daily_category];
 $daily_inquiry = ['order' => 'inquiry_customer', 'spec' => 'inquiry_customer_kaeru', 'used' => 'inquiry_customer_resale'][$daily_category];
 $daily_has_cancel = $daily_category === 'order';
+// ⚠️ 未同期を反響の category（取引区分）で絞る値（v2.2.175 修正）。⚠️ 中古だけ 買い:中古リノベ（Express の inquiryCategory と同じ）
+$unsync_category = $daily_category === 'used' ? '買い:中古リノベ' : null;
 
 // 工程の列（重複なし）・表の並び
 $all_steps = $daily_category === 'used' ? array_merge(...array_values($resale_steps)) : $fixed_steps[$daily_category];
@@ -220,13 +222,16 @@ $sql_unsync = "SELECT 'unsync' AS kind,
      AND COALESCE(i.support_flag, 0) <> 1
      AND COALESCE(i.black_flag, 0) <> 1
      AND TRIM(COALESCE(i.first_name, '')) <> ''
+     " . ($unsync_category !== null ? "AND TRIM(COALESCE(i.category, '')) = :inquiry_category" : '') . "
      /* ⚠️ v2.2.175: '-' を '/' に揃えて比べる（⚠️ 建売に 'YYYY-MM-DD' が混ざる。⚠️ 注文は0件なので結果は同じ） */
      AND REPLACE(SUBSTRING(i.inquiry_date, 1, 7), '-', '/') BETWEEN :start_month AND DATE_FORMAT(NOW(), '%Y/%m')
      AND DATEDIFF(CURDATE(), $inquiry_date) > 0
    ORDER BY days DESC
    LIMIT $row_limit";
 $stmt_unsync = $pdo->prepare($sql_unsync);
-$stmt_unsync->execute([':start_month' => $sync_start_month]);
+$unsync_params = [':start_month' => $sync_start_month];
+if ($unsync_category !== null) $unsync_params[':inquiry_category'] = $unsync_category;
+$stmt_unsync->execute($unsync_params);
 $response_unsync = $stmt_unsync->fetchAll(PDO::FETCH_ASSOC);
 
 // 来場予定日を過ぎたのに結果が入っていない顧客。
```
