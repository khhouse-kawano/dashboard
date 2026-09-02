<?php

// ============================================================================
// イエウールの同期
//
//   呼び出し元: handlers/ieuru_resale_update.php
//     1件POSTされるたびに、直前に ieuru_resale へ保存/更新した行だけを
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

// $uniqueId は呼び出し元が組み立てた ieuru_resale.id。
// 対象行を特定できないと同期できないため、無ければ何もしない。
$ieuruRowId = isset($uniqueId) ? trim((string) $uniqueId) : '';

if ($ieuruRowId === '') {
    error_log('portal/ieuru_resale.php: id が空のため同期をスキップしました');
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
            mail,
            building,
            property,
            area,
            brand,
            note
            )
        SELECT
            -- 接頭辞は 'ieuru_'。以前はイエイからのコピペで 'iei_' になっており、
            -- イエイ由来（iei_iei_xxx）と紛らわしかった。
            -- 既存100件は 2026-08-28_ieuru_inquiry_id_prefix.sql で改名済みであること。
            CONCAT('ieuru_', id),
            '売り:ポータル',
            DATE_FORMAT(registered, '%Y/%m/%d'),
            `name`,
            nameKana,
            'イエウール',
            'イエウール',
            mobile,
            email,
            `address`,
            propertyType,
            propertyAddress,
            '中古住宅専門店',
            remarks
        FROM
            ieuru_resale
        WHERE
            id = :id";

$stmt = $pdo->prepare($sql);
$stmt->execute([':id' => $ieuruRowId]);

// ----------------------------------------------------------------------------
// 2. 不動産CRMの売却リード（brokerage_listings, kind='leads'）
//
//   ⚠ extId の形式について
//     既存437件は 'ieul:4896914' という**イエウールの依頼番号**を持つが、
//     この番号はメールから抽出しておらず ieuru_resale のどこにも残っていない
//     （全100件の remarks を既存437件の番号と総当たりして一致0件を確認済み）。
//     そのため同じ形式は再現できず、'ieul:{依頼日}:{氏名}' の新形式を使う。
//
//   ⚠ 重複判定は extId ではなく「氏名 + 反響日」で行う
//     既存437件は旧形式の extId なので、extId 同士では突合できない。
//     依頼日（requestDate）基準で既存と88件が一致することを実測で確認している
//     （システム受付日時 registered 基準だと72件に落ちるため requestDate を使う）。
//     この条件は新形式で取り込んだ自分自身の行にも当たるので、
//     旧・新どちらの重複もこれ1本で防げる。
//
//   ⚠ GAS の抽出値には「次の項目のラベル」が混入しているものがある
//     値が空のとき正規表現が次行を拾ってしまうため、実測で
//       requestsToCompany/replacementFlag/buildingName/totalFloorArea … 100件中100件
//       comment 88 / mansionName 72 / roomNumber 72 / exclusiveArea 72
//       assessmentMethod 31 / preferredContactTime 30 / buildingArea 34 / landArea 28
//     が汚染されている。ここでは**汚染0件の項目だけ**を使う。
//
//   phase / staff は入れない（phase 空欄 = 画面上の「リード受信」）。
//   timing はイエウールに売却時期の設問が無いため入れない（既存も全て NULL）。
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
            note,
            receivedDate,
            show_dashboard
            )
        SELECT
            'leads',
            :broker_id,
            CONCAT('ieul:', LEFT(i.requestDate, 10), ':', i.`name`),
            'イエウール',
            -- 物件種別を CRM 側の区分名に寄せる。未知の値はそのまま残す
            CASE i.propertyType
                WHEN '一戸建て'       THEN '戸建'
                WHEN '分譲マンション' THEN 'マンション'
                WHEN '土地'           THEN '土地'
                ELSE NULLIF(i.propertyType, '')
            END,
            NULLIF(i.propertyAddress, ''),
            NULLIF(TRIM(i.`name`), ''),
            NULLIF(CONCAT_WS(' / ', NULLIF(i.mobile, ''), NULLIF(i.email, '')), ''),
            NULLIF(i.mobile, ''),
            NULLIF(i.email, ''),
            NULLIF(i.reasonForAssessment, ''),
            -- 他ポータルと同じ書式。使うのは汚染0件の項目だけ
            NULLIF(CONCAT_WS('／',
                NULLIF(i.reasonForAssessment, ''),
                CONCAT('物件の状況:',   NULLIF(i.propertyStatus, '')),
                CONCAT('物件との関係:', NULLIF(i.relationshipToProperty, ''))
            ), ''),
            STR_TO_DATE(LEFT(i.requestDate, 10), '%Y-%m-%d'),
            1
        FROM
            ieuru_resale i
        WHERE
            i.id = :id
            -- extId を組み立てられない行は取り込まない
            AND NULLIF(TRIM(i.`name`), '') IS NOT NULL
            AND STR_TO_DATE(LEFT(i.requestDate, 10), '%Y-%m-%d') IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM brokerage_listings b
                WHERE b.extId LIKE 'ieul:%'
                  AND b.`name` = i.`name`
                  AND b.receivedDate = STR_TO_DATE(LEFT(i.requestDate, 10), '%Y-%m-%d')
            )";

$stmtBroker = $pdo->prepare($sqlBroker);
$stmtBroker->execute([
    ':id'        => $ieuruRowId,
    // 既に取り込み済みで1行も INSERT されないこともあるが、
    // その場合は採番した id を使わないだけで実害は無い
    ':broker_id' => brokerageListingId(),
]);
