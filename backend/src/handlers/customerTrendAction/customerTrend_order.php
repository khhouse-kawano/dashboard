<?php

// 店舗
// ⚠️ multi / parent_shop は CustomerTrendOrder.tsx の「併売店をまとめる」が使う。
//   ⚠️ backend-express/src/features/customerTrend/queries.ts の SHOP_SQL.order と
//     必ず同じ列にしておくこと。ここに無いと、② が 5xx でここへフォールバックした
//     ときに**まとめが黙って効かなくなる**（画面はエラーを出さない）。
$sql_shop = "SELECT shop, section, brand, area, multi, parent_shop
        FROM shop_list WHERE division = '注文事業'";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// ⚠️ v2.2.278: 画面が月を数えるのに使う日付の列（register / interview / appointment / screening / contract / 来場予約）。
//   ⚠️ このどれかが期間に入る行に絞る（数字は全件のときと変わらない）。
//   ⚠️⚠️ ② の features/customerTrend/queries.ts の DATE_COLUMNS と同じにすること
$customerTrendDateColumns = [
        'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99',
        'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
        'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
        'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
        'reserved_interview',
];
[$customerTrendCond, $customerTrendParams] = anyMonthCondition($customerTrendDateColumns, $customerTrendMonths);

// 顧客一覧
$sql_contract = "SELECT id,
COALESCE(customer_contacts_name, '') as customer,
COALESCE(in_charge_store, '') as shop,
COALESCE(in_charge_user, '') as staff,
COALESCE(hp_campaign, '') as hp_campaign,
COALESCE(portal_flag, 0) as portal_flag,
COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as rank,
COALESCE(sales_promotion_name, '') as medium,
COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG , '')as contract,
COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
COALESCE(reserved_interview, '') as reserved_interview,
COALESCE(status , '') as status
FROM master_data WHERE show_dashboard = 1 AND {$customerTrendCond}";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute($customerTrendParams);
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT medium, list_medium, sort_key, category, response_medium
        FROM medium_list WHERE response_medium = 0;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 販促費
// ⚠️ v2.2.278: 期間なし（古い画面）… 今までどおり全列・section で絞らない。期間あり … 広告費にチェックがあるときだけ、6列を期間で。無ければ空
$response_budget = customerTrendBudget($pdo, "SELECT * FROM budget WHERE response_medium = 0", 'order', $customerTrendBudgetMode, $customerTrendMonths);


$result = [
    "shop" => $response_shop,
    "customer" => $response_contract,
    "medium" => $response_medium,
    "budget" => $response_budget
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
