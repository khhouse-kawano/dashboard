<?php

/**
 * イベントの登録。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **旧API（`demand: 'calendar_add'`）からの移植**（2026-09-30 / v2.2.155）。
 *
 * ⚠️ 受け取るもの（Calendar.tsx の `newEventData` をそのまま）:
 *   shop / startDate / endDate / category / title / flag / note / url
 *   ⚠️ reserved / new / next / registered は ⚠️ **登録時は使わない**（あとで実績として入れる）。
 *
 * ⚠️⚠️ **登録後、イベントの一覧をそのまま返す。**
 *   ⚠️ 画面が返り値をそのまま `setCalendar` に入れるため。
 *   ⚠️ ⚠️ **形を変えないこと。** ⚠️ `calendar.php` の `event` と同じ形である。
 *
 * ⚠️ 全店舗へ登録するときは、⚠️ **画面が店舗ごとにこの処理を呼ぶ**（ここは1件ずつ）。
 * ─────────────────────────────────────────────
 */

/**
 * ⚠️⚠️ **ログインしている利用者だけに返す。**
 *   ⚠️ ⚠️ **旧APIは合い言葉（Authorization）だけで誰でも叩けた。**
 *     ⚠️ 移植にあわせて、⚠️ **他の画面と同じトークン確認に揃えてある。**
 */
require_once __DIR__ . '/../core/authz.php';
requireStaff($pdo, $headers);

$title     = trim((string)($data['title'] ?? ''));
$startDate = trim((string)($data['startDate'] ?? ''));
$endDate   = trim((string)($data['endDate'] ?? ''));
$shop      = trim((string)($data['shop'] ?? ''));

// ⚠️ 画面でも見ているが、⚠️ **サーバー側でも必ず確かめる**（画面を経由しない呼び出しがある）
if ($title === '' || $startDate === '' || $endDate === '' || $shop === '') {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'イベント名・開始日・終了日・店舗は必須です。',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $sql = 'INSERT INTO event_calendar
                (startDate, endDate, category, title, shop, flag, `new`, reserved, registered, `next`, note, url)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?)';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $startDate,
        $endDate,
        (string)($data['category'] ?? ''),
        $title,
        $shop,
        // ⚠️ 既定は 1（表示する）。⚠️ **0 で登録すると画面に出ない**
        (int)($data['flag'] ?? 1),
        (string)($data['note'] ?? ''),
        (string)($data['url'] ?? ''),
    ]);

    // ⚠️⚠️ **一覧を返す。** ⚠️ `flag = 1` の条件は calendar.php と揃えること
    $event = $pdo
        ->query('SELECT * FROM event_calendar WHERE flag = 1')
        ->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
