<?php
$sql = "SELECT タイムスタンプ as period, ブランド as brand, キャンペーン名 as name FROM pgcloud";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
