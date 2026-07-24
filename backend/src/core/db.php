<?php
// CORSヘッダー（共通）
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, Token");
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

$host = getenv('DB_HOST');
$db   = getenv('DB_NAME');
$user = getenv('DB_USER');
$pass = getenv('DB_PASS');

$dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error', 
        'message' => 'データベース接続に失敗しました: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}