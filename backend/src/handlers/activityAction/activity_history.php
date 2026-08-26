<?php

// 1件の案件に紐づく変更履歴（kind:'logs'）を新しい順に返す。
//
// リクエスト:
//   { request:'activity', roll:'history', entityId:'xmsbtyw0p36', limit:50 }
//   entityId を省略した場合は全体の最新履歴を返す（管理画面での確認用）。

$entityId = $data['entityId'] ?? null;

// LIMIT はプレースホルダに渡すと PDO のエミュレーションで文字列化され
// 構文エラーになるため、int にキャストして直接埋め込む。
// 上限を設けないと logs が増え続けたときに際限なく返してしまう。
$limit = isset($data['limit']) ? (int) $data['limit'] : 50;
if ($limit < 1) $limit = 1;
if ($limit > 500) $limit = 500;

$where = "kind = 'logs'";
$params = [];

if ($entityId !== null && $entityId !== '') {
    $where .= " AND `entityId` = ?";
    $params[] = $entityId;
}

$sql = "SELECT `id`, `at`, `by`, `entity`, `entityId`, `entityNo`, `label`,
               `field`, `from`, `to`, `note`
          FROM `brokerage_listings`
         WHERE {$where}
      ORDER BY `at` DESC, `internal_id` DESC
         LIMIT {$limit}";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['status' => 'success', 'history' => $rows], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    error_log('[activity_history] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => '履歴の取得に失敗しました'], JSON_UNESCAPED_UNICODE);
}
