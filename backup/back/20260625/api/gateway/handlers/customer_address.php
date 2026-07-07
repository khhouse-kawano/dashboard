<?php
// ⭐ 追加: AxiosからのJSONリクエストを正しく受け取る処理
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: $_POST;

// リクエストの種類が 'customer_address' の場合のみ処理する
if (isset($data['request']) && $data['request'] === 'customer_address') {

    // IDが空ならSELECT、あればUPDATE
    if (empty($data['id'])) {
        $sql = "SELECT id, full_address, lat_lng, 'order' as category
                FROM master_data 
                WHERE lat_lng IS NULL OR lat_lng = ''
                
                UNION ALL
                
                SELECT id, full_address, lat_lng, 'used' as category
                FROM master_data_resale
                WHERE lat_lng IS NULL OR lat_lng = ''
                
                UNION ALL
                
                SELECT id, full_address, lat_lng, 'spec' as category
                FROM master_data_kaeru
                WHERE lat_lng IS NULL OR lat_lng = ''";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $address = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result = [
            "mode" => "select",
            "address" => $address
        ];
    } else {
        $tableMap = [
            'order' => 'master_data',
            'spec' => 'master_data_kaeru',
            'used' => 'master_data_resale',
        ];

        // ⭐ 修正: 余計なスペース等が入っていても大丈夫なようにトリムする
        $category = isset($data['category']) ? trim($data['category']) : '';
        $table = $tableMap[$category] ?? null;

        if ($table === null) {
            // エラーをJSONで返すように変更（画面側でエラー原因が分かるように）
            echo json_encode(["error" => "未対応のカテゴリです: " . $category], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $sql = "UPDATE {$table}
            SET lat_lng = :lat_lng
            WHERE id = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':lat_lng' => $data['lat_lng'],
            ':id'      => $data['id']
        ]);

        $result = [
            "mode" => "update",
            "id" => $data['id'],
            "message" => "更新しました"
        ];
    }

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ⭐ もし 'geoCode' (物件データ) の処理もこのファイルで行う場合は、
// 以下に elseif ($data['request'] === 'geoCode') { ... } のブロックを追加してください。