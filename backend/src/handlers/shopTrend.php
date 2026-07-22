<?php

$category = $data['category'] ?? 'order';
$allowed_categories = ['order', 'spec', 'used'];

if (!in_array($category, $allowed_categories, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

require_once __DIR__ . "/shopTrendAction/shopTrend_{$category}.php";

exit;

