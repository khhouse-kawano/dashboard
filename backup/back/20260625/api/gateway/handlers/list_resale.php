<?php


//来場の状況
$sql_summary = "SELECT 
COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
COALESCE(category, '') as category,
COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
COALESCE(in_charge_store, '') as shop,
COALESCE(sales_promotion_name, '') as medium
FROM master_data_resale";
$stmt_summary = $pdo->prepare($sql_summary);
$stmt_summary->execute();
$response_summary = $stmt_summary->fetchAll(PDO::FETCH_ASSOC);

// 店舗
$sql_shop = "SELECT shop, section, area
        FROM shop_list WHERE brand = 'KHR' AND show_flag = 1";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// スタッフ
$sql_staff = "SELECT name, shop , period FROM staff_list";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT *
        FROM medium_resale;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 反響一覧
$sql_inquiry = "SELECT id, inquiry_id, pg_id, inquiry_date, medium, response_medium, first_name, last_name, category,
        first_name_kana, last_name_kana, mobile, landline, mail, zip, pref, city, town, street, building, brand, shop, sync, staff, area, 
        reserved_date, black_list, hp_campaign, duplicate, property, note FROM inquiry_customer_resale WHERE first_name <> '' ORDER By inquiry_date DESC";
$stmt_inquiry = $pdo->prepare($sql_inquiry);
$stmt_inquiry->execute();
$response_inquiry = $stmt_inquiry->fetchAll(PDO::FETCH_ASSOC);


// 事前アンケート
$sql_survey = "SELECT * FROM before_survey ORDER BY dateStr DESC";
$stmt_survey = $pdo->prepare($sql_survey);
$stmt_survey->execute();
$response_survey = $stmt_survey->fetchAll(PDO::FETCH_ASSOC);


// ブラックリスト
$sql_black = "SELECT mail, mobile FROM black_list WHERE show_key = 1";
$stmt_black = $pdo->prepare($sql_black);
$stmt_black->execute();
$response_black = $stmt_black->fetchAll(PDO::FETCH_ASSOC);


$result = [
    "summary" => $response_summary,
    "shop" => $response_shop,
    "staff" => $response_staff,
    "medium" => $response_medium,
    "inquiry" => $response_inquiry,
    "survey" => $response_survey,
    "black" => $response_black
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
