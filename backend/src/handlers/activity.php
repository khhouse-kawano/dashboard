<?php

// ⚠️ v2.2.221: ログインと担当事業を確かめる（v2.2.220 までは誰でも読み書きできた）。② の features/realty と同じ条件
require_once __DIR__ . '/../core/authz.php';
$staff = requireShop($pdo, $headers, AUTHZ_REALTY_SHOPS);
// ⚠️ 通知の宛先は画面が送る to ではなく、ログインしている本人（空白を除いた名前で突き合わせる）
$data['to'] = preg_replace('/[\s　]/u', '', (string)($staff['name'] ?? ''));

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
