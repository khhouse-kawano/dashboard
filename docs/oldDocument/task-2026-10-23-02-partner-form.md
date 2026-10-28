# 協力業者様募集フォームの迷惑送信対策と見た目の作り直し（Dashboard とは別件・ブランチなし）

## 依頼
- ダウンロードフォルダの partner（協力業者様募集フォーム）の改修
- 「【国分ハウジング】協力業者様募集フォームからのお問い合わせ」が大量に届く。どうにかできないか
- 見た目を form_get 風に

## 原因
届いていたのは脆弱性スキャナー（自動送信）の試し打ち（郵便番号に `(select 198766*667891 from DUAL)` など）。
以前のフォームは次の状態だった。
- 機械かどうかを見分ける仕組みが無い（フォームを開かずに thanks.php へ直接送れる）
- 入力した値をそのまま HTML メールに入れていた（メールの中でタグが動く）
- 入力されたアドレスへ確認メールを送るので、他人宛てのメールの踏み台にもなり得た

## 対策（lib.php）
| # | 確かめること | 当たったとき |
|---|---|---|
| 1 | 見えない入力欄（`website_url`）が空 | 完了画面だけ出す・送らない |
| 2 | index.php が発行した使い捨ての合い言葉と一致 | 同上 |
| 3 | フォームを開いてから 5秒以上 | 同上 |
| 4 | 同じ IP から 10分に 5回まで（入力ミスで戻った分も数える） | 同上 |
| 5 | 1時間以内・セッションが切れていない | **入れた値を持ってフォームへ戻し、もう一度送ってもらう**（人の問い合わせを黙って捨てない） |
| 6 | 形：かな（ひらがな・カタカナ）・電話（0始まり10〜11桁）・メール・郵便番号（7桁）・長さ・1行の項目に改行が無い | エラーを出してフォームへ戻す |
- メールは文字だけ（UTF-8・mb_send_mail）。管理者宛てに送信日時（日本時間）と送信元 IP を足した
- 確認メールは 1〜6 をすべて通ったときだけ
- 弾いた送信はサーバーのエラーログに理由を残す（`partner form: 機械の送信として送らなかった reason=…`）

## 見た目（form_get の publicForm.css の写し → form.css）
- 「1 入力 → 2 確認 → 3 完了」、カード（貴社情報・ご連絡先・所在地・ご用件）、必須の印、欄の下の赤いエラー
- 郵便番号から「住所を検索」（form_get と同じ zipcloud）
- 確認画面は同じページの中で切り替え。入力画面で Enter を押しても確認を飛ばさない
- スマホでは説明文を左寄せ（言葉の途中で折れないように）

## ファイル（C:\Users\shinji-kawano\Downloads\partner）
| ファイル | 内容 |
|---|---|
| index.php（新規。旧 index.html の代わり） | 入力・確認。合い言葉の発行 |
| thanks.php（作り直し） | 送信先（確かめて送る → 完了画面へ）と完了画面 |
| lib.php（新規） | 共通処理。直接開くと 404 |
| form.css（新規） | 見た目 |
| _original/index.html・thanks.php | 元のファイル（戻すとき用） |

関数：`partnerFields` `h` `partnerStartSession` `partnerToHalfWidth` `partnerNormalize` `partnerValidate` `partnerIssueToken` `partnerBotReason` `partnerBackToForm` `partnerRateLimited` `partnerSendMail` `partnerSummaryText` `partnerSendMails`

## アップロード手順（フォームを置いているサーバー）
1. ⚠️ 今のフォームのフォルダのファイルを手元に残す（戻すとき用。_original と同じはず）
2. `index.php` `thanks.php` `lib.php` `form.css` の4つをアップロード
3. ⚠️ **サーバーの `index.html` を消す（または名前を変える）**。残っていると古いフォームが先に開く
4. フォームを開き、自分のアドレスで1回送る → 管理者宛てと確認メールの2通が届くこと・文字化けしないこと
   - ⚠️ 開いてから5秒以内に送ると、送ったように見えて届かない（機械よけ）。確認画面を見てから送れば5秒は過ぎる
5. 戻すとき：_original の2ファイルを置き直し、index.php・lib.php・form.css を消す

> 注意：人が手で入れるいたずらまでは止められない。それでも届くなら、次は Cloudflare Turnstile（無料。登録とキーの発行が要る）。

## 確かめたこと（PHP 8.0 の組み込みサーバー。メールはファイルに書き出して確認）
- 届いたメールと同じ中身を直接送る → 送らない（完了画面だけ）
- 見えない欄あり／5秒未満／合い言葉の使い回し → 送らない
- 合い言葉は正しいがスキャナーの中身 → フォームへ戻る（かな・電話・郵便番号のエラー）。戻した値はエスケープされる（`<script>` は文字のまま）
- 正しい送信 → 2通（文字だけ。`<b>` は文字のまま）。完了画面に「貴社名 担当者 様」。再読み込みでフォームへ
- 同じ IP から6回目 → 送らない（5回分の10通だけ）
- セッション切れ → 送らずに、入れた値と「時間がたったため…」を出してフォームへ
- lib.php を直接開く → 404。thanks.php を直接開く → フォームへ
- 画面（Playwright・スマホ 390px／PC 1280px）：空のまま確認 → 8項目のエラー、住所検索、Enter で確認へ、戻る（値が残る）、送信 → 完了、横スクロールなし、JS のエラーなし

