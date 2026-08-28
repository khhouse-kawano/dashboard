<?php

// ============================================================================
// HOME'S（中古住宅専門店）の同期
//
//   呼び出し元: handlers/homes_db_resale.php
//     1件POSTされるたびに、直前に homes_db_resale へ保存/更新した
//     userId の行だけを下流の2テーブルへ流し込む。
//
//   同期先
//     1. inquiry_customer_resale … 反響顧客（従来からの同期）
//     2. brokerage_listings       … 不動産CRMの買いリード（kind='buyLeads'）
//
//   どちらも **INSERT のみで UPDATE しない**。
//   取り込んだ後の phase / staff / budget は担当者が画面上で編集するため、
//   同じ問合せが再送されるたびに上書きすると手入力が消えてしまう。
//
//   ⚠ homes_db_resale には同じ userId の行が大量に重複している
//     呼び出し元の重複チェックが別テーブル（homes_db_kaeru）を見ているため、
//     GAS が回るたびに INSERT され続けている。実測で 4,756行 / userId 38種。
//     そのため下の SQL は必ず「userId ごとに最新の1行」だけを対象にする。
//     複数行を拾うと、同じ extId・同じ採番IDで複数INSERTしようとして
//     uk_id 違反で 500 になる。
// ============================================================================

require_once __DIR__ . '/../../core/brokerage_id.php';

// homes_db_resale のキーは userId（HOME'S の問合せ番号）。
// 対象行を特定できないと同期できないため、無ければ何もしない。
$homesUserId = isset($data['userId']) ? trim((string) $data['userId']) : '';

if ($homesUserId === '') {
    error_log('portal/homes_resale.php: userId が空のため同期をスキップしました');
    return;
}

// ----------------------------------------------------------------------------
// 1. 反響顧客（inquiry_customer_resale）
// ----------------------------------------------------------------------------
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            category,
            inquiry_date,
            first_name,
            medium,
            response_medium,
            mobile,
            mail,
            property,
            area,
            brand,
            `url`,
            remarks,
            note
            )
        SELECT
            CONCAT('homes_', userId),
            '買い:ポータル',
            DATE_FORMAT(registered, '%Y/%m/%d'),
            `name`,
            'HOME''S',
            'HOME''S',
            mobile,
            mail,
            propertyName,
            area,
            '中古住宅専門店',
            propertyUrl,
            note,
            remarks
        FROM
            homes_db_resale
        WHERE
            userId = :userId
        ORDER BY
            no DESC
        LIMIT 1";

$stmt = $pdo->prepare($sql);
$stmt->execute([':userId' => $homesUserId]);

// ----------------------------------------------------------------------------
// 2. 不動産CRMの買いリード（brokerage_listings, kind='buyLeads'）
//
//   突合キーは `extId` = 'homes:{問合せ番号}'。
//   HOME'S は問合せ単位の userId が取れるので、他ポータルのような
//   日付＋氏名の合成キーは不要。
//
//   ⚠ 照合順序に注意
//     homes_db_resale    … utf8mb4_general_ci
//     brokerage_listings … utf8mb4_unicode_ci
//   COLLATE を付けずに比較すると ERROR 1267 で落ちる。
//
//   phase / staff は入れない（phase 空欄 = 画面上の「反響受信」相当）。
// ----------------------------------------------------------------------------
$sqlBroker = "INSERT INTO brokerage_listings
            (kind,
            id,
            extId,
            portal,
            category,
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
            CONCAT('homes:', h.userId),
            -- 買いリードは反響元を source ではなく portal に入れる規約
            -- （既存の athome/suumo は全件 portal 側）。広告費の集計キーにもなる。
            -- 既存コードと同じく SQL 標準の '' でエスケープする
            -- （バックスラッシュ escape は NO_BACKSLASH_ESCAPES で壊れるため）
            'HOME''S',
            -- 物件種別を CRM 側の区分名に寄せる。未知の値はそのまま残す
            CASE h.category
                WHEN '売買 一戸建て'   THEN '戸建'
                WHEN '売買 マンション' THEN 'マンション'
                WHEN '売買 土地'       THEN '土地'
                ELSE NULLIF(h.category, '')
            END,
            NULLIF(TRIM(h.`name`), ''),
            NULLIF(CONCAT_WS(' / ', NULLIF(h.mobile, ''), NULLIF(h.mail, '')), ''),
            NULLIF(h.mobile, ''),
            NULLIF(h.mail, ''),
            NULLIF(h.propertyName, ''),
            -- 価格は '1,500万円' 形式。読めない値は NULL にして取り込みを止めない
            CASE WHEN h.price REGEXP '^[0-9,]+万円$'
                 THEN CAST(REPLACE(REPLACE(h.price, ',', ''), '万円', '') AS UNSIGNED) * 10000
                 ELSE NULL
            END,
            -- 買いリードの既存レコードに合わせて所在地を先頭に置き、
            -- 個別カラムの受け皿が無い項目を『／』で続ける。
            -- お問合せ内容は本文なので改行して最後に置く
            NULLIF(CONCAT_WS('\n',
                NULLIF(CONCAT_WS('／',
                    NULLIF(h.area, ''),
                    CONCAT('交通:', NULLIF(h.railway, '')),
                    CONCAT('面積:', NULLIF(h.large, '')),
                    CONCAT('間取:', NULLIF(h.plan, ''))
                ), ''),
                NULLIF(h.note, '')
            ), ''),
            '反響受信',
            STR_TO_DATE(LEFT(h.registered, 10), '%Y-%m-%d'),
            1
        FROM (
            -- 重複している userId から最新の1行だけを取る（冒頭の注意書きを参照）
            SELECT * FROM homes_db_resale WHERE userId = :userId ORDER BY no DESC LIMIT 1
        ) h
        WHERE
            STR_TO_DATE(LEFT(h.registered, 10), '%Y-%m-%d') IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM brokerage_listings b
                WHERE b.extId = CONCAT('homes:', h.userId) COLLATE utf8mb4_unicode_ci
            )";

$stmtBroker = $pdo->prepare($sqlBroker);
$stmtBroker->execute([
    ':userId'    => $homesUserId,
    // 既に取り込み済みで1行も INSERT されないこともあるが、
    // その場合は採番した id を使わないだけで実害は無い
    ':broker_id' => brokerageListingId(),
]);
