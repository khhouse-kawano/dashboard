<?php

$tableMap = [
    'order' => 'inquiry_customer',
    'spec'  => 'inquiry_customer_kaeru',
    'used'  => 'inquiry_customer_resale'
];

$category = $data['category'] ?? '';

$list = $data['list'] ?? '';

$inquiry_id = $data['inquiry_id'] ?? '';

$tableName = $tableMap[$category];

try {
    $sqlUpdate = "UPDATE {$tableName}  
            SET black_list = CONCAT(black_list, ' ', ?)
            WHERE inquiry_id = ?";
    $stmtUpdate = $pdo->prepare($sqlUpdate);
    $stmtUpdate->execute([$list, $inquiry_id]);

    echo json_encode([
        'status' => 'success',
        'message' => "{$inquiry_id}にタグを追加しました。"
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'タグの追加に失敗しました。: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
