<?php

$sql = 'SELECT * FROM `k-snap` WHERE id = ?';
$stmt = $pdo->prepare($sql);
$stmt->execute([$data['id']]);
$response_snap = $stmt->fetch(PDO::FETCH_ASSOC);

$ownersSql = 'SELECT owner FROM `k-snap`';
$ownersStmt = $pdo->prepare($ownersSql);
$ownersStmt->execute();
$response_owner = $ownersStmt->fetchALL(PDO::FETCH_ASSOC);


$result = [
    "snap" => $response_snap,
    "owner" => $response_owner
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
