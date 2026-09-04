<?php

/**
 * 公開ギャラリー用の顧客1件。
 *
 * リクエスト: { "request": "k-snap_customer", "id": "..." }
 *
 * ⚠️⚠️ これは**顧客向けの公開API**である。認証を要求してはいけない。
 *
 * ⚠️ SELECT * のため **pass（パスワード）も返している。**
 *   id を1から順に変えれば、任意の顧客のパスワードが取得できる状態。
 *   返す列を絞るべきだが、フロントがどの列を使っているか未確認のため、
 *   移行では形を変えていない。公開ギャラリーのソースを取り込んだ時点で
 *   必要な列だけに絞ること。
 */

// テーブル名 k-snap_customer をバッククォートで囲む
$sql = "SELECT * FROM `k-snap_customer` WHERE id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$data['id']]);
$result = $stmt->fetch(PDO::FETCH_ASSOC);

echo json_encode( 
    [ 
        'status' => 'success',
        'customer' => $result  // 2. 'cusotmer' のタイポを修正
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
); 