## コード

⚠️ 2026-10-23 なごみ版を作るときに、ブランドごとの値を lib.php の先頭に集めた（task-2026-10-23-03）。以下はその後の中身。

### lib.php
```php
<?php
/**
 * 協力業者様募集フォーム（index.php ／ thanks.php）の共通処理。
 *
 * ⚠️ 迷惑な送信（脆弱性スキャナーなどの自動送信）を止めるため、次の順で確かめる。
 *   1. 見えない入力欄（ハニーポット）に値が無い
 *   2. index.php が発行した使い捨ての合い言葉と一致する（フォームを開かずに直接送られたものを断る）
 *   3. フォームを開いてから 5秒以上・1時間以内
 *   4. 同じ IP からの送信が 10分に 5回まで
 *   → 1〜4 に当たったものは「機械」とみなし、完了画面だけ出してメールは送らない（弾いたことを知らせない）
 *   5. 項目の形（かな・郵便番号・電話・メール・長さ・改行の混入）
 *   → 5 に当たったものは人の入力間違いとみなし、フォームへ戻してエラーを出す
 * ⚠️ メールは文字だけ（HTML にしない）。入力した値がメールの中で動かないように。
 */

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    http_response_code(404);
    exit;
}

// ⚠️ 管理者宛てメールの送信日時を日本時間にする（サーバーの設定に左右されないように）
date_default_timezone_set('Asia/Tokyo');

// ---------------------------------------------------------------------------
// ⚠️⚠️ ブランドごとに違うのはここだけ（partner＝国分ハウジング／partner_nagomi＝なごみ工務店）。
//   ⚠️ それ以外のファイル（index.php・thanks.php・form.css・この下）は2つのフォームで同じ中身にしておくこと。
// ---------------------------------------------------------------------------
const PARTNER_BRAND = '国分ハウジング';
/** 管理者宛てメールの件名・本文の頭 */
const PARTNER_SUBJECT_TAG = '【国分ハウジング】';
const PARTNER_LOGO = 'https://kh-house.jp/wp-content/themes/kokubu/img/common/imgHeaderLogo.png?221028';
const PARTNER_TOP_URL = 'https://kh-house.jp/';
/** 差し色（form_get の src/api/brands.ts の brandAccent と同じ） */
const PARTNER_ACCENT = '#0f3675';
const PARTNER_COMPANY_EXAMPLE = '例）株式会社国分ハウジング';
// ---------------------------------------------------------------------------

const PARTNER_MAIL_FROM = 'partner@nagomi-koumuten.jp';
const PARTNER_MAIL_TO = 'mkt@kh-house.jp,marketing@kh-group.jp';
const PARTNER_MIN_SECONDS = 5;
const PARTNER_MAX_SECONDS = 3600;
/** ⚠️ 入力の間違いで戻った送信も数えるので、人が2〜3回直しても止まらない数にする */
const PARTNER_RATE_LIMIT = 5;
const PARTNER_RATE_WINDOW = 600;
/** ⚠️ 見えない入力欄の名前。⚠️ 人が使いそうな名前にしない（ブラウザの自動入力で埋まらないように） */
const PARTNER_HONEYPOT = 'website_url';

/** 項目の定義（並び順＝確認画面・メールの順） */
function partnerFields(): array
{
    return [
        'company' => ['label' => '貴社名', 'max' => 100],
        'name'    => ['label' => 'ご担当者様', 'max' => 50],
        'kana'    => ['label' => 'ご担当者様（かな）', 'max' => 50],
        'phone'   => ['label' => '電話番号', 'max' => 20],
        'mail'    => ['label' => 'メールアドレス', 'max' => 254],
        'zip'     => ['label' => '郵便番号', 'max' => 20],
        'address' => ['label' => '住所', 'max' => 200],
        'demand'  => ['label' => 'お問い合わせ内容', 'max' => 2000],
    ];
}

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function partnerStartSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    // ⚠️ 既定（24分）だと、入力に時間がかかった人のセッションが切れやすい。合い言葉の期限（1時間）に合わせる
    ini_set('session.gc_maxlifetime', (string)PARTNER_MAX_SECONDS);
    session_name('partner_form');
    session_start();
}

/** 全角の英数字・記号を半角に */
function partnerToHalfWidth(string $value): string
{
    return mb_convert_kana($value, 'a', 'UTF-8');
}

/** 送られた値を整える（前後の空白を除く。電話・郵便番号は半角にしてハイフン等を除く） */
function partnerNormalize(array $post): array
{
    $values = [];
    foreach (array_keys(partnerFields()) as $key) {
        $raw = $post[$key] ?? '';
        $values[$key] = is_string($raw) ? trim(str_replace("\r\n", "\n", $raw)) : '';
    }
    $values['phone'] = preg_replace('/[\s\-‐－ー―()（）]/u', '', partnerToHalfWidth($values['phone'])) ?? '';
    $values['zip'] = preg_replace('/[\s\-‐－ー―〒]/u', '', partnerToHalfWidth($values['zip'])) ?? '';
    $values['mail'] = partnerToHalfWidth($values['mail']);
    return $values;
}

/** 項目の形を確かめる。⚠️ 戻り値は [項目 => エラー文]（空なら通過） */
function partnerValidate(array $v): array
{
    $errors = [];
    foreach (partnerFields() as $key => $field) {
        if ($v[$key] === '') {
            $errors[$key] = $field['label'] . 'を入力してください';
        } elseif (!in_array($key, ['phone', 'zip'], true) && mb_strlen($v[$key], 'UTF-8') > $field['max']) {
            // ⚠️ 電話・郵便番号は下の「形」で確かめる（長さのエラーより直し方が分かる）
            $errors[$key] = $field['max'] . '文字以内で入力してください';
        } elseif ($key !== 'demand' && preg_match('/[\x00-\x1F\x7F]/', $v[$key])) {
            // ⚠️ 1行の項目に改行・制御文字があるのは機械の送信（メールのヘッダー差し込みの手口）
            $errors[$key] = '正しく入力してください';
        }
    }
    if (!isset($errors['kana']) && !preg_match('/^[ぁ-ゖァ-ヺー・\s　]+$/u', $v['kana'])) {
        $errors['kana'] = 'ひらがな・カタカナで入力してください';
    }
    if (!isset($errors['phone']) && !preg_match('/^0\d{9,10}$/', $v['phone'])) {
        $errors['phone'] = '0から始まる10〜11桁の番号を入力してください';
    }
    if (!isset($errors['mail']) && !filter_var($v['mail'], FILTER_VALIDATE_EMAIL)) {
        $errors['mail'] = '正しいメールアドレスを入力してください';
    }
    if (!isset($errors['zip']) && !preg_match('/^\d{7}$/', $v['zip'])) {
        $errors['zip'] = '7桁の数字で入力してください';
    }
    if (!isset($errors['demand']) && preg_match('/[\x00-\x09\x0B-\x1F\x7F]/', $v['demand'])) {
        $errors['demand'] = '正しく入力してください';
    }
    return $errors;
}

/** 使い捨ての合い言葉を発行する（index.php を開くたび） */
function partnerIssueToken(): string
{
    $token = bin2hex(random_bytes(32));
    $_SESSION['partner_token'] = ['value' => $token, 'issued' => time()];
    return $token;
}

/**
 * 機械の送信かどうか（1〜3）。⚠️ 合い言葉はここで必ず消す（使い捨て）。
 * ⚠️ 戻り値は理由（空なら人）
 */
function partnerBotReason(array $post): string
{
    $issued = $_SESSION['partner_token'] ?? null;
    unset($_SESSION['partner_token']);

    $honeypot = $post[PARTNER_HONEYPOT] ?? '';
    if (!is_string($honeypot) || $honeypot !== '') {
        return 'honeypot';
    }
    $token = $post['token'] ?? '';
    if (!is_string($token) || !preg_match('/^[0-9a-f]{64}$/', $token)) {
        return 'token';
    }
    // ⚠️⚠️ 合い言葉の形は正しいのにセッションに無い＝入力に時間がかかってセッションが切れた人かもしれない。
    //   ⚠️ 機械として黙って捨てると人の問い合わせが消えるので、'expired'（入れた値を持ってフォームへ戻す）にする。
    if (!is_array($issued)) {
        return 'expired';
    }
    if (!hash_equals((string)$issued['value'], $token)) {
        return 'token';
    }
    $elapsed = time() - (int)$issued['issued'];
    if ($elapsed < PARTNER_MIN_SECONDS) {
        return 'too_fast';
    }
    if ($elapsed > PARTNER_MAX_SECONDS) {
        return 'expired';
    }
    return '';
}

/** 入れた値とエラーを持ってフォームへ戻す（⚠️ 長すぎる値は切ってから持つ。セッションを膨らませない） */
function partnerBackToForm(array $values, array $errors): void
{
    $old = [];
    foreach (partnerFields() as $key => $field) {
        $old[$key] = mb_substr($values[$key], 0, $field['max'], 'UTF-8');
    }
    $_SESSION['partner_flash'] = ['errors' => $errors, 'old' => $old];
    header('Location: ./index.php', true, 303);
    exit;
}

/**
 * 同じ IP からの送信の回数を数え、上限を超えたら true。⚠️ 機械の送信も数える。
 * ⚠️ 記録はサーバーの一時フォルダの1ファイル（IP は sha256 にして残す）。
 */
function partnerRateLimited(): bool
{
    $ip = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? ''));
    $path = sys_get_temp_dir() . '/partner_form_rate.json';
    $fp = @fopen($path, 'c+');
    if ($fp === false) {
        error_log('partner form: 送信回数の記録ファイルを開けません');
        return false;
    }
    flock($fp, LOCK_EX);
    $data = json_decode((string)stream_get_contents($fp), true);
    $data = is_array($data) ? $data : [];
    $now = time();
    foreach ($data as $key => $times) {
        $data[$key] = array_values(array_filter((array)$times, fn($t) => $now - (int)$t < PARTNER_RATE_WINDOW));
        if (!$data[$key]) {
            unset($data[$key]);
        }
    }
    $limited = count($data[$ip] ?? []) >= PARTNER_RATE_LIMIT;
    $data[$ip][] = $now;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $limited;
}

/** 文字だけのメールを送る（件名・本文とも UTF-8） */
function partnerSendMail(string $to, string $subject, string $body): bool
{
    mb_language('uni');
    mb_internal_encoding('UTF-8');
    $headers = 'From: ' . PARTNER_MAIL_FROM;
    return mb_send_mail($to, $subject, $body, $headers);
}

/** 入力内容を「見出し：値」で並べる（メール用） */
function partnerSummaryText(array $v): string
{
    $lines = [];
    foreach (partnerFields() as $key => $field) {
        $value = $key === 'zip' ? substr($v[$key], 0, 3) . '-' . substr($v[$key], 3) : $v[$key];
        $lines[] = $field['label'] . '：' . ($key === 'demand' ? "\n" . $value : $value);
    }
    return implode("\n", $lines);
}

function partnerSendMails(array $v): void
{
    $summary = partnerSummaryText($v);
    $adminBody = PARTNER_SUBJECT_TAG . "協力業者様募集のお問い合わせを受け付けました。\n\n"
        . "お問い合わせ内容は以下となります。\n\n" . $summary . "\n\n"
        . "----\n送信日時：" . date('Y/m/d H:i:s') . "\n送信元IP：" . ($_SERVER['REMOTE_ADDR'] ?? '') . "\n";
    if (!partnerSendMail(PARTNER_MAIL_TO, PARTNER_SUBJECT_TAG . '協力業者様募集フォームからのお問い合わせ', $adminBody)) {
        error_log('partner form: 管理者宛てのメールを送れませんでした');
    }

    $thanksBody = $v['company'] . "\n" . $v['name'] . " 様\n\n"
        . "協力業者様募集のお問い合わせを受け付けました。\n\n"
        . "お問い合わせ内容は以下となります。\n\n" . $summary . "\n\n"
        . "このたびはお問い合わせいただき、誠にありがとうございます。\n"
        . "お問い合わせ内容を確認したうえで担当よりご連絡を差し上げる場合がございますので、その際は何卒宜しくお願い申し上げます。\n"
        . "※こちらのメールへの返信はできませんので予めご了承ください。\n";
    if (!partnerSendMail($v['mail'], 'お問い合わせありがとうございます。【国分ハウジンググループ】', $thanksBody)) {
        error_log('partner form: お客様宛てのメールを送れませんでした');
    }
}
```

