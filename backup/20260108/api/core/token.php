<?php

function generateToken() {
    return bin2hex(random_bytes(32));
}

function storeToken($pdo, $userId, $token) {
    $stmt = $pdo->prepare("UPDATE staff SET api_token = ? WHERE mail = ?");
    $stmt->execute([$token, $userId]);
}

function getUserByToken($pdo, $token) {
    $stmt = $pdo->prepare("SELECT * FROM staff WHERE api_token = ?");
    $stmt->execute([$token]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}
