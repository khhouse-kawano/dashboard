<?php
declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

// --- 許可カラム（ヘッダと同じ） ---
$allowedColumns = [
    'property_id','property_type','property_category','reins_property_id','sales_status','transaction_status','price',
    'address_pref','address_city','address_town','property_name','room_number','latitude','longitude','railway_line',
    'nearest_station','walk_time1','bus_time','bus_route','bus_stop','walk_time2','unit_price_sqm','unit_price_tsubo',
    'yield_percent','land_right','zoning1','zoning2','current_status','special_note_flag','delivery','delivery_condition',
    'note1','note2','sales_point','brokerage_type','equipment_free','feature_free','condition_free','free_memo',
    'registered_at','updated_at','contracted_at','contracted_year_month','info_source','register_method','display_flag',
    'image_exists_flag','latlng_set_flag','listing_company','listing_company_tel','construction_company','permission_type',
    'photo_permission_type','permission_date','permission_fax_id','permission_fax_sent_flag','permission_fax_sent_date',
    'floor_plan','floor_plan_code','floor_plan_detail','built_year_month','exclusive_area','balcony_area','direction',
    'floors_above','floors_below','floor_number','total_units','parking_flag','parking_fee','parking_count','parking_deposit',
    'parking_note','management_fee','reserve_fund','management_type','management_method','land_area','private_road_area',
    'building_area','building_structure','national_land_law','city_planning','land_category','topography','bcr1','far1',
    'bcr2','far2','corner_flag','road_condition1','road_condition2','road_condition3','best_use','legal_restrictions',
    'movie_url1','movie_url2','no_brokerage_fee_flag','admin_memo','reins_no_image_flag','reins_image_import_flag'
];

// --- ヘルパー: 許可カラムのみ抽出 ---
function filterAllowed(array $row, array $allowed): array {
    $out = [];
    foreach ($allowed as $col) {
        $out[$col] = array_key_exists($col, $row) ? $row[$col] : '';
    }
    return $out;
}

// --- 正規化: 空文字->NULL, 先頭のシングルクォート除去, 数値/日付キャスト ---
function normalizeRow(array $row): array {
    $numCols = ['price','latitude','longitude','unit_price_sqm','unit_price_tsubo','yield_percent','exclusive_area','balcony_area','floors_above','floors_below','floor_number','parking_count','management_fee','reserve_fund','land_area','private_road_area','building_area','bcr1','far1','bcr2','far2'];
    $dateCols = ['registered_at','updated_at','contracted_at','permission_date','permission_fax_sent_date','built_year_month'];

    foreach ($row as $k => $v) {
        // trim whitespace
        if (is_string($v)) $v = trim($v);

        // Excel の先頭シングルクォートを除去
        if (is_string($v) && strlen($v) > 0 && $v[0] === "'") {
            $v = ltrim($v, "'");
        }

        // 空文字を NULL に
        if ($v === '') {
            $row[$k] = null;
            continue;
        }

        // 数値キャスト
        if (in_array($k, $numCols, true)) {
            // カンマ除去
            if (is_string($v)) $v = str_replace(',', '', $v);
            $row[$k] = is_numeric($v) ? (float)$v : null;
            continue;
        }

        // 日付の '0000-00-00' を NULL に
        if (in_array($k, $dateCols, true)) {
            if ($v === '0000-00-00' || $v === '0000-00-00 00:00:00') {
                $row[$k] = null;
            } else {
                $row[$k] = $v; // 必要ならフォーマット検証を追加
            }
            continue;
        }

        $row[$k] = $v;
    }
    return $row;
}

// --- バッチで ON DUPLICATE を実行する関数 ---
function insertBatchOnDuplicate(PDO $pdo, array $rows, array $allowedColumns): array {
    $summary = ['processed' => 0, 'inserted' => 0, 'updated' => 0, 'errors' => []];

    if (count($rows) === 0) return $summary;

    // 全カラム（許可カラム）を使う前提で、実際に使うカラムは rows[0] のキー順にする
    $cols = array_keys($rows[0]);
    $colSql = "`" . implode("`, `", $cols) . "`";
    $placeholdersPerRow = "(" . implode(", ", array_map(fn($c) => ":" . $c . "_%d", $cols)) . ")";

    // ON DUPLICATE 用の更新句（updated_at は NOW() にする）
    $updateParts = [];
    foreach ($cols as $c) {
        if ($c === 'updated_at') {
            $updateParts[] = "`$c` = NOW()";
        } else {
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

    $sql = "INSERT INTO estate_info ($colSql) VALUES " . implode(", ", $placeholders) . " ON DUPLICATE KEY UPDATE $updateSql";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        // MySQL では affectedRows = inserted + updated, だが正確な内訳は取得困難
        // ここでは processed を増やすのみ。必要なら個別 SELECT で確認する（コスト高）
        $summary['processed'] = count($rows);
        // 推定: affectedRows を使って簡易カウント（注意: 正確性は保証されない）
        $affected = $stmt->rowCount();
        // 目安として updated = max(0, affected - inserted_estimate) は難しいため省略
    } catch (Throwable $e) {
        $summary['errors'][] = $e->getMessage();
    }

    return $summary;
}

// --- メイン処理 ---
$raw = file_get_contents('php://input');
if ($raw === false) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No input received']);
    exit;
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON', 'json_error' => json_last_error_msg()]);
    exit;
}

$rows = $payload['estates'] ?? null;
$requestType = $payload['request'] ?? null;
if ($requestType !== 'estate_update' || !is_array($rows)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid request or estates missing']);
    exit;
}

// バッチサイズ（必要に応じて調整）
$batchSize = 500;

$summary = ['processed' => 0, 'inserted' => 0, 'updated' => 0, 'errors' => []];

try {
    // 分割して処理
    $chunks = array_chunk($rows, $batchSize);
    foreach ($chunks as $chunkIndex => $chunk) {
        $preparedRows = [];
        foreach ($chunk as $rowIndex => $row) {
            $filtered = filterAllowed($row, $allowedColumns);
            $normalized = normalizeRow($filtered);
            // すべての行で同じカラム順にするため、キー順を揃える
            $preparedRows[] = $normalized;
        }

        // トランザクションはバッチ単位で行う
        $pdo->beginTransaction();
        // insertBatchOnDuplicate はまとめて INSERT ... VALUES (...), (...), ... ON DUPLICATE ...
        $res = insertBatchOnDuplicate($pdo, $preparedRows, $allowedColumns);
        if (!empty($res['errors'])) {
            // エラーがあればロールバックして記録
            $pdo->rollBack();
            $summary['errors'] = array_merge($summary['errors'], $res['errors']);
        } else {
            $pdo->commit();
            $summary['processed'] += count($preparedRows);
            // inserted/updated の正確な内訳は取得していないため processed のみ更新
        }
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error', 'detail' => $e->getMessage()]);
    exit;
}

// 成功レスポンス
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['status' => 'ok', 'summary' => $summary], JSON_UNESCAPED_UNICODE);
