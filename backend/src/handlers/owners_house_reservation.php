<?php

/**
 * オーナーズハウスの見学予約。（v2.2.216）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/ownersHouse/reservation.ts の予備である。同じ処理を持つ。**
 *   ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 *   ⚠️ 動くのは ② に届かなかったとき（画面が kh-house.jp/form/api/ 経由で送り直したとき・① からの転送が失敗したとき）。
 *   ⚠️ ここを変えたら reservation.ts も同じように変えること。
 * ⚠️ 社内通知の Cc はコードの表から（リクエストの値は使わない）。メールは文字だけ。
 * ⚠️ ② が保存した直後に応答が失われて ① へ回ったとき、二重に保存しない（同じキャンペーン・同じメールか電話で、② が10分以内に保存していれば飛ばす）。
 * ⚠️ 全体で1分に30件まで（kh-house.jp/form/api/ を経由するので、お客様の IP は見えない）
 * ─────────────────────────────────────────────
 */

date_default_timezone_set('Asia/Tokyo');

const OHR_NOTICE_TO = 'mkt@kh-house.jp';
const OHR_CAMPAIGN_ID = '20250000_khg_owners_house';
const OHR_MAIL_FROM = 'pgcloud@khg-marketing.info';

function ohrRespond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** 制御文字を空白にし、連続する空白を1つにして長さで切る（② の clean と同じ） */
function ohrClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 改行だけ残す（② の cleanMultiline と同じ） */
function ohrCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

/** カンマ区切りの宛先を、送ってよい形に直す（② の safeAddressList と同じ） */
function ohrAddresses(string $value): array
{
    $value = preg_replace('/[\x00-\x1F\x7F]/', ',', $value) ?? '';
    $seen = [];
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && preg_match('/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/', $one)) {
            $seen[$one] = true;
        }
    }
    return array_slice(array_keys($seen), 0, 20);
}

function ohrSendMail(array $to, string $subject, string $body, string $fromName): bool
{
    if (!$to) {
        return false;
    }
    mb_language('uni');
    mb_internal_encoding('UTF-8');
    $headers = 'From: ' . mb_encode_mimeheader($fromName, 'UTF-8') . ' <' . OHR_MAIL_FROM . '>';
    return mb_send_mail(implode(',', $to), preg_replace('/[\x00-\x1F\x7F]/', ' ', $subject) ?? '', $body, $headers);
}

