# 公開フォーム（form_get）の受け皿と DJH 会員登録のお礼メール（v2.2.213）

## 依頼
- form_get のフォームが ② に届かないとき（落ちたとき）の受け皿を `backend/src/handlers`（サーバーの `/dashboard/api/gateway/handlers/`）に作る
  - 参考: 以前のエンジニアから引き継いだ各ブランドサイトの `form/api/index.php`（転送するだけ）と、消えた `khg-marketing.info/api/index.php` の中身（利用者が貼ったもの）
- DJH の会員登録で、以前は ID とパスワードを送っていたが、今は反響の内容しか届かない → form_table で設定する SQL を作る

## 分かったこと
- 公開フォームの退避経路は「フォーム → 各サイトの `form/api/index.php`（転送のみ）→ `khg-marketing.info/api/`（Authorization ヘッダで振り分ける PHP）」だった。⚠️ 転送先の PHP は誤って消えており、**② が落ちると反響が行き止まりになる状態**だった。
- 古い PHP の `$authHeader` との対応:
  - `form_get` → 受け皿の `roll: public`（フォームの設定 ＋ form_show）
  - `form_register` → 受け皿の `roll: entry`（inquiry_customer ＋ pgcloud ＋ form_cv ＋ メール2通）
  - 管理画面の `form_list` / `form_edit` / `form_post` / `form_update` / `form_database` は ② の `campaign_form:list` などに移植済み。受け皿では処理しない（404）
  - それ以外（`registration`・`4081Kokubu_beforeSurvey`・`call_sheet_information`・`4081Kokubu` など）は今回の対象外
- DJH 会員登録：② は「キャンペーン ID が `20240000_djh_kyotsu_member` で**本文のひな型が空のとき**」だけ会員用の本文を送る。ローカルの DB は空だった。⚠️ 本番で反響の内容しか届かないなら、本番の行にひな型が入っていると考えられる → ひな型に会員用の本文をはっきり入れる SQL にした

## 作ったもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/src/handlers/ | **campaign_form.php**（新規） | ① の受け皿。② の features/campaignForm（entry.ts・mail.ts・mailTemplate.ts・brands.ts・text.ts）を写したもの |
| backend/scripts/brand_form_api/ | **index.php**（新規） | 8サイトの `form/api/index.php` の新しい版。転送先を `/dashboard/api/gateway/` に付け替え、`Authorization` を `request: campaign_form` ＋ `roll` に読み替える |
| backend/scripts/sql/ | **2026-10-23_djh_member_thanks_mail.sql**（新規） | DJH 会員登録の thanks_subject / thanks_body（ローカルにも反映済み） |
| backend/scripts/sql/ | **2026-10-23_update_log_2.2.213.sql**（新規） | update_log（ローカル no=313 で反映済み） |
| frontend/src/utils/ | version.ts | 2.2.213 |
| docs/ | deploy-v2.2.213.md（新規）・本書 | |

campaign_form.php の関数：`cfRespond` `cfClean` `cfCleanMultiline` `cfBrandSpec` `cfFormTableBrand` `cfQuestionnaire` `cfKhgBrand` `cfKhgCc` `cfSafeAddressList` `cfLine` `cfDetailBlock` `cfQuestionnaireBlock` `cfRender` `cfPick` `cfDefaultThanksSubject` `cfDefaultThanksBody` `cfDefaultMemberBody` `cfDefaultInternalSubject` `cfDefaultInternalBody` `cfSendMail` `cfRateLimited`

### 受け皿の決めごと
- `public` / `entry` は `express_proxy.php` の許可リストに入れない（届いた時点で ② は落ちている前提。① で処理する）
- 管理画面の roll は 404（② が落ちて ① にフォールバックしても、ここで二重に書き込まない）
- 通知先・サンクスの可否は form_table から（リクエストの `mail_to` / `mail_cc` / `thanks` は使わない）。KHG 共通フォームの店舗別 Cc も ② と同じ表
- メールは文字だけ（UTF-8）。差出人は「ブランド名 <pgcloud@khg-marketing.info>」（移植元と同じアドレス）
- ⚠️ **二重登録を防ぐ**：② が保存した直後にタイムアウトして ① へ回った送信は、同じキャンペーン・同じメールか電話の行（inquiry_id が `form` で始まり10分以内）があれば、保存もメールもせずに成功を返す
  - ⚠️ ② の inquiry_id は ② の時刻（本番は `TZ=Asia/Tokyo`）。受け皿も日本時間で比べる
- ① で保存した反響の inquiry_id は `homepage` で始まる（移植元と同じ。② の `form` と見分けられる）
- 全体で1分に30件まで（各サイトを経由するので、お客様の IP は見えない）

## 確かめたこと（ローカル）
1. **① 経由**（localhost:8080。トークン無しで 401＝② に届く）
   - `public`：DJH 会員登録の設定が返る・`mail_to` / `mail_cc` を返さない・無いフォームは empty・form_show に記録
   - roll なし → 404。管理画面の roll（insert・list）→ ② へ転送されて 401、**② を止めると 404**（① では動かない）
   - `public` は ② が動いていても ① で処理される（許可リストに入れていないため）
2. **entry とメール**（① のコンテナの中で PHP の組み込みサーバーを動かし、メールをファイルに書き出して確認）
   - campaign_id なし → 400
   - DJH 会員登録 → 保存（DJH・DJH店舗未設定）・**お礼メールに会員限定プランのユーザー名・パスワード**・社内通知（To mkt@kh-house.jp、Cc は form_table の値）
   - なごみ（かなで届く）→ form_table のローマ字の行を引いて通知・店舗「なごみ鹿児島店」
   - KHG 共通フォームでデイジャストハウスを選択 → 社内通知の Cc が店舗別の表（info-djh@…・djh@…）
   - リクエストに入れた `mail_to`（改行と Bcc 入り）・`mail_cc` は使われない
   - inquiry_customer・pgcloud・form_cv・form_show に入る。LINE ID は空白を除いて入る。姓・名は ② と同じ（first_name に姓）
