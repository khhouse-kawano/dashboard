<?php

// 店舗
$sql_shop = "SELECT shop, section
        FROM shop_list WHERE division = '注文事業'";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT medium, list_medium
        FROM medium_list WHERE response_medium = 0;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 顧客一覧
$sql_customer = "SELECT
  COALESCE(in_charge_store, '') AS shop,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
  COALESCE(REPLACE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '/', '-'), '') AS register,
  COALESCE(REPLACE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '/', '-'), '') AS screening,
  COALESCE(REPLACE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '/', '-'), '') AS appointment,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '/', '-'), '') AS contract,
  COALESCE(REPLACE(customer_contacts_email, '/', '-'), '') AS mail,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
  COALESCE(sales_promotion_name, '') AS medium
 FROM master_data;
";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);


// 来場フォーム
$sql_form = "SELECT ブランド as brand, 店舗 as shop, 年齢 as age, 携帯番号 as mobile, ご予約のきっかけ as medium  FROM pgcloud";
$stmt_form = $pdo->prepare($sql_form);
$stmt_form->execute();
$response_form = $stmt_form->fetchAll(PDO::FETCH_ASSOC);


// 事前アンケート
$sql_survey = "SELECT * FROM before_survey";
$stmt_survey = $pdo->prepare($sql_survey);
$stmt_survey->execute();
$response_survey = $stmt_survey->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "shop" => $response_shop,
    "medium" => $response_medium,
    "customer" => $response_customer,
    "form" => $response_form,
    "survey" => $response_survey
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
