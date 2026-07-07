<?php

// 1. show_key=1 のレコードがあるか確認
$sql_black = 'SELECT id FROM black_list WHERE (mobile = ? OR mail = ?) AND show_key = 1 LIMIT 1';
$stmt_black = $pdo->prepare($sql_black);
$stmt_black->execute([$data['mobile'], $data['mail']]);
$exists_active = $stmt_black->fetch(PDO::FETCH_ASSOC);

if ($exists_active) {

    // 既に show_key=1 → 今回は show_key=0 にする
    $sql_update = 'UPDATE black_list SET show_key = 0
                   WHERE (mobile = ? OR mail = ?) AND show_key = 1';
    $stmt_update = $pdo->prepare($sql_update);
    $success = $stmt_update->execute([$data['mobile'], $data['mail']]);

    $response_update = $success ? 'update_success' : 'update_error';
} else {

    // 2. show_key に関係なく過去に存在するか確認
    $sql_exist_any = 'SELECT id FROM black_list WHERE mobile = ? OR mail = ? LIMIT 1';
    $stmt_exist_any = $pdo->prepare($sql_exist_any);
    $stmt_exist_any->execute([$data['mobile'], $data['mail']]);
    $exists_any = $stmt_exist_any->fetch(PDO::FETCH_ASSOC);

    if ($exists_any) {

        // 過去に存在 → show_key を 1 に復活
        $sql_reactivate = 'UPDATE black_list SET show_key = 1
                           WHERE mobile = ? OR mail = ?';
        $stmt_reactivate = $pdo->prepare($sql_reactivate);
        $success = $stmt_reactivate->execute([$data['mobile'], $data['mail']]);

        $response_update = $success ? 'reactivate_success' : 'reactivate_error';
    } else {

        // 完全に新規 → INSERT
        $sql_insert = 'INSERT INTO black_list (name, mobile, mail, brand, date, zip, full_address)
                       VALUES (?, ?, ?, ?, ?, ?, ?)';
        $stmt_insert = $pdo->prepare($sql_insert);

        $success = $stmt_insert->execute([
            $data['name'],
            $data['mobile'],
            $data['mail'],
            $data['brand'],
            date('Y/m/d'),
            $data['zip'],
            $data['address'],
        ]);

        $response_update = $success ? 'insert_success' : 'insert_error';
    }
}

echo json_encode(["status" => $response_update], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
