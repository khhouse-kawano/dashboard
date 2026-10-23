<?php

/**
 * マイホームズの新規リード通知を inquiry_customer へ保存する。（v2.2.214）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/myhomes/entry.ts の予備である。同じ処理を持つ。**
 *   ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 *   ⚠️ 動くのは ② に届かなかったとき（GAS が送り直したとき・① からの転送が失敗したとき）。
 *   ⚠️ ここを変えたら entry.ts も同じように変えること。
 * ⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY。⚠️ ブランド・店舗は GAS が決めて送ってくる（ここでは決め直さない）。
 * ⚠️ マイホームズで同じ日に、同じメールか電話の人がいれば登録済み（以前の php と inquiry_id の形が違っても二重に入らないように）。
 * ─────────────────────────────────────────────
 */

/** 制御文字を空白にし、連続する空白を1つにして長さで切る（② の clean と同じ） */
function myhomesClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 改行だけ残す（② の cleanMultiline と同じ） */
function myhomesCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

function myhomesRespond(int $status, array $body): void
{
    http_response_code($status);
    // ⚠️ ② と同じ形にする（inquiry_id をエスケープしない）
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$expectedKey = trim((string)getenv('MEMBER_ENTRY_KEY'));
$inputKey = myhomesClean($data['key'] ?? '', 200);
if ($expectedKey === '' || !hash_equals($expectedKey, $inputKey)) {
    if ($expectedKey === '') {
        error_log('myhomes_entry: MEMBER_ENTRY_KEY が未設定のため断りました');
    }
    myhomesRespond(401, ['status' => 'error', 'message' => '合い言葉が違います。']);
}

$medium      = 'マイホームズ';
$inquiryId   = myhomesClean($data['inquiry_id'] ?? '', 200);
$inquiryDate = myhomesClean($data['inquiry_date'] ?? '', 10);
$name        = myhomesClean($data['name'] ?? '', 120);
$mail        = myhomesClean($data['mail'] ?? '', 190);
$mobile      = myhomesClean($data['mobile'] ?? '', 30);
$brand       = myhomesClean($data['brand'] ?? '', 30);
$shop        = myhomesClean($data['shop'] ?? '', 80);

if (
    strlen($inquiryId) <= strlen('myhomes_')
    || strpos($inquiryId, 'myhomes_') !== 0
    || !preg_match('#^\d{4}/\d{2}/\d{2}$#', $inquiryDate)
    || $brand === ''
    || $shop === ''
    || $name === ''
    || ($mail === '' && $mobile === '')
) {
    error_log("myhomes_entry: 必要な項目がありません id=\"{$inquiryId}\"");
    myhomesRespond(400, ['status' => 'error', 'message' => '必要な項目がありません。']);
}

try {
    // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）
    $phone = preg_replace('/\D/', '', $mobile) ?? '';
    $conditions = [];
    $params = [];
    if ($mail !== '') {
        $conditions[] = 'mail = ?';
        $params[] = $mail;
    }
    if (strlen($phone) >= 10) {
        $conditions[] = "REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ?";
        $params[] = $phone;
    }
    $samePerson = $conditions ? '(' . implode(' OR ', $conditions) . ')' : '';

    $sql = 'SELECT id FROM inquiry_customer WHERE inquiry_id = ?';
    $existingParams = [$inquiryId];
    if ($samePerson !== '') {
        $sql .= " OR (medium = ? AND inquiry_date = ? AND {$samePerson})";
        $existingParams = array_merge($existingParams, [$medium, $inquiryDate], $params);
    }
    $stmt = $pdo->prepare($sql . ' LIMIT 1');
    $stmt->execute($existingParams);
    if ($stmt->fetch()) {
        myhomesRespond(200, ['status' => 'exists', 'message' => '登録済みです。', 'id' => $inquiryId]);
    }

    $duplicate = '';
    if ($samePerson !== '') {
        $stmt = $pdo->prepare("SELECT shop, medium FROM inquiry_customer WHERE {$samePerson} ORDER BY id");
        $stmt->execute($params);
        $notes = [];
        foreach (array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'medium', 'shop') as $dupShop => $dupMedium) {
            $notes[] = "{$dupShop} {$dupMedium} 重複";
        }
        $duplicate = implode(',', $notes);
    }

    // ⚠️ NOT NULL の列をすべて埋める（② の NOT_NULL_COLUMNS と同じ）
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
    $values['inquiry_id'] = $inquiryId;
    $values['inquiry_date'] = $inquiryDate;
    $values['medium'] = $medium;
    $values['response_medium'] = $medium;
    $values['first_name'] = $name;
    $values['first_name_kana'] = myhomesClean($data['kana'] ?? '', 120);
    $values['mobile'] = $mobile;
    $values['mail'] = $mail;
    $values['zip'] = myhomesClean($data['zip'] ?? '', 10);
    $values['building'] = myhomesClean($data['address'] ?? '', 300);
    $values['area'] = myhomesClean($data['area'] ?? '', 200);
    $values['brand'] = $brand;
    $values['shop'] = $shop;
    $values['remarks'] = myhomesCleanMultiline($data['remarks'] ?? '', 2000);
    $values['duplicate'] = $duplicate;

    $placeholders = implode(', ', array_fill(0, count($notNullColumns), '?'));
    $stmt = $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $notNullColumns) . ") VALUES ({$placeholders})");
    $stmt->execute(array_values($values));
} catch (PDOException $e) {
    error_log("myhomes_entry: inquiry_customer への保存に失敗 id=\"{$inquiryId}\": " . $e->getMessage());
    myhomesRespond(500, ['status' => 'error', 'message' => 'データの追加に失敗しました。']);
}

error_log("myhomes_entry: ① で受け付けました id=\"{$inquiryId}\" brand=\"{$brand}\" shop=\"{$shop}\"");
myhomesRespond(200, ['status' => 'success', 'message' => "{$name} のデータが反響一覧に追加されました。", 'id' => $inquiryId]);
