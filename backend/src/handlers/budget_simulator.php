<?php

/**
 * 広告費シミュレーター（frontend/src/components/header/BudgetSimulator.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-14 に作り直した。以前とは返す形が全く違う。**
 *   旧版は契約数と目標だけを返しており、単価の算出に必要な列が無かった
 *   （販促媒体・来場・次アポ、建売はコメントアウト）。
 *
 * ⚠️⚠️ **backend-express/src/features/budgetSimulator/ と同じ形にしておくこと。**
 *   こちらは ② への転送が失敗したときのフォールバックである。
 *   形が違うと、転送が失敗した瞬間に画面が壊れる（しかも普段は動くので
 *   気づくのが遅れる）。
 *
 * ⚠️ 集計はしない。行を返すだけで、KPI の判定はフロントが行う。
 *   店舗ランキング（ShopOrder / ShopKaeru）と同じ判定を使い、
 *   数字を食い違わせないため。
 *
 * ⚠️ 顧客IDや氏名は返さない。画面に出さないうえ、数万行を返す API なので
 *   列を増やすと素直に重くなる。
 * ─────────────────────────────────────────────
 */

/** 事業ごとの設定。⚠️ Express 側の DIVISION / BUDGET_SECTION と揃えること */
$divisions = [
    'order' => ['division' => '注文事業', 'budget_section' => 'order'],
    'spec'  => ['division' => '建売分譲事業', 'budget_section' => 'spec'],
];

// ⚠️ 同じフェーズ列が事業ごとに別の意味を持つ。列名から推測しないこと。
//   step_migration_item_01J82Z5F1RR18Z792C7KZS88QG は
//     order → contract（契約） / spec → application（申し込み）
$customer_sql = [
    'order' => "SELECT
        COALESCE(in_charge_store, '') as shop,
        COALESCE(sales_promotion_name, '') as medium,
        COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
        COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
        COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
        COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
        COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as contract,
        COALESCE(status, '') as status
        FROM master_data WHERE show_dashboard = 1",
    'spec' => "SELECT
        COALESCE(in_charge_store, '') as shop,
        COALESCE(sales_promotion_name, '') as medium,
        COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
        COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '') as contact,
        COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
        COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
        COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as application,
        COALESCE(step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '') as contract,
        COALESCE(step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '') as contract_broker,
        COALESCE(status, '') as status
        FROM master_data_kaeru WHERE show_dashboard = 1",
];

// ⚠️ order は show_flag で絞らない（店舗ランキングと揃える）。spec だけ絞る
$shop_sql = [
    'order' => "SELECT id, brand, shop, section, area, division
        FROM shop_list WHERE division = ?",
    'spec'  => "SELECT id, brand, shop, section, area, division
        FROM shop_list WHERE division = ? AND show_flag = 1",
];

$result = ['status' => 'ok'];

foreach ($divisions as $key => $conf) {
    // 店舗
    $stmt_shop = $pdo->prepare($shop_sql[$key]);
    $stmt_shop->execute([$conf['division']]);
    $response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

    // 営業課
    $stmt_section = $pdo->prepare("SELECT name FROM section_list WHERE division = ?");
    $stmt_section->execute([$conf['division']]);
    $response_section = $stmt_section->fetchAll(PDO::FETCH_ASSOC);

    // 顧客
    $stmt_customer = $pdo->prepare($customer_sql[$key]);
    $stmt_customer->execute();
    $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

    // 販促費。⚠️ medium も返すこと。媒体別の広告費を出すのに要る
    $stmt_budget = $pdo->prepare(
        "SELECT shop, medium, budget_period, budget_value
           FROM budget WHERE response_medium = 0 AND section = ?"
    );
    $stmt_budget->execute([$conf['budget_section']]);
    $response_budget = $stmt_budget->fetchAll(PDO::FETCH_ASSOC);

    // 契約目標。
    // ⚠️⚠️ 事業区分の列が無いので**事業で絞らず全件返す。** 店舗名での突合は
    //   フロントが行う。SQL で JOIN すると shop_list に無い店舗名の目標が静かに消える。
    // ⚠️ category は 'shop' だけ。'staff'（担当者別）を混ぜると二重に積み上がる。
    // ⚠️ period は 'YYYY-MM'（ハイフン）。画面の月は 'YYYY/MM' なので変換が要る。
    $stmt_achievement = $pdo->prepare(
        "SELECT name, period, value FROM company_achievement WHERE category = 'shop'"
    );
    $stmt_achievement->execute();
    $response_achievement = $stmt_achievement->fetchAll(PDO::FETCH_ASSOC);

    // ⚠️ キーの順序も Express と揃えている
    $result[$key] = [
        'shop' => $response_shop,
        'section' => $response_section,
        'customer' => $response_customer,
        'budget' => $response_budget,
        'achievement' => $response_achievement,
    ];
}

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