3. **二重登録の防止**：② の形の行（2分前・同じキャンペーン・同じメール）があると、① は保存せずメールも0通で success
4. **流量制限**：32回送ると31回目から 429
5. **8サイトの form/api/index.php**（PHP 8.0 で動かし、localhost:8080 の ① へ転送）
   - `Authorization: form_get` → ① の public の結果がそのまま返る
   - `Authorization: form_register` → 保存される（本文の `request` / `roll` は上書きされる）
   - ほかの Authorization → 404、なし → 401、JSON でない → 400
6. 回帰：member_entry・kagosuma_entry・tochishinchaku_entry も ① 経由で 401（② に届く）
7. `php -l`：campaign_form.php（PHP 8.2）・brand_form_api/index.php（PHP 8.0）OK
8. テストの行は削除済み（inquiry_customer 5・pgcloud 4・form_cv 4・form_show 3）

## 気づいたこと（今回は直していない）
- 消えた `khg-marketing.info/api/index.php` には、ほかにも口があった（`registration`（オーナーズハウス・homepage）、事前アンケートの照合、call_sheet、geo_info など）。まだどこかから使われていれば、今は止まっている。
- 同じ PHP の土地新着ネットの取り込みは「土地新着ネットで同じメールの人が**いつでも**いれば入れない」だった。v2.2.212 は「同じ日なら入れない・別の日なら重複の印を付けて入れる」にしている。

## コード

