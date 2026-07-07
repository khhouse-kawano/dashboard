<?php
$sql = "INSERT INTO company_achievement (period, category, name, value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    $data['period'],
    $data['category'],
    $data['name'],
    $data['value']
]);

$selectSql = "SELECT * FROM company_achievement";

$responseStmt = $pdo->prepare($selectSql);
$responseStmt->execute();

$response = $responseStmt->fetchALL(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
