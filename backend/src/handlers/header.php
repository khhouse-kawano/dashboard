<?php

// 新着物件
$sql_estate = 'SELECT registered_at FROM estate_info WHERE registered_at >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)';
$stmt_estate = $pdo->prepare($sql_estate);
$stmt_estate->execute();
$response_estate = $stmt_estate->fetchAll(PDO::FETCH_ASSOC);


$result = [
    "estate" => count($response_estate)

];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
