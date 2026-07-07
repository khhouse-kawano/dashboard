<?php
$sql = "INSERT INTO registered_estate (name, period, value, url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), url = VALUES(url)";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    $data['name'],
    $data['period'],
    $data['value'],
    $data['url']
]);

$selectSql = "SELECT * FROM registered_estate";

$responseStmt = $pdo->prepare($selectSql);
$responseStmt->execute();

$response = $responseStmt->fetchALL(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
