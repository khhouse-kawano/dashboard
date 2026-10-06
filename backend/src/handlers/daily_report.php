<?php
/**
 * 月次日報（frontend/src/components/header/DailyReports.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **1つの事業 × 1か月分だけを返す**（v2.2.167）。
 *
 *   以前は master_data 3表・call_sheet・interview_sheet を**全件**返しており、
 *   本番でメモリ上限を超えて応答が返らなくなった（ローカルでもログだけで約45MB）。
 *   ⚠️ **全件を返す形に戻してはならない。**
 *
 *   受け取るもの: { request: 'daily_report', division: '注文事業', month: '2026-10' }
 *   画面は事業か月を変えるたびに取り直す。
 *
 * ⚠️ call_sheet / interview_sheet は **shop で事業を判定する。** shop が空の行は
 *   どの事業にも入らない（2026-10-06_fill_sheet_shop.sql でマスタから埋めた）。
 * ⚠️ ログは**その月の分だけ**に削って返す。画面は日付で集計するだけなので結果は変わらない。
 * ⚠️ 返す形（キー名・call_log が JSON 文字列であること）は以前と同じにしてある。
 * ─────────────────────────────────────────────
 */
ini_set('memory_limit', '256M');

/**
 * 事業 → 反響を取るマスタと列。
 *
 * ⚠️ 列は以前の UNION ALL と同じ（⚠️ 第二面談・契約の列は事業ごとに違う）。
 * ⚠️ authority は画面がログイン中の事業（shopName）で絞るのに使う。
 */
$DIVISION_SOURCES = [
    '注文事業' => [
        'authority'   => 'order',
        'table'       => 'master_data',
        'appointment' => 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        'contract'    => 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
    ],
    '建売分譲事業' => [
        'authority'   => 'spec',
        'table'       => 'master_data_kaeru',
        'appointment' => 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        'contract'    => 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
    ],
    '中古リノベ' => [
        'authority'   => 'used',
        'table'       => 'master_data_resale',
        'appointment' => 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
        'contract'    => 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
    ],
];

/**
 * マスタ・call_sheet・interview_sheet に入っている元の店舗名 → shop_list の店舗名。
 *
 * ⚠️⚠️ **読み替えはここだけ**（v2.2.167）。返す shop は読み替え済みなので、
 *   画面（DailyReports.tsx）は読み替えない。⚠️ 以前は画面側に shopMapping があった。
 */
$SHOP_NAME_OF_RAW = [
    '買い:中古リノベ' => '中古住宅専門店',
    '買い:ポータル'   => '不動産企画係',
    '売り:ポータル'   => '不動産企画係',
];

/** 元の店舗名を shop_list の店舗名にする（⚠️ 対応表に無ければそのまま） */
$toShopName = function ($raw) use ($SHOP_NAME_OF_RAW) {
    return $SHOP_NAME_OF_RAW[$raw ?? ''] ?? $raw;
};

$division = is_string($data['division'] ?? null) ? $data['division'] : '';
$month    = is_string($data['month'] ?? null) ? $data['month'] : '';

// ⚠️ 事業はテーブル名・列名に使うため、一覧にある値以外は受けない
if (!isset($DIVISION_SOURCES[$division]) || !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => '事業または月の指定が正しくありません'], JSON_UNESCAPED_UNICODE);
    exit;
}

$source = $DIVISION_SOURCES[$division];
[$year, $mon] = explode('-', $month);

// マスタの日付は 2026/10/01 と 2026-10-01 が混在する
$dateLikeDash  = "{$year}-{$mon}-%";
$dateLikeSlash = "{$year}/{$mon}/%";

// ログ（JSON）の day をその月で拾う正規表現（行の絞り込み用。⚠️ 最終判定は PHP 側で行う）。
// ⚠️⚠️ 書き方が揃っていない。⚠️ 1つの行の中でも混ざっている:
//   "day":"2026-10-01" ／ "day": "2026/10/01"（⚠️ コロンの後に空白）／ "day":"2026\/10\/01"
//   ⚠️ LIKE で "day":" 決め打ちにすると空白ありの行を取りこぼす（2026-10-06 に中古リノベで3件ずれた）。
// ⚠️ プレースホルダで渡すので SQL のエスケープは掛からない。`\\\\` は正規表現の `\\`（= バックスラッシュ1文字）
$logRegexp = '"day"[[:space:]]*:[[:space:]]*"' . $year . '(-|\\\\?/)' . $mon . '(-|\\\\?/)';

