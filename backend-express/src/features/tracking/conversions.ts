import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { UUID_PATTERN } from './params';

/**
 * 反響（CV）と訪問の突き合わせ（v2.2.202）。一覧の「直近30日のCV」（sites.ts）とサマリー（summary.ts）で使う。
 *
 * ─────────────────────────────────────────────
 * ⚠️ CV ＝ 直近30日の反響（削除を除く）のうち、landing_params の khg_vid が、問い合わせの日までにそのサイトを訪問していたもの。
 *   ⚠️ 1件の反響が複数のサイトを訪問していれば、それぞれのサイトで1件（サイトごとに見る数字のため）。
 *   ⚠️ どの訪問の手柄にするかは、問い合わせの日までの「そのサイトへの最後の訪問」（ラストクリック）。
 * ⚠️ 反響の日付（inquiry_date）は 'YYYY/MM/DD' の文字列で時刻が無い。⚠️ その日の 23:59:59 までの訪問を「問い合わせ前」とみなす。
 * ─────────────────────────────────────────────
 */

export const DAYS = 30;
/** visitor_id を IN で渡す件数（⚠️ プレースホルダーが増えすぎないよう分ける） */
const CHUNK = 500;

interface InquiryRow extends RowDataPacket {
  id: number;
  inquiry_day: string | null;
  vid: string;
}

interface TouchRow extends RowDataPacket {
  site_id: number;
  visitor_id: string;
  created_at: string;
  landing_url: string | null;
  source: string | null;
}

export interface Conversion {
  inquiryId: number;
  landingUrl: string;
  source: string;
}

/** サイトID → そのサイトの CV（反響1件につき、最後の訪問1つ） */
export const attributeConversions = async (siteId?: number): Promise<Map<number, Conversion[]>> => {
  const result = new Map<number, Conversion[]>();
  const inquiries = (await query<InquiryRow>(
    `SELECT id, DATE_FORMAT(STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d'), '%Y-%m-%d') AS inquiry_day,
            LOWER(SUBSTRING(landing_params, LOCATE('khg_vid=', landing_params) + 8, 36)) AS vid
       FROM inquiry_customer
      WHERE landing_params LIKE '%khg_vid=%'
        AND delete_flag = 0
        AND STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d') >= CURDATE() - INTERVAL ${DAYS} DAY`
  )).filter((r) => r.inquiry_day !== null && UUID_PATTERN.test(r.vid));
  if (inquiries.length === 0) return result;

  const vids = [...new Set(inquiries.map((r) => r.vid))];
  const touchesByVisitor = new Map<string, TouchRow[]>();
  for (let i = 0; i < vids.length; i += CHUNK) {
    const part = vids.slice(i, i + CHUNK);
    const rows = await query<TouchRow>(
      `SELECT t.site_id, t.visitor_id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, t.landing_url, t.source
         FROM tracking_touches t
        WHERE t.visitor_id IN (${part.map(() => '?').join(', ')})${siteId === undefined ? '' : ' AND t.site_id = ?'}
        ORDER BY t.created_at, t.id`,
      siteId === undefined ? part : [...part, siteId]
    );
    for (const row of rows) {
      const list = touchesByVisitor.get(row.visitor_id) ?? [];
      list.push(row);
      touchesByVisitor.set(row.visitor_id, list);
    }
  }

  for (const inquiry of inquiries) {
    const limit = `${inquiry.inquiry_day} 23:59:59`;
    // ⚠️ サイトごとに、問い合わせの日までの最後の訪問（⚠️ touches は古い順）
    const lastBySite = new Map<number, TouchRow>();
    for (const touch of touchesByVisitor.get(inquiry.vid) ?? []) {
      if (touch.created_at <= limit) lastBySite.set(Number(touch.site_id), touch);
    }
    for (const [site, touch] of lastBySite) {
      const list = result.get(site) ?? [];
      list.push({ inquiryId: Number(inquiry.id), landingUrl: touch.landing_url ?? '', source: touch.source ?? '' });
      result.set(site, list);
    }
  }
  return result;
};