### index.php
```php
<?php
/**
 * 協力業者様募集フォーム（入力 → 確認）。送信先は thanks.php。
 * ⚠️ 開くたびに使い捨ての合い言葉を発行する（lib.php の partnerIssueToken）。⚠️ だから index.html ではなく PHP。
 * ⚠️ 入力の間違いで thanks.php から戻ってきたときは、入れた値とエラーを出し直す。
 */
require __DIR__ . '/lib.php';

partnerStartSession();
header('Cache-Control: no-store');
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');

$flash = $_SESSION['partner_flash'] ?? ['errors' => [], 'old' => []];
unset($_SESSION['partner_flash']);
$errors = $flash['errors'];
$old = $flash['old'];
$token = partnerIssueToken();

$value = fn(string $key): string => h((string)($old[$key] ?? ''));
$invalid = fn(string $key): string => isset($errors[$key]) ? ' data-invalid="1"' : '';
$error = fn(string $key): string => h((string)($errors[$key] ?? ''));
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <title>協力業者様募集｜<?= h(PARTNER_BRAND) ?></title>
    <link rel="stylesheet" href="form.css">
</head>
<body>
<main class="pf" style="--pf-accent: <?= h(PARTNER_ACCENT) ?>">
    <div class="pf-logo"><img src="<?= h(PARTNER_LOGO) ?>" alt="<?= h(PARTNER_BRAND) ?>"></div>
    <ol class="pf-steps" aria-label="お申し込みの流れ">
        <li aria-current="step" data-step="input"><span class="pf-step-num">1</span>入力</li>
        <li data-step="confirm"><span class="pf-step-num">2</span>確認</li>
        <li><span class="pf-step-num">3</span>完了</li>
    </ol>
    <h1 class="pf-title">協力業者様募集</h1>
    <p class="pf-lead">弊社ホームページをご覧いただき、誠にありがとうございます。<br>弊社では、協力業者様を募集しております。<br>ご興味のある方は、下記のフォームよりお申し込みください。</p>

    <form id="pf-form" action="./thanks.php" method="post" novalidate>
        <input type="hidden" name="token" value="<?= h($token) ?>">
        <div class="pf-trap" aria-hidden="true">
            <label>この欄は空のままにしてください<input type="text" name="<?= PARTNER_HONEYPOT ?>" value="" tabindex="-1" autocomplete="off"></label>
        </div>

        <div id="pf-input">
            <?php if (isset($errors['_form'])): ?>
                <p class="pf-alert" role="alert"><?= h($errors['_form']) ?></p>
            <?php elseif ($errors): ?>
                <p class="pf-alert" role="alert">入力内容をご確認ください。</p>
            <?php endif; ?>

            <section class="pf-card" aria-labelledby="pf-company">
                <h2 class="pf-card-title" id="pf-company">貴社情報</h2>
                <div class="pf-field"<?= $invalid('company') ?>>
                    <label class="pf-label" for="company">貴社名<span class="pf-badge pf-badge-req">必須</span></label>
                    <input id="company" name="company" type="text" class="pf-input" autocomplete="organization" maxlength="100" placeholder="<?= h(PARTNER_COMPANY_EXAMPLE) ?>" value="<?= $value('company') ?>">
                    <p class="pf-error" data-error="company"><?= $error('company') ?></p>
                </div>
                <div class="pf-field"<?= $invalid('name') ?>>
                    <label class="pf-label" for="name">ご担当者様<span class="pf-badge pf-badge-req">必須</span></label>
                    <input id="name" name="name" type="text" class="pf-input" autocomplete="name" maxlength="50" placeholder="例）国分 太郎" value="<?= $value('name') ?>">
                    <p class="pf-error" data-error="name"><?= $error('name') ?></p>
                </div>
                <div class="pf-field"<?= $invalid('kana') ?>>
                    <label class="pf-label" for="kana">ご担当者様（かな）<span class="pf-badge pf-badge-req">必須</span></label>
                    <input id="kana" name="kana" type="text" class="pf-input" maxlength="50" placeholder="例）こくぶ たろう" value="<?= $value('kana') ?>">
                    <p class="pf-error" data-error="kana"><?= $error('kana') ?></p>
                </div>
            </section>

            <section class="pf-card" aria-labelledby="pf-contact">
                <h2 class="pf-card-title" id="pf-contact">ご連絡先</h2>
                <div class="pf-field"<?= $invalid('phone') ?>>
                    <label class="pf-label" for="phone">電話番号<span class="pf-badge pf-badge-req">必須</span></label>
                    <input id="phone" name="phone" type="tel" class="pf-input" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="例）0995-00-0000" value="<?= $value('phone') ?>">
                    <p class="pf-error" data-error="phone"><?= $error('phone') ?></p>
                </div>
                <div class="pf-field"<?= $invalid('mail') ?>>
                    <label class="pf-label" for="mail">メールアドレス<span class="pf-badge pf-badge-req">必須</span></label>
                    <input id="mail" name="mail" type="email" class="pf-input" inputmode="email" autocomplete="email" maxlength="254" placeholder="例）info@example.com" value="<?= $value('mail') ?>">
                    <p class="pf-error" data-error="mail"><?= $error('mail') ?></p>
                </div>
            </section>

            <section class="pf-card" aria-labelledby="pf-address">
                <h2 class="pf-card-title" id="pf-address">所在地</h2>
                <div class="pf-field"<?= $invalid('zip') ?>>
                    <label class="pf-label" for="zip">郵便番号<span class="pf-badge pf-badge-req">必須</span></label>
                    <div class="pf-inline">
                        <input id="zip" name="zip" type="text" class="pf-input" inputmode="numeric" autocomplete="postal-code" maxlength="8" placeholder="例）899-4332" value="<?= $value('zip') ?>">
                        <button type="button" class="pf-btn" id="pf-zip-search">住所を検索</button>
                    </div>
                    <p class="pf-error" data-error="zip"><?= $error('zip') ?></p>
                </div>
                <div class="pf-field"<?= $invalid('address') ?>>
                    <label class="pf-label" for="address">住所<span class="pf-badge pf-badge-req">必須</span></label>
                    <input id="address" name="address" type="text" class="pf-input" autocomplete="street-address" maxlength="200" placeholder="例）鹿児島県霧島市国分中央1-1-1" value="<?= $value('address') ?>">
                    <p class="pf-error" data-error="address"><?= $error('address') ?></p>
                </div>
            </section>

            <section class="pf-card" aria-labelledby="pf-other">
                <h2 class="pf-card-title" id="pf-other">ご用件</h2>
                <div class="pf-field"<?= $invalid('demand') ?>>
                    <label class="pf-label" for="demand">お問い合わせ内容<span class="pf-badge pf-badge-req">必須</span></label>
                    <textarea id="demand" name="demand" class="pf-textarea" rows="7" maxlength="2000" placeholder="業種・対応エリア・ご提案内容などをご記入ください"><?= $value('demand') ?></textarea>
                    <p class="pf-error" data-error="demand"><?= $error('demand') ?></p>
                </div>
            </section>

            <div class="pf-actions">
                <button type="button" class="pf-btn pf-btn-primary" id="pf-to-confirm">入力内容を確認する</button>
            </div>
        </div>

        <div id="pf-confirm" hidden>
            <section class="pf-card" aria-labelledby="pf-confirm-title">
                <h2 class="pf-card-title" id="pf-confirm-title">入力内容の確認</h2>
                <dl class="pf-summary" id="pf-summary"></dl>
            </section>
            <p class="pf-note">送信後、ご入力のメールアドレスに受付のメールをお送りします。</p>
            <div class="pf-actions">
                <button type="submit" class="pf-btn pf-btn-primary" id="pf-submit">この内容で送信する</button>
                <button type="button" class="pf-btn pf-btn-link" id="pf-back">入力画面に戻る</button>
            </div>
        </div>
    </form>
</main>

<script>
(function () {
    'use strict';
    // ⚠️ 項目と確かめ方は lib.php の partnerFields / partnerValidate と同じにすること（最後はサーバーが確かめる）
    var FIELDS = [
        { key: 'company', label: '貴社名', max: 100 },
        { key: 'name', label: 'ご担当者様', max: 50 },
        { key: 'kana', label: 'ご担当者様（かな）', max: 50 },
        { key: 'phone', label: '電話番号', max: 20 },
        { key: 'mail', label: 'メールアドレス', max: 254 },
        { key: 'zip', label: '郵便番号', max: 20 },
        { key: 'address', label: '住所', max: 200 },
        { key: 'demand', label: 'お問い合わせ内容', max: 2000 }
    ];
    var form = document.getElementById('pf-form');
    var inputView = document.getElementById('pf-input');
    var confirmView = document.getElementById('pf-confirm');
    var submitButton = document.getElementById('pf-submit');

    function el(key) { return document.getElementById(key); }
    function toHalf(text) {
        return text.replace(/[！-～]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); });
    }
    function digits(text) { return toHalf(text).replace(/[\s\-‐－ー―()（）〒]/g, ''); }

    function check(key, value) {
        var field = FIELDS.filter(function (f) { return f.key === key; })[0];
        if (value === '') return field.label + 'を入力してください';
        if (key !== 'phone' && key !== 'zip' && value.length > field.max) return field.max + '文字以内で入力してください';
        if (key === 'kana' && !/^[ぁ-ゖァ-ヺー・\s　]+$/.test(value)) return 'ひらがな・カタカナで入力してください';
        if (key === 'phone' && !/^0\d{9,10}$/.test(digits(value))) return '0から始まる10〜11桁の番号を入力してください';
        if (key === 'mail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toHalf(value))) return '正しいメールアドレスを入力してください';
        if (key === 'zip' && !/^\d{7}$/.test(digits(value))) return '7桁の数字で入力してください';
        return '';
    }
    function showError(key, message) {
        el(key).closest('.pf-field').setAttribute('data-invalid', message ? '1' : '0');
        document.querySelector('[data-error="' + key + '"]').textContent = message;
    }
    function validateAll() {
        var first = null;
        FIELDS.forEach(function (f) {
            var message = check(f.key, el(f.key).value.trim());
            showError(f.key, message);
            if (message && !first) first = f.key;
        });
        return first;
    }
    function setStep(step) {
        document.querySelectorAll('.pf-steps li[data-step]').forEach(function (li) {
            if (li.getAttribute('data-step') === step) li.setAttribute('aria-current', 'step');
            else li.removeAttribute('aria-current');
        });
        inputView.hidden = step !== 'input';
        confirmView.hidden = step !== 'confirm';
        window.scrollTo(0, 0);
    }

    FIELDS.forEach(function (f) {
        el(f.key).addEventListener('blur', function () {
            if (el(f.key).closest('.pf-field').getAttribute('data-invalid') === '1') showError(f.key, check(f.key, el(f.key).value.trim()));
        });
    });

    document.getElementById('pf-to-confirm').addEventListener('click', function () {
        var first = validateAll();
        if (first) { el(first).focus(); return; }
        var summary = document.getElementById('pf-summary');
        summary.textContent = '';
        FIELDS.forEach(function (f) {
            var row = document.createElement('div');
            row.className = 'pf-summary-row';
            var dt = document.createElement('dt');
            var dd = document.createElement('dd');
            dt.textContent = f.label;
            dd.textContent = el(f.key).value.trim();
            row.appendChild(dt);
            row.appendChild(dd);
            summary.appendChild(row);
        });
        setStep('confirm');
    });
    document.getElementById('pf-back').addEventListener('click', function () { setStep('input'); });

    form.addEventListener('submit', function (e) {
        // ⚠️ 入力画面で Enter を押すと確認を飛ばして送られるので、確認画面へ進める
        if (confirmView.hidden) { e.preventDefault(); document.getElementById('pf-to-confirm').click(); return; }
        if (submitButton.getAttribute('aria-busy') === 'true') { e.preventDefault(); return; }
        submitButton.setAttribute('aria-busy', 'true');
        submitButton.textContent = '送信しています…';
    });
    // ⚠️ ブラウザの「戻る」で戻ったとき、送信中の表示のまま押せなくならないように
    window.addEventListener('pageshow', function () {
        submitButton.removeAttribute('aria-busy');
        submitButton.textContent = 'この内容で送信する';
    });

    // ⚠️ 住所検索は form_get と同じ zipcloud
    document.getElementById('pf-zip-search').addEventListener('click', function () {
        var zip = digits(el('zip').value);
        if (!/^\d{7}$/.test(zip)) { showError('zip', '7桁の数字で入力してください'); return; }
        showError('zip', '');
        fetch('https://zipcloud.ibsnet.co.jp/api/search?zipcode=' + zip)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var r = data && data.results && data.results[0];
                if (!r) { showError('zip', '住所が見つかりませんでした'); return; }
                el('address').value = r.address1 + r.address2 + r.address3;
                showError('address', '');
                el('address').focus();
            })
            .catch(function () { showError('zip', '住所を検索できませんでした。住所を直接ご入力ください'); });
    });
})();
</script>
</body>
</html>
```

