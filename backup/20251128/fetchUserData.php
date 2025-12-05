<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
$brand = $data['brand'];  // 修正: 変数名を`$brand`に変更

    // // ローカルデータベース接続 (PDO)
    // $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=owners_house;charset=utf8';
    // $db_user = 'root';
    // $db_password = '';

    // 本番サーバーデータベース接続 (PDO)
    $dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
    $db_user = 'xs200571_kawano';
    $db_password = '4081kawano';

// 対象となる媒体リスト
$mediums = [
    "全媒体",
    "チラシ",
    "フリーペーパー",
    "ハガキDM",
    "SUUMO",
    "HOME'S",
    "athome",
    "カゴスマ",
    "イエタッタ",
    "持ち家計画",
    "インターネット検索",
    "SNS広告",
    "バス広告",
    "看板",
    "CM/ラジオ",
    "紹介",
    "建築現場を見て",
    "ヒーローショーを見て",
    "タウンライフ",
    "公式LINE",
    "メタ住宅展示場",
    "住まいづくりフェア",
    "おうちづくりフェスタ"
];

$placeholders = rtrim(str_repeat('?,', count($mediums)), ',');

try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // SQLクエリを構築
    $sql = "SELECT
        medium,
        COUNT(register) AS register_count,
        COUNT(CASE WHEN reserve LIKE '%20%' THEN 1 END) AS reserve_count,
        COUNT(CASE WHEN status = '契約済み' THEN 1 END) AS contract_count,
        COUNT(CASE WHEN rank = 'Aランク' THEN 1 END) AS rankA_count,
        COUNT(CASE WHEN rank = 'Bランク' THEN 1 END) AS rankB_count,
        COUNT(CASE WHEN rank = 'Cランク' THEN 1 END) AS rankC_count,
        COUNT(CASE WHEN rank = 'Dランク' THEN 1 END) AS rankD_count,
        COUNT(CASE WHEN rank = 'Eランク' THEN 1 END) AS rankE_count
    FROM
        customers
    WHERE
        medium IN ($placeholders)
    GROUP BY
        medium
    UNION ALL
    SELECT
        '全媒体合計' AS medium,
        COUNT(register) AS register_count,
        COUNT(CASE WHEN reserve LIKE '%20%' THEN 1 END) AS reserve_count,
        COUNT(CASE WHEN status = '契約済み' THEN 1 END) AS contract_count,
        COUNT(CASE WHEN rank = 'Aランク' THEN 1 END) AS rankA_count,
        COUNT(CASE WHEN rank = 'Bランク' THEN 1 END) AS rankB_count,
        COUNT(CASE WHEN rank = 'Cランク' THEN 1 END) AS rankC_count,
        COUNT(CASE WHEN rank = 'Dランク' THEN 1 END) AS rankD_count,
        COUNT(CASE WHEN rank = 'Eランク' THEN 1 END) AS rankE_count
    FROM
        customers
    ORDER BY
        register_count DESC";

    // プレースホルダーを使ってステートメントを実行
    $stmt = $pdo->prepare($sql);
    $stmt->execute($mediums);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 別のデータベースから予算データを取得するクエリ
    $sql_budget = "SELECT medium, SUM(budget_value) AS total_budget FROM budget WHERE section = 'order' GROUP BY medium";
    $stmt_budget = $pdo->prepare($sql_budget);
    $stmt_budget->execute();
    $budgets = $stmt_budget->fetchAll(PDO::FETCH_ASSOC);

    // 顧客データと予算データの結合
    $budget_map = [];
    $totalBudgetSum = 0;
    foreach ($budgets as $budget) {
        $budget_map[$budget['medium']] = $budget['total_budget'];
        $totalBudgetSum += $budget['total_budget'];
    }

    // 結果の計算
    foreach ($customers as &$customer) {
        $customer['reserve_per'] = $customer['register_count'] != 0 && $customer['reserve_count'] != 0
            ? round(100 * ($customer['reserve_count'] / $customer['register_count']), 1)
            : 0;

        $customer['contract_per'] = $customer['reserve_count'] != 0 && $customer['contract_count'] != 0
            ? round(100 * ($customer['contract_count'] / $customer['reserve_count']), 1)
            : 0;
        $medium = $customer['medium'];
        $customer['total_budget'] = $budget_map[$medium] ?? 0;
        if ($customer['medium'] == "全媒体合計"){
            $customer['total_budget'] = $totalBudgetSum;
            }
        $customer['reserve_cost'] = $customer['total_budget'] != 0 && $customer['reserve_count'] != 0
        ? number_format(round(($customer['total_budget'] / $customer['reserve_count']), 0))
        : 0;

        $customer['register_cost'] = $customer['total_budget'] != 0 && $customer['register_count'] != 0
        ? number_format(round(($customer['total_budget'] / $customer['register_count']), 0))
        : 0;

        $customer['contract_cost'] = $customer['total_budget'] != 0 && $customer['contract_count'] != 0
        ? number_format(round(($customer['total_budget'] / $customer['contract_count']), 0))
        : 0;

        $customer['total_budget'] = $customer['total_budget'] == null ? '0' : number_format($customer['total_budget']);
        }


    // 結果をJSON形式で出力
    echo json_encode($customers);
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
?>
