<?php

$sql = 'SELECT * FROM `k-snap`';
$stmt = $pdo->prepare($sql);
$stmt->execute();
$response_snap = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result =[
    'snaps'=> $response_snap,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);