### thanks.php
```php
<?php
/**
 * 協力業者様募集フォームの送信先と完了画面。
 *
 * ⚠️ POST：確かめて送る → 完了画面へ移す（再読み込みで二重に送られないように GET へ）
 *   - 機械の送信（見えない欄・合い言葉・時間・回数）は、メールを送らずに完了画面へ（弾いたことを知らせない）
 *   - 入力の間違いは、入れた値とエラーを持って index.php へ戻す
 * ⚠️ GET：直前に送った人にだけ完了画面を出す。それ以外は index.php へ。
 */
require __DIR__ . '/lib.php';

partnerStartSession();
header('Cache-Control: no-store');
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $bot = partnerBotReason($_POST);
    $limited = partnerRateLimited();
    $values = partnerNormalize($_POST);
    // ⚠️ 時間切れ・セッション切れは人かもしれないので、送らずに入れた値を持ってフォームへ戻す（もう一度送ってもらう）
    if ($bot === 'expired' && !$limited) {
        error_log('partner form: 時間切れのためフォームへ戻した ip=' . ($_SERVER['REMOTE_ADDR'] ?? ''));
        partnerBackToForm($values, ['_form' => '時間がたったため、送信できませんでした。お手数ですが、内容をご確認のうえもう一度送信してください。']);
    }
    if ($bot !== '' || $limited) {
        error_log('partner form: 機械の送信として送らなかった reason=' . ($bot !== '' ? $bot : 'rate_limit')
            . ' ip=' . ($_SERVER['REMOTE_ADDR'] ?? ''));
        $_SESSION['partner_done'] = ['company' => '', 'name' => ''];
        header('Location: ./thanks.php', true, 303);
        exit;
    }

    $errors = partnerValidate($values);
    if ($errors) {
        partnerBackToForm($values, $errors);
    }

    partnerSendMails($values);
    $_SESSION['partner_done'] = ['company' => $values['company'], 'name' => $values['name']];
    header('Location: ./thanks.php', true, 303);
    exit;
}

$done = $_SESSION['partner_done'] ?? null;
unset($_SESSION['partner_done']);
if (!is_array($done)) {
    header('Location: ./index.php', true, 303);
    exit;
}
$who = trim($done['company'] . ' ' . $done['name']);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <title>送信完了｜協力業者様募集｜<?= h(PARTNER_BRAND) ?></title>
    <link rel="stylesheet" href="form.css">
</head>
<body>
<main class="pf" style="--pf-accent: <?= h(PARTNER_ACCENT) ?>">
    <div class="pf-logo"><img src="<?= h(PARTNER_LOGO) ?>" alt="<?= h(PARTNER_BRAND) ?>"></div>
    <ol class="pf-steps" aria-label="お申し込みの流れ">
        <li><span class="pf-step-num">1</span>入力</li>
        <li><span class="pf-step-num">2</span>確認</li>
        <li aria-current="step"><span class="pf-step-num">3</span>完了</li>
    </ol>
    <section class="pf-card pf-done">
        <div class="pf-done-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
        </div>
        <h1 class="pf-title">送信が完了しました</h1>
        <?php if ($who !== ''): ?>
            <p><?= h($who) ?> 様</p>
        <?php endif; ?>
        <p>このたびはお問い合わせいただき、誠にありがとうございます。<br>お問い合わせ内容を確認したうえで、担当よりご連絡を差し上げる場合がございます。その際は何卒宜しくお願い申し上げます。</p>
        <p class="pf-note">ご入力のメールアドレスに受付のメールをお送りしました。届かない場合は、迷惑メールのフォルダもご確認ください。</p>
    </section>
    <div class="pf-actions">
        <a class="pf-btn" href="<?= h(PARTNER_TOP_URL) ?>"><?= h(PARTNER_BRAND) ?>のトップへ</a>
    </div>
</main>
</body>
</html>
```

