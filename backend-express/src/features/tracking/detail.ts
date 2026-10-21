import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { isMetaConfigured } from '../metaAds/importer';
import { attributeConversions, DAYS, type Conversion } from './conversions';
import { AD_TOUCH_SQL } from './params';
import { canManageTracking, type TrackingResult } from './sites';

/**
 * アクセス解析の詳細（v2.2.203。request tracking_detail）。画面は header/TrackingDetail.tsx（サマリーの着地ページ・流入元を押すと開くモーダル）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 期間は直近30日（DAYS）。⚠️ 対象はサイト1つの、着地ページ1つ（axis=landing）か流入元1つ（axis=source）。
 * ⚠️ PV は tracking_touches の行数（30分以内のページの移動はまとめて1件。ページの閲覧回数そのものではない）。
 * ⚠️ CV の数え方は conversions.ts（問い合わせの日までの最後の訪問の着地ページ・流入元・広告に1件）。
 * ⚠️ CV の一覧は個人情報を出さない（日付・反響媒体・キャンペーン・店舗だけ。2026-10-21 の決定）。
 * ⚠️ Meta 広告の数字（表示回数・クリック・費用）は meta_ad_items / meta_ad_daily（features/metaAds/ が取り込む）。
 *   ⚠️ 広告ID は着地の utm_content（Meta の URL パラメータ {{ad.id}}）でつなぐ。
 *   ⚠️ 着地ページ：そのページに着地した広告だけ。⚠️ 流入元が Meta のとき：そのサイトのブランドで費用・表示のある広告も全部出す。
 * ⚠️ 着地ページのときは、ページの閲覧（tracking_pageviews。v2.2.203〜記録）から、本当の閲覧回数と前後のページも出す（loadPageFlow）。
 * ─────────────────────────────────────────────
 */

/** Meta 広告の流入元（utm_source の書き方の揺れ・fbclid だけのとき） */
const META_SOURCE_PATTERN = /^(meta|fb|ig|facebook|instagram|facebook\/instagram)$/i;
/** 1回に読む行の上限（⚠️ 画面が固まらないための安全装置） */
const ROW_LIMIT = 50_000;

interface TouchRow extends RowDataPacket {
  visitor_id: string;
  day: string;
  hour: number;
  landing_url: string | null;
  source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  user_agent: string | null;
  is_ad: number;
}

interface Bucket { key: string; visits: number; ad: number; cv: number }

/** ブラウザの情報から端末の種類 */
const deviceOf = (ua: string | null): string => {
  if (!ua) return '不明';
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'タブレット';
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'スマホ';
  return 'PC';
};

const bucketize = (keys: string[], adFlags: boolean[], cvKeys: string[], fold: boolean): Bucket[] => {
  const norm = (k: string): string => (fold ? k.toLowerCase() : k);
  const map = new Map<string, Bucket>();
  keys.forEach((k, i) => {
    const b = map.get(norm(k)) ?? { key: k, visits: 0, ad: 0, cv: 0 };
    b.visits += 1;
    if (adFlags[i]) b.ad += 1;
    map.set(norm(k), b);
  });
  for (const k of cvKeys) {
    const b = map.get(norm(k)) ?? { key: k, visits: 0, ad: 0, cv: 0 };
    b.cv += 1;
    map.set(norm(k), b);
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits || b.cv - a.cv);
};

interface MetaAdRow extends RowDataPacket {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  status: string;
  thumbnail_url: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
}

/** Meta 広告の数字（直近 DAYS 日）。⚠️ 表がまだ無い（① に SQL を流す前）なら null */
const loadMetaAds = async (adIds: string[], brand: string | null): Promise<MetaAdRow[] | null> => {
  const ids = adIds.filter((id) => /^\d+$/.test(id));
  if (ids.length === 0 && brand === null) return [];
  const where = [
    ...(ids.length > 0 ? [`i.ad_id IN (${ids.map(() => '?').join(', ')})`] : []),
    ...(brand !== null ? ['(i.brand = ? AND d.ad_id IS NOT NULL)'] : []),
  ].join(' OR ');
  try {
    return await query<MetaAdRow>(
      `SELECT i.ad_id, i.ad_name, i.campaign_name, i.adset_name, i.status, i.thumbnail_url,
              SUM(d.impressions) AS impressions, SUM(d.clicks) AS clicks, SUM(d.spend) AS spend
         FROM meta_ad_items i
         LEFT JOIN meta_ad_daily d ON d.ad_id = i.ad_id AND d.day >= CURDATE() - INTERVAL ${DAYS} DAY
        WHERE ${where}
        GROUP BY i.ad_id, i.ad_name, i.campaign_name, i.adset_name, i.status, i.thumbnail_url`,
      [...ids, ...(brand !== null ? [brand] : [])]
    );
  } catch {
    return null;
  }
};

