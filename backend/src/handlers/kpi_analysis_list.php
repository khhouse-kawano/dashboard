<?php

/**
 * 保存済みKPI分析の一覧。
 *
 * リクエスト例:
 *   { "request": "kpi_analysis_list", "limit": 20, "offset": 0,
 *     "division": "order", "type": "shop" }
 *   ヘッダ: Token: <staff.api_token>
 *
 * ⚠️ analysis_json / kpi_json は SELECT しない。
 *   1件あたり数十KBあり、一覧で全部返すと無駄に重くなる。
 *   本体は kpi_analysis_get で1件ずつ取る。
 *
 * Master権限者だけが使う機能のため、一覧は実行者を問わず全件を返し、
 * 誰が実行したかを staff_name で示す。
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/kpi.php';

try {
    requireMaster($pdo, $headers);

    // 上限を設けないと、履歴が増えたときに一覧だけで重くなる
    $limit  = (int)($data['limit']  ?? 20);
    $limit  = max(1, min(100, $limit));
    $offset = max(0, (int)($data['offset'] ?? 0));

    // 任意の絞り込み。未知の値は無視する（エラーにはしない）
    $where  = [];
    $params = [];

    $division = (string)($data['division'] ?? '');
    if (isset(KPI_DIVISIONS[$division])) {
        $where[]  = 'h.division = ?';
        $params[] = $division;
    }

    $type = (string)($data['type'] ?? '');
    if (in_array($type, ['inquiry_trend', 'shop', 'medium'], true)) {
        $where[]  = 'h.analysis_type = ?';
        $params[] = $type;
    }

    $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

    // 「もっと見る」の要否を判断するため総件数も返す
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM kpi_analysis_history h{$whereSql}");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    // LIMIT / OFFSET は整数に丸め済みなので直接埋め込む
    // （エミュレーション無効時のPDOはLIMITへのバインドを文字列として扱い落ちるため）
    $stmt = $pdo->prepare(
        "SELECT h.id,
                h.title,
                h.headline,
                h.analysis_type,
                h.division,
                h.scope_section,
                h.scope_shop,
                h.scope_staff,
                h.scope_label,
                h.model,
                h.created_at,
                s.name AS staff_name
           FROM kpi_analysis_history h
           LEFT JOIN staff s ON s.id = h.staff_id
          {$whereSql}
          ORDER BY h.created_at DESC, h.id DESC
          LIMIT {$limit} OFFSET {$offset}"
    );
    $stmt->execute($params);

    $items = array_map(static function (array $row): array {
        $row['id'] = (int)$row['id'];
        return $row;
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));

    echo json_encode([
        'status' => 'ok',
        'items'  => $items,
        'total'  => $total,
        'limit'  => $limit,
        'offset' => $offset,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('kpi_analysis_list failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '保存済み分析の取得に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
