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
        $checkStmt = $pdo->prepare("SELECT id FROM athome_db_kaeru WHERE email = :email LIMIT 1");
        $checkStmt->execute([':email' => $checkEmail]);
        $existingRecord = $checkStmt->fetch();
    }

    $uniqueId = $existingRecord ? $existingRecord['id'] : uniqid('ak_');

    $params = [
        ':id'                   => $uniqueId,
        ':inquiry_date'         => $data['inquiryDate'] ?? null,
        ':property_type'        => $data['propertyType'] ?? null,
        ':building_name'        => $data['buildingName'] ?? null,
        ':transportation'       => $data['transportation'] ?? null,
        ':station'              => $data['station'] ?? null,
        ':walk_minutes'         => $data['walkMinutes'] ?? null,
        ':bus_stop'             => $data['busStop'] ?? null,
        ':bus_ride_minutes'     => $data['busRideMinutes'] ?? null,
        ':bus_walk_minutes'     => $data['busWalkMinutes'] ?? null,
        ':property_address'      => $data['propertyAddress'] ?? null,
        ':price'                => $data['price'] ?? null,
        ':floor_plan'           => $data['floorPlan'] ?? null,
        ':building_area'        => $data['buildingArea'] ?? null,
        ':land_area'            => $data['landArea'] ?? null,
        ':athome_property_id'   => $data['athomePropertyId'] ?? null,
        ':company_property_id'  => $data['companyPropertyId'] ?? null,
        ':name'                 => $data['name'] ?? null,
        ':email'                => $data['email'] ?? null,
        ':zip'                  => $data['zip'] ?? null,
        ':address'              => $data['address'] ?? null,
        ':tel'                  => $data['tel'] ?? null,
        ':contact_time'         => $data['contactTime'] ?? null,
        ':other_contact_method' => $data['otherContactMethod'] ?? null,
        ':gender'               => $data['gender'] ?? null,
        ':move_in_timing'       => $data['moveInTiming'] ?? null,
        ':tour_date_1'          => $data['tourDate1'] ?? null,
        ':registered_at'        => $data['registered'] ?? null,
        ':remarks'              => $data['remarks'] ?? null,
    ];


    if ($existingRecord) {
        $sql = "UPDATE athome_db_kaeru SET 
                    inquiry_date = :inquiry_date,
                    property_type = :property_type,
                    building_name = :building_name,
                    transportation = :transportation,
                    station = :station,
                    walk_minutes = :walk_minutes,
                    bus_stop = :bus_stop,
                    bus_ride_minutes = :bus_ride_minutes,
                    bus_walk_minutes = :bus_walk_minutes,
                    property_address = :property_address,
                    price = :price,
                    floor_plan = :floor_plan,
                    building_area = :building_area,
                    land_area = :land_area,
                    athome_property_id = :athome_property_id,
                    company_property_id = :company_property_id,
                    name = :name,
                    email = :email,
                    zip = :zip,
                    address = :address,
                    tel = :tel,
                    contact_time = :contact_time,
                    other_contact_method = :other_contact_method,
                    gender = :gender,
                    move_in_timing = :move_in_timing,
                    tour_date_1 = :tour_date_1,
                    registered_at = :registered_at,
                    remarks = :remarks
                WHERE id = :id";
        
        $stmt = $pdo->prepare($sql);
        
        if ($stmt->execute($params)) {
            require_once __DIR__ . '/portal/athome_kaeru.php';
            echo json_encode(['status' => 'success', 'action' => 'updated', 'id' => $uniqueId]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'UPDATE failed']);
        }

    } else {
        $sql = "INSERT INTO athome_db_kaeru 
                    (id, inquiry_date, property_type, building_name, transportation, station, walk_minutes, bus_stop, bus_ride_minutes, bus_walk_minutes, property_address, price, floor_plan, building_area, land_area, athome_property_id, company_property_id, name, email, zip, address, tel, contact_time, other_contact_method, gender, move_in_timing, tour_date_1, registered_at, remarks) 
                VALUES 
                    (:id, :inquiry_date, :property_type, :building_name, :transportation, :station, :walk_minutes, :bus_stop, :bus_ride_minutes, :bus_walk_minutes, :property_address, :price, :floor_plan, :building_area, :land_area, :athome_property_id, :company_property_id, :name, :email, :zip, :address, :tel, :contact_time, :other_contact_method, :gender, :move_in_timing, :tour_date_1, :registered_at, :remarks)";
        
        $stmt = $pdo->prepare($sql);
        
        if ($stmt->execute($params)) {
            // 保存成功後に同期処理
            require_once __DIR__ . '/portal/athome_kaeru.php';
            echo json_encode(['status' => 'success', 'action' => 'inserted', 'id' => $uniqueId]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'INSERT failed']);
        }
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'System error: ' . $e->getMessage()]);
}