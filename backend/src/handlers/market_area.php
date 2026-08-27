<?php

/**
 * 市況分析：エリア軸のマスタ（e-Stat 由来）
 *
 *   population   … 5歳階級・男女別の人口
 *   households   … 世帯総数
 *   households_c … 住宅の種類別・家族類型別の世帯数内訳
 *   building     … 建築着工（利用関係別・月次）
 *
 * この4つは Market の1画面で必ず同時に使うため、1リクエストにまとめる。
 * 全件でも数千行に収まるので、絞り込みはフロント側で行う。
 *
 * ※ e-Stat 由来のテーブルは参照のみ。ここでは一切書き換えない。
 */

require_once __DIR__ . '/../core/market.php';

$areaKey = marketAreaKeyExpr('area');
$isDistrict = marketIsDistrictExpr('area');
$isWard = marketIsWardExpr('area');

/**
 * 人口データがある都道府県だけに絞る。
 *
 * 市況表の行は人口で作るため、人口が無い県のデータを返しても画面には出ない。
 * 建築着工の月次は全国 32,021行あり、そのまま返すと数MBになる。
 */
$prefFilter = "pref IN (SELECT DISTINCT pref FROM population WHERE pref <> '')";

// ---------------------------------------------------------------------------
// 人口
//   area = '-' が県全域の行。市区町村の行と混ざっているので、
//   フロントが区別できるよう isTotal を立てておく。
// ---------------------------------------------------------------------------
$sqlPopulation = "
    SELECT
      pref,
      area,
      {$areaKey}    AS areaKey,
      {$isDistrict} AS isDistrict,
      (area = '-')  AS isTotal,
      gender,
      year,
      amount,
      age_0_4, age_5_9, age_10_14, age_15_19, age_20_24, age_25_29, age_30_34,
      age_35_39, age_40_44, age_45_49, age_50_54, age_55_59, age_60_64,
      age_65_69, age_70_74, age_75_79, age_80_84, age_85_89, age_90_94,
      age_95_99, age_100_
    FROM population
    ORDER BY pref, no";

// ---------------------------------------------------------------------------
// 世帯総数
//
//   ※ 世帯数は経年比較の対象外。期間を切り替えても同じ値を返す。
//     国勢調査は5年おきで、月次・年次のどちらの軸にも素直に載らないため、
//     直近1時点のスナップショットとして扱うと決めている。
//     画面の「世帯数」列も期間フィルタの影響を受けない。
//
//   以前はこのテーブルに新旧2世代が積まれていて、
//   「no が小さい方を採る」という当て推量で重複を除いていた。
//   全国版CSVの取り込み時に新しい世代だけを残すようにしたので、
//   いまは (pref, area) が一意で、その処理はもう要らない。
// ---------------------------------------------------------------------------
$sqlHouseholds = "
    SELECT
      pref,
      area,
      {$areaKey}    AS areaKey,
      {$isDistrict} AS isDistrict,
      {$isWard}     AS isWard,
      (area = '-')  AS isTotal,
      amount,
      one_person,
      more_two_people,
      live_together
    FROM households
    WHERE {$prefFilter}
    ORDER BY pref, no";

// ---------------------------------------------------------------------------
// 世帯数の内訳（住宅の種類別）
//   世帯総数と同じく、こちらも経年比較はしない固定のスナップショット。
// ---------------------------------------------------------------------------
$sqlHouseholdsBreakdown = "
    SELECT
      pref,
      area,
      {$areaKey}    AS areaKey,
      {$isDistrict} AS isDistrict,
      {$isWard}     AS isWard,
      (area = '-')  AS isTotal,
      type,
      amount,
      one_person_under65, one_person_under30, one_person_30_64, one_person_over65,
      wife_husband, wife_husband_over65,
      wife_husband_child_under3, wife_husband_child_3_5, wife_husband_child_6_9,
      wife_husband_child_10_17, wife_husband_child_18_24, wife_husband_child_over25
    FROM households_c
    WHERE {$prefFilter}
    ORDER BY pref, no";

// ---------------------------------------------------------------------------
// 建築着工（月次）
//   owner        = 持家（注文住宅の分母）
//   condominiums = 分譲（建売の分母）
//   このテーブルには area = '-' の県全域行が無いため、県計はフロントで
//   isDistrict = 0 の行だけを合計して求める（郡と町の二重計上を避ける）。
// ---------------------------------------------------------------------------
$sqlBuilding = "
    SELECT
      pref,
      area,
      {$areaKey}    AS areaKey,
      {$isDistrict} AS isDistrict,
      {$isWard}     AS isWard,
      0             AS isTotal,
      REPLACE(year, '/', '-') AS period,
      amount,
      owner,
      rent,
      employer,
      condominiums
    FROM building
    WHERE {$prefFilter}
    ORDER BY pref, year, no";

// ---------------------------------------------------------------------------
// 建築着工（年次）
//   月次の building は10か月分しか無く経年比較ができないため、
//   e-Stat の年次表（2011〜2024）を別テーブルで持っている。
//   こちらは area = '-' の県全域行があるので、県計を足し上げで作る必要がない。
// ---------------------------------------------------------------------------
$sqlBuildingYearly = "
    SELECT
      pref,
      area,
      {$areaKey}    AS areaKey,
      {$isDistrict} AS isDistrict,
      {$isWard}     AS isWard,
      (area = '-')  AS isTotal,
      CAST(year AS CHAR) AS period,
      amount,
      owner,
      rent,
      employer,
      condominiums
    FROM building_yearly
    WHERE {$prefFilter}
    ORDER BY pref, areaCode, year";

try {
    $fetch = static function (PDO $pdo, string $sql): array {
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    };

    marketRespond([
        'population'          => $fetch($pdo, $sqlPopulation),
        'households'          => $fetch($pdo, $sqlHouseholds),
        'householdsBreakdown' => $fetch($pdo, $sqlHouseholdsBreakdown),
        'building'            => $fetch($pdo, $sqlBuilding),
        'buildingYearly'      => $fetch($pdo, $sqlBuildingYearly),
    ]);
} catch (PDOException $e) {
    marketFail('market_area', $e);
}
