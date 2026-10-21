import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { BOT_UA_PATTERN, TRACKING_KEYS, UUID_PATTERN, parseLandingParams } from './params';
import { findTrackingSite, normalizeOrigin } from './touch';

/**
 * 自社のフォームでないサイトの CV の受け付け（v2.2.205。`POST /api/track/cv`。⚠️ 公開・認証なし）。public/cv.js が送る。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **社外の誰でも叩ける書き込み口。リクエストの値を信用しない。**（pageview.ts と同じ考え方）
 *   ⚠️ 保存するのは、登録済み・有効で CV を扱うブランドのサイトの・許可したオリジンからの・UUID の顧客ID の、
 *     64桁の16進（SHA-256）のメール・電話のハッシュだけ。⚠️ ロボットは保存しない。
 * ⚠️ メールアドレス・電話番号そのものは受け取らない（cv.js がブラウザでハッシュにする）。
 * ⚠️ 同じ人が「確認画面へ」を何度押しても1行（サイト・顧客ID・ハッシュの組で上書き）。
 * ⚠️ landing_params は対象のキー（params.ts の TRACKING_KEYS）と khg_vid だけを残す。⚠️ khg_vid は送ってきた顧客ID に置き換える。
 * ⚠️ 反響との突き合わせは cvMatch.ts（5分ごと）。⚠️ 応答は成功・失敗とも 204（publicRouter.ts）。
 * ─────────────────────────────────────────────
 */

/**
 * CV を扱うブランド → 突き合わせる反響の表と、反響を取り込んだ先の顧客の表。⚠️ ここに無いブランドのサイトからの送信は保存しない
 * ⚠️ 表の名前は SQL に直接入れる（⚠️ 外からの値を入れないこと）
 */
export const CV_TARGETS: Record<string, { inquiry: string; master: string }> = {
  khf: { inquiry: 'inquiry_customer_kaeru', master: 'master_data_kaeru' },
};

const HASH_PATTERN = /^[0-9a-f]{64}$/;

const hashOf = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return '';
  return typeof value === 'string' && HASH_PATTERN.test(value) ? value : null;
};

/** 対象のキーと khg_vid だけの landing_params（⚠️ 空なら khg_vid だけ） */
const cleanLandingParams = (value: unknown, visitorId: string): string => {
  const raw = parseLandingParams(typeof value === 'string' ? value.slice(0, 4000) : '');
  const kept = new URLSearchParams();
  for (const [key, max] of Object.entries(TRACKING_KEYS)) {
    const v = (raw[key] ?? '').trim();
    if (v !== '') kept.set(key, v.slice(0, max));
  }
  kept.set('khg_vid', visitorId);
  return kept.toString().slice(0, 2000);
};

interface BrandRow extends RowDataPacket {
  brand: string | null;
}

export interface ConversionInput {
  body: unknown;
  origin: string;
  userAgent: string;
}

/** 保存したら true。⚠️ 保存しなかった理由はログに出す */
export const recordConversion = async ({ body, origin, userAgent }: ConversionInput): Promise<boolean> => {
  const reject = (reason: string): false => {
    logger.info(`track/cv: 保存しません（${reason}） origin="${origin}"`);
    return false;
  };
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return reject('本文が JSON ではない');
  if (BOT_UA_PATTERN.test(userAgent)) return reject('ロボットのアクセス');
  const b = body as Record<string, unknown>;
  const siteKey = typeof b.site_key === 'string' ? b.site_key : '';
  const site = await findTrackingSite(siteKey);
  if (site === null) return reject(`サイトが無い site_key="${siteKey.slice(0, 40)}"`);
  if (!site.active) return reject(`無効のサイト site_id=${site.id}`);
  const normalized = normalizeOrigin(origin);
  if (normalized === '' || !site.origins.includes(normalized)) return reject(`許可していないオリジン site_id=${site.id}`);
  const brand = (await query<BrandRow>('SELECT brand FROM tracking_sites WHERE id = ? LIMIT 1', [site.id]))[0]?.brand ?? '';
  if (CV_TARGETS[brand] === undefined) return reject(`CV を扱わないブランド site_id=${site.id} brand="${brand}"`);
  const visitorId = typeof b.visitor_id === 'string' ? b.visitor_id.toLowerCase() : '';
  if (!UUID_PATTERN.test(visitorId)) return reject('顧客ID が UUID ではない');
  const emailHash = hashOf(b.email_hash);
  const telHash = hashOf(b.tel_hash);
  if (emailHash === null || telHash === null) return reject('ハッシュの形が違う');
  if (emailHash === '' && telHash === '') return reject('メールも電話も無い');
  const form = typeof b.form === 'string' ? b.form.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50) : '';
  let pageUrl: string | null = null;
  try {
    const u = new URL(typeof b.url === 'string' ? b.url : '');
    if (normalizeOrigin(u.origin) === normalized) pageUrl = `${u.origin}${u.pathname}`.slice(0, 2000);
  } catch {
    pageUrl = null;
  }

  // ⚠️ 結びついたあとに同じ組が来たら、日時だけ進めない（結びつけた記録を残す）
  await execute(
    `INSERT INTO tracking_conversions (site_id, visitor_id, form, email_hash, tel_hash, landing_params, page_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       form = IF(matched_at IS NULL, VALUES(form), form),
       landing_params = IF(matched_at IS NULL, VALUES(landing_params), landing_params),
       page_url = IF(matched_at IS NULL, VALUES(page_url), page_url),
       created_at = IF(matched_at IS NULL, CURRENT_TIMESTAMP, created_at)`,
    [site.id, visitorId, form, emailHash, telHash, cleanLandingParams(b.landing_params, visitorId), pageUrl]
  );
  return true;
};