### backend/src/handlers/campaign_form.php（新規）
```php
<?php

/**
 * 公開フォーム（form_get）の受け皿。② が落ちたときだけ動く。（v2.2.213）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/campaignForm の `public` / `entry` の予備である。同じ処理を持つ。**
 *
 *   ふだん : フォーム ──▶ ② `campaign_form`（roll: public / entry）
 *   ② 失敗: フォーム ──▶ 各ブランドサイトの `form/api/index.php`（転送するだけ）──▶ ここ
 *
 *   ⚠️ 移植元は ① `khg-marketing.info/api/index.php`（Authorization: form_get / form_register）。
 *     ⚠️ 誤って消えたため、各サイトの form/api/ の転送先をここ（/dashboard/api/gateway/）へ付け替える
 *     （backend/scripts/brand_form_api/index.php）。
 *   ⚠️ ② の entry.ts / mail.ts / mailTemplate.ts / brands.ts を変えたら、ここも同じように変えること。
 *
 * ⚠️⚠️ **`public` と `entry` は express_proxy.php の許可リストに入れていない。**
 *   ⚠️ ここに届いた時点で ② は落ちている前提なので、② へ転送せずに ① で処理する。
 *
 * ⚠️⚠️ **管理画面の roll（list / detail / insert / update / master）はここで処理しない。**
 *   ⚠️ それらは ② へ転送され、② が落ちたときは ① にフォールバックしてこのファイルに来る。
 *   ⚠️ ここで動かすと ② と二重に書き込む経路ができるので、以前と同じく 404 を返す。
 *
 * ⚠️⚠️ **社外の誰でも叩ける書き込み口である。** リクエストの値を一切信用しない。
 *   - 通知先・サンクスの可否はリクエストから受け取らない（form_table から引く）
 *   - 全項目を長さで切り、制御文字を除く
 *   - 全体で1分に30件まで（各サイト経由なので、お客様の IP は見えない）
 * ⚠️⚠️ **② が保存した直後にタイムアウトして ① へ回ったとき、二重に保存しない。**
 *   - 同じキャンペーン・同じメールか電話の反響を ② が10分以内に保存していれば、保存もメールもせずに成功を返す
 * ─────────────────────────────────────────────
 */

date_default_timezone_set('Asia/Tokyo');

const CF_RATE_LIMIT = 30;
const CF_RATE_WINDOW = 60;
const CF_DEDUP_SECONDS = 600;
const CF_MAIL_FROM = 'pgcloud@khg-marketing.info';
const CF_MEMBER_CAMPAIGN_ID = '20240000_djh_kyotsu_member';

function cfRespond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ---------------------------------------------------------------------------
// 値の正規化（② の text.ts と同じ）
// ---------------------------------------------------------------------------

/** 制御文字を空白にし、連続する空白を1つにして長さで切る */
function cfClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 自由記述。⚠️ 改行だけは残す */
function cfCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

// ---------------------------------------------------------------------------
// ブランドの対応表（② の brands.ts と同じ）
// ---------------------------------------------------------------------------

/** フォームが送ってくる brand → [inquiry_customer.brand, ブランド名, 店舗の接頭辞, 事前アンケート] */
function cfBrandSpec(string $raw): ?array
{
    $kh = ['KH', '国分ハウジング', 'KH', 'https://khg-marketing.info/survey_kh/'];
    $djh = ['DJH', 'デイジャストハウス', 'DJH', 'https://khg-marketing.info/survey_djh/'];
    $nagomi = ['なごみ', 'なごみ工務店', 'なごみ', 'https://khg-marketing.info/survey_nagomi/'];
    $nieru = ['2L', 'ニーエルホーム', '2L', 'https://khg-marketing.info/survey_2l/'];
    // ⚠️ 移植元は「フルコミコーム」の誤字だった。② と同じく直した名前
    $fh = ['FH', 'フルコミホーム', 'FH', 'https://khg-marketing.info/survey_fh/'];
    // ⚠️ brand は 'PG HOUSE'（空白あり）、店舗の接頭辞は 'PGH'
    $pg = ['PG HOUSE', 'PG-HOUSE', 'PGH', 'https://khg-marketing.info/survey_pg/'];
    $jh = ['JH', 'JUSFY HOME', 'JH', 'https://khg-marketing.info/survey_jh/'];
    $khf = ['KHG', 'かえるホーム', 'KHG', ''];
    $khg = ['KHG', '国分ハウジンググループ', 'KHG', ''];
    $table = [
        'kh' => $kh, 'djh' => $djh,
        // ⚠️ form_table はローマ字、公開フォームは送信前にかなへ書き換える。両方受ける
        'nagomi' => $nagomi, 'なごみ' => $nagomi,
        // ⚠️ 本番とローカルで割れていた名残。両方受ける
        '2l' => $nieru, 'nieru' => $nieru,
        'fh' => $fh, 'pg' => $pg, 'jh' => $jh, 'khf' => $khf, 'khg' => $khg,
    ];
    $spec = $table[trim($raw)] ?? null;
    if ($spec === null) {
        return null;
    }
    return ['value' => $spec[0], 'name' => $spec[1], 'shopPrefix' => $spec[2], 'questionnaire' => $spec[3], 'isKhg' => $spec === $khg];
}

/** 送られてきた brand → form_table.brand のキー（⚠️ かな → ローマ字・KHG 共通フォームは khg） */
function cfFormTableBrand(string $raw, bool $isKhgForm): string
{
    if ($isKhgForm) {
        return 'khg';
    }
    $map = ['なごみ' => 'nagomi', 'nieru' => '2l'];
    $value = trim($raw);
    return $map[$value] ?? $value;
}

/** 事前アンケートの URL（⚠️ KHG 共通フォームは選んだ店舗で決まる） */
function cfQuestionnaire(?array $spec, string $shop): string
{
    if ($spec === null) {
        return '';
    }
    if ($spec['isKhg']) {
        $survey = [
            '国分ハウジング' => 'https://khg-marketing.info/survey_kh/',
            'デイジャストハウス' => 'https://khg-marketing.info/survey_djh/',
            'なごみ工務店' => 'https://khg-marketing.info/survey_nagomi/',
            'ニーエルホーム' => 'https://khg-marketing.info/survey_2l/',
            'フルコミホーム' => 'https://khg-marketing.info/survey_fh/',
        ];
        return $survey[trim($shop)] ?? '';
    }
    return $spec['questionnaire'];
}

/** KHG 共通フォームの「来場希望場所」（ブランド名）→ 実ブランドのキー（② の KHG_BRAND と同じ） */
function cfKhgBrand(): array
{
    return [
        '国分ハウジング' => 'kh', 'デイジャストハウス' => 'djh', 'なごみ工務店' => 'なごみ',
        'ニーエルホーム' => '2l', 'フルコミホーム' => 'fh', 'ジャスフィーホーム' => 'jh',
        'PG HOUSE' => 'pg', 'かえるホーム' => 'khf',
    ];
}

/** KHG 共通フォームの店舗別の Cc（② の KHG_CC と同じ） */
function cfKhgCc(): array
{
    return [
        '国分ハウジング' => 'kh@kh-group.jp,lead@kh-group.jp,kh-t@kh-house.jp',
        'デイジャストハウス' => 'info-djh@royalhome.co.jp,djh@kh-group.jp',
        'なごみ工務店' => 'nagomi@kh-group.jp,nagomi@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com',
        'ニーエルホーム' => '2lhome@kh-group.jp,2lhome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com',
        'フルコミホーム' => 'furukomihome@kh-group.jp,furukomihome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com',
        'ジャスフィーホーム' => 'jh@kh-group.jp',
        'PG HOUSE' => 'pghouse@kh-house.jp,koukoku@pure-growth.net,pghouse@pure-growth.net,pgh@kh-group.jp',
        'かえるホーム' => 'kaeru@kh-house.jp',
    ];
}

// ---------------------------------------------------------------------------
// メール（② の mail.ts / mailTemplate.ts と同じ文面）
// ---------------------------------------------------------------------------

/** カンマ区切りの宛先を、送ってよい形に直す（⚠️ 改行は区切りとして扱う） */
function cfSafeAddressList($value): array
{
    if (!is_string($value) || $value === '') {
        return [];
    }
    $value = preg_replace('/[\x00-\x1F\x7F]/', ',', $value) ?? '';
    $seen = [];
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && preg_match('/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/', $one)) {
            $seen[$one] = true;
        }
    }
    return array_slice(array_keys($seen), 0, 20);
}

function cfLine(string $label, string $value): string
{
    return trim($value) === '' ? '' : $label . '：' . trim($value) . "\n";
}

/** 入力項目の一覧（{{お問い合わせ内容}}）。⚠️ 並びと文言は ② と同じ */
function cfDetailBlock(array $v): string
{
    $address = trim($v['zip']) === '' ? '' : "郵便番号：{$v['zip']}\n住所：{$v['pref']}{$v['city']}{$v['town']}{$v['street']}\n";
    return cfLine('来場希望場所', $v['shop'])
        . "お名前：{$v['sei']} {$v['mei']}\n"
        . "お名前（カナ）：{$v['seiKana']} {$v['meiKana']}\n"
        . cfLine('来場希望日', $v['date'])
        . cfLine('来場希望時間', $v['time'])
        . cfLine('携帯番号', $v['phone'])
        . cfLine('メールアドレス', $v['mail'])
        . cfLine('LINE ID', $v['lineId'])
        . cfLine('年齢', $v['age'])
        . $address
        . cfLine('お問い合わせのきっかけ', $v['medium'])
        . cfLine('その他ご質問・ご要望', $v['question']);
}

/** 事前アンケートの案内（⚠️ URL が空、または日時が無ければ出さない） */
function cfQuestionnaireBlock(array $v): string
{
    if ($v['questionnaire'] === '' || ($v['date'] === '' && $v['time'] === '')) {
        return '';
    }
    return "\n▼事前アンケートでギフトカードプレゼント！\n\n{$v['questionnaire']}\n";
}

/** ひな型に値を差し込む。⚠️ 知らない語はそのまま残す */
function cfRender(string $template, array $v): string
{
    $table = [
        'お名前' => "{$v['sei']} {$v['mei']}",
        '姓' => $v['sei'],
        '名' => $v['mei'],
        'お名前カナ' => "{$v['seiKana']} {$v['meiKana']}",
        'お問い合わせ内容' => cfDetailBlock($v),
        'キャンペーン名' => $v['campaign'],
        'ブランド名' => $v['brandName'],
        '受付日時' => $v['receivedAt'],
        '来場希望場所' => $v['shop'],
        '来場希望日' => $v['date'],
        '来場希望時間' => $v['time'],
        '携帯番号' => $v['phone'],
        'メールアドレス' => $v['mail'],
        'LINE ID' => $v['lineId'],
        '年齢' => $v['age'],
        '事前アンケート' => cfQuestionnaireBlock($v),
        '事前アンケートURL' => $v['questionnaire'],
    ];
    return preg_replace_callback('/\{\{([^{}]{1,40})\}\}/u', function ($m) use ($table) {
        $key = trim($m[1]);
        return array_key_exists($key, $table) ? $table[$key] : $m[0];
    }, $template) ?? $template;
}

/** ひな型を選ぶ。⚠️ 空（空白だけを含む）なら既定 */
function cfPick($stored, string $fallback): string
{
    return trim((string)$stored) === '' ? $fallback : (string)$stored;
}

function cfDefaultThanksSubject(): string
{
    return '{{ブランド名}}/お問い合わせありがとうございます。';
}

function cfDefaultThanksBody(): string
{
    return "{{お名前}} 様\n"
        . "お問い合わせを受け付けました。\n\n"
        . "お問い合わせ内容は以下となります。\n\n"
        . '{{お問い合わせ内容}}'
        . "\nこちらのメールは配信用のため返信できません。\n"
        . "ご意見・ご要望はご予約の店舗までお寄せください。\n\n"
        . '※お問い合わせいただいた日時が18:00以降または火曜日、水曜日の場合、'
        . "翌営業日以降のご連絡となりますのであらかじめご了承ください。\n"
        . '{{事前アンケート}}';
}

/** ⚠️ デイジャストハウスの会員登録だけ既定の本文が別（ひな型が空のときだけ） */
function cfDefaultMemberBody(): string
{
    return "{{お名前}} 様\n\n"
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
        . "デイジャストハウスではお客様との出会いを大切に誠実に丁寧に対応させていただきます。\n"
        . "なんでもお気軽にご相談・お問い合わせください。\n\n"
        . 'デイジャストハウス';
}

function cfDefaultInternalSubject(): string
{
    return '{{ブランド名}}/{{キャンペーン名}}からの登録がありました。';
}

function cfDefaultInternalBody(): string
{
    return "{{キャンペーン名}}からの登録がありました。\n\n"
        . "お問合わせ日時：{{受付日時}}\n\n"
        . "====================\nお客様情報\n====================\n"
        . '{{お問い合わせ内容}}'
        . "====================\n"
        . "※のちほどダッシュボードへ反映されます。\n";
}

/**
 * 文字だけのメールを送る（UTF-8）。⚠️ 宛先は cfSafeAddressList を通したものだけ。
 * ⚠️ 件名・差出人名は mb_send_mail / mb_encode_mimeheader がエンコードする（改行は先に除く）
 */
function cfSendMail(array $to, array $cc, string $subject, string $body, string $fromName): bool
{
    if (!$to) {
        return false;
    }
    mb_language('uni');
    mb_internal_encoding('UTF-8');
    $subject = preg_replace('/[\x00-\x1F\x7F]/', ' ', $subject) ?? '';
    $fromName = preg_replace('/[\x00-\x1F\x7F]/', ' ', $fromName) ?? '';
    $headers = 'From: ' . ($fromName !== '' ? mb_encode_mimeheader($fromName, 'UTF-8') . ' ' : '') . '<' . CF_MAIL_FROM . '>';
    if ($cc) {
        $headers .= "\r\nCc: " . implode(',', $cc);
    }
    return mb_send_mail(implode(',', $to), $subject, $body, $headers);
}

// ---------------------------------------------------------------------------
// 流量制限（全体で1分に30件まで）
// ---------------------------------------------------------------------------

function cfRateLimited(): bool
{
    $fp = @fopen(sys_get_temp_dir() . '/campaign_form_entry_rate.json', 'c+');
    if ($fp === false) {
        error_log('campaign_form: 送信回数の記録ファイルを開けません（制限せずに続ける）');
        return false;
    }
    flock($fp, LOCK_EX);
    $times = json_decode((string)stream_get_contents($fp), true);
    $now = time();
    $times = array_values(array_filter(is_array($times) ? $times : [], function ($t) use ($now) {
        return $now - (int)$t < CF_RATE_WINDOW;
    }));
    $limited = count($times) >= CF_RATE_LIMIT;
    if (!$limited) {
        $times[] = $now;
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($times));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $limited;
}

// ---------------------------------------------------------------------------
// 振り分け
// ---------------------------------------------------------------------------

$roll = is_string($data['roll'] ?? null) ? $data['roll'] : '';

if ($roll !== 'public' && $roll !== 'entry') {
    // ⚠️ 管理画面の roll はここで処理しない（上の説明）。以前と同じ 404
    cfRespond(404, ['status' => 'error', 'message' => '該当する処理がありません。']);
}

// ---- フォームの初期表示（② の runCampaignFormPublic と同じ） ----
if ($roll === 'public') {
    $brand = cfClean($data['brand'] ?? '', 30);
    $campaignId = cfClean($data['campaign_id'] ?? '', 120);
    try {
        // ⚠️⚠️ mail_to / mail_cc を返さない（移植元は SELECT * で通知先をブラウザへ返していた）
        $stmt = $pdo->prepare(
            'SELECT campaign, campaign_id, brand, url, tag, redirect, thanks, notice,'
            . ' name, kana, age, phone, mail, line_id, address, question, shop, date, medium, attention'
            . ' FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1'
        );
        $stmt->execute([$brand, $campaignId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log('campaign_form:public: form_table を読めません: ' . $e->getMessage());
        cfRespond(500, ['status' => 'error', 'message' => 'フォームを読み込めませんでした。']);
    }
    // ⚠️ 表示の記録。⚠️ 失敗しても画面は出す
    try {
        $pdo->prepare('INSERT INTO form_show (time, brand, campaign, url, source, campaign_name) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([date('Y/m/d H:i:s'), $brand, $campaignId, cfClean($data['url'] ?? '', 500), cfClean($data['source'] ?? '', 200), cfClean($data['campaign'] ?? '', 120)]);
    } catch (PDOException $e) {
        error_log('campaign_form:public: form_show への記録に失敗: ' . $e->getMessage());
    }
    error_log("campaign_form:public を ① で受けました（② に届かなかった） brand=\"{$brand}\" campaign_id=\"{$campaignId}\"");
    cfRespond(200, ['status' => $row ? 'success' : 'empty', 'data' => $row ?: null]);
}

// ---- 反響の受付（② の runCampaignFormEntry と同じ） ----
if (cfRateLimited()) {
    error_log('campaign_form:entry: 送信が多すぎるため断りました');
    cfRespond(429, ['status' => 'error', 'message' => '登録に失敗しました。']);
}

$a = [
    'sei' => cfClean($data['sei'] ?? '', 60),
    'mei' => cfClean($data['mei'] ?? '', 60),
    'seiKana' => cfClean($data['seiKana'] ?? '', 60),
    'meiKana' => cfClean($data['meiKana'] ?? '', 60),
    'zip' => cfClean($data['zip'] ?? '', 10),
    'pref' => cfClean($data['pref'] ?? '', 20),
    'city' => cfClean($data['city'] ?? '', 60),
    'town' => cfClean($data['town'] ?? '', 60),
    'street' => cfClean($data['street'] ?? '', 120),
    'phone' => cfClean($data['phone'] ?? '', 30),
    'mail' => cfClean($data['mail'] ?? '', 190),
    // ⚠️ LINE ID は空白を除くだけ（形は確かめない）
    'lineId' => mb_substr(preg_replace('/\s+/u', '', cfClean($data['line_id'] ?? '', 200)) ?? '', 0, 100, 'UTF-8'),
    'age' => cfClean($data['age'] ?? '', 20),
    'shop' => cfClean($data['shop'] ?? '', 80),
    'date' => cfClean($data['date'] ?? '', 20),
    'time' => cfClean($data['time'] ?? '', 20),
    'medium' => cfClean($data['medium'] ?? '', 60),
    'question' => cfCleanMultiline($data['question'] ?? '', 2000),
    'campaign' => cfClean($data['campaign'] ?? '', 120),
    'campaignId' => cfClean($data['campaign_id'] ?? '', 120),
    'url' => cfClean($data['url'] ?? '', 500),
    'source' => cfClean($data['source'] ?? '', 200),
    'urlParams' => cfClean($data['url_params'] ?? '', 2000),
    'landingParams' => cfClean($data['landing_params'] ?? '', 2000),
];
$rawBrand = cfClean($data['brand'] ?? '', 30);

if ($a['campaignId'] === '') {
    cfRespond(400, ['status' => 'error', 'message' => '登録に失敗しました。']);
}

// ⚠️ KHG 共通フォームかどうかは「来場希望場所」（ブランド名）で判定する（brand は送信前に書き換えられている）
$khgBrand = cfKhgBrand();
$isKhgForm = isset($khgBrand[$a['shop']]);
$lookupBrand = cfFormTableBrand($rawBrand, $isKhgForm);

try {
    // ⚠️⚠️ 通知先・サンクスの可否は必ずここから（リクエストの値は使わない）
    $stmt = $pdo->prepare(
        'SELECT campaign, campaign_id, brand, mail_to, mail_cc, redirect, thanks,'
        . ' thanks_subject, thanks_body, internal_subject, internal_body'
        . ' FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1'
    );
    $stmt->execute([$lookupBrand, $a['campaignId']]);
    $form = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
} catch (PDOException $e) {
    // ⚠️ 設定が読めなくても反響は捨てない（メールが出せないだけ）
    error_log('campaign_form:entry: form_table を読めません: ' . $e->getMessage());
    $form = null;
}
if ($form === null) {
    error_log("campaign_form:entry: form_table に無い組み合わせです brand=\"{$rawBrand}\" 引いたキー=\"{$lookupBrand}\" campaign_id=\"{$a['campaignId']}\"");
}

$effectiveBrand = $isKhgForm ? ($khgBrand[$a['shop']] ?? $rawBrand) : $rawBrand;
$spec = cfBrandSpec($effectiveBrand);
if ($spec === null) {
    error_log("campaign_form:entry: 知らないブランドです brand=\"{$rawBrand}\"");
}
$brandValue = $spec['value'] ?? '';
// ⚠️ 来場希望場所が空なら「◯◯店舗未設定」（② と同じ）
$shopValue = ($spec['shopPrefix'] ?? '') . ($a['shop'] === '' ? '店舗未設定' : $a['shop']);
$now = time();

try {
    // ⚠️⚠️ ② が保存した直後にタイムアウトして ① へ回った送信。保存もメールもせずに成功を返す
    $contact = [];
    $params = [$a['campaign'], 'form' . date('YmdHis', $now - CF_DEDUP_SECONDS)];
    if ($a['mail'] !== '') {
        $contact[] = 'mail = ?';
        $params[] = $a['mail'];
    }
    if ($a['phone'] !== '') {
        $contact[] = 'mobile = ?';
        $params[] = $a['phone'];
    }
    if ($contact) {
        $stmt = $pdo->prepare(
            "SELECT id FROM inquiry_customer WHERE hp_campaign = ? AND inquiry_id LIKE 'form%' AND inquiry_id >= ?"
            . ' AND (' . implode(' OR ', $contact) . ') LIMIT 1'
        );
        $stmt->execute($params);
        if ($stmt->fetch()) {
            error_log("campaign_form:entry: ② が10分以内に保存済みのため ① では保存しません campaign_id=\"{$a['campaignId']}\"");
            cfRespond(200, ['status' => 'success', 'message' => "{$a['campaign']}の登録に成功しました。"]);
        }
    }

    // ⚠️ NOT NULL の列をすべて埋める（② の NOT_NULL_COLUMNS と同じ）。⚠️ line_id・url_params・landing_params は NULL 可
    $notNullColumns = [
        'inquiry_id', 'pg_id', 'mhl_id', 'mhl_url', 'mhl_mail', 'inquiry_date',
        'medium', 'response_medium',
        'first_name', 'last_name', 'first_name_kana', 'last_name_kana',
        'mobile', 'landline', 'mail',
        'zip', 'pref', 'city', 'town', 'street', 'building',
        'brand', 'shop', 'sync', 'staff', 'area',
        'reserved_date', 'reserved_time', 'black_list', 'hp_campaign',
        'delete_flag', 'duplicate', 'note',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'referrer', 'first_visit', 'hotlead_url', 'remarks',
    ];
    $values = array_fill_keys($notNullColumns, '');
    $values['sync'] = 0;
    $values['delete_flag'] = 0;
    // ⚠️ ① で保存した反響は homepage で始まる（移植元と同じ。② の form と見分けられる）
    $values['inquiry_id'] = 'homepage' . date('YmdHis', $now) . $a['campaignId'];
    $values['inquiry_date'] = date('Y/m/d', $now);
    $values['medium'] = 'ホームページ反響';
    $values['response_medium'] = $a['medium'];
    $values['brand'] = $brandValue;
    $values['shop'] = $shopValue;
    // ⚠️⚠️ 姓と名は「逆」で保存する（first_name に姓）。既存データと同じ形
    $values['first_name'] = $a['sei'];
    $values['last_name'] = $a['mei'];
    $values['first_name_kana'] = $a['seiKana'];
    $values['last_name_kana'] = $a['meiKana'];
    $values['zip'] = $a['zip'];
    $values['pref'] = $a['pref'];
    $values['city'] = $a['city'];
    $values['town'] = $a['town'];
    $values['street'] = $a['street'];
    $values['mobile'] = $a['phone'];
    $values['mail'] = $a['mail'];
    $values['reserved_date'] = $a['date'];
    $values['reserved_time'] = $a['time'];
    $values['hp_campaign'] = $a['campaign'];
    $values['remarks'] = $a['question'];
    $values['line_id'] = $a['lineId'] === '' ? null : $a['lineId'];
    $values['url_params'] = $a['urlParams'] === '' ? null : $a['urlParams'];
    $values['landing_params'] = $a['landingParams'] === '' ? null : $a['landingParams'];

    $columns = array_keys($values);
    $stmt = $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')');
    $stmt->execute(array_values($values));
} catch (PDOException $e) {
    // ⚠️ 例外の中身は応答に含めない（SQL や列名が漏れる）
    error_log("campaign_form:entry: inquiry_customer への保存に失敗 campaign_id=\"{$a['campaignId']}\" mail=\"{$a['mail']}\" phone=\"{$a['phone']}\": " . $e->getMessage());
    cfRespond(500, ['status' => 'error', 'message' => '登録に失敗しました。']);
}
error_log("campaign_form:entry を ① で受け付けました（② に届かなかった） campaign_id=\"{$a['campaignId']}\" brand=\"{$brandValue}\" shop=\"{$shopValue}\"");

// ---- pgcloud へも残す（⚠️ 失敗しても反響は保存済みなので続ける） ----
try {
    $pdo->prepare(
        'INSERT INTO pgcloud (タイムスタンプ, ブランド, 店舗, 姓, 名, セイ, メイ, 郵便番号,'
        . ' 都道府県, `市・区`, `町村・番地`, `ビル名・建物名`, ご予約のきっかけ, その他質問,'
        . ' 希望日, 希望時間, 携帯番号, メールアドレス, 年齢, キャンペーン名, キャンペーンID)'
        . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        date('Y/m/d H:i:s', $now), $brandValue, $a['shop'], $a['sei'], $a['mei'], $a['seiKana'], $a['meiKana'], $a['zip'],
        $a['pref'], $a['city'], $a['town'], '', $a['medium'], $a['question'],
        $a['date'], $a['time'], $a['phone'], $a['mail'], $a['age'], $a['campaign'], $a['campaignId'],
    ]);
} catch (PDOException $e) {
    error_log('campaign_form:entry: pgcloud への保存に失敗: ' . $e->getMessage());
}

// ---- コンバージョンを記録する ----
try {
    $pdo->prepare('INSERT INTO form_cv (time, brand, campaignName, campaignId, url, source) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([date('Y/m/d H:i:s', $now), $rawBrand, $a['campaign'], $a['campaignId'], $a['url'], $a['source']]);
} catch (PDOException $e) {
    error_log('campaign_form:entry: form_cv への記録に失敗: ' . $e->getMessage());
}

// ---- メール2通（⚠️ 保存が終わってから。⚠️ 2通は別々に送る） ----
$v = $a + [
    'brandName' => $spec['name'] ?? '',
    'receivedAt' => date('Y/m/d H:i:s', $now),
    'questionnaire' => cfQuestionnaire($spec, $a['shop']),
];

if ($form !== null && (int)$form['thanks'] === 1 && $a['mail'] !== '') {
    $to = cfSafeAddressList($a['mail']);
    $defaultBody = $a['campaignId'] === CF_MEMBER_CAMPAIGN_ID ? cfDefaultMemberBody() : cfDefaultThanksBody();
    $subject = cfRender(cfPick($form['thanks_subject'] ?? '', cfDefaultThanksSubject()), $v);
    $body = cfRender(cfPick($form['thanks_body'] ?? '', $defaultBody), $v);
    if (!$to) {
        error_log('campaign_form:entry: サンクスメールの宛先が不正です');
    } elseif (!cfSendMail($to, [], $subject, $body, $v['brandName'])) {
        error_log("campaign_form:entry: サンクスメールを送れませんでした name=\"{$a['sei']} {$a['mei']}\"");
    }
}

if ($form !== null) {
    $to = cfSafeAddressList($form['mail_to'] ?? '');
    // ⚠️ KHG 共通フォームのときだけ店舗別の Cc で上書きする
    $khgCc = cfKhgCc();
    $cc = cfSafeAddressList($isKhgForm ? ($khgCc[$a['shop']] ?? ($form['mail_cc'] ?? '')) : ($form['mail_cc'] ?? ''));
    $v['questionnaire'] = '';
    $subject = cfRender(cfPick($form['internal_subject'] ?? '', cfDefaultInternalSubject()), $v);
    $body = cfRender(cfPick($form['internal_body'] ?? '', cfDefaultInternalBody()), $v);
    if (!$to) {
        error_log("campaign_form:entry: 社内通知の宛先がありません campaign=\"{$a['campaign']}\"");
    } elseif (!cfSendMail($to, $cc, $subject, $body, $v['brandName'])) {
        // ⚠️ 社内が気づけないと反響が放置される。必ず残す
        error_log("campaign_form:entry: 社内通知を送れませんでした campaign=\"{$a['campaign']}\" name=\"{$a['sei']} {$a['mei']}\" mail=\"{$a['mail']}\" phone=\"{$a['phone']}\"");
    }
}

cfRespond(200, ['status' => 'success', 'message' => "{$a['campaign']}の登録に成功しました。"]);
```

