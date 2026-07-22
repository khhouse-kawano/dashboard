<?php
// 面談記録
$sql_interview = "SELECT * FROM interview_sheet WHERE id = ?";
$stmt_interview = $pdo->prepare($sql_interview);
$stmt_interview->execute([$data['id']]);
$response_interview = $stmt_interview->fetch(PDO::FETCH_ASSOC);


// 該当顧客
$sql_customer = "SELECT id,
customer_contacts_name as customer,
sales_promotion_name as medium,
step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register
FROM master_data
WHERE id = ?";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute([$data['id']]);
$response_customer = $stmt_customer->fetch(PDO::FETCH_ASSOC);


$result = [
    "interview" => $response_interview,
    "customer" => $response_customer
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);