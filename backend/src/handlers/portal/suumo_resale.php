<?php

// ============================================================================
// SUUMO（中古住宅専門店）の同期
//
//   呼び出し元: handlers/suumo_db_resale.php
//     他ポータルと違い、runSuumoResale.ts が **CSV全件を500件ずつバルクPOST** する。
//     全チャンクを suumo_db_resale へ書き込んだ後に1回だけ呼ばれるため、
//     ここでは「テーブル全体のうち未取込のもの」を対象にする。
//     （1件スコープにする意味が無い。POST自体が全件なので結果は同じ）
//
//   同期先
//     1. inquiry_customer_resale … 反響顧客（従来からの同期）
//     2. brokerage_listings       … 不動産CRMの買いリード（kind='buyLeads'）
//
//   brokerage_listings は **INSERT のみで UPDATE しない**。
//   取り込んだ後の phase / staff / budget は担当者が画面上で編集するため、
//   CSVを再取込するたびに上書きすると手入力が消えてしまう。
// ============================================================================

require_once __DIR__ . '/../../core/brokerage_id.php';

// ----------------------------------------------------------------------------
// 1. 反響顧客（inquiry_customer_resale）
// ----------------------------------------------------------------------------
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            category,
            inquiry_date,
            first_name,
            first_name_kana,
            medium,
            response_medium,
            mobile,
            mail,
            zip,
            pref,
            city,
            street,
            property,
            area,
            brand,
            `url`,
            note
            )
        SELECT
            CONCAT('suumo_', sequence_no),
            '買い:ポータル',
            DATE_FORMAT(STR_TO_DATE(received_at, '%Y/%c/%e %H:%i:%s'), '%Y/%m/%d'),
            last_name_kanji,
            last_name_kana,
            'SUUMO',
            'SUUMO',
            CONCAT(phone_1, phone_2, phone_3),
            email,
            CONCAT(zip_code_1, zip_code_2),
            address_1,
            address_2,
            address_3,
            property_name_1,
            property_location,
            '中古住宅専門店',
            free_1,
            remarks
        FROM
            suumo_db_resale";
$stmt = $pdo->prepare($sql);
$stmt->execute();

// ----------------------------------------------------------------------------
// 2. 不動産CRMの買いリード（brokerage_listings, kind='buyLeads'）
//
//   突合キーは `extId` = 'suumo:{連番}'。
//   既存17件と suumo_db_resale を sequence_no で突合して全件一致することを
//   確認済みなので、この形式で間違いない。
//
//   ⚠ CSV由来の値のクセ
//     ・received_at は '2026/7/02 12:06:19'（月が0埋めされない）。
//       上の既存SQLと同じ '%Y/%c/%e %H:%i:%s' で解釈する。
//     ・氏名は last_name_kanji に姓名まとめて入っている行がある
//       （first_name_kanji が NULL）。両方を連結して吸収する。
//     ・電話は phone_1/2/3 に3分割されている行と、phone_1 に全部入っている
//       行が混在する。CONCAT_WS('-') なら NULL が飛ばされて両方に対応できる。
//     ・price_or_rent は '3490万円'（カンマ無し）。他ポータルはカンマ有りなので
//       正規表現はどちらも許容する。
//
//   source / category は入れない（既存17件と同じ）。
//   phase は '反響受信'、staff は未割当。
//
//   ⚠ id の採番について
//     ここだけは複数行をまとめて取り込むため、SQL 一発の INSERT ... SELECT
//     では1つの id しか渡せない。採番関数を行ごとに呼ぶ必要があるので、
//     候補をSELECTしてから1行ずつINSERTする。
//     連番ブロックにループ添字を渡すことで、アプリ本体の一括生成と同じ
//     「同一タイムスタンプ + 行ごとのランダム + 連番」の形になる。
// ----------------------------------------------------------------------------
$selectNew = "SELECT
            CONCAT('suumo:', s.sequence_no) AS extId,
            NULLIF(CONCAT_WS('', s.last_name_kanji, s.first_name_kanji), '') AS `name`,
            NULLIF(CONCAT_WS('-', NULLIF(s.phone_1, ''), NULLIF(s.phone_2, ''), NULLIF(s.phone_3, '')), '') AS phone,
            NULLIF(s.email, '') AS mail,
            NULLIF(CONCAT_WS(' ', NULLIF(s.property_name_1, ''), NULLIF(s.property_name_2, '')), '') AS targetProperty,
            CASE WHEN s.price_or_rent REGEXP '^[0-9,]+万円$'
                 THEN CAST(REPLACE(REPLACE(s.price_or_rent, ',', ''), '万円', '') AS UNSIGNED) * 10000
                 ELSE NULL
            END AS budget,
            NULLIF(CONCAT_WS('\n',
                NULLIF(CONCAT_WS('／',
                    NULLIF(s.property_location, ''),
                    NULLIF(s.property_type, ''),
                    NULLIF(s.layout, ''),
                    NULLIF(s.media_name, ''),
                    NULLIF(s.media_type, '')
                ), ''),
                NULLIF(s.inquiry_comment, '')
            ), '') AS note,
            DATE(STR_TO_DATE(s.received_at, '%Y/%c/%e %H:%i:%s')) AS receivedDate
        FROM
            suumo_db_resale s
        WHERE
            NULLIF(s.sequence_no, '') IS NOT NULL
            AND STR_TO_DATE(s.received_at, '%Y/%c/%e %H:%i:%s') IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM brokerage_listings b
                WHERE b.extId = CONCAT('suumo:', s.sequence_no)
            )
        ORDER BY
            s.sequence_no";

$newLeads = $pdo->query($selectNew)->fetchAll(PDO::FETCH_ASSOC);

if ($newLeads) {
    $insert = $pdo->prepare(
        // 買いリードは反響元を source ではなく portal に入れる規約
        // （既存17件すべて portal='SUUMO'）。広告費の集計キーにもなる
        "INSERT INTO brokerage_listings
            (kind, id, extId, portal, `name`, contact, phone, mail,
             targetProperty, budget, note, phase, receivedDate, show_dashboard)
         VALUES
            ('buyLeads', :id, :extId, 'SUUMO', :name, :contact, :phone, :mail,
             :targetProperty, :budget, :note, '反響受信', :receivedDate, 1)"
    );

    foreach ($newLeads as $index => $lead) {
        // strlen をコールバックに使うと NULL 混入時に PHP 8.1 で deprecated 警告になる
        $contactParts = array_filter(
            [$lead['phone'], $lead['mail']],
            function ($value) { return $value !== null && $value !== ''; }
        );

        $insert->execute([
            ':id'             => brokerageListingId($index + 1),
            ':extId'          => $lead['extId'],
            ':name'           => $lead['name'],
            ':contact'        => $contactParts ? implode(' / ', $contactParts) : null,
            ':phone'          => $lead['phone'],
            ':mail'           => $lead['mail'],
            ':targetProperty' => $lead['targetProperty'],
            ':budget'         => $lead['budget'],
            ':note'           => $lead['note'],
            ':receivedDate'   => $lead['receivedDate'],
        ]);
    }
}
