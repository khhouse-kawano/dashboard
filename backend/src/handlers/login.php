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

if ($credential !== '') {
    $mail = verifyGoogleIdToken($credential);

    if ($mail === null) {
        // ⚠️ 理由は返さない。error_log にだけ残る（core/google_auth.php を参照）
        http_response_code(401);
        echo json_encode([
            'message' => 'error',
            'details' => 'ログインに失敗しました。もう一度お試しください。',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
} else {
    // -----------------------------------------------------------------
    // ⚠️⚠️ 暫定の互換経路。**本人確認をしていない。**
    //
    //   古いフロントを開いたままの利用者がいるため、移行期間だけ残す。
    //   この経路が残っている限り、なりすましと権限昇格は成立する。
    //
    //   下の error_log が出なくなったことを確認して**必ず削除すること。**
    //   期限を決めずに残すと永久に残り、この改修の意味が消える。
    //
    //   削除予定: 2026-09-17（段階1の適用から2週間後）
    // -----------------------------------------------------------------
    error_log('login: 旧経路（mail 直接送信）が使われました mail=' . (string)($data['mail'] ?? ''));
    $mail = (string)($data['mail'] ?? '');
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
