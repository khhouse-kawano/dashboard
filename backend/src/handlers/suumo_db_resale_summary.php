<?php

// 3. リクエストボディ（JSON）の取得
$rawInput = file_get_contents("php://input");
$payload = json_decode($rawInput, true);

if (!$payload || !isset($payload['request']) || $payload['request'] !== 'suumo_db_resale_summary') {
    // 別のリクエストならスルーする等の制御
    echo json_encode(["status" => "ignored", "message" => "Invalid request type"]);
    exit;
}

$data = $payload['data'] ?? [];
if (empty($data)) {
    echo json_encode(["status" => "success", "message" => "No data to process", "processed" => 0]);
    exit;
}

// 4. バルクUPSERTの準備
// TS側で送信されるカラム名のリスト（順不同でも対応できるように定義）
$columns = [
    'basic_info', 'location_and_price', 'registered_images', 'contract_status',
    'suumo_net_status', 'suumo_net_options', 'hp_service', 'suumo_magazine_past',
    'suumo_magazine_current', 'timestamps_info', 'summary', 'catch_and_layout',
    'trade_company_info', 'internal_info', 'company_code', 'property_type_detail',
    'station_detail', 'address', 'min_price', 'max_price', 'original_company',
    'original_staff', 'bulk_upload_code', 'management_no', 'staff_in_charge',
    'property_category', 'publication_plan', 'pv_total', 'pv_recent_week',
    'total_images', 'highlight_detail'
];

$insertValues = [];
$bindParams = [];
$placeholders = '(' . implode(',', array_fill(0, count($columns), '?')) . ')';

// データをバインド用の1次元配列に平坦化
foreach ($data as $row) {
    // もしmanagement_noが無いレコードがあればスキップ（キーが必須のため）
    if (empty($row['management_no'])) continue;

    $insertValues[] = $placeholders;
    foreach ($columns as $col) {
        $bindParams[] = $row[$col] ?? null; // 未定義ならnullをセット
    }
}

if (empty($insertValues)) {
    echo json_encode(["status" => "error", "message" => "No valid data with management_no found"]);
    exit;
}

// 5. ON DUPLICATE KEY UPDATE句の動的生成
// 「重複した場合は更新する」という指示を各カラムに対して作成
$updateParts = [];
foreach ($columns as $col) {
    if ($col === 'management_no') continue; // キー自体は更新しない
    $updateParts[] = "`$col` = VALUES(`$col`)";
}
$updateString = implode(', ', $updateParts);

// 6. 最終的なSQLの組み立て
$sql = "INSERT INTO `suumo_resale_summary` (`" . implode("`, `", $columns) . "`) 
        VALUES " . implode(', ', $insertValues) . " 
        ON DUPLICATE KEY UPDATE " . $updateString;

// 7. トランザクションを利用して実行
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindParams);
    $pdo->commit();

    echo json_encode([
        "status" => "success",
        "processed" => count($insertValues),
        "message" => "Chunk processed successfully"
    ]);
} catch (\PDOException $e) {
    $pdo->rollBack();
    error_log("Database Error: " . $e->getMessage()); // サーバーのエラーログに詳細を残す
    
    // HTTPステータスコードを500にしてフロントエンド(axios)に例外を捕捉させる
    http_response_code(500);
    echo json_encode([
        "status" => "error", 
        "message" => "Failed to process database operation"
    ]);
}