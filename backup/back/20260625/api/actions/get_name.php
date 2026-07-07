<?php
try {

    $sql = "SELECT name FROM staff WHERE api_token = ?";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['api_token']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
