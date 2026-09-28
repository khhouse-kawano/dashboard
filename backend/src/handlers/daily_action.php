<?php

/**
 * 注文営業のダッシュボードを開いたときに出す「要確認」と「本日の予定」
 * （frontend/src/components/DailyActionModal.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **backend-express/src/features/dailyAction.ts と同じ形にしておくこと。**
 *   こちらは ② への転送が失敗したときのフォールバックである。
 *   形が違うと、転送が失敗した瞬間にモーダルが壊れる（しかも普段は
 *   ② が応答するので気づくのが遅れる）。
 *
 * ⚠️⚠️ **判定条件は menu.php と同じものを使うこと。**
 *   ⚠️ 片方だけ直すと **バッジの件数と一覧の行数が食い違う。**
 *   ⚠️ 未同期の条件は frontend の listTags.ts の `isPendingSync()` とも同じ。
 *
 * ⚠️ menu は COUNT しか返さない（2026-09-14 に 18.2MB → 数十バイトにした）。
 *   ⚠️⚠️ **あの形に戻してはならない。** ここは**モーダルを開くときだけ**
 *   呼ばれる別経路で、表に出す5列しか取らない。
 * ─────────────────────────────────────────────
 */

/**
 * 日付の列を DATE に揃える式。
 *
 * ⚠️⚠️ **本番データは 'YYYY/MM/DD' と 'YYYY-MM-DD' が混在している。**
 *   ⚠️ 片方しか見ないと STR_TO_DATE が NULL を返し、**その行が黙って落ちる。**
 * ⚠️ 末尾に時刻や空白が付いた値があるため SUBSTRING(...,1,10) で切る。
 */
function dailyActionDate(string $column): string
{
    return "STR_TO_DATE(REPLACE(SUBSTRING($column, 1, 10), '/', '-'), '%Y-%m-%d')";
}

$inquiry_date = dailyActionDate('inquiry_date');
$reserved_date = dailyActionDate('reserved_interview');
$register_date = dailyActionDate('step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99');

