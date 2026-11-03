# 2026-10-29 他社広告の取り込みを ② に／画像を dashboard/img/meta に（v2.2.230）

## 依頼
- ReadMeClaude.md（v2.2.230）
  - extensions/meta_scraper の scraper.ts の情報を受ける API を ② に向ける。落ちた場合は ① へ
  - 保存ディレクトリを dashboard/img/meta に変更。それにともない header/MetaAdsDashboard.tsx の絶対パスも変更
  - 移植元の PHP（khg-marketing.info/api/meta/）は指示書に貼り付け
- 確認への回答: 画像は ① の dashboard/img/meta に置く（案A）／受け口に合い言葉を付ける／計画どおり着手（拡張機能はリポジトリの外を直接直す）

## 決めたこと
- **送っているのは scraper.ts ではなく拡張機能**（`C:\Users\shinji-kawano\extensions\meta\content.js`）。scraper.ts は「自社DBに保存」を押すだけなので変えていない
- **② は ① のファイルに書けない**（競合資料の PDF と同じ事情）→ ② が重複の判定と登録を行い、画像は ① の `meta_scrape_image` へ渡して ① に置かせる。順番は「画像を置く → 登録」。置けなければ 502 で登録しない
- **② が落ちたら ①**: 拡張機能の background.js が ② へ送り、つながらない・5xx なら ① の `meta_scrape`（予備。同じ処理）へ送り直す。4xx は送り直さない
  - ① の許可リスト（express_proxy.php）には入れない（拡張機能は ② へ直接送る。① に届いたものは ① が処理）
- **送信をバックグラウンドへ**: Facebook のページ（content.js）から ② へ直接送ると CORS で断られるため、拡張機能の background.js（host_permissions の宛先へ送れる）から送る
- **合い言葉** `META_SCRAPER_KEY`: 本文の `key`（会員登録の MEMBER_ENTRY_KEY と同じ作り）。未設定なら全件 401。② → ① の画像の受け渡しにも付ける。拡張機能は config.js（空で作成。値は利用者が入れる）
- **重複の判定（ad_hash）は移植元と同じ式**: sha256(広告主 . 空白をまとめたタイトル . ? 以降を落とした URL . md5(画像の data URL))
  - ② では PHP の `\s`（u なし＝半角の空白・タブ・改行・\v・\f・\r）と `trim`（" \t\n\r\0\x0B"）、`strtok`（先頭の ? を読み飛ばす）をそのまま再現した（JS の `\s`・`trim` は全角の空白も含むので使わない）
- **移植元から変えた点**: 合い言葉、画像の中身を先頭のバイトでも確かめる（公開の場所に置くため）、画像の置き場所（`dashboard/img/meta/`。① の core/meta_scrape.php の3つ上 ＝ /dashboard）
- ローカルは構成が違うので、置き場所を環境変数 `META_IMAGE_DIR`（docker-compose.yml で /tmp/img/meta）で変える
- 業務ガイド: 他社広告ライブラリを説明する記事は無く、画面の見た目も変わらないので直していない

## 確認したこと
- API（テスト用の行だけ。② は localhost:3001、① は localhost:8080）20件すべて期待どおり
  - ②・① それぞれ: 合い言葉なし・ちがい 401／画像なし 400／中身が画像でない 400／svg 400
  - ② で保存 → 画像が ① の置き場所に置かれた・同じ広告は ② も ① も skipped（② と ① のハッシュが同じ）
  - ① で保存（予備）→ 画像が置かれた・同じ広告は ② で skipped
  - 画像の受け口: 合い言葉なし 401／`../../x.php` のようなファイル名 400／画像でない 400
  - ① を止めて ② に送る → 502 で登録しない
  - ⚠️ ローカルの ② には PHP_GATEWAY_URL が無いので、テストの間だけ一時的な設定（スクラッチパッドの compose の上書き）で立てた。終わったあと元に戻した
- 拡張機能（Playwright で本物の拡張機能を読み込み。⚠️ 本番へ送らないよう写しを作り、送り先だけローカルに差し替え。偽の広告カードのページ）
  - ② が動いているとき: 「✅ DB保存完了」→ もう一度押すと「⏭️ 保存済スキップ」
  - ② を止めたとき: ① へ送り直されて「✅ DB保存完了」→「⏭️ 保存済スキップ」
- 画面（Playwright）: 他社広告ライブラリの画像の URL が `https://khg-marketing.info/dashboard/img/meta/...`。ページのエラー 0
- ② の型チェック・① の php -l・本番ビルド
- リファクタリング: 今回の範囲で整理するものは無かった（新しいファイルのみ・画面は1行）
- テスト用の行・担当者・画像は消した。テスト用のサーバー（3100・8765）は止めた

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/metaAds | **scrape.ts（新規）** | runMetaScrape・metaAdHash・keyMatches・cleanUrl・cleanTitle・looksLikeImage・storeImageOnPhp |
| backend-express/src/gateway | registry.ts | `meta_scrape`（auth: none・合い言葉） |
| backend-express/src/config | env.ts | metaScraperKey |
| backend/src/core | **meta_scrape.php（新規）** | metaScrapeRespond・metaScrapeRequireKey・metaScrapeImageDir・metaScrapeLooksLikeImage・metaScrapeSaveImage |
| backend/src/handlers | **meta_scrape.php・meta_scrape_image.php（新規）** | 予備の受け口／画像の受け口 |
| frontend/src/components/header | MetaAdsDashboard.tsx | IMAGE_BASE_URL |
| frontend/src/utils | version.ts | 2.2.230 |
| （ルート） | docker-compose.yml・docker-compose.prod.yml | META_SCRAPER_KEY（ローカルはダミー値）・META_IMAGE_DIR（ローカルのみ） |
| backend/scripts/sql | **2026-10-29_update_log_2.2.230.sql（新規）** | 更新履歴 |
| C:\Users\shinji-kawano\extensions\meta（リポジトリの外） | **background.js・config.js（新規）**・content.js・manifest.json | 送信をバックグラウンドへ・② → ①・合い言葉 |

