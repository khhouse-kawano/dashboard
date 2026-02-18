<?php
try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "INSERT INTO breakaway (brand, campaign, time, filled) VALUES (?, ?, ?, ?)";
    $stmt = $pdo->prepare($sql);
    $success = $stmt->execute([$data['brand'], $data['campaign'], $data['time'], $data['filled']]);

    if ($success) {
        echo json_encode([
            "message" => "success",
            "details" => "データベースに追加しました",
            "inserted" => [
                "brand"    => $data['brand'],
                "campaign" => $data['campaign'],
                "time"     => $data['time'],
                "filled"   => $data['filled']
            ]
        ]);
    } else {
        echo json_encode([
            "message" => "error",
            "details" => "データベースへの追加に失敗しました"
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
