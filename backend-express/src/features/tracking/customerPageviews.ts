import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { UUID_PATTERN, parseLandingParams } from './params';

/**
 * 顧客1人の HP閲覧履歴（v2.2.204）。画面は information/CustomerPageviews.tsx（注文営業の顧客情報）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面からは顧客の id だけを受け取る。master_data.landing_params の khg_vid を ② で読み、
 *   tracking_pageviews の visitor_id と突き合わせる（⚠️ 画面から visitor_id を受け取らない。他人の履歴を引けないように）。
 * ⚠️ 注文（master_data）だけ。建売・中古の顧客の表には landing_params が無い（2026-10-21 の指示で対象外）。
 * ⚠️ khg_vid はサイト（ドメイン）ごとの ID。反響を送ったサイトの閲覧だけが出る。
 * ⚠️ 古い行は 6時間ごとの整理で消えるが、有効名簿の人は消さない（maintenance.ts）。
 * ─────────────────────────────────────────────
 */

interface CustomerRow extends RowDataPacket {
  landing_params: string | null;
}

interface PageviewRow extends RowDataPacket {
  id: number;
  visit_id: string;
  url: string;
  title: string | null;
  created_at: string;
  site_name: string | null;
}

const LIMIT = 500;

export const listCustomerPageviews = async (idValue: unknown): Promise<{ httpStatus: number; body: Record<string, unknown> }> => {
  const id = typeof idValue === 'string' ? idValue.trim().slice(0, 100) : '';
  if (id === '') return { httpStatus: 400, body: { status: 'error', message: '顧客が指定されていません。' } };

  const customers = await query<CustomerRow>('SELECT landing_params FROM master_data WHERE id = ? LIMIT 1', [id]);
  const visitorId = (parseLandingParams(customers[0]?.landing_params).khg_vid ?? '').toLowerCase();
  if (!UUID_PATTERN.test(visitorId)) {
    return { httpStatus: 200, body: { status: 'ok', linked: false, pageviews: [], limit: LIMIT } };
  }

  const rows = await query<PageviewRow>(
    `SELECT p.id, p.visit_id, p.url, p.title, DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, s.name AS site_name
       FROM tracking_pageviews p LEFT JOIN tracking_sites s ON s.id = p.site_id
      WHERE p.visitor_id = ?
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${LIMIT}`,
    [visitorId]
  );

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      linked: true,
      pageviews: rows.map((r) => ({
        id: Number(r.id),
        visitId: r.visit_id,
        url: r.url,
        title: r.title ?? '',
        createdAt: r.created_at,
        site: r.site_name ?? '',
      })),
      limit: LIMIT,
    },
  };
};
