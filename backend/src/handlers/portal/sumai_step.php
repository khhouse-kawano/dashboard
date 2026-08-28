<?php

// ============================================================================
// すまいステップの同期
//
//   呼び出し元: handlers/sumai_step_update.php
//     1件POSTされるたびに、直前に sumai_step_db へ保存した行だけを
//     下流の2テーブルへ流し込む。
//
//   同期先
//     1. inquiry_customer_resale … 反響顧客（従来からの同期）
//     2. brokerage_listings       … 不動産CRMの売却リード（kind='leads'）
//
//   どちらも **INSERT のみで UPDATE しない**。
//   取り込んだ後の phase / staff / note は担当者が画面上で編集するため、
//   CSV を再取込するたびに上書きすると手入力が消えてしまう。
// ============================================================================

// $data は index.php が組み立てたリクエストボディ。
// 管理番号（すまいステップ側のID）が無いと対象行を特定できないため、同期しない。
require_once __DIR__ . '/../../core/brokerage_id.php';

$sumaiStepId = isset($data['id']) ? trim((string) $data['id']) : '';

if ($sumaiStepId === '') {
    error_log('portal/sumai_step.php: id が空のため同期をスキップしました');
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
            last_name,
            first_name_kana,
            last_name_kana,
            medium,
            response_medium,
            mobile,
            mail,
            zip,
            building,
            property,
            area,
            brand,
            note
            )
        SELECT
            CONCAT('sumai_step_', id),
            '売り:ポータル',
            DATE_FORMAT(`date`, '%Y/%m/%d'),
            sei,
            mei,
            sei_kana,
            mei_kana,
            'すまいステップ',
            'すまいステップ',
            phone,
            mail,
            zip,
            CONCAT_WS('', address_1, address_2, address_3),
            estate,
            CONCAT_WS('', estate_pref, estate_city, estate_town, estate_street, estate_building, estate_room),
            '中古住宅専門店',
            remarks
        FROM
            sumai_step_db
        WHERE
            id = :id";

$stmt = $pdo->prepare($sql);
$stmt->execute([':id' => $sumaiStepId]);

// ----------------------------------------------------------------------------
// 2. 不動産CRMの売却リード（brokerage_listings, kind='leads'）
//
//   突合キーは `extId` = 'sumai:{管理番号}'。
//   brokerage_listings の UNIQUE 制約は `id` にしか無いため、
//   INSERT IGNORE では重複を防げず NOT EXISTS で判定する。
//   （work.js 由来の手動取込レコードは `id` がランダム文字列で、
//     突合できるのは extId だけ）
//
//   ⚠ 照合順序に注意
//     sumai_step_db      … utf8mb4_general_ci
//     brokerage_listings … utf8mb4_unicode_ci
//   COLLATE を付けずに比較すると ERROR 1267 で落ちる。
//
//   phase / staff は入れない。
//     phase 空欄 = 画面上の「リード受信」。担当者が割り当てて進捗を進める運用。
//
//   `id` はアプリが採番するものと同じ書式で作る（core/brokerage_id.php）。
//   ランダムを含むので、再取込の抑止は上記 extId の NOT EXISTS だけが担う。
// ----------------------------------------------------------------------------
$sqlBroker = "INSERT INTO brokerage_listings
            (kind,
            id,
            extId,
            source,
            category,
            addr,
            name,
            contact,
            phone,
            mail,
            reason,
            timing,
            note,
            receivedDate,
            show_dashboard
            )
        SELECT
            'leads',
            :broker_id,
            CONCAT('sumai:', s.id),
            'すまいステップ',
            -- 物件種別を CRM 側の区分名に寄せる。未知の値はそのまま残す
            CASE s.estate
                WHEN '一戸建て'       THEN '戸建'
                WHEN 'マンション一室' THEN 'マンション'
                WHEN 'マンション一棟' THEN 'マンション'
                WHEN '土地'           THEN '土地'
                ELSE NULLIF(s.estate, '')
            END,
            NULLIF(CONCAT_WS('', s.estate_pref, s.estate_city, s.estate_town,
                                 s.estate_street, s.estate_building, s.estate_room), ''),
            -- CSV の mei には先頭に空白が入っている行がある
            NULLIF(CONCAT_WS(' ', NULLIF(TRIM(s.sei), ''), NULLIF(TRIM(s.mei), '')), ''),
            NULLIF(CONCAT_WS(' / ', NULLIF(s.phone, ''), NULLIF(s.mail, '')), ''),
            NULLIF(s.phone, ''),
            NULLIF(s.mail, ''),
            -- 査定の理由は複数選択が区切り無しで連結されて届く。
            -- 『その他』が含まれる行は自由入力（reason_other）を併記する
            NULLIF(CONCAT_WS('／', NULLIF(s.reason, ''), NULLIF(s.reason_other, '')), ''),
            NULLIF(s.period, ''),
            -- 既存レコードの書式に合わせる:
            --   {査定の理由}／売却希望:{時期}／査定書:{状態}
            --   （ご要望・ご質問があれば改行して追記）
            NULLIF(
                CONCAT_WS(
                    '\n',
                    NULLIF(CONCAT_WS('／',
                        NULLIF(CONCAT_WS('／', NULLIF(s.reason, ''), NULLIF(s.reason_other, '')), ''),
                        CONCAT('売却希望:', IFNULL(NULLIF(s.period, ''), '未回答')),
                        CONCAT('査定書:', IFNULL(NULLIF(s.report, ''), '未回答'))
                    ), ''),
                    NULLIF(s.opinion, '')
                ), ''),
            -- `date` は '2025-08-19 11:16:05' 形式のテキスト。
            -- 日付として読めない値は NULL にして取り込みを止めない
            STR_TO_DATE(LEFT(s.`date`, 10), '%Y-%m-%d'),
            1
        FROM
            sumai_step_db s
        WHERE
            s.id = :id
            -- CSV の改行入りフィールドでパースが崩れた行が混ざる。
            -- id / date が欠けた行はゴミなので取り込まない
            AND s.id <> ''
            AND s.`date` IS NOT NULL
            AND s.`date` <> ''
            AND NOT EXISTS (
                SELECT 1 FROM brokerage_listings b
                WHERE b.extId = CONCAT('sumai:', s.id COLLATE utf8mb4_unicode_ci)
            )";

$stmtBroker = $pdo->prepare($sqlBroker);
$stmtBroker->execute([
    ':id'        => $sumaiStepId,
    // 既に取り込み済みで1行も INSERT されないこともあるが、
    // その場合は採番した id を使わないだけで実害は無い
    ':broker_id' => brokerageListingId(),
]);