interface FlowRow extends RowDataPacket {
  url: string | null;
  views: number;
}

/**
 * ページの前後（v2.2.203）。⚠️ 表がまだ無い（① に SQL を流す前）なら null。
 *   views：このページが見られた回数 ／ next：このページの次に見られたページ ／ prev：このページの前に見ていたページ（NULL＝訪問の最初のページ）
 */
const loadPageFlow = async (siteId: number, url: string): Promise<{ views: number; visitors: number; next: FlowRow[]; prev: FlowRow[] } | null> => {
  const since = `created_at >= NOW() - INTERVAL ${DAYS} DAY`;
  try {
    const [total, next, prev] = await Promise.all([
      query<RowDataPacket & { views: number; visitors: number }>(
        `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors FROM tracking_pageviews WHERE site_id = ? AND url = ? AND ${since}`, [siteId, url]),
      query<FlowRow>(
        `SELECT url, COUNT(*) AS views FROM tracking_pageviews WHERE site_id = ? AND prev_url = ? AND url <> prev_url AND ${since} GROUP BY url ORDER BY views DESC LIMIT 20`, [siteId, url]),
      query<FlowRow>(
        `SELECT prev_url AS url, COUNT(*) AS views FROM tracking_pageviews WHERE site_id = ? AND url = ? AND (prev_url IS NULL OR prev_url <> url) AND ${since} GROUP BY prev_url ORDER BY views DESC LIMIT 20`, [siteId, url]),
    ]);
    return { views: Number(total[0]?.views ?? 0), visitors: Number(total[0]?.visitors ?? 0), next, prev };
  } catch {
    return null;
  }
};

interface InquiryRow extends RowDataPacket {
  id: number;
  medium: string | null;
  response_medium: string | null;
  hp_campaign: string | null;
  shop: string | null;
}

