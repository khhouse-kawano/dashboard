<?php

try {

    // Node.jsからは name か email が送られてくるため、どちらもない場合はエラー
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
        // ★修正: テーブル名を member_kaeru に変更
        $checkStmt = $pdo->prepare("SELECT id FROM member_kaeru WHERE email = :email LIMIT 1");
        $checkStmt->execute([':email' => $checkEmail]);
        $existingRecord = $checkStmt->fetch();
    }

    // ==========================================
    // 2. ユニークIDの発行とデータのマッピング
    // ==========================================
    // すでに存在していればそのIDを使い、新規ならPHPで一意のIDを生成する (プレフィックスを mk_ に変更)
    $uniqueId = $existingRecord ? $existingRecord['id'] : uniqid('mk_');

    // ★修正: member_kaeru 用のカラムと、送られてくるJSONキー名に合わせてマッピング
    $params = [
        ':id'               => $uniqueId,
        ':email'            => $data['email'] ?? null,
        ':name'             => $data['name'] ?? null,
        ':name_kana'        => $data['nameKana'] ?? null,
        ':zip'              => $data['zip'] ?? null,
        ':address'          => $data['address'] ?? null,
        ':age'              => $data['age'] ?? null,
        ':tel'              => $data['tel'] ?? null,
        ':mobile'           => $data['mobile'] ?? null,
        ':source'           => $data['source'] ?? null,
        ':desired_area_1'   => $data['desiredArea1'] ?? null,
        ':desired_area_2'   => $data['desiredArea2'] ?? null,
        ':desired_area_3'   => $data['desiredArea3'] ?? null,
        ':area_notes'       => $data['areaNotes'] ?? null,
        ':other_conditions' => $data['otherConditions'] ?? null,
        ':registered_at'    => $data['registered'] ?? null,
        ':remarks'          => $data['remarks'] ?? null,
    ];

    // ==========================================
    // 3. INSERT / UPDATE の実行
    // ==========================================
    if ($existingRecord) {
        // --- 存在する場合は UPDATE ---
        $sql = "UPDATE member_kaeru SET 
                    email = :email,
                    name = :name,
                    name_kana = :name_kana,
                    zip = :zip,
                    address = :address,
                    age = :age,
                    tel = :tel,
                    mobile = :mobile,
                    source = :source,
                    desired_area_1 = :desired_area_1,
                    desired_area_2 = :desired_area_2,
                    desired_area_3 = :desired_area_3,
                    area_notes = :area_notes,
                    other_conditions = :other_conditions,
                    registered_at = :registered_at,
                    remarks = :remarks
                WHERE id = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'action' => 'updated', 'id' => $uniqueId]);
    } else {
        // --- 存在しない場合は INSERT ---
        $sql = "INSERT INTO member_kaeru 
                    (id, email, name, name_kana, zip, address, age, tel, mobile, source, desired_area_1, desired_area_2, desired_area_3, area_notes, other_conditions, registered_at, remarks) 
                VALUES 
                    (:id, :email, :name, :name_kana, :zip, :address, :age, :tel, :mobile, :source, :desired_area_1, :desired_area_2, :desired_area_3, :area_notes, :other_conditions, :registered_at, :remarks)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'action' => 'inserted', 'id' => $uniqueId]);
    }

    // Dashboard連携 (※必要に応じてファイル名を変更してください)
    require_once __DIR__ . '/portal/member_kaeru.php';
} catch (PDOException $e) {
    // データベースエラー時のハンドリング
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    // その他のエラー
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'System error: ' . $e->getMessage()]);
}
