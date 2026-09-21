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


// ===========================================================================
// 競合分析（2026-09-21 追加）
//
// ⚠️⚠️ **この節だけ、集計値ではなく「顧客1件ごとの行」を Claude に渡す。**
//   ⚠️ このファイルの冒頭には「生データは渡さない」と書いてあるが、
//     ⚠️ **競合分析は集計値では成立しない**（指示）。
//     ⚠️ 「誰にどの理由で負けたか」は自由記述の失注理由・商談メモの中にしかない。
//
//   ⚠️⚠️ **そのかわり、個人を特定できる値は1つも渡さない。**
//     ⚠️ 氏名・電話・メール・住所・物件名は列ごと外し、
//       ⚠️ **自由記述の中に紛れているものは伏字に置き換える**（kpiMaskPii）。
//     ⚠️ ⚠️ **新しい列を足すときは、必ず KPI_COMPETITOR_PII_COLUMNS を見直すこと。**
// ===========================================================================

/**
 * 1回の分析で渡す行数の上限。
 *
 * ⚠️⚠️ **増やすと課金が比例して増える。**
 *   ⚠️ 1行あたり約100トークン。1,000行で約10万トークンになる。
 *   ⚠️ ⚠️ **Master 権限・1日20回の上限があるとはいえ、実費が出る。**
 */
const KPI_COMPETITOR_MAX_ROWS = 1000;

/** 商談メモ・架電ログから拾う文字数。⚠️ 長くすると課金が増える */
const KPI_COMPETITOR_MEMO_CHARS = 160;

/**
 * これ未満の行数しか集まらなければ、Claude を呼ばずに断る。
 *
 * ⚠️⚠️ **建売分譲事業は競合の記録がほとんど無い**（2026-09-21 実測で2件）。
 *   ⚠️ このまま投げると ⚠️ **金だけかかって「データがありません」と言われる。**
 */
const KPI_COMPETITOR_MIN_ROWS = 20;

/**
 * 伏字にする列。
 *
 * ⚠️⚠️ **ここに挙げた列は SELECT はするが、渡す行には入れない。**
 *   ⚠️ 自由記述に紛れた同じ値を消すために値そのものは必要なため、取得はする。
 */
const KPI_COMPETITOR_PII_COLUMNS = [
    'customer_contacts_name',
    'customer_contacts_name_kana',
    'customer_contacts_name_2',
    'customer_contacts_mobile_phone_number',
    'customer_contacts_phone_number',
    'customer_contacts_email',
    'full_address',
    'planned_construction_site',
];

/**
 * 部門ごとの競合関連の列。
 *
 * ⚠️⚠️ **建売分譲事業（master_data_kaeru）には勝因・価格差・対策の列が無い。**
 *   ⚠️ 注文事業（master_data）にしか存在しない。
 *   ⚠️ ⚠️ **両方に投げると「Unknown column」で落ちる。**
 */
const KPI_COMPETITOR_EXTRA_COLUMNS = [
    'order' => [
        'competitor_win_reason'     => 'win_reason',
        'competitor_price_gap'      => 'price_gap',
        'competitor_sales_person'   => 'rival_sales_person',
        'competitor_countermeasure' => 'countermeasure',
        'competitor_campaign'       => 'rival_campaign',
    ],
    'kaeru' => [],
];

/**
 * 勝ち負けを決めるステータス。
 *
 * ⚠️⚠️ **ここに無いステータスの行は渡さない。**
 *   ⚠️ 「見込み」「会社管理」はまだ決着していない（注文の約8割がこれ）。
 *     ⚠️ ⚠️ **負けに数えると、負けが実際の5倍以上に膨らむ。**
 *   ⚠️ 「重複」は同一顧客の二重登録なので数えない。
 *
 * ⚠️⚠️ **建売分譲事業には「失注」というステータスが無い**（2026-09-21 実測）。
 *   ⚠️ いちばん近いのが「追客終了」なので、これを負けとして扱う。
 *   ⚠️ ⚠️ **追客終了は他社に負けたとは限らない**（予算・時期の都合も含む）。
 *     ⚠️ このことは Claude にも note で伝えている。
 */
