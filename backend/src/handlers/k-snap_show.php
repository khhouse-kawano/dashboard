<?php

/**
 * スナップ写真の公開/非公開、営業名の表示切り替え。
 *
 * リクエスト: { "request": "k-snap_show", "id": ..., "key": "show_snap", "flag": 0|1 }
 *
 * ⚠️ これは**スタッフ向け**。認証を要求すべきエンドポイントである。
 *   現状は認証していないため、**誰でも任意の写真を非公開にできる。**
 *
 * ⚠️ **書き込み系のため ② への転送許可リストに入れてはいけない。**
 *
 * ⚠️ key はホワイトリストで検証している。ここを緩めると
 *   列名が任意になり、UPDATE で他の列を書き換えられる。
 */

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