## コード

### 新規 backend-express/src/features/metaAds/scrape.ts
```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';

/**
 * 他社広告の取り込み（v2.2.230。request: 'meta_scrape'）。
 *
 * ─────────────────────────────────────────────
 * 送ってくるのは拡張機能 C:\Users\shinji-kawano\extensions\meta（background.js）。
 *   scraper.ts が広告ライブラリで「自社DBに保存」を押し、拡張機能がここへ送る。
 *   ⚠️ ② がつながらない・5xx のときは、拡張機能が ① の handlers/meta_scrape.php へ送り直す（同じ処理を持つ予備）。
 *
 * ⚠️⚠️ **画像は ① に置く**（dashboard/img/meta/。画面は https://khg-marketing.info/dashboard/img/meta/ から出す）。
 *   ⚠️ ② は ① のファイルに書けないので、① の meta_scrape_image へ渡して ① に保存させる。
 *   ⚠️ 順番は「画像を ① に置く → 登録」。画像が置けなければ登録せず 502（拡張機能が ① へ送り直す）。
 *
 * ⚠️ 移植元は khg-marketing.info/api/meta/（リポジトリの外の PHP）。違い:
 *   - 合い言葉（key）を付けた（移植元は誰でも送れた）
 *   - 画像の中身が本当に画像か、先頭のバイトでも確かめる（移植元は data URL の型だけ見ていた）
 * ⚠️⚠️ **重複の判定（ad_hash）の式は移植元と1文字も変えないこと。** 変えると今ある約3,800件と重複を判定できず、同じ広告が二重に入る。
 *   ⚠️ ① の meta_scrape.php も同じ式。
 * ─────────────────────────────────────────────
 */

export interface MetaScrapeResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** 合い言葉。⚠️ 未設定なら必ず false。⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる（memberEntry と同じ） */
const keyMatches = (input: string): boolean => {
  const expected = env.metaScraperKey;
  if (expected === '') return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** PHP の strtok($lpUrl, '?')（⚠️ 先頭の ? は読み飛ばし、何も残らなければ ''） */
const cleanUrl = (lpUrl: string): string => lpUrl.replace(/^\?+/, '').split('?')[0];

/**
 * PHP の trim(preg_replace('/\s+/', ' ', $adTitle))。
 * ⚠️ PHP の \s（u 修飾子なし）は半角の空白・タブ・改行・\v・\f・\r だけ。JS の \s は全角の空白なども含むので使わない。
 * ⚠️ PHP の trim が落とすのは " \t\n\r\0\x0B"。
 */
const cleanTitle = (adTitle: string): string =>
  adTitle.replace(/[ \t\n\x0B\f\r]+/g, ' ').replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');

/** 移植元と同じ ad_hash（sha256(広告主 . タイトル . URL . md5(画像の data URL))） */
export const metaAdHash = (advertiserName: string, adTitle: string, lpUrl: string, base64Image: string): string => {
  const imageHash = createHash('md5').update(base64Image).digest('hex');
  return createHash('sha256').update(advertiserName + cleanTitle(adTitle) + cleanUrl(lpUrl) + imageHash).digest('hex');
};

/** 先頭のバイトが拡張子どおりの画像か（⚠️ ① に公開で置くので、画像でないものを置かない） */
const looksLikeImage = (buf: Buffer, extension: string): boolean => {
  if (extension === 'jpg' || extension === 'jpeg') return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (extension === 'png') return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === 'gif') return buf.subarray(0, 4).toString('latin1') === 'GIF8';
  if (extension === 'webp') return buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  return false;
};

/** 画像を ① の meta_scrape_image へ渡して dashboard/img/meta/ に置かせる。⚠️ 置けたら true */
const storeImageOnPhp = async (filename: string, base64Data: string): Promise<boolean> => {
  const target = env.phpGatewayUrl;
  if (target === undefined) {
    logger.error('meta_scrape: PHP_GATEWAY_URL が未設定のため、画像を ① へ渡せません');
    return false;
  }
  try {
    const response = await fetch(target, {
      method: 'POST',
      // ⚠️ x-forwarded-by を付ける（① が ② へ送り返さないための目印。phpFallback.ts と同じ）
      headers: { 'content-type': 'application/json', 'x-forwarded-by': 'express-gateway' },
      body: JSON.stringify({ request: 'meta_scrape_image', key: env.metaScraperKey, filename, image: base64Data }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await response.json().catch(() => ({}))) as { status?: string; message?: string };
    if (response.ok && body.status === 'success') return true;
    logger.error(`meta_scrape: ① が画像を受け取りませんでした ${response.status} ${body.message ?? ''}`);
    return false;
  } catch (error) {
    logger.error(`meta_scrape: ① へ画像を渡せませんでした ${(error as Error).message}`);
    return false;
  }
};

/** body = { key, advertiser_name, advertiser_area, advertiser_period, ad_title, lp_url, scraped_date, base64_image } */
export const runMetaScrape = async (body: Record<string, unknown>): Promise<MetaScrapeResult> => {
  if (!keyMatches(str(body.key))) {
    if (env.metaScraperKey === '') logger.warn('META_SCRAPER_KEY が未設定のため、他社広告の取り込みを断りました。');
    return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
  }
  const base64Image = str(body.base64_image);
  if (base64Image === '') {
    return { httpStatus: 400, body: { status: 'error', message: 'データが不足しています' } };
  }

  const advertiserName = str(body.advertiser_name);
  const adTitle = str(body.ad_title);
  const lpUrl = str(body.lp_url);
  const adHash = metaAdHash(advertiserName, adTitle, lpUrl, base64Image);

  const exists = await query<RowDataPacket>('SELECT id FROM meta_ads WHERE ad_hash = ?', [adHash]);
  if (exists.length > 0) {
    return { httpStatus: 200, body: { status: 'skipped', message: '既に保存されている広告です' } };
  }

  const match = /^data:image\/(\w+);base64,/.exec(base64Image);
  if (!match) {
    return { httpStatus: 400, body: { status: 'error', message: '無効な画像データです' } };
  }
  const extension = match[1].toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { httpStatus: 400, body: { status: 'error', message: '許可されていない画像形式です' } };
  }
  const base64Data = base64Image.slice(base64Image.indexOf(',') + 1);
  if (!looksLikeImage(Buffer.from(base64Data, 'base64'), extension)) {
    return { httpStatus: 400, body: { status: 'error', message: '無効な画像データです' } };
  }

  // ⚠️ 移植元の uniqid('ad_') と同じ形（ad_ ＋ 英小文字と数字）
  const imageFilename = `ad_${randomBytes(8).toString('hex')}.${extension}`;
  if (!(await storeImageOnPhp(imageFilename, base64Data))) {
    return { httpStatus: 502, body: { status: 'error', message: '画像の保存に失敗しました' } };
  }

  await execute(
    `INSERT IGNORE INTO meta_ads
       (advertiser_name, advertiser_area, advertiser_period, ad_title, image_filename, lp_url, ad_hash, scraped_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    // ⚠️ lp_url は生のまま（画面で押して開くため）。ハッシュだけ ? 以降を落とした URL で作る
    [advertiserName, str(body.advertiser_area), str(body.advertiser_period), adTitle, imageFilename, lpUrl, adHash, str(body.scraped_date)]
  );
  logger.info(`meta_scrape: 保存 ${advertiserName} ${imageFilename}`);
  return { httpStatus: 200, body: { status: 'success', message: 'DBに保存しました', file: imageFilename } };
};
```

### 新規 backend/src/core/meta_scrape.php
```php
<?php

