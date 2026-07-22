<?php

// 販促媒体
$sql_medium = "SELECT *
        FROM medium_resale;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);



// 顧客一覧
$sql_contract = "SELECT id,
customer_contacts_name as customer,
in_charge_store as shop,
customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG as tour,
step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN as assess,
step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as brokerage,
customer_contacts_annual_income as income,
current_contract_type as current_contract_type,
sales_promotion_name as medium,
status,
lat_lng,
full_address FROM master_data_resale
WHERE show_dashboard = 1 AND (lat_lng is NOT NULL or lat_lng <> '' or lat_lng <> '取得不可')";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute();
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


$result = [
    "customer" => $response_contract,
    "medium" => $response_medium
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
