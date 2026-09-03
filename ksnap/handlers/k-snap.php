<?php

// 💡 フロントのfilter処理が壊れないよう、固定IVを使った暗号化設定
define('ENCRYPTION_KEY', 'secret-key-32bytes-abcdefg12345'); // ⚠️ 実際には32バイトのランダムな文字列に変更してください
define('CIPHER_METHOD', 'aes-256-cbc');
define('FIXED_IV', '1234567890123456'); // ⚠️ 16バイトの固定文字列

/**
 * 元の文字列が同じなら必ず同じ暗号文を返す関数
 */
function encryptOwnerForFilter($value) {
    if (empty($value)) return '';
    
    // 固定IVを使用することで決定論的暗号化（常に同じ結果）にする
    $encrypted = openssl_encrypt($value, CIPHER_METHOD, ENCRYPTION_KEY, 0, FIXED_IV);
    
    return base64_encode($encrypted);
}


$sql = 'SELECT * FROM `k-snap` WHERE show_snap = 1';
$stmt = $pdo->prepare($sql);
$stmt->execute();
$response_snap = $stmt->fetchAll(PDO::FETCH_ASSOC);


// 💡 取得したデータ配列をループさせ、ownerの値だけを暗号化データに書き換える
$encrypted_snap = array_map(function($item) {
    if (isset($item['owner'])) {
        $item['owner'] = encryptOwnerForFilter($item['owner']);
    }
    return $item;
}, $response_snap);


$result =[
    'snaps'=> $encrypted_snap, // 変更後の配列を指定
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);