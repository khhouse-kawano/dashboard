<?php

/**
 * Claude Desktop（MCP経由）向けの分析用集計。
 *
 * ─────────────────────────────────────────────
 * core/kpi.php との関係
 *   日付列の正規化・リードタイムの算出・店舗の解決といった土台は
 *   すべて core/kpi.php のものを再利用する。同じロジックを2重に持つと、
 *   将来どちらか片方だけ直されて既存のKPI画面と数字がずれるため。
 *
 *   このファイルが追加で担うのは、kpi.php が意図的に扱っていない部分だけ。
 *     ・軸と指標を呼び出し側が選べる汎用集計（kpi.php は用途別の固定スナップショット）
 *     ・call_sheet / interview_sheet のログ件数（追客量の指標）
 *     ・inquiry_customer.sync による未同期リード（追客漏れの指標）
 *
 *   kpi.php と kpi_* ハンドラには一切手を入れていない。
 * ─────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────
 * 個人情報の扱い
 *   このファイルが返すのは集計値のみ。氏名・住所・電話番号・メールアドレス・
 *   生年月日・年収・勤務先は SELECT の段階で取得しない。
 *
 *   call_sheet.call_log / interview_sheet.interview_log は JSON 配列で、
 *   その note に顧客との会話内容（個人情報）が入っている。
 *   件数だけを数え、本文は絶対に取り出さないこと。
 * ─────────────────────────────────────────────
 *
 * 呼び出し側（Claude）は返ってきたJSONだけを根拠に日本語で推論する。
 * そのため meta（数字の意味とデータの癖の日本語説明）は省略可能な飾りではなく
 * 仕様の一部であり、必ず一緒に返す。
 */

require_once __DIR__ . '/kpi.php';

/**
 * このAPIが扱う部門。注文事業のみ。
 * KPI_DIVISIONS のキーと同じ値を使い、店舗の解決を kpi.php に任せる。
 */
const ANALYSIS_DIVISION = 'order';

/**
 * 1レスポンスで返す最大行数。
 *
 * Claude Desktop のコンテキストに載る大きさから逆算した上限。
 * 実測では 月(44) × 店舗(30) で約1,300行・280KB程度になる。
 * 顧客単位の生データ（22,881行）は約25MB・1,500万トークン相当で到底載らないため、
 * このAPIは必ず集計値で返す。
 */
const ANALYSIS_MAX_ROWS = 2000;

/**
 * rows 部分の最大バイト数。
 *
 * 行数だけでは大きさを抑えきれない。指標を増やすと1行が長くなるため、
 * 上限2000行でも実測で600KB（約36万トークン）に達しうる。
 * 実測の目安: 月 × 営業課 183行 = 63KB / 月 × 店舗 590行 = 184KB。
 * 日本語混じりのJSONは 1バイト ≒ 0.6トークン程度なので、
 * 250KB（約15万トークン）を上限とし、超えたら軸を絞るよう促す。
 */
const ANALYSIS_MAX_BYTES = 250 * 1024;

/**
 * 明らかな入力ミスを除外する下限日。
 * 反響取得日に 0004年・0024年といった値が実在し、月次軸を壊すため足切りする。
 */
const ANALYSIS_MIN_DATE = '2015-01-01';

/** 軸の値が空だった行に入れる表示値。0件との混同を防ぐため明示する */
const ANALYSIS_UNSET = '(未設定)';

/** 不正なパラメータを受け取ったときに投げる。ハンドラ側で 400 に変換する */
class AnalysisRequestException extends RuntimeException
{
}

// ---------------------------------------------------------------------------
// フェーズ（営業プロセスの各段階）
// ---------------------------------------------------------------------------

/**
 * フェーズ日付の一覧。並び順は営業プロセスの進行順。
 *
 * 物理列名は step_migration_item_<ULID> で名前から意味が読み取れず、
 * 意味はDBのカラムコメントにしか書かれていない。ここに写して一元管理する。
 * ※ カラムコメントを変えたらこの表も必ず追従させること。
 *
 * reaction / firstInterview / contract は kpi.php が定義済みの定数をそのまま使う
 * （既存KPIと同じ列を見ていることを保証するため）。
 *
 * ⚠️ 第二面談だけは kpi.php と見ている列が違う。
 *   kpi.php の KPI_MD_NEXT_IV は step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 を
 *   「次回面談」として使っているが、運用上の第二面談は
 *   step_migration_item_01JSENACS2FC422ZHEZWNSXNYA である（運用側の指定）。
 *   DBのカラムコメントは前者が「第二面談」、後者が「※次回アポ」となっており、
 *   コメントと実際の運用が食い違っている。実運用に合わせて後者を使う。
 *   そのため第二面談の件数は既存のKPI画面（next_interview_date）とは一致しない。
 */
