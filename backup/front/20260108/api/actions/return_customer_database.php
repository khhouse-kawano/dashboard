<?php
try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "UPDATE customers SET trash = 1 WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    if ($stmt->execute([$data['id']])) {
        echo json_encode(["message" => "success", "details" => "顧客情報を一覧に戻しました"]);
    } else {
        echo json_encode(["message" => "error", "details" => "更新に失敗しました"]);
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
