<?php

try {
    $rank = $data['rank'] ?? '';
    $rankPeriod = $data['rank_period'] ?? '';

    $setParts = [];
    $params = [];

    // rank が空文字でなければ更新対象にする
    if ($rank !== '') {
        $setParts[] = "customized_input_01J82Z5F366ZQ897PXWF6H5ZAM = :rank";
        $params[':rank'] = $rank;
    }

    // rank_period が空文字でなければ更新対象にする
    if ($rankPeriod !== '') {
        $setParts[] = "rank_period = :rank_period";
        $params[':rank_period'] = $rankPeriod;
    }

    // どちらも空なら UPDATE しない
    if (empty($setParts)) {
        echo json_encode([
            'status' => 'no_update',
            'message' => '更新対象がありません'
        ]);
        exit;
    }

    $sql = "UPDATE master_data SET " . implode(", ", $setParts) . " WHERE id = :id";
    $params[':id'] = $data['id'];

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $newSql = "SELECT id,
    customer_contacts_name as customer,
    in_charge_store as shop,
    in_charge_user as staff,
    customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
    step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
    step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
    step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
    status,
    rank_period FROM master_data
    WHERE show_dashboard = 1";

    $select = $pdo->prepare($newSql);
    $select->execute();
    $customers = $select->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'newCustomers' => $customers
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => '更新エラー: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
