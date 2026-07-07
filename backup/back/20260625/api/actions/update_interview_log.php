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
            $finalResponse = ['status' => 'success', 'message' => $data['name'] . 'の登録に成功しました。'];
        } else {
            $finalResponse = ['status' => 'error', 'message' => $data['name'] . 'の登録に失敗しました。'];
        }
    } else {
        $insertSql = 'INSERT INTO interview_sheet (id, shop, name, interview_log) VALUES (:id, :shop, :name, :interview_log)';
        $insertStmt = $pdo->prepare($insertSql);
        $insertStmt->bindValue(':id', $id, PDO::PARAM_STR);
        $insertStmt->bindValue(':shop', $data['shop'], PDO::PARAM_STR);
        $insertStmt->bindValue(':name', $data['name'], PDO::PARAM_STR);
        $insertStmt->bindValue(':interview_log', json_encode($data['interview_log']), PDO::PARAM_STR);
        if ($insertStmt->execute()) {
            $finalResponse = ['status' => 'success', 'message' => $data['name'] . 'のアップデートに成功しました。'];
        } else {
            $finalResponse = ['status' => 'error', 'message' => $data['name'] . 'の登録に失敗しました。'];
        }
    }

    // -----------------------
    // master_data 更新（既存ロジック）
    // -----------------------
    $actionMap = [
        '初回面談'         => 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
        '2回目以降面談'     => 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        '事前審査'         => 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
        'LINEグループ作成' => 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
        '契約'             => 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'
    ];

    $setParts = [];
    $params   = [];

    foreach ($logs as $log) {
        if (!is_array($log)) continue;
        $action = $log['action'] ?? null;
        $day    = $log['day'] ?? null;

        if ($action && isset($actionMap[$action])) {
            $column = $actionMap[$action];
            $setParts[] = "$column = ?";
            $params[]   = $day;
        }
    }

    if (!empty($setParts)) {
        $sql = "UPDATE master_data SET " . implode(', ', $setParts) . " WHERE id = ?";
        $params[] = $id;
        $stmt = $pdo->prepare($sql);
        if ($stmt->execute($params)) {
            // 上書きせず、既存の finalResponse を残しつつ補足情報を追加
            $finalResponse['master_data'] = ['status' => 'success', 'message' => 'master_data の更新に成功しました。'];
        } else {
            $finalResponse['master_data'] = ['status' => 'error', 'message' => 'master_data の更新に失敗しました。'];
        }
    } else {
        $finalResponse['master_data'] = ['status' => 'noop', 'message' => '更新対象の action がありませんでした。'];
    }

    // -----------------------
    // customers 更新（ユーザー要望）
    // -----------------------
    $customerActionMap = [
        '初回面談'         => 'reserve',
        '2回目以降面談'     => 'appointment',
        '事前審査'         => 'screening',
        'LINEグループ作成' => 'line_group',
        '契約'             => 'contract'
    ];

    $custSetParts = [];
    $custParams   = [];
    $shouldSetSecondReserve = false;

    foreach ($logs as $log) {
        if (!is_array($log)) continue;
        $action = $log['action'] ?? null;
        $day    = $log['day'] ?? null;

        if ($action && isset($customerActionMap[$action])) {
            $column = $customerActionMap[$action];
            $custSetParts[] = "$column = ?";
            $custParams[]   = $day;

            if (in_array($action, ['2回目以降面談', '事前審査', '契約'], true)) {
                $shouldSetSecondReserve = true;
            }
        }
    }

    if ($shouldSetSecondReserve) {
        $custSetParts[] = "second_reserve = ?";
        $custParams[]   = '次回来場';
    }

    if (!empty($custSetParts)) {
        $custSql = "UPDATE customers SET " . implode(', ', $custSetParts) . " WHERE id = ?";
        $custParams[] = $id;
        $custStmt = $pdo->prepare($custSql);
        if ($custStmt->execute($custParams)) {
            $finalResponse['customers'] = ['status' => 'success', 'message' => 'customers の更新に成功しました。'];
        } else {
            $finalResponse['customers'] = ['status' => 'error', 'message' => 'customers の更新に失敗しました。'];
        }
    } else {
        $finalResponse['customers'] = ['status' => 'noop', 'message' => 'customers の更新対象の action がありませんでした。'];
    }

    // 最終レスポンスを一度だけ出力
    echo json_encode($finalResponse, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    // 本番では $e->getMessage() をそのまま返さない方が安全
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
