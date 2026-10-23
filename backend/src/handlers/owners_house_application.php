<?php

/**
 * オーナーズハウス募集フォーム（kh-house.jp/owners_house/form/）の受付。（v2.2.215）
 *
 * ─────────────────────────────────────────────
 * 経路: フォーム（ブラウザ）──▶ 同じサイトの api.php（転送するだけ）──▶ ここ（multipart）
 *   ⚠️ ブラウザから khg-marketing.info へ直接送らない（広告で除外されたドメインのため。api.php が中継する）
 *   ⚠️ 写真を含むので ② へは転送しない（multipart は express_proxy が転送しない。⚠️ 画像の置き場所は ① の
 *     /dashboard/api/images/ で、k-snap と同じ）。⚠️ 許可リストにも入れていない
 *
 * ⚠️⚠️ **社外の誰でも叩ける書き込み口である。** リクエストの値を一切信用しない。
 *   - 写真は core/ksnap.php の ksnapSaveUploadedImage で保存（拡張子・中身・サイズを確かめ、ファイル名はサーバーで作る）
 *     ⚠️ 以前のフォーム（step3.php）は送られたファイル名のまま公開フォルダへ置いており、PHP を置けた
 *   - 項目の長さ・必須・店舗の選択肢を確かめる。見えない入力欄（website_url）が埋まっていたら送らない
 *   - 全体で10分に20件まで
 * ⚠️ 保存したあと社内へメールを送る（宛先は以前の regist.php と同じ6か所。文字だけ）。
 *   ⚠️ 件名は以前と変えた（過去のメールの取り込み GAS が、新しいメールを取り込まないように）
 * ─────────────────────────────────────────────
 */

require_once __DIR__ . '/../core/ksnap.php';

date_default_timezone_set('Asia/Tokyo');

const OHA_RATE_LIMIT = 20;
const OHA_RATE_WINDOW = 600;
const OHA_MAIL_TO = 'mkt@kh-group.jp,kh@kh-group.jp,djh@kh-group.jp,nagomi@kh-group.jp,2lhome@kh-group.jp,furukomihome@kh-group.jp';
const OHA_MAIL_FROM = 'owners_house@khg-marketing.info';
/** 写真の配信元（⚠️ frontend/src/utils/ksnapImage.ts の DEFAULT_BASE と同じ） */
const OHA_IMAGE_BASE = 'https://khg-marketing.info/dashboard/api/images/';
const OHA_PHOTO_MODES = ['request' => '撮影を依頼する', 'attach' => '写真を添付する'];
/** ⚠️ フォーム（index.html）の「ご契約店舗」の選択肢と同じにすること */
const OHA_SHOPS = [
    '国分ハウジング霧島店', '国分ハウジング姶良店', '国分ハウジング鹿児島店', '国分ハウジング鹿屋店',
    '国分ハウジング薩摩川内店', '国分ハウジング出水阿久根店', '国分ハウジング都城店', '国分ハウジング宮崎店',
    '国分ハウジング延岡店', '国分ハウジング大分店', '国分ハウジング八代店', '国分ハウジング熊本店',
    '国分ハウジング佐賀店',
    'デイジャストハウス鹿児島北店', 'デイジャストハウス鹿児島南店', 'デイジャストハウス姶良店',
    'デイジャストハウス霧島店', 'デイジャストハウス薩摩川内店', 'デイジャストハウス都城店', 'デイジャストハウス宮崎店',
    'なごみ工務店鹿児島店', 'なごみ工務店霧島店', 'なごみ工務店姶良霧島店', 'なごみ工務店薩摩川内店',
    'ニーエルホーム鹿児島店', 'ニーエルホーム霧島店',
    'フルコミホーム鹿児島店', 'フルコミホーム霧島店',
];

