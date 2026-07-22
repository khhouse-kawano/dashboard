<?php
try {
    $sql = "UPDATE master_data SET cancel_status = ? WHERE id = ?";
    $stmt = $pdo->prepare($sql);

    if ($stmt->execute([$data['cancel_status'], $data['id']])) {
        $response_edit = ['status' => 'success', 'message' => 'キャンセル理由の登録に成功しました。'];
    } else {
        $response_edit = ['status' => 'error', 'message' => 'キャンセル理由の登録に失敗しました。'];
    }
} catch (PDOException $e) {
    $response_edit = [
        'status' => 'error',
        'message' => '登録エラー: ' . $e->getMessage()
    ];
}

// 顧客一覧
$sql_customer = "SELECT
  id,
  COALESCE(customer_contacts_name, '') AS customer,
  COALESCE(in_charge_store, '') AS shop,
  COALESCE(in_charge_user, '') AS staff,
  COALESCE(status, '') AS status,
  COALESCE(REPLACE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '/', '-'), '') AS register,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
  COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
  COALESCE(full_address, '') AS full_address,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
  COALESCE(customer_contacts_email, '') AS mail,
  COALESCE(reserved_interview, '') AS reserved_interview,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(cancel_status, '') AS cancel_status,
  COALESCE(sales_promotion_name, '') AS medium
 FROM master_data WHERE show_dashboard = 1;
";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "customer" => $response_customer,
    "response_edit" => $response_edit,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
