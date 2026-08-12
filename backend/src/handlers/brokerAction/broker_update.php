<?php

$id = $data['id'] ?? null;
$newData = $data['data'] ?? [];

if (!$id) {
    die(json_encode(['status' => 'error', 'message' => 'IDがありません']));
}

$allowedColumns = [
    'note', 'addr1', 'addr2', 'addr', 'price', 'staff', 'category',
    'baikaiType', 'currentStatus', 'freq', 'lastReportDate',
    'reinsDate', 'priceRevDate', 'propStatus', 'keyStatus', 'keyInfo',
    'kind', 'master_data_id', 'seller', 'property_db_id', 'property_db_name',
    'show_dashboard', 'fee', 'phase'
];

// UPSERT用の配列
$columns = ['`id`'];         // INSERTの列名 (idは必須)
$placeholders = ['?'];       // INSERTの値(?)
$updateParts = [];           // ON DUPLICATE KEY UPDATE 用の配列
$bindParams = [$id];         // PDOに渡す実データ

foreach ($allowedColumns as $col) {
    if (array_key_exists($col, $newData)) {
        // ① INSERT部分の構築
        $columns[] = "`$col`";
        $placeholders[] = "?";
        
        // ② UPDATE部分の構築 (VALUES(col) でINSERTに渡した値を再利用します)
        $updateParts[] = "`$col` = VALUES(`$col`)";
        
        // ③ データのバインド (空文字はnull化)
        $val = $newData[$col] === '' ? null : $newData[$col];
        $bindParams[] = $val;
    }
}

if (count($columns) === 1) {
    die(json_encode(['status' => 'success', 'message' => '更新データなし'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

// 💡 魔法のUPSERTクエリ
// INSERT INTO table (id, col1, col2) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE col1 = VALUES(col1), col2 = VALUES(col2)
$sql = "INSERT INTO `brokerage_listings` (" . implode(', ', $columns) . ") 
        VALUES (" . implode(', ', $placeholders) . ") 
        ON DUPLICATE KEY UPDATE " . implode(', ', $updateParts);

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindParams);
    
    // 最新のデータを取得して返す (既存コードのまま)
    $sql_brokerage = "SELECT * FROM brokerage_listings";
    $stmt_brokerage = $pdo->prepare($sql_brokerage);
    $stmt_brokerage->execute();
    $response_brokerage = $stmt_brokerage->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['status' => 'success', 'brokerage' => $response_brokerage], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    die(json_encode(['status' => 'error', 'message' => 'DBエラー: ' . $e->getMessage()]));
}