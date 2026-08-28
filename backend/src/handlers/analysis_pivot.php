<?php

/**
 * 軸と指標を指定して注文事業の顧客データを集計する（汎用）。
 *
 * リクエスト例:
 *   {
 *     "request":  "analysis_pivot",
 *     "group_by": ["month", "section"],
 *     "metrics":  ["leads", "first_interview", "contracts"],
 *     "rates":    ["contract_rate_pct"],
 *     "basis":    "reaction",
 *     "from":     "2026-01",
 *     "to":       "2026-08",
 *     "filters":  { "brand": "KH" },
 *     "exclude_duplicated": true
 *   }
 *   ヘッダ: Token: <staff.api_token>
 *
 * ⚠️ 返すのは集計値のみ。個人情報は core/analysis.php のSQLの段階で取得していない。
 *   軸・指標は許可リストで検証済みのキーだけがSQLに渡る。
 *
 * 個人情報の一括取得にはあたらないが、全店舗の成績を横断的に取得できるため
 * 既存のKPI分析（kpi_analyze）と同じ Master 権限で保護する。
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/analysis_meta.php';

try {
    requireMaster($pdo, $headers);

    try {
        $groupBy = analysisParseKeys(
            $data['group_by'] ?? null,
            analysisDimensions(),
            ['month'],
            'group_by',
            // 軸を4つ以上重ねると行数が跳ね上がり、Claude のコンテキストに載らなくなる
            3
        );
        $metrics = analysisParseKeys(
            $data['metrics'] ?? null,
            analysisMetrics(),
            analysisFunnelMetrics(),
            'metrics'
        );
        $rates = analysisParseKeys(
            $data['rates'] ?? null,
            analysisRates(),
            [],
            'rates'
        );

        $options = [
            'group_by'           => $groupBy,
            'metrics'            => $metrics,
            'rates'              => $rates,
            'basis'              => analysisParseBasis($data['basis'] ?? null),
            'from'               => analysisParseMonth($data['from'] ?? null, 'from'),
            'to'                 => analysisParseMonth($data['to']   ?? null, 'to'),
            'filters'            => analysisParseFilters($data),
            'exclude_duplicated' => ($data['exclude_duplicated'] ?? false) === true,
        ];

        $result = analysisRunPivot($pdo, $options);

    } catch (AnalysisRequestException $e) {
        // 指定ミスは呼び出し側（Claude）が直せるよう、理由をそのまま返す
        http_response_code(400);
        echo json_encode(
            ['status' => 'error', 'message' => $e->getMessage()],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    echo json_encode([
        'status' => 'ok',
        'meta'   => analysisBuildResponseMeta([
            'group_by'           => $options['group_by'],
            'metrics'            => $options['metrics'],
            'rates'              => $options['rates'],
            'basis'              => $result['basis'],
            'from'               => $options['from'],
            'to'                 => $options['to'],
            'filters'            => $options['filters'],
            'exclude_duplicated' => $options['exclude_duplicated'],
            'row_count'          => count($result['rows']),
        ]),
        'rows'   => $result['rows'],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('analysis_pivot failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '集計に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
