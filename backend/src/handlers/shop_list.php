<?php

/**
 * 店舗マスタ。ブランド・課・エリア・事業区分。
 *
 * リクエスト: { "request": "shop_list" }
 *
 * ─────────────────────────────────────────────
 * 移行の経緯
 *
 *   もともと `dashboard/api/`（`demand` 形式の旧API）にあったものを、
 *   2026-09-03 に `request` 形式へ移した。SQLとレスポンスの形は変えていない。
 *
 *   ⚠️ 旧APIを叩いていた箇所は3つ。
 *     frontend/src/components/calendar/Calendar.tsx
 *     frontend/src/components/photo/Form.tsx
 *     ksnap-frontend/src/components/Form.tsx
 * ─────────────────────────────────────────────
 *
 * ⚠️ レスポンスは**配列そのもの**を返す。`{ status, ... }` で包まない。
 *   呼び出し側が `res.data.filter(...)` と直接扱っているため、
 *   包むと全箇所が壊れる。
 *
 * ⚠️ show_flag = 1 で絞る。運用を終えた店舗や集計用のダミー行を除くための条件。
 *   `header` 系の店舗編集画面は全件を扱うため、こちらとは条件が違う。
 */

$sql = "SELECT brand, shop, section, area, division
        FROM shop_list WHERE show_flag = 1";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
