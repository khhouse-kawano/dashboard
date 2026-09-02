<?php

/**
 * KPIの集計。
 *
 * ─────────────────────────────────────────────
 * 対象データ（重要）
 *   Claude に渡す集計は **master_data だけ** から作る。
 *   inquiry_customer には氏名・電話番号・メールなどの個人情報が含まれるため使用しない。
 *
 *   使用する列（show_dashboard = 1 のレコードのみ）:
 *     in_charge_store / in_charge_user / full_address / sales_promotion_name / status
 *     customer_rank / customer_demand / customer_contacts_annual_income
 *     registered_date / interview_date / next_interview_date / contract_date
 *
 *   顧客の個人情報にあたる列（full_address）は集計値としても外部に出さない。
 *   都道府県・市区町村まで丸めた値だけを使う。
 *
 *   in_charge_user は自社の従業員名であり顧客個人情報ではないため、
 *   絞り込み条件（WHERE）としての使用を許容する。
 *   ただし集計軸（GROUP BY）としては使わず、件数（COUNT DISTINCT）に留める。
 * ─────────────────────────────────────────────
 *
 * 生データ（23,000件超・8.7MB）をそのまま渡すと約366万トークンとなり
 * コンテキスト上限を超えるため、ここで数KBに圧縮する。
 */

/**
 * master_data の日付列（テキスト）。
 *
 * ⚠️ 同じ列に 'YYYY/MM/DD' と 'YYYY-MM-DD' の2形式が混在している。
 *   実測（show_dashboard = 1）:
 *     反響取得日 21,166件 = スラッシュ 20,479 + ハイフン   687
 *     面談日      5,823件 = スラッシュ  3,607 + ハイフン 2,215
 *     契約日        953件 = スラッシュ    645 + ハイフン   308
 *
 *   片方の形式だけでパースすると、面談の約4割・契約の約3割を取りこぼす。
 *   区切り文字をハイフンに正規化してから変換すること。
 *   （既存の handlers/menu.php も同じ理由で REPLACE を行っている）
 */
function kpiDateExpr(string $column): string
{
    return "STR_TO_DATE(NULLIF(REPLACE({$column}, '/', '-'), ''), '%Y-%m-%d')";
}

define('KPI_MD_REGISTERED', kpiDateExpr('step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99'));
define('KPI_MD_INTERVIEW',  kpiDateExpr('step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'));
define('KPI_MD_NEXT_IV',    kpiDateExpr('step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0'));
define('KPI_MD_CONTRACT',   kpiDateExpr('step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'));

const KPI_MD_RANK   = 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM';
const KPI_MD_DEMAND = 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN';

/**
 * full_address からエリアを取り出す式。
 *
 * ⚠️ full_address は個人を特定できる情報のため、**そのまま外部に出さない**。
 *   都道府県・市区町村まで丸めた集計値だけを分析に使う。
 *
 * 住所の書式が統一されていないため、空白での分割では正しく取れない。
 *   「鹿児島県 鹿児島市 …」  区切りあり
 *   「鹿児島県鹿児島市…」    区切りなし
 *   「出水市 出水市 …」      都道府県なし
 *   「草牟田1丁目…」         市区町村もなし
 * そのため都道府県名そのものを正規表現で判定する。
 * 実測の判定不可率: 都道府県 4.2% / 市区町村 2.2%
 */
define('KPI_MD_PREF', "REGEXP_SUBSTR(TRIM(full_address), '^(東京都|北海道|京都府|大阪府|..{1,2}県)')");
define('KPI_MD_CITY', "REGEXP_SUBSTR("
    . "TRIM(REPLACE(TRIM(full_address), COALESCE(" . KPI_MD_PREF . ", ''), '')), "
    . "'^[^0-9 ]{1,8}?[市区町村]')");

