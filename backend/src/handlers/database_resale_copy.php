<?php

$originalId = $data['id'] ?? null;
$newId = $data['newId'] ?? null;

// バリデーション
if (!$originalId || !$newId) {
    http_response_code(400); // 400 Bad Request
    echo json_encode(["status" => "error", "message" => "必要なIDが送信されていません"]);
    exit;
}

try {
    // 2. コピー元の顧客データを取得 (FETCH_ASSOC でキーと値の連想配列として取得)
    $stmt = $pdo->prepare("SELECT * FROM master_data_resale WHERE id = :id");
    $stmt->execute([':id' => $originalId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "対象の顧客が見つかりません"]);
        exit;
    }

    // 3. IDを上書きする (スプレッド構文 {...row, id: newId} と同じ感覚)
    $row['id'] = $newId;
    unset($row['no']);
    // 4. 動的にINSERT文を生成する
    // 例: INSERT INTO table (id, name, ...) VALUES (:id, :name, ...)
    $columns = array_keys($row);
    $placeholders = array_map(function ($col) {
        return ':' . $col;
    }, $columns);

    $sql = sprintf(
        "INSERT INTO master_data_resale (%s) VALUES (%s)",
        implode(', ', $columns),
        implode(', ', $placeholders)
    );

    // 5. 複製したデータを挿入
    $insertStmt = $pdo->prepare($sql);
    $insertStmt->execute($row);

    // 6. 成功レスポンスを返す

    $sql_customer = "SELECT
    id,
    COALESCE(customer_contacts_name, '') AS customer,
    COALESCE(in_charge_store, '') AS shop,
    COALESCE(in_charge_user, '') AS staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
    COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
    COALESCE(
        DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
        DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
        ''
        ) AS register,
    COALESCE(sales_promotion_name, '') AS medium,
    COALESCE(status, '') AS status,
    COALESCE(rank_period, '') AS rank_period,
    COALESCE(call_status, '') AS call_status,
    COALESCE(category, '') AS category,
    COALESCE(cancel_status, '') AS cancel_status,
    COALESCE(show_dashboard, 0) AS trash,
    COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
    COALESCE(full_address, '') AS full_address,
    COALESCE(hp_campaign, '') AS hp_campaign,
    COALESCE(property_name, '') AS property_name,
    COALESCE(property_tour_name, '') AS property_tour_name,
    COALESCE(introduction_person_category, '') AS introduction_person_category,
    COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
    COALESCE(customer_contacts_email, '') AS mail,
    COALESCE(integration, '') AS integration FROM master_data_resale;";
    $stmt_customer = $pdo->prepare($sql_customer);
    $stmt_customer->execute();
    $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status'   => 'success',
        'message' => '顧客のコピーが正常に終わりました。',
        'customer' => $response_customer
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    // DBエラー時 (プライマリキー重複など) は500エラーとして返す
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "データベースエラー: " . $e->getMessage()]);
    exit;
}
