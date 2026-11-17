<?php
$category = $data['category'] ?? '';

$allowed_categories = ['order', 'spec', 'used', 'common'];

$roll = $data['roll'] ?? '';

if (!in_array($category, $allowed_categories, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

// ⚠️ v2.2.277: 期間の関数（periodMonths / monthCondition）は core/period.php に移した（店舗別反響推移と共通）
require_once __DIR__ . '/../core/period.php';

if ($roll) {
        require_once __DIR__ . "/listAction/list_{$roll}.php";
} else {
        $listMonths = periodMonths($data);
        if ($listMonths === false) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => '期間の指定が正しくありません'], JSON_UNESCAPED_UNICODE);
                exit;
        }
        require_once __DIR__ . "/listAction/list_{$category}.php";
}


exit;
