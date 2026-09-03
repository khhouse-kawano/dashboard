<?php

$id = $data['id'] ?? null;
$flag = $data['flag'] ?? null;
$key = $data['key'] ?? null;

$allowed_columns = ['show_snap', 'staff_show'];

if (in_array($key, $allowed_columns, true)) {
    
    $sql = "UPDATE `k-snap` SET `{$key}` = ? WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    
    if ($stmt->execute([$flag, $id])) {
        $status = 'success';
    } else {
        $status = 'error';
    }
} else {
    $status = 'invalid_column';
}

echo json_encode([
    'status' => $status,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);