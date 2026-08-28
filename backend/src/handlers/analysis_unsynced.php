<?php

/**
 * 顧客台帳に未同期の反響（inquiry_customer.sync = 0）を集計する。
 *
 * リクエスト例:
 *   { "request": "analysis_unsynced" }                          … 月 × 営業課（既定）
 *   { "request": "analysis_unsynced", "group_by": ["store", "response_medium"] }
 *   ヘッダ: Token: <staff.api_token>
 *
 * sync = 0 の反響は pg_id を持たず master_data に紐づかない。
 * つまり顧客台帳に取り込まれておらず、追客されていない可能性がある。
 * analysis_pivot / analysis_funnel の集計からは構造上こぼれ落ちるため、
 * 「見えていない取りこぼし」を測る専用のエンドポイントとして分けている。
 *
 * ⚠️ inquiry_customer には氏名・電話番号・メールアドレス・住所が入っている。
 *   core/analysis.php の SQL はこれらの列を一切 SELECT せず、件数だけを数えている。
 *   軸を追加するときも、個人を特定できる列は絶対に加えないこと。
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/analysis_meta.php';

try {
    requireMaster($pdo, $headers);

    try {
        $groupBy = analysisParseKeys(
            $data['group_by'] ?? null,
            analysisUnsyncedDimensions(),
            ['month', 'section'],
            'group_by',
            3
        );

        $options = [
            'group_by' => $groupBy,
            'from'     => analysisParseMonth($data['from'] ?? null, 'from'),
            'to'       => analysisParseMonth($data['to']   ?? null, 'to'),
        ];

        $rows = analysisRunUnsynced($pdo, $options);

    } catch (AnalysisRequestException $e) {
        http_response_code(400);
        echo json_encode(
            ['status' => 'error', 'message' => $e->getMessage()],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    $labels = analysisUnsyncedDimensions();

    echo json_encode([
        'status' => 'ok',
        'meta'   => [
            'generated_at' => date('Y-m-d H:i'),
            '対象'         => '注文事業の店舗に紐づく反響（inquiry_customer）。'
                . 'shop_list.division = 注文事業 かつ report_flag = 1 の店舗のみ。',
            '集計基準日'   => '反響日（inquiry_customer.inquiry_date）',
            '期間' => [
                'from' => $options['from'] ?? '指定なし（最古のデータから）',
                'to'   => $options['to']   ?? '指定なし（最新のデータまで）',
            ],
            '集計軸' => array_map(
                static fn(string $key): string => $key . ' = ' . $labels[$key]['label'],
                $options['group_by']
            ),
            '指標の意味' => [
                'inquiries'         => '反響の総件数（同期済み + 未同期）',
                'unsynced'          => '顧客台帳に未同期の件数（sync = 0）。追客されていない可能性がある',
                'synced'            => '顧客台帳に同期済みの件数（sync = 1）',
                'unsynced_rate_pct' => '未同期率（unsynced ÷ inquiries）。単位はパーセント',
            ],
            '行数' => count($rows),
            '制約' => '1レスポンスの最大行数は ' . ANALYSIS_MAX_ROWS . ' 行。',
            'データ品質の注意点' => analysisUnsyncedCaveats(),
        ],
        'rows'   => $rows,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('analysis_unsynced failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '未同期リードの集計に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
