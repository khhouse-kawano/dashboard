<?php

/**
 * .env ファイルを読み込んで環境変数に展開する。
 *
 * 各環境で「誰が環境変数を設定するか」が異なるため、その差を吸収する。
 *
 *   ローカル(Docker) : docker-compose.yml の env_file / environment が設定する
 *   本番(XServer)    : .htaccess の SetEnv が設定する
 *   どちらも無い場合  : このファイルが .env を読んで補う
 *
 * **既に設定済みの値は上書きしない。**
 * そのため、このファイルを追加してもローカル・本番の既存の挙動は変わらない。
 *
 * ─────────────────────────────────────────────
 * 置き場所について（重要）
 *   .env は必ず **公開ディレクトリの外** に置くこと。
 *   このプロジェクトでは src/ がドキュメントルートなので、その1つ上
 *   （= backend/.env）が正しい位置になる。
 *   src/.env に置くと https://.../.env でマスターキーが読めてしまう。
 * ─────────────────────────────────────────────
 */

/**
 * .env 形式のファイルを読み、未設定のキーだけを環境変数に入れる。
 *
 * @return int 実際に設定したキーの数
 */
function loadEnvFile(string $path): int
{
    if (!is_file($path) || !is_readable($path)) {
        return 0;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return 0;
    }

    $loaded = 0;

    foreach ($lines as $line) {
        // Windows で作成された場合の CR と、先頭のBOMを取り除く
        $line = trim($line, " \t\r\n\0\x0B");
        $line = ltrim($line, "\xEF\xBB\xBF");

        if ($line === '' || $line[0] === '#') {
            continue;
        }

        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }

        $key   = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));

        // 想定外のキー名は無視する（不正な行での事故を防ぐ）
        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $key)) {
            continue;
        }

        // 値が引用符で囲まれていれば外す
        $length = strlen($value);
        if ($length >= 2) {
            $quote = $value[0];
            if (($quote === '"' || $quote === "'") && $value[$length - 1] === $quote) {
                $value = substr($value, 1, -1);
            }
        }

        // 既に設定されている場合は尊重する（compose / SetEnv が優先）
        if (getenv($key) !== false) {
            continue;
        }

        putenv($key . '=' . $value);
        $_ENV[$key]    = $value;
        $_SERVER[$key] = $value;
        $loaded++;
    }

    return $loaded;
}

/**
 * 既定の探索場所から .env を読み込む。
 *
 * APP_ENV_FILE が設定されていればそのパスを最優先で使う。
 */
function bootstrapEnv(): void
{
    $explicit = getenv('APP_ENV_FILE');
    if ($explicit !== false && $explicit !== '') {
        loadEnvFile($explicit);
        return;
    }

    $candidates = [
        // 推奨: ドキュメントルートの1つ上（= backend/.env）
        dirname(__DIR__, 2) . '/.env',
        // 互換: ドキュメントルート直下（非推奨。Web公開される危険がある）
        dirname(__DIR__) . '/.env',
    ];

    foreach ($candidates as $path) {
        if (loadEnvFile($path) > 0) {
            return;
        }
    }
}

bootstrapEnv();
