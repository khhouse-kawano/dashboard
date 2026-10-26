# オーナーズハウス募集フォームの作り直し（v2.2.215）

## 依頼
- ダウンロードフォルダの ownershouse_form（Astro）を参照して、オーナーズハウス募集を作り直す（別のフレームワークでもよい）
- 届いた内容はメール＋Dashboard（DB）に保存。今までのメールも全部取り込む GAS も作る
- ①オーナー募集フォームを先に、②見学の予約（registration の owners_house）は後で

## 以前のフォームの問題
- **step3.php が、送られたファイルを中身も拡張子も確かめず、元のファイル名のまま公開フォルダ photo/ に保存していた**（`xxx.php` を置いて実行できた）
- 入力値をそのまま画面・メールの HTML に入れていた（XSS）
- 受付は社内メールだけで、どこにも残っていなかった（写真はサーバーの photo/ にばらばらに残る）

## 承認した計画と作ったもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/scripts/sql/ | **2026-10-23_owners_house_application.sql**（新規） | 表 `owners_house_application`（受付日時・経路 form/mail・メールの ID（UNIQUE）・お名前・郵便番号・店舗・担当・写真の扱い・写真の JSON・タイトル・見どころ①〜⑤）。ローカルにも作成済み |
| backend/src/handlers/ | **owners_house_application.php**（新規） | ① のフォーム受付（multipart）。`ohaRespond` `ohaClean` `ohaRateLimited` |
| backend-express/src/features/ownersHouse/ | **application.ts**（新規） | `listOwnersHouseApplications`（一覧）・`importOwnersHouseApplication`（過去メールの取り込み） |
| backend-express/src/gateway/ | registry.ts | `owners_house_application_list`（staff）・`owners_house_application_import`（合い言葉） |
| backend/src/core/ | express_proxy.php | 許可リストと expressProxyExclusive() の両方に list / import（⚠️ フォームの受付は入れない） |
| frontend/src/components/header/ | **OwnersHouseApplication.tsx**（新規） | 画面「反響管理 → オーナーズハウス募集」（GoogleReview.tsx の形。接頭辞 oh_） |
| frontend/src/components/header/ | Header.tsx | 反響管理のメニュー・editMapping・isFullscreenMenu に追加 |
| frontend/src/components/guide/ | guideScreens.ts | `'オーナーズハウス募集': { menu: '反響管理/オーナーズハウス募集' }` |
| backend/scripts/owners_house_form/ | **index.html・form.css・form.js・api.php・photo.htaccess**（新規） | kh-house.jp に置く新しいフォーム一式 |
| backend/scripts/gas/ | **OwnersHouseMailImport.gs**（新規） | 過去の通知メールの取り込み（手で実行） |
| backend/scripts/guide/articles/common/ | **screen-220.md**（新規） | 業務ガイドの記事「オーナーズハウス募集」 |
| backend/scripts/sql/ | **2026-10-23_update_log_2.2.215.sql**（新規） | update_log ＋記事（ローカル no=315・記事 id=109 で反映済み） |
| frontend/src/utils/ | version.ts | 2.2.215 |
| docs/ | deploy-v2.2.215.md（新規）・本書 | |

### 決めごと
- **フォームはビルド不要の HTML＋JS**（Astro をやめた）。上の LP 部分（画像・協力報酬・注意事項）は以前の Astro の書き出しと CSS（_astro/）をそのまま使い、入力フォームから下を作り直した
  - 見た目は協力業者様募集フォーム・form_get と同じ（接頭辞 .pf）。流れは「1 基本情報 → 2 写真・見どころ → 3 確認 → 4 完了」の1ページ
  - 写真はブラウザで長辺1920px の JPEG に縮小してから送る（スマホの写真は10MB を超える）
  - 以前からあった PC での横スクロール（LP の画像の上の文字が80px はみ出す）を form.css で切った
- **送信の経路**：ブラウザ → 同じサイトの api.php（転送だけ）→ ① `/dashboard/api/gateway/`（`request: owners_house_application`）
  - ブラウザから khg-marketing.info へ直接送らない（広告で除外されたドメイン）
  - **写真を含むので ① だけで受ける**（k-snap と同じく `/dashboard/api/images/` に `ksnapSaveUploadedImage` で保存。拡張子・中身・サイズを確かめ、ファイル名はサーバーで作る）。② には転送しない
- 項目の確かめ：お名前・タイトル・見どころ①②は必須、郵便番号7桁、店舗は選択肢のどれか、長さの上限。見えない入力欄（website_url）が埋まっていたら保存せず成功を返す。全体で10分に20件まで
- 社内メール：宛先は以前の regist.php と同じ6か所。文字だけ。写真のリンク付き。**件名を変えた**（「【オーナーズハウス募集】◯◯様からの応募がありました」）。過去メールの取り込み GAS が新しいメールを取り込まないように
- 過去メールの取り込み：件名「オーナーズハウスへの募集がありました」のメールを全期間読み、HTML の「見出し:値」から取り出す。Gmail の ID で二重にしない。⚠️ 写真はメールに入っていないので無い（画面にも注記）
- 画面：ブランド（店舗名の頭）・写真の扱い・検索で絞り込み、KPI（応募・撮影を依頼・写真を添付・過去メールから）、見出しで並べ替え、行の下に見どころと写真

## 確かめたこと
1. **① の受け口**（① のコンテナの中で PHP の組み込みサーバーを動かし、メールをファイルに書き出して確認）
   - 見えない入力欄あり → 200 だが保存しない／名前なし・店舗が選択肢に無い・郵便番号6桁 → 400（fields で項目を返す）
   - 撮影を依頼 → 保存（写真なし）・社内メール6か所・件名が新しい形
   - 添付なのに外観なし → 400／**偽の画像（中身は PHP）→ 400**（ksnap: 画像として解釈できません）／**`x.php` の名前 → 400**（許可されない拡張子）。⚠️ 途中まで保存した写真は消える（画像フォルダに残らない）
   - 写真3枚 → 保存（ファイル名はサーバーが作った名前）・メールに写真のリンク
   - 全角の郵便番号「８９９-４３３２」→ 8994332
2. **① の Apache 経由**（localhost:8080）でも保存できる
3. **② の取り込み・一覧（① 経由）**：合い言葉なし 401／名前なし 400／取り込み success／もう一度 exists／一覧はトークンなしで 401、スタッフのトークンで rows が返る
   - GAS の読み取り：以前の regist.php と同じ HTML から名前（様を外す）・郵便番号・店舗・担当・写真の扱い・タイトル（`&amp;` を戻す）・見どころ（値の中のコロンを残す）。新しい件名・返信は送らない
4. **フォームの画面**（Playwright・390px／1280px。PHP 8.0 で api.php を動かし、① へ転送）
   - 空のまま次へ → 3項目のエラー／Enter で進まない／写真を添付で写真なし → 3つのエラー／写真3枚を選ぶと縮小して見本が出る／確認に写真3枚・郵便番号 899-4332／戻っても値が残る／申し込み → 完了「画面 検証 様」／JS のエラーなし
   - 撮影を依頼（PC）→ 完了。`<script>` は文字のまま保存
   - 横スクロール：390・768・1280・1920px とも無し
5. **Dashboard の画面**（Playwright。開発サーバーで、ローカルのスタッフ1人に一時的なトークンを入れて確認。⚠️ 終わってから元に戻した）
   - 6行・KPI（6／3／3／1）・ブランドの絞り込み（なごみ → 1行）・並べ替え・見どころと写真の展開。入力値の `<script>` は文字のまま（実行されない）
   - ⚠️ 写真は本番の URL（/dashboard/api/images/）を指すので、ローカルのテスト画像は表示されない（本番では表示される）
6. 回帰：member_entry・kagosuma_entry・tochishinchaku_entry・myhomes_entry も ① 経由で 401
7. `php -l`（PHP 8.2・8.0）・`node --check form.js`・② の `tsc --noEmit` OK。フロントは開発サーバーで警告なし（Header.tsx 59行目の既存の警告だけ）
8. 後片付け：テストの行（6行）・テストの画像・一時的な画像フォルダ（ローカルの backend/src/images）を削除、スタッフのトークンを元に戻した、テスト用のサーバーを止めた

## 残りの作業
- ⏳ ②見学の予約（`registration` の `owners_house`。react/owners_house の Owners.tsx → Heroku の中継 → 消えた php）
- ⏳ `registration` の `homepage`（簡単見積もり JH・2L、proposal）。9月上旬から止まっていると思われる
- 済み：form_*、beforeSurvey、call_sheet、geo_info、tochishinchaku、myhomes、オーナー募集フォーム（本書）

## コード

### backend/scripts/sql/2026-10-23_owners_house_application.sql
```sql
-- =====================================================================
-- オーナーズハウス募集（オーナー様が自宅を見学先として登録するフォーム）の受付を残す表（v2.2.215）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ローカルにも流す
-- ⚠️ 書き込むのは:
--   - ① handlers/owners_house_application.php（フォームからの受付。写真は /dashboard/api/images/）
--   - ② owners_house_application_import（過去の通知メールの取り込み。GAS OwnersHouseMailImport）
-- ⚠️ 読むのは ② owners_house_application_list（Dashboard の「反響管理 → オーナーズハウス募集」）
-- ⚠️ 2回流しても壊れない（IF NOT EXISTS）
-- =====================================================================
CREATE TABLE IF NOT EXISTS owners_house_application (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    received_at DATETIME NOT NULL COMMENT '受付日時（日本時間）',
    source VARCHAR(10) NOT NULL DEFAULT 'form' COMMENT 'form＝フォーム / mail＝過去の通知メールから取り込み',
    mail_message_id VARCHAR(100) NULL DEFAULT NULL COMMENT '取り込んだ通知メールの Gmail の ID（二重取り込みの防止）',
    name VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'お施主様名',
    zip VARCHAR(10) NOT NULL DEFAULT '' COMMENT '郵便番号',
    shop VARCHAR(60) NOT NULL DEFAULT '' COMMENT 'ご契約店舗（フォームの選択肢の文字のまま。例 国分ハウジング霧島店）',
    staff VARCHAR(60) NOT NULL DEFAULT '' COMMENT '担当営業（自由入力）',
    photo_mode VARCHAR(20) NOT NULL DEFAULT '' COMMENT '撮影を依頼する / 写真を添付する',
    photos TEXT NULL DEFAULT NULL COMMENT '添付写真のファイル名の JSON 配列（/dashboard/api/images/ の中）',
    title VARCHAR(200) NOT NULL DEFAULT '' COMMENT 'ご自宅のタイトル',
    feature1 VARCHAR(300) NOT NULL DEFAULT '' COMMENT 'ご自宅の見どころ①',
    feature2 VARCHAR(300) NOT NULL DEFAULT '',
    feature3 VARCHAR(300) NOT NULL DEFAULT '',
    feature4 VARCHAR(300) NOT NULL DEFAULT '',
    feature5 VARCHAR(300) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_owners_house_application_mail (mail_message_id),
    KEY idx_owners_house_application_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='オーナーズハウス募集の受付';
```

