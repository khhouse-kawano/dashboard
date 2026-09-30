<?php

/**
 * イベントカレンダーの初期データ。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **旧API（`dashboard/api/` の `demand` 形式）からの移植**（2026-09-30 / v2.2.155）。
 *   ⚠️ 旧: `event_calendar` と `calendar_list` の2回 → ⚠️ **1回にまとめた。**
 *
 * ⚠️ 一覧の取り方は ⚠️ **`core/calendar.php` にまとめてある**（⚠️ 3つの入口で共用）。
 * ─────────────────────────────────────────────
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/calendar.php';

/**
 * ⚠️⚠️ **ログインしている利用者だけに返す。**
 *   ⚠️ ⚠️ **旧APIは合い言葉（Authorization）だけで誰でも叩けた。**
 */
requireStaff($pdo, $headers);

try {
    echo json_encode([
        'event'    => calendarEvents($pdo),
        'reserved' => calendarReserved($pdo),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
