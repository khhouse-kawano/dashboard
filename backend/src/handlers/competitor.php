<?php

// 店舗
$sql_shop = "SELECT brand, shop, division, section, multi, report_flag
        FROM shop_list WHERE report_flag = 1";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 営業課
// ⚠️ 2026-09-22、⚠️ **no を足して no 昇順にした。**
//   ⚠️ 画面（CompetitorSummary.tsx）の営業課の選択肢が直書きだったため。
//   ⚠️ ⚠️ **② の competitor.ts も同じ SQL にしてあること。** 片方だけにしない。
$sql_section = "SELECT no, division, name FROM section_list ORDER BY no";
$stmt_section = $pdo->prepare($sql_section);
$stmt_section->execute();
$response_section = $stmt_section->fetchAll(PDO::FETCH_ASSOC);


// 契約者一覧(注文事業)
$sql_contract = "SELECT 
    COALESCE(id, '') as id,
    COALESCE(in_charge_store, '') as shop,
    COALESCE(in_charge_user, '') as staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as rank,
    COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as contract,
    COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') as reason,
    COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') as reason_detail,
    COALESCE(customer_contacts_annual_income, '') as income,
    COALESCE(last_action_step_migration_item_name, '') as change_reason,
    COALESCE(competitors_text, '') as competitor,
    COALESCE(competitor_name, '') as lost_competitor,
    COALESCE(competitor_lost_contract_reason, '') as lost_reason,
    COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') as lost_reason_detail,
    COALESCE(sales_promotion_name, '') as medium,
    COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
    COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
    COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
    COALESCE(status, '') as status,
    COALESCE(rank_period, '') as rank_period,
    -- ⚠️ 2026-09-18 に追加。契約列・失注列のモーダル（案件ごとのカード）で使う。
    -- ⚠️⚠️ **master_data にこれらの列が無いと Unknown column で画面が開かない。**
    --   ⚠️ v2.2.136 の 2026-09-17_master_data_win_lose.sql を先に流すこと。
    -- ⚠️ ② の backend-express/src/features/competitor.ts と**必ず揃えること**。
    COALESCE(customer_contacts_name, '') as customer,
    COALESCE(competitor_win_reason, '') as win_reason,
    COALESCE(competitor_price_gap, '') as price_gap,
    COALESCE(competitor_sales_person, '') as sales_person,
    COALESCE(competitor_countermeasure, '') as countermeasure,
    COALESCE(competitor_campaign, '') as rival_campaign
FROM master_data";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute();
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);

// ハウスメーカーリスト
$sql_maker = "SELECT * FROM house_maker";
$stmt_maker = $pdo->prepare($sql_maker);
$stmt_maker->execute();
$response_maker = $stmt_maker->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "shop" => $response_shop,
    "section" => $response_section,
    "contract" => $response_contract,
    "maker" => $response_maker
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