### backend/src/handlers/owners_house_application.php
```php
<?php

/**
 * オーナーズハウス募集フォーム（kh-house.jp/owners_house/form/）の受付。（v2.2.215）
 *
 * ─────────────────────────────────────────────
 * 経路: フォーム（ブラウザ）──▶ 同じサイトの api.php（転送するだけ）──▶ ここ（multipart）
 *   ⚠️ ブラウザから khg-marketing.info へ直接送らない（広告で除外されたドメインのため。api.php が中継する）
 *   ⚠️ 写真を含むので ② へは転送しない（multipart は express_proxy が転送しない。⚠️ 画像の置き場所は ① の
 *     /dashboard/api/images/ で、k-snap と同じ）。⚠️ 許可リストにも入れていない
 *
 * ⚠️⚠️ **社外の誰でも叩ける書き込み口である。** リクエストの値を一切信用しない。
 *   - 写真は core/ksnap.php の ksnapSaveUploadedImage で保存（拡張子・中身・サイズを確かめ、ファイル名はサーバーで作る）
 *     ⚠️ 以前のフォーム（step3.php）は送られたファイル名のまま公開フォルダへ置いており、PHP を置けた
 *   - 項目の長さ・必須・店舗の選択肢を確かめる。見えない入力欄（website_url）が埋まっていたら送らない
 *   - 全体で10分に20件まで
 * ⚠️ 保存したあと社内へメールを送る（宛先は以前の regist.php と同じ6か所。文字だけ）。
 *   ⚠️ 件名は以前と変えた（過去のメールの取り込み GAS が、新しいメールを取り込まないように）
 * ─────────────────────────────────────────────
 */

require_once __DIR__ . '/../core/ksnap.php';

date_default_timezone_set('Asia/Tokyo');

const OHA_RATE_LIMIT = 20;
const OHA_RATE_WINDOW = 600;
const OHA_MAIL_TO = 'mkt@kh-group.jp,kh@kh-group.jp,djh@kh-group.jp,nagomi@kh-group.jp,2lhome@kh-group.jp,furukomihome@kh-group.jp';
const OHA_MAIL_FROM = 'owners_house@khg-marketing.info';
/** 写真の配信元（⚠️ frontend/src/utils/ksnapImage.ts の DEFAULT_BASE と同じ） */
const OHA_IMAGE_BASE = 'https://khg-marketing.info/dashboard/api/images/';
const OHA_PHOTO_MODES = ['request' => '撮影を依頼する', 'attach' => '写真を添付する'];
/** ⚠️ フォーム（index.html）の「ご契約店舗」の選択肢と同じにすること */
const OHA_SHOPS = [
    '国分ハウジング霧島店', '国分ハウジング姶良店', '国分ハウジング鹿児島店', '国分ハウジング鹿屋店',
    '国分ハウジング薩摩川内店', '国分ハウジング出水阿久根店', '国分ハウジング都城店', '国分ハウジング宮崎店',
    '国分ハウジング延岡店', '国分ハウジング大分店', '国分ハウジング八代店', '国分ハウジング熊本店',
    '国分ハウジング佐賀店',
    'デイジャストハウス鹿児島北店', 'デイジャストハウス鹿児島南店', 'デイジャストハウス姶良店',
    'デイジャストハウス霧島店', 'デイジャストハウス薩摩川内店', 'デイジャストハウス都城店', 'デイジャストハウス宮崎店',
    'なごみ工務店鹿児島店', 'なごみ工務店霧島店', 'なごみ工務店姶良霧島店', 'なごみ工務店薩摩川内店',
    'ニーエルホーム鹿児島店', 'ニーエルホーム霧島店',
    'フルコミホーム鹿児島店', 'フルコミホーム霧島店',
];

function ohaRespond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** 制御文字を空白にし、連続する空白を1つにする（⚠️ 長さはここでは切らない。長すぎれば断る） */
function ohaClean($value): string
{
    if (!is_string($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value) ?? '';
    return trim(preg_replace('/[ 　]+/u', ' ', $text) ?? '');
}

/** 全体の回数制限（⚠️ api.php を経由するので、お客様の IP は見えない） */
function ohaRateLimited(): bool
{
    $fp = @fopen(sys_get_temp_dir() . '/owners_house_application_rate.json', 'c+');
    if ($fp === false) {
        error_log('owners_house_application: 送信回数の記録ファイルを開けません（制限せずに続ける）');
        return false;
    }
    flock($fp, LOCK_EX);
    $times = json_decode((string)stream_get_contents($fp), true);
    $now = time();
    $times = array_values(array_filter(is_array($times) ? $times : [], function ($t) use ($now) {
        return $now - (int)$t < OHA_RATE_WINDOW;
    }));
    $limited = count($times) >= OHA_RATE_LIMIT;
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

// ⚠️ multipart なので $data ではなく $_POST（core/db.php を参照）
if (($_POST['website_url'] ?? '') !== '') {
    // ⚠️ 見えない入力欄が埋まっている＝機械の送信。⚠️ 弾いたことを知らせないため成功を返す
    error_log('owners_house_application: 見えない入力欄が埋まっていたため保存しません');
    ohaRespond(200, ['status' => 'success', 'message' => '受け付けました。']);
}
if (ohaRateLimited()) {
    error_log('owners_house_application: 送信が多すぎるため断りました');
    ohaRespond(429, ['status' => 'error', 'message' => '只今混み合っています。時間をおいて再度お試しください。']);
}

$v = [
    'name' => ohaClean($_POST['name'] ?? ''),
    'zip' => preg_replace('/\D/', '', mb_convert_kana(ohaClean($_POST['zip'] ?? ''), 'n', 'UTF-8')) ?? '',
    'shop' => ohaClean($_POST['shop'] ?? ''),
    'staff' => ohaClean($_POST['staff'] ?? ''),
    'photoMode' => ohaClean($_POST['photo_mode'] ?? ''),
    'title' => ohaClean($_POST['title'] ?? ''),
];
for ($i = 1; $i <= 5; $i++) {
    $v['feature' . $i] = ohaClean($_POST['feature' . $i] ?? '');
}

// ---- 項目を確かめる（⚠️ フォームの JS と同じ。最後はここで確かめる） ----
$limits = ['name' => 50, 'staff' => 50, 'title' => 100, 'feature1' => 200, 'feature2' => 200, 'feature3' => 200, 'feature4' => 200, 'feature5' => 200];
$errors = [];
foreach ($limits as $key => $max) {
    if (mb_strlen($v[$key], 'UTF-8') > $max) {
        $errors[] = $key;
    }
}
foreach (['name', 'title', 'feature1', 'feature2'] as $key) {
    if ($v[$key] === '') {
        $errors[] = $key;
    }
}
if (!preg_match('/^\d{7}$/', $v['zip'])) {
    $errors[] = 'zip';
}
if (!in_array($v['shop'], OHA_SHOPS, true)) {
    $errors[] = 'shop';
}
if (!isset(OHA_PHOTO_MODES[$v['photoMode']])) {
    $errors[] = 'photo_mode';
}
if ($errors) {
    error_log('owners_house_application: 入力が正しくありません fields=' . implode(',', array_unique($errors)));
    ohaRespond(400, ['status' => 'error', 'message' => '入力内容をご確認ください。', 'fields' => array_values(array_unique($errors))]);
}

// ---- 写真（⚠️ 添付を選んだときだけ。外観・内観①②は必須） ----
$photos = [];
if ($v['photoMode'] === 'attach') {
    for ($i = 1; $i <= 5; $i++) {
        $file = $_FILES['photo' . $i] ?? null;
        $hasFile = is_array($file) && (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        if (!$hasFile) {
            if ($i <= 3) {
                ohaRespond(400, ['status' => 'error', 'message' => '外観写真・内観写真①②を添付してください。', 'fields' => ['photo' . $i]]);
            }
            continue;
        }
        $saved = ksnapSaveUploadedImage($file);
        if ($saved === null) {
            // ⚠️ 保存できた分は消す（受け付けないのに写真だけ残らないように）
            foreach ($photos as $name) {
                ksnapDeleteImage($name);
            }
            ohaRespond(400, ['status' => 'error', 'message' => '写真を保存できませんでした。JPG または PNG の写真を選んでください。', 'fields' => ['photo' . $i]]);
        }
        $photos[] = $saved;
    }
}

// ---- 保存 ----
$receivedAt = date('Y-m-d H:i:s');
$id = 0;
try {
    $stmt = $pdo->prepare(
        'INSERT INTO owners_house_application'
        . ' (received_at, source, name, zip, shop, staff, photo_mode, photos, title, feature1, feature2, feature3, feature4, feature5)'
        . " VALUES (?, 'form', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $receivedAt, $v['name'], $v['zip'], $v['shop'], $v['staff'], OHA_PHOTO_MODES[$v['photoMode']],
        $photos ? json_encode($photos) : null, $v['title'],
        $v['feature1'], $v['feature2'], $v['feature3'], $v['feature4'], $v['feature5'],
    ]);
    $id = (int)$pdo->lastInsertId();
} catch (PDOException $e) {
    foreach ($photos as $name) {
        ksnapDeleteImage($name);
    }
    // ⚠️ 例外の中身は応答に含めない
    error_log('owners_house_application: 保存に失敗: ' . $e->getMessage());
    ohaRespond(500, ['status' => 'error', 'message' => '送信できませんでした。時間をおいて再度お試しください。']);
}

// ---- 社内へメール（⚠️ 保存が終わってから。⚠️ 失敗しても受付は済んでいる） ----
$lines = [
    'オーナーズハウスへの募集がありました。',
    '該当店舗及び担当営業は御礼のメッセージ等対応をお願いいたします。',
    '',
    '受付日時：' . date('Y/m/d H:i', strtotime($receivedAt)),
    'お施主様名：' . $v['name'] . ' 様',
    '郵便番号：' . substr($v['zip'], 0, 3) . '-' . substr($v['zip'], 3),
    '契約した店舗：' . $v['shop'],
    '担当営業：' . ($v['staff'] !== '' ? $v['staff'] : '（未入力）'),
    '写真撮影について：' . OHA_PHOTO_MODES[$v['photoMode']],
    'ご自宅のタイトル：' . $v['title'],
];
for ($i = 1; $i <= 5; $i++) {
    if ($v['feature' . $i] !== '') {
        $lines[] = 'ご自宅の見どころ' . mb_substr('①②③④⑤', $i - 1, 1) . '：' . $v['feature' . $i];
    }
}
foreach ($photos as $n => $name) {
    $lines[] = '写真' . ($n + 1) . '：' . OHA_IMAGE_BASE . $name;
}
$lines[] = '';
$lines[] = 'Dashboard の「反響管理 → オーナーズハウス募集」でも確認できます。';

mb_language('uni');
mb_internal_encoding('UTF-8');
$subject = '【オーナーズハウス募集】' . preg_replace('/[\x00-\x1F\x7F]/', ' ', $v['name']) . '様からの応募がありました';
$headers = 'From: ' . mb_encode_mimeheader('オーナーズハウス', 'UTF-8') . ' <' . OHA_MAIL_FROM . '>';
if (!mb_send_mail(OHA_MAIL_TO, $subject, implode("\n", $lines) . "\n", $headers)) {
    error_log("owners_house_application: 社内へのメールを送れませんでした id={$id}");
}

error_log("owners_house_application: 受け付けました id={$id} shop=\"{$v['shop']}\" photos=" . count($photos));
ohaRespond(200, ['status' => 'success', 'message' => '受け付けました。', 'id' => $id]);
```

