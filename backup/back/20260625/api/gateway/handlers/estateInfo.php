<?php

// 不動産情報
$sql_estate = "SELECT * FROM estate_info WHERE property_id = ?";
$stmt_estate = $pdo->prepare($sql_estate);
$stmt_estate->execute([$data['id']]);
$response_estate = $stmt_estate->fetch(PDO::FETCH_ASSOC);


$result = [
    "estate" => $response_estate,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
