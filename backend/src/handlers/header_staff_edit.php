<?php
// 人事マスタ（staff_list）の一覧。
//
// ⚠️ メールアドレスは画面で使わないため返さない。
//   ログイン用メールアドレスは staff テーブル側の情報であり、
//   EditAuth（header_edit_auth）が扱う。不要な個人情報を
//   フロントに流さないためここで落としている。
$sql = "SELECT * FROM staff_list";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$staff = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($staff as &$row) {
    unset($row['mail']);
}
unset($row);

$sql_section = "SELECT * FROM section_list";
$stmt_section = $pdo->prepare($sql_section);
$stmt_section->execute();
$section = $stmt_section->fetchAll(PDO::FETCH_ASSOC);

$sql_shop = "SELECT * FROM shop_list";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

// 新規登録時の氏名サジェスト用。ログイン権限テーブル（staff）の氏名を返す。
// ⚠️ staff と staff_list は連携していないため、これはあくまで
//   「入力の手間を省くための候補」であり、両テーブルを紐付けるものではない。
//   個人情報を増やさないよう氏名のみを返す（メールアドレス等は含めない）。
$sql_auth_name = "SELECT DISTINCT `name` FROM `staff` WHERE `name` <> '' ORDER BY `name`";
$stmt_auth_name = $pdo->prepare($sql_auth_name);
$stmt_auth_name->execute();
$auth_names = $stmt_auth_name->fetchAll(PDO::FETCH_COLUMN);

echo json_encode([
    "staff" => $staff,
    "section" => $section,
    "shop" => $shop,
    "auth_names" => $auth_names
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
