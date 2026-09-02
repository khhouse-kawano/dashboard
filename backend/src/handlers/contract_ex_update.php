<?php
try {
    $sql = "
        INSERT INTO contract_expected (`date`, `section`, `shop`, `count`)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            `count` = VALUES(`count`)
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $data['date'],
        $data['section'],
        $data['shop'],
        $data['count']
    ]);

    echo json_encode(['status' => 'success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
