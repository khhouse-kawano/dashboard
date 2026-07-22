<?php

$category = $data['category'] ?? '';

$allowed_categories = ['order', 'spec', 'used', 'common'];

$request = $data['request'] ?? '';


if (!in_array($category, $allowed_categories, true)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
    exit;
}

if ($request) {
    require_once __DIR__ . '/integrateAction/integrate_'  .  $category . '.php';
} else {
    exit;
}

