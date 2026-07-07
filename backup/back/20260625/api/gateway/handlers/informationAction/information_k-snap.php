<?php
$id = $data['id'] ?? null;
$pass = $data['pass'] ?? null;

$exist = "SELECT 1 FROM `k-snap_customer` WHERE pass = ?";
$stmt_exist = $pdo->prepare($exist);
$stmt_exist->execute([$pass]);

if ($stmt_exist->fetch()) {
    $status = 'duplicate';
} else {
    try {
        $pdo->beginTransaction();

        $insert_sql = "INSERT INTO `k-snap_customer` (id, pass) VALUES(?, ?)";
        $stmt_insert = $pdo->prepare($insert_sql);
        $stmt_insert->execute([$id, $pass]);

        $update_sql = "UPDATE `master_data` SET k_snap = ? WHERE id = ?";
        $stmt_update = $pdo->prepare($update_sql);
        $stmt_update->execute([$pass, $id]);

        $pdo->commit();
        $status = 'success';

    } catch (Exception $e) {
        $pdo->rollBack();
        $status = 'error';
    }
}

echo json_encode([
    'status' => $status,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);