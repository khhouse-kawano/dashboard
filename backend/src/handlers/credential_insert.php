<?php

/**
 * APIキーの登録。
 *
 * リクエスト例:
 *   { "request": "credential_insert",
 *     "api_key": "sk-ant-api03-xxxx",
 *     "label":   "A社長 個人アカウント" }
 *   ヘッダ: Token: <staff.api_token>
 *
 * 平文のAPIキーは暗号化して保存し、レスポンスにもログにも絶対に出さない。
 * キーの有効性検証（Anthropicへの疎通確認）は Step 4 で追加する。
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/crypto.php';

try {
    // -----------------------------------------------------------------
    // 1. 認証（誰のキーとして登録するかを確定させる）
    // -----------------------------------------------------------------
    // 認証（誰か）と認可（Master権限か）をまとめて確認する。
    // フロントでボタンを隠すだけでは、APIを直接叩かれると防げない。
    $staff = requireMaster($pdo, $headers);

    // -----------------------------------------------------------------
    // 2. 入力チェック
    // -----------------------------------------------------------------
    $apiKey   = trim((string)($data['api_key'] ?? ''));
    $label    = trim((string)($data['label'] ?? ''));
    $provider = trim((string)($data['provider'] ?? 'anthropic'));

    $errors = [];
    if ($apiKey === '') {
        $errors[] = 'APIキーが指定されていません。';
    }
    if ($label === '') {
        $errors[] = 'ラベル（用途がわかる名前）を入力してください。';
    } elseif (mb_strlen($label) > 100) {
        $errors[] = 'ラベルは100文字以内で入力してください。';
    }
    // 明らかに形式が違うものは、暗号化する前に弾く
    if ($apiKey !== '' && $provider === 'anthropic' && strncmp($apiKey, 'sk-ant-', 7) !== 0) {
        $errors[] = 'Anthropic のAPIキーは "sk-ant-" で始まります。値を確認してください。';
    }

    if ($errors) {
        http_response_code(400);
        echo json_encode(
            ['status' => 'error', 'message' => '入力内容に誤りがあります。', 'errors' => $errors],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    // -----------------------------------------------------------------
    // 3. 重複チェック
    //    暗号文は毎回変わるので突き合わせに使えない。
    //    そのためにフィンガープリント（SHA-256）を持たせてある。
    // -----------------------------------------------------------------
    $fingerprint = secretFingerprint($apiKey);

    $stmt = $pdo->prepare(
        'SELECT c.id, c.status, s.name AS owner_name
           FROM api_credential c
           JOIN staff s ON s.id = c.staff_id
          WHERE c.provider = ? AND c.key_fingerprint = ?
          LIMIT 1'
    );
    $stmt->execute([$provider, $fingerprint]);
    $duplicated = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($duplicated) {
        http_response_code(409);
        echo json_encode(
            [
                'status'  => 'error',
                'message' => 'このAPIキーは既に登録されています（登録者: '
                    . $duplicated['owner_name'] . '）。',
            ],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    // -----------------------------------------------------------------
    // 4. 暗号化して保存
    // -----------------------------------------------------------------
    $encrypted = encryptSecret($apiKey);
    $hint      = secretHint($apiKey);

    $stmt = $pdo->prepare(
        'INSERT INTO api_credential
             (staff_id, provider, label,
              key_ciphertext, key_iv, key_tag, key_version,
              key_hint, key_fingerprint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $staff['id'],
        $provider,
        $label,
        $encrypted['ciphertext'],
        $encrypted['iv'],
        $encrypted['tag'],
        $encrypted['version'],
        $hint,
        $fingerprint,
    ]);

    $credentialId = (int)$pdo->lastInsertId();

    // 平文をメモリに残さない
    unset($apiKey);

    // -----------------------------------------------------------------
    // 5. レスポンス（キー本体は絶対に含めない）
    // -----------------------------------------------------------------
    echo json_encode(
        [
            'status'     => 'ok',
            'credential' => [
                'id'       => $credentialId,
                'provider' => $provider,
                'label'    => $label,
                'key_hint' => $hint,
                'status'   => 'active',
            ],
        ],
        JSON_UNESCAPED_UNICODE
    );

} catch (Throwable $e) {
    // 例外メッセージには平文キーを含めていないが、
    // 念のため利用者には返さず、サーバーログにのみ残す。
    http_response_code(500);
    error_log('credential_insert failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '登録処理に失敗しました。管理者にお問い合わせください。'],
        JSON_UNESCAPED_UNICODE
    );
}