const KPI_COMPETITOR_STATUSES = [
    'order' => [
        'win'  => ['契約済み', '解約', '解約済み'],
        'lost' => ['失注'],
    ],
    'kaeru' => [
        'win'  => ['契約済み', '解約', '解約済み'],
        'lost' => ['追客終了'],
    ],
];

/**
 * 自社グループの社名。
 *
 * ⚠️⚠️ **house_maker には自社の社名も登録されている。**
 *   ⚠️ 除外しないと ⚠️ **「国分ハウジング」が最大の競合として集計される**
 *     （2026-09-21 実測: 注文71件・建売163件で1位だった）。
 *   ⚠️ ⚠️ **商談メモには自社名がいくらでも出てくるため、必ず外れる。**
 *
 * ⚠️ 消すのではなく `own_group` として別の欄に出す。
 *   ⚠️ **グループ内での取り合いは、それ自体が見たい情報**だからである。
 * ⚠️ ⚠️ **「ジャストホーム」は自社ではない**（シアーズホーム系の他社）。入れないこと。
 */
const KPI_OWN_GROUP_NAMES = [
    '国分ハウジング',
    'デイジャストハウス',
    'なごみ工務店',
    'PGハウス',
    'かえるホーム',
];

/**
 * 個人情報を伏字にする。
 *
 * ⚠️⚠️ **自由記述（商談メモ・架電ログ・失注理由）に対して必ず通すこと。**
 *   ⚠️ 顧客名や電話番号が本文に書かれていることが実際にある。
 *
 * ⚠️ 消すもの:
 *   ⚠️ その顧客自身の氏名・カナ・電話・メール・住所・物件名（$secrets）
 *   ⚠️ メールアドレスの形をしたもの
 *   ⚠️ 数字が9桁以上つながっているもの（電話番号・口座番号）
 *
 * @param string[] $secrets その行の個人情報の値
 */
function kpiMaskPii(string $text, array $secrets): string
{
    if ($text === '') {
        return '';
    }

    foreach ($secrets as $secret) {
        $secret = trim((string)$secret);
        // ⚠️ 1〜2文字を消すと日本語の本文が虫食いになる。氏名は2文字以上ある
        if (mb_strlen($secret) < 3) {
            continue;
        }

        // まず書かれたとおりの形で消す
        $text = str_replace($secret, KPI_MASK, $text);

        /**
         * ⚠️⚠️ **文字の間に空白が入っていても消すこと。**
         *   ⚠️ 台帳が「甲斐 彩香」でも、メモには「甲斐彩香」「甲斐　彩香」と
         *     書かれていることがある。
         *   ⚠️ ⚠️ **str_replace だけでは素通りする**（2026-09-21 に実データで1件漏れた）。
         *
         * ⚠️ ⚠️ **空白を除いて3文字未満のものには、この処理をかけない。**
         *   ⚠️ 「吉 田」のような名前で `吉田` を全部伏字にすると、
         *     ⚠️ **本文中の地名・他社名まで虫食いになる。**
         */
        $flat = (string)preg_replace('/[\s　]+/u', '', $secret);
        if (mb_strlen($flat) < 3) {
            continue;
        }

        $chars = preg_split('//u', $flat, -1, PREG_SPLIT_NO_EMPTY);
        if ($chars === false || $chars === []) {
            continue;
        }
        $pattern = '/' . implode(
            '[\s　]*',
            array_map(static fn(string $c): string => preg_quote($c, '/'), $chars)
        ) . '/u';
        $text = (string)preg_replace($pattern, KPI_MASK, $text);
    }

    $text = (string)preg_replace('/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u', KPI_MASK, $text);
    // ⚠️ ハイフン・空白をまたいだ数字の並びも電話番号として扱う
    $text = (string)preg_replace('/[0-9０-９][0-9０-９\-－ 　]{7,}[0-9０-９]/u', KPI_MASK, $text);

    return $text;
}