/**
 * 部門ごとの対象テーブル。
 *
 * ⚠️ テーブル名は SQL にプレースホルダで渡せないため、必ずこの配列で解決すること。
 *   リクエストの値をそのまま SQL に連結すると SQL インジェクションになる。
 *
 * 両テーブルの列構成は同一であることを確認済み（分析に使う13列すべて）。
 *
 * shop_division は shop_list.division の値。課・店舗の絞り込みで結合に使う。
 * label もこれに揃えてある（画面表示と shop_list の表記を一致させるため）。
 *
 * ⚠️ キー（order / kaeru）は ai_usage_log.feature に
 *   'kpi_analyze:order' として記録済みのため変更しないこと。
 */
const KPI_DIVISIONS = [
    'order' => ['table' => 'master_data',       'label' => '注文事業',     'shop_division' => '注文事業'],
    'kaeru' => ['table' => 'master_data_kaeru', 'label' => '建売分譲事業', 'shop_division' => '建売分譲事業'],
];

const KPI_DEFAULT_DIVISION = 'order';

/**
 * 部門キーから対象テーブル名を解決する。
 * 未知の値は既定（注文営業）にフォールバックする。
 */
function kpiResolveTable(string $division): string
{
    return KPI_DIVISIONS[$division]['table'] ?? KPI_DIVISIONS[KPI_DEFAULT_DIVISION]['table'];
}

function kpiDivisionLabel(string $division): string
{
    return KPI_DIVISIONS[$division]['label'] ?? KPI_DIVISIONS[KPI_DEFAULT_DIVISION]['label'];
}

/**
 * 保存済み分析のタイトル用の日付。例: 2026年8月27日
 *
 * date() に '年月日' を混ぜても動くが、書式文字と多バイト文字が
 * 隣り合うと読み手が混乱するため、明示的に組み立てる。
 */
function kpiFormatJpDate(?int $timestamp = null): string
{
    $ts = $timestamp ?? time();
    return date('Y', $ts) . '年' . date('n', $ts) . '月' . date('j', $ts) . '日';
}

/** 部門キーから shop_list.division の値を解決する */
function kpiShopDivision(string $division): string
{
    return KPI_DIVISIONS[$division]['shop_division']
        ?? KPI_DIVISIONS[KPI_DEFAULT_DIVISION]['shop_division'];
}

// ---------------------------------------------------------------------------
// 絞り込み（課 → 店舗 → スタッフ）
//
// master_data.in_charge_store は shop_list.shop と、
// master_data.in_charge_user は staff_list.name と一致することを実測で確認済み
// （店舗は完全一致。担当者の一致率は注文 97.7% / 建売 87.8%）。
//
// ⚠️ 絞り込みの値はクライアントから届く。SQL に連結せずプレースホルダで渡すのは
//   当然として、それに加えて「本当に存在する課・店舗・担当者か」「選択中の部門に
//   属しているか」をDBで必ず検証する。検証しないと、注文事業の画面から建売の
//   店舗を指定するといった、権限設計の外側の参照ができてしまう。
// ---------------------------------------------------------------------------

/** 絞り込みの指定が不正だったときに投げる。呼び出し側が 400 に変換する */
class KpiScopeException extends RuntimeException
{
}

/**
 * 分析対象になりうる店舗（report_flag = 1）。
 *
 * report_flag は「全社報告用フォーマットの表示の有無」。
 * ここを分析対象の定義として使うことで、'KH全店舗' のような集計用ダミー行や
 * 運用を終えた店舗が対象に混ざらない。
 *
 * @param string|null $section 指定するとその課に絞る
 * @return string[] 店舗名の配列
 */
