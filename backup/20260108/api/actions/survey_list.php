<?php
$nowMonth = date('Y/m');
$month = isset($data['month']) ? $data['month'] : $nowMonth;
$sql = "SELECT name, id, shop, register, name, shop, staff
        FROM customers ORDER BY register DESC;";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
