<?php

/**
 * 保存済みKPI分析の1件取得（結果画面の復元用）。
 *
 * リクエスト例:
 *   { "request": "kpi_analysis_get", "id": 12 }
 *   ヘッダ: Token: <staff.api_token>
 *
 * analysis_json / kpi_json をデコードして返すため、フロントは
 * kpi_analyze の成功時とまったく同じ形で ClaudeAnalysisResult に渡せる。
 * **Claude は呼ばないので課金は発生しない。**
 */

require_once __DIR__ . '/../core/authz.php';

try {
    requireMaster($pdo, $headers);

    $id = (int)($data['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(
            ['status' => 'error', 'message' => 'IDが指定されていません。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    $stmt = $pdo->prepare(
        'SELECT h.id,
                h.title,
                h.headline,
                h.analysis_type,
                h.division,
                h.scope_section,
                h.scope_shop,
                h.scope_staff,
                h.scope_label,
                h.analysis_json,
                h.kpi_json,
                h.model,
                h.created_at,
                s.name AS staff_name
           FROM kpi_analysis_history h
           LEFT JOIN staff s ON s.id = h.staff_id
          WHERE h.id = ?'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(
            ['status' => 'error', 'message' => '指定された分析結果が見つかりません。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    // 保存時点のスキーマで書かれたJSONが、その後のコード変更で
    // 読めなくなることは起こりうる。壊れていても500にせず、
    // 「復元できなかった」と分かる形で返す。
    $analysis = json_decode((string)$row['analysis_json'], true);
    $kpi      = json_decode((string)$row['kpi_json'], true);

    if (!is_array($analysis) || !is_array($kpi)) {
        http_response_code(422);
        error_log('kpi_analysis_get: broken json id=' . $id);
        echo json_encode(
            ['status' => 'error', 'message' => '保存された分析結果を復元できませんでした。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    unset($row['analysis_json'], $row['kpi_json']);
    $row['id'] = (int)$row['id'];

    echo json_encode([
        'status'   => 'ok',
        'item'     => $row,
        'analysis' => $analysis,
        'kpi'      => $kpi,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('kpi_analysis_get failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '分析結果の取得に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
