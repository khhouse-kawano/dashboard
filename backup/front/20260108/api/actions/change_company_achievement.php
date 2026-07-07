<?php
$sql = "INSERT INTO company_achievement (period, category, name, value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    $data['period'],
    $data['category'],
    $data['name'],
    $data['value']
]);

$selectSql = "SELECT * FROM company_achievement WHERE period = ? AND category = ? AND name = ?";

$responseStmt = $pdo->prepare($selectSql);
$responseStmt->execute([
    $data['period'],
    $data['category'],
    $data['name']
]);

$response = $responseStmt->fetch(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
