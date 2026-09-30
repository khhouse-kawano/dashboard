<?php

/**
 * イベントカレンダーの初期データ。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **旧API（`dashboard/api/` の `demand` 形式）からの移植**（2026-09-30 / v2.2.155）。
 *   ⚠️ 旧: `event_calendar` と `calendar_list` の2回 → ⚠️ **1回にまとめた。**
 *
 * ⚠️⚠️ **`flag = 1` の行だけ返す。**
 *   ⚠️ ⚠️ **削除は行を消さず `flag = 0` にする運用**である（⚠️ 実データに129行ある）。
 *   ⚠️ ⚠️ **この条件を外すと、削除したイベントが画面に戻る。**
 *
 * ⚠️ `reserved_calendar` は ⚠️ **イベント×日×店舗×区分ごとの実績**
 *   （⚠️ 区分は `reserved` / `new` / `next` / `registered`）。
 *   ⚠️ ⚠️ **`event_id` はほとんど 0 で、突き合わせは店舗・イベント名・日付で行う。**
 * ─────────────────────────────────────────────
 */

/**
 * ⚠️⚠️ **ログインしている利用者だけに返す。**
 *   ⚠️ ⚠️ **旧APIは合い言葉（Authorization）だけで誰でも叩けた。**
 *     ⚠️ 移植にあわせて、⚠️ **他の画面と同じトークン確認に揃えてある。**
 */
require_once __DIR__ . '/../core/authz.php';
requireStaff($pdo, $headers);

try {
    $event = $pdo
        ->query('SELECT * FROM event_calendar WHERE flag = 1')
        ->fetchAll(PDO::FETCH_ASSOC);

    $reserved = $pdo
        ->query('SELECT * FROM reserved_calendar')
        ->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'event'    => $event,
        'reserved' => $reserved,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
