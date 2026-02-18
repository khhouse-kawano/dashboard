<?php
$brand = isset($data['brand']) ? $data['brand'] : "";
$campaign = isset($data['campaign']) ? $data['campaign'] : "";
$campaign_id = isset($data['campaign_id']) ? $data['campaign_id'] : "";
$mail_to = isset($data['mail_to']) ? $data['mail_to'] : "";
$mail_cc = isset($data['mail_cc']) ? $data['mail_cc'] : "";
$redirect = isset($data['redirect']) ? $data['redirect'] : "";
$notice = isset($data['notice']) ? $data['notice'] : "";
$shop = isset($data['shop']) ? $data['shop'] : "";
$date = isset($data['date']) ? $data['date'] : "";
$name = isset($data['name']) ? $data['name'] : "";
$kana = isset($data['kana']) ? $data['kana'] : "";
$age = isset($data['age']) ? $data['age'] : "";
$phone = isset($data['phone']) ? $data['phone'] : "";
$mail = isset($data['mail']) ? $data['mail'] : "";
$address = isset($data['address']) ? $data['address'] : "";
$medium = isset($data['medium']) ? $data['medium'] : "";
$question = isset($data['question']) ? $data['question'] : "";

$sql = "INSERT INTO form_database ( brand, campaign, campaign_id, mail_to, mail_cc, redirect, notice, shop, date, name, kana, age, phone, mail, address, medium, question)
        VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

$stmt = $pdo->prepare($sql);
$stmt->execute([$brand, $campaign, $campaign_id, $mail_to, $mail_cc, $redirect, $notice, $shop, $date, $name, $kana, $age, $phone, $mail, $address, $medium, $question]);

if ($stmt) {
    $response = ['status' => 'success', 'message' => '登録完了しました'];
} else {
    $response = ['status' => 'error', 'message' => '登録エラー'];
}
echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
