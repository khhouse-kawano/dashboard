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
                WHERE lat_lng IS NULL OR lat_lng = ''
                
                UNION ALL
                
                SELECT property_id as id, address as full_address, lat_lng, 'property' as category
                FROM property_db
                WHERE lat_lng IS NULL OR lat_lng = ''";


        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $address = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result = [
            "mode" => "select",
            "address" => $address
        ];
    } else {
        // ⭐ 修正1: テーブル名だけでなく、IDカラム名も一緒に定義する
        $tableMap = [
            'order'    => ['name' => 'master_data',        'id_col' => 'id'],
            'spec'     => ['name' => 'master_data_kaeru',  'id_col' => 'id'],
            'used'     => ['name' => 'master_data_resale', 'id_col' => 'id'],
            'property' => ['name' => 'property_db',        'id_col' => 'property_id'], // ここだけカラム名が違う
        ];

        $category = isset($data['category']) ? trim($data['category']) : '';

        // カテゴリが存在するかチェック
        if (!isset($tableMap[$category])) {
            echo json_encode(["error" => "未対応のカテゴリです: " . $category], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 定義したマッピングから、テーブル名とIDカラム名を取得
        $table = $tableMap[$category]['name'];
        $idColumn = $tableMap[$category]['id_col'];

        // ⭐ 修正2: WHERE句のカラム名を $idColumn を使って動的にする
        $sql = "UPDATE {$table}
            SET lat_lng = :lat_lng
            WHERE {$idColumn} = :id"; // property_dbの時は property_id = :id になる

        $stmt = $pdo->prepare($sql);

        // プレースホルダ（:id など）の名前はそのまま使い回せます
        $stmt->execute([
            ':lat_lng' => $data['lat_lng'],
            ':id'      => $data['id']
        ]);

        // ⚠️⚠️ 更新できた行数を必ず返す。
        //   ⚠️ 0 行でも HTTP 200 が返るため、呼び出し側（runGeocode.ts）は
        //     「保存できた」と誤解し、**次回また同じ行を Geocoding に投げる**。
        //   ⚠️ 2026-09-15、物件側でこれと同じ形（保存先テーブルの不一致）により
        //     毎回1,031件を叩き続け、請求が ¥150,000 を超えた。
        //   ⚠️ この値を消さないこと。TS 側が 0 を異常として検知している。
        $updated = $stmt->rowCount();

        $result = [
            "mode" => "update",
            "id" => $data['id'],
            "updated" => $updated,
            "message" => $updated > 0 ? "更新しました" : "該当する行がありません"
        ];
    }

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ⭐ もし 'geoCode' (物件データ) の処理もこのファイルで行う場合は、
// 以下に elseif ($data['request'] === 'geoCode') { ... } のブロックを追加してください。