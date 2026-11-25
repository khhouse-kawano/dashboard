<?php
ini_set('memory_limit', '256M');

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


// ⚠️ v2.2.301 販促媒体（medium_kaeru）・架電情報（call_sheet）・家族情報（family_info）の全件を返すのをやめた。
//   ⚠️ 物件DB（DatabaseProperty.tsx）は使っておらず、① のメモリが足りなくなる主な原因だった。
//   ⚠️ ふだんは ② の property_list（GET）を使う。ここは ② に届かないときの予備。

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
    COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
    '株式会社　国分ハウジング不動産　本店' as category
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
    COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
    '国分ハウジンググループ中古住宅専門店' as category
  FROM master_data_resale
";

$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

// 物件リスト
$sql_property = "SELECT * FROM property_db";
$stmt_property = $pdo->prepare($sql_property);
$stmt_property->execute();
$response_property = $stmt_property->fetchAll(PDO::FETCH_ASSOC);

// athome
$sql_athome = "SELECT * FROM athome_summary_db";
$stmt_athome = $pdo->prepare($sql_athome);
$stmt_athome->execute();
$response_athome = $stmt_athome->fetchAll(PDO::FETCH_ASSOC);


// SUUMO
$sql_SUUMO = "SELECT * FROM suumo_resale_summary";
$stmt_SUUMO = $pdo->prepare($sql_SUUMO);
$stmt_SUUMO->execute();
$response_SUUMO = $stmt_SUUMO->fetchAll(PDO::FETCH_ASSOC);


// HOME'S
$sql_homes = "SELECT * FROM homes_summary_db";
$stmt_homes = $pdo->prepare($sql_homes);
$stmt_homes->execute();
$response_homes = $stmt_homes->fetchAll(PDO::FETCH_ASSOC);



$result = [
        "staff" => $response_staff,
        "shop" => $response_shop,
        "customer" => $response_customer,
        "property" => $response_property,
        "athome" => $response_athome,
        "suumo" => $response_SUUMO,
        "homes" => $response_homes
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
