<?php

$category = $data['category'] ?? 'order';
$allowed_categories = ['order', 'spec', 'used'];

if (!in_array($category, $allowed_categories, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

/**
 * ⚠️ v2.2.277: 画面は GET で期間を送る（core/db.php の GET_ALLOWED_REQUESTS）。
 *   startMonth / endMonth … 'YYYYMM'。⚠️ 無ければ今までどおり全件・広告費は全列（古い画面との互換）
 *   lastYear=1 … 前年同月も足して取る（昨年実績にチェックを入れたとき）
 *   budget=1   … 広告費を返す（広告費にチェックを入れたとき）。⚠️ 期間があって budget が無ければ空の配列
 * ⚠️⚠️ ② の backend-express/src/features/shopTrend/index.ts と同じ規則にすること。
 */
require_once __DIR__ . '/../core/period.php';

$shopTrendPeriod = periodMonths($data);
if ($shopTrendPeriod === false) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '期間の指定が正しくありません'], JSON_UNESCAPED_UNICODE);
        exit;
}
$shopTrendIsOn = fn($value) => $value === '1' || $value === 1;
// 顧客と広告費を絞る月（昨年実績なら前年同月も）。⚠️ null なら絞らない
$shopTrendMonths = ($shopTrendPeriod !== null && $shopTrendIsOn($data['lastYear'] ?? null))
        ? withLastYearMonths($shopTrendPeriod)
        : $shopTrendPeriod;
// 広告費の返し方: 'all'（期間なし＝今までどおり全列）/ 'period'（6列を期間で）/ 'none'（空の配列）
$shopTrendBudgetMode = $shopTrendPeriod === null
        ? 'all'
        : ($shopTrendIsOn($data['budget'] ?? null) ? 'period' : 'none');

/**
 * 販促費（shopTrendAction/shopTrend_{category}.php から呼ぶ）。
 * ⚠️ $section は事業ごとの固定値（order / spec / use。⚠️ 中古は 'use'）。
 *
 * @param string[]|null $months
 */
function shopTrendBudget(PDO $pdo, string $section, string $mode, ?array $months): array
{
        if ($mode === 'none') return [];
        if ($mode === 'all') {
                $stmt = $pdo->prepare("SELECT * FROM budget WHERE response_medium = 0 AND section = ?");
                $stmt->execute([$section]);
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        [$cond, $params] = monthCondition('budget_period', $months);
        $stmt = $pdo->prepare("SELECT budget_period, shop, medium, budget_value, section, order_section
                FROM budget WHERE response_medium = 0 AND section = ? AND {$cond}");
        $stmt->execute([$section, ...$params]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

require_once __DIR__ . "/shopTrendAction/shopTrend_{$category}.php";

exit;
