<?php

/**
 * 保存済みKPI分析の削除。
 *
 * リクエスト例:
 *   { "request": "kpi_analysis_delete", "id": 12 }
 *   ヘッダ: Token: <staff.api_token>
 *
 * 履歴は「見返すための控え」であり監査ログではないため、物理削除でよい。
 * 課金の記録は ai_usage_log 側に別途残るので、ここを消しても
 * 誰がいくら使ったかの追跡には影響しない。
 */

require_once __DIR__ . '/../core/authz.php';

try {
    $staff = requireMaster($pdo, $headers);

    $id = (int)($data['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(
            ['status' => 'error', 'message' => 'IDが指定されていません。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    $stmt = $pdo->prepare('DELETE FROM kpi_analysis_history WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(
            ['status' => 'error', 'message' => '指定された分析結果が見つかりません。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    // 他人の分析も消せる仕様のため、誰が消したかは追えるようにしておく
    error_log(sprintf('kpi_analysis_delete: id=%d by staff_id=%s', $id, $staff['id']));

    echo json_encode(
        ['status' => 'ok', 'id' => $id],
        JSON_UNESCAPED_UNICODE
    );

} catch (Throwable $e) {
    http_response_code(500);
    error_log('kpi_analysis_delete failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '削除に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
