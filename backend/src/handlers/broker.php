<?php

$roll = $data['roll'] ?? 'list';
$allowed_rolls = ['list', 'update', 'customer', 'report'];

if (!in_array($roll, $allowed_rolls, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

require_once __DIR__ . "/brokerAction/broker_{$roll}.php";

exit;