export const trackingDetail = async (
  staff: AuthenticatedStaff | null,
  input: { siteId: unknown; axis: unknown; key: unknown }
): Promise<TrackingResult> => {
  const fail = (httpStatus: number, message: string): TrackingResult => ({ httpStatus, body: { status: 'error', message } });
  if (!canManageTracking(staff)) return fail(403, 'この画面は管理者だけが使えます。');
  const siteId = Number(input.siteId);
  if (!Number.isInteger(siteId) || siteId <= 0) return fail(400, 'サイトが指定されていません。');
  const axis = input.axis === 'source' ? 'source' : input.axis === 'landing' ? 'landing' : null;
  if (axis === null) return fail(400, '着地ページか流入元を指定してください。');
  const key = typeof input.key === 'string' ? input.key.slice(0, 2000) : '';

  const sites = await query<RowDataPacket & { brand: string | null }>('SELECT brand FROM tracking_sites WHERE id = ? LIMIT 1', [siteId]);
  if (sites.length === 0) return fail(404, 'サイトが見つかりません。一覧を開き直してください。');

  const column = axis === 'landing' ? 'landing_url' : 'source';
  // ⚠️ 流入元は大文字・小文字を区別しない（照合順序が _ci なので = でよい）。⚠️ 空は NULL も含める
  const filter = key === '' ? `(t.${column} IS NULL OR t.${column} = '')` : `t.${column} = ?`;
  const rows = await query<TouchRow>(
    `SELECT t.visitor_id, DATE_FORMAT(t.created_at, '%Y-%m-%d') AS day, HOUR(t.created_at) AS hour,
            t.landing_url, t.source, t.utm_campaign, t.utm_content, t.user_agent, ${AD_TOUCH_SQL} AS is_ad
       FROM tracking_touches t
      WHERE t.site_id = ? AND t.created_at >= NOW() - INTERVAL ${DAYS} DAY AND ${filter}
      ORDER BY t.created_at
      LIMIT ${ROW_LIMIT}`,
    key === '' ? [siteId] : [siteId, key]
  );

  const match = (c: Conversion): boolean => {
    const value = axis === 'landing' ? c.landingUrl : c.source;
    return axis === 'landing' ? value === key : value.toLowerCase() === key.toLowerCase();
  };
  const cv = ((await attributeConversions(siteId)).get(siteId) ?? []).filter(match);

  // 上の数字
  const perVisitor = new Map<string, number>();
  for (const r of rows) perVisitor.set(r.visitor_id, (perVisitor.get(r.visitor_id) ?? 0) + 1);
  const adFlags = rows.map((r) => Number(r.is_ad) === 1);

  // 日別（⚠️ 来訪の無い日も 0 で並べる。日本時間）
  const daily: { day: string; visits: number; cv: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) daily.push({ day: new Date(Date.now() + 9 * 3600_000 - i * 86_400_000).toISOString().slice(0, 10), visits: 0, cv: 0 });
  const dayIndex = new Map(daily.map((d, i) => [d.day, i]));
  for (const r of rows) { const i = dayIndex.get(r.day); if (i !== undefined) daily[i].visits += 1; }
  for (const c of cv) { const i = dayIndex.get(c.inquiryDay); if (i !== undefined) daily[i].cv += 1; }

  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, visits: 0 }));
  for (const r of rows) hours[Number(r.hour)].visits += 1;

  const breakdown = axis === 'landing'
    ? bucketize(rows.map((r) => r.source ?? ''), adFlags, cv.map((c) => c.source), true)
    : bucketize(rows.map((r) => r.landing_url ?? ''), adFlags, cv.map((c) => c.landingUrl), false);
  const devices = bucketize(rows.map((r) => deviceOf(r.user_agent)), adFlags, [], false);

  // 広告別（utm_content。⚠️ キャンペーン名は一番多く出た utm_campaign）
  const adMap = new Map<string, { adId: string; campaign: string; visits: number; cv: number; campaigns: Map<string, number> }>();
  for (const r of rows) {
    const id = r.utm_content ?? '';
    if (id === '') continue;
    const a = adMap.get(id) ?? { adId: id, campaign: '', visits: 0, cv: 0, campaigns: new Map<string, number>() };
    a.visits += 1;
    const c = r.utm_campaign ?? '';
    a.campaigns.set(c, (a.campaigns.get(c) ?? 0) + 1);
    adMap.set(id, a);
  }
  for (const c of cv) {
    if (c.adId === '') continue;
    const a = adMap.get(c.adId) ?? { adId: c.adId, campaign: c.campaign, visits: 0, cv: 0, campaigns: new Map<string, number>() };
    a.cv += 1;
    adMap.set(c.adId, a);
  }
  for (const a of adMap.values()) a.campaign = [...a.campaigns.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? a.campaign;

  // Meta 広告の数字
  const isMetaSource = axis === 'source' && META_SOURCE_PATTERN.test(key);
  const brand = sites[0].brand;
  const metaRows = await loadMetaAds([...adMap.keys()], isMetaSource && brand ? brand : null);
  const metaById = new Map((metaRows ?? []).map((m) => [m.ad_id, m]));
  const ads = [...new Set([...adMap.keys(), ...metaById.keys()])].map((id) => {
    const a = adMap.get(id);
    const m = metaById.get(id);
    return {
      adId: id,
      name: m?.ad_name ?? '',
      campaign: m?.campaign_name || a?.campaign || '',
      adset: m?.adset_name ?? '',
      status: m?.status ?? '',
      thumbnail: m?.thumbnail_url ?? '',
      meta: m !== undefined,
      impressions: Number(m?.impressions ?? 0),
      clicks: Number(m?.clicks ?? 0),
      spend: Number(m?.spend ?? 0),
      landings: a?.visits ?? 0,
      cv: a?.cv ?? 0,
    };
  }).sort((x, y) => y.spend - x.spend || y.landings - x.landings);

  const flow = axis === 'landing' && key !== '' ? await loadPageFlow(siteId, key) : null;

  // CV の一覧（⚠️ 個人情報は出さない）
  const inquiries = cv.length === 0 ? [] : await query<InquiryRow>(
    `SELECT id, medium, response_medium, hp_campaign, shop FROM inquiry_customer WHERE id IN (${cv.map(() => '?').join(', ')})`,
    cv.map((c) => c.inquiryId)
  );
  const inquiryById = new Map(inquiries.map((r) => [Number(r.id), r]));
  const cvList = cv.map((c) => {
    const r = inquiryById.get(c.inquiryId);
    return {
      day: c.inquiryDay,
      medium: r?.response_medium || r?.medium || '',
      campaign: r?.hp_campaign ?? '',
      shop: r?.shop ?? '',
      source: c.source,
      landingUrl: c.landingUrl,
      adId: c.adId,
    };
  }).sort((x, y) => y.day.localeCompare(x.day));

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      siteId,
      axis,
      key,
      days: DAYS,
      truncated: rows.length >= ROW_LIMIT,
      kpi: {
        visits: rows.length,
        ad: adFlags.filter(Boolean).length,
        visitors: perVisitor.size,
        repeaters: [...perVisitor.values()].filter((n) => n >= 2).length,
        cv: cv.length,
      },
      daily,
      hours,
      breakdown,
      devices,
      ads,
      cvList,
      pageFlow: flow === null ? null : {
        views: flow.views,
        visitors: flow.visitors,
        next: flow.next.map((r) => ({ url: r.url ?? '', views: Number(r.views) })),
        prev: flow.prev.map((r) => ({ url: r.url ?? '', views: Number(r.views) })),
      },
      meta: {
        configured: isMetaConfigured(),
        ready: metaRows !== null,
        isMetaSource,
      },
    },
  };
};
