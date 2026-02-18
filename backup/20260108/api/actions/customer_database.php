<?php
$sql = "SELECT id, shop, name, staff, status, rank, medium, reserve, register, contract, before_survey, before_interview, after_interview, call_status, reserved_status, phone_number, full_address, response_status, trash
        FROM customers ORDER BY register DESC;";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
