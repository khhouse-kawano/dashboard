<?php

/**
 * イベントカレンダーの読み出し。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **一覧の取り方をここ1箇所にまとめてある。**
 *
 * ⚠️ ⚠️ **`calendar.php` / `calendar_add.php` / `calendar_change.php` の3つが
 *   ⚠️ 同じ一覧を返す。** ⚠️ それぞれにSQLを書くと、
 *   ⚠️⚠️ **片方だけ条件を直したときに「登録直後だけ表示が違う」という
 *   ⚠️ 気づきにくい食い違いが生まれる。**
 *
 * ⚠️ 2026-09-30（v2.2.155）に旧APIから移植した際、⚠️ **3箇所に同じSQLを書いていたのを
 *   ⚠️ ここへ寄せた。**
 * ─────────────────────────────────────────────
 */

/**
 * イベントの一覧。
 *
 * ⚠️⚠️ **`flag = 1` だけを返す。**
 *   ⚠️ ⚠️ **削除は行を消さず `flag = 0` にする運用**である
 *     （⚠️ 実データに129行ある。⚠️ **旧APIからの引き継ぎ**）。
 *   ⚠️ ⚠️ **この条件を外すと、削除したイベントが画面に戻る。**
 */
function calendarEvents(PDO $pdo): array
{
    return $pdo
        ->query('SELECT * FROM event_calendar WHERE flag = 1')
        ->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * 実績の一覧。
 *
 * ⚠️ イベント×日×店舗×区分ごとの人数
 *   （⚠️ 区分は `reserved` / `new` / `next` / `registered`）。
 * ⚠️⚠️ **`event_id` はほとんど 0** なので、⚠️ **突き合わせは店舗・イベント名・日付で行う。**
 */
function calendarReserved(PDO $pdo): array
{
    return $pdo
        ->query('SELECT * FROM reserved_calendar')
        ->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * 実績を1件書き込む（無ければ追加、あれば更新）。
 *
 * ⚠️⚠️ **先に「その行があるか」を見ること。**
 *   ⚠️ ⚠️ **`UPDATE` の影響行数で判断してはならない。**
 *     ⚠️⚠️ **MySQL は値が変わらなかった UPDATE を「0行」と数える。**
 *     ⚠️ そのため「同じ人数をもう一度送る」と ⚠️ **行が二重に増える。**
 *   ⚠️ ⚠️ **実際にこれを踏んだ**（2026-09-30 の検証で `new=3` が2行になった）。
 *
 * ⚠️ `reserved_calendar` に一意キーが無いため、⚠️ **`ON DUPLICATE KEY` は使えない。**
 */
function calendarSaveReserved(
    PDO $pdo,
    int $eventId,
    string $shop,
    string $event,
    string $date,
    string $category,
    int $count
): void {
    $find = $pdo->prepare(
        'SELECT id FROM reserved_calendar
          WHERE shop = ? AND event = ? AND date = ? AND category = ?
          LIMIT 1'
    );
    $find->execute([$shop, $event, $date, $category]);
    $existing = $find->fetchColumn();

    if ($existing !== false) {
        $pdo->prepare('UPDATE reserved_calendar SET count = ? WHERE id = ?')
            ->execute([$count, (int)$existing]);
        return;
    }

    $pdo->prepare(
        'INSERT INTO reserved_calendar (event_id, shop, event, date, count, category)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$eventId, $shop, $event, $date, $count, $category]);
}