### backend/scripts/brand_form_api/index.php（新規）
```php
<?php

/**
 * 公開フォーム用のプロキシ（② が落ちたときの退避先）。（v2.2.213 で転送先を付け替えた）
 *
 * 配置先: 各ブランドサイトの `form/api/index.php`（**8サイト**）
 *
 *   https://kh-house.jp/form/api/
 *   https://day-just-house.com/form/api/
 *   https://www.nagomi-koumuten.jp/form/api/
 *   https://furukomi-home.com/form/api/
 *   https://2lhome.net/form/api/
 *   https://miyazaki.pg-house.jp/form/api/
 *   https://jusfy-home.com/form/api/
 *   https://kh-house.jp/khg/form/api/
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **このファイルには認証情報を書かないこと。** 転送するだけの役目である。DB には触らない。
 *
 * ⚠️⚠️ **2026-10-23（v2.2.213）に転送先を付け替えた。**
 *   ⚠️ 以前の転送先 `https://khg-marketing.info/api/`（Authorization ヘッダで振り分ける PHP）は**誤って消えた**。
 *   ⚠️ 新しい転送先は ① ダッシュボードのゲートウェイ `https://khg-marketing.info/dashboard/api/gateway/` の
 *     `campaign_form`（handlers/campaign_form.php。② の campaign_form の予備）。
 *   ⚠️ ゲートウェイは本文の `request` / `roll` で振り分けるので、ヘッダを読み替えて本文に入れる:
 *       Authorization: form_get      → request: campaign_form, roll: public（フォームの設定の読み込み）
 *       Authorization: form_register → request: campaign_form, roll: entry （反響の受付）
 *   ⚠️ それ以外の Authorization は断る（以前の転送先にあった他の口は、ここからは使われていない）。
 *
 * ⚠️ 公開フォーム（form_get の gateway.ts）は ② に届かなかったときだけここへ来る。ふだんは使われない。
 *
 * ⚠️⚠️ **2026-09-16 に直した2点はそのまま残す。**
 *   1. メールヘッダに入る宛先（mail_to / mail_cc）の無害化（受け側は使わないが二重の防御）
 *   2. デバッグ出力（error_log でヘッダを書き出していた）を置かない
 * ─────────────────────────────────────────────
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

