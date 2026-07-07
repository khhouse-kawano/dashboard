<?php

try {
    $sql = "UPDATE customers SET gift = :gift WHERE id = :id";
    $stmt = $pdo->prepare($sql);

    $stmt->bindValue(':gift', $data['gift'], PDO::PARAM_STR);
    $stmt->bindValue(':id', $data['id'], PDO::PARAM_STR);

    $stmt->execute();

    $newSql = "SELECT id, shop, name, staff, status, rank, medium, reserve, register, contract, before_survey, before_interview, after_interview, call_status, reserved_status, phone_number, full_address, response_status, trash, section, cancel_status, campaign, second_reserve, note, survey, gift
        FROM customers ORDER BY register DESC;";
    $select = $pdo->prepare($newSql);
    $select->execute();
    $customers = $select->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'customers' => $customers
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => '更新エラー: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}