<?php

function bindNullable(PDOStatement $stmt, string $param, $value, int $type = PDO::PARAM_STR)
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        // 型に応じてキャストしてバインドするのが安全
        if ($type === PDO::PARAM_INT) {
            $stmt->bindValue($param, (int)$value, PDO::PARAM_INT);
        } elseif ($type === PDO::PARAM_BOOL) {
            $stmt->bindValue($param, (bool)$value, PDO::PARAM_BOOL);
        } else {
            $stmt->bindValue($param, $value, $type);
        }
    }
}

$sql = "INSERT INTO order_log (
    id,
    customer,
    staff,
    updated_at,
    log) VALUES
    (
    :id,
    :customer,
    :staff,
    :updated_at,
    :log)";
$stmt = $pdo->prepare($sql);
$id = $data['id'] ?? null;
$customer = $data['customer'] ?? null;
$staff = $data['staff'] ?? null;
$updated_at = date('Y/m/d H:i');
$log = $data['log'] ?? null;

bindNullable($stmt, ':id', $id);
bindNullable($stmt, ':customer', $customer);
bindNullable($stmt, ':staff', $staff);
bindNullable($stmt, ':updated_at', $updated_at);
bindNullable($stmt, ':log', $log);

$stmt->execute();
