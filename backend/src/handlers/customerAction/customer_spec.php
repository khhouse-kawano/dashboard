<?php

/**
 * 販促媒体別ランキング・建売分譲（frontend/src/components/customer/CustomerKaeru.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **backend-express/src/features/customer/ と同じ形にしておくこと。**
 *   こちらは ② への転送が失敗したときのフォールバックである。
 *   形が違うと、転送が失敗した瞬間に画面が壊れる（しかも普段は動くので
 *   気づくのが遅れる）。
 *
 * ⚠️⚠️ **2026-09-14 に誤りを2つ直した。以前とは数字が変わる。**
 *
 *   ① 契約の列を取り違えていた。
 *      旧: step_migration_item_01J82Z5F1RR18Z792C7KZS88QG を `contract` として取得
 *      ⚠️ **建売ではこの列は `application`（申込み）である。**
 *        契約は 01JP74NGRTT95X4Z8AQZ2QK2PW（＋仲介 01JV6AVXQMJY6XR4STWCHNKVE0）。
 *        ⚠️ つまり**契約数として申込み数が出ていた。**
 *        ⚠️ 実測（2026-09-14 / 8,321件）で **435件 → 473件に増える。**
 *          申込み日が空でも契約日が入っている顧客がいるため。
 *
 *   ② 販促費を事業で絞っていなかった。
 *      旧: WHERE response_medium = 0 のみ
 *      ⚠️ 建売の画面に**注文事業の広告費まで乗り**、単価が実際より高く出ていた。
 *
 * ⚠️ `staff` は返さない。CustomerKaeru.tsx は一度も使っていない
 *   （人員数を出すのは店舗ランキングの画面）。
 *
 * ⚠️ 列と別名は shop/queries.ts の spec と揃えてある。KPI の判定を
 *   ShopKaeru.tsx と同じにするため。食い違うと店舗別と媒体別で合計が合わない。
 * ─────────────────────────────────────────────
 */

// 店舗
$sql_shop = "SELECT shop, section
        FROM shop_list WHERE division = '建売分譲事業' AND show_flag = 1";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 営業課
$sql_section = "SELECT name FROM section_list WHERE division = '建売分譲事業'";
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
-- ⚠️ 2026-09-22 追加。⚠️ **ホームページ反響かどうかの判定に使う。**
--   ⚠️ CustomerTrendKaeru.tsx と同じ判定にするため（利用者の指示）。
--   ⚠️ ⚠️ **② の customer/queries.ts にも同じ行を足してあること。**
COALESCE(hp_campaign, '') as hp_campaign,
COALESCE(step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '') as contract,
COALESCE(step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '') as contract_broker,
COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as application,
COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '') as contact,
COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
COALESCE(reserved_interview, '') as reserved_interview,
COALESCE(status , '') as status
FROM master_data_kaeru WHERE show_dashboard = 1";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute();
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
// ⚠️ 全件をそのまま行にする（ShopTrendKaeru.tsx と同じ扱い）。
//   ⚠️ medium_kaeru に `list_medium` 列は無い。フロントで絞らないこと。
$sql_medium = "SELECT * FROM medium_kaeru";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 販促費。⚠️ 事業で絞ること（上の ② 参照）
$sql_budget = "SELECT * FROM budget WHERE response_medium = 0 AND section = 'spec'";
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
