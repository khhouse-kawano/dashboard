<?php
try {
    $sql = "INSERT INTO company_achievement (period, category, name, value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $data['period'],
        $data['category'],
        $data['name'],
        $data['value']
    ]);

    echo json_encode([
        'status' => 'success'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'データの保存に失敗しました。',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}