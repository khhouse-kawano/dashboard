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
    medium,
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
    medium IN ($placeholders)
    GROUP BY
    medium";
    
    $sql .="
    UNION ALL
    SELECT
    '全媒体合計' AS medium,
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
    $stmt->execute($mediums);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 結果をJSON形式で出力
    echo json_encode($customers);
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}




?>
