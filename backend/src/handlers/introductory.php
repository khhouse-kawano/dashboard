<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

/**
 * お友達紹介キャンペーンの反響受付。
 *
 * GAS（Gmail 監視スクリプト）が登録通知メールを解析して
 * POST /api/gateway/ { request: 'introductory', ... } で送ってくる。
 * $pdo と $data は core/db.php が用意している。
 *
 * ⚠️ 同じ登録通知メールが1回の登録で5通前後届き（複数の担当者が受信するため）、
 *   さらに GAS の検索条件が `newer_than:1d` なのでトリガーが回るたびに
 *   同じメールが再送される。**GAS 側では重複を防げない**ため、
 *   ここで冪等にすることが唯一の防御になっている。
 *   dedupKey が既にあれば INSERT せず duplicate:true を返す。
 */

// GAS 側の introductoryColumnNameMap の key 名をそのままカラム名にしている。
// 値は VARCHAR の文字数上限（DDL と一致させる）。null は TEXT / DATETIME。
const INTRODUCTORY_COLUMNS = [
    'campaignName'   => 255,
    'referrerType'   => 16,
    'brand'          => 64,
    'registrantName' => 128,
    'registrantKana' => 128,
    'mail'           => 255,
    'companyName'    => 255,
    'postalCode'     => 16,
    'area'           => 255,
    'tel'            => 32,
    'fax'            => 32,
    'mobile'         => 32,
    'mailPermission' => 32,
    'salesStaff'     => 128,
    'friendName'     => 128,
    'friendKana'     => 128,
    'friendTel'      => 32,
    'friendLineId'   => 128,
    'guideStaff'     => 128,
];

// 改行を保持したい複数行カラム（GAS の introductoryMultilineKeys と remarks）
const INTRODUCTORY_TEXT_COLUMNS = ['note', 'remarks'];

/**
 * 1行の値を整える。制御文字はヘッダインジェクションや表示崩れの元になるので落とす。
 * $multiline が true のときだけ改行とタブを残す。
 */
function introductoryClean($value, int $maxLength = 0, bool $multiline = false): string
{
    if (!is_string($value) && !is_numeric($value)) {
        return '';
    }
    $text = (string)$value;

    // 除去対象は C0 制御文字と DEL。$multiline のときは TAB(09) LF(0A) CR(0D) を残す。
    $pattern = $multiline
        ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u'
        : '/[\x00-\x1F\x7F]/u';
    $text = preg_replace($pattern, '', $text);
    if ($text === null) {
        // 不正なUTF-8が混ざると preg_replace が null を返す
        return '';
    }

    $text = trim($text);
    if ($maxLength > 0 && mb_strlen($text, 'UTF-8') > $maxLength) {
        $text = mb_substr($text, 0, $maxLength, 'UTF-8');
    }
    return $text;
}

/**
 * GAS が送ってくる 'YYYY-MM-DD HH:MM:SS' を検証する。
 * 形式が違えば空文字を返し、DB には NULL を入れる。
 */
function introductoryNormalizeRegistered($value): string
{
    $text = introductoryClean($value, 19);
    if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $text)) {
        return '';
    }
    return $text;
}

/**
 * 重複判定キーを作る。
 *
 * ⚠️ registered は「日付まで」しか使えない。
 *   同じ登録に対して届く5通は別メッセージであり、GAS は msg.getDate() から
 *   registered を作るため**秒がずれ得る**。秒を含めると5通が別物と判定される。
 *
 * ⚠️ その副作用として、同じ紹介者が同じお友達を**同じ日に2回**紹介した場合は
 *   1件に畳まれる。実運用では起こらないと判断してこの設計にしている。
 *   将来メール本文に受付番号やリードIDが載ることが分かったら、
 *   GAS 側でそれを送るようにして、この関数をその1項目に差し替えるのが望ましい
 *   （テーブル定義は変更不要）。
 */
function introductoryDedupKey(array $row): string
{
    $day = $row['registered'] === null ? '' : substr($row['registered'], 0, 10);

    $material = implode('|', [
        $row['campaignName'],
        $row['registrantName'],
        $row['mail'],
        $row['friendName'],
        $row['friendTel'],
        $day,
    ]);

    return hash('sha256', $material);
}

function introductoryRespond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------------------------------------------------------------------------
// 受け取り
// ---------------------------------------------------------------------------
$payload = is_array($data) ? $data : [];

$row = [];
foreach (INTRODUCTORY_COLUMNS as $column => $maxLength) {
    $row[$column] = introductoryClean($payload[$column] ?? '', $maxLength);
}
foreach (INTRODUCTORY_TEXT_COLUMNS as $column) {
    $text = introductoryClean($payload[$column] ?? '', 0, true);
    $row[$column] = $text === '' ? null : $text;
}

$registered = introductoryNormalizeRegistered($payload['registered'] ?? '');
$row['registered'] = $registered === '' ? null : $registered;

// GAS 側でも同じチェックをしているが、経路が変わっても壊れないよう二重で持つ。
if ($row['registrantName'] === '' || $row['friendName'] === '') {
    introductoryRespond(400, [
        'status'  => 'error',
        'message' => '紹介者名（registrantName）とお友達氏名（friendName）は必須です。',
    ]);
}

$row['dedupKey'] = introductoryDedupKey($row);

// ---------------------------------------------------------------------------
// 冪等な登録
// ---------------------------------------------------------------------------
try {
    $check = $pdo->prepare('SELECT no FROM inquiry_introductory WHERE dedupKey = ? LIMIT 1');
    $check->execute([$row['dedupKey']]);
    $existingNo = $check->fetchColumn();

    if ($existingNo !== false) {
        // ⚠️ エラーではない。同じメールが複数通・複数回届く前提のため、
        //   平常運用ではこちらのほうが多くなる。
        introductoryRespond(200, [
            'status'    => 'ok',
            'duplicate' => true,
            'no'        => (int)$existingNo,
        ]);
    }

    $columns = array_keys($row);
    $sql = 'INSERT INTO inquiry_introductory (`' . implode('`, `', $columns) . '`) VALUES ('
        . implode(', ', array_fill(0, count($columns), '?')) . ')';

    $insert = $pdo->prepare($sql);
    $insert->execute(array_values($row));

    introductoryRespond(200, [
        'status'    => 'ok',
        'duplicate' => false,
        'no'        => (int)$pdo->lastInsertId(),
    ]);
} catch (PDOException $e) {
    // UNIQUE キー違反。上の SELECT と INSERT の間に別リクエストが入った場合に起きる
    // （5通が同時にPOSTされるため実際に起こり得る）。重複として扱う。
    if ($e->getCode() === '23000') {
        introductoryRespond(200, ['status' => 'ok', 'duplicate' => true]);
    }

    error_log('introductory: ' . $e->getMessage());
    introductoryRespond(500, [
        'status'  => 'error',
        'message' => '紹介反響の登録に失敗しました。',
    ]);
}
