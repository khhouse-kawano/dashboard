<?php

/**
 * イベントの変更・削除と、実績の登録。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **旧API（`demand: 'calendar_change'`）からの移植**（2026-09-30 / v2.2.155）。
 *
 * ⚠️⚠️ **旧APIは枝分かれを `request` で指定していたが、`roll` に変えてある。**
 *   ⚠️ ⚠️ **新しいゲートウェイでは `request` が振り分けそのものに使われる**ため、
 *     ⚠️ **そのままでは衝突する。**
 *
 *   roll = 'calendar_change'  … イベントの内容を変える → ⚠️ イベント一覧を返す
 *   roll = 'delete_calendar'  … イベントを消す        → ⚠️ イベント一覧を返す
 *   roll = 'response_change'  … 実績を入れる          → ⚠️ 実績一覧を返す
 *
 * ⚠️ 一覧の取り方と実績の書き込みは ⚠️ **`core/calendar.php`** にまとめてある。
 * ─────────────────────────────────────────────
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/calendar.php';

/** ⚠️⚠️ **ログインしている利用者だけ。** ⚠️ 旧APIは合い言葉だけだった */
requireStaff($pdo, $headers);

$roll = (string)($data['roll'] ?? '');
$id   = (int)($data['id'] ?? 0);

/** ⚠️ 実績の区分。⚠️ **1区分が `reserved_calendar` の1行**になる */
const CALENDAR_CATEGORIES = ['reserved', 'new', 'next', 'registered'];

/**
 * ⚠️⚠️ **イベントで変えてよい列。**
 *   ⚠️ ⚠️ **ここに無い名前が来ても無視する。** ⚠️ `flag` や `shop` は変えさせない。
 */
const CALENDAR_EDITABLE = ['title', 'startDate', 'endDate', 'note', 'url'];

/** ⚠️ 画面が送ってきた「変える対象」。⚠️ **リクエストの値なので必ず突き合わせる** */
$targets = is_array($data['requestArray'] ?? null) ? $data['requestArray'] : [];

/** ⚠️ 失敗の返し方をそろえる */
function calendarFail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['status' => 'error', 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // -----------------------------------------------------------------
    // 削除（⚠️ 行は消さず flag を 0 にする）
    // -----------------------------------------------------------------
    if ($roll === 'delete_calendar') {
        if ($id <= 0) calendarFail(400, 'id がありません。');

        $pdo->prepare('UPDATE event_calendar SET flag = 0 WHERE id = ?')->execute([$id]);
        echo json_encode(calendarEvents($pdo), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // -----------------------------------------------------------------
    // イベントの内容を変える
    // -----------------------------------------------------------------
    if ($roll === 'calendar_change') {
        if ($id <= 0) calendarFail(400, 'id がありません。');

        $sets   = [];
        $params = [];
        foreach (CALENDAR_EDITABLE as $column) {
            if (!in_array($column, $targets, true)) continue;
            // ⚠️ 列名は許可リスト由来。⚠️ **値だけプレースホルダで渡す**
            $sets[]   = "`{$column}` = ?";
            $params[] = (string)($data[$column] ?? '');
        }

        // ⚠️ 変える列が無いのはエラーではない。⚠️ **そのまま一覧を返す**
        if ($sets !== []) {
            $params[] = $id;
            $pdo->prepare('UPDATE event_calendar SET ' . implode(', ', $sets) . ' WHERE id = ?')
                ->execute($params);
        }

        echo json_encode(calendarEvents($pdo), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // -----------------------------------------------------------------
    // 実績を入れる
    // -----------------------------------------------------------------
    if ($roll === 'response_change') {
        $shop  = trim((string)($data['shop'] ?? ''));
        $event = trim((string)($data['title'] ?? ''));
        $date  = trim((string)($data['date'] ?? ''));

        if ($shop === '' || $event === '' || $date === '') {
            calendarFail(400, '店舗・イベント名・日付が必要です。');
        }

        foreach (CALENDAR_CATEGORIES as $category) {
            if (!in_array($category, $targets, true)) continue;
            // ⚠️ 追加か更新かは core/calendar.php が判断する（⚠️ **影響行数で判断しない**）
            calendarSaveReserved(
                $pdo, $id, $shop, $event, $date, $category, (int)($data[$category] ?? 0)
            );
        }

        echo json_encode(calendarReserved($pdo), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    calendarFail(400, 'roll が不正です。');
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
