<?php

try {

    // データが空、またはキーとなる userId が存在しない場合はエラー終了
    if (!$data || empty($data['userId'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なデータ、またはuserIdがありません。']);
        exit;
    }

    // ==========================================
    // 1. データのマッピング (Prepared Statement用の配列)
    // ==========================================
    $params = [
        ':userUrl'      => $data['userUrl'] ?? null,
        ':propertyUrl'  => $data['propertyUrl'] ?? null,
        ':category'     => $data['category'] ?? null,
        ':propertyName' => $data['propertyName'] ?? null,
        ':price'        => $data['price'] ?? null,
        ':area'         => $data['area'] ?? null,
        ':railway'      => $data['railway'] ?? null,
        ':large'        => $data['large'] ?? null,
        ':plan'         => $data['plan'] ?? null,
        ':propertyId'   => $data['propertyId'] ?? null,
        ':companyId'    => $data['companyId'] ?? null,
        ':userId'       => $data['userId'], // 必須項目
        ':name'         => $data['name'] ?? null,
        ':mail'         => $data['mail'] ?? null,
        ':mobile'       => $data['mobile'] ?? null,
        ':note'         => $data['note'] ?? null,
        ':registered'   => $data['registered'] ?? null,
        ':remarks'      => $data['remarks'] ?? null,
    ];

    // ==========================================
    // 2. userId で重複チェックと INSERT / UPDATE
    // ==========================================
    // まず userId がDBに存在するか確認する
    $checkStmt = $pdo->prepare("SELECT no FROM homes_db_kaeru WHERE userId = :userId LIMIT 1");
    $checkStmt->execute([':userId' => $data['userId']]);
    $existingRecord = $checkStmt->fetch();

    if ($existingRecord) {
        // --- 存在する場合は UPDATE ---
        $sql = "UPDATE homes_db_resale SET 
                    userUrl = :userUrl, propertyUrl = :propertyUrl, category = :category, 
                    propertyName = :propertyName, price = :price, area = :area, 
                    railway = :railway, large = :large, plan = :plan, propertyId = :propertyId, 
                    companyId = :companyId, name = :name, mail = :mail, 
                    mobile = :mobile, note = :note, registered = :registered, remarks = :remarks
                WHERE userId = :userId";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        echo json_encode(['status' => 'success', 'action' => 'updated', 'userId' => $data['userId']]);

    } else {
        // --- 存在しない場合は INSERT ---
        $sql = "INSERT INTO homes_db_resale 
                    (userUrl, propertyUrl, category, propertyName, price, area, railway, large, plan, propertyId, companyId, userId, name, mail, mobile, note, registered, remarks) 
                VALUES 
                    (:userUrl, :propertyUrl, :category, :propertyName, :price, :area, :railway, :large, :plan, :propertyId, :companyId, :userId, :name, :mail, :mobile, :note, :registered, :remarks)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        echo json_encode(['status' => 'success', 'action' => 'inserted', 'userId' => $data['userId']]);
    }

    
// Dashboard連携
require_once __DIR__ . '/portal/homes_resale.php';

} catch (PDOException $e) {
    // データベースエラー時のハンドリング
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    // その他のエラー
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'System error: ' . $e->getMessage()]);
}