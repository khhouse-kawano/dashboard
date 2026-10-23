<?php

/**
 * オーナーズハウス募集フォームの中継（kh-house.jp/owners_house/form/api.php）。（v2.2.215）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **転送するだけ。DB には触らない。このファイルには認証情報を書かないこと。**
 *   ブラウザ（同じサイト）──multipart──▶ ここ ──multipart──▶ ① https://khg-marketing.info/dashboard/api/gateway/
 *     （request: owners_house_application → handlers/owners_house_application.php）
 *   ⚠️ ブラウザから khg-marketing.info へ直接送らせないための中継（広告で除外されたドメインのため）。
 * ⚠️ 写真はここでは保存しない（① が中身を確かめて保存する）。⚠️ 受け取る項目と写真の名前は決め打ち。
 * ─────────────────────────────────────────────
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'POST only']);
    exit;
}

/** ⚠️ 転送先。⚠️ 環境変数はテスト用（本番では設定しない） */
$targetUrl = getenv('OWNERS_HOUSE_GATEWAY_URL') ?: 'https://khg-marketing.info/dashboard/api/gateway/';

$fields = ['website_url', 'name', 'zip', 'shop', 'staff', 'photo_mode', 'title', 'feature1', 'feature2', 'feature3', 'feature4', 'feature5'];
$post = ['request' => 'owners_house_application'];
foreach ($fields as $key) {
    $value = $_POST[$key] ?? '';
    $post[$key] = is_string($value) ? mb_substr($value, 0, 500, 'UTF-8') : '';
}

for ($i = 1; $i <= 5; $i++) {
    $file = $_FILES['photo' . $i] ?? null;
    if (!is_array($file) || (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        continue;
    }
    if (!is_uploaded_file((string)$file['tmp_name'])) {
        continue;
    }
    // ⚠️ ファイル名・形式はこちらで決める（中身の確認は ① が行う）
    $post['photo' . $i] = new CURLFile((string)$file['tmp_name'], 'image/jpeg', 'photo' . $i . '.jpg');
}

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode === 0) {
    error_log('owners_house_form/api.php: 転送に失敗しました: ' . $curlError);
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => '通信エラーが発生しました。時間をおいて再度お試しください。'], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code($httpCode);
echo $response;
