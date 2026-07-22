<?php

// 担当営業
$sql_staff = "SELECT name, shop, section, sort, rank, period, position
        FROM staff_list WHERE rank = 1 AND section = '中古住宅専門店'";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 店舗
$sql_shop = "SELECT shop, section
        FROM shop_list WHERE division = '中古リノベ' AND show_flag = 1";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 営業課
$sql_section = "SELECT name FROM section_list WHERE division = '中古リノベ'";
$stmt_section = $pdo->prepare($sql_section);
$stmt_section->execute();
$response_section = $stmt_section->fetchAll(PDO::FETCH_ASSOC);


// 契約者一覧
$sql_contract = "SELECT id,
COALESCE(customer_contacts_name, '') as customer,
COALESCE(in_charge_store, '') as shop,
COALESCE(in_charge_user, '') as staff,
COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as rank,
COALESCE(sales_promotion_name, '') as medium,
COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z , '')as contact,
COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG , '')as contract,
COALESCE(step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN , '')as valuation,
COALESCE(step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 , '')as negotiation,
COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
COALESCE(step_migration_item_01J82Z5F1WE8SKEES6VNN37B22, '') as appraisal,
COALESCE(step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '') as negotiation_apo,
COALESCE(step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '') as contract_portal,
COALESCE(reserved_interview, '') as reserved_interview,
COALESCE(status , '') as status
FROM master_data_resale WHERE show_dashboard = 1";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute();
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT *
        FROM medium_resale;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 販促費
$sql_budget = "SELECT * FROM budget WHERE response_medium = 0 and shop ='中古住宅専門店'";
$stmt_budget = $pdo->prepare($sql_budget);
$stmt_budget->execute();
$response_budget = $stmt_budget->fetchAll(PDO::FETCH_ASSOC);


$result = [
    "staff" => $response_staff,
    "shop" => $response_shop,
    "section" => $response_section,
    "customer" => $response_contract,
    "medium" => $response_medium,
    "budget" => $response_budget
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