/** 伏字の記号。⚠️ 画面にもこの形で出る */
const KPI_MASK = '****';

/**
 * 自由記述を分析に載る長さへ詰める。
 *
 * ⚠️ 改行と連続する空白を1つにまとめてから切る。
 *   ⚠️ **切らないと、1件の商談メモだけで数千文字になることがある。**
 */
function kpiTrimMemo(string $text, int $limit = KPI_COMPETITOR_MEMO_CHARS): string
{
    $text = trim((string)preg_replace('/\s+/u', ' ', $text));
    // ⚠️ remarks には 'null' や '0' が入っている行がある。⚠️ **本文ではない**
    if ($text === '' || $text === 'null' || $text === '0') {
        return '';
    }
    return mb_strlen($text) > $limit ? mb_substr($text, 0, $limit) . '…' : $text;
}

/**
 * 他社名の前後を切り出す。
 *
 * ⚠️⚠️ **メモの先頭は反響フォームの定型文である。**
 *   ⚠️ 「反響経路:… 検討時期:… 希望の広さ:…」が数百文字続き、
 *     ⚠️ ⚠️ **頭から切ると、肝心の商談の中身が1文字も入らない。**
 *   ⚠️ そこで ⚠️ **他社名が出てくる場所の前後**を取る。
 *
 * ⚠️ 他社名が見つからなければ、従来どおり先頭から切る。
 *
 * @param string[] $makers 見つかった他社名
 */
function kpiMemoAround(string $text, array $makers, int $limit = KPI_COMPETITOR_MEMO_CHARS): string
{
    $text = trim((string)preg_replace('/\s+/u', ' ', $text));
    if ($text === '' || $text === 'null' || $text === '0') {
        return '';
    }
    if ($makers === [] || mb_strlen($text) <= $limit) {
        return kpiTrimMemo($text, $limit);
    }

    $at = false;
    foreach ($makers as $maker) {
        $found = mb_strpos($text, $maker);
        if ($found !== false && ($at === false || $found < $at)) {
            $at = $found;
        }
    }
    if ($at === false) {
        return kpiTrimMemo($text, $limit);
    }

    // ⚠️ 社名の少し手前から取る。⚠️ **理由は社名の前に書かれていることが多い**
    $start = max(0, $at - (int)floor($limit / 3));
    $cut   = mb_substr($text, $start, $limit);

    return ($start > 0 ? '…' : '') . $cut . (mb_strlen($text) > $start + $limit ? '…' : '');
}

/**
 * 他社名の一覧（house_maker.label）。
 *
 * ⚠️⚠️ **商談メモから社名を拾うために使う。**
 *   ⚠️ 競合欄が空でも、⚠️ **メモには社名が書かれていることが多い。**
 *   ⚠️ 参考資料（前期の競合分析）でも、競合ありの契約223件のうち
 *     ⚠️ **153件はメモからしか分からなかった。**
 *
 * ⚠️ 2文字以下の社名は本文の別の語に当たるため使わない。
 *
 * @return string[]
 */
function kpiCompetitorMakers(PDO $pdo): array
{
    $labels = $pdo->query('SELECT label FROM house_maker')->fetchAll(PDO::FETCH_COLUMN);

    $makers = [];
    foreach ($labels as $label) {
        $label = trim((string)$label);
        if (mb_strlen($label) >= 3) {
            $makers[] = $label;
        }
    }

    return array_values(array_unique($makers));
}

/**
 * 文字列から他社名を拾う。
 *
 * @param string[] $makers kpiCompetitorMakers() の戻り値
 * @return string[]
 */
function kpiFindMakers(string $text, array $makers): array
{
    if ($text === '') {
        return [];
    }

    $found = [];
    foreach ($makers as $maker) {
        if (mb_strpos($text, $maker) !== false) {
            $found[] = $maker;
        }
    }

    return $found;
}