function analysisPhases(): array
{
    static $phases = null;

    if ($phases === null) {
        $phases = [
            'reaction'        => ['sql' => KPI_MD_REGISTERED, 'label' => '反響取得日'],
            'zeroReception'   => ['sql' => kpiDateExpr('step_migration_item_01J82Z5F1WE8SKEES6VNN37B22'), 'label' => '0次接客'],
            'energized'       => ['sql' => kpiDateExpr('step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z'), 'label' => '通電'],
            'firstInterview'  => ['sql' => KPI_MD_INTERVIEW, 'label' => '初回面談'],
            'secondInterview' => ['sql' => kpiDateExpr('step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'), 'label' => '第二面談'],
            'preScreening'    => ['sql' => kpiDateExpr('step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'), 'label' => '事前審査'],
            'contract'        => ['sql' => KPI_MD_CONTRACT,  'label' => '契約日'],
        ];
    }

    return $phases;
}

function analysisPhaseSql(string $phase): string
{
    return analysisPhases()[$phase]['sql'];
}

// ---------------------------------------------------------------------------
// 集計軸
// ---------------------------------------------------------------------------

/**
 * 集計軸の許可リスト。
 *
 * ⚠️ 軸はSQLに直接埋め込まれる。リクエストの値をSQLに連結してはならず、
 *   必ずこの表のキーに一致したものだけを使うこと。
 *   氏名・住所・電話番号など個人を特定できる列は軸として追加しないこと。
 *
 * needs_inquiry / needs_basis は、その軸を使うときに必要な結合や
 * 基準日の式があることを示す。
 *
 * ⚠️ master_data は m、shop_list は s の別名で結合している。
 *   brand は master_data と shop_list の両方に存在するため必ず修飾すること。
 */
function analysisDimensions(): array
{
    static $dimensions = null;

    if ($dimensions === null) {
        $dimensions = [
            'month' => [
                'label'      => '月（集計基準日の年月。YYYY-MM）',
                'sql'        => null, // 基準日に依存するため analysisDimensionSql() で組む
                'basis_expr' => "DATE_FORMAT(%s, '%%Y-%%m')",
            ],
            'quarter' => [
                'label'      => '四半期（暦年ベース。YYYY-Qn）',
                'sql'        => null,
                'basis_expr' => "CONCAT(YEAR(%s), '-Q', QUARTER(%s))",
            ],
            'year' => [
                'label'      => '年（YYYY）',
                'sql'        => null,
                'basis_expr' => "DATE_FORMAT(%s, '%%Y')",
            ],
            'store'   => ['label' => '店舗（master_data.in_charge_store）', 'sql' => 'm.in_charge_store'],
            'brand'   => ['label' => 'ブランド（shop_list.brand。master_data.brand は表記が不統一なため使わない）', 'sql' => 's.brand'],
            'section' => ['label' => '営業課（shop_list.section）', 'sql' => 's.section'],
            'area'    => ['label' => 'エリア（shop_list.area。店舗の所在地）', 'sql' => 's.area'],
            'medium'  => ['label' => '販促媒体（master_data.sales_promotion_name）', 'sql' => 'm.sales_promotion_name'],
            'rank'    => ['label' => '顧客ランク（Sランク〜Eランク）', 'sql' => 'm.' . KPI_MD_RANK],
            'status'  => ['label' => 'ステータス（見込み/契約済み/失注/重複/会社管理/解約）', 'sql' => 'm.status'],
            'lost_reason' => [
                'label' => '失注理由（競合負け/計画中止/音信不通など）',
                'sql'   => 'm.competitor_lost_contract_reason',
            ],
            'competitor_lost_reason' => [
                'label' => '他決理由（顧客が他社を選んだ理由）',
                'sql'   => 'm.customized_input_01JRF9CZSW65A151WR30NA4PB3',
            ],
            'response_medium' => [
                'label'         => '反響媒体（inquiry_customer.response_medium。反響台帳に紐づく顧客のみ）',
                'sql'           => 'ic.response_medium',
                'needs_inquiry' => true,
            ],
        ];
    }

    return $dimensions;
}

/**
 * 軸のSQL式を返す。月・四半期・年は集計基準日に依存する。
 *
 * ⚠️ 空欄の寄せ方はSQL側で行うこと。
 *   master_data は同じ意味の欠損が NULL と空文字の2通りで入っている。
 *   GROUP BY はこの2つを別グループとして扱うため、PHP側で表示名だけ
 *   「(未設定)」に揃えると、同じ「(未設定)」の行が2行返ってしまう
 *   （実測: response_medium 軸で 7,142件と96件に分裂していた）。
 *   COALESCE + NULLIF をSQLに含めて、集計の段階で1グループに畳む。
 *   kpi.php の kpiFunnelBy() も同じ処理を入れている。
 */
function analysisDimensionSql(string $key, string $basisSql): string
{
    $dimension = analysisDimensions()[$key];

    if (($dimension['basis_expr'] ?? null) !== null) {
        // %s の数だけ基準日の式を埋める（quarter は2回使う）
        $count = substr_count($dimension['basis_expr'], '%s');
        $expr  = vsprintf($dimension['basis_expr'], array_fill(0, $count, $basisSql));
    } else {
        $expr = $dimension['sql'];
    }

    return "COALESCE(NULLIF(TRIM({$expr}), ''), '" . ANALYSIS_UNSET . "')";
}

// ---------------------------------------------------------------------------
// 指標
// ---------------------------------------------------------------------------

