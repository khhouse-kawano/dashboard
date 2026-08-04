<?php

// 1. リクエストボディの取得 (Expressの req.body に相当)
$rawInput = file_get_contents("php://input");
$payload = json_decode($rawInput, true);

// 2. ルーティングの判定
if (isset($payload['request']) && $payload['request'] === 'athome_db_summary') {
    
    $data = $payload['data'] ?? [];
    
    // 💡 TS側で追加した日付データを取得 (存在しない場合はnull)
    $startDate = $payload['start_date'] ?? null;
    $endDate = $payload['end_date'] ?? null;
    
    // データが空の場合は正常終了として返す
    if (empty($data)) {
        echo json_encode(["status" => "success", "message" => "No data to process", "processed" => 0]);
        exit;
    }

    // 3. マッピングするカラムの定義
    // 💡 最後尾に start_date と end_date を追加します
    $columns = [
        'management_no', 'property_no', 'property_type', 'building_name', 'address',
        'line_station', 'price_man_yen', 'published_date', 'floor_plan_flg', 'photo_count',
        'pv_pc', 'pv_sp', 'pv_mobile', 'pv_total',
        'inquiry_pc', 'inquiry_sp', 'inquiry_mobile', 'inquiry_call', 'inquiry_line', 'inquiry_total',
        'favorite_count', 'movie_play_count', 'secondary_ad_auto',
        'start_date', 'end_date'
    ];

    $insertValues = [];
    $bindParams = [];
    $placeholders = '(' . implode(',', array_fill(0, count($columns), '?')) . ')';

    // 4. バルクインサート用の配列を平坦化
    foreach ($data as $row) {
        if (empty($row['management_no'])) continue;

        $insertValues[] = $placeholders;
        foreach ($columns as $col) {
            // 💡 日付カラムの場合は、payloadのルートから取得した値を注入する
            if ($col === 'start_date') {
                $bindParams[] = $startDate;
            } elseif ($col === 'end_date') {
                $bindParams[] = $endDate;
            } else {
                $bindParams[] = $row[$col] ?? null;
            }
        }
    }

    if (empty($insertValues)) {
        echo json_encode(["status" => "error", "message" => "No valid data with management_no found"]);
        exit;
    }

    // 5. ON DUPLICATE KEY UPDATE 句の動的生成
    $updateParts = [];
    foreach ($columns as $col) {
        if ($col === 'management_no') continue; 
        $updateParts[] = "`$col` = VALUES(`$col`)";
    }
    $updateString = implode(', ', $updateParts);

    // 6. SQLの結合
    $sql = "INSERT INTO `athome_summary_db` (`" . implode("`, `", $columns) . "`) 
            VALUES " . implode(', ', $insertValues) . " 
            ON DUPLICATE KEY UPDATE " . $updateString;

    // 7. トランザクション処理の実行
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bindParams);
        $pdo->commit();

        echo json_encode([
            "status" => "success",
            "processed" => count($insertValues),
            "message" => "Chunk processed successfully"
        ]);
        exit;
        
    } catch (\PDOException $e) {
        $pdo->rollBack();
        error_log("Database Error (AtHome): " . $e->getMessage());
        
        http_response_code(500);
        // 💡 開発中は原因特定のヒントになるようエラーメッセージをそのまま返します
        echo json_encode([
            "status" => "error", 
            "message" => "Database Error: " . $e->getMessage()
        ]);
        exit;
    }
}