<?php
$nowMonth = date('Y/m');
$month = isset($data['month']) ? $data['month'] : $nowMonth;

$sql = "SELECT id, inquiry_id, pg_id, mhl_id, mhl_url, mhl_mail, inquiry_date, medium, response_medium, first_name, last_name,
        first_name_kana, last_name_kana, mobile, landline, mail, zip, pref, city, town, street, building, brand, shop, sync, staff, area, 
        reserved_date, black_list, hp_campaign, duplicate, hotlead_url  FROM inquiry_customer ORDER By inquiry_date DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
