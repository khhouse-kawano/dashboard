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
        $checkStmt = $pdo->prepare("SELECT id FROM member_resale WHERE email = :email LIMIT 1");
        $checkStmt->execute([':email' => $checkEmail]);
        $existingRecord = $checkStmt->fetch();
    }

    // ==========================================
    // 2. ユニークIDの発行とデータのマッピング
    // ==========================================
    // すでに存在していればそのIDを使い、新規ならPHPで一意のIDを生成する
    $uniqueId = $existingRecord ? $existingRecord['id'] : uniqid('rm_');

    $params = [
        ':id'              => $uniqueId,
        ':email'           => $data['email'] ?? null,
        ':name'            => $data['name'] ?? null,
        ':name_kana'       => $data['nameKana'] ?? null,
        ':address'         => $data['address'] ?? null,
        ':tel'             => $data['tel'] ?? null,
        ':mobile'          => $data['mobile'] ?? null,
        ':email_send_flag' => $data['emailSendFlag'] ?? null,
        ':source'          => $data['source'] ?? null,
        ':registered_at'   => $data['registered'] ?? null,
        ':remarks'         => $data['remarks'] ?? null,
    ];

    // ==========================================
    // 3. INSERT / UPDATE の実行
    // ==========================================
    if ($existingRecord) {
        // --- 存在する場合は UPDATE ---
        $sql = "UPDATE member_resale SET 
                    email = :email,
                    name = :name,
                    name_kana = :name_kana,
                    address = :address,
                    tel = :tel,
                    mobile = :mobile,
                    email_send_flag = :email_send_flag,
                    source = :source,
                    registered_at = :registered_at,
                    remarks = :remarks
                WHERE id = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'action' => 'updated', 'id' => $uniqueId]);
    } else {
        // --- 存在しない場合は INSERT ---
        $sql = "INSERT INTO member_resale 
                    (id, email, name, name_kana, address, tel, mobile, email_send_flag, source, registered_at, remarks) 
                VALUES 
                    (:id, :email, :name, :name_kana, :address, :tel, :mobile, :email_send_flag, :source, :registered_at, :remarks)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'action' => 'inserted', 'id' => $uniqueId]);
    }

    // Dashboard連携
    require_once __DIR__ . '/portal/member_resale.php';
} catch (PDOException $e) {
    // データベースエラー時のハンドリング
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    // その他のエラー
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'System error: ' . $e->getMessage()]);
}
