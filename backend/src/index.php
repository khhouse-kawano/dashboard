<?php
// db.php が getenv() を使うため、必ずその前に読み込む。
// docker-compose / .htaccess の SetEnv で既に設定済みの場合は何もしない。
require_once __DIR__ . '/core/env.php';

require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/token.php';
require_once __DIR__ . '/core/helpers.php';
require_once __DIR__ . '/core/express_proxy.php';

header("Content-Type: application/json; charset=utf-8");

// $request はクライアントから送られてきた値がそのまま入るため、
// そのままパスに連結すると handlers/ の外のファイルまで読み込まれてしまう
// （例: "../core/token"）。英数字・アンダースコア・ハイフンのみを許可し、
// portal/xxx のようなサブディレクトリ指定だけを例外的に通す。
// ドットを許可しないことで ".." による親ディレクトリ参照を封じている。
if ($request === '' || !preg_match('#^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*$#', $request)) {
    http_response_code(400);
    echo json_encode(
        ['status' => 'error', 'message' => '不正なリクエストです。'],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

// ---------------------------------------------------------------------------
// Express へ移植済みのリクエストは ② VPS へ転送する。
//
// ⚠️ 転送に失敗した場合は何も出力せず false が返り、
//   そのまま下の ① 自身の処理へ進む（自動フォールバック）。
//   ② が落ちてもダッシュボードは止まらない。
//
// 切り戻しは core/express_proxy.php の expressProxyRequests() から
// 該当行を消すだけ。デプロイし直す必要もない。
// ---------------------------------------------------------------------------
if (shouldProxyToExpress($request) && forwardToExpress($data)) {
    exit;
}

$handler = __DIR__ . "/handlers/" . $request . ".php";

// 存在しない場合に PHP の Fatal error をそのまま返すと、
// サーバーの絶対パスが外部に漏れる。JSON で 404 を返す。
if (!is_file($handler)) {
    http_response_code(404);
    echo json_encode(
        ['status' => 'error', 'message' => '該当する処理がありません。'],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

require_once $handler;
