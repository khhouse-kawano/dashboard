<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

// --- 許可カラム（Node.js側の headerMap に準拠） ---
$allowedColumns = [
    'customer_id',
    'line_uid',
    'line_registered_at',
    'customer_type',
    'company_name',
    'lead_status',
    'delivery_date',
    'line_display_name',
    'last_name',
    'first_name',
    'name_kana',
    'birth_date',
    'gender',
    'email',
    'phone',
    'zip_code',
    'address',
    'budget',
    'available_time',
    'land_search_status',
    'motivation',
    'desired_pref',
    'desired_city_1',
    'desired_city_2',
    'desired_city_3',
    'document_request_status',
    'other_conditions',
    'friend_add_status',
    'friend_add_route',
    'staff',
    'visit_reservation',
    'message_received',
    'owner_id',
    'source_campaign',
    'source_media',
    'source_site',
    'gclid',
    'tags',
    'desired_pref_alt',
    'desired_area_detail',
    'desired_area_1',
    'desired_area_2',
    'desired_area_3',
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

// --- 正規化: 空文字->NULL, 数値キャストなど ---
function normalizeRow(array $row): array
{
    // 今回のテーブル(allGrti_kaeru)は基本的に文字列・TEXT型として作成しているため、
    // SUUMOのように必須で数値化するカラムは指定していません。必要であれば追加してください。
    $numCols = []; 

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

    // ON DUPLICATE 用の更新句
    // line_uid はユニークキーとして働くため上書きは不要ですが、構文上含めても実害はありません
    $updateParts = [];
    foreach ($cols as $c) {
        // line_uidは重複判定用なので更新対象から外す（オプション・より安全）
        if ($c !== 'line_uid') {
            $updateParts[] = "`$c` = VALUES(`$c`)";
        }
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

// TS側で 'allgrit_kaeru' としてPOSTされる想定
if ($requestType !== 'allGrit_kaeru' || !is_array($rows)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid request or data missing']);
    exit;
}

$tableName = 'allGrit_kaeru';
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

// 必要に応じてDashboard連携用ファイルをrequire（元コードの踏襲）
require_once __DIR__ . '/portal/allgrit_kaeru.php';

// 成功レスポンス
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => empty($summary['errors']),
    'inserted' => $summary['processed'],
    'errors' => $summary['errors']
], JSON_UNESCAPED_UNICODE);