/** 競合欄（カンマ・読点区切り）を配列にする */
function kpiSplitCompetitors(string $text): array
{
    $text  = str_replace('、', ',', $text);
    $parts = array_map('trim', explode(',', $text));

    return array_values(array_filter($parts, static fn(string $v): bool => $v !== '' && $v !== 'null'));
}

/** 失注日（テキスト）から 'YYYY-MM' を取り出す。取れなければ null */
function kpiCompetitorLostMonth(string $value): ?string
{
    $value = str_replace('/', '-', trim($value));
    return preg_match('/^(\d{4}-\d{2})/', $value, $m) === 1 ? $m[1] : null;
}

/**
 * 土地の有無。
 * ⚠️ 入力が「有」「無」「1」「0」と揺れているため、文字で判定する。
 */
function kpiCompetitorHasLand(string $value): string
{
    $value = trim($value);
    if ($value === '' || $value === 'null') {
        return '未入力';
    }
    if (mb_strpos($value, '無') !== false || $value === '0') {
        return 'なし';
    }
    return 'あり';
}

/**
 * 予算を帯にまとめる。
 *
 * ⚠️⚠️ **金額そのものは渡さない。**
 *   ⚠️ 帯にすれば傾向は読めるうえ、⚠️ **個人の特定に近づかない。**
 * ⚠️ 入力は「4000万」「40,000,000」などと揺れるため、数字だけを取り出して判定する。
 */
function kpiCompetitorBudgetBand(string $value): string
{
    $digits = preg_replace('/[^0-9]/', '', $value);
    if ($digits === '' || $digits === null) {
        return '未入力';
    }

    $number = (int)$digits;
    // ⚠️ 「4000」のような万円単位の入力を円に直す
    if ($number < 100000) {
        $number *= 10000;
    }

    if ($number < 25000000) {
        return '2500万未満';
    }
    if ($number < 30000000) {
        return '2500〜3000万';
    }
    if ($number < 35000000) {
        return '3000〜3500万';
    }
    if ($number < 40000000) {
        return '3500〜4000万';
    }
    if ($number < 45000000) {
        return '4000〜4500万';
    }
    if ($number < 50000000) {
        return '4500〜5000万';
    }
    return '5000万以上';
}

/**
 * 台帳にある氏名を、渡す文章から一括で消す。
 *
 * ⚠️⚠️ **kpiMaskPii() は「その行自身の」氏名しか消せない。**
 *   ⚠️ 商談メモには ⚠️ **別の顧客の名前**（紹介者・同行者・過去の担当案件）が
 *     書かれていることが実際にある。
 *   ⚠️ ⚠️ **2026-09-21 の実データで1件漏れた。** ⚠️ 行ごとの処理では防げない。
 *
 * ⚠️ 手順（総当たりを避けるため2段階にしている）:
 *   ⚠️ 1. 渡す文章を全部つないで、空白を除いた1本の文字列にする
 *   ⚠️ 2. 台帳の氏名をその文字列で探し、⚠️ **実際に出てくるものだけ**を置換する
 *   ⚠️ 台帳は3万件あるが、1 の文字列は数十KBなので探すのは速い。
 *
 * ⚠️ ⚠️ **自社の営業担当の名前も、顧客として登録があれば一緒に消える。**
 *   ⚠️ 競合分析に担当者名は要らないため、消えて困らない。
 *
 * @param string[] $textKeys 伏字をかける項目名
 */
