<?php
try {
    $params = [
        ':latitude'  => $data['latitude'] ?? null,
        ':longitude' => $data['longitude'] ?? null,
        ':id'        => $data['id'] ?? null,
    ];

    $sql = "UPDATE property_list_kaeru SET latitude = :latitude, longitude = :longitude WHERE property_number = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode(['status' => 'success']);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error']);
}