/**
 * 他社広告の取り込み（v2.2.230）で ① が使う共通の処理。
 *
 * ─────────────────────────────────────────────
 * 使うところ:
 *   handlers/meta_scrape.php       … ② に届かなかったときの予備（重複の判定・画像の保存・登録をすべて行う）
 *   handlers/meta_scrape_image.php … ② から画像だけを受けて保存する
 *
 * ⚠️ 画像の置き場所は dashboard/img/meta/（画面は https://khg-marketing.info/dashboard/img/meta/ から出す）。
 *   ⚠️ このファイルは /dashboard/api/gateway/core/ にあるので、3つ上が /dashboard。
 *   ⚠️ ローカル（Docker）は構成が違うので、環境変数 META_IMAGE_DIR で置き場所を変える（docker-compose.yml）。
 * ⚠️ 合い言葉は META_SCRAPER_KEY（② の .env.prod・拡張機能の config.js と同じ値）。⚠️ 未設定なら全件断る。
 * ─────────────────────────────────────────────
 */

const META_SCRAPE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

function metaScrapeRespond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** 合い言葉を確かめ、違えば 401 で終わる */
function metaScrapeRequireKey(array $data, string $label): void
{
    $expectedKey = trim((string)getenv('META_SCRAPER_KEY'));
    $inputKey = is_string($data['key'] ?? null) ? $data['key'] : '';
    if ($expectedKey === '' || !hash_equals($expectedKey, $inputKey)) {
        if ($expectedKey === '') {
            error_log("{$label}: META_SCRAPER_KEY が未設定のため断りました");
        }
        metaScrapeRespond(401, ['status' => 'error', 'message' => '合い言葉が違います。']);
    }
}

function metaScrapeImageDir(): string
{
    $dir = trim((string)getenv('META_IMAGE_DIR'));
    return rtrim($dir !== '' ? $dir : dirname(__DIR__, 3) . '/img/meta', '/') . '/';
}

/** 先頭のバイトが拡張子どおりの画像か（⚠️ 公開の場所に置くので、画像でないものを置かない。② の looksLikeImage と同じ） */
function metaScrapeLooksLikeImage(string $bytes, string $extension): bool
{
    switch ($extension) {
        case 'jpg':
        case 'jpeg':
            return strncmp($bytes, "\xFF\xD8\xFF", 3) === 0;
        case 'png':
            return strncmp($bytes, "\x89PNG\r\n\x1A\n", 8) === 0;
        case 'gif':
            return strncmp($bytes, 'GIF8', 4) === 0;
        case 'webp':
            return substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP';
    }
    return false;
}

