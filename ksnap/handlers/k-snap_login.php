<?php
$pass = $data['pass'] ?? null;

if ($pass === null || trim($pass) === '') {
    echo json_encode(["status" => "error"]);
    exit;
}

try {
    $sql = "SELECT `id` FROM `k-snap_customer` WHERE `pass` = :pass LIMIT 1";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':pass' => $pass]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        echo json_encode([
            "status" => "success",
            "id"      => $result['id']
        ]);
    } else {
        echo json_encode(["status" => "not_found"]);
    }
    exit;

} catch (PDOException $e) {
    echo json_encode(["status" => "error"]);
    exit;
}