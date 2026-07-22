<?php
$id = $data['id'] ?? '';

if (!$id) {
    $sql_customer = "SELECT id, first_name, last_name, mail, note, medium
        FROM inquiry_customer 
        WHERE brand LIKE '%PG%' 
        AND (medium = 'タウンライフ' OR medium = 'HOME\'S' OR medium = 'カゴスマ' OR (medium = 'ホームページ反響' AND reserved_date <> ''));";

    $stmt_customer = $pdo->prepare($sql_customer);
    $stmt_customer->execute();
    $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($response_customer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $sql_customer = "UPDATE inquiry_customer SET note = 'mail' WHERE id = ?;";
    $stmt_customer = $pdo->prepare($sql_customer);
    $stmt_customer->execute([$id]);

    $result = [
        "status" => 'success',
    ];
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    error_log('Mail Update Error: ' . $e->getMessage());

    $result = [
        "status" => 'error',
    ];

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