/** 画像を置く。⚠️ ファイル名は呼ぶ側が決めたもの（ad_ ＋ 英小文字と数字 ＋ 拡張子）だけを通す */
function metaScrapeSaveImage(string $filename, string $bytes): bool
{
    if (!preg_match('/^ad_[0-9a-f]{13,32}\.(jpg|jpeg|png|gif|webp)$/', $filename, $m)) {
        return false;
    }
    if (!metaScrapeLooksLikeImage($bytes, $m[1])) {
        return false;
    }
    $dir = metaScrapeImageDir();
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        error_log("meta_scrape: 画像の置き場所を作れませんでした {$dir}");
        return false;
    }
    return file_put_contents($dir . $filename, $bytes) !== false;
}
```

### 新規 backend/src/handlers/meta_scrape.php
```php
<?php

/**
 * 他社広告の取り込み（v2.2.230）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/metaAds/scrape.ts の予備である。同じ処理を持つ。**
 *   ⚠️ 拡張機能（extensions/meta）はふだん ② へ送る。ここに届くのは ② がつながらない・5xx のときだけ。
 *   ⚠️ ここを変えたら scrape.ts も同じように変えること。
 * ⚠️ 移植元は khg-marketing.info/api/meta/（リポジトリの外）。違いは合い言葉と、画像の中身の確かめと、画像の置き場所（dashboard/img/meta/）。
 * ⚠️⚠️ **重複の判定（ad_hash）の式は移植元と1文字も変えないこと。**（今ある広告と重複を判定できなくなる）
 * ─────────────────────────────────────────────
 */

require_once __DIR__ . '/../core/meta_scrape.php';

metaScrapeRequireKey($data, 'meta_scrape');

if (!is_string($data['base64_image'] ?? null) || $data['base64_image'] === '') {
    metaScrapeRespond(400, ['status' => 'error', 'message' => 'データが不足しています']);
}

$str = function ($value): string {
    return is_string($value) ? $value : '';
};
$advertiser_name   = $str($data['advertiser_name'] ?? '');
$advertiser_area   = $str($data['advertiser_area'] ?? '');
$advertiser_period = $str($data['advertiser_period'] ?? '');
$ad_title          = $str($data['ad_title'] ?? '');
$lp_url            = $str($data['lp_url'] ?? '');
$scraped_date      = $str($data['scraped_date'] ?? '');
$base64_image      = $data['base64_image'];

// 移植元と同じ ad_hash（? 以降を落とした URL・空白をまとめたタイトル・画像の md5）
$clean_url = strtok($lp_url, '?');
$clean_title = trim(preg_replace('/\s+/', ' ', $ad_title));
$ad_hash = hash('sha256', $advertiser_name . $clean_title . $clean_url . md5($base64_image));

$stmt = $pdo->prepare('SELECT id FROM meta_ads WHERE ad_hash = :ad_hash');
$stmt->execute([':ad_hash' => $ad_hash]);
if ($stmt->fetch()) {
    metaScrapeRespond(200, ['status' => 'skipped', 'message' => '既に保存されている広告です']);
}

if (!preg_match('/^data:image\/(\w+);base64,/', $base64_image, $type)) {
    metaScrapeRespond(400, ['status' => 'error', 'message' => '無効な画像データです']);
}
$extension = strtolower($type[1]);
if (!in_array($extension, META_SCRAPE_EXTENSIONS, true)) {
    metaScrapeRespond(400, ['status' => 'error', 'message' => '許可されていない画像形式です']);
}
$bytes = base64_decode(substr($base64_image, strpos($base64_image, ',') + 1));
if ($bytes === false || !metaScrapeLooksLikeImage($bytes, $extension)) {
    metaScrapeRespond(400, ['status' => 'error', 'message' => '無効な画像データです']);
}

$image_filename = uniqid('ad_') . '.' . $extension;
if (!metaScrapeSaveImage($image_filename, $bytes)) {
    metaScrapeRespond(500, ['status' => 'error', 'message' => '画像の保存に失敗しました']);
}

$stmt = $pdo->prepare(
    'INSERT IGNORE INTO meta_ads
        (advertiser_name, advertiser_area, advertiser_period, ad_title, image_filename, lp_url, ad_hash, scraped_date)
     VALUES (:advertiser_name, :advertiser_area, :advertiser_period, :ad_title, :image_filename, :lp_url, :ad_hash, :scraped_date)'
);
$stmt->execute([
    ':advertiser_name'   => $advertiser_name,
    ':advertiser_area'   => $advertiser_area,
    ':advertiser_period' => $advertiser_period,
    ':ad_title'          => $ad_title,
    ':image_filename'    => $image_filename,
    ':lp_url'            => $lp_url, // ⚠️ 生の URL のまま（画面で押して開くため）
    ':ad_hash'           => $ad_hash,
    ':scraped_date'      => $scraped_date,
]);

metaScrapeRespond(200, ['status' => 'success', 'message' => 'DBに保存しました', 'file' => $image_filename]);
```

### 新規 backend/src/handlers/meta_scrape_image.php
```php
<?php

/**
 * 他社広告の画像を dashboard/img/meta/ に置く（v2.2.230）。
 *
 * ⚠️ 呼ぶのは ② の features/metaAds/scrape.ts だけ（② は ① のファイルに書けないため、画像だけここへ渡す）。
 * ⚠️ 登録（meta_ads）は ② が行う。ここは画像を置くだけ。
 * ⚠️ body = { key, filename, image（data URL の , より後ろ） }
 */

