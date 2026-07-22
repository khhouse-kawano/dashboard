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
        // ★修正: テーブル名を pre_kaeru に変更
        $checkStmt = $pdo->prepare("SELECT id FROM pre_kaeru WHERE email = :email LIMIT 1");
        $checkStmt->execute([':email' => $checkEmail]);
        $existingRecord = $checkStmt->fetch();
    }

    // ==========================================
    // 2. ユニークIDの発行とデータのマッピング
    // ==========================================
    // すでに存在していればそのIDを使い、新規ならプレフィックスを pk_ で一意のIDを生成
    $uniqueId = $existingRecord ? $existingRecord['id'] : uniqid('pk_');

    // ★修正: pre_kaeru 用のカラムと、送られてくるJSONキー名に合わせてマッピング
    $params = [
        ':id'             => $uniqueId,
        ':email'          => $data['email'] ?? null,
        ':name'           => $data['name'] ?? null,
        ':name_kana'      => $data['nameKana'] ?? null,
        ':tel'            => $data['tel'] ?? null,
        ':zip'            => $data['zip'] ?? null,
        ':address'        => $data['address'] ?? null,
        ':pre_properties' => $data['preProperties'] ?? null, // 先取物件
        ':questions'      => $data['questions'] ?? null,      // ご質問等
        ':registered_at'  => $data['registered'] ?? null,     // システム受付日時
        ':remarks'        => $data['remarks'] ?? null,        // メモ
    ];

    // ==========================================
    // 3. INSERT / UPDATE の実行
    // ==========================================
    if ($existingRecord) {
        // --- 存在する場合は UPDATE ---
        $sql = "UPDATE pre_kaeru SET 
                    email = :email,
                    name = :name,
                    name_kana = :name_kana,
                    tel = :tel,
                    zip = :zip,
                    address = :address,
                    pre_properties = :pre_properties,
                    questions = :questions,
                    registered_at = :registered_at,
                    remarks = :remarks
                WHERE id = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'action' => 'updated', 'id' => $uniqueId]);
    } else {
        // --- 存在しない場合は INSERT ---
        $sql = "INSERT INTO pre_kaeru 
                    (id, email, name, name_kana, tel, zip, address, pre_properties, questions, registered_at, remarks) 
                VALUES 
                    (:id, :email, :name, :name_kana, :tel, :zip, :address, :pre_properties, :questions, :registered_at, :remarks)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'action' => 'inserted', 'id' => $uniqueId]);
    }

    // Dashboard連携 (※先取物件用のファイル名 pre_kaeru.php に変更しています)
    require_once __DIR__ . '/portal/pre_kaeru.php';
    
} catch (PDOException $e) {
    // データベースエラー時のハンドリング
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    // その他のエラー
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'System error: ' . $e->getMessage()]);
}