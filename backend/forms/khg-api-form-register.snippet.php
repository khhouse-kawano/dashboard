<?php

/**
 * ① `https://khg-marketing.info/api/` の index.php に差し替える部分。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **このファイルはそのまま動かすものではない。**
 *   ⚠️ 既存の `index.php` の中の
 *       elseif ($authHeader === 'form_register') { ... }
 *     の**中身**と、`registration` / `homepage` の**メール送信部分**を
 *     ここの関数呼び出しに置き換えるための下書きである。
 *
 * ⚠️⚠️ **認証情報は絶対に書かないこと。** 既存の $dbh をそのまま使う。
 *
 * ⚠️⚠️ **なぜ必要か**
 *   ⚠️ ② が落ちて ① へフォールバックしたとき、
 *     **ダッシュボードで編集した文面が効かない**ままになる。
 *   ⚠️ どちらの経路でも同じ文面が届くようにする（2026-09-16 の指示）。
 *
 * ⚠️⚠️ **ついでに塞ぐ穴**
 *   ⚠️ 現在の `form_register` は通知先を**リクエストから**受け取り、
 *     `'Cc:' . $data['mail_cc']` と**文字列でヘッダを組み立てている**。
 *     改行を仕込めば `Bcc:` を足せ、**任意の宛先へ送信できる**。
 *   ⚠️ 下では form_table から引き、`khgSafeAddressList()` で無害化する。
 * ─────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// 1. 宛先の無害化（form-proxy.php と同じ考え方）
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **改行は「削除」ではなく「区切り」として扱う。**
 *   ⚠️ 削除すると `ok@a.jp\r\nBcc: 悪い宛先` が1つの不正な文字列になり、
 *     **正当な宛先まで丸ごと消える**（社内通知が届かなくなる）。
 */
function khgSafeAddressList($value)
{
    if (!is_string($value) || $value === '') return '';
    $value = str_replace(array("\r", "\n", "\t"), ',', $value);
    $clean = array();
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && filter_var($one, FILTER_VALIDATE_EMAIL)) $clean[] = $one;
    }
    // ⚠️ 宛先が増えすぎないよう上限を掛ける。通常は数件しかない
    return implode(',', array_slice(array_unique($clean), 0, 20));
}

/** ⚠️ 件名はヘッダに入る。⚠️ 改行を必ず落とす */
function khgSanitizeHeader($value)
{
    return trim(str_replace(array("\r", "\n"), ' ', (string)$value));
}

// ---------------------------------------------------------------------------
// 2. 差し込み（② の mailTemplate.ts と同じ規則）
// ---------------------------------------------------------------------------

/**
 * 入力項目の一覧（`{{お問い合わせ内容}}` の中身）。
 * ⚠️ 並びと文言は ② と同じにすること。社内がこの順で目を通している。
 */
