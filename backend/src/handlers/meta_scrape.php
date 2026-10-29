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
