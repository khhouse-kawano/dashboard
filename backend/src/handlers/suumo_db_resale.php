<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

// --- 許可カラム（suumo_db_resaleのテーブル定義に準拠） ---
$allowedColumns = [
    'received_at',
    'sequence_no',
    'source_campaign',
    'recipient_type',
    'recipient_code',
    'spare_1',
    'spare_2',
    'spare_3',
    'spare_4',
    'spare_5',
    'last_name_kanji',
    'first_name_kanji',
    'last_name_kana',
    'first_name_kana',
    'zip_code_1',
    'zip_code_2',
    'address_1',
    'address_2',
    'address_3',
    'email',
    'phone_1',
    'phone_2',
    'phone_3',
    'fax_1',
    'fax_2',
    'fax_3',
    'current_residence',
    'planned_occupants',
    'eldest_child_lifestage',
    'parking_available',
    'annual_income',
    'birth_date',
    'age',
    'desired_move_in',
    'preferred_area_1',
    'preferred_area_2',
    'preferred_area_3',
    'budget_rent',
    'preferred_layout_1',
    'preferred_layout_2',
    'preferred_layout_3',
    'preferred_layout_4',
    'preferred_layout_5',
    'preferred_layout_6',
    'preferred_living_area',
    'other_property_type_1',
    'other_property_type_2',
    'other_property_type_3',
    'other_property_type_4',
    'inquiry_unit',
    'other',
    'preferred_contact_method',
    'preferred_contact_time',
    'inquiry_content_1',
    'inquiry_content_2',
    'inquiry_content_3',
    'inquiry_content_4',
    'inquiry_content_5',
    'inquiry_comment',
    'inquiry_other',
    'reserve_1',
    'reserve_2',
    'reserve_3',
    'reserve_4',
    'reserve_5',
    'customer_notes',
    'sale_assessment_info',
    'commercial_info',
    'company_name',
    'branch_name',
    'company_location',
    'company_tel',
    'media_name',
    'media_type',
    'issue',
    'page',
    'property_type',
    'status',
    'property_code',
    'property_name_1',
    'property_name_2',
    'company_property_code',
    'contact_person',
    'inquiry_unit_detail',
    'line_name',
    'nearest_station',
    'bus_or_walk',
    'property_location',
    'price_or_rent',
    'layout',
    'area_building_area',
    'land_area',
    'free_1',
    'free_2',
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

// --- 正規化: 空文字->NULL など ---
function normalizeRow(array $row): array
{
    foreach ($row as $k => $v) {
        if (is_string($v)) {
            $v = trim($v);
            if (strlen($v) > 0 && $v[0] === "'") {
                $v = ltrim($v, "'");
            }
        }
        if ($v === '') {
            $row[$k] = null;
        } else {
            $row[$k] = $v;
        }
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

    $updateParts = [];
    foreach ($cols as $c) {
        $updateParts[] = "`$c` = VALUES(`$c`)";
    }
    $updateSql = implode(", ", $updateParts);

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
$rows = $payload['data'] ?? null;

// リクエストタイプを 'suumo_db_resale' と判別して処理を実行
if ($requestType === 'suumo_db_resale' && is_array($rows)) {
    $tableName = 'suumo_db_resale';
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
    require_once __DIR__ . '/portal/suumo_resale.php';

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => empty($summary['errors']),
        'inserted' => $summary['processed'],
        'errors' => $summary['errors']
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
