<?php

$userName = $data['userName'] ?? '';

$sql = "SELECT * FROM update_log";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

$sql_shopValue = "SELECT shop FROM staff WHERE name = ?";
$stmt_shopValue = $pdo->prepare($sql_shopValue);
$stmt_shopValue->execute([$userName]);
$response_shopValue = $stmt_shopValue->fetch(PDO::FETCH_ASSOC);

$result = [
    'log' => $response,
    'shop' => $response_shopValue
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
