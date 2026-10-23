<?php

/**
 * 2L 簡単見積もりの送信先（2lhome.net/mitsumori/result_api.php）。（v2.2.216 で送り先を付け替えた）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 以前は Heroku の中継（polar-journey…/update）→ ① khg-marketing.info/api/ へ送っていた。
 *   ⚠️ その php が誤って消え、2026-09 上旬から反響が入っていなかった。
 * ⚠️ 新しい送り先:
 *   1. ② https://api.khg-marketing.info/api/gateway （request: estimate_entry）
 *   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
 *      （サーバーからの送信なので ① へ直接送ってよい。① の handlers/estimate_entry.php が同じ処理をする）
 * ⚠️ 通知先・お礼メールを送るかどうかは受け側が form_table（2l / 20250000_2l_mitsumori）から引く。⚠️ ここで決めない。
 * ⚠️ url_params / landing_params は index.html に足す params.js がフォームに入れて送ってくる。
 * ⚠️ 入力の受け取り方・見積もりの中身の組み立ては以前のまま（⚠️ 画面は今後相談して作り直す）。
 * ─────────────────────────────────────────────
 */

session_start();

// ⚠️ 送り先。⚠️ 環境変数はテスト用（本番では設定しない）
define('ESTIMATE_EXPRESS_URL', getenv('ESTIMATE_EXPRESS_URL') ?: 'https://api.khg-marketing.info/api/gateway');
define('ESTIMATE_PHP_URL', getenv('ESTIMATE_PHP_URL') ?: 'https://khg-marketing.info/dashboard/api/gateway/');
const ESTIMATE_RESULT_URL = 'https://2lhome.net/mitsumori_result/';

// 1. 受信データをまとめる（以前のまま）
$input = [
    'wall'        => $_POST['wall']               ?? '',
    'sash'        => $_POST['sash']               ?? '',
    'roof'        => $_POST['roof']               ?? '',
    'entrance'    => $_POST['entrance']           ?? '',
    'eave'        => $_POST['eave']               ?? '',
    'interior'    => $_POST['interior_value']     ?? '',
    'madori'      => $_POST['madori']             ?? '',
    'option1'     => $_POST['option1']            ?? '',
    'option2'     => $_POST['option2']            ?? '',
    'option3'     => $_POST['option3']            ?? '',
    'option4'     => $_POST['option4']            ?? '',
    'option5'     => $_POST['option5']            ?? '',
    'option6'     => $_POST['option6']            ?? '',
    'option7'     => $_POST['option7']            ?? '',
    'option8'     => $_POST['option8']            ?? '',
    'option9'     => $_POST['option9']            ?? '',
    'name'        => $_POST['f_item_name']        ?? '',
    'name_kana'   => $_POST['f_item_name_kana']   ?? '',
    'mail'        => $_POST['f_item_mail']        ?? '',
    'tel'         => $_POST['f_item_tel']         ?? '',
    'zip'         => $_POST['f_item_zip']         ?? '',
    'pref'        => $_POST['f_item_pref']        ?? '',
    'city'        => $_POST['f_item_city']        ?? '',
    'street'      => $_POST['f_item_address_street']   ?? '',
    'building'    => $_POST['f_item_address_building'] ?? '',
    'media'       => 'SNS広告',
];

// 2. セッションにも保存（以前のまま。結果ページが使う）
$_SESSION = array_merge($_SESSION, $input);

// 3. question文字列を組み立てる（以前のまま）
$modelMap = [
    1 => "No.64 S-21 3LDK 平屋 … 1158.3万円",
    2 => "No.65 S-22 2LDK 平屋 … 1207.8万円",
];
$optionsMap = [
    'option1' => [1 => '太陽光発電システム'],
    'option2' => [2 => '浴室乾燥機'],
];

$question = $modelMap[intval($input['madori'])] ?? '';
foreach ($optionsMap as $key => $map) {
    $val = intval($input[$key]);
    if (isset($map[$val])) {
        $question .= ' ' . $map[$val];
    }
}

/** URL パラメータ（? 以降）。⚠️ 長すぎる値は切る */
function estimateParam(string $key): string
{
    $value = $_POST[$key] ?? '';
    return is_string($value) ? mb_substr(ltrim($value, '?'), 0, 2000, 'UTF-8') : '';
}

// 4. 送る内容
$apiData = [
    'request'        => 'estimate_entry',
    'sei'            => $input['name'],
    'mei'            => '',
    'seiKana'        => $input['name_kana'],
    'meiKana'        => '',
    'medium'         => 'SNS広告',
    'date'           => '',
    'time'           => '',
    'age'            => '',
    'mail'           => $input['mail'],
    'phone'          => $input['tel'],
    'zip'            => $input['zip'],
    'pref'           => $input['pref'],
    'city'           => $input['city'],
    'town'           => $input['street'],
    'street'         => $input['building'],
    'question'       => trim($question),
    'campaign'       => '20250000【2L鹿児島】簡単見積もり',
    'campaign_id'    => '20250000_2l_mitsumori',
    'brand'          => '2l',
    'shop'           => '鹿児島店',
    'url'            => 'https://2lhome.net/mitsumori/',
    'source'         => 'mitsumori',
    'url_params'     => estimateParam('url_params'),
    'landing_params' => estimateParam('landing_params'),
];

if (!($apiData['sei'] && $apiData['seiKana'] && $apiData['mail'] && $apiData['phone'] && $apiData['zip'] && $apiData['pref'] && $apiData['city'] && $apiData['town'])) {
    echo '<script>alert("未入力の項目があります。"); history.back();</script>';
    exit;
}

/**
 * 送る。② → だめなら ①。⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。
 * ⚠️ 戻り値は [HTTP の番号, 応答の本文（配列）]
 */
function estimatePost(array $data): array
{
    foreach ([ESTIMATE_EXPRESS_URL, ESTIMATE_PHP_URL] as $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json; charset=utf-8'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT        => 20,
        ]);
        $response = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($response === false || $code === 0) {
            error_log("mitsumori/result_api.php: 送信エラー {$url}: {$error}");
            continue;
        }
        if ($code >= 500) {
            error_log("mitsumori/result_api.php: {$url} が {$code} を返しました");
            continue;
        }
        $body = json_decode($response, true);
        return [$code, is_array($body) ? $body : []];
    }
    return [0, []];
}

[$code, $data] = estimatePost($apiData);

if ($code === 200 && ($data['status'] ?? '') === 'success') {
    header('Location: ' . ESTIMATE_RESULT_URL);
    exit;
}

$errorMsg = $code === 0
    ? '通信エラーが発生しました。再度お試しください。'
    : ($data['message'] ?? '登録に失敗しました。再度トライしてください。');
echo '<script>alert(' . json_encode($errorMsg, JSON_UNESCAPED_UNICODE) . '); history.back();</script>';
exit;