function ohaRespond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** 制御文字を空白にし、連続する空白を1つにする（⚠️ 長さはここでは切らない。長すぎれば断る） */
function ohaClean($value): string
{
    if (!is_string($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value) ?? '';
    return trim(preg_replace('/[ 　]+/u', ' ', $text) ?? '');
}

/** 全体の回数制限（⚠️ api.php を経由するので、お客様の IP は見えない） */
function ohaRateLimited(): bool
{
    $fp = @fopen(sys_get_temp_dir() . '/owners_house_application_rate.json', 'c+');
    if ($fp === false) {
        error_log('owners_house_application: 送信回数の記録ファイルを開けません（制限せずに続ける）');
        return false;
    }
    flock($fp, LOCK_EX);
    $times = json_decode((string)stream_get_contents($fp), true);
    $now = time();
    $times = array_values(array_filter(is_array($times) ? $times : [], function ($t) use ($now) {
        return $now - (int)$t < OHA_RATE_WINDOW;
    }));
    $limited = count($times) >= OHA_RATE_LIMIT;
    if (!$limited) {
        $times[] = $now;
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($times));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $limited;
}

// ⚠️ multipart なので $data ではなく $_POST（core/db.php を参照）
if (($_POST['website_url'] ?? '') !== '') {
    // ⚠️ 見えない入力欄が埋まっている＝機械の送信。⚠️ 弾いたことを知らせないため成功を返す
    error_log('owners_house_application: 見えない入力欄が埋まっていたため保存しません');
    ohaRespond(200, ['status' => 'success', 'message' => '受け付けました。']);
}
if (ohaRateLimited()) {
    error_log('owners_house_application: 送信が多すぎるため断りました');
    ohaRespond(429, ['status' => 'error', 'message' => '只今混み合っています。時間をおいて再度お試しください。']);
}

$v = [
    'name' => ohaClean($_POST['name'] ?? ''),
    'zip' => preg_replace('/\D/', '', mb_convert_kana(ohaClean($_POST['zip'] ?? ''), 'n', 'UTF-8')) ?? '',
    'shop' => ohaClean($_POST['shop'] ?? ''),
    'staff' => ohaClean($_POST['staff'] ?? ''),
    'photoMode' => ohaClean($_POST['photo_mode'] ?? ''),
    'title' => ohaClean($_POST['title'] ?? ''),
];
for ($i = 1; $i <= 5; $i++) {
    $v['feature' . $i] = ohaClean($_POST['feature' . $i] ?? '');
}

// ---- 項目を確かめる（⚠️ フォームの JS と同じ。最後はここで確かめる） ----
$limits = ['name' => 50, 'staff' => 50, 'title' => 100, 'feature1' => 200, 'feature2' => 200, 'feature3' => 200, 'feature4' => 200, 'feature5' => 200];
$errors = [];
foreach ($limits as $key => $max) {
    if (mb_strlen($v[$key], 'UTF-8') > $max) {
        $errors[] = $key;
    }
}
foreach (['name', 'title', 'feature1', 'feature2'] as $key) {
    if ($v[$key] === '') {
        $errors[] = $key;
    }
}
if (!preg_match('/^\d{7}$/', $v['zip'])) {
    $errors[] = 'zip';
}
if (!in_array($v['shop'], OHA_SHOPS, true)) {
    $errors[] = 'shop';
}
if (!isset(OHA_PHOTO_MODES[$v['photoMode']])) {
    $errors[] = 'photo_mode';
}
if ($errors) {
    error_log('owners_house_application: 入力が正しくありません fields=' . implode(',', array_unique($errors)));
    ohaRespond(400, ['status' => 'error', 'message' => '入力内容をご確認ください。', 'fields' => array_values(array_unique($errors))]);
}

// ---- 写真（⚠️ 添付を選んだときだけ。外観・内観①②は必須） ----
$photos = [];
if ($v['photoMode'] === 'attach') {
    for ($i = 1; $i <= 5; $i++) {
        $file = $_FILES['photo' . $i] ?? null;
        $hasFile = is_array($file) && (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        if (!$hasFile) {
            if ($i <= 3) {
                ohaRespond(400, ['status' => 'error', 'message' => '外観写真・内観写真①②を添付してください。', 'fields' => ['photo' . $i]]);
            }
            continue;
        }
        $saved = ksnapSaveUploadedImage($file);
        if ($saved === null) {
            // ⚠️ 保存できた分は消す（受け付けないのに写真だけ残らないように）
            foreach ($photos as $name) {
                ksnapDeleteImage($name);
            }
            ohaRespond(400, ['status' => 'error', 'message' => '写真を保存できませんでした。JPG または PNG の写真を選んでください。', 'fields' => ['photo' . $i]]);
        }
        $photos[] = $saved;
    }
}

// ---- 保存 ----
$receivedAt = date('Y-m-d H:i:s');
$id = 0;
try {
    $stmt = $pdo->prepare(
        'INSERT INTO owners_house_application'
        . ' (received_at, source, name, zip, shop, staff, photo_mode, photos, title, feature1, feature2, feature3, feature4, feature5)'
        . " VALUES (?, 'form', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $receivedAt, $v['name'], $v['zip'], $v['shop'], $v['staff'], OHA_PHOTO_MODES[$v['photoMode']],
        $photos ? json_encode($photos) : null, $v['title'],
        $v['feature1'], $v['feature2'], $v['feature3'], $v['feature4'], $v['feature5'],
    ]);
    $id = (int)$pdo->lastInsertId();
} catch (PDOException $e) {
    foreach ($photos as $name) {
        ksnapDeleteImage($name);
    }
    // ⚠️ 例外の中身は応答に含めない
    error_log('owners_house_application: 保存に失敗: ' . $e->getMessage());
    ohaRespond(500, ['status' => 'error', 'message' => '送信できませんでした。時間をおいて再度お試しください。']);
}

// ---- 社内へメール（⚠️ 保存が終わってから。⚠️ 失敗しても受付は済んでいる） ----
$lines = [
    'オーナーズハウスへの募集がありました。',
    '該当店舗及び担当営業は御礼のメッセージ等対応をお願いいたします。',
    '',
    '受付日時：' . date('Y/m/d H:i', strtotime($receivedAt)),
    'お施主様名：' . $v['name'] . ' 様',
    '郵便番号：' . substr($v['zip'], 0, 3) . '-' . substr($v['zip'], 3),
    '契約した店舗：' . $v['shop'],
    '担当営業：' . ($v['staff'] !== '' ? $v['staff'] : '（未入力）'),
    '写真撮影について：' . OHA_PHOTO_MODES[$v['photoMode']],
    'ご自宅のタイトル：' . $v['title'],
];
for ($i = 1; $i <= 5; $i++) {
    if ($v['feature' . $i] !== '') {
        $lines[] = 'ご自宅の見どころ' . mb_substr('①②③④⑤', $i - 1, 1) . '：' . $v['feature' . $i];
    }
}
foreach ($photos as $n => $name) {
    $lines[] = '写真' . ($n + 1) . '：' . OHA_IMAGE_BASE . $name;
}
$lines[] = '';
$lines[] = 'Dashboard の「反響管理 → オーナーズハウス募集」でも確認できます。';

mb_language('uni');
mb_internal_encoding('UTF-8');
$subject = '【オーナーズハウス募集】' . preg_replace('/[\x00-\x1F\x7F]/', ' ', $v['name']) . '様からの応募がありました';
$headers = 'From: ' . mb_encode_mimeheader('オーナーズハウス', 'UTF-8') . ' <' . OHA_MAIL_FROM . '>';
if (!mb_send_mail(OHA_MAIL_TO, $subject, implode("\n", $lines) . "\n", $headers)) {
    error_log("owners_house_application: 社内へのメールを送れませんでした id={$id}");
}

error_log("owners_house_application: 受け付けました id={$id} shop=\"{$v['shop']}\" photos=" . count($photos));
ohaRespond(200, ['status' => 'success', 'message' => '受け付けました。', 'id' => $id]);
