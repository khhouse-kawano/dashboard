<?php

$sql = "SELECT * FROM after_interview";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$response_interview = $stmt->fetchAll(PDO::FETCH_ASSOC);

$sql_shop = "SELECT * FROM shop_list WHERE division = '注文事業'";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

$result = [
        "interview" => $response_interview,
        "shop" => $response_shop
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
