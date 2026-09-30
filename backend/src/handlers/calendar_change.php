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
 * ⚠️⚠️ **削除は行を消さず `flag = 0` にする。**
 *   ⚠️ ⚠️ **実データに `flag = 0` が129行あり、それが元からの運用である。**
 *
 * ⚠️⚠️ **更新する列は許可リストで決める。**
 *   ⚠️ ⚠️ **`requestArray` はリクエストの値である。** ⚠️ そのままSQLに入れてはならない。
 * ─────────────────────────────────────────────
 */

/**
 * ⚠️⚠️ **ログインしている利用者だけに返す。**
 *   ⚠️ ⚠️ **旧APIは合い言葉（Authorization）だけで誰でも叩けた。**
 *     ⚠️ 移植にあわせて、⚠️ **他の画面と同じトークン確認に揃えてある。**
 */
require_once __DIR__ . '/../core/authz.php';
requireStaff($pdo, $headers);

$roll = (string)($data['roll'] ?? '');
$id   = (int)($data['id'] ?? 0);

/** ⚠️ イベント一覧。⚠️ **`flag = 1` の条件は calendar.php と揃えること** */
function calendarEvents(PDO $pdo): array
{
    return $pdo
        ->query('SELECT * FROM event_calendar WHERE flag = 1')
        ->fetchAll(PDO::FETCH_ASSOC);
}

/** ⚠️ 実績一覧 */
function calendarReserved(PDO $pdo): array
{
    return $pdo
        ->query('SELECT * FROM reserved_calendar')
        ->fetchAll(PDO::FETCH_ASSOC);
}

try {
    // -----------------------------------------------------------------
    // 削除（⚠️ flag を 0 にするだけ）
    // -----------------------------------------------------------------
    if ($roll === 'delete_calendar') {
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'id がありません。'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmt = $pdo->prepare('UPDATE event_calendar SET flag = 0 WHERE id = ?');
        $stmt->execute([$id]);

        echo json_encode(calendarEvents($pdo), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // -----------------------------------------------------------------
    // イベントの内容を変える
    // -----------------------------------------------------------------
    if ($roll === 'calendar_change') {
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'id がありません。'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        /**
         * ⚠️⚠️ **変えてよい列。**
         *   ⚠️ ⚠️ **ここに無い名前が来ても無視する。** ⚠️ `flag` や `shop` は変えさせない。
         */
        $allowed = ['title', 'startDate', 'endDate', 'note', 'url'];
        $targets = is_array($data['requestArray'] ?? null) ? $data['requestArray'] : [];

        $sets   = [];
        $params = [];
        foreach ($allowed as $column) {
            if (!in_array($column, $targets, true)) continue;
            // ⚠️ 列名は許可リスト由来。⚠️ **値だけプレースホルダで渡す**
            $sets[]   = "`{$column}` = ?";
            $params[] = (string)($data[$column] ?? '');
        }

        if ($sets === []) {
            // ⚠️ 変える列が無いのはエラーではない。⚠️ **そのまま一覧を返す**
            echo json_encode(calendarEvents($pdo), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }

        $params[] = $id;
        $stmt = $pdo->prepare('UPDATE event_calendar SET ' . implode(', ', $sets) . ' WHERE id = ?');
        $stmt->execute($params);

        echo json_encode(calendarEvents($pdo), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // -----------------------------------------------------------------
    // 実績を入れる
    // -----------------------------------------------------------------
    if ($roll === 'response_change') {
        /**
         * ⚠️⚠️ **実績の区分。** ⚠️ 1区分が `reserved_calendar` の1行になる。
         *   ⚠️ ⚠️ **`reserved_calendar` に一意キーが無い**ので、
         *     ⚠️ **更新してみて0件なら追加する**（⚠️ `ON DUPLICATE KEY` は使えない）。
         */
        $categories = ['reserved', 'new', 'next', 'registered'];
        $targets    = is_array($data['requestArray'] ?? null) ? $data['requestArray'] : [];

        $shop  = trim((string)($data['shop'] ?? ''));
        $event = trim((string)($data['title'] ?? ''));
        $date  = trim((string)($data['date'] ?? ''));

        if ($shop === '' || $event === '' || $date === '') {
            http_response_code(400);
            echo json_encode([
                'status'  => 'error',
                'message' => '店舗・イベント名・日付が必要です。',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        /**
         * ⚠️⚠️ **先に「その行があるか」を見る。**
         *
         * ⚠️ ⚠️ **`UPDATE` の影響行数で判断してはならない。**
         *   ⚠️⚠️ **MySQL は値が変わらなかった UPDATE を「0行」と数える。**
         *     ⚠️ そのため「同じ件数をもう一度送る」と ⚠️ **行が二重に増える。**
         *   ⚠️ ⚠️ **実際にこれを踏んだ**（2026-09-30 の検証で `new=3` が2行になった）。
         */
        $find = $pdo->prepare(
            'SELECT id FROM reserved_calendar
              WHERE shop = ? AND event = ? AND date = ? AND category = ?
              LIMIT 1'
        );
        $update = $pdo->prepare('UPDATE reserved_calendar SET count = ? WHERE id = ?');
        $insert = $pdo->prepare(
            'INSERT INTO reserved_calendar (event_id, shop, event, date, count, category)
             VALUES (?, ?, ?, ?, ?, ?)'
        );

        foreach ($categories as $category) {
            if (!in_array($category, $targets, true)) continue;

            $count = (int)($data[$category] ?? 0);

            $find->execute([$shop, $event, $date, $category]);
            $existing = $find->fetchColumn();

            if ($existing !== false) {
                $update->execute([$count, (int)$existing]);
            } else {
                /**
                 * ⚠️ `event_id` は ⚠️ **ほとんどの行で 0** である（実測 9,409行中 6,603行）。
                 *   ⚠️ 突き合わせは店舗・イベント名・日付で行うため、⚠️ **0 のままでよい。**
                 */
                $insert->execute([$id, $shop, $event, $date, $count, $category]);
            }
        }

        echo json_encode(calendarReserved($pdo), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'roll が不正です。',
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
