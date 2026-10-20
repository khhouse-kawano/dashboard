import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { AD_TOUCH_SQL, CLICK_ID_KEYS, TRACKING_KEYS, UUID_PATTERN, parseLandingParams, sourceOf } from './params';

/**
 * 反響に結びつく着地の履歴（v2.2.199）。画面は list/TrackingTouches.tsx（反響一覧（注文）の「流入」）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 反響の inquiry_customer.landing_params（フォームが送った値）を読んで、次の順で tracking_touches を探す。
 *   1. khg_vid があれば、visitor_id が一致する行（⚠️ 同じブラウザの着地をすべて）
 *   2. 無ければ gclid / gbraid / wbraid / fbclid / yclid のどれかが一致する行
 *     ⚠️ タグを貼る前の反響など、khg_vid が無いとき用（⚠️ tracker.js が landing_params に khg_vid を付け直し続けるので、タグのあるページからの反響には付く）
 * ⚠️ url_params（送信したページの ? 以降）は見ない。⚠️ tracker.js は URL を書き換えないので khg_vid は入らない。
 * ⚠️ 広告の着地だけを返す（v2.2.201〜 広告以外の訪問も記録しているが、画面の見出しが「広告からの着地」のため）。
 * ⚠️ landing_params が空・見つからなければ、空の配列（⚠️ エラーにしない）。
 * ⚠️ 流入元（source）・キャンペーンは反響に保存されていないので、landing_params から読み取って返す（2026-10-20 の指示）。
 * ─────────────────────────────────────────────
 */

interface InquiryRow extends RowDataPacket {
  landing_params: string | null;
}

interface TouchRow extends RowDataPacket {
  id: number;
  created_at: string;
  site_name: string | null;
  source: string | null;
  landing_url: string | null;
  referrer: string | null;
  [key: string]: unknown;
}

const LIMIT = 100;

export const listInquiryTouches = async (inquiryIdValue: unknown): Promise<{ httpStatus: number; body: Record<string, unknown> }> => {
  const inquiryId = typeof inquiryIdValue === 'string' ? inquiryIdValue.trim().slice(0, 100) : '';
  if (inquiryId === '') return { httpStatus: 400, body: { status: 'error', message: '反響が指定されていません。' } };

  const inquiries = await query<InquiryRow>('SELECT landing_params FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1', [inquiryId]);
  const landingText = inquiries[0]?.landing_params ?? '';
  const landing = parseLandingParams(landingText);
  // ⚠️ 画面に出すのは対象のキー（と khg_vid）だけ
  const shown: Record<string, string> = {};
  for (const key of Object.keys(TRACKING_KEYS)) if (landing[key]) shown[key] = landing[key];

  let matchedBy: 'khg_vid' | 'click_id' | null = null;
  let where = '';
  let params: string[] = [];
  const visitorId = (landing.khg_vid ?? '').toLowerCase();
  const clickIds = CLICK_ID_KEYS.filter((k) => landing[k]);
  if (UUID_PATTERN.test(visitorId)) {
    matchedBy = 'khg_vid';
    where = 't.visitor_id = ?';
    params = [visitorId];
  } else if (clickIds.length > 0) {
    matchedBy = 'click_id';
    where = clickIds.map((k) => `t.${k} = ?`).join(' OR ');
    params = clickIds.map((k) => landing[k]);
  }

  let touches: Record<string, unknown>[] = [];
  if (matchedBy !== null) {
    const rows = await query<TouchRow>(
      `SELECT t.id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, s.name AS site_name, t.source,
              ${Object.keys(TRACKING_KEYS).map((k) => `t.${k}`).join(', ')}, t.landing_url, t.referrer
         FROM tracking_touches t LEFT JOIN tracking_sites s ON s.id = t.site_id
        WHERE (${where}) AND ${AD_TOUCH_SQL}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ${LIMIT}`,
      params
    );
    touches = rows.map((r) => {
      const p: Record<string, string> = {};
      for (const key of Object.keys(TRACKING_KEYS)) if (typeof r[key] === 'string' && r[key] !== '') p[key] = r[key] as string;
      return { id: Number(r.id), createdAt: r.created_at, site: r.site_name ?? '', source: r.source ?? '', params: p, landingUrl: r.landing_url ?? '', referrer: r.referrer ?? '' };
    });
  }

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      found: inquiries.length > 0,
      landingParams: landingText,
      landing: shown,
      visitorId: matchedBy === 'khg_vid' ? visitorId : '',
      source: sourceOf(shown) ?? '',
      campaign: shown.utm_campaign ?? '',
      matchedBy,
      touches,
      limit: LIMIT,
    },
  };
};
