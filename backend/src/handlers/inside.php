<?php

$roll = $data['roll'] ?? 'list';
$allowed_rolls = ['list'];

if (!in_array($roll, $allowed_rolls, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

require_once __DIR__ . "/insideAction/inside_{$roll}.php";

exit;

