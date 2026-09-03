<?php

/**
 * Google の IDトークンを検証して、確かに本人のものであるメールアドレスを取り出す。
 *
 * ─────────────────────────────────────────────
 * なぜ必要か
 *
 *   これまで login.php は、フロントが jwtDecode したメールアドレスを
 *   そのまま受け取っていた。jwtDecode は署名を検証しない（ただのBase64デコード）。
 *
 *   つまり
 *
 *     POST { "request": "login", "mail": "<在籍者のメールアドレス>" }
 *
 *   を投げるだけで、その人のトークンと権限が手に入った。
 *   一般権限の人が Master 権限者のアドレスを送れば Master になれる。
 *
 *   メールアドレスは「氏名@kh-group.jp」の規則性があり社内では既知のため、
 *   これは理論上の話ではなく実際に成立する。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 検証は Google の tokeninfo エンドポイントに任せている。
 *   RS256 の署名検証を手書きするより安全で、composer への依存も増えない。
 *   呼ばれるのはログイン時だけ（1日数十回）なので、通信量の懸念もない。
 */

/** Google のトークン検証エンドポイント */
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

/** 発行者として認める値 */
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * IDトークンを検証し、確認済みのメールアドレスを返す。
 * 検証できなければ null を返す（呼び出し側が 401 を返す）。
 *
 * ⚠️ 失敗の理由をレスポンスに含めないこと。
 *   「aud が違う」「hd が違う」を返すと、攻撃者に条件を教えることになる。
 *   詳細は error_log にだけ残す。
 *
 * @return string|null 検証済みのメールアドレス
 */
function verifyGoogleIdToken(string $idToken): ?string
{
    $idToken = trim($idToken);
    if ($idToken === '') {
        error_log('google_auth: credential が空です');
        return null;
    }

    // ⚠️ 自分宛のトークンかを判定するために必須。
    //   未設定のまま通すと、**他のGoogleアプリで発行されたトークンが通る**。
    //   検証できない以上、ここは通してはならない。
    $clientId = getenv('GOOGLE_CLIENT_ID');
    if ($clientId === false || $clientId === '') {
        error_log('google_auth: GOOGLE_CLIENT_ID が未設定のため検証できません');
        return null;
    }

    $payload = fetchTokenInfo($idToken);
    if ($payload === null) {
        return null;
    }

    // -----------------------------------------------------------------
    // 検証項目。1つでも欠けると検証の意味がなくなる
    // -----------------------------------------------------------------

    // ⚠️ tokeninfo は「トークンが正当か」を返すだけで、
    //   「あなた宛か」は判定しない。aud の照合は必ず自分で行う。
    $aud = (string)($payload['aud'] ?? '');
    if (!hash_equals($clientId, $aud)) {
        error_log('google_auth: aud が一致しません aud=' . $aud);
        return null;
    }

    $iss = (string)($payload['iss'] ?? '');
    if (!in_array($iss, GOOGLE_ISSUERS, true)) {
        error_log('google_auth: iss が不正です iss=' . $iss);
        return null;
    }

    // ⚠️ tokeninfo は期限切れをエラーにするが、二重に確認する。
    //   exp は UNIX 秒の文字列で返る。
    $exp = (int)($payload['exp'] ?? 0);
    if ($exp <= time()) {
        error_log('google_auth: 期限切れのトークンです exp=' . $exp);
        return null;
    }

    // ⚠️ tokeninfo は真偽値ではなく文字列 'true' を返す。両方を許容する
    $emailVerified = $payload['email_verified'] ?? '';
    if ($emailVerified !== true && $emailVerified !== 'true') {
        error_log('google_auth: email_verified が true ではありません');
        return null;
    }

    $email = strtolower(trim((string)($payload['email'] ?? '')));
    if ($email === '') {
        error_log('google_auth: email が含まれていません');
        return null;
    }

    // ⚠️ hd（Workspace のドメイン）は任意。GOOGLE_HOSTED_DOMAIN を設定したときだけ確認する。
    //   staff テーブルとの突合が本来の関門であり、hd は多層防御。
    //   設定する前に、全スタッフが Workspace アカウントであることを確認すること。
    //   個人の Gmail で運用している人がいると、設定した瞬間にログインできなくなる。
    $hostedDomain = getenv('GOOGLE_HOSTED_DOMAIN');
    if ($hostedDomain !== false && $hostedDomain !== '') {
        $hd = (string)($payload['hd'] ?? '');
        if ($hd !== $hostedDomain) {
            error_log('google_auth: hd が一致しません hd=' . $hd);
            return null;
        }
    }

    return $email;
}

/**
 * tokeninfo を呼んでペイロードを取り出す。
 *
 * ⚠️ タイムアウトを必ず設定する。
 *   設定しないと Google 側の遅延でログイン画面が固まる。
 */
function fetchTokenInfo(string $idToken): ?array
{
    $url = GOOGLE_TOKENINFO_URL . '?id_token=' . urlencode($idToken);

    $ch = curl_init($url);
    if ($ch === false) {
        error_log('google_auth: curl_init に失敗しました');
        return null;
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 5,
        // ⚠️ 証明書の検証を無効化しないこと。
        //   ここを緩めると中間者が任意のペイロードを返せてしまい、検証の意味が消える。
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        error_log('google_auth: tokeninfo への通信に失敗しました（' . $error . '）');
        return null;
    }

    if ($status !== 200) {
        // 400 は「トークンが不正」。Google 側の障害（5xx）と区別できるようログに残す
        error_log('google_auth: tokeninfo が ' . $status . ' を返しました');
        return null;
    }

    $payload = json_decode((string)$response, true);
    if (!is_array($payload)) {
        error_log('google_auth: tokeninfo の応答がJSONではありません');
        return null;
    }

    return $payload;
}
