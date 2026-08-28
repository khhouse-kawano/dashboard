<?php

/**
 * 分析APIのカタログ（使える軸・指標・データ品質の注意点）を返す。
 *
 * リクエスト例:
 *   { "request": "analysis_meta" }
 *   ヘッダ: Token: <staff.api_token>
 *
 * Claude Desktop（MCP経由）が最初に呼ぶ想定。
 * 何をどう集計できるかをここで把握させることで、
 * 存在しない軸を指定して400を踏むといった往復を減らす。
 *
 * ⚠️ このカタログには軸名と店舗の絞り込み条件が含まれる。
 *   組織構成が読み取れる情報なので、集計本体と同じ権限で保護する。
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/analysis_meta.php';

try {
    requireMaster($pdo, $headers);

    echo json_encode(
        ['status' => 'ok', 'catalog' => analysisBuildCatalog()],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

} catch (Throwable $e) {
    http_response_code(500);
    error_log('analysis_meta failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '分析APIの定義の取得に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
