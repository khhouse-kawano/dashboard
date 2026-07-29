<?php
try {
    // 前提チェック
    if (!isset($pdo) || !isset($data) || !isset($data['id'])) {
        throw new Exception('内部エラー: 必要なパラメータが不足しています。');
    }

    $id = $data['id'];

    // interview_sheet の存在確認
    $sql = "SELECT 1 FROM interview_sheet WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);

    // interview_log の取得（$data 優先、なければ $_POST）
    $logs = $data['interview_log'] ?? $_POST['interview_log'] ?? [];
    if (!is_array($logs)) {
        $logs = json_decode($logs, true) ?: [];
    }

    // 結果をまとめるための変数（最終的に一度だけ出力）
    $finalResponse = null;

    if ($stmt->rowCount() > 0) {
        $updateSql = 'UPDATE interview_sheet SET interview_log = :interview_log, shop = :shop WHERE id = :id';
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->bindValue(':interview_log', json_encode($data['interview_log']), PDO::PARAM_STR);
        $updateStmt->bindValue(':shop', $data['shop'], PDO::PARAM_STR);
        $updateStmt->bindValue(':id', $id, PDO::PARAM_STR);
        if ($updateStmt->execute()) {
            $finalResponse = ['status' => 'success', 'message' => $data['name'] . '様の面談記録の登録に成功しました。'];
        } else {
            $finalResponse = ['status' => 'error', 'message' => $data['name'] . '様の面談記録の登録に失敗しました。'];
        }
    } else {
        $insertSql = 'INSERT INTO interview_sheet (id, shop, name, interview_log) VALUES (:id, :shop, :name, :interview_log)';
        $insertStmt = $pdo->prepare($insertSql);
        $insertStmt->bindValue(':id', $id, PDO::PARAM_STR);
        $insertStmt->bindValue(':shop', $data['shop'], PDO::PARAM_STR);
        $insertStmt->bindValue(':name', $data['name'], PDO::PARAM_STR);
        $insertStmt->bindValue(':interview_log', json_encode($data['interview_log']), PDO::PARAM_STR);
        if ($insertStmt->execute()) {
            $finalResponse = ['status' => 'success', 'message' => $data['name'] . '様の面談記録のアップデートに成功しました。'];
        } else {
            $finalResponse = ['status' => 'error', 'message' => $data['name'] . '様の面談記録の登録に失敗しました。'];
        }
    }

    echo json_encode($finalResponse, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    $response = [
        'status' => 'error',
        'message' => '登録エラー: ' . $e->getMessage()
    ];
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    $response = [
        'status' => 'error',
        'message' => 'エラー: ' . $e->getMessage()
    ];
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
