<?php
header("Content-Type: application/json");
$data = json_decode(file_get_contents("php://input"), true);
$demand = isset($data['demand']) ? $data['demand'] : "";

try {
    $sql = "SELECT * FROM shop_list WHERE report_flag = 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
