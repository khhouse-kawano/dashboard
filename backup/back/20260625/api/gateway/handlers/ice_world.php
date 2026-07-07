<?php

$id = $data['id'] ?? '';
$ice_world = $data['ice_world'] ?? '';

if ($id !== '') {
    $sql = "UPDATE master_data SET ice_world = ? WHERE id = ?";
    $stmt = $pdo->prepare($sql);

    $stmt->execute([$ice_world, $id]);

    $result = [
        "status" => "success"
    ];

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    exit;
}

$sql = "SELECT * FROM master_data";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "customer" => $response
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
