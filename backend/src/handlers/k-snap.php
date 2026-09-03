<?php

/**
 * 公開ギャラリー向けのスナップ写真一覧。
 *
 * リクエスト: { "request": "k-snap" }
 *
 * ⚠️⚠️ これは**顧客向けの公開API**である。認証を要求してはいけない。
 *   要求すると公開ギャラリーが動かなくなる（顧客はスタッフのトークンを持たない）。
 *   認証の一括強化を行うときは必ず除外すること。
 *
 * ⚠️ show_snap = 1 の写真だけを返す。非公開の写真を顧客に見せないための条件。
 *   スタッフ向けの一覧は k-snap_edit（全件・owner も平文）。
 *
 * ⚠️ owner は暗号化して返す。顧客に他人の氏名を見せないため。
 *   ただし「同じ人かどうか」は暗号文の一致で分かる（フロントの絞り込みに必要）。
 *   詳細は core/ksnap.php を参照。
 */

require_once __DIR__ . '/../core/ksnap.php';

$sql = 'SELECT * FROM `k-snap` WHERE show_snap = 1';
$stmt = $pdo->prepare($sql);
$stmt->execute();
$response_snap = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [
    'snaps' => ksnapEncryptOwnerColumn($response_snap),
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
