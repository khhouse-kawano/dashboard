<?php
try {
    $sql = "SELECT * FROM call_sheet WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id']]);

    if ($stmt->rowCount() > 0) {
        $updateSql = 'UPDATE call_sheet SET call_log = :call_log, status = :status, shop = :shop, reserved_status = :reserved_status WHERE id = :id';
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->bindValue(':call_log', json_encode($data['call_log']), PDO::PARAM_STR);
        $updateStmt->bindValue(':shop', $data['shop'], PDO::PARAM_STR);
        $updateStmt->bindValue(':status', $data['status'], PDO::PARAM_STR);
        $updateStmt->bindValue(':reserved_status', $data['reserved_status'], PDO::PARAM_STR);
        $updateStmt->bindValue(':id', $data['id'], PDO::PARAM_STR);
        if ($updateStmt->execute()) {
            $response = ['status' => 'success', 'message' => $data['name'] . 'の登録に成功しました。'];
            echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            $response = ['status' => 'error', 'message' => $data['name'] . 'の登録に失敗しました。'];
            echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } else {
        $insertSql = 'INSERT INTO call_sheet (id, shop, name, call_log, status, reserved_status) VALUES (:id, :shop, :name, :call_log, :status, :reserved_status)';
        $insertStmt = $pdo->prepare($insertSql);
        $insertStmt->bindValue(':id', $data['id'], PDO::PARAM_STR);
        $insertStmt->bindValue(':shop', $data['shop'], PDO::PARAM_STR);
        $insertStmt->bindValue(':name', $data['name'], PDO::PARAM_STR);
        $insertStmt->bindValue(':status', $data['status'], PDO::PARAM_STR);
        $insertStmt->bindValue(':reserved_status', $data['reserved_status'], PDO::PARAM_STR);
        $insertStmt->bindValue(':call_log', json_encode($data['call_log']), PDO::PARAM_STR);
        if ($insertStmt->execute()) {
            $response = ['status' => 'success', 'message' => $data['name'] . 'のアップデートに成功しました。'];
            echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            $response = ['status' => 'error', 'message' => $data['name'] . 'の登録に失敗しました。'];
            echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
} catch (PDOException $e) {
    $response = [
        'status' => 'error',
        'message' => '登録エラー: ' . $e->getMessage()
    ];
}
