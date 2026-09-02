<?php

/**
 * 登録済みAPIキーの有効性確認。
 *
 * リクエスト例:
 *   { "request": "credential_verify", "credential_id": 1 }
 *   ヘッダ: Token: <staff.api_token>
 *
 * DBから暗号文を取り出して復号し、Anthropic のモデル一覧を取得できるか試す。
 * モデル一覧はトークンを消費しないため、この確認自体に課金は発生しない。
 *
 * 結果に応じて api_credential.status / last_verified_at を更新し、
 * 実行内容を ai_usage_log に残す。
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/crypto.php';
require_once __DIR__ . '/../core/anthropic.php';

try {
    // -----------------------------------------------------------------
    // 1. 認証
    // -----------------------------------------------------------------
    // 認証（誰か）と認可（Master権限か）をまとめて確認する。
    // フロントでボタンを隠すだけでは、APIを直接叩かれると防げない。
    $staff = requireMaster($pdo, $headers);

    // -----------------------------------------------------------------
    // 2. 対象キーの取得
    //    自分が登録したキーのみ検証できる。
    // -----------------------------------------------------------------
    $credentialId = (int)($data['credential_id'] ?? 0);
    if ($credentialId <= 0) {
        http_response_code(400);
        echo json_encode(
            ['status' => 'error', 'message' => 'credential_id を指定してください。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    $stmt = $pdo->prepare(
        'SELECT id, label, key_hint, key_ciphertext, key_iv, key_tag, key_version, status
           FROM api_credential
          WHERE id = ? AND staff_id = ?
          LIMIT 1'
    );
    $stmt->execute([$credentialId, $staff['id']]);
    $credential = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$credential) {
        http_response_code(404);
        echo json_encode(
            ['status' => 'error', 'message' => '指定されたAPIキーが見つかりません。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    if ($credential['status'] === 'revoked') {
        http_response_code(409);
        echo json_encode(
            ['status' => 'error', 'message' => 'このキーは失効済みです。'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    // -----------------------------------------------------------------
    // 3. 復号 → Anthropic へ問い合わせ
    //    復号した平文はこのスコープの外へ出さない。
    // -----------------------------------------------------------------
    $apiKey = decryptSecret(
        $credential['key_ciphertext'],
        $credential['key_iv'],
        $credential['key_tag'],
        (int)$credential['key_version']
    );

    $result = anthropicVerifyKey($apiKey);
    unset($apiKey); // 用が済んだら速やかに破棄する

    // -----------------------------------------------------------------
    // 4. 結果をDBに反映
    // -----------------------------------------------------------------
    if ($result['ok']) {
        $newStatus = 'active';
        $pdo->prepare(
            'UPDATE api_credential
                SET status = ?, last_verified_at = NOW()
              WHERE id = ?'
        )->execute([$newStatus, $credentialId]);
    } elseif ($result['status'] === 401 || $result['status'] === 403) {
        // キー自体が使えない場合のみ invalid にする。
        // 通信障害やレート制限で invalid にしてしまうと、復旧後も使えなくなる。
        $newStatus = 'invalid';
        $pdo->prepare('UPDATE api_credential SET status = ? WHERE id = ?')
            ->execute([$newStatus, $credentialId]);
    } else {
        $newStatus = $credential['status'];
    }

    // -----------------------------------------------------------------
    // 5. 利用ログ（トークン消費はないので token 列は NULL）
    // -----------------------------------------------------------------
    $pdo->prepare(
        'INSERT INTO ai_usage_log
             (credential_id, staff_id, feature, model, status, error_message, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $credentialId,
        $staff['id'],
        'credential_verify',
        '-', // モデルを使わない呼び出し
        $result['ok'] ? 'ok' : ($result['status'] === 429 ? 'rate_limited' : 'error'),
        $result['error'],
        $result['duration_ms'],
    ]);

    // -----------------------------------------------------------------
    // 6. レスポンス
    // -----------------------------------------------------------------
    if (!$result['ok']) {
        http_response_code(502);
        echo json_encode(
            [
                'status'      => 'error',
                'message'     => $result['error'],
                'http_status' => $result['status'],
                'credential'  => [
                    'id'       => $credentialId,
                    'label'    => $credential['label'],
                    'key_hint' => $credential['key_hint'],
                    'status'   => $newStatus,
                ],
            ],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    echo json_encode(
        [
            'status'      => 'ok',
            'message'     => 'APIキーは有効です。',
            'duration_ms' => $result['duration_ms'],
            'credential'  => [
                'id'       => $credentialId,
                'label'    => $credential['label'],
                'key_hint' => $credential['key_hint'],
                'status'   => $newStatus,
            ],
        ],
        JSON_UNESCAPED_UNICODE
    );

} catch (Throwable $e) {
    http_response_code(500);
    error_log('credential_verify failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '検証処理に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
