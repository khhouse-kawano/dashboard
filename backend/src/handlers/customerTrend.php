<?php

$category = $data['category'] ?? 'order';
$allowed_categories = ['order', 'spec', 'used'];

if (!in_array($category, $allowed_categories, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

/**
 * ⚠️ v2.2.278: 画面は GET で期間を送る（core/db.php の GET_ALLOWED_REQUESTS）。店舗別反響推移（shopTrend.php）と同じ規則。
 *   startMonth / endMonth … 'YYYYMM'。⚠️ 無ければ今までどおり全件・広告費は全列（古い画面との互換）
 *   lastYear=1  … 前年同月も足して取る（昨年実績にチェックを入れたとき）
 *   budget=1    … 広告費を返す（広告費にチェックを入れたとき）。⚠️ 期間があって budget が無ければ空の配列
 *   duplicate=1 … spec だけ。名寄せした顧客（show_dashboard ≠ 1）も返す。⚠️ 期間があって duplicate が無ければ show_dashboard = 1 だけ
 * ⚠️⚠️ ② の backend-express/src/features/customerTrend/index.ts と同じ規則にすること。
 */
require_once __DIR__ . '/../core/period.php';

$customerTrendPeriod = periodMonths($data);
if ($customerTrendPeriod === false) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '期間の指定が正しくありません'], JSON_UNESCAPED_UNICODE);
        exit;
}
$customerTrendIsOn = fn($value) => $value === '1' || $value === 1;
// 顧客と広告費を絞る月（昨年実績なら前年同月も）。⚠️ null なら絞らない
$customerTrendMonths = ($customerTrendPeriod !== null && $customerTrendIsOn($data['lastYear'] ?? null))
        ? withLastYearMonths($customerTrendPeriod)
        : $customerTrendPeriod;
// 広告費の返し方: 'all'（期間なし＝今までどおり）/ 'period'（6列を期間で）/ 'none'（空の配列）
$customerTrendBudgetMode = $customerTrendPeriod === null
        ? 'all'
        : ($customerTrendIsOn($data['budget'] ?? null) ? 'period' : 'none');
// 建売の名寄せ: 期間があって duplicate=1 でなければ show_dashboard = 1 だけ（画面の「名寄せした顧客も表示」と同じ判定）
$customerTrendOnlyShown = $customerTrendPeriod !== null && !$customerTrendIsOn($data['duplicate'] ?? null);

/**
 * 販促費（customerTrendAction/customerTrend_{category}.php から呼ぶ）。
 * ⚠️ $allSql は期間なし（古い画面）のときの今までどおりの SQL（order は section で絞らない）。
 * ⚠️ 期間ありは画面が使う6列だけ・その事業の section だけ（order の画面は section === 'order' しか数えない）。
 *
 * @param string[]|null $months
 */
function customerTrendBudget(PDO $pdo, string $allSql, string $section, string $mode, ?array $months): array
{
        if ($mode === 'none') return [];
        if ($mode === 'all') {
                $stmt = $pdo->prepare($allSql);
                $stmt->execute();
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        [$cond, $params] = monthCondition('budget_period', $months);
        $stmt = $pdo->prepare("SELECT budget_period, shop, medium, budget_value, section, order_section
                FROM budget WHERE response_medium = 0 AND section = ? AND {$cond}");
        $stmt->execute([$section, ...$params]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

require_once __DIR__ . "/customerTrendAction/customerTrend_{$category}.php";

exit;

