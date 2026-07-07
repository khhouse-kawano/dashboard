<?php
try {
    $sql = "SELECT * FROM master_data WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id']]);
    $rankSql = "SELECT rank_period FROM customers WHERE id = ?";
    $rankStmt = $pdo->prepare($rankSql);
    $rankStmt->execute([$data['id']]);
    if ($stmt->rowCount() > 0) {
        $information = $stmt->fetch(PDO::FETCH_ASSOC);
        $rank_period = $rankStmt->fetch(PDO::FETCH_ASSOC);
        $response =  ['master_data' => $information, 'customers' => $rank_period];
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        $response = [
            'status' => 'not_found',
            'message' => '該当するデータが見つかりませんでした'
        ];
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
} catch (PDOException $e) {
    $response = [
        'status' => 'error',
        'message' => '登録エラー: ' . $e->getMessage()
    ];
}