/** 本日の予定に出す4つの工程。⚠️ 表示名は Express 側と揃えること */
$today_steps = [
    ['column' => 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', 'label' => '初回面談'],
    ['column' => 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', 'label' => '事前審査'],
    ['column' => 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', 'label' => '2回目以降面談'],
    ['column' => 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', 'label' => '契約'],
];

/**
 * 未同期を数え始める月。
 * ⚠️ menu.php の $sync_start_month と同じ。⚠️ **片方だけ変えると件数がずれる。**
 */
$sync_start_month = '2025/06';

/**
 * 1つの表に出す上限。
 * ⚠️ 上限が無いと放置が溜まったときにモーダルが開かなくなる。
 * ⚠️ 放置日数の長い順なので、切り捨てられるのは**新しいものから**である。
 */
$row_limit = 200;

// 未同期の反響（まだ顧客になっていない）。
// ⚠️⚠️ **当日の反響は出さない**（DATEDIFF > 0）。まだ「放置」ではないため。
// ⚠️⚠️ **反響一覧に載る前の行なので、空の列が多い**（実測47件中 店舗17・媒体18・氏名17）。
//   ⚠️ 店舗 … 空なら「ブランド + 店舗未設定」（shopFormate() の言い方に合わせた）
//   ⚠️ 媒体 … 空なら medium（こちらは全件埋まっている）
//   ⚠️ 氏名だけは埋めようがない。画面側で「(未設定)」と出す。
// ⚠️ shopFormate() は店舗マスタの配列が要るのでそのままは使えない。
$sql_unsync = "SELECT 'unsync' AS kind,
         DATEDIFF(CURDATE(), $inquiry_date) AS days,
         CASE WHEN TRIM(COALESCE(shop, '')) <> '' THEN TRIM(shop)
              WHEN TRIM(COALESCE(brand, '')) <> '' THEN CONCAT(TRIM(brand), '店舗未設定')
              ELSE '' END AS shop,
         DATE_FORMAT($inquiry_date, '%Y-%m-%d') AS register,
         TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS customer,
         COALESCE(NULLIF(TRIM(response_medium), ''), NULLIF(TRIM(medium), ''), '') AS medium
    FROM inquiry_customer
   WHERE COALESCE(sync, 0) = 0
     AND COALESCE(duplicate_flag, 0) <> 1
     AND COALESCE(support_flag, 0) <> 1
     AND COALESCE(black_flag, 0) <> 1
     AND SUBSTRING(inquiry_date, 1, 7) BETWEEN :start_month AND DATE_FORMAT(NOW(), '%Y/%m')
     AND DATEDIFF(CURDATE(), $inquiry_date) > 0
   ORDER BY days DESC
   LIMIT $row_limit";
$stmt_unsync = $pdo->prepare($sql_unsync);
$stmt_unsync->execute([':start_month' => $sync_start_month]);
$response_unsync = $stmt_unsync->fetchAll(PDO::FETCH_ASSOC);

// 来場予定日を過ぎたのに結果が入っていない顧客。
// ⚠️ 基準日 '2026-01-01' は menu.php と同じ（それより前の予約は数えない運用）。
// ⚠️⚠️ **当日の予約は出さない。** menu.php の `< NOW()` は当日分も数えるため、
//   バッジの件数よりここの行数は少し少なくなる。
$sql_cancel = "SELECT 'cancel' AS kind,
         DATEDIFF(CURDATE(), $reserved_date) AS days,
         COALESCE(NULLIF(TRIM(in_charge_store), ''), '') AS shop,
         COALESCE(DATE_FORMAT($register_date, '%Y-%m-%d'), '') AS register,
         COALESCE(customer_contacts_name, '') AS customer,
         COALESCE(sales_promotion_name, '') AS medium
    FROM master_data
   WHERE show_dashboard = 1
     AND COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
     AND COALESCE(cancel_status, '') = ''
     AND COALESCE(status, '') <> '重複'
     AND $reserved_date > '2026-01-01'
     AND DATEDIFF(CURDATE(), $reserved_date) > 0
   ORDER BY days DESC
   LIMIT $row_limit";
$stmt_cancel = $pdo->prepare($sql_cancel);
$stmt_cancel->execute();
$response_cancel = $stmt_cancel->fetchAll(PDO::FETCH_ASSOC);

// 本日の予定。
// ⚠️ 1人が同じ日に複数の工程を持つことがあるので、工程ごとに1行出す。
//   ⚠️ まとめると「何の予定か」が分からなくなる。
$today_parts = [];
$today_params = [];
foreach ($today_steps as $index => $step) {
    $step_date = dailyActionDate($step['column']);
    $today_parts[] = "SELECT :label$index AS step,
         COALESCE(NULLIF(TRIM(in_charge_store), ''), '') AS shop,
         COALESCE(DATE_FORMAT($register_date, '%Y-%m-%d'), '') AS register,
         COALESCE(customer_contacts_name, '') AS customer,
         COALESCE(sales_promotion_name, '') AS medium
    FROM master_data
   WHERE show_dashboard = 1
     AND COALESCE(status, '') <> '重複'
     AND $step_date = CURDATE()";
    $today_params[":label$index"] = $step['label'];
}
$sql_today = implode("\n   UNION ALL\n", $today_parts) . "\n   ORDER BY shop, customer\n   LIMIT $row_limit";
$stmt_today = $pdo->prepare($sql_today);
$stmt_today->execute($today_params);
$response_today = $stmt_today->fetchAll(PDO::FETCH_ASSOC);

// ⚠️ 2つの表を1つに混ぜ、放置日数の長い順に並べ直す。
//   ⚠️ 種類ごとに分けると「どちらがより放置されているか」が見えない。
$attention = array_merge($response_unsync, $response_cancel);
usort($attention, function ($a, $b) {
    return (int) $b['days'] - (int) $a['days'];
});

// ⚠️ days は PDO が文字列で返すため、Express と同じ数値に揃える
foreach ($attention as &$row) {
    $row['days'] = (int) $row['days'];
}
unset($row);

// ⚠️ キーの順序も Express と揃えている
$result = [
    "attention" => $attention,
    "today" => $response_today,
    "truncated" => count($response_unsync) >= $row_limit || count($response_cancel) >= $row_limit,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
