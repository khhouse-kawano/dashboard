<?php

// 反響一覧
$sql_campaign = "SELECT 
COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as contract,
COALESCE(hp_campaign, '') as hp_campaign,
COALESCE(in_charge_store, '') as in_charge_store
FROM master_data WHERE hp_campaign <> ''";
$stmt_campaign = $pdo->prepare($sql_campaign);
$stmt_campaign->execute();
$response_campaign = $stmt_campaign->fetchAll(PDO::FETCH_ASSOC);


// 店舗一覧
$sql_shop = "SELECT brand, shop, section, area FROM shop_list WHERE show_flag = 1";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "campaign" => $response_campaign,
    "shop" => $response_shop
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