### form.css
```css
/*
 * 協力業者様募集フォームの見た目。
 * ⚠️ form_get（src/components/publicForm.css）の写しから、このフォームで使う分だけ残したもの。
 * ⚠️ 入力欄の文字は 16px（16px 未満だと iPhone で入力時に画面が拡大される）。
 * ⚠️ 差し色（--pf-accent）は lib.php の PARTNER_ACCENT を画面側が style で渡す（ここの値は渡されなかったときの既定）。
 */
html, body {
    margin: 0;
    background: #ffffff;
}

.pf {
    --pf-accent: #0f3675;
    --pf-ink: #1d2433;
    --pf-sub: #5b6476;
    --pf-line: #d5dbe5;
    --pf-surface: #f5f7fa;
    --pf-field: #ffffff;
    --pf-danger: #c62828;
    --pf-danger-bg: #fdecec;
    --pf-radius: 10px;

    max-width: 640px;
    margin: 0 auto;
    padding: 24px 16px 48px;
    color: var(--pf-ink);
    background: #ffffff;
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    letter-spacing: .02em;
    -webkit-font-smoothing: antialiased;
}
.pf *, .pf *::before, .pf *::after { box-sizing: border-box; }
.pf [hidden] { display: none !important; }

/* ---- ロゴ・段階 ---- */
.pf-logo { display: flex; justify-content: center; margin: 8px 0 20px; }
.pf-logo img { width: 170px; height: auto; }

.pf-steps {
    display: flex; justify-content: center; gap: 6px;
    margin: 0 0 24px; padding: 0; list-style: none;
    font-size: 12px; color: var(--pf-sub);
}
.pf-steps li { display: flex; align-items: center; gap: 6px; }
.pf-steps li + li::before { content: ""; width: 18px; height: 1px; background: var(--pf-line); }
.pf-steps .pf-step-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 50%;
    border: 1px solid var(--pf-line); background: #ffffff;
    font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.pf-steps li[aria-current="step"] { color: var(--pf-ink); font-weight: 700; }
.pf-steps li[aria-current="step"] .pf-step-num { border-color: var(--pf-accent); background: var(--pf-accent); color: #ffffff; }

.pf-title { margin: 0 0 6px; font-size: 20px; font-weight: 700; text-align: center; text-wrap: balance; }
.pf-lead { margin: 0 0 20px; font-size: 14px; color: var(--pf-sub); text-align: center; word-break: auto-phrase; }
/* ⚠️ スマホでは1文が1行に収まらないので、改行を外して左寄せ（言葉の途中で折れないように） */
@media (max-width: 479px) {
    .pf-lead { text-align: left; }
    .pf-lead br { display: none; }
}

/* ---- まとまり（カード） ---- */
.pf-card {
    display: flex; flex-direction: column; gap: 18px;
    padding: 20px; margin: 0 0 16px;
    border: 1px solid var(--pf-line); border-radius: 14px;
    background: #ffffff; box-shadow: 0 1px 2px rgba(29, 36, 51, .04);
}
.pf-card-title { margin: 0; font-size: 13px; font-weight: 700; color: var(--pf-sub); letter-spacing: .08em; }

/* ---- 項目 ---- */
.pf-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pf-label { display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 13px; font-weight: 600; line-height: 1.5; }
.pf-badge { flex: none; display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1.6; letter-spacing: .04em; }
.pf-badge-req { background: var(--pf-danger-bg); color: var(--pf-danger); }

.pf-input, .pf-textarea {
    width: 100%; min-height: 48px; padding: 10px 14px;
    border: 1px solid var(--pf-line); border-radius: var(--pf-radius);
    background: var(--pf-field); color: var(--pf-ink);
    font: inherit; font-size: 16px; line-height: 1.5;
    transition: border-color .15s, box-shadow .15s;
    appearance: none; -webkit-appearance: none;
}
.pf-textarea { min-height: 160px; resize: vertical; }
.pf-input::placeholder, .pf-textarea::placeholder { color: #9aa3b2; }
.pf-input:focus, .pf-textarea:focus {
    outline: none; border-color: var(--pf-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-accent) 22%, transparent);
}
.pf-field[data-invalid="1"] .pf-input,
.pf-field[data-invalid="1"] .pf-textarea { border-color: var(--pf-danger); }

.pf-error { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12px; font-weight: 600; color: var(--pf-danger); }
.pf-error::before {
    content: "!"; display: inline-flex; align-items: center; justify-content: center; flex: none;
    width: 16px; height: 16px; border-radius: 50%;
    background: var(--pf-danger); color: #ffffff; font-size: 11px; font-weight: 700;
}
.pf-error:empty { display: none; }

/* 郵便番号 ＋ 住所検索 */
.pf-inline { display: flex; gap: 8px; align-items: stretch; }
.pf-inline .pf-input { flex: 1; }
.pf-hint { margin: 0; font-size: 12px; color: var(--pf-sub); }

/* ⚠️ 見えない入力欄（機械よけ）。display:none にすると埋めない機械があるので画面の外へ出す */
.pf-trap { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }

/* ---- ボタン ---- */
.pf-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 28px 0 0; }
.pf-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 44px; padding: 10px 18px;
    border-radius: var(--pf-radius); border: 1px solid var(--pf-line);
    background: #ffffff; color: var(--pf-ink);
    font: inherit; font-size: 14px; font-weight: 600;
    cursor: pointer; white-space: nowrap;
    transition: filter .15s, background-color .15s;
}
.pf-btn:hover { background: var(--pf-surface); }
.pf-btn:focus-visible { outline: 3px solid color-mix(in srgb, var(--pf-accent) 35%, transparent); outline-offset: 2px; }
.pf-btn-primary {
    width: 100%; max-width: 360px; min-height: 54px;
    border-color: var(--pf-accent); background: var(--pf-accent); color: #ffffff;
    font-size: 16px; font-weight: 700; letter-spacing: .06em;
}
.pf-btn-primary:hover { background: var(--pf-accent); filter: brightness(.92); }
.pf-btn-primary[aria-busy="true"], .pf-btn-primary:disabled { filter: grayscale(.4) brightness(1.05); cursor: progress; }
.pf-btn-link { border: none; background: none; color: var(--pf-sub); text-decoration: underline; }
.pf-btn-link:hover { background: none; color: var(--pf-ink); }

/* ---- 注意書き ---- */
.pf-note { margin: 0; padding: 14px 16px; border-radius: var(--pf-radius); background: var(--pf-surface); color: var(--pf-sub); font-size: 13px; text-align: justify; }
.pf-alert { margin: 0 0 16px; padding: 12px 16px; border-radius: var(--pf-radius); background: var(--pf-danger-bg); color: var(--pf-danger); font-size: 13px; font-weight: 600; }

/* ---- 確認画面 ---- */
.pf-summary { margin: 0; }
.pf-summary-row { display: grid; grid-template-columns: 1fr; gap: 2px; padding: 12px 0; border-bottom: 1px solid var(--pf-line); }
.pf-summary-row:last-child { border-bottom: none; }
@media (min-width: 480px) {
    .pf-summary-row { grid-template-columns: 180px 1fr; gap: 16px; }
}
.pf-summary dt { font-size: 13px; font-weight: 600; color: var(--pf-sub); }
.pf-summary dd { margin: 0; font-size: 15px; font-weight: 600; word-break: break-word; white-space: pre-line; }

/* ---- 完了画面 ---- */
.pf-done { text-align: center; }
.pf-done-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 56px; height: 56px; margin: 0 auto 12px; border-radius: 50%;
    background: color-mix(in srgb, var(--pf-accent) 10%, #ffffff); color: var(--pf-accent);
}
.pf-done p { margin: 0 0 12px; font-size: 14px; text-wrap: pretty; }

@media (prefers-reduced-motion: reduce) {
    .pf *, .pf *::before, .pf *::after { transition: none !important; animation: none !important; }
}
```