function kpiDivisionShops(PDO $pdo, string $division, ?string $section = null): array
{
    $sql    = "SELECT shop FROM shop_list
                WHERE division = ? AND report_flag = 1 AND shop <> ''";
    $params = [kpiShopDivision($division)];

    if ($section !== null && $section !== '') {
        $sql     .= ' AND section = ?';
        $params[] = $section;
    }

    // DISTINCT + ORDER BY 非選択列は ONLY_FULL_GROUP_BY で落ちるうえ、
    // id が一意なので重複排除も効かない。GROUP BY + 集約で並べる。
    $stmt = $pdo->prepare($sql . ' GROUP BY shop ORDER BY MIN(brand_sort), MIN(id)');
    $stmt->execute($params);

    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

/**
 * リクエストの絞り込み指定を検証し、集計で使える形に解決する。
 *
 * 親が未選択のまま子だけを指定するのは受け付けない（課を選ばず店舗だけ、など）。
 * 画面のカスケードUIと同じ制約をサーバー側でも課すことで、
 * 「どの範囲を集計したのか」が scope_label から一意に読めるようにしている。
 *
 * @return array{
 *   section: ?string, shop: ?string, staff: ?string,
 *   shops: string[], label: string, active: bool
 * }
 * @throws KpiScopeException
 */
function kpiResolveScope(
    PDO $pdo,
    string $division,
    ?string $section = null,
    ?string $shop = null,
    ?string $staff = null
): array {
    $section = ($section === '') ? null : $section;
    $shop    = ($shop    === '') ? null : $shop;
    $staff   = ($staff   === '') ? null : $staff;

    if ($section === null && ($shop !== null || $staff !== null)) {
        throw new KpiScopeException('課を選択せずに店舗・スタッフだけを指定することはできません。');
    }
    if ($shop === null && $staff !== null) {
        throw new KpiScopeException('店舗を選択せずにスタッフだけを指定することはできません。');
    }

    // 絞り込みなし。部門全体が対象
    if ($section === null) {
        return [
            'section' => null, 'shop' => null, 'staff' => null,
            'shops'   => [],   'active' => false,
            'label'   => kpiDivisionLabel($division),
        ];
    }

    // --- 課 ---------------------------------------------------------------
    $sectionShops = kpiDivisionShops($pdo, $division, $section);
    if ($sectionShops === []) {
        throw new KpiScopeException('指定された課「' . $section . '」に対象店舗がありません。');
    }

    $labelParts = [kpiDivisionLabel($division), $section];
    $shops      = $sectionShops;

    // --- 店舗 -------------------------------------------------------------
    if ($shop !== null) {
        if (!in_array($shop, $sectionShops, true)) {
            throw new KpiScopeException('指定された店舗「' . $shop . '」は課「' . $section . '」に属していません。');
        }
        $labelParts[] = $shop;
        $shops        = [$shop];

        // --- スタッフ -----------------------------------------------------
        if ($staff !== null) {
            $stmt = $pdo->prepare(
                'SELECT COUNT(*) FROM staff_list WHERE name = ? AND shop = ?'
            );
            $stmt->execute([$staff, $shop]);

            if ((int)$stmt->fetchColumn() === 0) {
                throw new KpiScopeException('指定されたスタッフ「' . $staff . '」は店舗「' . $shop . '」に所属していません。');
            }
            $labelParts[] = $staff;
        }
    }

    return [
        'section' => $section,
        'shop'    => $shop,
        'staff'   => $staff,
        'shops'   => $shops,
        'active'  => true,
        'label'   => implode(' › ', $labelParts),
    ];
}

/**
 * 解決済みスコープを WHERE 句の断片とパラメータに変換する。
 *
 * @param array $scope kpiResolveScope() の戻り値。空配列なら絞り込みなし
 * @return array{0: string, 1: array} [SQL断片, バインドするパラメータ]
 */
function kpiScopeWhere(array $scope): array
{
    if (($scope['active'] ?? false) !== true) {
        return ['', []];
    }

    $sql    = '';
    $params = [];

    $shops = $scope['shops'] ?? [];
    if ($shops !== []) {
        $sql     .= ' AND in_charge_store IN (' . implode(',', array_fill(0, count($shops), '?')) . ')';
        $params   = array_merge($params, $shops);
    }

    if (($scope['staff'] ?? null) !== null) {
        $sql     .= ' AND in_charge_user = ?';
        $params[] = $scope['staff'];
    }

    return [$sql, $params];
}

/**
 * 販促媒体名の集計式。
 *
 * ⚠️ 建売分譲事業（master_data_kaeru）だけ、入力の粒度が揃っていない。
 *   実測（show_dashboard = 1）:
 *     ネット 4,903 ／ Instagram 182 ／ Web検索 163 ／ その他 197
 *     「Instagram、Web検索」のように「、」区切りで複数入っている行が約30種・30件
 *
 *   Instagram・Web検索・その他、および複数選択された行は、実態としては
 *   すべてネット経由の反響であり、既存の「ネット」と同じものを指している。
 *   分けたまま集計すると母数が割れ、媒体別の比較が成り立たない。
 *   そのため集計時に「ネット」へ丸める。
 *
 *   注文事業（master_data）はこの入力ゆれが無いため、丸めを行わない。
 *
 * ⚠️ この式は集計・絞り込みの両方で使うこと。
 *   片方だけに適用すると medium_monthly の突き合わせが空振りする。
 */
function kpiMediumExpr(string $division): string
{
    $raw = "COALESCE(NULLIF(sales_promotion_name, ''), '(未設定)')";

    if ($division !== 'kaeru') {
        return $raw;
    }

    return "CASE
              WHEN sales_promotion_name LIKE '%、%'                        THEN 'ネット'
              WHEN sales_promotion_name IN ('Instagram', 'Web検索', 'その他') THEN 'ネット'
              ELSE {$raw}
            END";
}

/**
 * 日数差を求める式。
 * 面談日が反響日より前になっているような入力ミス（負の値）は
 * GREATEST + NULLIF の組み合わせで NULL にし、平均から除外する。
 */
function kpiDaysBetween(string $from, string $to): string
{
    return "NULLIF(GREATEST(DATEDIFF({$to}, {$from}), -1), -1)";
}

/**
 * 指定した列でグループ化し、ファネル（反響→面談→契約）とリードタイムを集計する。
 *
 * 店舗別・媒体別・担当者別など、軸を変えるだけで使い回せるようにしてある。
 *
 * @param string $groupExpr グループ化する列名
 * @param string $alias     結果に付ける列名
 * @param array  $scope     kpiResolveScope() の戻り値。空なら部門全体
 */
function kpiFunnelBy(
    PDO $pdo,
    string $groupExpr,
    string $alias,
    int $limit = 20,
    string $division = KPI_DEFAULT_DIVISION,
    array $scope = []
): array {
    $table       = kpiResolveTable($division);
    $toInterview = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_INTERVIEW);
    $toContract  = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_CONTRACT);

    [$scopeSql, $scopeParams] = kpiScopeWhere($scope);

    $rows = kpiFetch($pdo, "
        SELECT COALESCE(NULLIF({$groupExpr}, ''), '(未設定)')                    AS `{$alias}`,
               COUNT(*)                                                          AS total,
               SUM(" . KPI_MD_INTERVIEW . " IS NOT NULL)                         AS interviewed,
               SUM(" . KPI_MD_CONTRACT  . " IS NOT NULL)                         AS contracted,
               SUM(status = '失注')                                              AS lost,
               SUM(" . KPI_MD_RANK . " IN ('Sランク','Aランク'))                  AS high_rank,
               COUNT(DISTINCT NULLIF(in_charge_user, ''))                        AS staff_count,
               ROUND(AVG({$toInterview}), 1)                                     AS avg_days_to_interview,
               ROUND(AVG({$toContract}), 1)                                      AS avg_days_to_contract
          FROM {$table}
         WHERE show_dashboard = 1
               {$scopeSql}
         GROUP BY 1
         ORDER BY total DESC
         LIMIT {$limit}
    ", $scopeParams);

    $rows = kpiToInt($rows, ['total', 'interviewed', 'contracted', 'lost', 'high_rank', 'staff_count']);

    // 率はここで計算しておく（モデルに割り算をさせない）
    foreach ($rows as $i => $r) {
        $rows[$i]['interview_rate_pct'] = $r['total'] > 0 ? round($r['interviewed'] / $r['total'] * 100, 1) : 0;
        $rows[$i]['contract_rate_pct']  = $r['total'] > 0 ? round($r['contracted'] / $r['total'] * 100, 1) : 0;
        // 面談まで進んだ人のうち何割が契約したか（営業力が最も表れる指標）
        $rows[$i]['close_rate_pct']     = $r['interviewed'] > 0 ? round($r['contracted'] / $r['interviewed'] * 100, 1) : 0;
        $rows[$i]['high_rank_pct']      = $r['total'] > 0 ? round($r['high_rank'] / $r['total'] * 100, 1) : 0;
        $rows[$i]['avg_days_to_interview'] = $r['avg_days_to_interview'] !== null ? (float)$r['avg_days_to_interview'] : null;
        $rows[$i]['avg_days_to_contract']  = $r['avg_days_to_contract']  !== null ? (float)$r['avg_days_to_contract']  : null;
    }

    return $rows;
}

