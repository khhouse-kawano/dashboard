<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

// --- 許可カラム（34項目） ---
$allowedColumns = [
    'property_id', 'management_code', 'store_name', 'property_staff',
    'transaction_type', 'property_type', 'address', 'property_name',
    'room_number', 'land_area', 'building_area', 'layout',
    'building_age', 'price', 'gross_yield', 'transportation',
    'agency', 'staff_in_charge', 'tel', 'report_date',
    'next_report_date', 'expected_yield', 'total_units', 'structure',
    'zoning', 'zoning_2', 'seller', 'owner', 'price_raw',
    'investment_type', 'expiry_date', 'publishing_instruction',
    'internal_note', 'registered'
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

// --- メイン関数: 価格履歴の処理と一括更新 ---
function insertOrUpdateProperties(PDO $pdo, string $tableName, array $rows): array
{
    $summary = ['processed' => 0, 'errors' => []];
    if (count($rows) === 0) return $summary;

    // 1. 今回送られてきた物件番号(property_id)のリストを作成
    $propertyIds = array_filter(array_column($rows, 'property_id'));
    if (empty($propertyIds)) {
        $summary['errors'][] = 'No property_id found in batch.';
        return $summary;
    }

    // 2. DBから既存の price_raw データを取得
    $inQuery = implode(',', array_fill(0, count($propertyIds), '?'));
    $stmt = $pdo->prepare("SELECT property_id, price_raw FROM `{$tableName}` WHERE property_id IN ($inQuery)");
    $stmt->execute(array_values($propertyIds));
    
    $existingData = [];
    while ($dbRow = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $existingData[$dbRow['property_id']] = $dbRow['price_raw'];
    }

    // 3. 各行の price_raw を履歴配列(JSON)にフォーマット
    foreach ($rows as &$row) {
        $pid = $row['property_id'];
        $incomingPrice = $row['price_raw'] ?? null;
        $incomingDate = $row['registered'] ?? date('Y/m/d');

        if (isset($existingData[$pid])) {
            // ▼ 既存の物件の場合：価格の変動をチェック
            $dbPriceRawJson = $existingData[$pid];
            $dbPriceArr = json_decode((string)$dbPriceRawJson, true);

            // 万が一以前のデータが単なる文字列だった場合のフォールバック
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($dbPriceArr)) {
                $dbPriceArr = [];
                if ((string)$dbPriceRawJson !== '') {
                    $dbPriceArr[] = ['date' => '2000/01/01', 'value' => $dbPriceRawJson];
                }
            }

            // 配列の最後（最新）の価格を取得
            $lastEntry = end($dbPriceArr);
            $lastValue = $lastEntry ? $lastEntry['value'] : null;

            // 価格が前回の記録と違う場合のみ、履歴として追加
            if ((string)$lastValue !== (string)$incomingPrice) {
                $dbPriceArr[] = ['date' => $incomingDate, 'value' => $incomingPrice];
            }
            $row['price_raw'] = json_encode($dbPriceArr, JSON_UNESCAPED_UNICODE);

        } else {
            // ▼ 新規物件の場合：配列の最初の要素として作成
            $newArr = [];
            $newArr[] = ['date' => $incomingDate, 'value' => $incomingPrice];
            $row['price_raw'] = json_encode($newArr, JSON_UNESCAPED_UNICODE);
        }
    }
    unset($row);

    // 4. INSERT ... ON DUPLICATE KEY UPDATE 構文の構築
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

    $updates = [];
    foreach ($cols as $c) {
        // 物件番号(ユニークキー)以外は上書き設定にする
        if ($c !== 'property_id') {
            $updates[] = "`$c` = VALUES(`$c`)";
        }
    }
    $updateSql = implode(", ", $updates);

    $sql = "INSERT INTO `{$tableName}` ($colSql) VALUES " . implode(", ", $placeholders) . " ON DUPLICATE KEY UPDATE $updateSql";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $summary['processed'] = count($rows); // 更新された行数を記録
    } catch (Throwable $e) {
        $summary['errors'][] = $e->getMessage();
    }

    return $summary;
}

// --- 以下、リクエストの受取と実行 ---

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

// TS側の識別子と一致するかチェック
if ($requestType !== 'property_db_update' || empty($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid request or data missing']);
    exit;
}

$tableName = 'property_db';
// 項目数が多いため、安全を取って1バッチあたり200件に分割（プレースホルダーの上限対策）
$batchSize = 200;
$summary = ['processed' => 0, 'errors' => []];

try {
    $chunks = array_chunk($data, $batchSize);
    foreach ($chunks as $chunk) {
        $preparedRows = [];
        foreach ($chunk as $row) {
            $filtered = filterAllowed($row, $allowedColumns);
            $normalized = normalizeRow($filtered);
            $preparedRows[] = $normalized;
        }

        $pdo->beginTransaction();
        $res = insertOrUpdateProperties($pdo, $tableName, $preparedRows);

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

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => empty($summary['errors']),
    'inserted_or_updated' => $summary['processed'],
    'errors' => $summary['errors']
], JSON_UNESCAPED_UNICODE);