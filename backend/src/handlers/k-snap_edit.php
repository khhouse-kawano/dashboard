<?php

/**
 * スタッフ向けのスナップ写真一覧（全件）。
 *
 * リクエスト: { "request": "k-snap_edit" }
 *
 * ⚠️ これは**スタッフ向け**。認証を要求すべきエンドポイントである。
 *
 * ⚠️ show_snap で絞っていない。非公開の写真も含めて管理するため。
 *   owner も暗号化しない。公開ギャラリー向けの k-snap.php と混同しないこと。
 */
$sql = 'SELECT * FROM `k-snap`';
$stmt = $pdo->prepare($sql);
$stmt->execute();
$response_snap = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result =[
    'snaps'=> $response_snap,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);