<?php

require_once __DIR__ . '/authz.php';

/**
 * ─────────────────────────────────────────────
 * ① の入口でのログインの確認（v2.2.272）。index.php が ② への転送より前に1回だけ呼ぶ。
 *
 * ⚠️ 以前は handlers の大半（172本中148本）がトークンを確かめておらず、
 *   画面に書かれた固定の Authorization だけで全顧客の氏名・電話・メールを取り出せた。
 *
 * ⚠️ 2段階で入れる（利用者の了承 2026-11-16）。
 *   段階1（この版）… REQUEST_AUTH_REQUIRED の処理だけトークン必須（無い・無効なら 401）。
 *                    それ以外でトークンが無いものは、通したうえで security_log に auth_missing として残す。
 *   段階2（次の版）… 本番の auth_missing を見て、外部連携の request を REQUEST_AUTH_PUBLIC に足してから、
 *                    REQUEST_AUTH_PUBLIC 以外をすべてトークン必須にする。
 *
 * ⚠️ トークンの付いた要求が無効だったときも、段階1では必須の処理以外は通す（記録はする）。
 * ─────────────────────────────────────────────
 */

/**
 * トークン無しで使ってよい処理（ログインと外部からの取り込み）。記録もしない。
 * ⚠️ 外部（GAS・フォーム・② のサーバー間の呼び出し）が送っている request を足すときはここへ。
 */
const REQUEST_AUTH_PUBLIC = [
    // ログイン
    'login',
    'k-snap_login',
    // 公開フォーム（backend/scripts/brand_form_api・estimate_2l・owners_house_form）
    'campaign_form',
    'estimate_entry',
    'owners_house_application',
    'owners_house_reservation',
    // GAS（backend/scripts/gas）
    'housing_bazar_entry',
    'kagosuma_entry',
    'member_entry',
    'myhomes_entry',
    'tochishinchaku_entry',
    'homes_sale_assessment_entry',
    'owners_house_application_import',
    'catalog_resale_update',
    'homes_db_kaeru',
    'pgh_order',
    // ② からのサーバー間の呼び出し（features/hotlead/importer.ts・features/metaAds/scrape.ts）
    'hotlead',
    'meta_scrape_image',
];

/**
 * 段階1でトークン必須にする処理（顧客の個人情報を返す・直す画面の処理）。
 * ⚠️ どれも画面から apiClient（トークン付き）でだけ呼ばれていることを確認済み（2026-11-16）。
 */
const REQUEST_AUTH_REQUIRED = [
    'cancelList',
    'cancelList_edit_reason',
    'callStatusList',
    'company',
    'customer',
    'customerTrend',
    'database',
    'header_staff_edit',
    'ice_world',
    'information',
    'inside',
    'integrate',
    'interviewLog',
    'interviewLog_update_interview',
    'list',
    'list_resale_sync',
    'lostList',
    'map',
    'past_customer',
    'rank',
    'shopTrend',
];

/**
 * 入口での確認。必須の処理でトークンが無い・無効なら 401 を返して終了する（requireStaff）。
 */
function requestAuthGate(PDO $pdo, array $headers, string $request): void
{
    if (in_array($request, REQUEST_AUTH_PUBLIC, true)) return;

    if (in_array($request, REQUEST_AUTH_REQUIRED, true)) {
        requireStaff($pdo, $headers);
        return;
    }

    // ⚠️ 段階1：通すが、トークンが無い・無効なものは記録する（段階2で外部連携を洗い出すため）
    $token = $headers['Token'] ?? $headers['token'] ?? '';
    if ($token !== '' && getUserByToken($pdo, $token)) return;
    securityLog([
        'event' => 'auth_missing',
        'status' => 200,
        'message' => $token === '' ? 'トークンなし（通した）' : 'トークンが無効（通した）',
    ], $pdo);
}
