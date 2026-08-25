<?php

/**
 * 秘密情報（外部APIキー等）の暗号化・復号。
 *
 * 方式: AES-256-GCM
 *   - 「認証付き暗号」と呼ばれる方式で、復号時に改ざんを検知できる。
 *   - 暗号化のたびに IV（初期化ベクトル）をランダム生成するため、
 *     同じ平文でも毎回異なる暗号文になる。IV の使い回しは厳禁。
 *
 * マスターキー: 環境変数 APP_ENCRYPTION_KEY（base64された32バイト）
 *   - docker-compose.yml の env_file 経由で backend/.env から読み込む。
 *   - この値が漏れると保存済みの全キーが復号可能になる。
 *   - 紛失すると保存済みの全キーが復号不能になる（再登録が必要）。
 */

const CRYPTO_CIPHER     = 'aes-256-gcm';
const CRYPTO_KEY_LENGTH = 32; // AES-256 は 256bit = 32バイト
const CRYPTO_IV_LENGTH  = 12; // GCM の推奨値
const CRYPTO_TAG_LENGTH = 16; // 認証タグ

/**
 * 現在使用すべきマスターキーの世代を返す。
 */
function cryptoCurrentKeyVersion(): int
{
    $version = getenv('APP_KEY_VERSION');
    return ($version === false || $version === '') ? 1 : (int)$version;
}

/**
 * 指定世代のマスターキーを取得する（復号した32バイトのバイナリ）。
 *
 * 世代1は APP_ENCRYPTION_KEY、世代2以降は APP_ENCRYPTION_KEY_V2 … を参照する。
 * 将来マスターキーを交換する際、古い世代で暗号化されたデータも
 * 復号できるようにするための仕組み。
 *
 * @throws RuntimeException 未設定または長さが不正な場合
 */
function cryptoMasterKey(int $version): string
{
    $envName = ($version === 1)
        ? 'APP_ENCRYPTION_KEY'
        : 'APP_ENCRYPTION_KEY_V' . $version;

    $encoded = getenv($envName);
    if ($encoded === false || $encoded === '') {
        throw new RuntimeException(
            "暗号化マスターキー {$envName} が設定されていません。backend/.env を確認してください。"
        );
    }

    $raw = base64_decode($encoded, true);
    if ($raw === false || strlen($raw) !== CRYPTO_KEY_LENGTH) {
        throw new RuntimeException(
            "{$envName} は base64 された " . CRYPTO_KEY_LENGTH . " バイトである必要があります。"
        );
    }

    return $raw;
}

/**
 * 秘密情報を暗号化する。
 *
 * @return array{ciphertext:string, iv:string, tag:string, version:int}
 *         いずれも base64 文字列（version のみ整数）。DBの各列にそのまま入れる。
 * @throws RuntimeException
 */
function encryptSecret(string $plain): array
{
    if ($plain === '') {
        throw new InvalidArgumentException('空の文字列は暗号化できません。');
    }

    $version = cryptoCurrentKeyVersion();
    $key     = cryptoMasterKey($version);
    $iv      = random_bytes(CRYPTO_IV_LENGTH); // 毎回新しく生成すること
    $tag     = '';

    $cipher = openssl_encrypt(
        $plain,
        CRYPTO_CIPHER,
        $key,
        OPENSSL_RAW_DATA,
        $iv,
        $tag,
        '',                  // AAD（今回は未使用）
        CRYPTO_TAG_LENGTH
    );

    if ($cipher === false) {
        // 平文は絶対にメッセージに含めないこと
        throw new RuntimeException('暗号化に失敗しました: ' . openssl_error_string());
    }

    return [
        'ciphertext' => base64_encode($cipher),
        'iv'         => base64_encode($iv),
        'tag'        => base64_encode($tag),
        'version'    => $version,
    ];
}

/**
 * 暗号化された秘密情報を復号する。
 *
 * 復号した平文はメモリ上でのみ使い、DBやログには絶対に書かないこと。
 *
 * @throws RuntimeException マスターキー不一致・改ざん・データ破損の場合
 */
function decryptSecret(string $ciphertextB64, string $ivB64, string $tagB64, int $version): string
{
    $key    = cryptoMasterKey($version);
    $cipher = base64_decode($ciphertextB64, true);
    $iv     = base64_decode($ivB64, true);
    $tag    = base64_decode($tagB64, true);

    if ($cipher === false || $iv === false || $tag === false) {
        throw new RuntimeException('保存されている暗号データが壊れています（base64デコード失敗）。');
    }
    if (strlen($iv) !== CRYPTO_IV_LENGTH) {
        throw new RuntimeException('IV の長さが不正です。');
    }
    if (strlen($tag) !== CRYPTO_TAG_LENGTH) {
        throw new RuntimeException('認証タグの長さが不正です。');
    }

    $plain = openssl_decrypt(
        $cipher,
        CRYPTO_CIPHER,
        $key,
        OPENSSL_RAW_DATA,
        $iv,
        $tag
    );

    if ($plain === false) {
        // GCM はここで改ざんも検知する。原因を切り分けられるようメッセージを分けておく
        throw new RuntimeException(
            '復号に失敗しました。マスターキーが違うか、データが改ざんされている可能性があります。'
        );
    }

    return $plain;
}

/**
 * 重複登録の検出用フィンガープリント。
 *
 * APIキーは元々エントロピーが高いため、ペッパーなしの SHA-256 で十分。
 * HMAC にするとマスターキー交換時に値が変わり、UNIQUE 制約が壊れる。
 */
function secretFingerprint(string $plain): string
{
    return hash('sha256', $plain);
}

/**
 * 画面表示用のヒント。全体は絶対に返さない。
 * 例: sk-ant-api03-....a3f9 → "…a3f9"
 */
function secretHint(string $plain): string
{
    return '…' . substr($plain, -4);
}
