<?php
// ※ $pdo および $data（連想配列）は定義済み前提

// 1. 許可するカラム名のホワイトリストを定義
$allowedColumns = [
    'id', 'status', 'ticket_stop_reason_type', 'ticket_stop_reason', 'ticket_at',
    'updated_at', 'hotlead_url', 'store_id', 'store_name', 'unit_id', 'unit_name',
    'client_user_name', 'appointment_status', 'appointment_start_at', 'appointment_start_at2',
    'appointment_place_type', 'appointment_place', 'appointment_adult_count',
    'appointment_adult_count_note', 'appointment_child_count', 'appointment_child_count_note',
    'appointment_transportation', 'appointment_guidance_types', 'appointment_guidance',
    'appointment_cancel_reason_type', 'appointment_cancel_reason', 'name', 'name_kana',
    'age', 'gender', 'phone', 'phone_note', 'email', 'zip_code', 'address',
    'desired_contact_method', 'inquiry_detail', 'appointment_desired_date1_note',
    'appointment_desired_date2_note', 'family_adult_count', 'family_child_count',
    'family_pet_count', 'family_pet_count_note', 'holidays', 'interests',
    'employment_status', 'employment_company_name', 'years_of_service', 'salary',
    'fund', 'cashing', 'cashing_note', 'has_scheduled_loan', 'property_find_duration',
    'property_find_duration_note', 'done_loan_simulate', 'done_loan_simulate_note',
    'social_style', 'social_style_note', 'interest_other_property_or_company',
    'visited_property_experience', 'inquiry_competitor_status', 'residence_type',
    'monthly_house_payment', 'housing_loan_balance', 'car_name', 'car_count',
    'monthly_parking_fee', 'current_floor_plan', 'demand_house_floors_count',
    'demand_property_types', 'demand_higher_price', 'demand_higher_price_note',
    'demand_parking_capacity', 'demand_other_condition', 'demand_area',
    'demand_train_station', 'demand_walking_time', 'demand_walking_time_note',
    'demand_time_to_relocate', 'demand_time_to_relocate_note', 'purchasing_reason',
    'inquiry_reasons', 'demand_building_site', 'has_building_site',
    'has_building_site_note', 'demand_time_to_build', 'visited_exhibition_experience',
    'relation_with_property', 'demand_selling_price', 'demand_selling_price_note',
    'selling_property_type', 'selling_address', 'selling_address_kana',
    'selling_land_area', 'selling_building_area', 'selling_occupied_area',
    'selling_built_at', 'selling_resident', 'selling_property_purchased_price',
    'selling_remodeling_history', 'selling_purchased_time', 'selling_floor_plan',
    'selling_management_fee', 'selling_repair_reserve_fund', 'selling_property_right',
    'property_name1', 'property_URL1', 'property_type1', 'property_address1',
    'property_price1', 'property_building_area1', 'property_land_area1',
    'property_floor_plan1', 'property_code1', 'lead_at1', 'property_name2',
    'property_URL2', 'property_type2', 'property_address2', 'property_price2',
    'property_building_area2', 'property_land_area2', 'property_floor_plan2',
    'property_code2', 'lead_at2', 'property_name3', 'property_URL3',
    'property_type3', 'property_address3', 'property_price3', 'property_building_area3',
    'property_land_area3', 'property_floor_plan3', 'property_code3', 'lead_at3',
    'request_material_file_name1', 'request_material_file_name2',
    'request_material_file_name3', 'media_name1', 'media_name2', 'media_name3',
    'action_history'
];

// 2. ホワイトリストに含まれるキーのみを抽出
$filteredData = array_intersect_key($data, array_flip($allowedColumns));

if (empty($filteredData) || !isset($filteredData['id'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => '有効なデータまたはidが含まれていません']);
    exit;
}

$targetId = $filteredData['id'];

try {
    // 3. hotlead_db への保存処理（既存データ確認）
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM `hotlead_db` WHERE `id` = :check_id");
    $checkStmt->execute(['check_id' => $targetId]);
    $isExists = $checkStmt->fetchColumn() > 0;

    if ($isExists) {
        // UPDATE 処理（SET節から主キー id を除外し、WHERE 節で :id を使用）
        $updateData = $filteredData;
        unset($updateData['id']);

        $setClause = implode(', ', array_map(fn($key) => "`$key` = :$key", array_keys($updateData)));
        $sql = "UPDATE `hotlead_db` SET {$setClause} WHERE `id` = :id";

        $stmt = $pdo->prepare($sql);
        // $filteredData には id も含まれているためそのまま渡せます
        $stmt->execute($filteredData);
        $action = 'update';
    } else {
        // INSERT 処理
        $keys = array_keys($filteredData);
        $columns = implode(', ', array_map(fn($key) => "`$key`", $keys));
        $placeholders = implode(', ', array_map(fn($key) => ":$key", $keys));
        $sql = "INSERT INTO `hotlead_db` ({$columns}) VALUES ({$placeholders})";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($filteredData);
        $action = 'insert';
    }

    // 4. master_data テーブルの hotlead_id 紐付け更新処理
    $storeName    = $filteredData['store_name'] ?? '';
    $inChargeStore= 'KH' . $storeName;
    $cleanName    = preg_replace('/\s+/u', '', $filteredData['name'] ?? '');
    $cleanPhone   = preg_replace('/\D/', '', $filteredData['phone'] ?? '');
    $email        = trim($filteredData['email'] ?? '');

    $masterSql = "
        UPDATE `master_data`
        SET `hotlead_id` = :hotlead_id
        WHERE (`hotlead_id` IS NULL OR `hotlead_id` = '')
          AND `in_charge_store` = :in_charge_store
          AND REPLACE(REPLACE(`customer_contacts_name`, ' ', ''), ' ', '') = :clean_name
          AND (
            REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[^0-9]', '') = :clean_phone1
            OR REGEXP_REPLACE(`customer_contacts_phone_number`, '[^0-9]', '') = :clean_phone2
          )
          AND `customer_contacts_email` = :email
    ";

    $masterStmt = $pdo->prepare($masterSql);
    $masterStmt->execute([
        'hotlead_id'      => $targetId,
        'in_charge_store' => $inChargeStore,
        'clean_name'      => $cleanName,
        'clean_phone1'    => $cleanPhone,
        'clean_phone2'    => $cleanPhone,
        'email'           => $email,
    ]);

    $masterUpdatedCount = $masterStmt->rowCount();

    echo json_encode([
        'status' => 'success',
        'action' => $action,
        'id'     => $targetId,
        'master_data_linked' => $masterUpdatedCount > 0,
        'master_data_updated_count' => $masterUpdatedCount
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}