/** ⚠️ 転送先。⚠️ 環境変数はテスト用（本番のブランドサイトでは設定しない） */
$targetUrl = getenv('FORM_GATEWAY_URL') ?: 'https://khg-marketing.info/dashboard/api/gateway/';

/** Authorization ヘッダ → ゲートウェイの roll */
$rolls = [
    'form_get' => 'public',
    'form_register' => 'entry',
];

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authToken = $headers['Authorization'] ?? ($headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? null));

// ⚠️⚠️ デバッグ出力は置かないこと（以前は全リクエストのヘッダをログに書き続けていた）

if (json_last_error() !== JSON_ERROR_NONE || !is_array($data) || empty($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

if (!$authToken) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Missing Authorization header']);
    exit;
}

if (!isset($rolls[$authToken])) {
    http_response_code(404);
    echo json_encode(['status' => 'error', 'message' => 'Unknown Authorization']);
    exit;
}

/**
 * ⚠️ メールヘッダに入りうる宛先を無害化する（⚠️ 改行は「削除」ではなく「カンマに置換」）。
 * ⚠️ 受け側（campaign_form.php）は通知先を form_table から引くので使わないが、二重の防御として残す。
 */
function safeAddressList($value)
{
    if (!is_string($value) || $value === '') {
        return '';
    }
    $value = str_replace(array("\r", "\n", "\t"), ',', $value);
    $clean = array();
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && filter_var($one, FILTER_VALIDATE_EMAIL)) {
            $clean[] = $one;
        }
    }
    return implode(',', array_slice(array_unique($clean), 0, 20));
}

