<?php
/**
 * 20秒ごとの在席（staff.heartbeat）。
 *
 * ⚠️⚠️ v2.2.266 から本体は ② の heartbeat（backend-express/src/features/accessLog.ts）。
 *   ここは ② に届かないときの予備（express_proxy.php の expressProxyRequests にだけ入れてある）。
 * ⚠️⚠️ **staff.log（JSON の配列）への書き足しはやめた。**
 *   ⚠️ 以前は 20秒ごとに JSON 全体を読んで1件足して書き戻しており、1人で数MB まで増え続けていた。
 *   ⚠️ 画面のアクセス記録は staff_access_log（② が書く）。予備のこちらは記録しない（在席の表示だけ保つ）。
 * ⚠️ 以前は `SELECT *` で大きな staff.log まで読んでいたので、読む列を絞った。
 */
try {

    $sql = "SELECT id FROM staff WHERE api_token = ? AND api_token <> ''";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['token'] ?? '']);
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($result) {
        $updateSql = "UPDATE staff SET heartbeat = ? WHERE id = ?";
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute([date('Y-m-d H:i:s'), $result[0]['id']]);
        http_response_code(204); // No Content
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
