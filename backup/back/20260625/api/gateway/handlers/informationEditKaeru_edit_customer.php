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


// 顧客情報
$sql_customer = "SELECT * FROM master_data_kaeru WHERE id = ?";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute([$data['id']]);
$response_customer = $stmt_customer->fetch(PDO::FETCH_ASSOC);


// 架電状況
$sql_call = "SELECT * FROM call_sheet WHERE id = ?";
$stmt_call = $pdo->prepare($sql_call);
$stmt_call->execute([$data['id']]);
$response_call = $stmt_call->fetch(PDO::FETCH_ASSOC);


// 面談記録
$sql_interview = "SELECT * FROM interview_sheet WHERE id = ?";
$stmt_interview = $pdo->prepare($sql_interview);
$stmt_interview->execute([$data['id']]);
$response_interview = $stmt_interview->fetch(PDO::FETCH_ASSOC);


// 物件リスト
$sql_property = "SELECT * FROM property_list_kaeru";
$stmt_property = $pdo->prepare($sql_property);
$stmt_property ->execute();
$response_property = $stmt_property->fetchAll(PDO::FETCH_ASSOC);


$result = [
    "staff" => $response_staff,
    "shop" => $response_shop,
    "medium" => $response_medium,
    "customer" => $response_customer,
    "call" => $response_call,
    "interview" => $response_interview,
    "property" => $response_property
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