/**
 * 指標の許可リスト。軸と同じく、リクエストの値がSQLに混ざることはない。
 *
 * kind
 *   count  … 通常の集計関数。GROUP BY のクエリでまとめて取れる
 *   median … MariaDB 10.11 は PERCENTILE_CONT を集計関数として使えないため、
 *            MEDIAN() OVER (PARTITION BY …) + DISTINCT の別クエリで取る
 *
 * needs_call / needs_interview が付いた指標は、要求されたときだけ
 * 重い結合（ログのJSON走査）を足す。
 */
function analysisMetrics(): array
{
    static $metrics = null;

    if ($metrics === null) {
        $reached = static fn(string $phase): string
            => 'SUM(' . analysisPhaseSql($phase) . ' IS NOT NULL)';

        // kpi.php と同じ式を使う。面談日が反響日より前になっている入力ミスは NULL 化され、
        // 平均・中央値の母数から自然に外れる
        $toFirstInterview = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_INTERVIEW);
        $toContract       = kpiDaysBetween(KPI_MD_REGISTERED, KPI_MD_CONTRACT);
        $interviewToContract = kpiDaysBetween(KPI_MD_INTERVIEW, KPI_MD_CONTRACT);

        $metrics = [
            // --- ファネル件数 ---------------------------------------------
            'leads'            => ['kind' => 'count', 'label' => '反響数（集計対象の顧客数）', 'sql' => 'COUNT(*)'],
            'zero_reception'   => ['kind' => 'count', 'label' => '0次接客に到達した件数',   'sql' => $reached('zeroReception')],
            'energized'        => ['kind' => 'count', 'label' => '通電に到達した件数',       'sql' => $reached('energized')],
            'first_interview'  => ['kind' => 'count', 'label' => '初回面談に到達した件数',   'sql' => $reached('firstInterview')],
            'second_interview' => ['kind' => 'count', 'label' => '第二面談に到達した件数',   'sql' => $reached('secondInterview')],
            'pre_screening'    => ['kind' => 'count', 'label' => '事前審査に到達した件数',   'sql' => $reached('preScreening')],
            'contracts'        => ['kind' => 'count', 'label' => '契約に到達した件数',       'sql' => $reached('contract')],

            // --- ステータス内訳 -------------------------------------------
            'lost'        => ['kind' => 'count', 'label' => 'ステータスが「失注」の件数',   'sql' => "SUM(m.status = '失注')"],
            'prospective' => ['kind' => 'count', 'label' => 'ステータスが「見込み」の件数（追客中）', 'sql' => "SUM(m.status = '見込み')"],
            'duplicated'  => ['kind' => 'count', 'label' => 'ステータスが「重複」の件数（同一顧客の二重登録）', 'sql' => "SUM(m.status = '重複')"],
            'high_rank'   => ['kind' => 'count', 'label' => 'ランクがSまたはAの件数', 'sql' => 'SUM(m.' . KPI_MD_RANK . " IN ('Sランク','Aランク'))"],

            // --- 追客量（ログ件数）----------------------------------------
            'call_count_avg' => [
                'kind' => 'count', 'needs_call' => true, 'decimal' => true,
                'label' => '1顧客あたりの平均架電記録件数（call_sheet のログ件数）',
                'sql'   => 'ROUND(AVG(COALESCE(cs.call_count, 0)), 2)',
            ],
            'call_connected_avg' => [
                'kind' => 'count', 'needs_call' => true, 'decimal' => true,
                'label' => '1顧客あたりの平均「通電」記録件数',
                'sql'   => 'ROUND(AVG(COALESCE(cs.call_connected, 0)), 2)',
            ],
            'call_missed_avg' => [
                'kind' => 'count', 'needs_call' => true, 'decimal' => true,
                'label' => '1顧客あたりの平均「未通電」記録件数',
                'sql'   => 'ROUND(AVG(COALESCE(cs.call_missed, 0)), 2)',
            ],
            'no_call_record' => [
                'kind' => 'count', 'needs_call' => true,
                'label' => '架電記録が1件も無い顧客数（追客されていない可能性がある件数）',
                'sql'   => 'SUM(COALESCE(cs.call_count, 0) = 0)',
            ],
            'interview_log_avg' => [
                'kind' => 'count', 'needs_interview' => true, 'decimal' => true,
                'label' => '1顧客あたりの平均面談ログ件数（interview_sheet）',
                'sql'   => 'ROUND(AVG(COALESCE(iv.interview_count, 0)), 2)',
            ],

            // --- リードタイム ---------------------------------------------
            'avg_days_to_first_interview' => [
                'kind' => 'count', 'decimal' => true,
                'label' => '反響取得から初回面談までの日数（平均）。既存のKPI画面と同じ算出方法',
                'sql'   => "ROUND(AVG({$toFirstInterview}), 1)",
            ],
            'avg_days_to_contract' => [
                'kind' => 'count', 'decimal' => true,
                'label' => '反響取得から契約までの日数（平均）。既存のKPI画面と同じ算出方法',
                'sql'   => "ROUND(AVG({$toContract}), 1)",
            ],
            'median_days_to_first_interview' => [
                'kind' => 'median',
                'label' => '反響取得から初回面談までの日数（中央値）。少数の長期案件に引っ張られにくい',
                'value_sql' => $toFirstInterview,
            ],
            'median_days_to_contract' => [
                'kind' => 'median',
                'label' => '反響取得から契約までの日数（中央値）',
                'value_sql' => $toContract,
            ],
            'median_days_first_interview_to_contract' => [
                'kind' => 'median',
                'label' => '初回面談から契約までの日数（中央値）',
                'value_sql' => $interviewToContract,
            ],
        ];
    }

    return $metrics;
}

