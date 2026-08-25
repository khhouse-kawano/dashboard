<?php

/**
 * APIキーの登録・一覧・失効を行うコマンドラインツール。
 *
 * SSH でサーバーに接続して実行する。
 * スタッフのトークンを一切使わないため、
 * セッショントークンをブラウザ外に持ち出す必要がない。
 * APIキーもネットワークを流れない（サーバー上で入力し、その場で暗号化する）。
 *
 * ─────────────────────────────────────────────
 * 配置場所（重要）
 *   このファイルは **公開ディレクトリの外** に置くこと。
 *   index.php と同じ階層に置くと、URLから実行される危険がある。
 *   （Web経由の実行は下のガードで拒否しているが、そもそも置かないのが確実）
 * ─────────────────────────────────────────────
 *
 * 使い方:
 *   php tools/register-key.php --list
 *   php tools/register-key.php --email=you@example.com --label="メインAPIキー"
 *   php tools/register-key.php --revoke=1
 */

// Web経由での実行を拒否する（万一公開ディレクトリに置かれた場合の保険）
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// ---------------------------------------------------------------------------
// 依存ファイルの読み込み（配置レイアウトの違いを吸収する）
// ---------------------------------------------------------------------------
$candidates = [];

// 明示指定があれば最優先（想定外のレイアウトへの逃げ道）
$explicitCore = getenv('APP_CORE_DIR');
if ($explicitCore !== false && $explicitCore !== '') {
    $candidates[] = $explicitCore;
}

// よくある配置
$candidates[] = __DIR__ . '/../src/core';   // リポジトリの構成（backend/tools → backend/src/core）
$candidates[] = __DIR__ . '/../core';
$candidates[] = __DIR__ . '/core';

// 親ディレクトリ直下を1階層だけ走査する。
// 公開ディレクトリ名は環境によって src / html / public_html などまちまちなため。
foreach (glob(dirname(__DIR__) . '/*/core/crypto.php') ?: [] as $hit) {
    $candidates[] = dirname($hit);
}

$coreDir = null;
foreach ($candidates as $candidate) {
    if (is_file($candidate . '/crypto.php')) {
        $coreDir = $candidate;
        break;
    }
}

if ($coreDir === null) {
    fwrite(STDERR,
        "core/crypto.php が見つかりません。\n"
        . "  このファイルは、core/ を含むディレクトリの隣に置いてください。\n"
        . "  別の場所に置く場合は APP_CORE_DIR で指定できます:\n"
        . "    APP_CORE_DIR=/path/to/core php " . basename(__FILE__) . " --list\n");
    exit(1);
}

require_once $coreDir . '/env.php';
require_once $coreDir . '/crypto.php';
require_once $coreDir . '/anthropic.php';

// ---------------------------------------------------------------------------
// 小さなヘルパー
// ---------------------------------------------------------------------------

/** 画面に表示せずに入力を受け取る（stty が使える環境のみ） */
function promptSecret(string $message): string
{
    fwrite(STDOUT, $message);

    $sttyPath = trim((string)@shell_exec('command -v stty'));
    $canHide  = $sttyPath !== '';
    $original = $canHide ? trim((string)@shell_exec('stty -g')) : '';

    if ($canHide) {
        @shell_exec('stty -echo');
    }

    $value = trim((string)fgets(STDIN));

    if ($canHide) {
        @shell_exec('stty ' . $original);
        fwrite(STDOUT, PHP_EOL);
    }

    return $value;
}

function prompt(string $message): string
{
    fwrite(STDOUT, $message);
    return trim((string)fgets(STDIN));
}

/**
 * エラーを表示して終了する。
 * ※ 戻り値型に never を使わないこと。PHP 8.1 未満で構文エラーになる。
 *   本番のCLIが古いバージョンの場合があるため、このファイルは PHP 7.4 互換で書く。
 */
function fail(string $message): void
{
    fwrite(STDERR, $message . PHP_EOL);
    exit(1);
}

/** str_starts_with の代替（PHP 8.0 未満でも動く） */
function startsWithText(string $haystack, string $needle): bool
{
    return strncmp($haystack, $needle, strlen($needle)) === 0;
}

