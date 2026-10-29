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
