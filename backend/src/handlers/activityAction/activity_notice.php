<?php

// ログイン中の担当者宛の通知（kind:'notices'）を新しい順に返す。
//
// リクエスト:
//   { request:'activity', roll:'notice', to:'宮園滉三', unreadOnly:false, limit:50 }
//
// `to` は担当者名。指定が無いと全員分の通知を返してしまうため必須とする。

$to = $data['to'] ?? null;

if ($to === null || $to === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => '通知先が指定されていません'], JSON_UNESCAPED_UNICODE);
    exit;
}

$unreadOnly = !empty($data['unreadOnly']);

// LIMIT は int にキャストして直接埋め込む（プレースホルダだと文字列化される）
$limit = isset($data['limit']) ? (int) $data['limit'] : 50;
if ($limit < 1) $limit = 1;
if ($limit > 200) $limit = 200;

$where = "kind = 'notices' AND `to` = ?";
$params = [$to];

if ($unreadOnly) {
    // read が NULL の古い行も未読として扱う
    $where .= " AND (`read` IS NULL OR `read` = 0)";
}

$sql = "SELECT `id`, `at`, `by`, `to`, `type`, `title`, `body`,
               `entity`, `entityId`, `read`
          FROM `brokerage_listings`
         WHERE {$where}
      ORDER BY `at` DESC, `internal_id` DESC
         LIMIT {$limit}";

// 未読バッジ用の件数。一覧の LIMIT に影響されない実数を返す。
$countSql = "SELECT COUNT(*) FROM `brokerage_listings`
              WHERE kind = 'notices' AND `to` = ? AND (`read` IS NULL OR `read` = 0)";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute([$to]);
    $unread = (int) $countStmt->fetchColumn();

    echo json_encode(
        ['status' => 'success', 'notices' => $rows, 'unread' => $unread],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
} catch (PDOException $e) {
    error_log('[activity_notice] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => '通知の取得に失敗しました'], JSON_UNESCAPED_UNICODE);
}