require_once __DIR__ . '/../core/meta_scrape.php';

metaScrapeRequireKey($data, 'meta_scrape_image');

$filename = is_string($data['filename'] ?? null) ? $data['filename'] : '';
$bytes = base64_decode(is_string($data['image'] ?? null) ? $data['image'] : '', true);

if ($bytes === false || $bytes === '' || !metaScrapeSaveImage($filename, $bytes)) {
    error_log("meta_scrape_image: 画像を置けませんでした file=\"{$filename}\"");
    metaScrapeRespond(400, ['status' => 'error', 'message' => '画像の保存に失敗しました']);
}

metaScrapeRespond(200, ['status' => 'success', 'file' => $filename]);
```

### 変更（差分）
```diff
diff --git a/backend-express/src/config/env.ts b/backend-express/src/config/env.ts
index 22b4d2d5..18b5f076 100644
--- a/backend-express/src/config/env.ts
+++ b/backend-express/src/config/env.ts
@@ -184,12 +184,20 @@ export const env = {
    * ⚠️ **未設定なら全件断る**（素通しにしない）。⚠️ requireEnv にはしない（他の機能まで止めないため）。
    * ⚠️ 同じ値を GAS のスクリプト プロパティ MEMBER_ENTRY_KEY と ① の環境変数にも入れる。
    *   ⚠️ **リポジトリに書かないこと。** 設定先は ② VPS の .env.prod のみ。
    */
   memberEntryKey: (process.env.MEMBER_ENTRY_KEY ?? '').trim(),
 
+  /**
+   * 他社広告の取り込み（meta_scrape。拡張機能 extensions/meta が送る）の合い言葉。（v2.2.230）
+   *
+   * ⚠️ **未設定なら全件断る**（素通しにしない）。⚠️ 画像を ① の meta_scrape_image へ渡すときにも付ける。
+   * ⚠️ 同じ値を拡張機能の config.js と ① の環境変数にも入れる。⚠️ **リポジトリに書かないこと。**
+   */
+  metaScraperKey: (process.env.META_SCRAPER_KEY ?? '').trim(),
+
   /**
    * 「Claudeによる分析」（v2.2.217）が使う Anthropic の API キー。
    *
    * ⚠️ **未設定なら分析を受け付けない**（他の機能は止めないため requireEnv にはしない）。
    * ⚠️ **リポジトリに書かないこと。** 設定先は ② VPS の .env.prod のみ。
    *   差し替えの手順は docs/deploy-v2.2.217.md。
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 74004258..788be2fb 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -133,12 +133,13 @@ import {
   listReports,
   logReportView,
   MAX_HTML_BYTES,
   saveReport,
 } from '../features/analysis/report';
 import { runMetaAdsBookmark, runMetaAdsList } from '../features/metaAds';
+import { runMetaScrape } from '../features/metaAds/scrape';
 import { runPropertySuumo } from '../features/property';
 import { runSuumoPropertyInsert } from '../features/suumoProperty';
 import { runShopList } from '../features/shopList';
 import { runUpdateLog } from '../features/updateLog';
 import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
 import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
@@ -2640,12 +2641,32 @@ register({
   summary: '【書き込み】他社広告のブックマーク',
   phpSource: 'backend/src/handlers/meta_ads.php',
   auth: 'staff',
   handler: async (ctx) => runMetaAdsBookmark(ctx.body),
 });
 
+/**
+ * ⚠️⚠️ **他社広告の取り込み。書き込み口である。**（v2.2.230）
+ *   ⚠️ 送ってくるのは拡張機能 extensions/meta（scraper.ts が押す「自社DBに保存」）。スタッフのトークンは無いので auth は none、
+ *     代わりに合い言葉（META_SCRAPER_KEY）を本文の `key` で確かめる。
+ *   ⚠️ 拡張機能は ② に届かない・5xx なら ① の handlers/meta_scrape.php へ送り直す（同じ処理）。同じ広告は二度入らない（skipped）。
+ *   ⚠️ 画像は ① の meta_scrape_image へ渡して ① の dashboard/img/meta/ に置く（features/metaAds/scrape.ts）。
+ *   ⚠️ ① の許可リスト（express_proxy.php）には入れない（拡張機能は ② へ直接送る。① に届いたものは ① が処理する予備）。
+ */
+register({
+  request: 'meta_scrape',
+  summary: '【書き込み・合い言葉】他社広告（Meta 広告ライブラリ）の取り込み（meta_ads・画像は ①）',
+  phpSource: 'khg-marketing.info/api/meta/（handlers/meta_scrape.php に作り直し）',
+  auth: 'none',
+  handler: async (ctx) => {
+    const result = await runMetaScrape(ctx.body as Record<string, unknown>);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 // ---------------------------------------------------------------------------
 // 失注一覧
 //
 // ⚠️ 参照のみ。⚠️ ① に PHP ハンドラが実在するので、
 //   転送に失敗しても ① へ自動フォールバックして動く。
 //
diff --git a/docker-compose.prod.yml b/docker-compose.prod.yml
index 0293f1ff..9bc8b677 100644
--- a/docker-compose.prod.yml
+++ b/docker-compose.prod.yml
@@ -122,12 +122,19 @@ services:
       #
       # ⚠️ 未設定だと全件 401（素通しにしない）。GAS は ① の予備へ送り直すが、① も同じ値でないと入らない。
       # ⚠️ GAS のスクリプト プロパティ MEMBER_ENTRY_KEY・① の環境変数と**同じ値**にすること。
       # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
       - MEMBER_ENTRY_KEY=${MEMBER_ENTRY_KEY:-}
 
+      # 他社広告の取り込み（meta_scrape。拡張機能 extensions/meta が送る）の合い言葉（v2.2.230）。
+      #
+      # ⚠️ 未設定だと全件 401（素通しにしない）。⚠️ ② は画像を ① の meta_scrape_image へ渡すときにもこの値を付ける。
+      # ⚠️ 拡張機能の config.js・① の環境変数と**同じ値**にすること。
+      # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
+      - META_SCRAPER_KEY=${META_SCRAPER_KEY:-}
+
       # 「Claudeによる分析」（v2.2.217）が使う Anthropic の API キー（Claude Console で発行したもの）。
       #
       # ⚠️ 未設定だと分析の開始が 503 になる（他の機能は動く）。
       # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。** 差し替え手順は docs/deploy-v2.2.217.md
       - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
 
diff --git a/docker-compose.yml b/docker-compose.yml
index a5a01dfc..c6b40c66 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -23,12 +23,16 @@ services:
       #
       # ⚠️ localhost ではなく express-api（サービス名）。
       #   php-web コンテナの中から見た宛先なので、localhost は自分自身になる。
       - EXPRESS_API_URL=http://express-api:3001/api/gateway
       # 会員登録の取り込み（member_entry）の合い言葉。⚠️ 開発用のダミー値。本番の値は ① の環境変数にのみ書く（v2.2.209）
       - MEMBER_ENTRY_KEY=localtest
+      # 他社広告の取り込み（meta_scrape・meta_scrape_image）の合い言葉。⚠️ 開発用のダミー値。本番の値は ① の環境変数にのみ書く（v2.2.230）
+      - META_SCRAPER_KEY=localtest
+      # 他社広告の画像の置き場所（v2.2.230）。⚠️ 本番は指定しない（core/meta_scrape.php が /dashboard/img/meta/ を使う）。ローカルはコンテナの中の /tmp に置く
+      - META_IMAGE_DIR=/tmp/img/meta
     env_file:
       # 実際に価値を持つ秘密情報（暗号化マスターキー等）はこちら。
       # このファイルは .gitignore で保護されており、Gitには入らない。
       - ./backend/.env
     depends_on:
       mariadb-db:
@@ -69,12 +73,14 @@ services:
       #
       # ⚠️ 空にすると受付機能が全て 401 になる。ローカルで受付を試すときは
       #   この値を使うこと。
       - EVENT_CHECKIN_PASSCODE=localtest
       # 会員登録の取り込み（member_entry）の合い言葉。⚠️ 開発用のダミー値。本番の値は ② VPS の .env.prod にのみ書く（v2.2.209）
       - MEMBER_ENTRY_KEY=localtest
+      # 他社広告の取り込み（meta_scrape）の合い言葉。⚠️ 開発用のダミー値。本番の値は ② VPS の .env.prod にのみ書く（v2.2.230）
+      - META_SCRAPER_KEY=localtest
     env_file:
       # Meta 広告 API のトークンと対象の ID（v2.2.203。META_ACCESS_TOKEN・META_AD_ACCOUNTS）。
       #
       # ⚠️ 開発で使う秘密の値だけを書くファイル。.gitignore の **/.env.* で Git には入らない。
       # ⚠️ 無くても起動する（required: false）。
       # ⚠️ backend-express/.env は読ませない（中身が本番向きだと、開発中の操作が本番へ向かうおそれがある）。
diff --git a/frontend/src/components/header/MetaAdsDashboard.tsx b/frontend/src/components/header/MetaAdsDashboard.tsx
index bb55336f..f2567455 100644
--- a/frontend/src/components/header/MetaAdsDashboard.tsx
+++ b/frontend/src/components/header/MetaAdsDashboard.tsx
@@ -33,13 +33,14 @@ const MetaAdsDashboard = () => {
     const [showSuggestions, setShowSuggestions] = useState(false);
     const [showBanner, setShowBanner] = useState('');
     const [imgHover, setImgHover] = useState('');
 
     const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);
 
-    const IMAGE_BASE_URL = 'https://khg-marketing.info/api/meta/images/';
+    // ⚠️ v2.2.230: 画像の置き場所を api/meta/images/ から dashboard/img/meta/ に移した（① の core/meta_scrape.php が置く）
+    const IMAGE_BASE_URL = 'https://khg-marketing.info/dashboard/img/meta/';
 
     useEffect(() => {
         const fetchData = async () => {
             try {
                 // ⚠️ roll を付けること。移植元は1つの request で読み書きを兼ねていたため、
                 //   ⚠️ ② 側は roll で分けている（許可リストも roll 込み）
```

### 拡張機能 extensions/meta/background.js（全文。config.js は空のまま作ったもの）
```js
// 他社広告の送信（v2.2.230）。content.js から受け取って、② → ① の順に送る。
//
// ⚠️ 送信をここ（バックグラウンド）で行うのは、Facebook のページ（content.js）から直接送ると
//   ② の CORS で断られるため。拡張機能のバックグラウンドは manifest.json の host_permissions の宛先へ送れる。
// ⚠️ ② がつながらない・5xx のときだけ ① へ送り直す（① の handlers/meta_scrape.php が同じ処理を持つ予備）。
//   ⚠️ 4xx（合い言葉ちがい・画像の形式など）は送り直さない（① でも同じ結果になるため）。
// ⚠️ 合い言葉は config.js の META_SCRAPER_KEY（② の .env.prod・① の環境変数と同じ値）。
importScripts("config.js");

const ENDPOINTS = [
  "https://api.khg-marketing.info/api/gateway", // ②
  "https://khg-marketing.info/dashboard/api/gateway/", // ①（予備）
];

async function sendAd(payload) {
  let last = { ok: false, status: 0, body: { message: "送信先がありません" } };
  for (const url of ENDPOINTS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: "meta_scrape", key: META_SCRAPER_KEY, ...payload }),
      });
      const body = await response.json().catch(() => ({}));
      last = { ok: response.ok, status: response.status, body };
      if (response.status < 500) return last;
      console.warn(`meta_scrape: ${url} が ${response.status} を返したので次へ送り直します`);
    } catch (error) {
      console.warn(`meta_scrape: ${url} につながらないので次へ送り直します`, error);
      last = { ok: false, status: 0, body: { message: String(error) } };
    }
  }
  return last;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "meta_scrape") return false;
  sendAd(message.payload).then(sendResponse);
  return true; // ⚠️ 非同期で返すため true
});
```

### 拡張機能 extensions/meta/config.js（全文。config.js は空のまま作ったもの）
```js
// 他社広告の取り込みの合い言葉（v2.2.230）。
// ⚠️ ② の .env.prod と ① の環境変数の META_SCRAPER_KEY と同じ値を '' の中に入れる。
// ⚠️ 空のままだと ② も ① も 401（合い言葉が違います）で断る。
// ⚠️ このファイルを人に渡したり、リポジトリに入れたりしないこと。
const META_SCRAPER_KEY = '';
```

### 拡張機能 extensions/meta/manifest.json（全文。config.js は空のまま作ったもの）
```json
{
  "manifest_version": 3,
  "name": "Ad Library Scraper",
  "version": "1.1",
  "description": "広告ライブラリのバナーとLPを保存します",
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://ja-jp.facebook.com/ads/library*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "host_permissions": [
    "https://api.khg-marketing.info/*",
    "https://khg-marketing.info/*"
  ]
}
```

### 拡張機能 extensions/meta/content.js（全文。config.js は空のまま作ったもの）
```js
// --- 送信先は background.js（v2.2.230。② → つながらなければ ①。合い言葉は config.js） ---

