<?php

try {
    $allowed_columns = [
        'shop', 
        'staff', 
        'black_list', 
    ];

    if (!in_array($data['demand'], $allowed_columns, true)) {
        http_response_code(400); // Bad Request
        echo json_encode(
            ["status" => "error", "message" => "Invalid column name."],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        exit; // 処理を終了
    }

    $sql = 'UPDATE inquiry_customer_kaeru SET ' . $data['demand'] . ' = ? WHERE inquiry_id = ?';
    $stmt = $pdo->prepare($sql);
    
    if ($stmt->execute([$data['list'], $data['inquiry_id']])) {
        echo json_encode(
            ["status" => "success"],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    } else {
        throw new Exception("Update failed.");
    }

} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(
        [
            "status" => "error", 
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
}