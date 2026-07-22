<?php

// 顧客一覧
$sql_customer = "SELECT
  id,
  COALESCE(customer_contacts_name, '') AS customer,
  COALESCE(in_charge_store, '') AS shop,
  COALESCE(in_charge_user, '') AS staff,
  COALESCE(REPLACE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '/', '-'), '') AS register,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
  COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
  COALESCE(full_address, '') AS full_address,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
  COALESCE(customer_contacts_email, '') AS mail,
  COALESCE(reserved_interview, '') AS reserved_interview,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(cancel_status, '') AS cancel_status,
  COALESCE(status, '') AS status,
  COALESCE(sales_promotion_name, '') AS medium
 FROM master_data WHERE show_dashboard = 1;
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
    "customer" => $response_customer,
    "form" => $response_form,
    "survey" => $response_survey
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
