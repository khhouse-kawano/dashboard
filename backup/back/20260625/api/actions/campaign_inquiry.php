<?php
header("Content-Type: application/json");
$data = json_decode(file_get_contents("php://input"), true);
$demand = isset($data['demand']) ? $data['demand'] : "";
try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = "SELECT inquiry_date as period, brand, hp_campaign as name FROM inquiry_customer WHERE hp_campaign <> ''";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