### backend-express/src/features/ownersHouse/application.ts
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { clean } from '../campaignForm/text';
import { keyMatches } from '../memberEntry/entry';

/**
 * オーナーズハウス募集（owners_house_application）。（v2.2.215）
 *
 * ─────────────────────────────────────────────
 * ⚠️ フォームからの受付は ① の handlers/owners_house_application.php（写真を含むので ① だけ）。
 * ⚠️ ここにあるのは:
 *   - 一覧（Dashboard の「反響管理 → オーナーズハウス募集」。スタッフのみ）
 *   - 過去の通知メールの取り込み（GAS OwnersHouseMailImport。合い言葉 MEMBER_ENTRY_KEY）
 *     ⚠️ メールの Gmail の ID（mail_message_id）は UNIQUE。同じメールは二度入らない
 * ─────────────────────────────────────────────
 */

interface RawRow extends RowDataPacket {
    id: number;
    received_at: string;
    source: string;
    name: string;
    zip: string;
    shop: string;
    staff: string;
    photo_mode: string;
    photos: string | null;
    title: string;
    feature1: string; feature2: string; feature3: string; feature4: string; feature5: string;
}

/** 写真のファイル名の JSON。⚠️ 壊れていても一覧は出す（空にする） */
const parsePhotos = (value: string | null): string[] => {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string' && p !== '') : [];
    } catch {
        return [];
    }
};

/** 一覧（新しい順）。⚠️ 件数は多くない（年に数十件）ので全件返す */
export const listOwnersHouseApplications = async (): Promise<{ status: 'success'; rows: unknown[] }> => {
    const rows = await query<RawRow>(
        "SELECT id, DATE_FORMAT(received_at, '%Y/%m/%d %H:%i') AS received_at, source, name, zip, shop, staff,"
        + ' photo_mode, photos, title, feature1, feature2, feature3, feature4, feature5'
        + ' FROM owners_house_application ORDER BY received_at DESC, id DESC'
    );
    return {
        status: 'success',
        rows: rows.map(r => ({
            id: r.id,
            received_at: r.received_at,
            source: r.source,
            name: r.name,
            zip: r.zip,
            shop: r.shop,
            staff: r.staff,
            photo_mode: r.photo_mode,
            photos: parsePhotos(r.photos),
            title: r.title,
            features: [r.feature1, r.feature2, r.feature3, r.feature4, r.feature5].filter(f => f !== ''),
        })),
    };
};

export interface ImportResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string };
}

const RECEIVED_PATTERN = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/;

/** 過去の通知メールを1通取り込む */
export const importOwnersHouseApplication = async (raw: Record<string, unknown>): Promise<ImportResult> => {
    const body = raw ?? {};
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、オーナーズハウス募集の取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const messageId = clean(body.message_id, 100);
    const receivedAt = clean(body.received_at, 19);
    const name = clean(body.name, 100);
    if (messageId === '' || !RECEIVED_PATTERN.test(receivedAt) || name === '') {
        logger.warn(`owners_house_application_import: 必要な項目がありません message_id="${messageId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        const existing = await query<RowDataPacket>(
            'SELECT id FROM owners_house_application WHERE mail_message_id = ? LIMIT 1', [messageId]
        );
        if (existing.length > 0) {
            return { httpStatus: 200, body: { status: 'exists', message: '取り込み済みです。' } };
        }
        await execute(
            'INSERT INTO owners_house_application'
            + ' (received_at, source, mail_message_id, name, zip, shop, staff, photo_mode, photos, title, feature1, feature2, feature3, feature4, feature5)'
            + " VALUES (STR_TO_DATE(?, '%Y/%m/%d %H:%i:%s'), 'mail', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)",
            [
                receivedAt, messageId, name,
                clean(body.zip, 10).replace(/\D/g, ''),
                clean(body.shop, 60), clean(body.staff, 60), clean(body.photo_mode, 20), clean(body.title, 200),
                clean(body.feature1, 300), clean(body.feature2, 300), clean(body.feature3, 300),
                clean(body.feature4, 300), clean(body.feature5, 300),
            ]
        );
    } catch (error) {
        logger.error(`owners_house_application_import: 保存に失敗 message_id="${messageId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: '保存に失敗しました。' } };
    }

    logger.info(`owners_house_application_import を受け付けました message_id="${messageId}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} 様の応募を取り込みました。` } };
};
```

### backend-express/src/gateway/registry.ts（追加分）
```ts
import { importOwnersHouseApplication, listOwnersHouseApplications } from '../features/ownersHouse/application';

/**
 * オーナーズハウス募集の一覧（Dashboard の「反響管理 → オーナーズハウス募集」）。（v2.2.215）
 *   ⚠️ フォームからの受付は ① の handlers/owners_house_application.php（写真を含むので ② には無い）。
 *   ⚠️ ① に PHP ハンドラは無い → express_proxy の expressProxyExclusive() にも入れてある（落ちたとき 502）。
 */
register({
  request: 'owners_house_application_list',
  summary: 'オーナーズハウス募集の一覧（owners_house_application）',
  phpSource: '(Express のみ)',
  auth: 'staff',
  handler: async () => listOwnersHouseApplications(),
});

/**
 * ⚠️⚠️ **オーナーズハウス募集の過去の通知メールの取り込み。書き込み口である。**（v2.2.215）
 *   ⚠️ 送ってくるのは GAS（OwnersHouseMailImport）。⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY（本文の `key`）。
 *   ⚠️ 同じメール（Gmail の ID）は二度入らない（2回目は status: exists）。
 */
