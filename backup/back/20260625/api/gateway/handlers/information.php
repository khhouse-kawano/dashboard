<?php

$category = $data['category'] ?? '';

$allowed_categories = ['order', 'spec', 'used', 'common'];

$roll = $data['roll'] ?? '';

if (!in_array($category, $allowed_categories, true)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
    exit;
}

if ($roll) {
    require_once __DIR__ . '/informationAction/information' . ($category === 'common' ? '' : '_' . $category) . '_' . $roll . '.php';
} else {
    require_once __DIR__ . "/informationAction/information_{$category}.php";
}


exit;
