import { createHash } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { TRACKING_KEYS, UUID_PATTERN, pickTrackingParams, sourceOf } from './params';

/**
 * 着地の受け付け（v2.2.199。`POST /api/track/touch`。⚠️ 公開・認証なし）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **社外の誰でも叩ける書き込み口。リクエストの値を信用しない。**
 *   ⚠️ 保存するのは、登録済み・有効なサイトの・許可したオリジンからの・UUID の訪問者の・対象キーがある着地だけ。
 * ⚠️ 応答は成功・失敗とも 204（publicRouter.ts）。⚠️ 理由はログにだけ出す（ブラウザは結果を使わない）。
 * ⚠️ IP は保存しない。⚠️ SHA-256（ソルト付き）だけ。ソルトは `.env` の TRACKING_IP_SALT（未設定なら ip_hash は NULL）。
 * ─────────────────────────────────────────────
 */

export interface TrackingSite {
  id: number;
  siteKey: string;
  origins: string[];
  active: boolean;
}

interface SiteRow extends RowDataPacket {
  id: number;
  site_key: string;
  allowed_origins: string | string[];
  is_active: number;
}

/** オリジンの表記をそろえる（⚠️ 末尾の / と大文字を落とす） */
export const normalizeOrigin = (value: string): string => value.trim().replace(/\/+$/, '').toLowerCase();

export const parseOrigins = (raw: unknown): string[] => {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = []; }
  }
  return Array.isArray(list) ? list.filter((o): o is string => typeof o === 'string').map(normalizeOrigin).filter((o) => o !== '') : [];
};

/**
 * サイトの設定。⚠️ 着地のたびに引くので、60秒だけ覚えておく（⚠️ 登録・更新したら sites.ts が消す）。
 * ⚠️ 無いキーも覚える（⚠️ でたらめなキーで DB を叩かせないため）。
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; site: TrackingSite | null }>();
/** 有効なサイトの許可オリジンの全体（isKnownOrigin 用） */
let originCache: { at: number; origins: Set<string> } | null = null;
export const clearTrackingSiteCache = (): void => {
  cache.clear();
  originCache = null;
};

export const findTrackingSite = async (siteKey: string): Promise<TrackingSite | null> => {
  if (!/^s_[A-Za-z0-9]{16}$/.test(siteKey)) return null;
  const hit = cache.get(siteKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.site;
  const rows = await query<SiteRow>('SELECT id, site_key, allowed_origins, is_active FROM tracking_sites WHERE site_key = ? LIMIT 1', [siteKey]);
  const row = rows[0];
  const site = row ? { id: Number(row.id), siteKey: row.site_key, origins: parseOrigins(row.allowed_origins), active: Number(row.is_active) === 1 } : null;
  if (cache.size > 1000) cache.clear();
  cache.set(siteKey, { at: Date.now(), site });
  return site;
};

/**
 * 有効なサイトのどれかに登録されたオリジンか（⚠️ CORS の応答ヘッダ用）。
 * ⚠️ プリフライト（OPTIONS）には本文が無く site_key が分からないため、サイトをまたいで見る。
 * ⚠️ 保存してよいかは recordTouch がサイトごとに改めて確かめる。
 */
export const isKnownOrigin = async (origin: string): Promise<boolean> => {
  if (origin === '') return false;
  if (originCache === null || Date.now() - originCache.at >= CACHE_MS) {
    const rows = await query<SiteRow>('SELECT id, site_key, allowed_origins, is_active FROM tracking_sites WHERE is_active = 1');
    originCache = { at: Date.now(), origins: new Set(rows.flatMap((r) => parseOrigins(r.allowed_origins))) };
  }
  return originCache.origins.has(normalizeOrigin(origin));
};

const hashIp = (ip: string): string | null =>
  env.trackingIpSalt === '' || ip === '' ? null : createHash('sha256').update(`${env.trackingIpSalt}:${ip}`).digest('hex');

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === '' ? null : trimmed;
};

export interface TouchInput {
  body: unknown;
  origin: string;
  ip: string;
  userAgent: string;
}

/** 保存したら true。⚠️ 保存しなかった理由はログに出す */
export const recordTouch = async ({ body, origin, ip, userAgent }: TouchInput): Promise<boolean> => {
  const reject = (reason: string): false => {
    logger.info(`track/touch: 保存しません（${reason}） origin="${origin}"`);
    return false;
  };
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return reject('本文が JSON ではない');
  const b = body as Record<string, unknown>;
  const siteKey = typeof b.site_key === 'string' ? b.site_key : '';
  const site = await findTrackingSite(siteKey);
  if (site === null) return reject(`サイトが無い site_key="${siteKey.slice(0, 40)}"`);
  if (!site.active) return reject(`無効のサイト site_id=${site.id}`);
  if (origin === '' || !site.origins.includes(normalizeOrigin(origin))) return reject(`許可していないオリジン site_id=${site.id}`);
  const visitorId = typeof b.visitor_id === 'string' ? b.visitor_id.toLowerCase() : '';
  if (!UUID_PATTERN.test(visitorId)) return reject('訪問者IDが UUID ではない');
  const params = pickTrackingParams(b.params);
  if (Object.keys(params).length === 0) return reject('対象のパラメータが無い');

  const keys = Object.keys(TRACKING_KEYS);
  const columns = ['site_id', 'visitor_id', 'source', ...keys, 'landing_url', 'referrer', 'user_agent', 'ip_hash'];
  const values = [
    site.id, visitorId, sourceOf(params), ...keys.map((k) => params[k] ?? null),
    text(b.landing_url, 2000), text(b.referrer, 2000), text(userAgent, 500), hashIp(ip),
  ];
  await execute(`INSERT INTO tracking_touches (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
  return true;
};
