<?php

try {

    if (!$data || (empty($data['email']) && empty($data['name']))) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なデータ、または必要な情報がありません。']);
        exit;
    }

    $existingRecord = false;
    $checkEmail = $data['email'] ?? '';

    if ($checkEmail !== '') {
        $checkStmt = $pdo->prepare("SELECT id FROM iei_db WHERE email = :email LIMIT 1");
        $checkStmt->execute([':email' => $checkEmail]);
        $existingRecord = $checkStmt->fetch();
    }

    $uniqueId = $existingRecord ? $existingRecord['id'] : uniqid('iei_');

    $params = [
        ':id'                => $uniqueId,
        ':assessment_method' => $data['assessmentMethod'] ?? null,
        ':assessment_type'   => $data['assessmentType'] ?? null,
        ':property_type'     => $data['propertyType'] ?? null,
        ':property_address'  => $data['propertyAddress'] ?? null,
        ':building_area'     => $data['buildingArea'] ?? null,
        ':land_area'         => $data['landArea'] ?? null,
        ':floor_plan'        => $data['floorPlan'] ?? null,
        ':built_year'        => $data['builtYear'] ?? null,
        ':current_status'    => $data['currentStatus'] ?? null,
        ':rent'              => $data['rent'] ?? null,
        ':ownership'         => $data['ownership'] ?? null,
        ':reason'            => $data['reason'] ?? null,
        ':sale_timing'       => $data['saleTiming'] ?? null,
        ':contact_date'      => $data['contactDate'] ?? null,
        ':contact_time'      => $data['contactTime'] ?? null,
        ':hopes'             => $data['hopes'] ?? null,
        ':requests'          => $data['requests'] ?? null,
        ':name'              => $data['name'] ?? null,
        ':name_kana'         => $data['nameKana'] ?? null,
        ':age'               => $data['age'] ?? null,
        ':address'           => $data['address'] ?? null,
        ':tel1'              => $data['tel1'] ?? null,
        ':tel2'              => $data['tel2'] ?? null,
        ':email'             => $data['email'] ?? null,
        ':registered_at'     => $data['registered'] ?? null,
        ':remarks'           => $data['remarks'] ?? null,
    ];

    if ($existingRecord) {
        $sql = "UPDATE iei_db SET 
                    assessment_method = :assessment_method,
                    assessment_type = :assessment_type,
                    property_type = :property_type,
                    property_address = :property_address,
                    building_area = :building_area,
                    land_area = :land_area,
                    floor_plan = :floor_plan,
                    built_year = :built_year,
                    current_status = :current_status,
                    rent = :rent,
                    ownership = :ownership,
                    reason = :reason,
                    sale_timing = :sale_timing,
                    contact_date = :contact_date,
                    contact_time = :contact_time,
                    hopes = :hopes,
                    requests = :requests,
                    name = :name,
                    name_kana = :name_kana,
                    age = :age,
                    address = :address,
                    tel1 = :tel1,
                    tel2 = :tel2,
                    email = :email,
                    registered_at = :registered_at,
                    remarks = :remarks
                WHERE id = :id";
        
        $stmt = $pdo->prepare($sql);
        
        if ($stmt->execute($params)) {
            require_once __DIR__ . '/portal/iei_resale.php'; // ※ファイル名は環境に合わせて調整してください
            echo json_encode(['status' => 'success', 'action' => 'updated', 'id' => $uniqueId]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'UPDATE failed']);
        }

    } else {
        $sql = "INSERT INTO iei_db 
                    (id, assessment_method, assessment_type, property_type, property_address, building_area, land_area, floor_plan, built_year, current_status, rent, ownership, reason, sale_timing, contact_date, contact_time, hopes, requests, name, name_kana, age, address, tel1, tel2, email, registered_at, remarks) 
                VALUES 
                    (:id, :assessment_method, :assessment_type, :property_type, :property_address, :building_area, :land_area, :floor_plan, :built_year, :current_status, :rent, :ownership, :reason, :sale_timing, :contact_date, :contact_time, :hopes, :requests, :name, :name_kana, :age, :address, :tel1, :tel2, :email, :registered_at, :remarks)";
        
        $stmt = $pdo->prepare($sql);
        
        if ($stmt->execute($params)) {
            require_once __DIR__ . '/portal/iei_resale.php'; // ※ファイル名は環境に合わせて調整してください
            echo json_encode(['status' => 'success', 'action' => 'inserted', 'id' => $uniqueId]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'INSERT failed']);
        }
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    // その他のエラー
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'System error: ' . $e->getMessage()]);
}