/** --key=value 形式の引数を取り出す */
function argValue(array $argv, string $name): ?string
{
    $prefix = '--' . $name . '=';
    foreach ($argv as $arg) {
        if (startsWithText($arg, $prefix)) {
            return substr($arg, strlen($prefix));
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// DB接続（core/db.php はWeb用の処理を含むため、ここで独自に接続する）
// ---------------------------------------------------------------------------
$host = getenv('DB_HOST');
$name = getenv('DB_NAME');
$user = getenv('DB_USER');
$pass = getenv('DB_PASS');

if ($host === false || $name === false || $user === false) {
    fail("DB接続情報が取得できません。\n"
       . "  .htaccess の SetEnv は Web経由でのみ有効です。CLI では読まれません。\n"
       . "  backend/.env を用意するか、環境変数を指定して実行してください:\n"
       . "    DB_HOST=... DB_NAME=... DB_USER=... DB_PASS=... php tools/register-key.php --list");
}

try {
    $pdo = new PDO(
        "mysql:host={$host};dbname={$name};charset=utf8mb4",
        $user,
        (string)$pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    fail('DB接続に失敗しました: ' . $e->getMessage());
}

// ---------------------------------------------------------------------------
// --list : 登録済みキーの一覧
// ---------------------------------------------------------------------------
if (in_array('--list', $argv, true)) {
    $rows = $pdo->query(
        'SELECT c.id, c.label, c.key_hint, c.status, c.last_verified_at, s.name AS owner
           FROM api_credential c
           JOIN staff s ON s.id = c.staff_id
          ORDER BY c.id'
    )->fetchAll();

    if (!$rows) {
        echo '登録されているAPIキーはありません。', PHP_EOL;
        exit(0);
    }

    printf("%-4s %-24s %-10s %-10s %-20s %s\n", 'ID', 'ラベル', 'ヒント', '状態', '最終確認', '登録者');
    foreach ($rows as $r) {
        printf("%-4s %-24s %-10s %-10s %-20s %s\n",
            $r['id'], $r['label'], $r['key_hint'], $r['status'],
            $r['last_verified_at'] ?? '-', $r['owner']);
    }
    exit(0);
}

// ---------------------------------------------------------------------------
// --revoke=ID : 失効（論理削除。ログの参照を壊さないため物理削除はしない）
// ---------------------------------------------------------------------------
$revokeId = argValue($argv, 'revoke');
if ($revokeId !== null) {
    $id = (int)$revokeId;
    $row = $pdo->prepare('SELECT id, label, key_hint, status FROM api_credential WHERE id = ?');
    $row->execute([$id]);
    $credential = $row->fetch();

    if (!$credential) {
        fail("id={$id} のAPIキーが見つかりません。");
    }

    echo "対象: id={$credential['id']}  {$credential['label']}  {$credential['key_hint']}  ({$credential['status']})", PHP_EOL;
    if (strtolower(prompt('失効させますか? (y/n): ')) !== 'y') {
        echo '中止しました。', PHP_EOL;
        exit(0);
    }

    $pdo->prepare("UPDATE api_credential SET status = 'revoked' WHERE id = ?")->execute([$id]);
    echo '失効しました。', PHP_EOL;
    exit(0);
}

// ---------------------------------------------------------------------------
// 登録
// ---------------------------------------------------------------------------
echo PHP_EOL, '=== Anthropic APIキーの登録 ===', PHP_EOL, PHP_EOL;

// --- 1. 登録者 ---------------------------------------------------------
$email = argValue($argv, 'email') ?? prompt('[1/4] 登録者のメールアドレス: ');
if ($email === '') {
    fail('メールアドレスが指定されていません。');
}

$stmt = $pdo->prepare('SELECT id, name, brand FROM staff WHERE mail = ? LIMIT 1');
$stmt->execute([$email]);
$staff = $stmt->fetch();

if (!$staff) {
    fail("staff テーブルに {$email} が見つかりません。");
}
if ($staff['brand'] !== 'Master') {
    fail("{$staff['name']} の権限は {$staff['brand']} です。APIキーの登録は Master のみ行えます。");
}
echo "      OK  {$staff['name']}（{$staff['brand']}）", PHP_EOL, PHP_EOL;

// --- 2. ラベル ---------------------------------------------------------
$label = argValue($argv, 'label') ?? prompt('[2/4] ラベル（用途がわかる名前）: ');
if ($label === '') {
    fail('ラベルが指定されていません。');
}

// --- 3. APIキー --------------------------------------------------------
echo PHP_EOL;
$apiKey = promptSecret('[3/4] APIキー（入力は表示されません）: ');

if ($apiKey === '') {
    fail('APIキーが入力されませんでした。');
}
if (!startsWithText($apiKey, 'sk-ant-')) {
    fail('Anthropic のAPIキーは "sk-ant-" で始まります。値を確認してください。');
}

$hint        = secretHint($apiKey);
$fingerprint = secretFingerprint($apiKey);
echo '      読み取り: sk-ant-…', substr($apiKey, -4), '（全 ', strlen($apiKey), " 文字）", PHP_EOL;

// 重複チェック
$stmt = $pdo->prepare(
    'SELECT c.id, s.name AS owner FROM api_credential c
       JOIN staff s ON s.id = c.staff_id
      WHERE c.provider = ? AND c.key_fingerprint = ? LIMIT 1'
);
$stmt->execute(['anthropic', $fingerprint]);
if ($duplicate = $stmt->fetch()) {
    fail("このAPIキーは既に登録されています（id={$duplicate['id']}, 登録者: {$duplicate['owner']}）。");
}

if (strtolower(prompt('      この内容で登録しますか? (y/n): ')) !== 'y') {
    echo '中止しました。', PHP_EOL;
    exit(0);
}

// --- 保存 --------------------------------------------------------------
try {
    $encrypted = encryptSecret($apiKey);
} catch (Throwable $e) {
    fail('暗号化に失敗しました: ' . $e->getMessage()
       . PHP_EOL . '  APP_ENCRYPTION_KEY が設定されているか確認してください。');
}

$pdo->prepare(
    'INSERT INTO api_credential
         (staff_id, provider, label, key_ciphertext, key_iv, key_tag, key_version, key_hint, key_fingerprint)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
)->execute([
    $staff['id'], 'anthropic', $label,
    $encrypted['ciphertext'], $encrypted['iv'], $encrypted['tag'], $encrypted['version'],
    $hint, $fingerprint,
]);

$credentialId = (int)$pdo->lastInsertId();
echo "      登録しました  id={$credentialId}", PHP_EOL;

// --- 4. 有効性の確認（トークン消費なし＝課金なし）------------------------
echo PHP_EOL, '[4/4] Anthropic に接続して有効性を確認しています...', PHP_EOL;

$result = anthropicVerifyKey($apiKey);
unset($apiKey);

$pdo->prepare(
    'INSERT INTO ai_usage_log (credential_id, staff_id, feature, model, status, error_message, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
)->execute([
    $credentialId, $staff['id'], 'credential_verify', '-',
    $result['ok'] ? 'ok' : 'error', $result['error'], $result['duration_ms'],
]);

echo PHP_EOL;
if ($result['ok']) {
    $pdo->prepare("UPDATE api_credential SET status = 'active', last_verified_at = NOW() WHERE id = ?")
        ->execute([$credentialId]);
    echo "登録完了。APIキーは有効です（{$result['duration_ms']} ms）", PHP_EOL;
    echo "  id={$credentialId}  label={$label}  hint={$hint}", PHP_EOL;
} else {
    if ($result['status'] === 401 || $result['status'] === 403) {
        $pdo->prepare("UPDATE api_credential SET status = 'invalid' WHERE id = ?")->execute([$credentialId]);
    }
    echo '登録はされましたが、検証に失敗しました。', PHP_EOL;
    echo '  ', $result['error'], PHP_EOL;
    echo "  登録し直す場合: php tools/register-key.php --revoke={$credentialId}", PHP_EOL;
    exit(1);
}

echo PHP_EOL;
