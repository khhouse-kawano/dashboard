<?php
try {
    $sql = "SELECT * FROM customers_estate WHERE id = ?";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id']]);
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
