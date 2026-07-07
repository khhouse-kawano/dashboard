<?php
$mail = $data['mail'] ?? '';
$password = $data['password'] ?? '';

$stmt = $pdo->prepare("SELECT * FROM staff WHERE mail = ?");
$stmt->execute([$mail]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode(["message" => "error", "details" => "メールまたはパスワードが違います"]);
    exit;
}

if ($password !== $user['password']) {
    echo json_encode(["message" => "error", "details" => "メールまたはパスワードが違います"]);
    exit;
}

$token = generateToken();
storeToken($pdo, $user['mail'], $token);

echo json_encode([
    "message" => "success",
    "token" => $token,
    "brand" => $user['brand']
]);