function kpiMaskKnownNames(PDO $pdo, array $rows, array $textKeys): array
{
    $blob = '';
    foreach ($rows as $r) {
        foreach ($textKeys as $key) {
            $blob .= ' ' . (string)($r[$key] ?? '');
        }
    }

    $flatBlob = (string)preg_replace('/[\s　]+/u', '', $blob);
    if ($flatBlob === '') {
        return $rows;
    }

    // ⚠️ 3事業ぶん見る。⚠️ **注文のメモに建売の顧客名が出ることがある**
    $names = $pdo->query(
        'SELECT customer_contacts_name FROM master_data'
        . ' UNION SELECT customer_contacts_name FROM master_data_kaeru'
        . ' UNION SELECT customer_contacts_name FROM master_data_resale'
    )->fetchAll(PDO::FETCH_COLUMN);

    $hits = [];
    foreach ($names as $name) {
        $flat = (string)preg_replace('/[\s　]+/u', '', trim((string)$name));
        // ⚠️ 2文字以下は本文の普通の語と当たる。消すと虫食いになる
        if (mb_strlen($flat) < 3) {
            continue;
        }
        if (mb_strpos($flatBlob, $flat) !== false) {
            $hits[] = $flat;
        }
    }

    if ($hits === []) {
        return $rows;
    }

    $hits = array_values(array_unique($hits));
    foreach ($rows as $i => $r) {
        foreach ($textKeys as $key) {
            $value = (string)($r[$key] ?? '');
            if ($value !== '') {
                $rows[$i][$key] = kpiMaskPii($value, $hits);
            }
        }
    }

    return $rows;
}

/**
 * 「競合分析」用のスナップショット。
 *
 * ⚠️⚠️ **集計値ではなく、契約と失注の行そのものを渡す**（2026-09-21 の指示）。
 *   ⚠️ 勝敗表・敗因の構成は Claude 側で作らせる。
 *
 * ⚠️ 渡す行の条件:
 *   ⚠️ 競合欄・他決先・失注理由のどれかが入っている、または
 *   ⚠️ **商談メモ・架電ログに他社名が見つかった**行。
 *   ⚠️ ⚠️ **どちらも無い行は渡さない**（競合戦ではないため）。
 *
 * @param int $months 何ヶ月分さかのぼるか
 */
