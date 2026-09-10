<?php

declare(strict_types=1);

/**
 * ALLGRIT（注文事業）の id_allGrit を組み立てる。
 *
 * 移植元 api/allGrit.php では、同一の LINE UID が KH / DJH の両アカウントに現れて
 * 衝突するのを避けるため、DJH のときだけ末尾に "DJH" を連結している。
 */
function portalAllgritId(array $row): string
{
    $id = trim((string)($row['id_allGrit'] ?? ''));
    if ($id === '') {
        return '';
    }
    $shop = (string)($row['shop_allGrit'] ?? '');
    $suffix = (strpos($shop, 'DJH') === false) ? '' : 'DJH';
    if ($suffix === '') {
        return $id;
    }
    // ハンドラ側で付与済みの ID を再度渡されても二重に連結しない
    return str_ends_with($id, $suffix) ? $id : $id . $suffix;
}

/**
 * ALLGRIT の 1 レコードを inquiry_customer 用の連想配列へ変換する。
 */
function portalAllgritToInquiry(array $row): ?array
{
    $id = portalAllgritId($row);
    if ($id === '') {
        return null;
    }

    return [
        'inquiry_id'       => 'allgrit' . $id,
        'inquiry_date'     => (string)($row['date_allGrit'] ?? ''),
        'medium'           => 'ALLGRIT',
        'response_medium'  => 'ALLGRIT',
        'first_name'       => (string)($row['sei_allGrit'] ?? ''),
        'last_name'        => (string)($row['mei_allGrit'] ?? ''),
        'mobile'           => (string)($row['phone_allGrit'] ?? ''),
        'mail'             => (string)($row['mail_allGrit'] ?? ''),
        'zip'              => (string)($row['zip_allGrit'] ?? ''),
        'building'         => (string)($row['address1_allGrit'] ?? ''),
        'brand'            => (string)($row['shop_allGrit'] ?? ''),
        'shop'             => (string)($row['shop'] ?? ''),
        'area'             => portalAllgritArea($row),
    ];
}

/**
 * inquiry_customer.area に入れる値を決める。
 *
 * ⚠️⚠️ **他のポータルと意味を揃える。** area には「建築予定地」が入る。
 *
 *     Homes        place_homes            （建築予定地）
 *     SUUMO        place_suumo            （建設予定地）
 *     タウンライフ  place_detail_townlife （建設予定地詳細）
 *     ALLGRIT      place_allGrit          （建築予定地）← 2026-09-08 から
 *
 *   それまで ALLGRIT だけ「都道府県 + 希望エリア第1希望」を入れていた。
 *   建築予定地が保存されていなかったためで、意味が違っていた。
 *
 * ⚠️ 建築予定地が空のときは従来どおり「都道府県 + 希望エリア第1希望」を返す。
 *   ALLGRIT の CSV では建築予定地が未入力のことがあり、
 *   空を返すと area が空欄の反響が増えてしまう。
 */
function portalAllgritArea(array $row): string
{
    $place = trim((string)($row['place_allGrit'] ?? ''));
    if ($place !== '') {
        return $place;
    }

    return (string)($row['pref_allGrit'] ?? '') . (string)($row['city_allGrit'] ?? '');
}
