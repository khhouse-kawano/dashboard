<?php

/**
 * 登録済みAPIキーの一覧。
 *
 * リクエスト例:
 *   { "request": "credential_list" }
 *   ヘッダ: Token: <staff.api_token>
 *
 * 返すのは key_hint（下4桁）までで、暗号文もIVもタグも返さない。
 * 一度登録したキーは、画面から二度と全体を見られない設計とする。
 */

require_once __DIR__ . '/../core/authz.php';

try {
    // -----------------------------------------------------------------
    // 1. 認証
    // -----------------------------------------------------------------
    // 認証（誰か）と認可（Master権限か）をまとめて確認する。
    // フロントでボタンを隠すだけでは、APIを直接叩かれると防げない。
    $staff = requireMaster($pdo, $headers);

    // -----------------------------------------------------------------
    // 2. 取得
    //    現時点では「自分が登録したキー」のみ。
    //    管理者が全件を見る機能は、権限設計を決めてから追加する。
    // -----------------------------------------------------------------
    $stmt = $pdo->prepare(
        'SELECT c.id,
                c.provider,
                c.label,
                c.key_hint,
                c.key_version,
                c.status,
                c.last_verified_at,
                c.created_at,
                (SELECT COUNT(*) FROM ai_usage_log l WHERE l.credential_id = c.id) AS usage_count
           FROM api_credential c
          WHERE c.staff_id = ?
          ORDER BY c.id DESC'
    );
    $stmt->execute([$staff['id']]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 数値項目を文字列ではなく数値として返す（フロントでの型ブレを防ぐ）
    $credentials = array_map(static function (array $row): array {
        $row['id']          = (int)$row['id'];
        $row['key_version'] = (int)$row['key_version'];
        $row['usage_count'] = (int)$row['usage_count'];
        return $row;
    }, $rows);

    echo json_encode(
        ['status' => 'ok', 'credentials' => $credentials],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

} catch (Throwable $e) {
    http_response_code(500);
    error_log('credential_list failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '一覧の取得に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
