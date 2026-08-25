<?php

/**
 * 顧客データセットの取得（フロントエンドでの集計・描画用）。
 *
 * リクエスト例:
 *   { "request": "customer_dataset" }
 *   ヘッダ: Token: <staff.api_token>
 *
 * 約24,000件・8.7MB のレスポンスになる。
 * full_address（住所）を含むため、認証を必須としている。
 *
 * ※ このデータをそのまま Claude に渡すことはできない（約366万トークン相当）。
 *   分析に使う場合は core/kpi.php の集計を経由すること。
 */

require_once __DIR__ . '/../core/authz.php';

try {
    // -----------------------------------------------------------------
    // 1. 認証
    //    住所を含む個人情報を一括で返すため、未認証では返さない。
    // -----------------------------------------------------------------
    // 認証（誰か）と認可（Master権限か）をまとめて確認する。
    // フロントでボタンを隠すだけでは、APIを直接叩かれると防げない。
    $staff = requireMaster($pdo, $headers);

    // -----------------------------------------------------------------
    // 2. 取得
    //    列名が customized_input_* / step_migration_item_* と機械的なため、
    //    フロントで扱いやすいよう意味のある別名を付けている。
    // -----------------------------------------------------------------
    $sql = "SELECT
                in_charge_store                                 AS shop,
                in_charge_user                                  AS staff,
                full_address,
                sales_promotion_name,
                status,
                customized_input_01J82Z5F366ZQ897PXWF6H5ZAM     AS customer_rank,
                customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN     AS customer_demand,
                customer_contacts_annual_income,
                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99  AS registered_date,
                step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7  AS interview_date,
                step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0  AS next_interview_date,
                step_migration_item_01J82Z5F1RR18Z792C7KZS88QG  AS contract_date
              FROM master_data";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(
        [
            'status' => 'ok',
            'count'  => count($rows),
            'rows'   => $rows,
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

} catch (Throwable $e) {
    http_response_code(500);
    error_log('customer_dataset failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => 'データの取得に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
