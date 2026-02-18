<?php
$sql = "SELECT * FROM before_survey WHERE LEFT(brand, 2) = ? AND REPLACE(REPLACE(name, ' ', ''), '　', '') = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$data['brand'], preg_replace('/[ 　]/u', '', $data['name'])]);
$response = $stmt->fetch(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
