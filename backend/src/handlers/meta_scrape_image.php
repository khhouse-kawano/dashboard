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
