<?php
// ※この上にある $pdo = new PDO(...) の直後に、以下の1行が必ずあるか確認してください！
// これがないと、PHPはカラム名の間違いや型エラーをすべて隠蔽して「成功」扱いにしてしまいます。

$json = file_get_contents('php://input');
$payload = json_decode($json, true);
$data = $payload['data'] ?? [];

if (empty($data)) {
    echo json_encode(['status' => 'success', 'message' => 'データがありません']);
    exit;
}

$columns = [
    'property_id', 'company_management_number', 'property_name', 'room_section', 'address',
    'railway_line', 'station', 'walk_minutes', 'bus_minutes', 'price_rent',
    'common_service_fee', 'layout', 'exclusive_area', 'property_type', 'construction_year',
    'created_date', 'updated_date', 'status', 'floor_plan_image', 'exterior_image',
    'lifull_homes_published', 'special_ad_impressions', 'special_ad_clicks', 'detail_page_views', 'inquiries_count', 'inquiry_rate'
];

$colNames = implode(', ', array_map(function ($c) { return "`$c`"; }, $columns));
$placeholders = implode(', ', array_fill(0, count($columns), '?'));

$updateParts = [];
foreach ($columns as $col) {
    if ($col !== 'company_management_number') {
        $updateParts[] = "`$col` = VALUES(`$col`)";
    }
}
$updateString = implode(', ', $updateParts);

$sql = "INSERT INTO `homes_summary_db` ($colNames) VALUES ($placeholders) ON DUPLICATE KEY UPDATE $updateString";

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare($sql);

    foreach ($data as $row) {
        $params = [];
        foreach ($columns as $col) {
            // Null合体演算子で安全に抽出
            $params[] = $row[$col] ?? null;
        }
        $stmt->execute($params);
    }

    $pdo->commit();

    echo json_encode([
        'status' => 'success',
        'message' => 'チャンクデータの保存(UPSERT)が完了しました',
        'processed' => count($data)
    ]);
    exit;
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'DBエラー: ' . $e->getMessage()
    ]);
    exit;
}