// ---------------------------------------------------------------------
// 反響（その事業のマスタ1表。⚠️ その月の日付を1つでも持つ行だけ）
// ---------------------------------------------------------------------
$dateColumns = [
    'register'    => 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99',
    'interview'   => 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
    'appointment' => $source['appointment'],
    'contract'    => $source['contract'],
];
$monthConditions = [];
$monthParams = [];
foreach ($dateColumns as $column) {
    $monthConditions[] = "{$column} LIKE ? OR {$column} LIKE ?";
    $monthParams[] = $dateLikeDash;
    $monthParams[] = $dateLikeSlash;
}
$selectDates = [];
foreach ($dateColumns as $alias => $column) {
    $selectDates[] = "{$column} AS {$alias}";
}

$sql_response = "SELECT
    ? AS authority,
    in_charge_store AS shop,
    in_charge_user AS staff,
    sales_promotion_name AS medium,
    " . implode(",\n    ", $selectDates) . "
FROM {$source['table']}
WHERE " . implode(' OR ', $monthConditions);
$stmt_response = $pdo->prepare($sql_response);
$stmt_response->execute(array_merge([$source['authority']], $monthParams));
$response_response = $stmt_response->fetchAll(PDO::FETCH_ASSOC);
foreach ($response_response as &$responseRow) {
    $responseRow['shop'] = $toShopName($responseRow['shop']);
}
unset($responseRow);

// ---------------------------------------------------------------------
// 店舗・スタッフ（⚠️ 画面の事業の選択肢は shop_list から作るので全店舗を返す）
// ---------------------------------------------------------------------
$stmt_shop = $pdo->prepare("SELECT id, brand, shop, division, section, area, report_flag FROM shop_list");
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

// ⚠️ 画面が使う列だけ（⚠️ メールアドレスなどは返さない）
$stmt_staff = $pdo->prepare(
    "SELECT id, name, shop, section, period, status, report, position FROM staff_list WHERE report = 1"
);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

// その事業の店舗を、call_sheet / interview_sheet の元の名前で（⚠️ 読み替え前の名前も含める）
$divisionShopSet = [];
foreach ($response_shop as $shop) {
    if ($shop['division'] === $division && (int)$shop['report_flag'] === 1) $divisionShopSet[$shop['shop']] = true;
}
$divisionShops = array_keys($divisionShopSet);
foreach ($SHOP_NAME_OF_RAW as $raw => $shopName) {
    if (isset($divisionShopSet[$shopName])) $divisionShops[] = $raw;
}

/**
 * call_sheet / interview_sheet から、その事業の店舗・その月のログだけを取る。
 *
 * ⚠️ fetchAll せず1行ずつ読み、その月のログだけを残す（⚠️ メモリ対策の本体）。
 * ⚠️ 画面が使う day / action / staff だけを残す（⚠️ note は長いので返さない）。
 * ⚠️ 返す形は以前と同じ { shop, <ログ列>: JSON文字列 }。⚠️ shop は読み替え済み。
 */
$fetchMonthLogs = function (string $table, string $logColumn) use ($pdo, $divisionShops, $logRegexp, $month, $toShopName): array {
    if (count($divisionShops) === 0) return [];

    $shopHolders = implode(',', array_fill(0, count($divisionShops), '?'));
    $stmt = $pdo->prepare(
        "SELECT shop, {$logColumn} FROM {$table} WHERE shop IN ({$shopHolders}) AND {$logColumn} REGEXP ?"
    );
    $stmt->execute(array_merge($divisionShops, [$logRegexp]));

    $prefix = $month . '-';
    $rows = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $logs = json_decode($row[$logColumn] ?? '', true);
        if (!is_array($logs)) continue;

        $kept = [];
        foreach ($logs as $log) {
            if (!is_array($log)) continue;
            $day = str_replace('/', '-', (string)($log['day'] ?? ''));
            if (strpos($day, $prefix) !== 0) continue;
            $kept[] = [
                'day'    => $day,
                'action' => $log['action'] ?? null,
                'staff'  => $log['staff'] ?? null,
            ];
        }
        if (count($kept) === 0) continue;

        $rows[] = [
            'shop'     => $toShopName($row['shop']),
            $logColumn => json_encode($kept, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }
    return $rows;
};

$result = [
    "response"  => $response_response,
    "call"      => $fetchMonthLogs('call_sheet', 'call_log'),
    "interview" => $fetchMonthLogs('interview_sheet', 'interview_log'),
    "shop"      => $response_shop,
    "staff"     => $response_staff,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
