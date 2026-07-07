<?php
try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "SELECT * FROM households_c";
    $stmt = $pdo->prepare($sql);
    if ($stmt->execute()) {
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        echo json_encode(["message" => "error", "details" => "更新に失敗しました"]);
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