const companies = {
  111047170699970: { company: "アイ工務店", area: "全国" },
  695530917262640: { company: "国分ハウジング", area: "自社" },
  102537081863563: { company: "ニーエルホーム", area: "自社" },
  100635279452792: { company: "デイジャストハウス", area: "自社" },
  100850992538468: { company: "ジャスフィーホーム", area: "自社" },
  651050868097391: { company: "なごみ工務店", area: "自社" },
  464717077328469: { company: "七呂建設", area: "鹿児島県" },
  581834621827901: { company: "ヤマサハウス", area: "鹿児島県" },
  246962733890985: { company: "ネオデザインホーム", area: "鹿児島県" },
  242880655765252: { company: "一条工務店", area: "全国" },
  152995254781233: { company: "トータルハウジング", area: "鹿児島県" },
  560021691070532: { company: "センチュリーハウス", area: "鹿児島県" },
  196303913732193: { company: "タマホーム", area: "全国" },
  104475525790556: { company: "丸商建設", area: "宮崎県" },
  461170903964046: { company: "マエムラ", area: "宮崎県" },
  690608987664702: { company: "ヤマダホームズ", area: "全国" },
  300826773262472: { company: "アイホーム", area: "宮崎県" },
  186774961384870: { company: "積水ハウス", area: "全国" },
  250012058453028: { company: "三越商事大分", area: "大分県" },
  105310812882779: { company: "ベツダイ", area: "大分県" },
  986452461444131: { company: "栄都", area: "大分県" },
  101289366621166: { company: "大和ハウス工業", area: "大分県" },
  607909126265943: { company: "住友林業", area: "全国" },
  107811180947668: { company: "シアーズホーム", area: "熊本県" },
  452743688078420: { company: "LibWork", area: "熊本県" },
  252737871435205: { company: "新産住拓", area: "熊本県" },
  573617829165994: { company: "昭和建設", area: "佐賀県" },
  114264757366538: { company: "シアーズホームバース", area: "熊本県" },
};

