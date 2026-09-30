<?php

$id = $data['id'] ?? '';
$ice_world = $data['ice_world'] ?? '';

if ($id !== '') {
    $sql = "UPDATE master_data SET ice_world = ? WHERE id = ?";
    $stmt = $pdo->prepare($sql);

    $stmt->execute([$ice_world, $id]);

    $result = [
        "status" => "success"
    ];

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    exit;
}

/**
 * ⚠️⚠️ **`SELECT *` にしないこと**（2026-09-30 / v2.2.155 で修正）。
 *
 * ⚠️ ⚠️ **`master_data` は 186列 × 25,670行ある。**
 *   ⚠️⚠️ **全件・全列を返そうとして PHP がメモリを使い切っていた**
 *     （⚠️ `Allowed memory size of 134217728 bytes exhausted`）。
 *   ⚠️ ⚠️ **応答がHTMLのエラーになるため、画面側は `data.customer` が
 *     ⚠️ undefined になり、`.find` で落ちていた。**
 *
 * ⚠️⚠️ **列は IceWorld.tsx が読むものだけ。** ⚠️ 増やすときは転送量を意識すること。
 * ⚠️ ⚠️ **`show_dashboard = 1` で絞る**（⚠️ 他の画面と同じ。⚠️ 削除済みは出さない）。
 */
$sql = "SELECT
    id,
    COALESCE(ice_world, '') AS ice_world,
    COALESCE(customer_contacts_name, '') AS customer_contacts_name,
    COALESCE(in_charge_store, '') AS in_charge_store,
    COALESCE(in_charge_user, '') AS in_charge_user,
    COALESCE(sales_promotion_name, '') AS sales_promotion_name,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS customized_input_01J82Z5F366ZQ897PXWF6H5ZAM,
    COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') AS step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
    COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') AS step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7
  FROM master_data
 WHERE show_dashboard = 1";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "customer" => $response
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