/**
 * 分析の前提となる全体値と、各項目の入力率。
 *
 * 入力率が低い項目を軸にした分析は「入力済みの中での傾向」でしかないため、
 * モデルが誤った一般化をしないよう必ず一緒に渡す。
 */
/**
 * @param ?int $months 指定すると直近Nヶ月の反響だけを対象にする。
 *                     期間を絞った分析の比較基準として使うとき、
 *                     基準側だけが全期間だと母数の桁が変わり比較にならない。
 */
function kpiOverallContext(
    PDO $pdo,
    string $division = KPI_DEFAULT_DIVISION,
    array $scope = [],
    ?int $months = null
): array {
    $table       = kpiResolveTable($division);
    $toInterview = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_INTERVIEW);
    $toContract  = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_CONTRACT);

    [$scopeSql, $scopeParams] = kpiScopeWhere($scope);

    // プレースホルダは SQL の出現順にバインドされる。期間条件は scopeSql より前
    $periodSql    = '';
    $periodParams = [];
    if ($months !== null) {
        $periodSql    = ' AND ' . KPI_MD_REGISTERED
            . " >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ? MONTH)";
        $periodParams = [$months];
    }

    $row = kpiFetch($pdo, "
        SELECT COUNT(*)                                        AS total,
               SUM(" . KPI_MD_REGISTERED . " IS NOT NULL)      AS has_registered,
               SUM(" . KPI_MD_INTERVIEW  . " IS NOT NULL)      AS interviewed,
               SUM(" . KPI_MD_CONTRACT   . " IS NOT NULL)      AS contracted,
               SUM(NULLIF(" . KPI_MD_DEMAND . ", '') IS NOT NULL) AS has_demand,
               SUM(NULLIF(customer_contacts_annual_income, '') IS NOT NULL) AS has_income,
               SUM(NULLIF(" . KPI_MD_RANK . ", '') IS NOT NULL)    AS has_rank,
               ROUND(AVG({$toInterview}), 1)                   AS avg_days_to_interview,
               ROUND(AVG({$toContract}), 1)                    AS avg_days_to_contract
          FROM {$table}
         WHERE show_dashboard = 1
               {$periodSql}
               {$scopeSql}
    ", array_merge($periodParams, $scopeParams))[0] ?? [];

    $total = (int)($row['total'] ?? 0);
    $pct   = static fn(int $n): float => $total > 0 ? round($n / $total * 100, 1) : 0.0;

    return [
        'total'                 => $total,
        'interviewed'           => (int)$row['interviewed'],
        'contracted'            => (int)$row['contracted'],
        'interview_rate_pct'    => $pct((int)$row['interviewed']),
        'contract_rate_pct'     => $pct((int)$row['contracted']),
        'close_rate_pct'        => (int)$row['interviewed'] > 0
            ? round((int)$row['contracted'] / (int)$row['interviewed'] * 100, 1) : 0,
        'avg_days_to_interview' => $row['avg_days_to_interview'] !== null ? (float)$row['avg_days_to_interview'] : null,
        'avg_days_to_contract'  => $row['avg_days_to_contract']  !== null ? (float)$row['avg_days_to_contract']  : null,
        'input_coverage_pct'    => [
            'registered_date' => $pct((int)$row['has_registered']),
            'interview_date'  => $pct((int)$row['interviewed']),
            'contract_date'   => $pct((int)$row['contracted']),
            'customer_rank'   => $pct((int)$row['has_rank']),
            'customer_demand' => $pct((int)$row['has_demand']),
            'annual_income'   => $pct((int)$row['has_income']),
        ],
    ];
}