async function imageUrlToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("画像変換エラー:", error);
    return null;
  }
}

function getFormattedDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function injectSaveButtons() {
  const adCards = document.querySelectorAll(
    "div.x1ywc1zp, div.x1plvlek.xryxfnj",
  );

  adCards.forEach((card) => {
    if (card.querySelector(".custom-save-btn")) return;

    const lpLinkEl = card.querySelector('a[rel="nofollow noreferrer"][href]');
    const imgEl = card.querySelector(
      'img[referrerpolicy="origin-when-cross-origin"]',
    );

    if (!lpLinkEl || !imgEl) return;

    const lpUrl = lpLinkEl.href;
    const imgUrl = imgEl.src;

    const profileImgEl = card.querySelector(
      'img[alt]:not([referrerpolicy="origin-when-cross-origin"])',
    );
    const advertiserName = profileImgEl ? profileImgEl.alt : "取得不可";

    const titleEl = card.querySelector('div[style*="white-space: pre-wrap"]');
    const adTitle = titleEl ? titleEl.innerText.trim() : "テキストなし";
    const scrapedDate = getFormattedDate();

    const btn = document.createElement("button");
    btn.innerText = "💾 自社DBに保存";
    btn.className = "custom-save-btn";
    btn.style.cssText = `
            display: block;
            width: 100%;
            padding: 10px;
            background-color: #0084ff;
            color: white;
            border: none;
            border-radius: 5px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 10px;
            z-index: 9999;
        `;

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      btn.innerText = "⏳ 保存中...";
      btn.style.backgroundColor = "#ccc";

      const base64Image = await imageUrlToBase64(imgUrl);

      if (!base64Image) {
        btn.innerText = "❌ 画像取得エラー";
        btn.style.backgroundColor = "#f44336";
        return;
      }

      // ① URLから view_all_page_id を取得
      const urlParams = new URLSearchParams(window.location.search);
      const pageId = urlParams.get("view_all_page_id");

      // ② IDをキーにして companies から企業名とエリアを取得
      let finalAdvertiserName = advertiserName;
      let finalAdvertiserArea = "不明";

      if (pageId && companies[pageId]) {
        finalAdvertiserName = companies[pageId].company;
        finalAdvertiserArea = companies[pageId].area;
      }

      // 💡 ③ 【改修箇所】すでに特定できている「card」要素の中から「掲載開始」を含むスパンを探す
      let finalAdvertiserPeriod = "";
      const spans = card.querySelectorAll("span");
      spans.forEach((span) => {
        if (span.textContent.includes("掲載開始")) {
          // 「掲載開始日」や「掲載開始:」などの表記揺れ、前後の空白やコロンを正規表現できれいに除去
          finalAdvertiserPeriod = span.textContent
            .replace(/掲載開始日|掲載開始/, "")
            .replace(/[:：]/, "")
            .trim();
        }
      });

      try {
        // v2.2.230: 送信は background.js が行う（② → つながらなければ ①）。キー名は ②・① と同じ
        const response = await chrome.runtime.sendMessage({
          type: "meta_scrape",
          payload: {
            advertiser_name: finalAdvertiserName,
            advertiser_area: finalAdvertiserArea,
            advertiser_period: finalAdvertiserPeriod, // 💡 これで確実に日付が飛びます
            ad_title: adTitle,
            lp_url: lpUrl,
            base64_image: base64Image,
            scraped_date: scrapedDate,
          },
        });

        const result = response?.body ?? {};

        if (response?.ok) {
          if (result.status === "skipped") {
            btn.innerText = "⏭️ 保存済スキップ";
            btn.style.backgroundColor = "#9e9e9e";
          } else {
            btn.innerText = "✅ DB保存完了";
            btn.style.backgroundColor = "#4caf50";
          }
        } else {
          throw new Error(result.message || "API Error");
        }
      } catch (error) {
        console.error("保存エラー:", error);
        btn.innerText = "❌ エラー";
        btn.style.backgroundColor = "#f44336";
      }
    });

    lpLinkEl.parentElement.appendChild(btn);
  });
}

