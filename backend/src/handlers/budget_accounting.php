<?php

/**
 * 予算（経理）の初期データ。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **旧API（`dashboard/api/` の `demand` 形式）からの移植**（2026-09-30 / v2.2.155）。
 *   ⚠️ ⚠️ **旧APIはサーバーから失われており、PHPは残っていない。**
 *     ⚠️ そのため ⚠️ **画面（BudgetAccounting.tsx）の使い方から起こし直したもの**である。
 *
 * ⚠️⚠️ **旧APIでは4回に分かれていた**（`shop_list_accounting` / `medium_list_accounting`
 *   / `budget_accounting` / `staff_count`）。⚠️ **1回にまとめてある。**
 *   ⚠️ 他の画面（customer / database）と同じ形に揃えた。
 *
 * ⚠️ 集計はしない。⚠️ **行を返すだけで、絞り込みも合計も画面側が行う。**
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
    /**
     * ⚠️ 店舗。
     * ⚠️⚠️ **`shop_list` ではなく `shop_list_accounting`**（⚠️ 経理用の別表）。
     *   ⚠️ ⚠️ **列名は `resister_goal`**（⚠️ DB側の綴りがそうなっている）。
     *     ⚠️ 画面の型は `register_goal` と書いてあるが ⚠️ **読んでいないので直さない。**
     */
    $shop = $pdo->query('SELECT * FROM shop_list_accounting')->fetchAll(PDO::FETCH_ASSOC);

    // ⚠️ 販促媒体。⚠️ **絞り込まない**（画面が `ma_medium` などで振り分ける）
    $medium = $pdo->query('SELECT * FROM medium_list')->fetchAll(PDO::FETCH_ASSOC);

    // ⚠️ 販促費。⚠️ **事業で絞らない**（経理は全事業を横断して見る）
    $budget = $pdo->query('SELECT * FROM budget')->fetchAll(PDO::FETCH_ASSOC);

    // ⚠️ 店舗ごとの人員数。⚠️ `date` は 'YYYY/MM' 相当の text
    $staff = $pdo->query('SELECT * FROM staff_count')->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'shop'   => $shop,
        'medium' => $medium,
        'budget' => $budget,
        'staff'  => $staff,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
