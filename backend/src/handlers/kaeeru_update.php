<?php

try {
    // 必須項目のチェック
    if (!$data || (empty($data['email']) && empty($data['name']))) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なデータ、または必要な情報がありません。']);
        exit;
    }

    // ==========================================
    // 1. email で既存ユーザーの重複チェック
    // ==========================================
    $existingRecord = false;
    $checkEmail = $data['email'] ?? '';

    if ($checkEmail !== '') {
        // カラム名は予約語対策でバッククォートで囲む
        $checkStmt = $pdo->prepare("SELECT `id` FROM `kaeeru_db` WHERE `email` = :email LIMIT 1");
        $checkStmt->execute([':email' => $checkEmail]);
        $existingRecord = $checkStmt->fetch(PDO::FETCH_ASSOC);
    }

    // ==========================================
    // 2. データのマッピング (TSからのキー名と合わせる)
    // ==========================================
    $params = [
        ':type'       => $data['type'] ?? null,
        ':location'   => $data['location'] ?? null,
        ':area'       => $data['area'] ?? null,
        ':status'     => $data['status'] ?? null,
        ':schedule'   => $data['schedule'] ?? null,
        ':relation'   => $data['relation'] ?? null,
        ':price'      => $data['price'] ?? null,
        ':name'       => $data['name'] ?? null,
        ':name_kana'  => $data['nameKana'] ?? null,
        ':email'      => $data['email'] ?? null,
        ':address'    => $data['address'] ?? null,
        ':tel'        => $data['tel'] ?? null,
        ':registered' => $data['registered'] ?? null,
        ':remarks'    => $data['remarks'] ?? null,  // 追加: TS側で整形された全データテキスト
    ];

    // ==========================================
    // 3. INSERT / UPDATE の実行
    // ==========================================
    if ($existingRecord) {
        // --- 存在する場合は UPDATE ---
        $params[':id'] = $existingRecord['id'];
        $sql = "UPDATE `kaeeru_db` SET 
                    `type` = :type,
                    `location` = :location,
                    `area` = :area,
                    `status` = :status,
                    `schedule` = :schedule,
                    `relation` = :relation,
                    `price` = :price,
                    `name` = :name,
                    `name_kana` = :name_kana,
                    `email` = :email,
                    `address` = :address,
                    `tel` = :tel,
                    `registered` = :registered,
                    `remarks` = :remarks
                WHERE `id` = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $recordId = $existingRecord['id'];

    } else {
        // --- 存在しない場合は INSERT ---
        $sql = "INSERT INTO `kaeeru_db` 
                    (`type`, `location`, `area`, `status`, `schedule`, `relation`, `price`, `name`, `name_kana`, `email`, `address`, `tel`, `registered`, `remarks`) 
                VALUES 
                    (:type, :location, :area, :status, :schedule, :relation, :price, :name, :name_kana, :email, :address, :tel, :registered, :remarks)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $recordId = $pdo->lastInsertId();
    }

    // ダッシュボードへの転記・同期処理 (ファイルパスは適宜合わせてください)
    require_once __DIR__ . '/portal/kaeeru.php';

    // 成功レスポンス
    echo json_encode(['status' => 'success', 'id' => $recordId]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'System error: ' . $e->getMessage()]);
}