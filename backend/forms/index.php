<?php

/**
 * 公開フォーム用のプロキシ。
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
 * ⚠️⚠️ **このファイルには認証情報を書かないこと。**
 *   ⚠️ 転送するだけの役目である。DB には触らない。
 *
 * ⚠️⚠️ **2026-09-16 に2点を直した。**
 *
 *   1. メールヘッダに入る宛先（mail_to / mail_cc）を**無害化**する
 *   2. デバッグ出力（error_log）を**削除**した
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

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authToken = $headers['Authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? null);

/**
 * ⚠️⚠️ **デバッグ出力は置かないこと。**
 *   ⚠️ 2026-09-16 まで、ここに次の3行があった:
 *       error_log('=== DEBUG HEADERS === ' . print_r($headers, true));
 *       error_log('=== DEBUG HTTP_AUTHORIZATION === ' . ...);
 *       error_log('=== DEBUG TOKEN === ' . ...);
 *   ⚠️ **全リクエストのヘッダをサーバーのログに書き続けていた**（8サイトすべてで）。
 *   ⚠️ 消しても動作は変わらない。戻さないこと。
 */

if (json_last_error() !== JSON_ERROR_NONE || empty($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

if (!$authToken) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Missing Authorization header']);
    exit;
}

/**
 * ⚠️⚠️ **メールヘッダに入る宛先を無害化する。**
 *
 *   ⚠️ 転送先の PHP は `mail_cc` を**検証せずに `Cc:` の行へ入れている**。
 *     改行を含む値を送れば `Bcc:` を追加でき、
 *     **貴社ドメインから任意の宛先へ送信できてしまう**（ヘッダインジェクション）。
 *   ⚠️ 悪用されるとドメインの評判が落ち、**正規のメールが届かなくなる**。
 *
 *   ⚠️ 本来は転送先で直すべきだが、あちらには DB の接続情報が書かれており
 *     触る範囲を小さくしたい。⚠️ **入口で落としておく。**
 *   ⚠️ 転送先を直したあとも、この処理は**残しておいてよい**（二重の防御）。
 *
 * ⚠️⚠️ **改行は「削除」ではなく「カンマに置換」する。**
 *   ⚠️ 削除すると `ok@a.jp\r\nBcc: 悪い宛先` が `ok@a.jpBcc: 悪い宛先` という
 *     1つの不正な文字列になり、**正当な宛先まで丸ごと消える**
 *     （社内通知の Cc が届かなくなる）。
 *   ⚠️ カンマに置き換えれば、正当な分は残り、注入された行だけが落ちる。
 */
function safeAddressList($value)
{
    if (!is_string($value) || $value === '') {
        return '';
    }

    // ⚠️ 改行（CR / LF / タブ）を区切りに変える。ここが本体
    $value = str_replace(array("\r", "\n", "\t"), ',', $value);

    $clean = array();
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && filter_var($one, FILTER_VALIDATE_EMAIL)) {
            $clean[] = $one;
        }
    }

    // ⚠️ 宛先が増えすぎないよう上限を掛ける。通常は数件しかない
    $clean = array_slice(array_unique($clean), 0, 20);

    return implode(',', $clean);
}

// ⚠️ 宛先として使われうるキーだけを通す。⚠️ 他の値は加工しない
foreach (array('mail_to', 'mail_cc') as $key) {
    if (isset($data[$key])) {
        $data[$key] = safeAddressList($data[$key]);
    }
}

$targetUrl = 'https://khg-marketing.info/api/';

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: ' . $authToken
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
