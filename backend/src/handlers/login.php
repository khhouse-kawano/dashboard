<?php

/**
 * ログイン。Google の IDトークンを検証してから staff テーブルと突合する。
 *
 * リクエスト:
 *   { "request": "login", "credential": "<Google の IDトークン>" }
 *
 * ⚠️ credential は Google から受け取った JWT そのものを送ること。
 *   フロントでデコードした結果（メールアドレス）を送ってはいけない。
 *   デコードは署名を検証しないため、誰でも他人になりすませる。
 */

require_once __DIR__ . '/../core/google_auth.php';

// ---------------------------------------------------------------------------
// 1. 本人確認
// ---------------------------------------------------------------------------
$credential = (string)($data['credential'] ?? '');

// ⚠️ credential が無いときも Google の検証に失敗したときも 401。
//   v2.2.206 で、メールアドレスだけを受け取る古い経路（本人確認なし）を削除した。
$mail = $credential !== '' ? verifyGoogleIdToken($credential) : null;

if ($mail === null) {
    // ⚠️ 理由は返さない。error_log にだけ残る（core/google_auth.php を参照）
    http_response_code(401);
    echo json_encode([
        'message' => 'error',
        'details' => 'ログインに失敗しました。もう一度お試しください。',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------------------------------------------------------------------------
// 2. 在籍確認
//
// ⚠️ ここが本来の関門。Google で本人だと確認できても、
//   staff テーブルに無ければ入れない（退職者は削除すれば即座に締め出せる）。
// ---------------------------------------------------------------------------
$stmt = $pdo->prepare("SELECT * FROM staff WHERE mail = ?");
$stmt->execute([$mail]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode([
        'message' => 'error',
        'details' => 'メールまたはパスワードが違います',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

session_start();
$timestamp = date('Y/m/d H:i');

$stmt = $pdo->prepare("INSERT INTO login_log (timestamp, staff) VALUES (?, ?)");
$stmt->execute([$timestamp, $user['name']]);

// ⚠️ api_token は staff テーブルに1列しかないため、ログインするたびに上書きされる。
//   つまり1人につき有効なトークンは常に1本で、2台目でログインすると1台目が落ちる。
//   複数端末とサーバー側の有効期限は段階2（staff_session テーブル）で対応する。
//   docs/auth-redesign-proposal.md を参照。
$token = generateToken();
storeToken($pdo, $user['mail'], $token);

echo json_encode([
    "message" => "success",
    "token" => $token,
    "authority" => $user['brand'] ?? '',
    "brand" => $user['brand'] ?? '',
    "userName" => $user['name'] ?? '',
    "shopValue" => $user['shop'] ?? ''
]);
