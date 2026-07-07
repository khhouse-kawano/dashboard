<?php
// 担当営業
$sql_staff = "SELECT name, shop, category, section, period
        FROM staff_list WHERE category = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT * FROM medium_resale;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 物件リスト
$sql_property = "SELECT * FROM property_list_kaeru";
$stmt_property = $pdo->prepare($sql_property);
$stmt_property ->execute();
$response_property = $stmt_property->fetchAll(PDO::FETCH_ASSOC);


$result = [
    "staff" => $response_staff,
    "medium" => $response_medium,
    "property" => $response_property
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
