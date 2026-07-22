<?php

// 担当営業
$sql_staff = "SELECT name, shop, section, report, sort, multi, status, period, position, khg_id
        FROM staff_list WHERE report = 1 and khg_id <> '';";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 店舗
$sql_shop = "SELECT brand, shop, division, section, multi, report_flag
        FROM shop_list WHERE report_flag = 1";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 営業課
$sql_section = "SELECT division, name FROM section_list";
$stmt_section = $pdo->prepare($sql_section);
$stmt_section->execute();
$response_section = $stmt_section->fetchAll(PDO::FETCH_ASSOC);


// 契約者一覧(注文事業)
$sql_contract = "SELECT id,
'注文' as category,
in_charge_store as shop,
in_charge_user as staff,
step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
status,
rank_period FROM master_data
WHERE show_dashboard = 1 ";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute();
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


// // 契約者一覧(建売事業)
// $sql_contract_kaeru = "SELECT id,
// category as category,
// in_charge_store as shop,
// in_charge_user as staff,
// step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
// status,
// rank_period FROM master_data_kaeru
// WHERE show_dashboard = 1 and (step_migration_item_01J82Z5F1RR18Z792C7KZS88QG <> '' or customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク'))";
// $stmt_contract_kaeru = $pdo->prepare($sql_contract_kaeru);
// $stmt_contract_kaeru->execute();
// $response_contract_kaeru = $stmt_contract_kaeru->fetchAll(PDO::FETCH_ASSOC);


// // 契約者一覧(中古リノベ事業)
// $sql_contract_resale = "SELECT id,
// customer_contacts_name as customer,
// '中専' as category,
// '中専鹿児島店' as shop,
// in_charge_user as staff,
// customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
// step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract_reform,
// step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract_buy,
// step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as contract_sell,
// customized_input_01JRCT12N9X24PCQ5QZPAYKB93 as budget,
// status,
// contraction_contract_price,
// additional_contraction_contract_price,
// rank_period FROM master_data_resale
// WHERE show_dashboard = 1";
// $stmt_contract_resale = $pdo->prepare($sql_contract_resale);
// $stmt_contract_resale->execute();
// $response_contract_resale = $stmt_contract_resale->fetchAll(PDO::FETCH_ASSOC);


// 契約目標
$sql_achievement = "SELECT category, name, period, value FROM company_achievement";
$stmt_achievement = $pdo->prepare($sql_achievement);
$stmt_achievement->execute();
$response_achievement = $stmt_achievement->fetchAll(PDO::FETCH_ASSOC);


// 予算総額
$sql_budget = "SELECT shop, medium, budget_period, budget_value FROM budget WHERE section = 'order' AND response_medium = 0";
$stmt_budget = $pdo->prepare($sql_budget);
$stmt_budget->execute();
$response_budget = $stmt_budget->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "staff" => $response_staff,
    "shop" => $response_shop,
    "section" => $response_section,
    "order_contract" => $response_contract,
    // "contract_kaeru" => $response_contract_kaeru,
    // "contract_resale" => $response_contract_resale,
    "achievement" => $response_achievement,
    "budget" => $response_budget
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
