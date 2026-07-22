<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

// --- 許可カラム（Node.js側の headerMap に準拠） ---
$allowedColumns = [
    'customer_id',
    'registered_at',
    'name',
    'name_kana',
    'email',
    'phone',
    'fax',
    'address',
    'staff',
    'follow_status',
    'first_reaction_date',
    'first_reaction_method',
    'first_reaction_media',
    'memo',
    'first_reaction_reserve_id',
    'first_reaction_id',
    'first_reaction_received_at',
    'first_reaction_type',
    'first_reaction_property_type',
    'first_reaction_property_code',
    'first_reaction_property_name',
    'first_reaction_property_price',
    'first_reaction_property_address',
    'latest_reaction_reserve_id',
    'latest_reaction_id',
    'latest_reaction_received_at',
    'latest_reaction_type',
    'latest_reaction_property_type',
    'latest_reaction_property_code',
    'latest_reaction_property_name',
    'latest_reaction_property_price',
    'latest_reaction_property_address',
    'first_visit_datetime',
    'first_visit_input_method',
    'first_visit_schedule_type',
    'first_visit_property_type',
    'first_visit_property_code',
    'first_visit_property_name',
    'first_visit_property_price',
    'first_visit_property_address',
    'latest_visit_datetime',
    'latest_visit_input_method',
    'latest_visit_schedule_type',
    'latest_visit_property_type',
    'latest_visit_property_code',
    'latest_visit_property_name',
    'latest_visit_property_price',
    'latest_visit_property_address',
    'contract_date',
    'contract_price',
    'contract_fee_status',
    'contract_fee_amount',
    'contract_additional_status',
    'contract_additional_amount',
    'contract_property_type',
    'contract_property_code',
    'contract_property_name',
    'contract_property_price',
    'contract_property_address',
    'contract_status',
    'reaction_count',
    'visit_count',
    'contract_flag',
    'remarks'
];

// --- ヘルパー: 許可カラムのみ抽出 ---
function filterAllowed(array $row, array $allowed): array
{
    $out = [];
    foreach ($allowed as $col) {
        $out[$col] = array_key_exists($col, $row) ? $row[$col] : null;
    }
    return $out;
}

// --- 正規化: 空文字->NULL, 数値キャスト ---
function normalizeRow(array $row): array
{
    // Node.js側で数値として扱っていたカラムや、金額系のカラム
    $numCols = ['reaction_count', 'visit_count', 'contract_flag', 'contract_fee_amount', 'contract_additional_amount'];

    foreach ($row as $k => $v) {
        if (is_string($v)) {
            $v = trim($v);
            // Excel出力などにありがちな先頭シングルクォートを除去
            if (strlen($v) > 0 && $v[0] === "'") {
                $v = ltrim($v, "'");
            }
        }

        // 空文字を NULL に
        if ($v === '') {
            $row[$k] = null;
            continue;
        }

        // 数値キャスト
        if (in_array($k, $numCols, true)) {
            if (is_string($v)) {
                $v = str_replace([',', '，', '万円', '円'], '', $v);
            }
            $row[$k] = is_numeric($v) ? (float)$v : 0;
            continue;
        }

        $row[$k] = $v;
    }
    return $row;
}

// --- バッチで ON DUPLICATE を実行する関数 ---
function insertBatchOnDuplicate(PDO $pdo, string $tableName, array $rows): array
{
    $summary = ['processed' => 0, 'errors' => []];
    if (count($rows) === 0) return $summary;

    $cols = array_keys($rows[0]);
    $colSql = "`" . implode("`, `", $cols) . "`";

    // ON DUPLICATE 用の更新句（customer_id 等のユニークキーが衝突した場合の処理）
    $updateParts = [];
    foreach ($cols as $c) {
        // primary/uniqueキー（例: customer_id）は更新不要なため除外してもOKですが、
        // VALUES()で上書きしても論理的な問題はないため全カラム指定しています。
        $updateParts[] = "`$c` = VALUES(`$c`)";
    }
    $updateSql = implode(", ", $updateParts);

    // プレースホルダとパラメータを作成
    $placeholders = [];
    $params = [];
    foreach ($rows as $i => $row) {
        $placeholders[] = "(" . implode(", ", array_map(fn($c) => ":" . $c . "_" . $i, $cols)) . ")";
        foreach ($cols as $c) {
            $params[":" . $c . "_" . $i] = $row[$c];
        }
    }

    $sql = "INSERT INTO `{$tableName}` ($colSql) VALUES " . implode(", ", $placeholders) . " ON DUPLICATE KEY UPDATE $updateSql";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $summary['processed'] = count($rows);
    } catch (Throwable $e) {
        $summary['errors'][] = $e->getMessage();
    }

    return $summary;
}


// --- メイン処理 ---
// DB接続 ($pdo) はこのファイルより前で生成されている前提とします
// $pdo = new PDO(...);

$raw = file_get_contents('php://input');
if ($raw === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'No input received']);
    exit;
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON', 'json_error' => json_last_error_msg()]);
    exit;
}

// リクエストタイプの判定
$requestType = $payload['request'] ?? null;
$rows = $payload['data'] ?? null;

if ($requestType !== 'suumo_db_kaeru' || !is_array($rows)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid request or data missing']);
    exit;
}

$tableName = 'suumo_db_kaeru';
// 既にフロント側で500件ずつにチャンク分割されていますが、
// PHP側でも念のため一定数（例: 1000件）でバッチを区切る安全策を取ります
$batchSize = 500;
$summary = ['processed' => 0, 'errors' => []];

try {
    $chunks = array_chunk($rows, $batchSize);
    foreach ($chunks as $chunk) {
        $preparedRows = [];
        foreach ($chunk as $row) {
            $filtered = filterAllowed($row, $allowedColumns);
            $normalized = normalizeRow($filtered);
            $preparedRows[] = $normalized;
        }

        $pdo->beginTransaction();

        $res = insertBatchOnDuplicate($pdo, $tableName, $preparedRows);

        if (!empty($res['errors'])) {
            $pdo->rollBack();
            $summary['errors'] = array_merge($summary['errors'], $res['errors']);
        } else {
            $pdo->commit();
            $summary['processed'] += $res['processed'];
        }
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $e->getMessage()]);
    exit;
}

// Dashboard連携
require_once __DIR__ . '/portal/suumo_kaeru.php';

// 成功レスポンス
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => empty($summary['errors']),
    'inserted' => $summary['processed'],
    'errors' => $summary['errors']
], JSON_UNESCAPED_UNICODE);
