<?php

/**
 * ポータル反響の印（v2.2.281）。② の backend-express/src/features/list/portal.ts の予備。
 *
 * 判定：反響の medium と response_medium が同じで、inquiry_id の頭がポータルの接頭辞
 *   （大文字小文字を区別）で、その接頭辞のサイト名と medium が一致するとき。
 *
 * ⚠️⚠️ ② portal.ts と backend/scripts/sql/2026-11-18_update_log_2.2.281.sql（過去分の埋め戻し）と
 *   **同じ式**にすること。変えるときは3か所そろえる。
 * ⚠️ ポータルと判定できないときは何もしない（前に入っている印は消さない）。
 */
const PORTAL_PREFIXES = [
    ['suumo', 'SUUMO'],
    ['homes', "HOME'S"],
    ['athome', 'athome'],
    ['townlife', 'タウンライフ'],
    ['allgrit', 'ALLGRIT'],
    ['kagosuma', 'カゴスマ'],
    ['mochiie', '持ち家計画'],
    ['tochishinchaku', '土地新着ネット'],
    ['housingBazar', 'ハウジングバザール'],
    ['metaJutaku', 'メタ住宅展示場'],
];

/** 取り込んだ反響（inquiry_id）がポータルなら、その顧客台帳に印を付ける SQL と値。対象外の事業なら null */
function portalMarkSql(string $category, string $inquiryId): ?array
{
    $tables = [
        'order' => ['master_data', 'inquiry_customer'],
        'spec' => ['master_data_kaeru', 'inquiry_customer_kaeru'],
    ];
    if (!isset($tables[$category]) || $inquiryId === '') return null;
    [$master, $inquiry] = $tables[$category];

    $whens = array_map(
        fn($p) => "WHEN i.inquiry_id LIKE BINARY '{$p[0]}%' THEN '" . str_replace("'", "''", $p[1]) . "'",
        PORTAL_PREFIXES
    );
    $siteByPrefix = 'CASE ' . implode(' ', $whens) . ' END';

    return [
        'sql' => "UPDATE {$master} m JOIN {$inquiry} i ON i.pg_id = m.id
                     SET m.portal_flag = 1, m.portal_site = i.medium
                   WHERE i.inquiry_id = ? AND i.medium = i.response_medium AND i.medium = {$siteByPrefix}",
        'params' => [$inquiryId],
    ];
}
