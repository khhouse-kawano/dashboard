<?php
// 店舗
$sql_shop = "SELECT brand, shop, division, section, multi, report_flag
        FROM shop_list";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 担当営業
$sql_staff = "SELECT name, shop, category, section, period
        FROM staff_list WHERE category = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT medium, list_medium
        FROM medium_list WHERE response_medium = 0;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// ハウスメーカーリスト
$sql_maker = "SELECT* FROM house_maker";
$stmt_maker = $pdo->prepare($sql_maker);
$stmt_maker->execute();
$response_maker = $stmt_maker->fetchAll(PDO::FETCH_ASSOC);


// 紹介
$sql_introductory = "SELECT * FROM introductory";
$stmt_introductory = $pdo->prepare($sql_introductory);
$stmt_introductory->execute();
$response_introductory = $stmt_introductory->fetchAll(PDO::FETCH_ASSOC);


$result = [
        "staff" => $response_staff,
        "shop" => $response_shop,
        "medium" => $response_medium,
        "maker" => $response_maker,
        "introductory" => $response_introductory
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
