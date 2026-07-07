<?php

try {
    $rank = $data['rank'] ?? '';
    $rankPeriod = $data['rank_period'] ?? '';

    $setParts = [];
    $params = [];

    // rank が空文字でなければ更新対象にする
    if ($rank !== '') {
        $setParts[] = "rank = :rank";
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

    $sql = "UPDATE customers SET " . implode(", ", $setParts) . " WHERE id = :id";
    $params[':id'] = $data['id'];

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $masterSql = "UPDATE master_data 
    SET customized_input_01J82Z5F366ZQ897PXWF6H5ZAM = :rank 
    WHERE id = :id";

    $params = [
        ':rank' => $rank,
        ':id'   => $data['id']
    ];

    $masterStmt = $pdo->prepare($masterSql);
    $masterStmt->execute($params);


    $newSql = "SELECT 
    id, 
    name, 
    status, 
    medium, 
    rank, 
    register, 
    reserve, 
    shop, 
    medium, 
    estate, 
    meeting, 
    appointment, 
    line_group, 
    screening, 
    rival, 
    period, 
    survey, 
    budget, 
    importance, 
    note, 
    staff, 
    section, 
    contract, 
    sales_meeting,
    trash,
    rank_period FROM customers ORDER BY register DESC;";
    $select = $pdo->prepare($newSql);
    $select->execute();
    $customers = $select->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'customers' => $customers
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => '更新エラー: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
