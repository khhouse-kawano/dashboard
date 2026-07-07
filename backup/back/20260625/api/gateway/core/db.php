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

// ==========================================
// ▼ ここからデータの受け取り方を分岐させる ▼
// ==========================================
$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';

if (strpos($contentType, "multipart/form-data") !== false) {
    // FormData (PDFファイルアップロードなど) で送られてきた場合
    $data = $_POST;
} else {
    // 従来通り JSON で送られてきた場合
    $data = json_decode(file_get_contents("php://input"), true);
}
// ==========================================
// ▲ ここまで ▲
// ==========================================

$request = isset($data['request']) ? $data['request'] : "";
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
$pdo = new PDO($dsn, $db_user, $db_password);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
