<?php
$list = isset($data['list']) ? $data['list'] : "";
$inquiry_id = isset($data['inquiry_id']) ? $data['inquiry_id'] : "";

$sqlUpdate = "UPDATE inquiry_customer 
            SET staff = ?
            WHERE inquiry_id = ?";
$stmtUpdate = $pdo->prepare($sqlUpdate);
$stmtUpdate->execute([$list, $inquiry_id]);
$customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

$newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

$stmt = $pdo->prepare($newSql);
$stmt->execute();
$newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($newCustomers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