/**
 * 件数から算出する比率。分母はすべて反響数（leads）。
 * 母数が0のときは 0 ではなく null を返す（「0%」と「母数なし」を区別するため）。
 */
function analysisRates(): array
{
    return [
        'energized_rate_pct'        => ['label' => '通電率（通電 ÷ 反響数）',         'numerator' => 'energized'],
        'first_interview_rate_pct'  => ['label' => '初回面談率（初回面談 ÷ 反響数）', 'numerator' => 'first_interview'],
        'second_interview_rate_pct' => ['label' => '第二面談率（第二面談 ÷ 反響数）', 'numerator' => 'second_interview'],
        'pre_screening_rate_pct'    => ['label' => '事前審査率（事前審査 ÷ 反響数）', 'numerator' => 'pre_screening'],
        'contract_rate_pct'         => ['label' => '契約率（契約 ÷ 反響数）',         'numerator' => 'contracts'],
        'lost_rate_pct'             => ['label' => '失注率（失注 ÷ 反響数）',         'numerator' => 'lost'],
    ];
}

/** ファネル分析で使う指標のセット */
function analysisFunnelMetrics(): array
{
    // 0次接客は入力率が0.6%（22,881件中138件）しかなく、既定に含めると
    // ほぼ全行が0になってノイズになる。指標としては選択可能なまま残す。
    return [
        'leads', 'energized', 'first_interview',
        'second_interview', 'pre_screening', 'contracts', 'lost',
    ];
}

// ---------------------------------------------------------------------------
// リクエストの検証
//
// ⚠️ 軸名・指標名はSQLに埋め込まれる。ここで許可リストとの一致を確認した値だけを
//   後段に渡すこと。「あとでSQL側で気をつける」では必ず漏れる。
// ---------------------------------------------------------------------------

/**
 * カンマ区切りの文字列、または配列を受け取り、許可リストに含まれるキーだけを返す。
 *
 * @param mixed    $raw     リクエストの値（未指定なら null）
 * @param array    $allowed 許可するキー => 定義 の連想配列
 * @param array    $default 未指定時に使う値
 * @param string   $label   エラーメッセージ用の項目名
 * @param ?int     $max     指定できる最大個数
 * @return string[]
 * @throws AnalysisRequestException
 */
function analysisParseKeys($raw, array $allowed, array $default, string $label, ?int $max = null): array
{
    if ($raw === null || $raw === '' || $raw === []) {
        return $default;
    }

    $values = is_array($raw) ? $raw : explode(',', (string)$raw);
    $keys   = [];

    foreach ($values as $value) {
        $key = trim((string)$value);
        if ($key === '') {
            continue;
        }
        if (!array_key_exists($key, $allowed)) {
            throw new AnalysisRequestException(
                $label . 'に指定できない値が含まれています: 「' . $key . '」。'
                . '指定できるのは ' . implode(' / ', array_keys($allowed)) . ' です。'
            );
        }
        // 同じ軸を2回指定されても GROUP BY が壊れないよう重複を落とす
        if (!in_array($key, $keys, true)) {
            $keys[] = $key;
        }
    }

    if ($keys === []) {
        return $default;
    }
    if ($max !== null && count($keys) > $max) {
        throw new AnalysisRequestException(
            $label . 'に指定できるのは最大' . $max . '個です（' . count($keys) . '個指定されています）。'
        );
    }

    return $keys;
}

/**
 * 'YYYY-MM' 形式の月を検証する。未指定なら null。
 * @throws AnalysisRequestException
 */
function analysisParseMonth($raw, string $label): ?string
{
    if ($raw === null || $raw === '') {
        return null;
    }

    $value = trim((string)$raw);
    if (preg_match('/^\d{4}-\d{2}$/', $value) !== 1) {
        throw new AnalysisRequestException(
            $label . 'は YYYY-MM 形式（例: 2026-04）で指定してください。受け取った値: 「' . $value . '」'
        );
    }

    return $value;
}

/**
 * 軸と同じキーで受け取った等値絞り込みを取り出す。
 * @throws AnalysisRequestException
 */
function analysisParseFilters(array $data): array
{
    $filters = [];

    foreach (($data['filters'] ?? []) as $key => $value) {
        if (!array_key_exists($key, analysisDimensions())) {
            throw new AnalysisRequestException(
                'filters に指定できない項目が含まれています: 「' . $key . '」。'
                . '指定できるのは ' . implode(' / ', array_keys(analysisDimensions())) . ' です。'
            );
        }
        if ($value === null || $value === '') {
            continue;
        }
        $filters[$key] = (string)$value;
    }

    return $filters;
}