function ohrRateLimited(): bool
{
    $fp = @fopen(sys_get_temp_dir() . '/owners_house_reservation_rate.json', 'c+');
    if ($fp === false) {
        return false;
    }
    flock($fp, LOCK_EX);
    $times = json_decode((string)stream_get_contents($fp), true);
    $now = time();
    $times = array_values(array_filter(is_array($times) ? $times : [], function ($t) use ($now) {
        return $now - (int)$t < 60;
    }));
    $limited = count($times) >= 30;
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

/** 画面が送る brand → [inquiry_customer.brand, 店舗の頭, ブランド名, 社内通知の Cc]（② の BRANDS と同じ） */
$ohrBrands = [
    'KH' => ['KH', 'KH', '国分ハウジング', 'kh@kh-group.jp,lead@kh-group.jp,kh-t@kh-house.jp'],
    'DJH' => ['DJH', 'DJH', 'デイジャストハウス', 'info-djh@royalhome.co.jp,djh@kh-group.jp'],
    'Nagomi' => ['なごみ', 'なごみ', 'なごみ工務店', 'nagomi@kh-group.jp,nagomi@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com'],
    '2L' => ['2L', '2L', 'ニーエルホーム', '2lhome@kh-group.jp,2lhome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com'],
    'FH' => ['FH', 'FH', 'フルコミホーム', 'furukomihome@kh-group.jp,furukomihome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com'],
    'PGH' => ['PG HOUSE', 'PGH', 'PG-HOUSE', 'pghouse@kh-house.jp,koukoku@pure-growth.net,pghouse@pure-growth.net,pgh@kh-group.jp'],
    'JH' => ['JH', 'JH', 'JUSFY HOME', 'jh@kh-group.jp'],
];

if (ohrRateLimited()) {
    error_log('owners_house_reservation: 送信が多すぎるため断りました');
    ohrRespond(429, ['status' => 'error', 'message' => '登録に失敗しました。']);
}

$a = [
    'brand' => ohrClean($data['brand'] ?? '', 20),
    'shop' => ohrClean($data['shop'] ?? '', 80),
    'place' => ohrClean($data['place'] ?? '', 120),
    // ⚠️⚠️ 本文のキーは house_category（⚠️ `category` はゲートウェイの振り分けの鍵に入る）
    'category' => ohrClean($data['house_category'] ?? '', 60),
    'date' => ohrClean($data['date'] ?? '', 20),
    'time' => ohrClean($data['time'] ?? '', 20),
    'name' => ohrClean($data['name'] ?? '', 60),
    'kana' => ohrClean($data['kana'] ?? '', 60),
    'age' => ohrClean($data['age'] ?? '', 20),
    'phone' => ohrClean($data['phone'] ?? '', 30),
    'mail' => ohrClean($data['mail'] ?? '', 190),
    'zip' => ohrClean($data['zip'] ?? '', 10),
    'address' => ohrClean($data['address'] ?? '', 200),
    'medium' => ohrClean($data['medium'] ?? '', 60),
    'demand' => ohrCleanMultiline($data['demand'] ?? '', 2000),
    'url' => ohrClean($data['url'] ?? '', 500),
    'urlParams' => ohrClean($data['url_params'] ?? '', 2000),
    'landingParams' => ohrClean($data['landing_params'] ?? '', 2000),
];
if ($a['name'] === '' || ($a['phone'] === '' && $a['mail'] === '')) {
    ohrRespond(400, ['status' => 'error', 'message' => '登録に失敗しました。']);
}

$spec = $ohrBrands[$a['brand']] ?? null;
if ($spec === null) {
    error_log("owners_house_reservation: 知らないブランドです brand=\"{$a['brand']}\"");
}
$brandValue = $spec[0] ?? 'KHG';
// ⚠️ 店舗名の頭のブランド名を略称にする（② の normalizeShop と同じ）
$shopValue = preg_replace(
    ['/^国分ハウジング/u', '/^デイジャストハウス/u', '/^なごみ工務店/u', '/^ニーエルホーム/u', '/^フルコミホーム/u', '/^ジャスフィーホーム/u', '/^(PG ?HOUSE|PGハウス)/iu'],
    ['KH', 'DJH', 'なごみ', '2L', 'FH', 'JH', 'PGH'],
    $a['shop']
) ?? $a['shop'];
if ($shopValue === '') {
    $shopValue = $spec !== null ? $spec[1] . '店舗未設定' : 'ブランド・店舗未設定';
}
$campaign = ($spec[1] ?? 'KHG') . 'オーナーズハウス';
$now = time();
$remarks = implode("\n", array_filter([
    $a['place'] !== '' ? '見学希望：' . $a['place'] . ($a['category'] !== '' ? "（{$a['category']}）" : '') : '',
    $a['url'] !== '' ? 'ページ：' . $a['url'] : '',
    $a['demand'] !== '' ? 'ご質問・ご要望：' . $a['demand'] : '',
]));

try {
    // ⚠️ ② が10分以内に保存した同じ人なら、保存もメールもせずに成功を返す
    $contact = [];
    $params = [$campaign, 'form' . date('YmdHis', $now - 600)];
    if ($a['mail'] !== '') {
        $contact[] = 'mail = ?';
        $params[] = $a['mail'];
    }
    if ($a['phone'] !== '') {
        $contact[] = 'mobile = ?';
        $params[] = $a['phone'];
    }
    $stmt = $pdo->prepare(
        "SELECT id FROM inquiry_customer WHERE hp_campaign = ? AND inquiry_id LIKE 'form%' AND inquiry_id >= ? AND ("
        . implode(' OR ', $contact) . ') LIMIT 1'
    );
    $stmt->execute($params);
    if ($stmt->fetch()) {
        error_log('owners_house_reservation: ② が10分以内に保存済みのため ① では保存しません');
        ohrRespond(200, ['status' => 'success', 'message' => 'オーナーズハウス見学の登録に成功しました。']);
    }

    // ⚠️ NOT NULL の列をすべて埋める（② の NOT_NULL_COLUMNS と同じ）。⚠️ url_params・landing_params は NULL 可
    $notNullColumns = [
        'inquiry_id', 'pg_id', 'mhl_id', 'mhl_url', 'mhl_mail', 'inquiry_date',
        'medium', 'response_medium',
        'first_name', 'last_name', 'first_name_kana', 'last_name_kana',
        'mobile', 'landline', 'mail',
        'zip', 'pref', 'city', 'town', 'street', 'building',
        'brand', 'shop', 'sync', 'staff', 'area',
        'reserved_date', 'reserved_time', 'black_list', 'hp_campaign',
        'delete_flag', 'duplicate', 'note',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'referrer', 'first_visit', 'hotlead_url', 'remarks',
    ];
    $values = array_fill_keys($notNullColumns, '');
    $values['sync'] = 0;
    $values['delete_flag'] = 0;
    // ⚠️ ① で保存した反響は homepage で始まる（移植元と同じ。② の form と見分けられる）
    $values['inquiry_id'] = 'homepage' . date('YmdHis', $now) . '20250000_khgownershouse';
    $values['inquiry_date'] = date('Y/m/d', $now);
    $values['medium'] = 'ホームページ反響';
    $values['response_medium'] = $a['medium'];
    $values['brand'] = $brandValue;
    $values['shop'] = $shopValue;
    $values['first_name'] = $a['name'];
    $values['first_name_kana'] = $a['kana'];
    $values['mobile'] = $a['phone'];
    $values['mail'] = $a['mail'];
    $values['zip'] = $a['zip'];
    $values['street'] = $a['address'];
    $values['reserved_date'] = $a['date'];
    $values['reserved_time'] = $a['time'];
    $values['hp_campaign'] = $campaign;
    $values['remarks'] = $remarks;
    $values['url_params'] = $a['urlParams'] === '' ? null : $a['urlParams'];
    $values['landing_params'] = $a['landingParams'] === '' ? null : $a['landingParams'];
    $columns = array_keys($values);
    $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')')
        ->execute(array_values($values));
} catch (PDOException $e) {
    error_log("owners_house_reservation: inquiry_customer への保存に失敗 name=\"{$a['name']}\": " . $e->getMessage());
    ohrRespond(500, ['status' => 'error', 'message' => '登録に失敗しました。']);
}
error_log("owners_house_reservation を ① で受け付けました（② に届かなかった） brand=\"{$brandValue}\" shop=\"{$shopValue}\"");

