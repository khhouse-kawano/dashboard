<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
    // // ローカルデータベース接続 (PDO)
    // $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=owners_house;charset=utf8';
    // $db_user = 'root';
    // $db_password = '';

    // 本番サーバーデータベース接続 (PDO)
    $dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
    $db_user = 'xs200571_kawano';
    $db_password = '4081kawano';

// 対象となる媒体リスト
$shops = [
    "全店舗",
    "KH",
    "KH鹿児島店",
    "KH姶良店",
    "KH霧島店",
    "KH鹿屋店",
    "KH薩摩川内店",
    "KH出水阿久根店",
    "KH加世田店",
    "KH都城店",
    "KH宮崎店",
    "KH延岡店",
    "KH大分店",
    "KH八代店",
    "DJH",
    "DJH鹿児島北店",
    "DJH霧島店",
    "DJH薩摩川内店",
    "DJH鹿屋店",
    "DJH都城店",
    "DJH宮崎店",
    "なごみ",
    "なごみ鹿児島店",
    "なごみ姶良霧島店",
    "2L鹿児島店",
    "FH",
    "FH鹿児島店",
    "FH霧島店",
    "PG HOUSE宮崎店"
];
$placeholders = rtrim(str_repeat('?,', count($shops)), ',');

$start = new DateTime('2025-01-01');
$end = new DateTime('now');
$end->modify('first day of this month');
$interval = new DateInterval('P1M');
$period = new DatePeriod($start, $interval, (clone $end)->modify('+1 month'));
$month = [];
foreach ($period as $dt){
    $months[] = $dt->format('Y/m');
}

try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "SELECT
    shop,
    COUNT(register) AS register_count,
    COUNT(CASE WHEN reserve LIKE '%20%' THEN 1 END) AS reserve_count,
    COUNT(CASE WHEN status = '契約済み' THEN 1 END) AS contract_count";
    
    foreach($months as $month){
        $sql .= ",
        COUNT(CASE WHEN register LIKE '%" . $month . "%' THEN 1 END) AS param_". str_replace("/", "_" ,$month) ."register_count,
        COUNT(CASE WHEN register LIKE '%" . $month . "%' AND reserve LIKE '%20%' THEN 1 END) AS param_". str_replace("/", "_" ,$month) ."reserve_count,
        COUNT(CASE WHEN register LIKE '%" . $month . "%' AND status = '契約済み' THEN 1 END) AS param_". str_replace("/", "_" ,$month) ."contract_count";
    }
    
    $sql .="
    FROM
    customers
    WHERE
    shop IN ($placeholders)
    GROUP BY
    shop";
    
    $sql .="
    UNION ALL
    SELECT
    'グループ全体' AS shop,
    COUNT(register) AS register_count,
    COUNT(CASE WHEN reserve LIKE '%20%' THEN 1 END) AS reserve_count,
    COUNT(CASE WHEN status = '契約済み' THEN 1 END) AS contract_count";
    
    foreach($months as $month){
        $sql .= ",
        COUNT(CASE WHEN register LIKE '%" . $month . "%' THEN 1 END) AS param_". str_replace("/", "_" ,$month) ."register_count,
        COUNT(CASE WHEN register LIKE '%" . $month . "%' AND reserve LIKE '%20%' THEN 1 END) AS param_". str_replace("/", "_" ,$month) ."reserve_count,
        COUNT(CASE WHEN register LIKE '%" . $month . "%' AND status = '契約済み' THEN 1 END) AS param_". str_replace("/", "_" ,$month) ."contract_count";
    }
    
    $sql .="
    FROM
    customers
    ORDER BY
    register_count DESC";

    // プレースホルダーを使ってステートメントを実行
    $stmt = $pdo->prepare($sql);
    $stmt->execute($shops);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 結果をJSON形式で出力
    echo json_encode($customers);
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}




?>
