<?php
$sql = "INSERT INTO family_info (id, shop, name, family_info) VALUES (:id, :shop, :name, :family_info)
ON DUPLICATE KEY UPDATE
    shop = VALUES(shop),
    name = VALUES(name),
    family_info = VALUES(family_info)
";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':id' => $data['id'],
    ':shop' => $data['shop'],
    ':name' => $data['name'],
    ':family_info' => json_encode($data['family_info'], JSON_UNESCAPED_UNICODE)
]);

$selectSql = "SELECT * FROM family_info WHERE id = ?";
$responseStmt = $pdo->prepare($selectSql);
$responseStmt->execute([$data['id']]);

$response = $responseStmt->fetch(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