/** 集計基準日のキーを検証する */
function analysisParseBasis($raw): string
{
    $value = ($raw === null || $raw === '') ? 'reaction' : trim((string)$raw);

    if (!array_key_exists($value, analysisBases())) {
        throw new AnalysisRequestException(
            'basis に指定できるのは ' . implode(' / ', array_keys(analysisBases())) . ' です。'
            . '受け取った値: 「' . $value . '」'
        );
    }

    return $value;
}

// ---------------------------------------------------------------------------
// SQL の組み立て
// ---------------------------------------------------------------------------

/**
 * FROM 句を組み立てる。
 *
 * ⚠️ 結合先の3テーブルは master_data.id に対して重複行を持つ
 *   （実測: inquiry_customer.pg_id 27件 / call_sheet.id 2件 / interview_sheet.id 1件）。
 *   そのまま JOIN すると COUNT(*) が水増しされるため、必ず事前集計してから結合する。
 *   shop_list も同名店舗が複数行ある場合に備えて shop 単位に畳む。
 *
 * 対象範囲は既存のKPI画面と完全にそろえている。
 *   master_data.show_dashboard = 1 … 非表示レコードを除外（実測459件）
 *   shop_list.report_flag     = 1 … 「KH全店舗」のような集計用ダミー行と
 *                                    運用を終えた店舗を除外（注文事業45行 → 30店舗）
 *   この2条件により母数は 22,881件になる。片方でも外すと既存KPI画面と数字が食い違う。
 *
 * @param array $need ['inquiry' => bool, 'call' => bool, 'interview' => bool]
 * @return array{0: string, 1: array} [SQL断片, バインドするパラメータ]
 */
function analysisBuildFrom(array $need): array
{
    $sql = "
        FROM master_data m
        JOIN (
            SELECT shop,
                   MIN(brand)   AS brand,
                   MIN(section) AS section,
                   MIN(area)    AS area
              FROM shop_list
             WHERE division = ? AND report_flag = 1 AND shop <> ''
             GROUP BY shop
        ) s ON s.shop = m.in_charge_store";

    $params = [kpiShopDivision(ANALYSIS_DIVISION)];

    if (($need['inquiry'] ?? false) === true) {
        // 1顧客が複数の反響レコードを持つ場合（27件）は MIN で1件に寄せる。
        // 反響媒体は軸としての利用なので、どれか1つに確定できれば足りる。
        $sql .= "
        LEFT JOIN (
            SELECT pg_id,
                   MIN(response_medium) AS response_medium
              FROM inquiry_customer
             WHERE delete_flag = 0 AND pg_id <> ''
             GROUP BY pg_id
        ) ic ON ic.pg_id = m.id";
    }

    if (($need['call'] ?? false) === true) {
        // call_log は JSON 配列。実データは日本語が生UTF-8の行と \uXXXX
        // エスケープの行が混在しているが、JSON_SEARCH はどちらも正しく照合する
        // （LIKE '%通電%' だとエスケープ済みの行を取りこぼす）。
        // note には顧客との会話内容が入るため、件数以外は取り出さない。
        $sql .= "
        LEFT JOIN (
            SELECT id,
                   SUM(COALESCE(JSON_LENGTH(call_log), 0)) AS call_count,
                   SUM(COALESCE(JSON_LENGTH(JSON_SEARCH(call_log, 'all', '通電',   NULL, '$[*].action')), 0)) AS call_connected,
                   SUM(COALESCE(JSON_LENGTH(JSON_SEARCH(call_log, 'all', '未通電', NULL, '$[*].action')), 0)) AS call_missed
              FROM call_sheet
             WHERE id <> ''
             GROUP BY id
        ) cs ON cs.id = m.id";
    }

    if (($need['interview'] ?? false) === true) {
        // interview_log の note にも個人情報が入るため、件数のみ集計する
        $sql .= "
        LEFT JOIN (
            SELECT id, SUM(COALESCE(JSON_LENGTH(interview_log), 0)) AS interview_count
              FROM interview_sheet
             WHERE id <> ''
             GROUP BY id
        ) iv ON iv.id = m.id";
    }

    return [$sql, $params];
}

/**
 * WHERE 句を組み立てる。
 *
 * ⚠️ プレースホルダはSQLの出現順にバインドされる。
 *   analysisBuildFrom() のパラメータを必ず先に並べること。
 *
 * @return array{0: string, 1: array}
 */
function analysisBuildWhere(array $options, string $basisSql): array
{
    $conditions = [
        'm.show_dashboard = 1',
        "{$basisSql} IS NOT NULL",
        // 0004年のような入力ミスが実在し、月次軸を壊すため足切りする
        "{$basisSql} >= ?",
    ];
    $params = [ANALYSIS_MIN_DATE];

    if (($options['from'] ?? null) !== null) {
        $conditions[] = "DATE_FORMAT({$basisSql}, '%Y-%m') >= ?";
        $params[]     = $options['from'];
    }
    if (($options['to'] ?? null) !== null) {
        $conditions[] = "DATE_FORMAT({$basisSql}, '%Y-%m') <= ?";
        $params[]     = $options['to'];
    }
    if (($options['exclude_duplicated'] ?? false) === true) {
        $conditions[] = "COALESCE(m.status, '') <> '重複'";
    }

    // 絞り込みも軸と同じ許可リストのSQL式を使い、値だけをプレースホルダで渡す
    foreach (($options['filters'] ?? []) as $key => $value) {
        $conditions[] = analysisDimensionSql($key, $basisSql) . ' = ?';
        $params[]     = $value;
    }

    return ['WHERE ' . implode("\n           AND ", $conditions), $params];
}

