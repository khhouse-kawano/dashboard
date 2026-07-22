<?php

$originalId = $data['id'] ?? null;
$newId = $data['newId'] ?? null;

// バリデーション
if (!$originalId || !$newId) {
    http_response_code(400); // 400 Bad Request
    echo json_encode(["status" => "error", "message" => "必要なIDが送信されていません"]);
    exit;
}

try {
    // 2. コピー元の顧客データを取得 (FETCH_ASSOC でキーと値の連想配列として取得)
    $stmt = $pdo->prepare("SELECT * FROM master_data_kaeru WHERE id = :id");
    $stmt->execute([':id' => $originalId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "対象の顧客が見つかりません"]);
        exit;
    }

    // 3. IDを上書きする (スプレッド構文 {...row, id: newId} と同じ感覚)
    $row['id'] = $newId;
    unset($row['no']);
    // 4. 動的にINSERT文を生成する
    // 例: INSERT INTO table (id, name, ...) VALUES (:id, :name, ...)
    $columns = array_keys($row);
    $placeholders = array_map(function($col) { return ':' . $col; }, $columns);

    $sql = sprintf(
        "INSERT INTO master_data_kaeru (%s) VALUES (%s)",
        implode(', ', $columns),
        implode(', ', $placeholders)
    );

    // 5. 複製したデータを挿入
    $insertStmt = $pdo->prepare($sql);
    $insertStmt->execute($row);

    // 6. 成功レスポンスを返す
    echo json_encode(["status" => "success"]);

} catch (PDOException $e) {
    // DBエラー時 (プライマリキー重複など) は500エラーとして返す
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "データベースエラー: " . $e->getMessage()]);
    exit;
}