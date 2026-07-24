<?php
// ini_set('memory_limit', '256M');

// 担当営業
$sql_staff = "SELECT *
        FROM staff_list WHERE rank = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 店舗
$sql_shop = "SELECT shop, section
        FROM shop_list WHERE division = '建売分譲事業' AND show_flag = 1";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT * FROM medium_kaeru";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 架電情報
$sql_call = "SELECT * FROM call_sheet";
$stmt_call = $pdo->prepare($sql_call);
$stmt_call->execute();
$response_call = $stmt_call->fetchAll(PDO::FETCH_ASSOC);


// 顧客一覧
// 顧客一覧（kaeru と resale を結合）
$sql_customer = "
  SELECT
    id,
    COALESCE(customer_contacts_name, '') AS customer,
    COALESCE(in_charge_store, '') AS shop,
    COALESCE(in_charge_user, '') AS staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
    COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
    COALESCE(REPLACE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '/', '-'), '') AS screening,
    COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
    COALESCE(REPLACE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '/', '-'), '') AS appointment,
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
    COALESCE(property_name, '') AS property_name,
    COALESCE(property_tour_name, '') AS property_tour_name,
    COALESCE(property_contract_name, '') AS property_contract_name,
    COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number
  FROM master_data_kaeru

  UNION ALL

  SELECT
    id,
    COALESCE(customer_contacts_name, '') AS customer,
    COALESCE(in_charge_store, '') AS shop,
    COALESCE(in_charge_user, '') AS staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
    COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
    COALESCE(REPLACE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '/', '-'), '') AS screening,
    COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
    COALESCE(REPLACE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '/', '-'), '') AS appointment,
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
    COALESCE(property_name, '') AS property_name,
    COALESCE(property_tour_name, '') AS property_tour_name,
    COALESCE(property_contract_name, '') AS property_contract_name,
    COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number
  FROM master_data_resale
";

$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

// 家族情報
$sql_family = "SELECT * FROM family_info";
$stmt_family = $pdo->prepare($sql_family);
$stmt_family->execute();
$response_family = $stmt_family->fetchAll(PDO::FETCH_ASSOC);


// 物件リスト
$sql_property = "SELECT * FROM property_db";
$stmt_property = $pdo->prepare($sql_property);
$stmt_property->execute();
$response_property = $stmt_property->fetchAll(PDO::FETCH_ASSOC);


$result = [
        "staff" => $response_staff,
        "shop" => $response_shop,
        "medium" => $response_medium,
        "customer" => $response_customer,
        "call" => $response_call,
        "family" => $response_family,
        "property" => $response_property
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
