<?php

/**
 * カレンダーの「反響集計」で、PGクラウド側の実績を突き合わせるための顧客一覧。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **旧API（`demand: 'customer_list'`）からの移植**（2026-09-30 / v2.2.155）。
 *   ⚠️ ⚠️ **旧APIはサーバーから失われており、PHPは残っていない。**
 *     ⚠️ ⚠️ **画面（calendar/Calendar.tsx）の使い方から起こし直したものである。**
 *
 * ⚠️ 画面での使われ方（「◯月_反響集計」の表）:
 *   ⚠️ **「※()内はPGクラウドに入力された数値」** と書かれており、
 *   ⚠️ カレンダーに手で入れた人数と、この台帳の実績とを ⚠️ **並べて見るためのもの。**
 *
 *     有効新規 … newLength(pgReservedLength)
 *                pgReservedLength = ⚠️ **`reserve` がその月の顧客数**
 *     次アポ   … nextLength(pgNextLength)
 *                pgNextLength = ⚠️ **`reserve` がその月 かつ `second_reserve` がある顧客数**
 *     契約者数 … ⚠️ **`contract` がその月の顧客数**
 *
 * ⚠️⚠️ **日付はスラッシュ区切りのまま返すこと。**
 *   ⚠️ 画面は `c.contract.includes(targetMonth)` で照合しており、
 *     ⚠️ ⚠️ **`targetMonth` は `YYYY/MM`**（例 `2026/09`）である。
 *   ⚠️⚠️ **ハイフンに直すと1件も一致しなくなる。** ⚠️ 台帳の列は元からスラッシュ。
 *
 * ⚠️⚠️ **`reserve` に何を当てるかは推測である。**
 *   ⚠️ 見出しが ⚠️ **「有効新規」**（＝実際に来た新規）であることから、
 *     ⚠️ ⚠️ **来場予約日ではなく初回面談日**を当てている。
 *   ⚠️ ⚠️ **画面の数字が実感と合わない場合、まずここを疑うこと。**
 *
 * ⚠️ `register` と `section` は ⚠️ **画面が読んでいない**（型にあるだけ）。
 *   ⚠️ 元の形に合わせて返してある。
 *
 * ⚠️⚠️ **日付の区切りをスラッシュへ寄せている**（`REPLACE(..., '-', '/')`）。
 *   ⚠️ ⚠️ **台帳には2つの形式が混ざっている**（⚠️ 初回面談で スラッシュ3,602件 / ハイフン2,705件）。
 *   ⚠️ ⚠️ **寄せないと、ハイフンで入っている2,705件が画面の数にまったく入らない。**
 *     ⚠️ 画面は `YYYY/MM` で照合しているため。
 *   ⚠️⚠️ **旧APIが寄せていたかは分からない**（⚠️ PHPが失われている）。
 *     ⚠️ ⚠️ **数が合わないより、拾えるほうを採った。**
 *   ⚠️ `0002-10-05` のような壊れた値も混ざるが、⚠️ **実在の月には一致しないので害はない。**
 * ─────────────────────────────────────────────
 */

/**
 * ⚠️⚠️ **ログインしている利用者だけに返す。**
 *   ⚠️ ⚠️ **旧APIは合い言葉（Authorization）だけで誰でも叩けた。**
 */
require_once __DIR__ . '/../core/authz.php';
requireStaff($pdo, $headers);

try {
    /**
     * ⚠️ 列は ⚠️ **画面が使う6つだけ**。⚠️ 台帳は2万行を超えるため増やさないこと。
     * ⚠️ ⚠️ **注文事業の台帳（`master_data`）を見る。**
     *   ⚠️ カレンダーは注文事業の店舗を並べているため。
     */
    $sql = "
        SELECT
            REPLACE(COALESCE(m.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, ''), '-', '/') AS `register`,
            -- ⚠️⚠️ **初回面談日**（⚠️ 「有効新規」に対応。⚠️ 来場予約日ではない）
            REPLACE(COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, ''), '-', '/') AS reserve,
            -- ⚠️ 第二面談日。⚠️⚠️ **`01JSENACS` を使うこと**（DBコメントは当てにならない）
            REPLACE(COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, ''), '-', '/') AS second_reserve,
            REPLACE(COALESCE(m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, ''), '-', '/') AS contract,
            COALESCE(m.in_charge_store, '') AS shop,
            COALESCE(s.section, '') AS section
          FROM master_data m
          LEFT JOIN (
            SELECT shop, MIN(section) AS section
              FROM shop_list
             WHERE shop <> ''
             GROUP BY shop
          ) s ON s.shop = m.in_charge_store
         WHERE m.show_dashboard = 1
    ";

    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    // ⚠️⚠️ **配列をそのまま返す。** ⚠️ 画面が `response.data` を直接 `setCustomer` に入れる
    echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