/** 集計基準日の一覧。コホートをどちらの日付で切るか */
function analysisBases(): array
{
    return [
        'reaction' => [
            'sql'   => KPI_MD_REGISTERED,
            'label' => '反響取得日',
            'note'  => 'その月に獲得した反響が、その後どこまで進んだかを見る（コホート集計）。',
        ],
        'contract' => [
            'sql'   => KPI_MD_CONTRACT,
            'label' => '契約日',
            'note'  => 'その月に何件契約したかを見る。反響の獲得月とは対応しない。'
                . '⚠️ 契約日が入っている顧客だけが母数になるため、leads と contracts は必ず同じ値になり、'
                . '契約率は常に100%になる。転換率を見たい場合は basis = reaction を使うこと。'
                . 'basis = contract は「契約の件数と、その内訳（店舗別・媒体別など）」を見るためのもの。',
        ],
    ];
}

// ---------------------------------------------------------------------------
// 集計の実行
// ---------------------------------------------------------------------------

/**
 * rows がコンテキストに載る大きさか確認する。
 * 行数の上限だけでは、指標を増やして1行が長くなったケースを捕まえられない。
 *
 * @throws AnalysisRequestException
 */
function analysisAssertPayloadSize(array $rows): void
{
    $bytes = strlen(json_encode($rows, JSON_UNESCAPED_UNICODE));

    if ($bytes > ANALYSIS_MAX_BYTES) {
        throw new AnalysisRequestException(sprintf(
            '集計結果が %d KB になり、上限の %d KB を超えました（%d行）。'
            . 'group_by の軸を減らす、metrics を絞る、from / to で期間を狭める、'
            . 'のいずれかで小さくしてください。',
            (int)round($bytes / 1024),
            (int)round(ANALYSIS_MAX_BYTES / 1024),
            count($rows)
        ));
    }
}

/** 軸の値を整える。空・NULL は「(未設定)」に寄せて、入力漏れだと分かるようにする */
function analysisNormalizeDimensionValue($value): string
{
    return ($value === null || $value === '') ? ANALYSIS_UNSET : (string)$value;
}

/**
 * 軸と指標を指定して集計する。
 *
 * @param array $options {
 *   group_by: string[], metrics: string[], rates: string[], basis: string,
 *   from: ?string, to: ?string, filters: array<string,string>, exclude_duplicated: bool
 * }
 * @return array{rows: array, basis: array}
 * @throws AnalysisRequestException 行数が上限を超えた場合
 */
