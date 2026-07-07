<?php
$mail = $data['mail'] ?? '';

$stmt = $pdo->prepare("SELECT * FROM staff WHERE mail = ?");
$stmt->execute([$mail]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode(["message" => "error", "details" => "メールまたはパスワードが違います"]);
    exit;
}

session_start();
$timestamp = date('Y/m/d H:i');

$stmt = $pdo->prepare("INSERT INTO login_log (timestamp, staff) VALUES (?, ?)");
$stmt->execute([$timestamp, $user['name']]);

$token = generateToken();
storeToken($pdo, $user['mail'], $token);

echo json_encode([
    "message" => "success",
    "token" => $token,
    "brand" => $user['brand'] ?? '',
    "userName" => $user['name'] ?? ''
]);
