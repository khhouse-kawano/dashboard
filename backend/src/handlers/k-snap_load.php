<?php

/**
 * 編集画面の初期データ。スナップ1件と、登録済みオーナー名の一覧。
 *
 * リクエスト: { "request": "k-snap_load", "id": "" }
 *
 * ⚠️ これは**スタッフ向け**。認証を要求すべきエンドポイントである。
 *
 * ⚠️ id が空でも動く（新規登録の初期表示）。その場合 snap は false になる。
 *   PHP の fetch() が行なしで false を返すため。Express 側も false に揃えること。
 *
 * ⚠️ owner は暗号化しない。スタッフには氏名を見せる必要がある。
 *   公開ギャラリー向けの k-snap.php とはこの点が異なる。
 */
$sql = 'SELECT * FROM `k-snap` WHERE id = ?';
$stmt = $pdo->prepare($sql);
$stmt->execute([$data['id']]);
$response_snap = $stmt->fetch(PDO::FETCH_ASSOC);

$ownersSql = 'SELECT owner FROM `k-snap`';
$ownersStmt = $pdo->prepare($ownersSql);
$ownersStmt->execute();
$response_owner = $ownersStmt->fetchALL(PDO::FETCH_ASSOC);


$result = [
    "snap" => $response_snap,
    "owner" => $response_owner
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