function analysisRunPivot(PDO $pdo, array $options): array
{
    $basis    = analysisBases()[$options['basis']];
    $basisSql = $basis['sql'];

    $allMetrics = analysisMetrics();
    $rates      = analysisRates();

    $requested = $options['metrics'];

    // 比率の算出に必要な件数指標は、明示的に要求されていなくても内部で取得する
    $needed = $requested;
    if ($options['rates'] !== []) {
        $needed[] = 'leads';
        foreach ($options['rates'] as $rate) {
            $needed[] = $rates[$rate]['numerator'];
        }
    }
    $needed = array_values(array_unique($needed));

    $countMetrics  = array_values(array_filter($needed, static fn(string $k): bool => $allMetrics[$k]['kind'] === 'count'));
    $medianMetrics = array_values(array_filter($requested, static fn(string $k): bool => $allMetrics[$k]['kind'] === 'median'));

    // 重いJOINは、それを必要とする指標・軸が要求されたときだけ足す
    $need = [
        'inquiry' => false,
        'call'    => false,
        'interview' => false,
    ];
    foreach (array_merge($options['group_by'], array_keys($options['filters'])) as $key) {
        if ((analysisDimensions()[$key]['needs_inquiry'] ?? false) === true) {
            $need['inquiry'] = true;
        }
    }
    foreach ($countMetrics as $key) {
        if (($allMetrics[$key]['needs_call'] ?? false) === true) {
            $need['call'] = true;
        }
        if (($allMetrics[$key]['needs_interview'] ?? false) === true) {
            $need['interview'] = true;
        }
    }

    [$fromSql, $fromParams]   = analysisBuildFrom($need);
    [$whereSql, $whereParams] = analysisBuildWhere($options, $basisSql);
    $params = array_merge($fromParams, $whereParams);

    // 軸は d0, d1 … / 指標は a0, a1 … の別名で受け取り、PHP側でキー名に戻す。
    // 日本語のキー名をSQLの別名にすると、識別子のクォートで事故りやすいため。
    $selects = [];
    foreach ($options['group_by'] as $i => $key) {
        $selects[] = analysisDimensionSql($key, $basisSql) . " AS d{$i}";
    }
    foreach ($countMetrics as $i => $key) {
        $selects[] = $allMetrics[$key]['sql'] . " AS a{$i}";
    }

    $groupNumbers = implode(', ', range(1, max(count($options['group_by']), 1)));
    $groupBy      = $options['group_by'] === [] ? '' : "GROUP BY {$groupNumbers}";
    $orderBy      = $options['group_by'] === [] ? '' : "ORDER BY {$groupNumbers}";

    // 上限を1件超えたところで打ち切り、超過を検知する
    $limit = ANALYSIS_MAX_ROWS + 1;

    $raws = kpiFetch($pdo, "
        SELECT " . implode(",\n               ", $selects) . "
        {$fromSql}
        {$whereSql}
        {$groupBy}
        {$orderBy}
        LIMIT {$limit}
    ", $params);

    if (count($raws) > ANALYSIS_MAX_ROWS) {
        throw new AnalysisRequestException(
            '集計結果が' . ANALYSIS_MAX_ROWS . '行を超えました。'
            . 'group_by の軸を減らすか、from / to で期間を絞ってください。'
            . '（指定された軸: ' . implode(', ', $options['group_by']) . '）'
        );
    }

    $rows = [];
    foreach ($raws as $raw) {
        $row = [];
        foreach ($options['group_by'] as $i => $key) {
            $row[$key] = analysisNormalizeDimensionValue($raw["d{$i}"]);
        }

        // 内部取得した分も含めて一旦すべて数値化する
        $values = [];
        foreach ($countMetrics as $i => $key) {
            $raw_value = $raw["a{$i}"];
            $values[$key] = $raw_value === null ? null : (float)$raw_value;
        }

        // 出力するのは要求された指標だけ（比率のために取ったものは出さない）
        foreach ($requested as $key) {
            if ($allMetrics[$key]['kind'] !== 'count') {
                continue;
            }
            // 件数は整数で返す。平均値（decimal）は 4.0 を 4 に丸めず小数のまま返す
            $value = $values[$key];
            $row[$key] = ($value !== null && ($allMetrics[$key]['decimal'] ?? false) !== true)
                ? (int)$value
                : $value;
        }

        $leads = $values['leads'] ?? null;
        foreach ($options['rates'] as $rate) {
            $numerator = $values[$rates[$rate]['numerator']] ?? null;
            $row[$rate] = ($leads === null || $leads <= 0 || $numerator === null)
                ? null
                : round($numerator / $leads * 100, 1);
        }

        $rows[] = $row;
    }

    if ($medianMetrics !== []) {
        $rows = analysisAttachMedians($pdo, $rows, $medianMetrics, $options, $basisSql, $need);
    }

    analysisAssertPayloadSize($rows);

    return ['rows' => $rows, 'basis' => $basis];
}

/**
 * 中央値を別クエリで取り、軸の値で突き合わせて行にマージする。
 *
 * MariaDB 10.11 は PERCENTILE_CONT を集計関数として使えず、
 * MEDIAN() はウィンドウ関数としてしか書けない。
 * そのため PARTITION BY で軸ごとに値を出し、DISTINCT で1行に畳む。
 */
function analysisAttachMedians(
    PDO $pdo,
    array $rows,
    array $medianMetrics,
    array $options,
    string $basisSql,
    array $need
): array {
    $allMetrics = analysisMetrics();

    [$fromSql, $fromParams]   = analysisBuildFrom($need);
    [$whereSql, $whereParams] = analysisBuildWhere($options, $basisSql);
    $params = array_merge($fromParams, $whereParams);

    $selects   = [];
    $partition = [];
    foreach ($options['group_by'] as $i => $key) {
        $expr        = analysisDimensionSql($key, $basisSql);
        $selects[]   = "{$expr} AS d{$i}";
        $partition[] = $expr;
    }

    $over = $partition === [] ? '' : 'PARTITION BY ' . implode(', ', $partition);

    foreach ($medianMetrics as $i => $key) {
        // MEDIAN は NULL を無視するため、日数が算出できない顧客は自然に母数から外れる
        $selects[] = 'MEDIAN(' . $allMetrics[$key]['value_sql'] . ") OVER ({$over}) AS m{$i}";
    }

    $limit = ANALYSIS_MAX_ROWS + 1;

    $raws = kpiFetch($pdo, "
        SELECT DISTINCT " . implode(",\n                        ", $selects) . "
        {$fromSql}
        {$whereSql}
        LIMIT {$limit}
    ", $params);

    // 軸の値の組み合わせをキーにして突き合わせる
    $byKey = [];
    foreach ($raws as $raw) {
        $keyParts = [];
        foreach ($options['group_by'] as $i => $key) {
            $keyParts[] = analysisNormalizeDimensionValue($raw["d{$i}"]);
        }
        $values = [];
        foreach ($medianMetrics as $i => $key) {
            $values[$key] = $raw["m{$i}"] === null ? null : round((float)$raw["m{$i}"], 1);
        }
        $byKey[implode("\x1f", $keyParts)] = $values;
    }

    foreach ($rows as $index => $row) {
        $keyParts = [];
        foreach ($options['group_by'] as $key) {
            $keyParts[] = $row[$key];
        }
        $values = $byKey[implode("\x1f", $keyParts)] ?? [];
        foreach ($medianMetrics as $key) {
            $rows[$index][$key] = $values[$key] ?? null;
        }
    }

    return $rows;
}

// ---------------------------------------------------------------------------
// 未同期リード（inquiry_customer.sync = 0）
// ---------------------------------------------------------------------------

/**
 * 未同期リードで使える軸。
 *
 * inquiry_customer は master_data と別テーブルなので軸の定義も別になる。
 * ⚠️ 氏名・電話番号・メールアドレス・住所の列は軸に加えないこと。
 */
function analysisUnsyncedDimensions(): array
{
    return [
        'month'           => ['label' => '月（反響日の年月）', 'basis' => true],
        'store'           => ['label' => '店舗',               'sql' => 'ic.shop'],
        'brand'           => ['label' => 'ブランド（shop_list.brand）', 'sql' => 's.brand'],
        'section'         => ['label' => '営業課',             'sql' => 's.section'],
        'area'            => ['label' => 'エリア',             'sql' => 's.area'],
        'response_medium' => ['label' => '反響媒体',           'sql' => 'ic.response_medium'],
    ];
}

/**
 * 未同期リードを集計する。
 *
 * inquiry_customer.sync = 0 の反響は pg_id を持たず master_data に紐づかない。
 * つまり顧客台帳に取り込まれておらず、追客されていない可能性がある。
 * master_data 側からは存在自体が見えないため、専用の集計として切り出している。
 *
 * @throws AnalysisRequestException
 */
function analysisRunUnsynced(PDO $pdo, array $options): array
{
    $inquiryDate = kpiDateExpr('ic.inquiry_date');
    $dimensions  = analysisUnsyncedDimensions();

    $selects = [];
    foreach ($options['group_by'] as $i => $key) {
        $expr = ($dimensions[$key]['basis'] ?? false) === true
            ? "DATE_FORMAT({$inquiryDate}, '%Y-%m')"
            : $dimensions[$key]['sql'];
        // analysisDimensionSql() と同じ理由で、NULL と空文字はSQLの段階で1グループに畳む
        $selects[] = "COALESCE(NULLIF(TRIM({$expr}), ''), '" . ANALYSIS_UNSET . "') AS d{$i}";
    }

    $conditions = [
        'ic.delete_flag = 0',
        "{$inquiryDate} IS NOT NULL",
        "{$inquiryDate} >= ?",
    ];
    // FROM 内の division が先に来るため、パラメータもその順で並べる
    $params = [kpiShopDivision(ANALYSIS_DIVISION), ANALYSIS_MIN_DATE];

    if (($options['from'] ?? null) !== null) {
        $conditions[] = "DATE_FORMAT({$inquiryDate}, '%Y-%m') >= ?";
        $params[]     = $options['from'];
    }
    if (($options['to'] ?? null) !== null) {
        $conditions[] = "DATE_FORMAT({$inquiryDate}, '%Y-%m') <= ?";
        $params[]     = $options['to'];
    }

    $groupNumbers = implode(', ', range(1, max(count($options['group_by']), 1)));
    $groupBy      = $options['group_by'] === [] ? '' : "GROUP BY {$groupNumbers}";
    $orderBy      = $options['group_by'] === [] ? '' : "ORDER BY {$groupNumbers}";
    $limit        = ANALYSIS_MAX_ROWS + 1;

    $selects[] = 'COUNT(*) AS inquiries';
    $selects[] = 'SUM(ic.sync = 0) AS unsynced';
    $selects[] = 'SUM(ic.sync = 1) AS synced';

    $raws = kpiFetch($pdo, "
        SELECT " . implode(",\n               ", $selects) . "
          FROM inquiry_customer ic
          JOIN (
              SELECT shop,
                     MIN(brand)   AS brand,
                     MIN(section) AS section,
                     MIN(area)    AS area
                FROM shop_list
               WHERE division = ? AND report_flag = 1 AND shop <> ''
               GROUP BY shop
          ) s ON s.shop = ic.shop
         WHERE " . implode("\n           AND ", $conditions) . "
         {$groupBy}
         {$orderBy}
         LIMIT {$limit}
    ", $params);

    if (count($raws) > ANALYSIS_MAX_ROWS) {
        throw new AnalysisRequestException(
            '集計結果が' . ANALYSIS_MAX_ROWS . '行を超えました。'
            . 'group_by の軸を減らすか、from / to で期間を絞ってください。'
        );
    }

    $rows = [];
    foreach ($raws as $raw) {
        $row = [];
        foreach ($options['group_by'] as $i => $key) {
            $row[$key] = analysisNormalizeDimensionValue($raw["d{$i}"]);
        }
        $inquiries = (int)$raw['inquiries'];
        $unsynced  = (int)$raw['unsynced'];

        $row['inquiries']         = $inquiries;
        $row['unsynced']          = $unsynced;
        $row['synced']            = (int)$raw['synced'];
        $row['unsynced_rate_pct'] = $inquiries > 0 ? round($unsynced / $inquiries * 100, 1) : null;

        $rows[] = $row;
    }

    analysisAssertPayloadSize($rows);

    return $rows;
}
