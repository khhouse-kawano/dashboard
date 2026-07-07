<?php
$sql = "SELECT * FROM master_data WHERE id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$data['id']]);
$response = $stmt->fetch(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
