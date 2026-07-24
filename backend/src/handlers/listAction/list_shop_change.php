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

$brand = '';
if (substr($list, 0, 2) === 'JH') {
    $brand = 'JH';
} elseif (strpos($list, 'DJH') !== false) {
    $brand = 'DJH';
} elseif (strpos($list, 'KH') !== false) {
    $brand = 'KH';
} elseif (strpos($list, '2L') !== false) {
    $brand = '2L';
} elseif (strpos($list, 'なごみ') !== false) {
    $brand = 'Nagomi';
} elseif (strpos($list, 'PG') !== false) {
    $brand = 'PGH';
} elseif (strpos($list, 'ブランド・店舗未設定') !== false) {
    $brand = 'KHG';
}

if ($category === 'order') {
    try {
        $sqlUpdate = "UPDATE {$tableName}  
                SET shop = ? , brand = ?
                WHERE inquiry_id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$list, $brand, $inquiry_id]);

        echo json_encode([
            'status' => 'success',
            'message' => "{$inquiry_id}の担当店舗を変更しました。"
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (Exception $e) {
        echo json_encode([
            'status' => 'error',
            'message' => '担当店舗の変更に失敗しました。: ' . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
} elseif ($category === 'spec') {
    try {
        $sqlUpdate = "UPDATE {$tableName}  
                SET shop = ? WHERE inquiry_id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$list, $inquiry_id]);

        echo json_encode([
            'status' => 'success',
            'message' => "{$inquiry_id}の担当店舗を変更しました。"
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (Exception $e) {
        echo json_encode([
            'status' => 'error',
            'message' => '担当店舗の変更に失敗しました。: ' . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
} else{
    try {
        $sqlUpdate = "UPDATE {$tableName}  
                SET category = ? WHERE inquiry_id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$list, $inquiry_id]);

        echo json_encode([
            'status' => 'success',
            'message' => "{$inquiry_id}の担当店舗を変更しました。"
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (Exception $e) {
        echo json_encode([
            'status' => 'error',
            'message' => '担当店舗の変更に失敗しました。: ' . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
