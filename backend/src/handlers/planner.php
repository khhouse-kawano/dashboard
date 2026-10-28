<?php

// ⚠️ v2.2.221: ログインと担当事業を確かめる（v2.2.220 までは誰でも読み書きできた）。② の features/realty と同じ条件
require_once __DIR__ . '/../core/authz.php';
$staff = requireShop($pdo, $headers, AUTHZ_REALTY_SHOPS);

$roll = $data['roll'] ?? 'lead';
// ⚠️ v2.2.221: 'detail' を外した（plannerAction/planner_detail.php が無く、呼ぶと PHP の致命的エラーになっていた）
$allowed_rolls = ['lead', 'summary'];

if (!in_array($roll, $allowed_rolls, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

require_once __DIR__ . "/plannerAction/planner_{$roll}.php";

exit;

