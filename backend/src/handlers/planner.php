<?php

$roll = $data['roll'] ?? 'lead';
$allowed_rolls = ['lead', 'detail', 'summary'];

if (!in_array($roll, $allowed_rolls, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

require_once __DIR__ . "/plannerAction/planner_{$roll}.php";

exit;