// ---- pgcloud（⚠️ 失敗しても反響は保存済み。⚠️ 全21列を埋める。② と同じ） ----
try {
    $pdo->prepare(
        'INSERT INTO pgcloud (タイムスタンプ, ブランド, 店舗, 姓, 名, セイ, メイ, 郵便番号,'
        . ' 都道府県, `市・区`, `町村・番地`, `ビル名・建物名`, ご予約のきっかけ, その他質問,'
        . ' 希望日, 希望時間, 携帯番号, メールアドレス, 年齢, キャンペーン名, キャンペーンID)'
        . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        date('Y/m/d H:i:s', $now), $brandValue, $a['shop'], $a['name'], '', $a['kana'], '', $a['zip'],
        '', '', '', $a['address'], $a['medium'], $a['demand'],
        $a['date'], $a['time'], $a['phone'], $a['mail'], $a['age'], $campaign, OHR_CAMPAIGN_ID,
    ]);
} catch (PDOException $e) {
    error_log('owners_house_reservation: pgcloud への保存に失敗: ' . $e->getMessage());
}

// ---- メール2通（⚠️ 2通は別々に送る） ----
$brandName = $spec[2] ?? '国分ハウジンググループ';
$detail = [];
foreach ([
    '見学希望場所' => $a['place'], 'お名前' => $a['name'], 'お名前（カナ）' => $a['kana'],
    '来場希望日' => $a['date'], '来場希望時間' => $a['time'], '携帯番号' => $a['phone'], 'メールアドレス' => $a['mail'],
    '年齢' => $a['age'], '郵便番号' => $a['zip'], '住所' => $a['address'], 'お問い合わせのきっかけ' => $a['medium'],
    'その他ご質問・ご要望' => $a['demand'],
] as $label => $value) {
    if ($value !== '') {
        $detail[] = $label . '：' . $value;
    }
}
$detail = implode("\n", $detail);

$customerTo = ohrAddresses($a['mail']);
if ($customerTo) {
    $body = "{$a['name']} 様\nオーナーズハウス見学のお問い合わせを受け付けました。\n\nお問い合わせ内容は以下となります。\n\n{$detail}\n\n"
        . "こちらのメールは配信用のため返信できません。ご意見・ご要望はご予約の店舗までお寄せください。\n\n"
        . "※お問い合わせいただいた日時が18:00以降または火曜日、水曜日の場合、翌営業日以降のご連絡となりますのであらかじめご了承ください。\n";
    if (!ohrSendMail($customerTo, "{$brandName}/お問い合わせありがとうございます。", $body, $brandName)) {
        error_log("owners_house_reservation: お礼のメールを送れませんでした name=\"{$a['name']}\"");
    }
}

$noticeBody = "オーナーズハウス見学のお問い合わせを受け付けました。\n\nお問い合わせ日時：" . date('Y/m/d H:i:s', $now) . "\n\n{$detail}\n"
    . ($a['url'] !== '' ? "該当URL：{$a['url']}\n" : '')
    . "\n管理店舗・担当営業はお施主様との日程調整をお願いします。\n====================\n※のちほどダッシュボードへ反映されます。\n";
if (!ohrSendMail(array_merge(ohrAddresses(OHR_NOTICE_TO), ohrAddresses($spec[3] ?? '')), "{$brandName}/オーナーズハウスからの登録がありました。", $noticeBody, $brandName)) {
    error_log("owners_house_reservation: 社内通知を送れませんでした name=\"{$a['name']}\" mail=\"{$a['mail']}\" phone=\"{$a['phone']}\"");
}

ohrRespond(200, ['status' => 'success', 'message' => 'オーナーズハウス見学の登録に成功しました。']);
