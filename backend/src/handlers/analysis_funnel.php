<?php

/**
 * 反響 → 通電 → 初回面談 → 第二面談 → 物件案内 → 事前審査 → 契約
 * のファネル件数と転換率を返す。
 *
 * リクエスト例:
 *   { "request": "analysis_funnel" }                       … 月 × 営業課（既定）
 *   { "request": "analysis_funnel", "group_by": ["store"] } … 店舗別
 *   ヘッダ: Token: <staff.api_token>
 *
 * analysis_pivot と同じ集計を使うが、指標と比率を固定してある。
 * パラメータなしで呼んでもそのまま分析に使える大きさ（既定の 月 × 営業課 で
 * 約350行・70KB程度）に収まるため、Claude が最初に状況を把握するのに向く。
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/analysis_meta.php';

try {
    requireMaster($pdo, $headers);

    try {
        $groupBy = analysisParseKeys(
            $data['group_by'] ?? null,
            analysisDimensions(),
            ['month', 'section'],
            'group_by',
            3
        );

        // ファネルの指標と比率は固定。呼び出し側に選ばせない
        $metrics = analysisFunnelMetrics();
        $rates   = array_keys(analysisRates());

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
        http_response_code(400);
        echo json_encode(
            ['status' => 'error', 'message' => $e->getMessage()],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    $meta = analysisBuildResponseMeta([
        'group_by'           => $options['group_by'],
        'metrics'            => $options['metrics'],
        'rates'              => $options['rates'],
        'basis'              => $result['basis'],
        'from'               => $options['from'],
        'to'                 => $options['to'],
        'filters'            => $options['filters'],
        'exclude_duplicated' => $options['exclude_duplicated'],
        'row_count'          => count($result['rows']),
    ]);

    // 直近の月は「まだ結果が出ていない」だけで、成績が悪いわけではない。
    // これを書いておかないと、直近月の契約率の低下を実態のある悪化として読まれる。
    $meta['直近月の読み方'] = '契約までは平均で2ヶ月前後かかる。'
        . 'basis = reaction の場合、直近3ヶ月（' . date('Y-m', strtotime('-2 month')) . ' 以降）の'
        . 'コホートは面談・契約の数がまだ出揃っていないため、転換率が低く見える。'
        . '当月（' . date('Y-m') . '）は反響数そのものもまだ増える。';

    echo json_encode([
        'status' => 'ok',
        'meta'   => $meta,
        'rows'   => $result['rows'],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('analysis_funnel failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => 'ファネルの集計に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
