<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

// --- 許可カラム（TS側のキー名と完全一致） ---
$allowedColumns = [
    'area',
    'date',
    'time',
    'name',
    'nameKana',
    'age',
    'email',
    'tel',
    'zip',
    'address',
    'event',
    'source',
    'purpose',
    'note',
    'registered',
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

// --- 正規化: 空文字->NULL ---
function normalizeRow(array $row): array
{
    foreach ($row as $k => $v) {
        if (is_string($v)) {
            $v = trim($v);
        }
        if ($v === '') {
            $row[$k] = null;
        } else {
            $row[$k] = $v;
        }
    }
    return $row;
}

// --- バッチインサート関数 ---
// --- バッチインサート関数（INSERT IGNORE 方式に変更） ---
function insertBatchOnDuplicate(PDO $pdo, string $tableName, array $rows): array
{
    $summary = ['processed' => 0, 'errors' => []];
    if (count($rows) === 0) return $summary;

    $cols = array_keys($rows[0]);
    $colSql = "`" . implode("`, `", $cols) . "`";

    $placeholders = [];
    $params = [];
    foreach ($rows as $i => $row) {
        $placeholders[] = "(" . implode(", ", array_map(fn($c) => ":" . $c . "_" . $i, $cols)) . ")";
        foreach ($cols as $c) {
            $params[":" . $c . "_" . $i] = $row[$c];
        }
    }

    // ★ 修正: INSERT IGNORE に変更することで、email と registered が重複した2通目を完全にスルーします
    $sql = "INSERT IGNORE INTO `{$tableName}` ($colSql) VALUES " . implode(", ", $placeholders);

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $summary['processed'] = $stmt->rowCount(); // 実際に新しく挿入された件数をカウント
    } catch (Throwable $e) {
        $summary['errors'][] = $e->getMessage();
    }

    return $summary;
}

// --- メイン処理 ---
// ※ $pdo = new PDO(...); は定義済みとする

$raw = file_get_contents('php://input');
if ($raw === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'No input received']);
    exit;
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON']);
    exit;
}

// リクエストタイプの判定
$requestType = $payload['request'] ?? null;
// 送信されてくるデータが配列(複数)か、オブジェクト(単体)か吸収する
$data = $payload['data'] ?? $payload;
if (!is_array($data)) $data = [];
// もし単体のオブジェクトで送られてきた場合は、配列の配列に変換
if (isset($data['name'])) {
    $rows = [$data];
} else {
    $rows = $data;
}

// TS側で指定した request 名と一致させる
if ($requestType !== 'reserve_kaeru_update' || empty($rows)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid request or data missing']);
    exit;
}

$tableName = 'reserve_kaeru';
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

// ★ ここにDashboard連携処理（統合テーブルへの同期など）を挟みます
// ※ファイル名は環境に合わせて適宜変更してください
require_once __DIR__ . '/portal/reserve_kaeru.php';

// 成功レスポンス
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => empty($summary['errors']),
    'inserted' => $summary['processed'],
    'errors' => $summary['errors']
], JSON_UNESCAPED_UNICODE);
