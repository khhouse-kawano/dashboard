<?php

/**
 * 販促媒体別ランキング・注文事業（frontend/src/components/customer/CustomerOrder.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **backend-express/src/features/customer/ と同じ形にしておくこと。**
 *   こちらは ② への転送が失敗したときのフォールバックである。
 *   形が違うと、転送が失敗した瞬間に画面が壊れる。
 *
 * ⚠️ 列と別名は shop/queries.ts の order と揃えてある。KPI の判定を
 *   ShopOrder.tsx と同じにするため。食い違うと店舗別と媒体別で合計が合わない。
 *   ⚠️ `rank` は予約語なのでバッククォートで囲む。
 * ─────────────────────────────────────────────
 */

// 店舗
$sql_shop = "SELECT shop, section, area
        FROM shop_list WHERE division = '注文事業'";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 営業課
$sql_section = "SELECT name FROM section_list WHERE division = '注文事業'";
$stmt_section = $pdo->prepare($sql_section);
$stmt_section->execute();
$response_section = $stmt_section->fetchAll(PDO::FETCH_ASSOC);


// 顧客一覧
$sql_contract = "SELECT id,
COALESCE(customer_contacts_name, '') as customer,
COALESCE(in_charge_store, '') as shop,
COALESCE(in_charge_user, '') as staff,
COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as `rank`,
COALESCE(sales_promotion_name, '') as medium,
COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as contract,
COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
COALESCE(reserved_interview, '') as reserved_interview,
COALESCE(status , '') as status
FROM master_data WHERE show_dashboard = 1";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute();
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体。⚠️ フロントが list_medium === 1 で絞る
$sql_medium = "SELECT medium, list_medium
        FROM medium_list WHERE response_medium = 0";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 販促費
$sql_budget = "SELECT * FROM budget WHERE response_medium = 0 AND section = 'order'";
$stmt_budget = $pdo->prepare($sql_budget);
$stmt_budget->execute();
$response_budget = $stmt_budget->fetchAll(PDO::FETCH_ASSOC);


// ⚠️ キーの順序も Express と揃えている
$result = [
    "shop" => $response_shop,
    "section" => $response_section,
    "customer" => $response_contract,
    "medium" => $response_medium,
    "budget" => $response_budget
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
