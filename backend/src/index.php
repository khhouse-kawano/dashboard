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
$proxyData = is_array($data) ? $data : [];

if (shouldProxyToExpress($request, $proxyData)) {
    if (forwardToExpress($data)) {
        exit;
    }

    // ⚠️⚠️ **書き込み系は ① で実行してはいけない。**
    //
    //   ② が処理を完了した直後に応答が失われた場合、ここで ① の PHP を
    //   動かすと二重登録・二重更新になる。転送できなかったのか、
    //   処理済みで応答だけ失われたのかは呼び出し側から区別できない。
    //   そのため「実行しない」を選び、502 を返して利用者に再操作を委ねる。
    //
    // ⚠️ フロント（apiClient）は 5xx を例外として扱う。
    //   保存ボタンを押した利用者にはエラーが見える。黙って失敗しない。
    //
    // ⚠️ 障害時の切り戻しは core/express_proxy.php の
    //   expressProxyExclusive() から該当行を消すだけ。
    //   消せば ① 自身の PHP が処理する（PHPハンドラは残してある）。
    if (isExclusiveToExpress($request, $proxyData)) {
        error_log("express_proxy: {$request} は転送専用のため ① では処理しません（502）");
        http_response_code(502);
        echo json_encode(
            [
                'status' => 'error',
                'message' => '保存処理に接続できませんでした。時間をおいて再度お試しください。',
            ],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
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
