<?php
$token = requireAuthHeader();
$user = getUserByToken($pdo, $token);

if (!$user) {
    http_response_code(401);
    echo json_encode(["error" => "Invalid token"]);
    exit;
}

echo json_encode([
    "mail" => $user['mail'],
    "brand" => $user['brand'],
    "token" => $user['api_token']
]);
