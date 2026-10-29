<?php

/**
 * 認証（誰か）と認可（何をしてよいか）。
 *
 * この2つは別物である。
 *   認証 … staff.api_token でスタッフを特定する
 *   認可 … そのスタッフが操作を実行してよいかを判定する
 *
 * フロントエンドでボタンを隠すのは「見せない」だけで、認可ではない。
 * APIを直接叩けば実行できてしまうため、サーバー側で必ず判定する。
 *
 * ※ 既存の181ハンドラの挙動は変更していない。
 *   課金や個人情報の一括取得を伴う、今回追加した処理にのみ適用する。
 */

/**
 * 権限として認める値。
 * staff.brand の値をそのまま権限として使っている（login.php が authority として返す）。
 */
const AUTHZ_MASTER = 'Master';

/**
 * トークンからスタッフを特定する。特定できなければ 401 を返して終了する。
 *
 * @param array $headers getallheaders() の結果（db.php が $headers として用意している）
 * @return array staff テーブルの1行
 */
function requireStaff(PDO $pdo, array $headers): array
{
    $token = $headers['Token'] ?? $headers['token'] ?? '';
    $staff = ($token === '') ? false : getUserByToken($pdo, $token);

    if (!$staff) {
        http_response_code(401);
        echo json_encode(
            ['status' => 'error', 'message' => '認証が必要です。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    return $staff;
}

/**
 * 指定した権限を持っているかを確認する。持っていなければ 403 を返して終了する。
 *
 * 完全一致で判定する。'BrandAdimn' のようなタイプミスは通さない
 * （権限名の表記ゆれがそのまま権限漏れになるのを防ぐため）。
 *
 * @param string[] $allowed 許可する権限名
 */
function requireAuthority(array $staff, array $allowed): void
{
    $authority = (string)($staff['brand'] ?? '');

    if (!in_array($authority, $allowed, true)) {
        // 誰が何を拒否されたかは追えるようにしておく
        error_log(sprintf(
            'authz denied: staff_id=%s authority=%s required=%s',
            $staff['id'] ?? '?',
            $authority === '' ? '(空)' : $authority,
            implode('/', $allowed)
        ));

        http_response_code(403);
        echo json_encode(
            ['status' => 'error', 'message' => 'この操作を行う権限がありません。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
}

/**
 * 認証と「Master権限であること」の確認をまとめて行う。
 * 課金・個人情報の一括取得・APIキー操作で使う。
 */
function requireMaster(PDO $pdo, array $headers): array
{
    $staff = requireStaff($pdo, $headers);
    requireAuthority($staff, [AUTHZ_MASTER]);
    return $staff;
}

/**
 * 「Claudeによる分析」を使える権限（v2.2.217）。② の AI_ANALYSIS_AUTHORITY と同じ値にすること。
 */
const AUTHZ_KPI_ANALYSIS = ['Master', 'BrandAdmin', 'Manager'];

/**
 * 不動産企画係（realty）の画面を使える担当事業（v2.2.221）。② の REALTY_SHOPS / BROKER_SHOPS と同じ値にすること。
 *   媒介台帳（broker）は中古の顧客DB・顧客詳細も読み書きするため used も可。
 */
// ⚠️ v2.2.227: estate（建売・中古・不動産企画係）も入れる（② の features/realty/index.ts と同じ）
const AUTHZ_REALTY_SHOPS = ['realty', 'estate', 'all'];
const AUTHZ_BROKER_SHOPS = ['realty', 'estate', 'all', 'used'];

/**
 * 認証と「担当事業（staff.shop）が許されていること」の確認（v2.2.221）。
 * ⚠️ 権限（staff.brand）ではなく担当事業で判定する。持っていなければ 403 を返して終了する。
 */
function requireShop(PDO $pdo, array $headers, array $allowedShops): array
{
    $staff = requireStaff($pdo, $headers);
    $shop = (string)($staff['shop'] ?? '');
    if (!in_array($shop, $allowedShops, true)) {
        error_log(sprintf('authz denied: staff_id=%s shop=%s required=%s', $staff['id'] ?? '?', $shop === '' ? '(空)' : $shop, implode('/', $allowedShops)));
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'この操作を行う権限がありません。'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $staff;
}

/** 認証と「Claudeによる分析を使える権限であること」の確認（保存済みの定型分析の閲覧で使う） */
function requireKpiAnalyst(PDO $pdo, array $headers): array
{
    $staff = requireStaff($pdo, $headers);
    requireAuthority($staff, AUTHZ_KPI_ANALYSIS);
    return $staff;
}
