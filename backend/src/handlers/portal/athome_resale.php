<?php

// ============================================================================
// アットホーム（中古住宅専門店）の同期
//
//   呼び出し元: handlers/athome_resale_update.php
//     1件POSTされるたびに、直前に athome_db_resale へ保存/更新した行だけを
//     下流の2テーブルへ流し込む。
//
//   同期先
//     1. inquiry_customer_resale … 反響顧客（従来からの同期）
//     2. brokerage_listings       … 不動産CRMの買いリード（kind='buyLeads'）
//
//   どちらも **INSERT のみで UPDATE しない**。
//   取り込んだ後の phase / staff / budget は担当者が画面上で編集するため、
//   同じ人物から再問合せがあるたびに上書きすると手入力が消えてしまう。
// ============================================================================

// $uniqueId は呼び出し元が組み立てた athome_db_resale.id。
// 対象行を特定できないと同期できないため、無ければ何もしない。
require_once __DIR__ . '/../../core/brokerage_id.php';

$athomeRowId = isset($uniqueId) ? trim((string) $uniqueId) : '';

if ($athomeRowId === '') {
    error_log('portal/athome_resale.php: id が空のため同期をスキップしました');
    return;
}

// ----------------------------------------------------------------------------
// 1. 反響顧客（inquiry_customer_resale）
// ----------------------------------------------------------------------------
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            inquiry_date,
            first_name,
            medium,
            response_medium,
            mobile,
            mail,
            zip,
            building,
            property,
            area,
            brand,
            category,
            shop,
            note
            )
        SELECT
            CONCAT('athome_', id),
            DATE_FORMAT(registered_at, '%Y/%m/%d'),
            `name`,
            'athome',
            'athome',
            tel,
            email,
            zip,
            `address`,
            building_name,
            property_address,
            '中古住宅専門店',
            '買い:ポータル',
            '買い:ポータル',
            remarks
        FROM
            athome_db_resale
        WHERE
            id = :id";

$stmt = $pdo->prepare($sql);
$stmt->execute([':id' => $athomeRowId]);

// ----------------------------------------------------------------------------
// 2. 不動産CRMの買いリード（brokerage_listings, kind='buyLeads'）
//
//   突合キーは `extId` = 'athome:{at home物件番号}:{YYYY-MM-DD}:{お名前}'。
//   アットホームのメールには問合せ単位のIDが無いため、この3点の組み合わせで
//   1問合せを識別する（手動取込された既存レコードと同じ書式）。
//
//   ⚠ id を athome_db_resale.id から作ってはいけない
//     athome_resale_update.php は email で突合して UPDATE し、`ak_` の id を
//     使い回す。同一人物が別物件へ再問合せすると同じ id のまま上書きされるため、
//     id を流用すると uk_id に阻まれて2件目の買いリードが作られない。
//     そこで id は他ポータルと同じ採番関数（core/brokerage_id.php）で作る。
//
//   ⚠ 照合順序に注意
//     athome_db_resale   … utf8mb4_general_ci
//     brokerage_listings … utf8mb4_unicode_ci
//   COLLATE を付けずに比較すると ERROR 1267 で落ちる。
//
//   source / category / viewDate / staff は入れない（既存レコードに合わせる）。
//   第一希望日時は内見の確定日ではないため viewDate には入れず、
//   phase を『内見予約』にした上で note に残す。
// ----------------------------------------------------------------------------
$sqlBroker = "INSERT INTO brokerage_listings
            (kind,
            id,
            extId,
            portal,
            name,
            contact,
            phone,
            mail,
            targetProperty,
            budget,
            note,
            phase,
            receivedDate,
            show_dashboard
            )
        SELECT
            'buyLeads',
            :broker_id,
            src.extId,
            -- 買いリードは反響元を source ではなく portal に入れる規約
            -- （既存115件すべて portal='アットホーム'）。広告費の集計キーにもなる
            'アットホーム',
            src.`name`,
            NULLIF(CONCAT_WS(' / ', NULLIF(src.tel, ''), NULLIF(src.email, '')), ''),
            NULLIF(src.tel, ''),
            NULLIF(src.email, ''),
            -- 建物名が空の物件（土地など）は所在地で代替する
            IFNULL(NULLIF(src.building_name, ''), NULLIF(src.property_address, '')),
            -- 価格は '1,600万円' 形式。読めない値は NULL にして取り込みを止めない
            CASE WHEN src.price REGEXP '^[0-9,]+万円$'
                 THEN CAST(REPLACE(REPLACE(src.price, ',', ''), '万円', '') AS UNSIGNED) * 10000
                 ELSE NULL
            END,
            -- 既存レコードの書式に合わせて所在地を先頭に置き、
            -- 個別カラムの受け皿が無い項目を『／』で続ける
            NULLIF(CONCAT_WS('／',
                NULLIF(src.property_address, ''),
                CONCAT('入居希望:',    NULLIF(src.move_in_timing, '')),
                CONCAT('第一希望日時:', NULLIF(src.tour_date_1, '')),
                CONCAT('連絡希望:',    NULLIF(src.contact_time, '')),
                CONCAT('その他連絡:',  NULLIF(src.other_contact_method, ''))
            ), ''),
            -- 第一希望日時が入っていれば内見の打診まで進んでいる
            CASE WHEN NULLIF(src.tour_date_1, '') IS NOT NULL THEN '内見予約' ELSE '反響受信' END,
            STR_TO_DATE(LEFT(src.registered_at, 10), '%Y-%m-%d'),
            1
        FROM (
            SELECT a.*,
                   CONCAT('athome:', a.athome_property_id, ':',
                          LEFT(a.registered_at, 10), ':', a.`name`) AS extId
            FROM athome_db_resale a
            WHERE a.id = :id
        ) src
        WHERE
            -- extId を組み立てられない行は取り込まない。
            -- 名前が取れなかった問合せ（GAS はメールアドレスだけでも送ってくる）は
            -- 個人を特定できず突合キーも作れないためスキップする
            NULLIF(TRIM(src.`name`), '') IS NOT NULL
            AND NULLIF(src.athome_property_id, '') IS NOT NULL
            AND STR_TO_DATE(LEFT(src.registered_at, 10), '%Y-%m-%d') IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM brokerage_listings b
                WHERE b.extId = src.extId COLLATE utf8mb4_unicode_ci
            )";

$stmtBroker = $pdo->prepare($sqlBroker);
$stmtBroker->execute([
    ':id'        => $athomeRowId,
    // 既に取り込み済みで1行も INSERT されないこともあるが、
    // その場合は採番した id を使わないだけで実害は無い
    ':broker_id' => brokerageListingId(),
]);
