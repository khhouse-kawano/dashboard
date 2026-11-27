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

/**
 * GET で受けてよい request（v2.2.274）。⚠️ 参照だけの処理を足すこと。
 * ⚠️ 書き込みを伴う request を入れない（GET はリンク1つで送れてしまう）。
 * ⚠️ roll 付きは受けない（list の roll はすべて書き込み）。
 * v2.2.277: 'shopTrend'（店舗別反響推移）を足した。
 * v2.2.287: アクセス解析の読み取り4つ（期間 startDate / endDate を送る。⚠️ ② 専用。tracking_site_save は書き込みなので入れない）。
 * v2.2.289: database_list（顧客DB を1ページずつ。条件・ページを送る。⚠️ ② 専用）。
 * v2.2.294: call_status_summary（架電状況を期間で読む。from / to を送る。⚠️ ② 専用）。
 */
const GET_ALLOWED_REQUESTS = [
    'list', 'shopTrend', 'customerTrend', // ⚠️ customerTrend は v2.2.278
    'tracking_site_list', 'tracking_site_summary', 'tracking_detail', 'tracking_vendor_funnel', // ⚠️ v2.2.287
    'database_list', // ⚠️ v2.2.289 顧客DB（建売）を1ページずつ（② 専用）
    'call_status_summary', // ⚠️ v2.2.294 架電状況を期間で読む（② 専用）
    'company_year', // ⚠️ v2.2.300 全社報告用フォーマットを年度で読む（② 専用）
    'property_list', 'property_detail', 'property_suumo_latest', // ⚠️ v2.2.301 物件DB・詳細・SUUMO物件サマリー（② 専用）
    'table_definition', // ⚠️ v2.2.301 テーブル定義書（② 専用・Master）
    'duplicate_summary', 'rank_list', // ⚠️ v2.2.305 重複反響サマリー（② 専用）・ランクの月ごとの読み込み（② 専用。予備は POST の rank）
    'broker_ledger_list', // ⚠️ v2.2.308 媒介獲得台帳を30件ずつ（② 専用。予備は POST の broker:list）
    'satbase_page', // ⚠️ v2.2.309 SatBaseサマリーを30件ずつ（② 専用・Master。予備は POST の satbase_list）
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $getRequest = is_string($_GET['request'] ?? null) ? $_GET['request'] : '';
    $getRoll = $_GET['roll'] ?? '';
    // ⚠️ 許可していない GET は request を空にして index.php の 400（bad_request）に落とす
    $data = (in_array($getRequest, GET_ALLOWED_REQUESTS, true) && $getRoll === '') ? $_GET : [];
    // ⚠️ 顧客の個人情報を返すため、ブラウザや途中の機器に残させない
    header('Cache-Control: no-store');
} elseif (strpos($contentType, "multipart/form-data") !== false) {
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