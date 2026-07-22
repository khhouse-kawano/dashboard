<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

$allowedColumns = [
    'property',
    'note',
    'date',
    'time',
    'name',
    'nameKana',
    'email',
    'zip',
    'address',
    'age',
    'tel',
    'source',
    'registered',
    'remarks'
];

function filterAllowed(array $row, array $allowed): array
{
    $out = [];
    foreach ($allowed as $col) {
        $out[$col] = array_key_exists($col, $row) ? $row[$col] : null;
    }
    return $out;
}

function normalizeRow(array $row): array
{
    foreach ($row as $k => $v) {
        if (is_string($v)) $v = trim($v);
        $row[$k] = ($v === '') ? null : $v;
    }
    return $row;
}

function insertBatchIgnore(PDO $pdo, string $tableName, array $rows): array
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

    $sql = "INSERT IGNORE INTO `{$tableName}` ($colSql) VALUES " . implode(", ", $placeholders);

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $summary['processed'] = $stmt->rowCount();
    } catch (Throwable $e) {
        $summary['errors'][] = $e->getMessage();
    }

    return $summary;
}

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

$requestType = $payload['request'] ?? null;
$data = $payload['data'] ?? $payload; 
if (!is_array($data)) $data = [];

if (isset($data['name'])) {
    $rows = [$data];
} else {
    $rows = $data;
}

if ($requestType !== 'catalog_kaeru_update' || empty($rows)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid request or data missing']);
    exit;
}

$tableName = 'catalog_kaeru';
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
        $res = insertBatchIgnore($pdo, $tableName, $preparedRows);

        if (!empty($res['errors'])) {
            $pdo->rollBack();
            $summary['errors'] = array_merge($summary['errors'], $res['errors']);
        } else {
            $pdo->commit();
            $summary['processed'] += $res['processed'];
        }
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $e->getMessage()]);
    exit;
}

// 確定直後にDashboard同期
require_once __DIR__ . '/portal/catalog_kaeru.php';

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => empty($summary['errors']),
    'inserted' => $summary['processed'],
    'errors' => $summary['errors']
], JSON_UNESCAPED_UNICODE);