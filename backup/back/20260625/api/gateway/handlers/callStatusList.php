<?php


// 担当営業
$sql_staff = "SELECT *
        FROM staff_list WHERE rank = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 店舗
$sql_shop = "SELECT shop, section, division, show_flag
        FROM shop_list";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT medium, list_medium
        FROM medium_list WHERE response_medium = 0;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 架電情報
$sql_call = "SELECT * FROM call_sheet";
$stmt_call = $pdo->prepare($sql_call);
$stmt_call->execute();
$response_call = $stmt_call->fetchAll(PDO::FETCH_ASSOC);


// 紹介
$sql_introductory = "SELECT * FROM introductory";
$stmt_introductory = $pdo->prepare($sql_introductory);
$stmt_introductory->execute();
$response_introductory = $stmt_introductory->fetchAll(PDO::FETCH_ASSOC);

$category = $data['category'] ?? '';

$tableMapping = [
    'order' => 'master_data',
    'spec'  => 'master_data_kaeru',
    'used'  => 'master_data_resale'
];

$tableName = $tableMapping[$category] ?? 'master_data'; 

$sql_customer = "SELECT
  id,
  COALESCE(customer_contacts_name, '') AS customer,
  COALESCE(in_charge_store, '') AS shop,
  COALESCE(in_charge_user, '') AS staff,
  COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
  COALESCE(
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
    ''
  ) AS register,
  COALESCE(sales_promotion_name, '') AS medium,
  COALESCE(status, '') AS status,
  COALESCE(rank_period, '') AS rank_period,
  COALESCE(call_status, '') AS call_status,
  COALESCE(cancel_status, '') AS cancel_status,
  COALESCE(show_dashboard, 0) AS trash,
  COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
  COALESCE(full_address, '') AS full_address,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
  COALESCE(introduction_person_category, '') AS introduction_person_category,
  COALESCE(competitor_lost_contract_reason, '') AS competitor_lost_contract_reason,
  COALESCE(competitors_text, '') AS competitors_text,
  COALESCE(competitor_name, '') AS competitor_name,
  COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') AS event,
  COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') AS customized_input_01JRF9CZSW65A151WR30NA4PB3,
  COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH
 FROM $tableName;
";

$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);


// 家族情報
$sql_family = "SELECT * FROM family_info";
$stmt_family = $pdo->prepare($sql_family);
$stmt_family->execute();
$response_family = $stmt_family->fetchAll(PDO::FETCH_ASSOC);


// イベント情報
$sql_event = "SELECT * FROM event_calendar WHERE shop = 'khg' AND flag = 1";
$stmt_event = $pdo->prepare($sql_event);
$stmt_event->execute();
$response_event = $stmt_event->fetchAll(PDO::FETCH_ASSOC);


$result = [
        "staff" => $response_staff,
        "shop" => $response_shop,
        "medium" => $response_medium,
        "customer" => $response_customer,
        "callLog" => $response_call,
        "family" => $response_family,
        "introductory" => $response_introductory,
        "event" => $response_event,
];



echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