/**
 * スナップショット共通の「対象範囲」の説明文。
 * モデルが集計母数を取り違えないよう、絞り込みの有無を明示する。
 */
function kpiScopeDescription(string $division, array $scope): string
{
    $base = kpiDivisionLabel($division) . '（' . kpiResolveTable($division)
        . '）の show_dashboard = 1（ダッシュボード表示対象）のみ。重複・非表示レコードは除外。';

    if (($scope['active'] ?? false) !== true) {
        return $base;
    }

    return $base . ' さらに「' . $scope['label'] . '」に絞り込み済み'
        . '（対象店舗: ' . implode('/ ', $scope['shops'] ?? [])
        . (($scope['staff'] ?? null) !== null ? ' ／ 担当者: ' . $scope['staff'] : '')
        . '）。以下の数値はすべてこの範囲のもの。';
}

/**
 * 絞り込み時の比較基準。部門全体の値を benchmark として併せて返す。
 *
 * これが無いと「面談化率18%」が良いのか悪いのか判断できず、
 * モデルが一般論を書き始めてしまう。絞り込みが無いときは overall と
 * 同じ値になり冗長なので null を返す。
 */
function kpiBenchmark(PDO $pdo, string $division, array $scope, ?int $months = null): ?array
{
    if (($scope['active'] ?? false) !== true) {
        return null;
    }

    // 期間を絞った分析では、基準側も同じ期間で取る。
    // 片方だけ全期間にすると件数が桁違いになり、比較として成立しない。
    return [
        'label'   => kpiDivisionLabel($division) . '全体'
            . ($months !== null ? '（直近' . $months . 'ヶ月）' : ''),
        'context' => kpiOverallContext($pdo, $division, [], $months),
    ];
}

