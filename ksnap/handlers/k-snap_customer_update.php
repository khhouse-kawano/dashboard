<?php
$columns = [];
$params = [];

$check_keys = ['tag', 'bookmark', 'setting', 'path', 'log'];
foreach ($check_keys as $key) {
    if (isset($data[$key])) {
        $columns[] = $key;
        $params[":{$key}"] = $data[$key];
    }
}

if (!empty($columns)) {
    $is_update = false;

    if (!empty($data['id'])) {
        $stmt_check = $pdo->prepare("SELECT 1 FROM `k-snap_customer` WHERE `id` = :id");
        $stmt_check->execute([':id' => $data['id']]);
        
        if ($stmt_check->fetchColumn()) {
            $is_update = true;
        } else {
            $columns[] = 'id';
            $params[':id'] = $data['id'];
        }
    }

    if ($is_update) {
        $set_clause = implode(', ', array_map(function($col) {
            return "`{$col}` = :{$col}";
        }, array_diff($columns, ['id'])));
        
        $sql = "UPDATE `k-snap_customer` SET {$set_clause} WHERE `id` = :id";
        $params[':id'] = $data['id']; // WHERE句用
    } else {
        $columns_clause = implode(', ', array_map(function($col) {
            return "`{$col}`";
        }, $columns));
        
        $values_clause = implode(', ', array_map(function($col) {
            return ":{$col}";
        }, $columns));
        
        $sql = "INSERT INTO `k-snap_customer` ({$columns_clause}) VALUES ({$values_clause})";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}