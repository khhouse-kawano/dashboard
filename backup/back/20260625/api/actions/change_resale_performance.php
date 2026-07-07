<?php
$fields = [];
$params = [];

$keys = ['total', 'property', 'broker', 'renovation', 'profit', 'other'];

foreach ($keys as $key) {
    if (isset($data[$key])) {
        $fields[] = "$key = ?";
        $params[] = $data[$key];
    }
}

if (count($fields) === 0) {
    return;
}

// WHERE の id を最後に追加
$params[] = $data['id'];

$sql = "UPDATE resale_customers SET " . implode(', ', $fields) . " WHERE id_related = ?";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);


$selectSql = "SELECT * FROM resale_customers";

$responseStmt = $pdo->prepare($selectSql);
$responseStmt->execute();

$response = $responseStmt->fetchALL(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