/** 「店舗別サマリー」分析用のスナップショット（エリア別を含む） */
function buildShopSummarySnapshot(PDO $pdo, string $division = KPI_DEFAULT_DIVISION, array $scope = []): array
{
    return [
        'generated_at' => date('Y-m-d H:i'),
        'division'     => kpiDivisionLabel($division),
        'scope_label'  => $scope['label'] ?? kpiDivisionLabel($division),
        'scope'        => kpiScopeDescription($division, $scope),
        'note'         => 'リードタイムは、面談日や契約日が反響取得日より前になっている入力ミス（全体の約0.2%）を除外して算出。'
            . 'エリアは顧客の住所から都道府県・市区町村まで丸めたもの（判定不可: 都道府県4.2% / 市区町村2.2%）。'
            . '店舗の所在地ではなく顧客の居住地である点に注意。',
        'overall'      => kpiOverallContext($pdo, $division, $scope),
        'benchmark'    => kpiBenchmark($pdo, $division, $scope),
        'shops'        => kpiFunnelBy($pdo, 'in_charge_store', 'shop', 20, $division, $scope),
        'areas'        => kpiFunnelBy($pdo, KPI_MD_PREF, 'area', 10, $division, $scope),
        'cities'       => kpiFunnelBy($pdo, KPI_MD_CITY, 'city', 15, $division, $scope),
    ];
}

/** 「販促媒体別サマリー」分析用のスナップショット */
function buildMediumSummarySnapshot(PDO $pdo, string $division = KPI_DEFAULT_DIVISION, array $scope = []): array
{
    return [
        'generated_at' => date('Y-m-d H:i'),
        'division'     => kpiDivisionLabel($division),
        'scope_label'  => $scope['label'] ?? kpiDivisionLabel($division),
        'scope'        => kpiScopeDescription($division, $scope),
        'note'         => 'リードタイムは、面談日や契約日が反響取得日より前になっている入力ミス（全体の約0.2%）を除外して算出。',
        'overall'      => kpiOverallContext($pdo, $division, $scope),
        'benchmark'    => kpiBenchmark($pdo, $division, $scope),
        'media'        => kpiFunnelBy($pdo, kpiMediumExpr($division), 'medium', 20, $division, $scope),
    ];
}

