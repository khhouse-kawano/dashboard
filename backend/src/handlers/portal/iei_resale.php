<?php

// ============================================================================
// イエイの同期
//
//   呼び出し元: handlers/iei_resale_update.php
//     1件POSTされるたびに、直前に iei_db へ保存/更新した行だけを
//     下流の2テーブルへ流し込む。
//
//   同期先
//     1. inquiry_customer_resale … 反響顧客（従来からの同期）
//     2. brokerage_listings       … 不動産CRMの売却リード（kind='leads'）
//
//   どちらも **INSERT のみで UPDATE しない**。
//   取り込んだ後の phase / staff / note は担当者が画面上で編集するため、
//   同じ人物から再依頼があるたびに上書きすると手入力が消えてしまう。
// ============================================================================

require_once __DIR__ . '/../../core/brokerage_id.php';

// $uniqueId は呼び出し元が組み立てた iei_db.id。
// 対象行を特定できないと同期できないため、無ければ何もしない。
$ieiRowId = isset($uniqueId) ? trim((string) $uniqueId) : '';

if ($ieiRowId === '') {
    error_log('portal/iei_resale.php: id が空のため同期をスキップしました');
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
            first_name_kana,
            medium,
            response_medium,
            mobile,
            landline,
            mail,
            building,
            property,
            area,
            brand,
            note
            )
        SELECT
            CONCAT('iei_', id),
            '売り:ポータル',
            DATE_FORMAT(registered_at, '%Y/%m/%d'),
            `name`,
            name_kana,
            'イエイ',
            'イエイ',
            tel1,
            tel2,
            email,
            `address`,
            property_type,
            property_address,
            '中古住宅専門店',
            remarks
        FROM
            iei_db
        WHERE
            id = :id";

$stmt = $pdo->prepare($sql);
$stmt->execute([':id' => $ieiRowId]);

// ----------------------------------------------------------------------------
// 2. 不動産CRMの売却リード（brokerage_listings, kind='leads'）
//
//   ⚠ extId の形式と、既存レコードとの突合について
//     イエイの売りリードは既に31件あり、**'anken:{案件番号}' の形式**で入っている
//     （source='イエイ'。期間も iei_db と完全に一致）。
//     ところが案件番号は GAS の抽出対象に無く、iei_db のどこにも残っていないため
//     同じ形式は再現できない。そこで新規分は 'iei:{システム受付日}:{姓名}' とする。
//
//     この結果 extId が2系統になるので、**重複判定は extId ではなく
//     「氏名 + 反響日」で行う**。'anken:' と 'iei:' の両方に当てることで、
//     旧・新どちらの重複も防げる。イエウールと同じ考え方。
//     （実測: iei_db 29件のうち28件が氏名+受付日で既存 anken: と一致する。
//       extId だけで突合すると、その28件が丸ごと二重登録される）
//
//     iei_db.id を使わないのは、iei_resale_update.php が email で突合して
//     UPDATE し `iei_` の id を使い回すため。同一人物が別物件を再依頼すると
//     同じ id のまま上書きされ、2件目のリードが作られなくなる。
//
//   ⚠ 照合順序に注意
//     iei_db             … utf8mb4_general_ci
//     brokerage_listings … utf8mb4_unicode_ci
//   COLLATE を付けずに比較すると ERROR 1267 で落ちる。
//
//   ⚠ GAS の抽出値には「次の項目のラベル」が混入しているものがある
//     extractBracket() の後読み (?=\\n［|\\n▼|$) が空欄で誤マッチするため、実測で
//       rent 29/29 ・ requests 28/29 ・ land_area 3 ・ building_area 2 ・ built_year 2
//     が汚染されている。ここでは**汚染0件の項目だけ**を使う。
//
//   phase / staff は入れない（phase 空欄 = 画面上の「リード受信」）。
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
            CONCAT('iei:', LEFT(d.registered_at, 10), ':', d.`name`),
            'イエイ',
            -- 物件種別を CRM 側の区分名に寄せる。未知の値はそのまま残す
            CASE d.property_type
                WHEN '一戸建'         THEN '戸建'
                WHEN '一戸建て'       THEN '戸建'
                WHEN '分譲マンション' THEN 'マンション'
                WHEN '土地'           THEN '土地'
                ELSE NULLIF(d.property_type, '')
            END,
            NULLIF(d.property_address, ''),
            NULLIF(TRIM(d.`name`), ''),
            NULLIF(CONCAT_WS(' / ', NULLIF(d.tel1, ''), NULLIF(d.email, '')), ''),
            NULLIF(d.tel1, ''),
            NULLIF(d.email, ''),
            NULLIF(d.reason, ''),
            NULLIF(d.sale_timing, ''),
            -- 他ポータルと同じ書式。使うのは汚染0件の項目だけ
            NULLIF(CONCAT_WS('／',
                NULLIF(d.reason, ''),
                CONCAT('売却時期:', NULLIF(d.sale_timing, '')),
                CONCAT('現況:',     NULLIF(d.current_status, '')),
                CONCAT('ご名義:',   NULLIF(d.ownership, ''))
            ), ''),
            STR_TO_DATE(LEFT(d.registered_at, 10), '%Y-%m-%d'),
            1
        FROM
            iei_db d
        WHERE
            d.id = :id
            -- extId を組み立てられない行は取り込まない
            AND NULLIF(TRIM(d.`name`), '') IS NOT NULL
            AND STR_TO_DATE(LEFT(d.registered_at, 10), '%Y-%m-%d') IS NOT NULL
            -- 旧形式(anken:) と新形式(iei:) の両方に当てる。
            -- 案件番号が取れない以上、氏名+反響日が唯一の突合手段
            AND NOT EXISTS (
                SELECT 1 FROM brokerage_listings b
                WHERE (b.extId LIKE 'anken:%' OR b.extId LIKE 'iei:%')
                  AND b.`name` = d.`name` COLLATE utf8mb4_unicode_ci
                  AND b.receivedDate = STR_TO_DATE(LEFT(d.registered_at, 10), '%Y-%m-%d')
            )";

$stmtBroker = $pdo->prepare($sqlBroker);
$stmtBroker->execute([
    ':id'        => $ieiRowId,
    // 既に取り込み済みで1行も INSERT されないこともあるが、
    // その場合は採番した id を使わないだけで実害は無い
    ':broker_id' => brokerageListingId(),
]);
