<?php

try {
    $pdo->beginTransaction();

    $params = [
        ':id'                                     => $data['id'] ?? null,
        ':in_charge_user'                         => $data['in_charge_user'] ?? null,
        ':customer_contacts_name'                 => $data['customer_contacts_name'] ?? null,
        ':customer_contacts_name_kana'            => $data['customer_contacts_name_kana'] ?? null,
        ':in_charge_store'                        => $data['in_charge_store'] ?? null,
        ':step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99' => $data['step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99'] ?? null,
        ':customer_contacts_mobile_phone_number'  => $data['customer_contacts_mobile_phone_number'] ?? null,
        ':customer_contacts_phone_number'         => $data['customer_contacts_phone_number'] ?? null,
        ':customer_contacts_email'                => $data['customer_contacts_email'] ?? null,
        ':postal_code'                            => $data['postal_code'] ?? null,
        ':full_address'                           => $data['full_address'] ?? null,
        ':sales_promotion_name'                   => $data['sales_promotion_name'] ?? null,
        ':remarks'                                => $data['remarks'] ?? null,
        ':reserved_interview'                     => $data['reserved_interview'] ?? null,
        ':hp_campaign'                            => $data['hp_campaign'] ?? null,
        ':status'                                 => $data['status'] ?? null,
        ':planned_construction_site'              => $data['planned_construction_site'] ?? null,
        ':category'                               => $data['category'] ?? null,
    ];

    $placeholders = array_keys($params);
    $columns = array_map(function ($key) {
        return ltrim($key, ':');
    }, $placeholders);

    $sql = "INSERT INTO master_data_resale (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $updateSql = "UPDATE inquiry_customer_resale SET pg_id = ?, sync = 1 WHERE inquiry_id = ?";
    $updateStmt = $pdo->prepare($updateSql); // ← $dbh から $pdo に修正しました
    $updateStmt->execute([$data['id'], $data['inquiry_id']]);

    $pdo->commit();

    // 反響一覧の取得
    $sql_inquiry = "SELECT id, inquiry_id, pg_id, inquiry_date, medium, response_medium, first_name, last_name, category,
        first_name_kana, last_name_kana, mobile, landline, mail, zip, pref, city, town, street, building, brand, shop, sync, staff, area, 
        reserved_date, black_list, hp_campaign, duplicate, property, note 
        FROM inquiry_customer_resale
        WHERE first_name <> '' 
        ORDER BY inquiry_date DESC";
    $stmt_inquiry = $pdo->prepare($sql_inquiry);
    $stmt_inquiry->execute();
    $response_inquiry = $stmt_inquiry->fetchAll(PDO::FETCH_ASSOC);

    // 正常レスポンス
    echo json_encode([
        'status' => 'success',
        'customer' => $response_inquiry
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'System error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