register({
  request: 'owners_house_application_import',
  summary: '【書き込み・合い言葉】オーナーズハウス募集の過去メールの取り込み（owners_house_application）',
  phpSource: '(Express のみ)',
  auth: 'none',
  handler: async (ctx) => {
    const result = await importOwnersHouseApplication(ctx.body as Record<string, unknown>);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});
```

### backend/src/core/express_proxy.php（許可リストと expressProxyExclusive() の両方に追加）
```php
        // -----------------------------------------------------------------
        // v2.2.215 新規。オーナーズハウス募集（owners_house_application）の一覧と過去メールの取り込み。
        //
        // ⚠️ ① に PHP ハンドラは無い（② だけ）。⚠️ 転送の許可リストと expressProxyExclusive() の両方に入れてある。
        // ⚠️⚠️ **フォームからの受付 `owners_house_application`（写真付き・multipart）はどちらにも入れない。**
        //   ⚠️ ① の handlers/owners_house_application.php が受ける（写真の置き場所が ① のため）。
        // -----------------------------------------------------------------
        'owners_house_application_list',
        'owners_house_application_import',
```

### frontend/src/components/header/OwnersHouseApplication.tsx
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import { ksnapImageUrl } from '../../utils/ksnapImage';

/**
 * オーナーズハウス募集の一覧（ヘッダー → 反響管理 → オーナーズハウス募集）。（v2.2.215）
 *
 * ─────────────────────────────────────────────
 * ⚠️ データは `owners_house_application`。**この画面は表示のみ。**
 *   - フォーム（kh-house.jp/owners_house/form/）からの受付 … ① handlers/owners_house_application.php
 *   - 過去の通知メールの取り込み … ② owners_house_application_import（GAS OwnersHouseMailImport）
 * ⚠️ 読み込みは ② の owners_house_application_list（スタッフのみ）。
 * ⚠️⚠️ 写真は ① の /dashboard/api/images/（k-snap と同じ置き場所。ksnapImageUrl で URL にする）。
 *   ⚠️ 過去のメールから取り込んだ行には写真が無い（メールに写真が入っていないため）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせている（接頭辞 oh_）。
 * ─────────────────────────────────────────────
 */

interface Application {
    id: number;
    received_at: string;
    source: string;
    name: string;
    zip: string;
    shop: string;
    staff: string;
    photo_mode: string;
    photos: string[];
    title: string;
    features: string[];
}

type SortKey = 'received_at' | 'name' | 'shop' | 'staff' | 'photo_mode';
type SortOrder = 'asc' | 'desc';

/** 店舗名の頭 → ブランド。⚠️ フォームの選択肢が「ブランド名＋店舗」の形なので頭で分ける */
const BRANDS = ['国分ハウジング', 'デイジャストハウス', 'なごみ工務店', 'ニーエルホーム', 'フルコミホーム'];
const brandOf = (shop: string): string => BRANDS.find(b => shop.startsWith(b)) ?? 'その他';

const SOURCE_LABEL: Record<string, string> = { form: 'フォーム', mail: '過去のメール' };

const formatZip = (zip: string): string => (/^\d{7}$/.test(zip) ? `${zip.slice(0, 3)}-${zip.slice(3)}` : zip);

const OwnersHouseApplication = () => {
    const [rows, setRows] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [targetBrand, setTargetBrand] = useState('');
    const [targetPhoto, setTargetPhoto] = useState('');
    const [keyword, setKeyword] = useState('');

    /** ⚠️ 既定は新しい順 */
    const [sortKey, setSortKey] = useState<SortKey>('received_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    /** 見どころ・写真を開いている行 */
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'owners_house_application_list' });
                setRows((res.data?.rows ?? []) as Application[]);
            } catch {
                setError('オーナーズハウス募集を取得できませんでした。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };
        void fetchData();
    }, []);

    /** ブランドの選択肢。⚠️ 実データにあるものだけを BRANDS の順に */
    const brandOptions = useMemo(() => {
        const present = new Set(rows.map(r => brandOf(r.shop)));
        return [...BRANDS, 'その他'].filter(b => present.has(b));
    }, [rows]);

    const visible = useMemo(() => {
        const word = keyword.trim();
        const filtered = rows.filter(r =>
            (!targetBrand || brandOf(r.shop) === targetBrand) &&
            (!targetPhoto || r.photo_mode === targetPhoto) &&
            (!word || [r.name, r.shop, r.staff, r.title, ...r.features].some(text => text.includes(word)))
        );
        // ⚠️ 元の配列を壊さない（sort は破壊的）。⚠️ 受付日時は「YYYY/MM/DD HH:MM」なので文字で比べてよい
        return [...filtered].sort((a, b) => {
            const diff = String(a[sortKey]).localeCompare(String(b[sortKey]), 'ja');
            if (diff === 0) return b.id - a.id;
            return sortOrder === 'asc' ? diff : -diff;
        });
    }, [rows, targetBrand, targetPhoto, keyword, sortKey, sortOrder]);

    const total = useMemo(() => ({
        all: visible.length,
        request: visible.filter(r => r.photo_mode === '撮影を依頼する').length,
        attach: visible.filter(r => r.photo_mode === '写真を添付する').length,
        mail: visible.filter(r => r.source === 'mail').length,
    }), [visible]);

    /** 並べ替えの見出し。⚠️ 同じ列なら昇順・降順を入れ替え、別の列なら降順から（GoogleReview.tsx と同じ） */
    const SortHead = ({ label, keyName, width }: { label: string; keyName: SortKey; width?: string }) => {
        const active = sortKey === keyName;
        return (
            <th
                className="oh_th oh_th_sort"
                style={{ width }}
                onClick={() => {
                    if (active) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(keyName); setSortOrder('desc'); }
                }}
                title="クリックで並べ替え"
            >
                {label}
                <span className={`oh_sort_icon${active ? ' is_active' : ''}`}>
                    {active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };

    const toggle = (id: number) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="oh_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない（GoogleReview.tsx と同じ形） */}
            <style>{`
                /* ⚠️ 全画面モーダルの Modal.Body は p-0 かつ overflow:hidden（Header.tsx）。
                      ⚠️ 余白はこちらで持ち、表だけがスクロールする形にする */
                .oh_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 16px 40px 20px; box-sizing: border-box; }
                .oh_inner { width: 100%; max-width: 1500px; margin: 0 auto;
                            display: flex; flex-direction: column; min-height: 0; flex: 1; }
                .oh_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .oh_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .oh_note { font-size: 11px; color: #6b7280; }
                .oh_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .oh_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .oh_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .oh_kpi_card { flex: 1 1 160px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .oh_kpi_label { font-size: 11px; color: #6b7280; }
                .oh_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .oh_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb;
                              border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                /* ⚠️ flex:1 と min-height:0 で「残りの高さを使い切って中だけスクロール」。外すと表が画面外へ出る */
                .oh_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                                 background: #fff; flex: 1 1 auto; min-height: 0; }
                .oh_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .oh_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 12px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .oh_th_sort { cursor: pointer; user-select: none; }
                .oh_th_sort:hover { background: #eef2f7; }
                .oh_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .oh_sort_icon.is_active { color: #2563eb; }
                .oh_td { border-bottom: 1px solid #f1f5f9; padding: 9px 12px; vertical-align: middle; }
                .oh_row:hover > .oh_td { background: #f8fafc; }
                .oh_name { font-weight: 700; font-size: 13px; }
                .oh_tag { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
                .oh_tag_request { background: #eef2ff; color: #3730a3; }
                .oh_tag_attach { background: #ecfdf5; color: #065f46; }
                .oh_tag_mail { background: #fef3c7; color: #92400e; }
                .oh_num { font-variant-numeric: tabular-nums; white-space: nowrap; }
                .oh_more { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer; background: none;
                           border: none; padding: 2px 0; white-space: nowrap; }
                .oh_more:hover { text-decoration: underline; }
                .oh_detail > .oh_td { background: #fbfdff; padding: 12px 16px 16px; }
                .oh_feature { line-height: 1.8; }
                .oh_photos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
                .oh_photo { width: 120px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
                .oh_thumb { width: 44px; height: 33px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e7eb; }
                .oh_empty { color: #9ca3af; font-size: 12px; }
            `}</style>

            <div className="oh_inner">
                <div className="oh_head mb-2">
                    <span className="oh_title">
                        <i className="fa-solid fa-house-chimney me-2 text-primary" aria-hidden="true" />
                        オーナーズハウス募集
                    </span>
                    <span className="oh_note">※ オーナー様が「ご自宅を見学先として登録してよい」と応募した一覧です</span>
                </div>

                {error !== '' && <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>}

                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">読み込み中</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="oh_bar mb-3">
                            <div>
                                <div className="oh_label">ブランド</div>
                                <Form.Select size="sm" value={targetBrand} style={{ width: '180px', fontSize: '12px' }}
                                    onChange={(e) => setTargetBrand(e.target.value)}>
                                    <option value="">すべて</option>
                                    {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                </Form.Select>
                            </div>
                            <div>
                                <div className="oh_label">写真</div>
                                <Form.Select size="sm" value={targetPhoto} style={{ width: '160px', fontSize: '12px' }}
                                    onChange={(e) => setTargetPhoto(e.target.value)}>
                                    <option value="">すべて</option>
                                    <option value="撮影を依頼する">撮影を依頼する</option>
                                    <option value="写真を添付する">写真を添付する</option>
                                </Form.Select>
                            </div>
                            <div>
                                <div className="oh_label">検索</div>
                                <Form.Control size="sm" value={keyword} placeholder="名前・店舗・担当・タイトル" style={{ width: '220px', fontSize: '12px' }}
                                    onChange={(e) => setKeyword(e.target.value)} />
                            </div>
                            <span className="oh_note ms-auto">並べ替えは見出しをクリック</span>
                        </div>

                        <div className="oh_kpi mb-3">
                            <div className="oh_kpi_card">
                                <div className="oh_kpi_label">応募</div>
                                <div className="oh_kpi_value">{total.all.toLocaleString()}</div>
                            </div>
                            <div className="oh_kpi_card">
                                <div className="oh_kpi_label">撮影を依頼</div>
                                <div className="oh_kpi_value">{total.request.toLocaleString()}</div>
                            </div>
                            <div className="oh_kpi_card">
                                <div className="oh_kpi_label">写真を添付</div>
                                <div className="oh_kpi_value">{total.attach.toLocaleString()}</div>
                            </div>
                            <div className="oh_kpi_card">
                                <div className="oh_kpi_label">うち過去のメールから取り込み</div>
                                <div className="oh_kpi_value">{total.mail.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* ⚠️ 過去のメールの行に写真が無い理由を必ず出す。書かないと「写真が消えた」と受け取られる */}
                        <div className="oh_caution mb-2">
                            「過去のメール」の行は、以前のフォームの通知メールから取り込んだものです。メールに写真が入っていなかったため、
                            写真は表示されません（「写真を添付する」でも同じです）。お施主様への連絡は、契約店舗・担当営業から行ってください。
                        </div>

                        <div className="oh_table_wrap">
                            <table className="oh_table">
                                <thead>
                                    <tr>
                                        <SortHead label="受付日時" keyName="received_at" width="140px" />
                                        <SortHead label="お施主様" keyName="name" width="160px" />
                                        <th className="oh_th" style={{ width: '90px' }}>郵便番号</th>
                                        <SortHead label="ご契約店舗" keyName="shop" width="210px" />
                                        <SortHead label="担当営業" keyName="staff" width="120px" />
                                        <SortHead label="写真" keyName="photo_mode" width="190px" />
                                        <th className="oh_th">ご自宅のタイトル</th>
                                        <th className="oh_th" style={{ width: '120px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.length === 0 ? (
                                        <tr>
                                            <td className="oh_td oh_empty text-center py-4" colSpan={8}>該当する応募がありません</td>
                                        </tr>
                                    ) : visible.map(r => {
                                        const isOpen = expanded[r.id] === true;
                                        return (
                                            <React.Fragment key={r.id}>
                                                <tr className="oh_row">
                                                    <td className="oh_td oh_num">
                                                        {r.received_at}
                                                        {r.source === 'mail' && <div><span className="oh_tag oh_tag_mail">{SOURCE_LABEL.mail}</span></div>}
                                                    </td>
                                                    <td className="oh_td"><span className="oh_name">{r.name}</span> 様</td>
                                                    <td className="oh_td oh_num">{formatZip(r.zip) || '-'}</td>
                                                    <td className="oh_td">{r.shop || '-'}</td>
                                                    <td className="oh_td">{r.staff || <span className="oh_empty">未入力</span>}</td>
                                                    <td className="oh_td">
                                                        <span className={`oh_tag ${r.photo_mode === '写真を添付する' ? 'oh_tag_attach' : 'oh_tag_request'}`}>
                                                            {r.photo_mode || '-'}
                                                        </span>
                                                        {r.photos.length > 0 && (
                                                            <span className="d-inline-flex gap-1 ms-2 align-middle">
                                                                {r.photos.slice(0, 3).map(p => (
                                                                    <img key={p} className="oh_thumb" src={ksnapImageUrl(p)} alt="" loading="lazy" />
                                                                ))}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="oh_td">{r.title}</td>
                                                    <td className="oh_td text-end">
                                                        <button className="oh_more" onClick={() => toggle(r.id)}>
                                                            {isOpen ? '閉じる' : '見どころ・写真'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {/* ⚠️ 見どころと写真は行の下に広げる（表に並べると読めないため） */}
                                                {isOpen && (
                                                    <tr className="oh_detail">
                                                        <td className="oh_td" colSpan={8}>
                                                            {r.features.length === 0
                                                                ? <span className="oh_empty">見どころの入力がありません</span>
                                                                : r.features.map((f, i) => (
                                                                    <div className="oh_feature" key={i}>
                                                                        <span className="oh_tag me-2">見どころ{'①②③④⑤'[i]}</span>{f}
                                                                    </div>
                                                                ))}
                                                            {r.photos.length > 0 ? (
                                                                <div className="oh_photos">
                                                                    {r.photos.map(p => (
                                                                        <a key={p} href={ksnapImageUrl(p)} target="_blank" rel="noopener noreferrer">
                                                                            <img className="oh_photo" src={ksnapImageUrl(p)} alt="" loading="lazy" />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="oh_empty mt-2">
                                                                    {r.photo_mode === '撮影を依頼する' ? '撮影の依頼です（写真は撮影後に）' : '写真はありません'}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default OwnersHouseApplication;
```

### frontend/src/components/header/Header.tsx（追加分）
```tsx
import OwnersHouseApplication from './OwnersHouseApplication';

        '反響管理': [
            '販促媒体設定', 'ブラックリスト設定',
            ...(authority === 'Master' ? ['広告費シミュレーター'] : []),
            '事後アンケート', '重複反響サマリー',
            // ⚠️ v2.2.215: 「オーナーズハウス募集」を追加（⚠️ 全員。OwnersHouseApplication.tsx。guideScreens.ts のキーも同じ名前）
            'オーナーズハウス募集',
            ...((authority === 'Master' || authority === 'BrandAdmin') ? ['アクセス解析'] : []),
        ],

        '反響管理/オーナーズハウス募集': <OwnersHouseApplication />,

        // isFullscreenMenu
        // ⚠️ オーナーズハウス募集は列が8つあり、見どころ・写真を行の下に広げる（v2.2.215）
        '反響管理/オーナーズハウス募集',
```

### frontend/src/components/guide/guideScreens.ts（追加分）
```ts
    // ⚠️ v2.2.215。Header.tsx の menuMapping と同じく全員
    'オーナーズハウス募集': { menu: '反響管理/オーナーズハウス募集' },
```

### backend/scripts/owners_house_form/form.js
```js
/*
 * オーナーズハウス募集フォームの動き（v2.2.215）。
 *
 * ⚠️ 1ページの中で「1 基本情報 → 2 写真・見どころ → 3 確認 → 4 完了」を切り替える。
 * ⚠️ 送信先は同じフォルダの api.php（転送するだけ）→ ① handlers/owners_house_application.php。
 * ⚠️ 項目の確かめ方は ① の owners_house_application.php と同じにすること（最後はサーバーが確かめる）。
 * ⚠️ 写真はブラウザで長辺1920px の JPEG に縮小してから送る（スマホの写真は10MB を超えることがある。① の上限は12MB）。
 *   ⚠️ 縮小できない写真（ブラウザが読めない形式）は、その場でエラーにする。
 */
(function () {
    'use strict';

    var MAX_SIDE = 1920;
    var JPEG_QUALITY = 0.85;
    var LIMITS = { name: 50, staff: 50, title: 100, feature1: 200, feature2: 200, feature3: 200, feature4: 200, feature5: 200 };
    var REQUIRED = { name: 'お名前', title: 'タイトル', feature1: '見どころ①', feature2: '見どころ②' };
    var PHOTO_LABELS = ['外観写真', '内観写真①', '内観写真②', '内観写真③', '内観写真④'];

    var form = document.getElementById('pf-form');
    var alertBox = document.getElementById('pf-alert');
    var submitButton = document.getElementById('pf-submit');
    /** 縮小した写真（photo1〜5 → Blob） */
    var photos = {};

    function el(id) { return document.getElementById(id); }
    function value(id) { return el(id).value.trim(); }
    function toHalf(text) {
        return text.replace(/[！-～]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); });
    }
    function zipDigits() { return toHalf(value('zip')).replace(/\D/g, ''); }
    function photoMode() { return form.querySelector('input[name="photo_mode"]:checked').value; }

    function showError(key, message) {
        var box = document.querySelector('[data-error="' + key + '"]');
        if (!box) return;
        box.textContent = message;
        box.closest('.pf-field').setAttribute('data-invalid', message ? '1' : '0');
    }

    function check(keys) {
        var first = null;
        keys.forEach(function (key) {
            var message = '';
            if (key === 'zip') {
                if (!/^\d{7}$/.test(zipDigits())) message = '7桁の郵便番号を入力してください';
            } else if (key === 'shop') {
                if (value('shop') === '') message = 'ご契約いただいた店舗を選んでください';
            } else if (/^photo[1-5]$/.test(key)) {
                var n = Number(key.slice(5));
                if (photoMode() === 'attach' && n <= 3 && !photos[key]) message = PHOTO_LABELS[n - 1] + 'を選んでください';
            } else {
                var text = value(key);
                if (REQUIRED[key] && text === '') message = REQUIRED[key] + 'を入力してください';
                else if (text.length > LIMITS[key]) message = LIMITS[key] + '文字以内で入力してください';
            }
            showError(key, message);
            if (message && !first) first = key;
        });
        return first;
    }

    function setStep(step) {
        [1, 2, 3].forEach(function (n) { el('pf-step' + n).hidden = n !== step; });
        el('pf-step4').hidden = step !== 4;
        form.hidden = step === 4;
        document.querySelectorAll('.pf-steps li').forEach(function (li) {
            if (Number(li.getAttribute('data-step')) === step) li.setAttribute('aria-current', 'step');
            else li.removeAttribute('aria-current');
        });
        alertBox.hidden = true;
        el('pf-root').scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    function focusFirst(key) {
        var target = el(key);
        if (target) target.focus();
    }

    // ---- 写真：選んだらすぐ縮小して見本を出す ----
    function shrink(file) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
                var canvas = document.createElement('canvas');
                canvas.width = Math.round(img.naturalWidth * scale);
                canvas.height = Math.round(img.naturalHeight * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('toBlob')); }, 'image/jpeg', JPEG_QUALITY);
            };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
            img.src = url;
        });
    }

    [1, 2, 3, 4, 5].forEach(function (n) {
        var key = 'photo' + n;
        var input = el(key);
        var preview = input.parentNode.querySelector('img');
        input.addEventListener('change', function () {
            delete photos[key];
            preview.hidden = true;
            showError(key, '');
            var file = input.files && input.files[0];
            if (!file) return;
            shrink(file).then(function (blob) {
                photos[key] = blob;
                preview.src = URL.createObjectURL(blob);
                preview.hidden = false;
            }).catch(function () {
                input.value = '';
                showError(key, 'この写真は読み込めませんでした。JPG または PNG の写真を選んでください');
            });
        });
    });

    form.querySelectorAll('input[name="photo_mode"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            el('pf-photos').hidden = photoMode() !== 'attach';
            [1, 2, 3, 4, 5].forEach(function (n) { showError('photo' + n, ''); });
        });
    });

    // ---- 進む・戻る ----
    el('pf-to-step2').addEventListener('click', function () {
        var first = check(['name', 'zip', 'shop', 'staff']);
        if (first) { focusFirst(first); return; }
        setStep(2);
    });

    el('pf-to-step3').addEventListener('click', function () {
        var first = check(['photo1', 'photo2', 'photo3', 'title', 'feature1', 'feature2', 'feature3', 'feature4', 'feature5']);
        if (first) { focusFirst(first); return; }
        buildSummary();
        setStep(3);
    });

    form.querySelectorAll('[data-back]').forEach(function (button) {
        button.addEventListener('click', function () { setStep(Number(button.getAttribute('data-back'))); });
    });

    function buildSummary() {
        var summary = el('pf-summary');
        summary.textContent = '';
        var zip = zipDigits();
        var rows = [
            ['お名前', value('name')],
            ['郵便番号', zip.slice(0, 3) + '-' + zip.slice(3)],
            ['ご契約店舗', value('shop')],
            ['担当営業', value('staff') || '（未入力）'],
            ['掲載写真', photoMode() === 'attach' ? '写真を添付する' : '写真撮影を依頼する'],
            ['タイトル', value('title')]
        ];
        [1, 2, 3, 4, 5].forEach(function (n) {
            if (value('feature' + n) !== '') rows.push(['見どころ' + '①②③④⑤'.charAt(n - 1), value('feature' + n)]);
        });
        rows.forEach(function (pair) {
            var row = document.createElement('div');
            row.className = 'pf-summary-row';
            var dt = document.createElement('dt');
            var dd = document.createElement('dd');
            dt.textContent = pair[0];
            dd.textContent = pair[1];
            row.appendChild(dt);
            row.appendChild(dd);
            summary.appendChild(row);
        });
        if (photoMode() === 'attach') {
            var row = document.createElement('div');
            row.className = 'pf-summary-row';
            var dt = document.createElement('dt');
            dt.textContent = '写真';
            var dd = document.createElement('dd');
            dd.className = 'pf-summary-photos';
            [1, 2, 3, 4, 5].forEach(function (n) {
                var blob = photos['photo' + n];
                if (!blob) return;
                var img = document.createElement('img');
                img.src = URL.createObjectURL(blob);
                img.alt = PHOTO_LABELS[n - 1];
                dd.appendChild(img);
            });
            row.appendChild(dt);
            row.appendChild(dd);
            summary.appendChild(row);
        }
    }

    // ---- 送信 ----
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        // ⚠️ 確認画面以外で Enter を押しても送らない（確認を飛ばさない）
        if (el('pf-step3').hidden) return;
        if (submitButton.getAttribute('aria-busy') === 'true') return;
        submitButton.setAttribute('aria-busy', 'true');
        submitButton.textContent = '送信しています…';

        var data = new FormData();
        ['name', 'shop', 'staff', 'title', 'feature1', 'feature2', 'feature3', 'feature4', 'feature5'].forEach(function (key) {
            data.append(key, value(key));
        });
        data.append('zip', zipDigits());
        data.append('photo_mode', photoMode());
        data.append('website_url', form.querySelector('input[name="website_url"]').value);
        if (photoMode() === 'attach') {
            [1, 2, 3, 4, 5].forEach(function (n) {
                if (photos['photo' + n]) data.append('photo' + n, photos['photo' + n], 'photo' + n + '.jpg');
            });
        }

        fetch('./api.php', { method: 'POST', body: data })
            .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; }); })
            .then(function (result) {
                if (result.ok && result.body.status === 'success') {
                    el('pf-done-name').textContent = value('name') + ' 様';
                    setStep(4);
                    return;
                }
                // ⚠️ 項目の誤り（400）は該当の画面に戻して知らせる
                var fields = (result.body && result.body.fields) || [];
                if (fields.length) {
                    var step = fields.some(function (f) { return ['name', 'zip', 'shop', 'staff'].indexOf(f) !== -1; }) ? 1 : 2;
                    setStep(step);
                    fields.forEach(function (f) { showError(f === 'photo_mode' ? 'photo1' : f, '入力内容をご確認ください'); });
                }
                alertBox.textContent = (result.body && result.body.message) || '送信できませんでした。時間をおいて再度お試しください。';
                alertBox.hidden = false;
            })
            .catch(function () {
                alertBox.textContent = '通信エラーが発生しました。時間をおいて再度お試しください。';
                alertBox.hidden = false;
            })
            .finally(function () {
                submitButton.removeAttribute('aria-busy');
                submitButton.textContent = 'この内容で申し込む';
            });
    });
})();
```

### backend/scripts/owners_house_form/form.css
```css
/*
 * オーナーズハウス募集フォームの入力部分の見た目（v2.2.215）。
 * ⚠️ form_get（src/components/publicForm.css）・協力業者様募集フォームと同じ作り（接頭辞 .pf）。
 * ⚠️ 上の LP 部分は以前の Astro の CSS（_astro/index.*.css。Bootstrap 入り）のまま。⚠️ .pf の中だけをここで決める。
 * ⚠️ 入力欄の文字は 16px（16px 未満だと iPhone で入力時に画面が拡大される）。
 */
/* ⚠️ 上の LP の画像の上の文字（.txt）が PC で右へはみ出し、横にスクロールしていた（以前から。1280px で 80px）。⚠️ はみ出しを切る */
html, body { overflow-x: clip; }

.pf {
    --pf-accent: #0f3675;
    --pf-ink: #1d2433;
    --pf-sub: #5b6476;
    --pf-line: #d5dbe5;
    --pf-surface: #f5f7fa;
    --pf-danger: #c62828;
    --pf-danger-bg: #fdecec;
    --pf-radius: 10px;

    max-width: 680px;
    margin: 0 auto;
    padding: 48px 16px 64px;
    color: var(--pf-ink);
    font-family: "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    letter-spacing: .02em;
}
.pf *, .pf *::before, .pf *::after { box-sizing: border-box; }
.pf [hidden] { display: none !important; }

.pf-heading { margin: 0 0 8px; font-size: 26px; font-weight: 900; color: var(--pf-accent); text-align: center; }
.pf-lead { margin: 0 0 20px; font-size: 14px; color: var(--pf-sub); text-align: center; word-break: auto-phrase; }

.pf-steps { display: flex; justify-content: center; gap: 6px; margin: 0 0 24px; padding: 0; list-style: none; font-size: 12px; color: var(--pf-sub); }
.pf-steps li { display: flex; align-items: center; gap: 6px; }
.pf-steps li + li::before { content: ""; width: 18px; height: 1px; background: var(--pf-line); }
.pf-steps .pf-step-num {
    display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%;
    border: 1px solid var(--pf-line); background: #fff; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.pf-steps li[aria-current="step"] { color: var(--pf-ink); font-weight: 700; }
.pf-steps li[aria-current="step"] .pf-step-num { border-color: var(--pf-accent); background: var(--pf-accent); color: #fff; }

.pf-card {
    display: flex; flex-direction: column; gap: 18px; padding: 20px; margin: 0 0 16px;
    border: 1px solid var(--pf-line); border-radius: 14px; background: #fff; box-shadow: 0 1px 2px rgba(29, 36, 51, .04);
}
.pf-card-title { margin: 0; font-size: 13px; font-weight: 700; color: var(--pf-sub); letter-spacing: .08em; }

.pf-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pf-label { display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 13px; font-weight: 600; line-height: 1.5; color: var(--pf-ink); }
.pf-badge { flex: none; display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1.6; }
.pf-badge-req { background: var(--pf-danger-bg); color: var(--pf-danger); }
.pf-badge-opt { background: var(--pf-surface); color: var(--pf-sub); }
.pf-hint { margin: 0; font-size: 12px; color: var(--pf-sub); }

.pf-input, .pf-select {
    width: 100%; min-height: 48px; padding: 10px 14px; border: 1px solid var(--pf-line); border-radius: var(--pf-radius);
    background: #fff; color: var(--pf-ink); font: inherit; font-size: 16px; line-height: 1.5;
    transition: border-color .15s, box-shadow .15s; appearance: none; -webkit-appearance: none;
}
.pf-select {
    padding-right: 40px;
    background-image: linear-gradient(45deg, transparent 50%, var(--pf-sub) 50%), linear-gradient(135deg, var(--pf-sub) 50%, transparent 50%);
    background-position: calc(100% - 20px) 50%, calc(100% - 15px) 50%; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat;
}
.pf-input::placeholder { color: #9aa3b2; }
.pf-input:focus, .pf-select:focus { outline: none; border-color: var(--pf-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-accent) 22%, transparent); }
.pf-field[data-invalid="1"] .pf-input, .pf-field[data-invalid="1"] .pf-select, .pf-field[data-invalid="1"] .pf-file { border-color: var(--pf-danger); }

.pf-error { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12px; font-weight: 600; color: var(--pf-danger); }
.pf-error::before {
    content: "!"; display: inline-flex; align-items: center; justify-content: center; flex: none; width: 16px; height: 16px;
    border-radius: 50%; background: var(--pf-danger); color: #fff; font-size: 11px; font-weight: 700;
}
.pf-error:empty { display: none; }

/* 写真の扱い（撮影を依頼／添付） */
.pf-choice { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pf-choice label {
    display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 10px 14px; margin: 0;
    border: 1px solid var(--pf-line); border-radius: var(--pf-radius); cursor: pointer; font-size: 14px; font-weight: 600;
}
.pf-choice input { accent-color: var(--pf-accent); width: 18px; height: 18px; margin: 0; }
.pf-choice label:has(input:checked) { border-color: var(--pf-accent); background: color-mix(in srgb, var(--pf-accent) 6%, #fff); }

/* 写真を選ぶ欄（⚠️ 5つの欄の間を空ける。カードの gap は #pf-photos の中までは効かない） */
#pf-photos { display: flex; flex-direction: column; gap: 16px; }
.pf-file {
    display: flex; align-items: center; gap: 12px; padding: 10px; border: 1px dashed var(--pf-line); border-radius: var(--pf-radius); background: var(--pf-surface);
}
.pf-file input[type=file] { flex: 1; min-width: 0; font-size: 13px; }
.pf-file img { width: 72px; height: 54px; object-fit: cover; border-radius: 6px; flex: none; background: #fff; }

/* ⚠️ 見えない入力欄（機械よけ）。display:none にすると埋めない機械があるので画面の外へ出す */
.pf-trap { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }

.pf-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 28px 0 0; }
.pf-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px;
    border-radius: var(--pf-radius); border: 1px solid var(--pf-line); background: #fff; color: var(--pf-ink);
    font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: filter .15s, background-color .15s;
}
.pf-btn:hover { background: var(--pf-surface); }
.pf-btn:focus-visible { outline: 3px solid color-mix(in srgb, var(--pf-accent) 35%, transparent); outline-offset: 2px; }
.pf-btn-primary {
    width: 100%; max-width: 360px; min-height: 54px; border-color: var(--pf-accent); background: var(--pf-accent); color: #fff;
    font-size: 16px; font-weight: 700; letter-spacing: .06em;
}
.pf-btn-primary:hover { background: var(--pf-accent); filter: brightness(.92); }
.pf-btn-primary[aria-busy="true"], .pf-btn-primary:disabled { filter: grayscale(.4) brightness(1.05); cursor: progress; }
.pf-btn-link { border: none; background: none; color: var(--pf-sub); text-decoration: underline; }
.pf-btn-link:hover { background: none; color: var(--pf-ink); }

.pf-note { margin: 0; padding: 14px 16px; border-radius: var(--pf-radius); background: var(--pf-surface); color: var(--pf-sub); font-size: 13px; }
.pf-alert { margin: 0 0 16px; padding: 12px 16px; border-radius: var(--pf-radius); background: var(--pf-danger-bg); color: var(--pf-danger); font-size: 13px; font-weight: 600; }

/* 確認 */
.pf-summary { margin: 0; }
.pf-summary-row { display: grid; grid-template-columns: 1fr; gap: 2px; padding: 12px 0; border-bottom: 1px solid var(--pf-line); }
.pf-summary-row:last-child { border-bottom: none; }
@media (min-width: 480px) { .pf-summary-row { grid-template-columns: 170px 1fr; gap: 16px; } }
.pf-summary dt { font-size: 13px; font-weight: 600; color: var(--pf-sub); }
.pf-summary dd { margin: 0; font-size: 15px; font-weight: 600; word-break: break-word; }
.pf-summary-photos { display: flex; gap: 8px; flex-wrap: wrap; }
.pf-summary-photos img { width: 96px; height: 72px; object-fit: cover; border-radius: 6px; }

/* 完了 */
.pf-done { text-align: center; }
.pf-done-mark {
    display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin: 0 auto 12px;
    border-radius: 50%; background: color-mix(in srgb, var(--pf-accent) 10%, #fff); color: var(--pf-accent);
}
.pf-done p { margin: 0 0 12px; font-size: 14px; }

@media (prefers-reduced-motion: reduce) {
    .pf *, .pf *::before, .pf *::after { transition: none !important; }
}
```

### backend/scripts/owners_house_form/api.php
```php
<?php

/**
 * オーナーズハウス募集フォームの中継（kh-house.jp/owners_house/form/api.php）。（v2.2.215）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **転送するだけ。DB には触らない。このファイルには認証情報を書かないこと。**
 *   ブラウザ（同じサイト）──multipart──▶ ここ ──multipart──▶ ① https://khg-marketing.info/dashboard/api/gateway/
 *     （request: owners_house_application → handlers/owners_house_application.php）
 *   ⚠️ ブラウザから khg-marketing.info へ直接送らせないための中継（広告で除外されたドメインのため）。
 * ⚠️ 写真はここでは保存しない（① が中身を確かめて保存する）。⚠️ 受け取る項目と写真の名前は決め打ち。
 * ─────────────────────────────────────────────
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'POST only']);
    exit;
}

/** ⚠️ 転送先。⚠️ 環境変数はテスト用（本番では設定しない） */
$targetUrl = getenv('OWNERS_HOUSE_GATEWAY_URL') ?: 'https://khg-marketing.info/dashboard/api/gateway/';

$fields = ['website_url', 'name', 'zip', 'shop', 'staff', 'photo_mode', 'title', 'feature1', 'feature2', 'feature3', 'feature4', 'feature5'];
$post = ['request' => 'owners_house_application'];
foreach ($fields as $key) {
    $value = $_POST[$key] ?? '';
    $post[$key] = is_string($value) ? mb_substr($value, 0, 500, 'UTF-8') : '';
}

for ($i = 1; $i <= 5; $i++) {
    $file = $_FILES['photo' . $i] ?? null;
    if (!is_array($file) || (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        continue;
    }
    if (!is_uploaded_file((string)$file['tmp_name'])) {
        continue;
    }
    // ⚠️ ファイル名・形式はこちらで決める（中身の確認は ① が行う）
    $post['photo' . $i] = new CURLFile((string)$file['tmp_name'], 'image/jpeg', 'photo' . $i . '.jpg');
}

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode === 0) {
    error_log('owners_house_form/api.php: 転送に失敗しました: ' . $curlError);
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => '通信エラーが発生しました。時間をおいて再度お試しください。'], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code($httpCode);
echo $response;
```

### backend/scripts/owners_house_form/photo.htaccess
```apache
# =====================================================================
# kh-house.jp/owners_house/form/photo/.htaccess（v2.2.215）
#
# ⚠️ 以前のフォーム（step3.php）は、送られたファイルを名前のままこのフォルダへ保存していた。
#   PHP ファイルを置かれると、サーバーで実行されてしまう。
# ⚠️ このファイルを「.htaccess」という名前で photo/ に置くこと（ファイル名を変えて置く）。
# ⚠️ 画像の表示には影響しない。
# =====================================================================

# PHP として動かさない（Apache の PHP モジュールのとき）
<IfModule mod_php.c>
  php_flag engine off
</IfModule>
<IfModule mod_php7.c>
  php_flag engine off
</IfModule>

# 画像以外を開けなくする（CGI 版の PHP でも効く）
<FilesMatch "\.(?i:php\d*|phtml|phar|pl|py|cgi|sh|html?|js|svg)$">
  Require all denied
</FilesMatch>
Options -ExecCGI -Indexes
RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar
```

### backend/scripts/owners_house_form/index.html（入力フォームの部分。⚠️ 上の LP 部分は以前の Astro の書き出しのまま）
```html
  <!-- ===================================================================
       入力フォーム（v2.2.215 で作り直し。以前は step2.php → step3.php → regist.php）
       ⚠️ 動きは form.js、見た目は form.css。送信先は同じフォルダの api.php（転送するだけ）
       =================================================================== -->
  <main class="pf" id="pf-root">
    <h2 class="pf-heading">入力フォーム</h2>
    <p class="pf-lead">ご入力いただいた情報をもとに特設サイトへ掲載いたします。<br>特設サイトには正確な住所を掲載いたしませんのでご安心ください。</p>
    <ol class="pf-steps" aria-label="お申し込みの流れ">
      <li data-step="1" aria-current="step"><span class="pf-step-num">1</span>基本情報</li>
      <li data-step="2"><span class="pf-step-num">2</span>写真・見どころ</li>
      <li data-step="3"><span class="pf-step-num">3</span>確認</li>
      <li data-step="4"><span class="pf-step-num">4</span>完了</li>
    </ol>

    <form id="pf-form" novalidate>
      <div class="pf-trap" aria-hidden="true">
        <label>この欄は空のままにしてください<input type="text" name="website_url" value="" tabindex="-1" autocomplete="off"></label>
      </div>
      <p class="pf-alert" id="pf-alert" role="alert" hidden></p>

      <!-- STEP1 基本情報 -->
      <div id="pf-step1">
        <section class="pf-card" aria-labelledby="pf-owner">
          <h3 class="pf-card-title" id="pf-owner">お施主様の情報</h3>
          <div class="pf-field">
            <label class="pf-label" for="name">お名前<span class="pf-badge pf-badge-req">必須</span></label>
            <input id="name" name="name" type="text" class="pf-input" autocomplete="name" maxlength="50" placeholder="例）国分 太郎">
            <p class="pf-error" data-error="name"></p>
          </div>
          <div class="pf-field">
            <label class="pf-label" for="zip">郵便番号<span class="pf-badge pf-badge-req">必須</span></label>
            <input id="zip" name="zip" type="text" class="pf-input" inputmode="numeric" autocomplete="postal-code" maxlength="8" placeholder="例）899-4332">
            <p class="pf-error" data-error="zip"></p>
          </div>
        </section>
        <section class="pf-card" aria-labelledby="pf-contract">
          <h3 class="pf-card-title" id="pf-contract">ご契約について</h3>
          <div class="pf-field">
            <label class="pf-label" for="shop">ご契約いただいた店舗<span class="pf-badge pf-badge-req">必須</span></label>
            <select id="shop" name="shop" class="pf-select">
              <option value="">選択してください</option>
              <optgroup label="国分ハウジング">
                <option>国分ハウジング霧島店</option><option>国分ハウジング姶良店</option><option>国分ハウジング鹿児島店</option>
                <option>国分ハウジング鹿屋店</option><option>国分ハウジング薩摩川内店</option><option>国分ハウジング出水阿久根店</option>
                <option>国分ハウジング都城店</option><option>国分ハウジング宮崎店</option><option>国分ハウジング延岡店</option>
                <option>国分ハウジング大分店</option><option>国分ハウジング八代店</option><option>国分ハウジング熊本店</option>
                <option>国分ハウジング佐賀店</option>
              </optgroup>
              <optgroup label="デイジャストハウス">
                <option>デイジャストハウス鹿児島北店</option><option>デイジャストハウス鹿児島南店</option><option>デイジャストハウス姶良店</option>
                <option>デイジャストハウス霧島店</option><option>デイジャストハウス薩摩川内店</option><option>デイジャストハウス都城店</option>
                <option>デイジャストハウス宮崎店</option>
              </optgroup>
              <optgroup label="なごみ工務店">
                <option>なごみ工務店鹿児島店</option><option>なごみ工務店霧島店</option><option>なごみ工務店姶良霧島店</option><option>なごみ工務店薩摩川内店</option>
              </optgroup>
              <optgroup label="ニーエルホーム">
                <option>ニーエルホーム鹿児島店</option><option>ニーエルホーム霧島店</option>
              </optgroup>
              <optgroup label="フルコミホーム">
                <option>フルコミホーム鹿児島店</option><option>フルコミホーム霧島店</option>
              </optgroup>
            </select>
            <p class="pf-error" data-error="shop"></p>
          </div>
          <div class="pf-field">
            <label class="pf-label" for="staff">担当営業<span class="pf-badge pf-badge-opt">任意</span></label>
            <input id="staff" name="staff" type="text" class="pf-input" maxlength="50" placeholder="例）国分 花子">
            <p class="pf-error" data-error="staff"></p>
          </div>
        </section>
        <div class="pf-actions">
          <button type="button" class="pf-btn pf-btn-primary" id="pf-to-step2">次へ（写真・見どころ）</button>
        </div>
      </div>

      <!-- STEP2 写真・見どころ -->
      <div id="pf-step2" hidden>
        <section class="pf-card" aria-labelledby="pf-photo">
          <h3 class="pf-card-title" id="pf-photo">掲載写真</h3>
          <p class="pf-hint">撮影を依頼いただくか、お手元の写真を添付してください。<a href="./sample/" target="_blank" rel="noopener">掲載イメージを見る</a></p>
          <div class="pf-choice" role="radiogroup" aria-label="掲載写真について">
            <label><input type="radio" name="photo_mode" value="request" checked>写真撮影を依頼する</label>
            <label><input type="radio" name="photo_mode" value="attach">写真を添付する</label>
          </div>
          <div id="pf-photos" hidden>
            <div class="pf-field">
              <span class="pf-label">外観写真<span class="pf-badge pf-badge-req">必須</span></span>
              <div class="pf-file"><input type="file" id="photo1" accept="image/*"><img alt="" hidden></div>
              <p class="pf-error" data-error="photo1"></p>
            </div>
            <div class="pf-field">
              <span class="pf-label">内観写真①<span class="pf-badge pf-badge-req">必須</span></span>
              <div class="pf-file"><input type="file" id="photo2" accept="image/*"><img alt="" hidden></div>
              <p class="pf-error" data-error="photo2"></p>
            </div>
            <div class="pf-field">
              <span class="pf-label">内観写真②<span class="pf-badge pf-badge-req">必須</span></span>
              <div class="pf-file"><input type="file" id="photo3" accept="image/*"><img alt="" hidden></div>
              <p class="pf-error" data-error="photo3"></p>
            </div>
            <div class="pf-field">
              <span class="pf-label">内観写真③<span class="pf-badge pf-badge-opt">任意</span></span>
              <div class="pf-file"><input type="file" id="photo4" accept="image/*"><img alt="" hidden></div>
              <p class="pf-error" data-error="photo4"></p>
            </div>
            <div class="pf-field">
              <span class="pf-label">内観写真④<span class="pf-badge pf-badge-opt">任意</span></span>
              <div class="pf-file"><input type="file" id="photo5" accept="image/*"><img alt="" hidden></div>
              <p class="pf-error" data-error="photo5"></p>
            </div>
          </div>
        </section>
        <section class="pf-card" aria-labelledby="pf-feature">
          <h3 class="pf-card-title" id="pf-feature">ご自宅の紹介</h3>
          <div class="pf-field">
            <label class="pf-label" for="title">ご自宅にタイトルをつけるなら<span class="pf-badge pf-badge-req">必須</span></label>
            <input id="title" name="title" type="text" class="pf-input" maxlength="100" placeholder="例）家族団らんがより楽しくなる解放感抜群の平屋">
            <p class="pf-error" data-error="title"></p>
          </div>
          <div class="pf-field">
            <label class="pf-label" for="feature1">ご自宅の見どころ①<span class="pf-badge pf-badge-req">必須</span></label>
            <input id="feature1" name="feature1" type="text" class="pf-input" maxlength="200" placeholder="例）勾配天井のある広々としたLDK">
            <p class="pf-error" data-error="feature1"></p>
          </div>
          <div class="pf-field">
            <label class="pf-label" for="feature2">ご自宅の見どころ②<span class="pf-badge pf-badge-req">必須</span></label>
            <input id="feature2" name="feature2" type="text" class="pf-input" maxlength="200" placeholder="例）リビングの様子がよく見える対面式キッチン">
            <p class="pf-error" data-error="feature2"></p>
          </div>
          <div class="pf-field">
            <label class="pf-label" for="feature3">ご自宅の見どころ③<span class="pf-badge pf-badge-opt">任意</span></label>
            <input id="feature3" name="feature3" type="text" class="pf-input" maxlength="200">
            <p class="pf-error" data-error="feature3"></p>
          </div>
          <div class="pf-field">
            <label class="pf-label" for="feature4">ご自宅の見どころ④<span class="pf-badge pf-badge-opt">任意</span></label>
            <input id="feature4" name="feature4" type="text" class="pf-input" maxlength="200">
            <p class="pf-error" data-error="feature4"></p>
          </div>
          <div class="pf-field">
            <label class="pf-label" for="feature5">ご自宅の見どころ⑤<span class="pf-badge pf-badge-opt">任意</span></label>
            <input id="feature5" name="feature5" type="text" class="pf-input" maxlength="200">
            <p class="pf-error" data-error="feature5"></p>
          </div>
        </section>
        <div class="pf-actions">
          <button type="button" class="pf-btn pf-btn-primary" id="pf-to-step3">入力内容を確認する</button>
          <button type="button" class="pf-btn pf-btn-link" data-back="1">基本情報に戻る</button>
        </div>
      </div>

      <!-- STEP3 確認 -->
      <div id="pf-step3" hidden>
        <section class="pf-card" aria-labelledby="pf-confirm">
          <h3 class="pf-card-title" id="pf-confirm">入力内容の確認</h3>
          <dl class="pf-summary" id="pf-summary"></dl>
        </section>
        <div class="pf-actions">
          <button type="submit" class="pf-btn pf-btn-primary" id="pf-submit">この内容で申し込む</button>
          <button type="button" class="pf-btn pf-btn-link" data-back="2">写真・見どころに戻る</button>
        </div>
      </div>
    </form>

    <!-- 完了 -->
    <section class="pf-card pf-done" id="pf-step4" hidden>
      <div class="pf-done-mark" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </div>
      <h3 class="pf-heading" style="font-size:20px">ご応募いただきありがとうございました</h3>
      <p id="pf-done-name"></p>
      <p>ご入力いただいた内容について、弊社より確認のご連絡を差し上げる場合がございます。<br>特設ページに掲載した際には改めてご連絡いたしますので、今後ともよろしくお願いいたします。</p>
      <div class="pf-actions"><a class="pf-btn" href="https://kh-house.jp/owners_house/" target="_blank" rel="noopener">特設ページを見る</a></div>
    </section>
  </main>
  <script src="./form.js"></script>
</body></html>
```

### backend/scripts/gas/OwnersHouseMailImport.gs
```js
// =====================================================================
// オーナーズハウス募集の「過去の通知メール」→ owners_house_application へ取り込む（v2.2.215）
//
// ⚠️ 手で1回（必要なら数回）実行するもの。⚠️ トリガーには登録しない。
// ⚠️ 対象: 以前のフォーム（regist.php）が送っていたメール
//     件名「オーナーズハウスへの募集がありました。」／差出人 mkt@kh-house.jp／本文は HTML
//   ⚠️ v2.2.215 の新しいフォームのメールは件名が違う（【オーナーズハウス募集】…）ので取り込まない
//     （新しいフォームの応募は、送った時点で DB に入っている）。
// ⚠️ 送り先: ② https://api.khg-marketing.info/api/gateway （request: owners_house_application_import）
//   ⚠️ 同じメール（Gmail の ID）は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//   ⚠️ ② に届かないときは止める（① に予備は無い。② が直ってからもう一度実行する）。
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
// ⚠️ 写真はメールに入っていないので取り込めない（Dashboard の画面にもその旨を出している）。
// =====================================================================

const OH_IMPORT_URL = 'https://api.khg-marketing.info/api/gateway';
const OH_IMPORT_SUBJECT = 'オーナーズハウスへの募集がありました';
const OH_IMPORT_QUERY = 'subject:"' + OH_IMPORT_SUBJECT + '"';
/** ⚠️ GmailApp.search は1回に最大500スレッド。⚠️ 100ずつ読む */
const OH_IMPORT_PAGE = 100;

/** 本文の見出し（以前の regist.php の文言のまま）→ 送る項目 */
const OH_IMPORT_LABELS = {
  'お施主様名': 'name',
  '郵便番号': 'zip',
  '契約した店舗': 'shop',
  '担当営業': 'staff',
  '写真撮影について': 'photo_mode',
  'ご自宅のタイトル': 'title',
  'ご自宅の見どころ①': 'feature1',
  'ご自宅の見どころ②': 'feature2',
  'ご自宅の見どころ③': 'feature3',
  'ご自宅の見どころ④': 'feature4',
  'ご自宅の見どころ⑤': 'feature5'
};

/** HTML の本文を行に直す（<br> を改行、タグを除き、よく出る文字参照だけ戻す） */
function ohImportToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
}

/**
 * 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 }
 * ⚠️ 見出しと値は半角コロン（「お施主様名:山田様」）。⚠️ 値の中のコロンは残す（最初のコロンで分ける）。
 */
function ohImportBuildPayload(subject, html, date, messageId) {
  const s = String(subject || '');
  if (s.indexOf(OH_IMPORT_SUBJECT) === -1) return { skip: '件名が違う' };
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };

  const payload = { request: 'owners_house_application_import', message_id: messageId };
  ohImportToText(html).split('\n').forEach(function (line) {
    const trimmed = line.trim();
    const at = trimmed.search(/[:：]/);
    if (at === -1) return;
    const key = OH_IMPORT_LABELS[trimmed.slice(0, at).trim()];
    if (key && payload[key] === undefined) payload[key] = trimmed.slice(at + 1).trim();
  });

  // ⚠️ 「山田様」の「様」を外す
  payload.name = String(payload.name || '').replace(/[\s　]*様$/, '').trim();
  if (payload.name === '') return { skip: 'お施主様名が読めない' };
  payload.received_at = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  return payload;
}

// =====================================================================
// ⚠️ 手で実行する関数
// =====================================================================
function OwnersHouseMailImport() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  const count = { success: 0, exists: 0, skip: 0, error: 0 };

  for (let start = 0; ; start += OH_IMPORT_PAGE) {
    const threads = GmailApp.search(OH_IMPORT_QUERY, start, OH_IMPORT_PAGE);
    if (threads.length === 0) break;
    for (const thread of threads) {
      for (const message of thread.getMessages()) {
        const payload = ohImportBuildPayload(message.getSubject(), message.getBody(), message.getDate(), message.getId());
        if (payload.skip) {
          count.skip++;
          Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
          continue;
        }
        payload.key = key;
        const response = UrlFetchApp.fetch(OH_IMPORT_URL, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        const code = response.getResponseCode();
        const text = response.getContentText();
        Logger.log(code + ' ' + payload.received_at + ' ' + payload.name + ' : ' + text);
        if (code >= 500) {
          Logger.log('⚠️ ② に届きません。取り込みを止めました。② が直ってから、もう一度実行してください（取り込み済みは飛ばします）。');
          Logger.log(JSON.stringify(count));
          return;
        }
        if (code === 200 && text.indexOf('"exists"') !== -1) count.exists++;
        else if (code === 200) count.success++;
        else count.error++;
      }
    }
  }
  Logger.log('おわり: 取り込み ' + count.success + ' 件 / 取り込み済み ' + count.exists + ' 件 / 送らない ' + count.skip + ' 件 / エラー ' + count.error + ' 件');
}
```

### backend/scripts/guide/articles/common/screen-220.md
```md
---
title: オーナーズハウス募集
section: 画面の使い方
sort: 220
summary: オーナー様が「ご自宅を見学先として登録してよい」と応募した一覧。写真・見どころの確認。
---
ヘッダーの「反響管理 → オーナーズハウス募集」。グループで建てていただいたオーナー様が、オーナーズハウス募集のフォームから「ご自宅を見学先として登録してよい」と応募した内容を確認する画面です。

[[画面:オーナーズハウス募集]]

## 応募が届いたら
- 応募があると、社内（マーケティング・各ブランド）へメールも届きます
- 契約店舗・担当営業は、オーナー様へお礼のご連絡をしてください
- 「撮影を依頼する」のときは、撮影の日程を調整してください

## 絞り込み
- **ブランド**：ご契約店舗のブランドで絞ります
- **写真**：「撮影を依頼する」か「写真を添付する」か
- **検索**：お名前・店舗・担当営業・タイトル・見どころで探せます

## 表の見方
- 受付日時・お施主様・郵便番号・ご契約店舗・担当営業・写真・ご自宅のタイトル
- 写真を添付した応募は、写真の列に小さく写真が出ます
- 右の「見どころ・写真」を押すと、その下に見どころ①〜⑤と写真が大きく開きます。写真を押すと別の画面で元の大きさで開きます
- 見出しを押すと並べ替えられます（はじめは新しい順）

> 注意：受付日時の下に「過去のメール」と出ている応募は、以前のフォームのメールから取り込んだものです。以前のメールには写真が入っていなかったため、「写真を添付する」でも写真は出ません。

> 要確認：特設サイトへの掲載は、オーナー様に内容を確認していただいてから行ってください。
```

### backend/scripts/sql/2026-10-23_update_log_2.2.215.sql（update_log の行。記事の SQL は上の md から作ったもの）
```sql
-- =====================================================================
-- update_log に v2.2.215 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 業務ガイドの記事（オーナーズハウス募集）もこのファイルの末尾に入れる
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.215', '2026-10-23', 'オーナーズハウス募集（オーナー様がご自宅を見学先として登録するフォーム）を作り直した。届いた応募は「反響管理 → オーナーズハウス募集」で写真と一緒に見られる。以前のフォームで届いたメールも取り込んだ。');
```
