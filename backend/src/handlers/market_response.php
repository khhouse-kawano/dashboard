<?php

/**
 * 市況分析：反響・来場・契約（自社CRM）
 *
 * 注文住宅は master_data、建売は master_data_kaeru から取る。
 * どちらも参照のみで、書き換えは一切しない。
 *
 * ── ステップ項目のIDについて ──────────────────────────────
 * 同じカラムIDが2テーブルで別の意味を持つ点に注意。取り違えると
 * 「契約」のつもりで「申し込み」を数えてしまう。
 *
 *   01J82Z5F13B6QVM6X0TCWZHW99  反響取得日        （両テーブル共通）
 *   01J82Z5F1GQB02S1DEBZPBFDW7  初回面談          （両テーブル共通）
 *   01J82Z5F1RR18Z792C7KZS88QG  master_data=契約日 / master_data_kaeru=申し込み日
 *   01JP74NGRTT95X4Z8AQZ2QK2PW  master_data=2回目以降面談 / master_data_kaeru=自社契約日
 *
 * 建売の「契約」は自社契約日（01JP74…）を採用する。
 * 仲介契約（01JV6AVX…）は e-Stat の分譲着工を分母にしたシェア計算の
 * 分子に対応しないため含めない。
 * ────────────────────────────────────────────────
 *
 * 返す列は集計に必要な最小限に絞る。氏名・電話番号などは含めない。
 */

require_once __DIR__ . '/../core/market.php';

const MARKET_STEP_REGISTER = 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99';
const MARKET_STEP_VISIT    = 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7';
const MARKET_STEP_CONTRACT_ORDER = 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG';
const MARKET_STEP_CONTRACT_SPEC  = 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW';

$register = marketTextDateExpr(MARKET_STEP_REGISTER);
$visit    = marketTextDateExpr(MARKET_STEP_VISIT);

$sql = "
    SELECT
      '注文'                                   AS category,
      {$register}                              AS register,
      {$visit}                                 AS visit,
      " . marketTextDateExpr(MARKET_STEP_CONTRACT_ORDER) . " AS contract,
      COALESCE(TRIM(full_address), '')         AS address,
      COALESCE(TRIM(sales_promotion_name), '') AS medium,
      COALESCE(TRIM(in_charge_store), '')      AS shop,
      COALESCE(TRIM(in_charge_user), '')       AS staff
    FROM master_data
    WHERE show_dashboard = 1

    UNION ALL

    SELECT
      '建売'                                   AS category,
      {$register}                              AS register,
      {$visit}                                 AS visit,
      " . marketTextDateExpr(MARKET_STEP_CONTRACT_SPEC) . " AS contract,
      COALESCE(TRIM(full_address), '')         AS address,
      COALESCE(TRIM(sales_promotion_name), '') AS medium,
      COALESCE(TRIM(in_charge_store), '')      AS shop,
      COALESCE(TRIM(in_charge_user), '')       AS staff
    FROM master_data_kaeru
    WHERE show_dashboard = 1";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    marketRespond($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (PDOException $e) {
    http_response_code(500);
    error_log('market_response: ' . $e->getMessage());
    marketRespond(['status' => 'error', 'message' => '反響データの取得に失敗しました。']);
}
