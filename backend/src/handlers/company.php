<?php

// 担当営業
$sql_staff = "SELECT name, shop, section, report, sort, multi, status, period, position, khg_id
        FROM staff_list WHERE report = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 店舗
// ⚠️⚠️ `parent_shop` は 2026-09-10 に追加した「親店舗」の列。
//   併売店をまとめる機能（Company.tsx の showMulti）が使う。
//   ⚠️ ここから外すと、② への転送が失敗して ① にフォールバックしたときだけ
//     まとめ機能が**黙って効かなくなる**（エラーにならないので気づけない）。
//   ⚠️ 列そのものは backend/scripts/sql/2026-09-10_shop_list_parent_shop.sql で追加する。
//     SQL未実行の環境では、この SELECT が Fatal error になる。
$sql_shop = "SELECT brand, shop, division, section, multi, report_flag, parent_shop
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
'注文' as category,
in_charge_store as shop,
in_charge_user as staff,
customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
'' as contract_broker,
status,
rank_period FROM master_data
WHERE show_dashboard = 1 and (step_migration_item_01J82Z5F1RR18Z792C7KZS88QG <> '' or customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク'))";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute();
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


// 契約者一覧(建売事業)
// ⚠️⚠️ 2026-09-10 に契約日の条件を外した。
//   以前は (契約日あり OR 仲介契約日あり) AND ランクあり だったため、
//   **ランクを持つが契約日が無い顧客が返らず**、会社実績の建売の
//   「ランク数」が空欄になっていた（実データで400件が欠落）。
//   ⚠️ 契約数は変わらない（以前の603件は全てランクを持つため新条件にも含まれる）。
//   ⚠️ 契約日ありでランクが無い27件は以前も今も返らない。
//     ランク条件を外すと契約数が増えるため残している。
//   ⚠️ backend-express/src/features/company/queries.ts と同じ条件にすること。
$sql_contract_kaeru = "SELECT id,
customer_contacts_name as customer,
'建売' as category,
in_charge_store as shop,
in_charge_user as staff,
customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract,
step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as contract_broker,
status,
rank_period FROM master_data_kaeru
WHERE show_dashboard = 1 AND customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク')";
$stmt_contract_kaeru = $pdo->prepare($sql_contract_kaeru);
$stmt_contract_kaeru->execute();
$response_contract_kaeru = $stmt_contract_kaeru->fetchAll(PDO::FETCH_ASSOC);


// 契約者一覧(中古リノベ事業)
$sql_contract_resale = "SELECT id,
customer_contacts_name as customer,
'中専' as category,
'中専鹿児島店' as shop,
in_charge_user as staff,
customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract_reform,
step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract_buy,
step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as contract_sell,
contract_land_application_date,
contract_building_application_date,
status,
contraction_contract_price,
additional_contraction_contract_price,
rank_period FROM master_data_resale
WHERE show_dashboard = 1";
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
