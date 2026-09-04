<?php

/**
 * 公開ギャラリーでの顧客操作の記録（タグ・お気に入り・閲覧ログ等）。
 *
 * リクエスト: { "request": "k-snap_customer_update", "id": "...", "log": "...", ... }
 *
 * ⚠️⚠️ これは**顧客向けの公開API**である。認証を要求してはいけない。
 *
 * ⚠️ **書き込み系のため ② への転送許可リストに入れてはいけない。**
 *   自動フォールバックで二重実行される。
 *
 * ⚠️ id の持ち主であることを確認していない。任意の id を送れば
 *   **他人の閲覧履歴・お気に入りを上書きできる。**
 *   公開ギャラリーのソースを取り込んだ時点で、ログイン時に発行した
 *   セッションと id を突き合わせる仕組みを入れること。
 *
 * ⚠️ 成功しても何も出力しない（移行前からの挙動）。
 *   フロントがレスポンスを見ていないため変更していない。
 */

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