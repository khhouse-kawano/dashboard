<?php
// ログイン権限一覧（staff テーブル）。
//
// ⚠️ 人事マスタ（staff_list）とは別物であり、連携していない。
//   このハンドラは staff のみを返す。以前は section_list / shop_list も
//   返していたが、EditAuth.tsx では使っていない無駄なクエリだったため削除した。
$sql = "SELECT * FROM staff";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$staff = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "staff" => $staff,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