// 初回起動時の待機
setTimeout(injectSaveButtons, 3000);

// スクロール等による動的追加を監視
const observer = new MutationObserver(() => {
  injectSaveButtons();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
```

### 拡張機能 content.js の差分（元は scratchpad に控え）
```diff
--- /c/Users/SHINJI~1/AppData/Local/Temp/claude/c--Users-shinji-kawano-react-dashboard/f17ffd00-1ebc-4533-a8d9-ede3c6283bd3/scratchpad/meta_ext_backup/content.js	2026-10-29 17:53:00.262174900 +0900
+++ /c/Users/shinji-kawano/extensions/meta/content.js	2026-10-29 17:54:16.090151000 +0900
@@ -1,5 +1,4 @@
-// --- 自社バックエンドのURLを指定 ---
-const API_ENDPOINT = "https://khg-marketing.info/api/meta/";
+// --- 送信先は background.js（v2.2.230。② → つながらなければ ①。合い言葉は config.js） ---
 
 const companies = {
   111047170699970: { company: "アイ工務店", area: "全国" },
@@ -142,11 +141,10 @@
       });
 
       try {
-        // PHP側と合わせた統一キー名でPOSTを送信
-        const response = await fetch(API_ENDPOINT, {
-          method: "POST",
-          headers: { "Content-Type": "application/json" },
-          body: JSON.stringify({
+        // v2.2.230: 送信は background.js が行う（② → つながらなければ ①）。キー名は ②・① と同じ
+        const response = await chrome.runtime.sendMessage({
+          type: "meta_scrape",
+          payload: {
             advertiser_name: finalAdvertiserName,
             advertiser_area: finalAdvertiserArea,
             advertiser_period: finalAdvertiserPeriod, // 💡 これで確実に日付が飛びます
@@ -154,12 +152,12 @@
             lp_url: lpUrl,
             base64_image: base64Image,
             scraped_date: scrapedDate,
-          }),
+          },
         });
 
-        const result = await response.json();
+        const result = response?.body ?? {};
 
-        if (response.ok) {
+        if (response?.ok) {
           if (result.status === "skipped") {
             btn.innerText = "⏭️ 保存済スキップ";
             btn.style.backgroundColor = "#9e9e9e";
```
