<?php

/**
 * ログアウト（v2.2.242 新規）。右上のパネル（frontend/src/components/ActiveUser.tsx）のボタンから呼ぶ。
 *
 * リクエスト:
 *   { "request": "logout" }（⚠️ トークンは Token ヘッダー。apiClient が付ける）
 *
 * ─────────────────────────────────────────────
 * ⚠️ staff.api_token を空にする。⚠️ api_token は1人1本なので、⚠️ **ほかの端末でも同時にログアウトになる**
 *   （⚠️ ログインし直すと別の端末が落ちるのと同じ仕組み。login.php の注記を参照）。
 * ⚠️ 最後のログアウト日時（staff.last_logout_at）と、セキュリティログに logout を残す。
 * ⚠️ トークンが無効でも、画面は自分の保存した値を消してログイン画面へ移る（frontend/src/utils/logout.ts）。
 * ─────────────────────────────────────────────
 */

require_once __DIR__ . '/../core/authz.php';

$staff = requireStaff($pdo, $headers);
$token = $headers['Token'] ?? $headers['token'] ?? '';

try {
    // ⚠️ トークンも条件に入れる（⚠️ 調べてから空にするまでの間に、別の端末で入り直した新しいトークンは消さない）
    $stmt = $pdo->prepare("UPDATE staff SET api_token = '', last_logout_at = NOW() WHERE id = ? AND api_token = ?");
    $stmt->execute([$staff['id'], $token]);
} catch (PDOException $e) {
    error_log('logout: 更新に失敗しました（' . $e->getMessage() . '）');
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'ログアウトの記録に失敗しました。'], JSON_UNESCAPED_UNICODE);
    exit;
}

securityLog(['event' => 'logout', 'status' => 200, 'staff' => $staff], $pdo);

echo json_encode(['status' => 'ok'], JSON_UNESCAPED_UNICODE);
