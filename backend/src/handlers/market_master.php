<?php

/**
 * 市況分析：絞り込み用のマスタ
 *
 * 店舗・担当者・販促媒体・都道府県・対象月を返す。
 *
 * 都道府県を DB から返すのが要点。旧実装はフロントに
 * ["鹿児島県","宮崎県","熊本県","大分県","佐賀県"] をハードコードしていたが、
 * 実データには福岡県の契約があり、事業所も KH佐賀 / KH大分 / JH熊本 /
 * PGH宮崎 / KH八代 と広がっている。ハードコードのままだと新しい県が
 * 一覧から丸ごと抜け落ちる。
 */

require_once __DIR__ . '/../core/market.php';

// ---------------------------------------------------------------------------
// 店舗
//   report_flag = 1 が帳票の対象店舗。
// ---------------------------------------------------------------------------
$sqlShop = "
    SELECT brand, shop, section, area
    FROM shop_list
    WHERE report_flag = 1 AND shop <> ''
    ORDER BY brand_sort, id";

// ---------------------------------------------------------------------------
// 課
//   注文事業と建売分譲事業の課だけを出す。
//   不動産企画室・中古リノベは市況分析の対象外。
// ---------------------------------------------------------------------------
$sqlSection = "
    SELECT name, division
    FROM section_list
    WHERE division IN ('注文事業', '建売分譲事業') AND name <> ''
    ORDER BY division DESC, no";

// ---------------------------------------------------------------------------
// 担当者
//
//   課・店舗での絞り込みは、この一覧を突合表にして担当者名で行う。
//   契約・着工のデータ（contract_customer / kaeru_building）は店舗コードを
//   持たず担当者名しか無いため、担当者を経由しないと課や店舗で絞れない。
//
//   period は年度を表す。異動があるので「今年の所属」で見る。
//   今年のデータがまだ無い時期に空になると絞り込みが全滅するので、
//   今年以前で最も新しい年度にフォールバックする。
// ---------------------------------------------------------------------------
$sqlStaff = "
    SELECT name, shop, section
    FROM staff_list
    WHERE name <> ''
      AND period = (
        SELECT MAX(period) FROM staff_list
        WHERE period <> '' AND period <= CAST(YEAR(CURDATE()) AS CHAR)
      )
    ORDER BY sort, id";

// ---------------------------------------------------------------------------
// 販促媒体
//   medium が個別の媒体名、ma_category がそれをまとめた分類。
//   一覧の絞り込みには分類を使い、集計時に medium へ展開する。
// ---------------------------------------------------------------------------
$sqlMedium = "
    SELECT medium, ma_category
    FROM medium_list
    WHERE ma_medium = 1 AND ma_category <> ''
    ORDER BY sort_key, id";

// ---------------------------------------------------------------------------
// 都道府県
//   人口データがある県だけを対象にする。人口が無ければ市況表の行が作れない。
// ---------------------------------------------------------------------------
$sqlPref = "
    SELECT DISTINCT pref
    FROM population
    WHERE pref <> ''
    ORDER BY pref";

// ---------------------------------------------------------------------------
// 着工データが存在する年月
//   期間セレクタの選択肢。旧実装は 2025/01 からの固定配列を組み立てていたため、
//   データが無い月まで並び、逆にデータがある月が出ないことがあった。
// ---------------------------------------------------------------------------
$sqlPeriod = "
    SELECT DISTINCT REPLACE(year, '/', '-') AS period
    FROM building
    WHERE year <> ''
    ORDER BY period";

// ---------------------------------------------------------------------------
// 着工データが存在する年（年次）
//   月次の building は10か月分しか無いので、経年比較はこちらを使う。
// ---------------------------------------------------------------------------
$sqlYear = "
    SELECT DISTINCT CAST(year AS CHAR) AS period
    FROM building_yearly
    ORDER BY period";

try {
    $fetch = static function (PDO $pdo, string $sql): array {
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    };

    $column = static fn(array $rows, string $key): array
        => array_values(array_map(static fn(array $row) => $row[$key], $rows));

    marketRespond([
        'shops'    => $fetch($pdo, $sqlShop),
        'sections' => $fetch($pdo, $sqlSection),
        'staff'    => $fetch($pdo, $sqlStaff),
        'mediums'  => $fetch($pdo, $sqlMedium),
        'prefs'   => $column($fetch($pdo, $sqlPref), 'pref'),
        'periods' => $column($fetch($pdo, $sqlPeriod), 'period'),
        'years'   => $column($fetch($pdo, $sqlYear), 'period'),
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('market_master: ' . $e->getMessage());
    marketRespond(['status' => 'error', 'message' => 'マスタの取得に失敗しました。']);
}
