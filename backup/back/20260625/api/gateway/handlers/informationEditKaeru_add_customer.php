<?php
// 店舗
$sql_shop = "SELECT brand, shop, division, section FROM shop_list WHERE division = '建売分譲事業' AND show_flag = 1";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 担当営業
$sql_staff = "SELECT name, shop, category, section
        FROM staff_list WHERE category = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT * FROM medium_kaeru;";
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
    "shop" => $response_shop,
    "medium" => $response_medium,
    "property" => $response_property
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
