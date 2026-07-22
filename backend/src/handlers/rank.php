<?php
$memo = $data['memo'] ?? '';
if ($memo) {
        require_once __DIR__ . "/rankAction/rank_memo.php";
}

$category = $data['category'] ?? 'order';
$allowed_categories = ['order', 'spec', 'used'];

$rank = $data['rank'] ?? '';
$rankPeriod = $data['rank_period'] ?? '';
$isUpdate = ($rank || $rankPeriod);

if (!in_array($category, $allowed_categories, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

if ($isUpdate) {
        require_once __DIR__ . "/rankAction/rank_{$category}_update_rank.php";
} else {
        require_once __DIR__ . "/rankAction/rank_{$category}.php";
}

exit;
