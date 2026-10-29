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
