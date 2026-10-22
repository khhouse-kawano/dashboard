<?php

/**
 * ホームページの会員登録（KH・2L・なごみ・JH）を inquiry_customer へ保存する。（v2.2.209）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/memberEntry/entry.ts の予備である。同じ処理を持つ。**
 *   ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 *   ⚠️ 動くのは ② に届かなかったとき（GAS が送り直したとき・① からの転送が失敗したとき）。
 *   ⚠️ ここを変えたら entry.ts も同じように変えること。
 * ⚠️ 移植元の api/member.php との違いは entry.ts の冒頭を参照（合い言葉・必須項目・重複の扱い・応答の形）。
 * ─────────────────────────────────────────────
 */

/** 制御文字を空白にし、連続する空白を1つにして長さで切る（② の clean と同じ） */
function memberEntryClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 改行だけ残す（② の cleanMultiline と同じ） */
function memberEntryCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

function memberEntryRespond(int $status, array $body): void
{
    http_response_code($status);
    // ⚠️ ② と同じ形にする（inquiry_id の / をエスケープしない）
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ⚠️ 合い言葉を最初に確かめる。⚠️ 未設定なら全件断る（素通しにしない）
$expectedKey = trim((string)getenv('MEMBER_ENTRY_KEY'));
$inputKey = memberEntryClean($data['key'] ?? '', 200);
if ($expectedKey === '' || !hash_equals($expectedKey, $inputKey)) {
    if ($expectedKey === '') {
        error_log('member_entry: MEMBER_ENTRY_KEY が未設定のため断りました');
    }
    memberEntryRespond(401, ['status' => 'error', 'message' => '合い言葉が違います。']);
}

$inquiryId   = memberEntryClean($data['inquiry_id'] ?? '', 200);
$inquiryDate = memberEntryClean($data['inquiry_date'] ?? '', 10);
$name        = memberEntryClean($data['name'] ?? '', 120);
$mail        = memberEntryClean($data['mail'] ?? '', 190);
$mobile      = memberEntryClean($data['mobile'] ?? '', 30);
$brand       = memberEntryClean($data['brand'] ?? '', 30);
$shop        = memberEntryClean($data['shop'] ?? '', 80);

if (
    strpos($inquiryId, 'homepage') !== 0
    || !preg_match('#^\d{4}/\d{2}/\d{2}$#', $inquiryDate)
    || $brand === '' || $shop === '' || $name === ''
    || ($mail === '' && $mobile === '')
) {
    error_log("member_entry: 必要な項目がありません id=\"{$inquiryId}\" brand=\"{$brand}\"");
    memberEntryRespond(400, ['status' => 'error', 'message' => '必要な項目がありません。']);
}

try {
    $stmt = $pdo->prepare('SELECT id FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1');
    $stmt->execute([$inquiryId]);
    if ($stmt->fetch()) {
        memberEntryRespond(200, ['status' => 'exists', 'message' => '登録済みです。', 'id' => $inquiryId]);
    }

    // ⚠️ メールが空なら重複を調べない（空のメール同士を重複にしない）。店舗ごとに1つ（後の行の媒体）
    $duplicate = '';
    if ($mail !== '') {
        $stmt = $pdo->prepare('SELECT shop, medium FROM inquiry_customer WHERE mail = ? ORDER BY id');
        $stmt->execute([$mail]);
        $byShop = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'medium', 'shop');
        $notes = [];
        foreach ($byShop as $dupShop => $dupMedium) {
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
    $values['medium'] = 'ホームページ反響';
    $values['response_medium'] = memberEntryClean($data['response_medium'] ?? '', 120);
    $values['first_name'] = $name;
    $values['first_name_kana'] = memberEntryClean($data['kana'] ?? '', 120);
    $values['mobile'] = $mobile;
    $values['mail'] = $mail;
    $values['zip'] = memberEntryClean($data['zip'] ?? '', 10);
    $values['building'] = memberEntryClean($data['address'] ?? '', 300);
    $values['brand'] = $brand;
    $values['shop'] = $shop;
    $values['hp_campaign'] = memberEntryClean($data['campaign'] ?? '', 200);
    $values['remarks'] = memberEntryCleanMultiline($data['remarks'] ?? '', 2000);
    $values['duplicate'] = $duplicate;

    $placeholders = implode(', ', array_fill(0, count($notNullColumns), '?'));
    $stmt = $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $notNullColumns) . ") VALUES ({$placeholders})");
    $stmt->execute(array_values($values));
} catch (PDOException $e) {
    error_log("member_entry: inquiry_customer への保存に失敗 id=\"{$inquiryId}\": " . $e->getMessage());
    memberEntryRespond(500, ['status' => 'error', 'message' => 'データの追加に失敗しました。']);
}

error_log("member_entry: ① で受け付けました id=\"{$inquiryId}\" brand=\"{$brand}\" shop=\"{$shop}\"");
memberEntryRespond(200, ['status' => 'success', 'message' => "{$name} のデータが反響一覧に追加されました。", 'id' => $inquiryId]);
