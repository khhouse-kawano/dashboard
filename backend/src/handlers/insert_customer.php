<?php
// 1. JSONデータを配列として受け取る
$payload = json_decode(file_get_contents('php://input'), true);
$rawData = $payload['data'] ?? [];

if (empty($rawData)) {
    echo json_encode(['status' => 'error', 'message' => 'データが空です']);
    exit;
}

try {
    $cleanedData = [];
    
    // 2. カラム名（キー）の前後のスペースを削除して整理する
    foreach ($rawData as $key => $value) {
        $cleanedKey = trim($key); // CSVのヘッダーにあった余分なスペースを消す
        if ($cleanedKey !== '') {
            $cleanedData[$cleanedKey] = $value;
        }
    }

    $columns = array_keys($cleanedData);
    
    // 3. カラム名をバッククォートで囲む（予約語対策）
    $safeColumns = array_map(function($col) { return '`' . $col . '`'; }, $columns);
    
    // 4. カラムの数だけ「?」を生成する（例: ?, ?, ?, ?）
    $placeholders = array_fill(0, count($columns), '?');
    
    // 5. INSERT文の組み立て
    $sql = sprintf(
        "INSERT INTO master_data_resale (%s) VALUES (%s)",
        implode(', ', $safeColumns),
        implode(', ', $placeholders)
    );
    
    $stmt = $pdo->prepare($sql);
    
    // 6. データのバインド（「?」の場合は 1 から順番に番号を振る）
    $index = 1;
    foreach ($cleanedData as $value) {
        $stmt->bindValue($index++, $value);
    }
    
    // 7. 実行
    $stmt->execute();
    
    echo json_encode([
        'status'  => 'success',
        'message' => '登録が完了しました。',
        'id'      => $cleanedData['id'] ?? null
    ]);

} catch (PDOException $e) {
    // 一意制約違反（重複）の検知
    if ($e->getCode() == 23000) {
        echo json_encode([
            'status'  => 'duplicate',
            'message' => 'IDが重複しています。'
        ]);
    } else {
        echo json_encode([
            'status'  => 'error',
            'message' => 'データベースエラー: ' . $e->getMessage()
        ]);
    }
}