function khgDetailBlock($d, $html)
{
    $br = $html ? '<br>' : "\n";
    $e  = $html
        ? function ($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
        : function ($v) { return (string)$v; };

    $line = function ($label, $value) use ($br, $e) {
        $value = trim((string)$value);
        return $value === '' ? '' : $label . '：' . $e($value) . $br;
    };

    $address = '';
    if (trim((string)($d['zip'] ?? '')) !== '') {
        $address = '郵便番号：' . $e($d['zip']) . $br
            . '住所：' . $e(($d['pref'] ?? '') . ($d['city'] ?? '') . ($d['town'] ?? '') . ($d['street'] ?? '')) . $br;
    }

    return $line('来場希望場所', $d['shop'] ?? '')
        . 'お名前：' . $e($d['sei'] ?? '') . ' ' . $e($d['mei'] ?? '') . $br
        . 'お名前（カナ）：' . $e($d['seiKana'] ?? '') . ' ' . $e($d['meiKana'] ?? '') . $br
        . $line('来場希望日', $d['date'] ?? '')
        . $line('来場希望時間', $d['time'] ?? '')
        . $line('携帯番号', $d['phone'] ?? '')
        . $line('メールアドレス', $d['mail'] ?? '')
        . $line('年齢', $d['age'] ?? '')
        . $address
        . $line('お問い合わせのきっかけ', $d['medium'] ?? '')
        . $line('その他ご質問・ご要望', $d['question'] ?? '');
}

/**
 * ⚠️⚠️ **URL が空なら案内ごと出さない。**
 *   ⚠️ 今は日付か時間があれば見出しを必ず出しており、
 *     アンケートを持たないブランドでは
 *     **URL 無しで見出しだけ**が届いている。
 */
function khgQuestionnaireBlock($d, $questionnaire, $html)
{
    if ($questionnaire === '') return '';
    if (($d['date'] ?? '') === '' && ($d['time'] ?? '') === '') return '';
    $br = $html ? '<br>' : "\n";
    return $br . '▼事前アンケートでギフトカードプレゼント！' . $br . $br . $questionnaire . $br;
}

/**
 * ひな型に値を差し込む。
 *
 * ⚠️⚠️ **知らない語はそのまま残す。**
 *   ⚠️ 黙って空にすると、打ち間違いに誰も気づけないまま顧客へ届く。
 * ⚠️ ② の `render()` と**同じ語・同じ正規表現**にすること。
 */
function khgRender($template, $d, $brandName, $receivedAt, $questionnaire, $html)
{
    $br = $html ? '<br>' : "\n";
    $e  = $html
        ? function ($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
        : function ($v) { return (string)$v; };

    $table = array(
        'お名前'           => $e($d['sei'] ?? '') . ' ' . $e($d['mei'] ?? ''),
        '姓'               => $e($d['sei'] ?? ''),
        '名'               => $e($d['mei'] ?? ''),
        'お名前カナ'       => $e($d['seiKana'] ?? '') . ' ' . $e($d['meiKana'] ?? ''),
        'お問い合わせ内容' => khgDetailBlock($d, $html),
        'キャンペーン名'   => $e($d['campaign'] ?? ''),
        'ブランド名'       => $e($brandName),
        '受付日時'         => $e($receivedAt),
        '来場希望場所'     => $e($d['shop'] ?? ''),
        '来場希望日'       => $e($d['date'] ?? ''),
        '来場希望時間'     => $e($d['time'] ?? ''),
        '携帯番号'         => $e($d['phone'] ?? ''),
        'メールアドレス'   => $e($d['mail'] ?? ''),
        '年齢'             => $e($d['age'] ?? ''),
        '事前アンケート'   => khgQuestionnaireBlock($d, $questionnaire, $html),
        '事前アンケートURL' => $e($questionnaire),
    );

    $out = preg_replace_callback(
        '/\{\{([^{}]{1,40})\}\}/u',
        function ($m) use ($table) {
            $key = trim($m[1]);
            // ⚠️ 知らない語はそのまま返す（消さない）
            return array_key_exists($key, $table) ? $table[$key] : $m[0];
        },
        $template
    );

    // ⚠️ HTML のときだけ改行を <br> にする。画面では改行で編集している
    return $html ? preg_replace('/\r?\n/', $br, $out) : $out;
}

/** ⚠️ 空白だけの入力も「空」として扱う。件名の無いメールを飛ばさない */
function khgPick($stored, $fallback)
{
    return trim((string)$stored) === '' ? $fallback : (string)$stored;
}

// ---------------------------------------------------------------------------
// 3. 既定の文面（⚠️ ② の mailTemplate.ts と同じ文面にすること）
// ---------------------------------------------------------------------------

define('KHG_DEFAULT_THANKS_SUBJECT', '{{ブランド名}}/お問い合わせありがとうございます。');

define('KHG_DEFAULT_THANKS_BODY',
    "{{お名前}} 様\n"
    . "お問い合わせを受け付けました。\n\n"
    . "お問い合わせ内容は以下となります。\n\n"
    . "{{お問い合わせ内容}}"
    . "\nこちらのメールは配信用のため返信できません。\n"
    . "ご意見・ご要望はご予約の店舗までお寄せください。\n\n"
    . "※お問い合わせいただいた日時が18:00以降または火曜日、水曜日の場合、翌営業日以降のご連絡となりますのであらかじめご了承ください。\n"
    . "{{事前アンケート}}");

/** ⚠️ 末尾の署名を必ず連結すること（今は孤立した式になっていて本文に入っていない） */
define('KHG_DEFAULT_MEMBER_BODY',
    "{{お名前}} 様\n\n"
    . "お世話になっております。\nデイジャストハウスです。\n\n"
    . "この度は、会員登録にお申込みいただき、誠にありがとうございます。\n登録が無事完了いたしました。\n\n"
    . "限定コンテンツログイン情報をお送りいたします。\n大切に保管をお願いいたします。\n\n"
    . "───────────────────────────────\n"
    . "●会員限定公開プラン　ログイン情報\n"
    . "───────────────────────────────\n\n"
    . "ユーザー名：dayjust\n"
    . "パスワード：plan\n\n"
    . "厳選プランページURL：\nhttps://day-just-house.com/plan/\n\n"
    . "上記ご案内したログイン情報より弊社ホームページの会員限定公開プランの閲覧が可能です。\n\n"
    . "デイジャストハウスではお客様との出会いを大切に誠実に丁寧に対応させていただきます。\nなんでもお気軽にご相談・お問い合わせください。\n\n"
    . "デイジャストハウス");

define('KHG_DEFAULT_INTERNAL_SUBJECT', '{{ブランド名}}/{{キャンペーン名}}からの登録がありました。');

define('KHG_DEFAULT_INTERNAL_BODY',
    "{{キャンペーン名}}からの登録がありました。\n\n"
    . "お問合わせ日時：{{受付日時}}\n\n"
    . "====================\nお客様情報\n====================\n"
    . "{{お問い合わせ内容}}"
    . "====================\n"
    . "※のちほどダッシュボードへ反映されます。\n");

define('KHG_MEMBER_CAMPAIGN_ID', '20240000_djh_kyotsu_member');

// ---------------------------------------------------------------------------
// 4. メール2通を送る
// ---------------------------------------------------------------------------

/**
 * 反響のメールを送る。
 *
 * ⚠️⚠️ **通知先・送信可否・文面はすべて form_table から引く。**
 *   ⚠️ `$data['mail_to']` / `$data['mail_cc']` / `$data['thanks']` は
 *     **ブラウザから来た値**なので使わないこと。
 *
 * @param PDO    $dbh          既存の接続をそのまま渡す
 * @param array  $data         リクエスト（顧客の入力）
 * @param string $brandName    メールの差出人名・件名に使う
 * @param string $questionnaire 事前アンケートのURL（無ければ空文字）
 */
function khgSendCampaignMails($dbh, $data, $brandName, $questionnaire)
{
    $stmt = $dbh->prepare(
        'SELECT mail_to, mail_cc, thanks, thanks_subject, thanks_body, internal_subject, internal_body'
        . ' FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1'
    );
    $stmt->execute(array($data['brand'] ?? '', $data['campaign_id'] ?? ''));
    $form = $stmt->fetch(PDO::FETCH_ASSOC);

    // ⚠️ 設定が無いフォームからの送信。⚠️ 反響は保存済みなので黙って戻る
    if (!$form) return;

    $receivedAt = date('Y/m/d H:i:s');

    // ---- 顧客宛（プレーンテキスト） ----
    if ((int)$form['thanks'] === 1 && !empty($data['mail'])) {
        $defaultBody = (($data['campaign_id'] ?? '') === KHG_MEMBER_CAMPAIGN_ID)
            ? KHG_DEFAULT_MEMBER_BODY
            : KHG_DEFAULT_THANKS_BODY;

        $subject = khgRender(khgPick($form['thanks_subject'], KHG_DEFAULT_THANKS_SUBJECT), $data, $brandName, $receivedAt, $questionnaire, false);
        $message = khgRender(khgPick($form['thanks_body'], $defaultBody), $data, $brandName, $receivedAt, $questionnaire, false);

        mb_language('Japanese');
        mb_internal_encoding('UTF-8');

        $headers = array();
        $headers[] = 'From: ' . mb_encode_mimeheader($brandName, 'ISO-2022-JP') . ' <pgcloud@khg-marketing.info>';
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-Type: text/plain; charset=ISO-2022-JP';
        $headers[] = 'Content-Transfer-Encoding: 7bit';

        $to = khgSafeAddressList($data['mail']);
        if ($to !== '') {
            mb_send_mail(
                $to,
                khgSanitizeHeader($subject),
                mb_convert_encoding($message, 'ISO-2022-JP', 'UTF-8'),
                implode("\r\n", $headers)
            );
        }
    }

    // ---- 社内宛（HTML） ----
    $to = khgSafeAddressList($form['mail_to']);
    // ⚠️ 通知先が無いフォームは実在する。⚠️ エラーにはしない
    if ($to === '') return;

    $cc = khgSafeAddressList($form['mail_cc']);

    $subjectResponse = khgRender(khgPick($form['internal_subject'], KHG_DEFAULT_INTERNAL_SUBJECT), $data, $brandName, $receivedAt, $questionnaire, false);
    $bodyResponse    = khgRender(khgPick($form['internal_body'], KHG_DEFAULT_INTERNAL_BODY), $data, $brandName, $receivedAt, $questionnaire, true);

    $message = '<html lang="ja"><head><title>' . htmlspecialchars($brandName, ENT_QUOTES, 'UTF-8')
        . '</title></head><body><div>' . $bodyResponse . '</div></body></html>';

    /**
     * ⚠️⚠️ **Cc は無害化した値だけを入れること。**
     *   ⚠️ ここに $data の値をそのまま入れると、改行で Bcc を足され
     *     **任意の宛先へ送信できる**（元の実装がそうなっている）。
     */
    $headersResponse = 'From:' . khgSanitizeHeader($brandName) . ' <pgcloud@khg-marketing.info>' . "\r\n"
        . ($cc === '' ? '' : 'Cc:' . $cc . "\r\n")
        . 'Content-type: text/html; charset=UTF-8';

    mail($to, khgSanitizeHeader($subjectResponse), $message, $headersResponse);
}
