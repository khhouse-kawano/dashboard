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
 *   このうち個人を特定しうる列（full_address, in_charge_user）は
 *   集計値としても外部に出さない。in_charge_user は件数（COUNT DISTINCT）のみ使う。
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
 */
const KPI_DIVISIONS = [
    'order' => ['table' => 'master_data',       'label' => '注文営業'],
    'kaeru' => ['table' => 'master_data_kaeru', 'label' => '建売営業'],
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
 */
function kpiFunnelBy(PDO $pdo, string $groupExpr, string $alias, int $limit = 20, string $division = KPI_DEFAULT_DIVISION): array
{
    $table       = kpiResolveTable($division);
    $toInterview = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_INTERVIEW);
    $toContract  = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_CONTRACT);

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
         GROUP BY 1
         ORDER BY total DESC
         LIMIT {$limit}
    ");

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
function kpiOverallContext(PDO $pdo, string $division = KPI_DEFAULT_DIVISION): array
{
    $table       = kpiResolveTable($division);
    $toInterview = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_INTERVIEW);
    $toContract  = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_CONTRACT);

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
    ")[0] ?? [];

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

/** 「店舗別サマリー」分析用のスナップショット（エリア別を含む） */
function buildShopSummarySnapshot(PDO $pdo, string $division = KPI_DEFAULT_DIVISION): array
{
    return [
        'generated_at' => date('Y-m-d H:i'),
        'division'     => kpiDivisionLabel($division),
        'scope'        => kpiDivisionLabel($division) . '部門（' . kpiResolveTable($division) . '）の show_dashboard = 1（ダッシュボード表示対象）のみ。重複・非表示レコードは除外。',
        'note'         => 'リードタイムは、面談日や契約日が反響取得日より前になっている入力ミス（全体の約0.2%）を除外して算出。'
            . 'エリアは顧客の住所から都道府県・市区町村まで丸めたもの（判定不可: 都道府県4.2% / 市区町村2.2%）。'
            . '店舗の所在地ではなく顧客の居住地である点に注意。',
        'overall'      => kpiOverallContext($pdo, $division),
        'shops'        => kpiFunnelBy($pdo, 'in_charge_store', 'shop', 20, $division),
        'areas'        => kpiFunnelBy($pdo, KPI_MD_PREF, 'area', 10, $division),
        'cities'       => kpiFunnelBy($pdo, KPI_MD_CITY, 'city', 15, $division),
    ];
}

/** 「販促媒体別サマリー」分析用のスナップショット */
function buildMediumSummarySnapshot(PDO $pdo, string $division = KPI_DEFAULT_DIVISION): array
{
    return [
        'generated_at' => date('Y-m-d H:i'),
        'division'     => kpiDivisionLabel($division),
        'scope'        => kpiDivisionLabel($division) . '部門（' . kpiResolveTable($division) . '）の show_dashboard = 1（ダッシュボード表示対象）のみ。重複・非表示レコードは除外。',
        'note'         => 'リードタイムは、面談日や契約日が反響取得日より前になっている入力ミス（全体の約0.2%）を除外して算出。',
        'overall'      => kpiOverallContext($pdo, $division),
        'media'        => kpiFunnelBy($pdo, 'sales_promotion_name', 'medium', 20, $division),
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
function buildInquiryTrendSnapshot(PDO $pdo, int $months = 12, string $division = KPI_DEFAULT_DIVISION): array
{
    $table     = kpiResolveTable($division);
    $monthExpr = "DATE_FORMAT(" . KPI_MD_REGISTERED . ", '%Y-%m')";
    $since     = "DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ? MONTH)";

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
         GROUP BY 1
         ORDER BY 1
    ", [$months]), ['count', 'interviewed', 'contracted', 'high_rank']);

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
    $byMedium = kpiToInt(kpiFetch($pdo, "
        SELECT COALESCE(NULLIF(sales_promotion_name, ''), '(未設定)') AS medium,
               COUNT(*)                                                AS count,
               SUM(" . KPI_MD_INTERVIEW . " IS NOT NULL)               AS interviewed,
               SUM(" . KPI_MD_CONTRACT  . " IS NOT NULL)               AS contracted
          FROM {$table}
         WHERE show_dashboard = 1
           AND " . KPI_MD_REGISTERED . " >= {$since}
         GROUP BY 1
         ORDER BY count DESC
         LIMIT 10
    ", [$months]), ['count', 'interviewed', 'contracted']);

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
               AND COALESCE(NULLIF(sales_promotion_name, ''), '(未設定)') = ?
             GROUP BY 1 ORDER BY 1
        ", [$months, $medium]), ['count']);
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
        'source'        => kpiDivisionLabel($division) . '部門（' . $table . '）の show_dashboard = 1 のみ。個人を特定できる列は集計に使用していない。',
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