foreach (array('mail_to', 'mail_cc') as $key) {
    if (isset($data[$key])) {
        $data[$key] = safeAddressList($data[$key]);
    }
}

// ⚠️ ゲートウェイの振り分けに使う値。⚠️ フォームが送ってきた request / roll は上書きする
$data['request'] = 'campaign_form';
$data['roll'] = $rolls[$authToken];

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data, JSON_UNESCAPED_UNICODE));
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 25);

$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode === 0) {
    error_log('form/api: 転送に失敗しました: ' . $curlError);
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => '通信エラーが発生しました。']);
    exit;
}

http_response_code($httpCode);
echo $response;
```

### backend/scripts/sql/2026-10-23_djh_member_thanks_mail.sql（新規）
```sql
-- =====================================================================
-- デイジャストハウスの会員登録（20240000_djh_kyotsu_member）のサンクスメールに
-- 会員限定プランのログイン情報（ユーザー名・パスワード）を入れる（v2.2.213）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
--
-- ⚠️ 起きていたこと:
--   ② は「このキャンペーンで本文のひな型（thanks_body）が空のとき」だけ会員用の本文を送る。
--   本番の行にひな型（反響内容の文面）が入っていると、ログイン情報の無いメールになる。
--   → ひな型に会員用の本文をはっきり入れて、既定の特例に頼らないようにする。
-- ⚠️ 本文は以前の ① の PHP と同じ（{{お名前}} は送信時に「姓 名」が入る）。
-- ⚠️ キャンペーン作成画面で、この文面を後から直すこともできる（「このキャンペーン専用」になる）。
-- =====================================================================

