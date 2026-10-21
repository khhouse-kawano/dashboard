import { execute } from '../../db/pool';
import { logger } from '../../utils/logger';
import { BOT_UA_PATTERN, UUID_PATTERN } from './params';
import { findTrackingSite, normalizeOrigin } from './touch';

/**
 * ページの閲覧の受け付け（v2.2.203。`POST /api/track/pv`。⚠️ 公開・認証なし）。tracker.js がページを開くたびに送る。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **社外の誰でも叩ける書き込み口。リクエストの値を信用しない。**（touch.ts と同じ考え方）
 *   ⚠️ 保存するのは、登録済み・有効なサイトの・許可したオリジンからの・UUID の顧客ID と訪問ID の、
 *     そのオリジンのページ（url）だけ。⚠️ ロボットは保存しない。
 * ⚠️ url・prev_url は ? と # 以降を落とす（個人を特定できる値がパラメータに入ることがあるため）。
 *   ⚠️ prev_url は同じオリジンのときだけ（別のサイトから来たときは NULL）。
 * ⚠️ 応答は成功・失敗とも 204（publicRouter.ts）。⚠️ 理由はログにだけ出す。
 * ⚠️ 行数の整理は maintenance.ts（CV・有効名簿の人は消さない）。
 * ─────────────────────────────────────────────
 */

/** 同じオリジンの URL なら `origin + pathname`、違えば null */
const sameOriginPath = (value: unknown, origin: string): string | null => {
  if (typeof value !== 'string' || value === '') return null;
  try {
    const u = new URL(value);
    if (normalizeOrigin(u.origin) !== origin) return null;
    return `${u.origin}${u.pathname}`.slice(0, 2000);
  } catch {
    return null;
  }
};

export interface PageviewInput {
  body: unknown;
  origin: string;
  userAgent: string;
}

/** 保存したら true。⚠️ 保存しなかった理由はログに出す */
export const recordPageview = async ({ body, origin, userAgent }: PageviewInput): Promise<boolean> => {
  const reject = (reason: string): false => {
    logger.info(`track/pv: 保存しません（${reason}） origin="${origin}"`);
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
  const visitorId = typeof b.visitor_id === 'string' ? b.visitor_id.toLowerCase() : '';
  const visitId = typeof b.visit_id === 'string' ? b.visit_id.toLowerCase() : '';
  if (!UUID_PATTERN.test(visitorId) || !UUID_PATTERN.test(visitId)) return reject('顧客ID・訪問ID が UUID ではない');
  const url = sameOriginPath(b.url, normalized);
  if (url === null) return reject('ページの URL がサイトのものではない');
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 255) : '';

  await execute(
    'INSERT INTO tracking_pageviews (site_id, visitor_id, visit_id, url, title, prev_url) VALUES (?, ?, ?, ?, ?, ?)',
    [site.id, visitorId, visitId, url, title === '' ? null : title, sameOriginPath(b.prev, normalized)]
  );
  return true;
};