function buildCompetitorSnapshot(
    PDO $pdo,
    string $division = KPI_DEFAULT_DIVISION,
    array $scope = [],
    int $months = 12
): array {
    $table  = kpiResolveTable($division);
    $extra  = KPI_COMPETITOR_EXTRA_COLUMNS[$division] ?? [];
    $makers = kpiCompetitorMakers($pdo);

    [$scopeSql, $scopeParams] = kpiScopeWhere($scope);

    // ⚠️ 契約日・反響日・失注日のどれかが期間内にあるものを拾う。
    //   ⚠️ **契約日だけで絞ると、失注（契約日が無い）が1件も入らない。**
    $from = date('Y-m-d', strtotime('-' . $months . ' months'));

    $select = [
        'status',
        'in_charge_store',
        'brand',
        'sales_promotion_name',
        'has_owned_land',
        'budget',
        KPI_MD_RANK . ' AS rank_value',
        'competitors_text',
        'competitor_name',
        'competitor',
        'competitor_lost_contract_reason',
        'competitor_lost_contract_date',
        'remarks',
        'call_log',
        'DATE_FORMAT(' . KPI_MD_CONTRACT . ", '%Y-%m') AS contract_month",
        'DATE_FORMAT(' . KPI_MD_REGISTERED . ", '%Y-%m') AS registered_month",
    ];
    foreach (array_keys($extra) as $column) {
        $select[] = $column;
    }
    foreach (KPI_COMPETITOR_PII_COLUMNS as $column) {
        $select[] = $column;
    }

    /**
     * ⚠️⚠️ **勝ちと負けを別々に取る。**
     *   ⚠️ 1本のクエリを日付順に切ると、⚠️ **件数の多い負けばかりが残る。**
     *     ⚠️ 実測では 勝ち112 / 負け888 になり、勝敗表として成立しなかった。
     *   ⚠️ ⚠️ **半分ずつの枠を与えること。**
     */
    $statuses = KPI_COMPETITOR_STATUSES[$division] ?? KPI_COMPETITOR_STATUSES['order'];
    $quota    = (int)floor(KPI_COMPETITOR_MAX_ROWS / 2);

    $fetchByStatus = static function (array $wanted, int $limit) use (
        $pdo, $select, $table, $scopeSql, $scopeParams, $from
    ): array {
        $sql = 'SELECT ' . implode(', ', $select) . ' FROM ' . $table
            . ' WHERE show_dashboard = 1'
            . $scopeSql
            . ' AND status IN (' . implode(',', array_fill(0, count($wanted), '?')) . ')'
            . ' AND ('
            . KPI_MD_CONTRACT . ' >= ?'
            . ' OR ' . KPI_MD_REGISTERED . ' >= ?'
            . " OR REPLACE(COALESCE(competitor_lost_contract_date, ''), '/', '-') >= ?"
            . ')'
            // ⚠️ 競合の手がかりがまったく無い行は最初から取らない
            . ' AND ('
            . " COALESCE(competitors_text, '') NOT IN ('', 'null')"
            . " OR COALESCE(competitor_name, '') NOT IN ('', 'null')"
            . " OR COALESCE(competitor, '') NOT IN ('', 'null')"
            . " OR COALESCE(competitor_lost_contract_reason, '') NOT IN ('', 'null')"
            . " OR COALESCE(remarks, '') NOT IN ('', 'null')"
            . ')'
            . ' ORDER BY COALESCE(' . KPI_MD_CONTRACT . ', ' . KPI_MD_REGISTERED . ') DESC'
            // ⚠️ メモから社名を拾えない行が多いため、多めに取って PHP 側で絞る
            . ' LIMIT ' . ($limit * 4);

        $params = array_merge($scopeParams, $wanted, [$from, $from, $from]);

        return kpiFetch($pdo, $sql, $params);
    };

    $wonRaw  = $fetchByStatus($statuses['win'], $quota);
    $lostRaw = $fetchByStatus($statuses['lost'], $quota);

    $rows          = [];
    $fromMemoCount = 0;
    $candidates    = count($wonRaw) + count($lostRaw);
    $kept          = ['win' => 0, 'lost' => 0];

    foreach (array_merge($wonRaw, $lostRaw) as $r) {
        $secrets = [];
        foreach (KPI_COMPETITOR_PII_COLUMNS as $column) {
            $secrets[] = (string)($r[$column] ?? '');
        }

        $memo = kpiMaskPii(
            (string)($r['remarks'] ?? '') . ' ' . (string)($r['call_log'] ?? ''),
            $secrets
        );

        // 競合欄からの社名
        $named = array_merge(
            kpiSplitCompetitors((string)($r['competitors_text'] ?? '')),
            kpiSplitCompetitors((string)($r['competitor_name'] ?? '')),
            kpiSplitCompetitors((string)($r['competitor'] ?? ''))
        );
        // ⚠️ メモからの社名。⚠️ **競合欄が空の行を救うのはここだけ**
        $inMemo = kpiFindMakers($memo, $makers);
        if ($named === [] && $inMemo !== []) {
            $fromMemoCount++;
        }

        $all = array_values(array_unique(array_merge($named, $inMemo)));

        /**
         * ⚠️⚠️ **自社グループの社名を競合から外す。**
         *   ⚠️ 外さないと「国分ハウジング」が最大の競合として並ぶ。
         *   ⚠️ **捨てずに own_group として別に持つ**（社内での取り合いも見たいため）。
         */
        $ownGroup    = array_values(array_intersect($all, KPI_OWN_GROUP_NAMES));
        $competitors = array_values(array_diff($all, KPI_OWN_GROUP_NAMES));

        $lostReason = trim((string)($r['competitor_lost_contract_reason'] ?? ''));
        if ($lostReason === 'null') {
            $lostReason = '';
        }

        // ⚠️ 他社名も失注理由も無い行は競合戦の証拠が無い。渡さない
        //   ⚠️ **自社名しか出てこない行もここで落ちる**（競合戦ではない）
        if ($competitors === [] && $lostReason === '') {
            continue;
        }

        $status = (string)($r['status'] ?? '');
        $won    = in_array($status, $statuses['win'], true);

        // ⚠️ 片方だけで枠を使い切らないようにする
        $bucket = $won ? 'win' : 'lost';
        if ($kept[$bucket] >= $quota) {
            continue;
        }
        $kept[$bucket]++;

        $row = [
            'outcome' => $won ? 'win' : 'lost',
            'status'  => $status,
            'month'   => $won
                ? ($r['contract_month'] ?? $r['registered_month'])
                : (kpiCompetitorLostMonth((string)($r['competitor_lost_contract_date'] ?? ''))
                    ?? $r['registered_month']),
            'shop'        => (string)($r['in_charge_store'] ?? ''),
            'brand'       => (string)($r['brand'] ?? ''),
            'medium'      => (string)($r['sales_promotion_name'] ?? ''),
            'has_land'    => kpiCompetitorHasLand((string)($r['has_owned_land'] ?? '')),
            'budget'      => kpiCompetitorBudgetBand((string)($r['budget'] ?? '')),
            'rank'        => trim((string)($r['rank_value'] ?? '')),
            'competitors' => $competitors,
            'own_group'   => $ownGroup,
            'lost_reason' => $lostReason,
            // ⚠️ 他社名の前後を取る。⚠️ **頭から切るとフォームの定型文で埋まる**
            'memo'        => kpiMemoAround($memo, $all),
        ];

        foreach ($extra as $column => $key) {
            $value = trim((string)($r[$column] ?? ''));
            $row[$key] = ($value === 'null' || $value === '') ? '' : kpiMaskPii($value, $secrets);
        }

        $rows[] = $row;
        if (count($rows) >= KPI_COMPETITOR_MAX_ROWS) {
            break;
        }
    }

    /**
     * ⚠️⚠️ **最後にもう一度、台帳の氏名を消す。**
     *   ⚠️ 上の kpiMaskPii() は行ごとの氏名しか見ていない。
     *   ⚠️ ⚠️ **ここを外すと、他の顧客の氏名がメモに残ったまま送られる。**
     */
    $rows = kpiMaskKnownNames($pdo, $rows, array_merge(
        ['memo', 'lost_reason'],
        array_values($extra)
    ));

    $wins = $kept['win'];

    return [
        'generated_at'  => date('Y-m-d H:i'),
        'division'      => kpiDivisionLabel($division),
        'scope_label'   => $scope['label'] ?? kpiDivisionLabel($division),
        'scope'         => kpiScopeDescription($division, $scope),
        'period_months' => $months,
        'note'          => '1行が顧客1件。個人情報（氏名・電話・メール・住所・物件名）は列ごと外し、'
            . '商談メモに紛れているものは ' . KPI_MASK . ' に置き換えてある。'
            . 'competitors は競合欄と商談メモの両方から拾った他社名。'
            . 'own_group は国分ハウジンググループ自身の社名で、競合ではなくグループ内での取り合いを表す。'
            . 'outcome = win は ' . implode('・', $statuses['win']) . '、'
            . 'lost は ' . implode('・', $statuses['lost']) . '。決着していない案件と重複は含めていない。'
            . ($division === 'kaeru'
                ? '建売分譲事業には「失注」というステータスが無いため「追客終了」を負けとして扱っている。'
                . 'これは他社に負けたとは限らず、予算・時期の都合も含む。'
                : '')
            . 'wins と losses の上限はそれぞれ ' . (int)floor(KPI_COMPETITOR_MAX_ROWS / 2) . ' 件で、'
            . 'この数に達している側は全件ではない。勝率をこの2つの数から計算してはならない。'
            . 'lost_reason が空の行が多いのは入力されていないためで、理由が無いという意味ではない。'
            . 'memo は他社名の前後を切り出したもので、先頭に … があるのは途中からという意味。',
        'counts' => [
            'rows'            => count($rows),
            'wins'            => $wins,
            'losses'          => count($rows) - $wins,
            'quota_per_side'  => $quota,
            'candidates'      => $candidates,
            'found_from_memo' => $fromMemoCount,
            'max_rows'        => KPI_COMPETITOR_MAX_ROWS,
            // ⚠️ どちらかが枠いっぱいなら「全件ではない」。勝率の計算に使わせない
            'truncated'       => $wins >= $quota || (count($rows) - $wins) >= $quota,
        ],
        'rows' => $rows,
    ];
}
