<?php
// ==========================================
// 既存のゲートウェイの $request 分岐の中に組み込んでください
// ==========================================

$payload = isset($data['data']) ? $data['data'] : null;

if (!$payload) {
    echo json_encode(['status' => 'error', 'message' => '明細データ（data）が含まれていません。']);
    exit;
}

$postId = isset($payload['id']) ? trim($payload['id']) : '';

if ($postId === '') {
    echo json_encode(['status' => 'skipped', 'message' => 'POST ID が空文字のためスキップしました。']);
    exit;
}

try {
    // ------------------------------------------
    // 2. 既存データのチェック
    // ------------------------------------------
    // ★修正点1: idだけでなく、既存のデータ状況を確認するために SELECT * に変更します
    $stmt = $pdo->prepare("SELECT * FROM master_data_kaeru WHERE id LIKE :like_id LIMIT 1");
    $stmt->execute(['like_id' => '%' . $postId . '%']);
    $existingRow = $stmt->fetch();

    if ($existingRow) {
        // ------------------------------------------
        // 【UPDATE処理】 既存レコードありの場合
        // ------------------------------------------
        $dbId = $existingRow['id'];
        
        $updateFields = [];
        $updateParams = [];
        
        foreach ($payload as $key => $value) {
            if ($key === 'id') continue;
            
            // ★修正点2: 既存データを最優先し、DB側が空のときのみ更新するロジック★

            // 1. POSTされたCSVの値が「空文字/NULL」ではないか？
            $hasNewValue = ($value !== '' && $value !== null);
            
            // 2. DBの該当カラムが「空文字/NULL」か？（すでに値が入っていないか？）
            // ※念のため配列キーが存在するかチェックしてから判定します
            $dbValue = array_key_exists($key, $existingRow) ? $existingRow[$key] : null;
            $isDbEmpty = ($dbValue === '' || $dbValue === null);
            
            // 「POSTデータに値が存在する」 かつ 「DB側の該当カラムが空である」 場合のみ更新対象にする
            if ($hasNewValue && $isDbEmpty) {
                $updateFields[] = "`{$key}` = :{$key}";
                $updateParams[$key] = $value;
            }
        }
        
        // 更新する項目がある場合のみ実行
        if (count($updateFields) > 0) {
            $updateParams['dbId'] = $dbId; // WHERE句用のID
            
            $sql = "UPDATE master_data_kaeru SET " . implode(', ', $updateFields) . " WHERE id = :dbId";
            $updateStmt = $pdo->prepare($sql);
            $updateStmt->execute($updateParams);
            
            echo json_encode(['status' => 'success', 'action' => 'updated', 'message' => '空のカラムにデータを追加更新しました。']);
        } else {
            // 更新対象が一つもなかった（全てDB側に値が入っていた、またはCSV側が空だった）場合
            echo json_encode(['status' => 'skipped', 'action' => 'none', 'message' => '既存データが優先されたため、更新をスキップしました。']);
        }
        exit;
        
    } else {
        // ------------------------------------------
        // 【INSERT処理】 新規レコードの場合 (前回から変更なし)
        // ------------------------------------------
        $characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $randomPart = '';
        for ($i = 0; $i < 16; $i++) {
            $randomPart .= $characters[rand(0, strlen($characters) - 1)];
        }
        $newId = '01' . $randomPart . $postId;
        
        $insertFields = ['`id`'];
        $insertPlaceholders = [':id'];
        $insertParams = ['id' => $newId];
        
        foreach ($payload as $key => $value) {
            if ($key === 'id') continue;
            $insertFields[] = "`{$key}`";
            $insertPlaceholders[] = ":{$key}";
            $insertParams[$key] = $value;
        }
        
        $sql = "INSERT INTO master_data_kaeru (" . implode(', ', $insertFields) . ") VALUES (" . implode(', ', $insertPlaceholders) . ")";
        $insertStmt = $pdo->prepare($sql);
        $insertStmt->execute($insertParams);
        
        echo json_encode(['status' => 'success', 'action' => 'inserted', 'new_id' => $newId, 'message' => '新規登録しました。']);
        exit;
    }

} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'データベースエラーが発生しました: ' . $e->getMessage()]);
    exit;
}