-- ① 実行前：今の値を見て、念のため控えておく（戻すときはこの値を入れ直す）
SELECT id, brand, campaign_id, thanks, thanks_subject, thanks_body
  FROM form_table
 WHERE brand = 'djh' AND campaign_id = '20240000_djh_kyotsu_member';

-- ② 書き換え（⚠️ 1行だけ変わること）
UPDATE form_table
   SET thanks_subject = '{{ブランド名}}/お問い合わせありがとうございます。',
       thanks_body = '{{お名前}} 様

お世話になっております。
デイジャストハウスです。

この度は、会員登録にお申込みいただき、誠にありがとうございます。
登録が無事完了いたしました。

限定コンテンツログイン情報をお送りいたします。
大切に保管をお願いいたします。

───────────────────────────────
●会員限定公開プラン　ログイン情報
───────────────────────────────

ユーザー名：dayjust
パスワード：plan

厳選プランページURL：
https://day-just-house.com/plan/

上記ご案内したログイン情報より弊社ホームページの会員限定公開プランの閲覧が可能です。

デイジャストハウスではお客様との出会いを大切に誠実に丁寧に対応させていただきます。
なんでもお気軽にご相談・お問い合わせください。

デイジャストハウス'
 WHERE brand = 'djh' AND campaign_id = '20240000_djh_kyotsu_member';

-- ③ 確認：thanks が 1・件名と本文が入っていること（thanks が 0 だとサンクスメール自体が飛ばない）
SELECT id, brand, campaign_id, thanks, thanks_subject, LEFT(thanks_body, 80) AS thanks_body_head
  FROM form_table
 WHERE brand = 'djh' AND campaign_id = '20240000_djh_kyotsu_member';
```

### backend/scripts/sql/2026-10-23_update_log_2.2.213.sql（新規）
```sql
-- =====================================================================
-- update_log に v2.2.213 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.213', '2026-10-23', 'キャンペーンフォームの受付が止まったときの予備を作り直した（以前の予備は誤って消えていた）。予備で受けた反響も同じく反響一覧に入り、メールも届く。デイジャストハウスの会員登録のお礼メールに、会員限定プランのログイン情報が入るようにした。');
```
