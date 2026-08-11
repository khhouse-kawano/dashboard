<?php

$function = $data['function'] ?? '';

if ($function && $function === 'load') {

    $sql_summary = "SELECT * FROM smile2026";
    $stmt_summary = $pdo->prepare($sql_summary);
    $stmt_summary->execute();
    $response_summary = $stmt_summary->fetchAll(PDO::FETCH_ASSOC);

    $result = [
        "summary" => $response_summary,
    ];

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

if ($function && $function === 'update') {

    $id = $data['id'] ?? null;

    if (!$id) {
        echo json_encode(['status' => 'error', 'message' => 'IDが指定されていません'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 更新を許可するカラムのホワイトリスト（追加した remarks なども含む）
    $allowed_columns = [
        'time', 'date', 'name', 'zip', 'address', 'street', 
        'phone', 'age', 'adult', 'child', 'house', 'interview', 
        'medium', 'area', 'question', 'status', 
        'check_in_time', 'check_out_time', 'remarks'
    ];

    $update_fields = [];
    $params = [':id' => $id];

    // 送られてきたデータの中に、許可されたカラム名が存在するかチェック
    foreach ($allowed_columns as $column) {
        if (array_key_exists($column, $data)) {
            $update_fields[] = "{$column} = :{$column}";
            $params[":{$column}"] = $data[$column];
        }
    }

    // 更新対象のデータがない場合は処理を終了
    if (empty($update_fields)) {
        echo json_encode(['status' => 'error', 'message' => '更新するデータがありません'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // カンマ区切りでSET句を作成 (例: "name = :name, remarks = :remarks")
    $set_clause = implode(', ', $update_fields);
    
    $sql = "UPDATE smile2026 SET {$set_clause} WHERE id = :id";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        echo json_encode(['status' => 'success', 'message' => '更新が完了しました'], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        // エラーハンドリング
        echo json_encode(['status' => 'error', 'message' => 'DBエラー: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    
    exit;
}
