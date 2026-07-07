<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
$staff = isset($data['staff']) ? $data['staff'] : "";
$section = isset($data['section']) ? $data['section'] : "";
$shop = isset($data['shop']) ? $data['shop'] : "";
$register = isset($data['register']) ? $data['register'] : "";
$rank = isset($data['rank']) ? $data['rank'] : "";

    // 本番サーバーデータベース接続 (PDO)
    $dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
    $db_user = 'xs200571_kawano';
    $db_password = '4081kawano';


try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "SELECT id, shop, staff, name, register, reserve, rank, sales_meeting, status
    FROM customers WHERE shop LIKE ? AND staff LIKE ? AND section LIKE ? AND (rank LIKE ? OR sales_meeting LIKE ?) AND staff <> '' AND shop <> ''
    ORDER BY register ASC;";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(["%{$shop}%", "%{$staff}%", "%{$section}%", "%{$rank}%", "%{$rank}%"]);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($customers, JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
?>
