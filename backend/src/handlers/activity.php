<?php

// 監査ログ（kind:'logs'）と通知（kind:'notices'）の参照・既読化。
//
// これらは brokerage_listings に同居しているが、案件一覧（planner）とは
// 性質も件数の増え方も違う。planner が全件返しているのに相乗りすると
// レコードが増えるほど一覧の取得が重くなるため、別系統として切り出している。
$roll = $data['roll'] ?? 'history';
$allowed_rolls = ['history', 'notice', 'read'];

if (!in_array($roll, $allowed_rolls, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです'], JSON_UNESCAPED_UNICODE);
        exit;
}

require_once __DIR__ . "/activityAction/activity_{$roll}.php";

exit;
