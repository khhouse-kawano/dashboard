<?php
$id = $data['id'] ?? '';
$brand = $data['brand'] ?? '';

$sql = "UPDATE staff SET brand = ? WHERE id = ?";
$stmt = $pdo->prepare($sql);
if ($stmt->execute([$brand, $id])) {
    echo json_encode([
        "status" => "success",
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
    echo json_encode([
        "status" => "error",
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
