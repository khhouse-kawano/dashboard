<?php

// 担当営業
$sql_staff = "SELECT name, shop, section, report, sort, multi, status, period, position, khg_id
        FROM staff_list WHERE report = 1;";
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
customer_contacts_name as customer,
category as category,
in_charge_store as shop,
in_charge_user as staff,
customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
status,
rank_period FROM master_data
WHERE show_dashboard = 1 and (step_migration_item_01J82Z5F1RR18Z792C7KZS88QG <> '' or customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク'))";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute();
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


// 契約者一覧(建売事業)
$sql_contract_kaeru = "SELECT id,
customer_contacts_name as customer,
category as category,
in_charge_store as shop,
in_charge_user as staff,
customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
status,
rank_period FROM master_data_kaeru
WHERE show_dashboard = 1 and (step_migration_item_01J82Z5F1RR18Z792C7KZS88QG <> '' or customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク'))";
$stmt_contract_kaeru = $pdo->prepare($sql_contract_kaeru);
$stmt_contract_kaeru->execute();
$response_contract_kaeru = $stmt_contract_kaeru->fetchAll(PDO::FETCH_ASSOC);


// 契約者一覧(中古リノベ事業)
$sql_contract_resale = "SELECT id,
customer_contacts_name as customer,
category as category,
in_charge_store as shop,
in_charge_user as staff,
customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
status,
rank_period FROM master_data_resale
WHERE show_dashboard = 1 and (step_migration_item_01J82Z5F1RR18Z792C7KZS88QG <> '' or customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク'))";
$stmt_contract_resale = $pdo->prepare($sql_contract_resale);
$stmt_contract_resale->execute();
$response_contract_resale = $stmt_contract_resale->fetchAll(PDO::FETCH_ASSOC);


// 契約目標
$sql_achievement = "SELECT category, name, period, value FROM company_achievement";
$stmt_achievement = $pdo->prepare($sql_achievement);
$stmt_achievement->execute();
$response_achievement = $stmt_achievement->fetchAll(PDO::FETCH_ASSOC);


$result = [
        "staff" => $response_staff,
        "shop" => $response_shop,
        "section" => $response_section,
        "contract" => $response_contract,
        "contract_kaeru" => $response_contract_kaeru,
        "contract_resale" => $response_contract_resale,
        "achievement" => $response_achievement
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
