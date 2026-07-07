<?php
// CORSヘッダー（共通）
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);
$demand = isset($data['demand']) ? $data['demand'] : "";
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
// // ローカルデータベース接続 (PDO)
// $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=owners_house;charset=utf8';
// $db_user = 'root';
// $db_password = '';

// 本番サーバーデータベース接続 (PDO)
$dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
$db_user = 'xs200571_kawano';
$db_password = '4081kawano';

try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "SELECT step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as registered,
    first_interviewed_date as visit,
    step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
    in_charge_store as shop,
    in_charge_user as staff,
    customer_contacts_name as name,
    customer_contacts_mobile_phone_number as phone,
    customer_contacts_email as mail
      FROM master_data WHERE brand = 'デイジャストハウス'";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
