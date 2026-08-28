<?php

declare(strict_types=1);

/** 来場予約の id_homes に付く接頭辞（sync 側 runHomesOrder.ts と対応） */
const PORTAL_HOMES_RESERVATION_PREFIX = 'reserve_';

/**
 * HOME'S（注文事業）の 1 レコードを inquiry_customer 用の連想配列へ変換する。
 * 移植元 api/homes.php の INSERT 句と同じマッピング。
 *
 * inquiry_id は問合せメールが 'homes<番号>'（移植元と同じ）、
 * 来場予約が 'homes_reserve<番号>' となる。別採番のため衝突させない。
 */
function portalHomesToInquiry(array $row): ?array
{
    $id = trim((string)($row['id_homes'] ?? ''));
    if ($id === '') {
        return null;
    }

    if (str_starts_with($id, PORTAL_HOMES_RESERVATION_PREFIX)) {
        $inquiryId = 'homes_reserve' . substr($id, strlen(PORTAL_HOMES_RESERVATION_PREFIX));
    } else {
        $inquiryId = 'homes' . $id;
    }

    // 氏名・カナは半角スペース区切り
    [$firstName, $lastName] = portalSplitName($row['name_homes'] ?? '', ' ');
    [$firstKana, $lastKana] = portalSplitName($row['kana_homes'] ?? '', ' ');

    // 問合せ日時は「日付 時刻」形式のため日付部分のみを使う
    $date = explode(' ', trim((string)($row['date_homes'] ?? '')))[0] ?? '';

    return [
        'inquiry_id'       => $inquiryId,
        'inquiry_date'     => $date,
        'medium'           => "HOME'S",
        'response_medium'  => "HOME'S",
        'first_name'       => $firstName,
        'last_name'        => $lastName,
        'first_name_kana'  => $firstKana,
        'last_name_kana'   => $lastKana,
        'mobile'           => (string)($row['phone_homes'] ?? ''),
        'mail'             => (string)($row['mail_homes'] ?? ''),
        'zip'              => (string)($row['zip_homes'] ?? ''),
        'building'         => (string)($row['address_homes'] ?? ''),
        'brand'            => (string)($row['shop_homes'] ?? ''),
        'shop'             => (string)($row['shop'] ?? ''),
        'area'             => (string)($row['place_homes'] ?? ''),
    ];
}
