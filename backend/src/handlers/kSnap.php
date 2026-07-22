<?php
// KSNAP
$sql = "SELECT * FROM `k-snap_customer` WHERE id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$data['id']]);
$response = $stmt->fetch(PDO::FETCH_ASSOC);


$sql_snap = "SELECT * FROM `k-snap`";
$stmt_snap = $pdo->prepare($sql_snap);
$stmt_snap->execute();
$response_snap = $stmt_snap->fetchAll(PDO::FETCH_ASSOC);
echo json_encode([
    "customer" => $response,
    "snap" => $response_snap
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