/**
 * SELECT を実行して連想配列で返す小さなヘルパー。
 */
function kpiFetch(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * 数値文字列を数値に直す。
 * PDO は COUNT() を文字列で返すため、そのままJSONにすると "1013" のように
 * 引用符付きになり、モデルが数値として扱いにくくなる。
 */
function kpiToInt(array $rows, array $intKeys): array
{
    return array_map(static function (array $row) use ($intKeys): array {
        foreach ($intKeys as $key) {
            if (array_key_exists($key, $row)) {
                $row[$key] = (int)$row[$key];
            }
        }
        return $row;
    }, $rows);
}

/**
 * 「反響推移」分析用のスナップショット。
 *
 * グラフはこの値をそのままフロントで描画するため、
 * モデルに数値を転記させない（転記ミスが起こり得ないようにする）。
 */
function buildInquiryTrendSnapshot(
    PDO $pdo,
    int $months = 12,
    string $division = KPI_DEFAULT_DIVISION,
    array $scope = []
): array {
    $table     = kpiResolveTable($division);
    $monthExpr = "DATE_FORMAT(" . KPI_MD_REGISTERED . ", '%Y-%m')";
    $since     = "DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ? MONTH)";

    // プレースホルダは SQL の出現順にバインドされる。
    // scopeSql は必ず {$since} の後ろに置き、パラメータもその順で並べること。
    [$scopeSql, $scopeParams] = kpiScopeWhere($scope);

    // --- 反響取得月ごとの推移 ------------------------------------------
    //
    // 反響取得月を「コホート」として、その月に獲得した顧客が
    // どれだけ面談・契約に進んだかを追う。
    // 単なる件数の推移より、獲得の「質」の変化が読み取れる。
    $monthly = kpiToInt(kpiFetch($pdo, "
        SELECT {$monthExpr}                                     AS month,
               COUNT(*)                                          AS count,
               SUM(" . KPI_MD_INTERVIEW . " IS NOT NULL)         AS interviewed,
               SUM(" . KPI_MD_CONTRACT  . " IS NOT NULL)         AS contracted,
               SUM(" . KPI_MD_RANK . " IN ('Sランク','Aランク')) AS high_rank
          FROM {$table}
         WHERE show_dashboard = 1
           AND " . KPI_MD_REGISTERED . " >= {$since}
               {$scopeSql}
         GROUP BY 1
         ORDER BY 1
    ", array_merge([$months], $scopeParams)), ['count', 'interviewed', 'contracted', 'high_rank']);

    // 率を先に計算しておく（モデルに割り算をさせない）
    $currentMonth = date('Y-m');
    // 契約までの平均が約2ヶ月のため、直近3ヶ月のコホートはまだ成果が出揃っていない
    $maturingFrom = date('Y-m', strtotime('-3 month'));

    foreach ($monthly as $i => $row) {
        $total = $row['count'];
        $monthly[$i]['interview_rate_pct'] = $total > 0 ? round($row['interviewed'] / $total * 100, 1) : 0;
        $monthly[$i]['contract_rate_pct']  = $total > 0 ? round($row['contracted'] / $total * 100, 1) : 0;
        $monthly[$i]['high_rank_pct']      = $total > 0 ? round($row['high_rank'] / $total * 100, 1) : 0;
        // 当月は取得件数自体がまだ増える
        $monthly[$i]['is_partial']  = ($row['month'] === $currentMonth);
        // 取得件数は確定しているが、面談・契約はこれから増える月
        $monthly[$i]['is_maturing'] = ($row['month'] >= $maturingFrom);
    }

    // --- 媒体別（期間合計）--------------------------------------------
    $mediumExpr = kpiMediumExpr($division);

    $byMedium = kpiToInt(kpiFetch($pdo, "
        SELECT {$mediumExpr}                                            AS medium,
               COUNT(*)                                                AS count,
               SUM(" . KPI_MD_INTERVIEW . " IS NOT NULL)               AS interviewed,
               SUM(" . KPI_MD_CONTRACT  . " IS NOT NULL)               AS contracted
          FROM {$table}
         WHERE show_dashboard = 1
           AND " . KPI_MD_REGISTERED . " >= {$since}
               {$scopeSql}
         GROUP BY 1
         ORDER BY count DESC
         LIMIT 10
    ", array_merge([$months], $scopeParams)), ['count', 'interviewed', 'contracted']);

    $periodTotal = array_sum(array_column($byMedium, 'count'));
    foreach ($byMedium as $i => $row) {
        $byMedium[$i]['share_pct']          = $periodTotal > 0 ? round($row['count'] / $periodTotal * 100, 1) : 0;
        $byMedium[$i]['interview_rate_pct'] = $row['count'] > 0 ? round($row['interviewed'] / $row['count'] * 100, 1) : 0;
        $byMedium[$i]['contract_rate_pct']  = $row['count'] > 0 ? round($row['contracted'] / $row['count'] * 100, 1) : 0;
    }

    // --- 上位5媒体の月次推移（構成比の変化を見るため）-------------------
    $topMedia = array_slice(array_column($byMedium, 'medium'), 0, 5);
    $mediumMonthly = [];
    foreach ($topMedia as $medium) {
        $rows = kpiToInt(kpiFetch($pdo, "
            SELECT {$monthExpr} AS month, COUNT(*) AS count
              FROM {$table}
             WHERE show_dashboard = 1
               AND " . KPI_MD_REGISTERED . " >= {$since}
               {$scopeSql}
               AND {$mediumExpr} = ?
             GROUP BY 1 ORDER BY 1
        ", array_merge([$months], $scopeParams, [$medium])), ['count']);
        $mediumMonthly[] = ['medium' => $medium, 'monthly' => $rows];
    }

    // --- 締まった直近2ヶ月の比較（当月は除く）---------------------------
    $closed  = array_values(array_filter($monthly, static fn(array $r): bool => $r['is_partial'] === false));
    $latest  = $closed[count($closed) - 1] ?? null;
    $prev    = $closed[count($closed) - 2] ?? null;
    $counts  = array_column($closed, 'count');

    return [
        'generated_at'  => date('Y-m-d H:i'),
        'period_months' => $months,
        'division'      => kpiDivisionLabel($division),
        'scope_label'   => $scope['label'] ?? kpiDivisionLabel($division),
        'source'        => kpiScopeDescription($division, $scope) . ' 顧客個人を特定できる列は集計に使用していない。',
        // monthly と同じ期間で基準を取る（全期間の値と比べさせない）
        'benchmark'     => kpiBenchmark($pdo, $division, $scope, $months),
        'note'          => '当月（' . $currentMonth . '）は取得件数がまだ増えるため is_partial = true。'
            . 'is_maturing = true の月（' . $maturingFrom . ' 以降）は取得件数は確定しているが、'
            . '契約まで平均約2ヶ月かかるため面談・契約の数がまだ出揃っていない。',
        'monthly'        => $monthly,
        'by_medium'      => $byMedium,
        'medium_monthly' => $mediumMonthly,
        'totals' => [
            'period_total'         => $periodTotal,
            'closed_month_avg'     => count($counts) > 0 ? (int)round(array_sum($counts) / count($counts)) : 0,
            'latest_closed_month'  => $latest['month'] ?? null,
            'latest_closed_count'  => $latest['count'] ?? null,
            'prev_closed_count'    => $prev['count'] ?? null,
            'mom_change_pct'       => ($latest !== null && $prev !== null && $prev['count'] > 0)
                ? round(($latest['count'] - $prev['count']) / $prev['count'] * 100, 1)
                : null,
        ],
    ];
}

