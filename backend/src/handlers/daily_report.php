<?php
ini_set('memory_limit', '256M');

// 反響情報
$sql_response = "SELECT
'order' as authority,
in_charge_store as shop,
in_charge_user as staff,
sales_promotion_name as medium,
step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract
FROM master_data

UNION ALL

SELECT
'spec' as authority,
in_charge_store as shop,
in_charge_user as staff,
sales_promotion_name as medium,
step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract
FROM master_data_kaeru

UNION ALL

SELECT
'used' as authority,
in_charge_store as shop,
in_charge_user as staff,
sales_promotion_name as medium,
step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN as appointment,
step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract
FROM master_data_resale
";
$stmt_response = $pdo->prepare($sql_response);
$stmt_response->execute();
$response_response = $stmt_response->fetchAll(PDO::FETCH_ASSOC);


// 行動量
$sql_call = "SELECT * FROM call_sheet";
$stmt_call = $pdo->prepare($sql_call);
$stmt_call->execute();
$response_call = $stmt_call->fetchAll(PDO::FETCH_ASSOC);


$sql_interview = "SELECT * FROM interview_sheet";
$stmt_interview = $pdo->prepare($sql_interview);
$stmt_interview->execute();
$response_interview = $stmt_interview->fetchAll(PDO::FETCH_ASSOC);


$sql_shop = "SELECT * FROM shop_list";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


$sql_staff = "SELECT * FROM staff_list";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


$result = [
    "response" => $response_response,
    "call" => $response_call,
    "interview" => $response_interview,
    "shop" => $response_shop,
    "staff" => $response_staff    
    ];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
