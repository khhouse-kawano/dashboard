<?php

/**
 * 公開フォーム用のプロキシ（② が落ちたときの退避先）。（v2.2.213 で転送先を付け替えた）
 *
 * 配置先: 各ブランドサイトの `form/api/index.php`（**8サイト**）
 *
 *   https://kh-house.jp/form/api/
 *   https://day-just-house.com/form/api/
 *   https://www.nagomi-koumuten.jp/form/api/
 *   https://furukomi-home.com/form/api/
 *   https://2lhome.net/form/api/
 *   https://miyazaki.pg-house.jp/form/api/
 *   https://jusfy-home.com/form/api/
 *   https://kh-house.jp/khg/form/api/
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **このファイルには認証情報を書かないこと。** 転送するだけの役目である。DB には触らない。
 *
 * ⚠️⚠️ **2026-10-23（v2.2.213）に転送先を付け替えた。**
 *   ⚠️ 以前の転送先 `https://khg-marketing.info/api/`（Authorization ヘッダで振り分ける PHP）は**誤って消えた**。
 *   ⚠️ 新しい転送先は ① ダッシュボードのゲートウェイ `https://khg-marketing.info/dashboard/api/gateway/` の
 *     `campaign_form`（handlers/campaign_form.php。② の campaign_form の予備）。
 *   ⚠️ ゲートウェイは本文の `request` / `roll` で振り分けるので、ヘッダを読み替えて本文に入れる:
 *       Authorization: form_get      → request: campaign_form, roll: public（フォームの設定の読み込み）
 *       Authorization: form_register → request: campaign_form, roll: entry （反響の受付）
 *   ⚠️ それ以外の Authorization は断る（以前の転送先にあった他の口は、ここからは使われていない）。
 *
 * ⚠️ 公開フォーム（form_get の gateway.ts）は ② に届かなかったときだけここへ来る。ふだんは使われない。
 *
 * ⚠️⚠️ **2026-09-16 に直した2点はそのまま残す。**
 *   1. メールヘッダに入る宛先（mail_to / mail_cc）の無害化（受け側は使わないが二重の防御）
 *   2. デバッグ出力（error_log でヘッダを書き出していた）を置かない
 * ─────────────────────────────────────────────
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

/** ⚠️ 転送先。⚠️ 環境変数はテスト用（本番のブランドサイトでは設定しない） */
$targetUrl = getenv('FORM_GATEWAY_URL') ?: 'https://khg-marketing.info/dashboard/api/gateway/';

/** Authorization ヘッダ → ゲートウェイの roll */
$rolls = [
    'form_get' => 'public',
    'form_register' => 'entry',
];

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authToken = $headers['Authorization'] ?? ($headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? null));

// ⚠️⚠️ デバッグ出力は置かないこと（以前は全リクエストのヘッダをログに書き続けていた）

if (json_last_error() !== JSON_ERROR_NONE || !is_array($data) || empty($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

if (!$authToken) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Missing Authorization header']);
    exit;
}

if (!isset($rolls[$authToken])) {
    http_response_code(404);
    echo json_encode(['status' => 'error', 'message' => 'Unknown Authorization']);
    exit;
}

/**
 * ⚠️ メールヘッダに入りうる宛先を無害化する（⚠️ 改行は「削除」ではなく「カンマに置換」）。
 * ⚠️ 受け側（campaign_form.php）は通知先を form_table から引くので使わないが、二重の防御として残す。
 */
function safeAddressList($value)
{
    if (!is_string($value) || $value === '') {
        return '';
    }
    $value = str_replace(array("\r", "\n", "\t"), ',', $value);
    $clean = array();
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && filter_var($one, FILTER_VALIDATE_EMAIL)) {
            $clean[] = $one;
        }
    }
    return implode(',', array_slice(array_unique($clean), 0, 20));
}

foreach (array('mail_to', 'mail_cc') as $key) {
    if (isset($data[$key])) {
        $data[$key] = safeAddressList($data[$key]);
    }
}

// ⚠️ ゲートウェイの振り分けに使う値。⚠️ フォームが送ってきた request / roll は上書きする
$data['request'] = 'campaign_form';
$data['roll'] = $rolls[$authToken];

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data, JSON_UNESCAPED_UNICODE));
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 25);

$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode === 0) {
    error_log('form/api: 転送に失敗しました: ' . $curlError);
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => '通信エラーが発生しました。']);
    exit;
}

http_response_code($httpCode);
echo $response;
