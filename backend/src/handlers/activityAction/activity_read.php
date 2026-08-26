<?php

// 通知を既読にする。
//
// リクエスト（どちらか一方）:
//   { request:'activity', roll:'read', ids:['xmt...','xmt...'] }  … 指定した通知だけ既読
//   { request:'activity', roll:'read', to:'宮園滉三', all:true }   … その担当者の未読をすべて既読
//
// 既読化は「誰の通知か」を必ず条件に含める。id だけで更新できると、
// 他人の通知の id を渡された場合に勝手に既読にできてしまうため。

$to  = $data['to'] ?? null;
$ids = $data['ids'] ?? null;
$all = !empty($data['all']);

if ($to === null || $to === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => '通知先が指定されていません'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    if ($all) {
        $sql = "UPDATE `brokerage_listings`
                   SET `read` = 1
                 WHERE kind = 'notices' AND `to` = ? AND (`read` IS NULL OR `read` = 0)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$to]);
    } else {
        if (!is_array($ids) || count($ids) === 0) {
            echo json_encode(['status' => 'success', 'updated' => 0, 'message' => '対象なし'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // IN 句は件数が可変なので、件数ぶんのプレースホルダを組み立てる
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $sql = "UPDATE `brokerage_listings`
                   SET `read` = 1
                 WHERE kind = 'notices' AND `to` = ? AND `id` IN ({$placeholders})";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_merge([$to], array_values($ids)));
    }

    $updated = $stmt->rowCount();

    // 更新後の未読件数を返し、フロントがバッジを再計算せずに済むようにする
    $countStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM `brokerage_listings`
          WHERE kind = 'notices' AND `to` = ? AND (`read` IS NULL OR `read` = 0)"
    );
    $countStmt->execute([$to]);
    $unread = (int) $countStmt->fetchColumn();

    echo json_encode(['status' => 'success', 'updated' => $updated, 'unread' => $unread], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('[activity_read] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => '既読処理に失敗しました'], JSON_UNESCAPED_UNICODE);
}
