import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { attributeConversions, DAYS } from './conversions';
import { AD_TOUCH_SQL } from './params';
import { canManageTracking, type TrackingResult } from './sites';
import { TRACKING_VENDORS, VENDOR_CASE_SQL, vendorOf } from './vendors';

/**
 * トラッキング設定のサマリーと CV（v2.2.202）。画面は header/TrackingSettings.tsx（サイト名を押すと開く）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 期間は直近30日（訪問は created_at、反響は inquiry_date）。
 * ⚠️ 訪問数は広告・広告以外の両方（tracking_touches の行数）。⚠️ 一覧の「直近30日の着地」は広告の分だけ（sites.ts）。
 * ⚠️ CV の数え方は conversions.ts。着地ページ別・流入元別は、その CV の「最後の訪問」の着地ページ・流入元に1件を付ける。
 *   ⚠️ その訪問が30日より前なら、訪問数 0 の行として出る。
 * ⚠️ v2.2.232 業者別（vendors。utm_campaign の末尾 _pt1・_pt2。vendors.ts）。⚠️ CV も「最後の訪問」の utm_campaign で分ける。
 *   ⚠️ 業者に当たらない分は返さない（画面の割合の分母は業者の付いた分だけ）。
 * ─────────────────────────────────────────────
 */

interface GroupRow extends RowDataPacket {
  k: string | null;
  visits: number;
  ad: number;
}

export interface SummaryRow {
  key: string;
  visits: number;
  ad: number;
  cv: number;
}

/** 訪問の集計に CV を足す。⚠️ 流入元は大文字・小文字を区別しない（DB の GROUP BY と同じ。google と Google を1行に） */
const mergeRows = (rows: GroupRow[], cvKeys: string[], fold: boolean): SummaryRow[] => {
  const norm = (k: string): string => (fold ? k.toLowerCase() : k);
  const map = new Map<string, SummaryRow>();
  for (const r of rows) map.set(norm(r.k ?? ''), { key: r.k ?? '', visits: Number(r.visits), ad: Number(r.ad), cv: 0 });
  for (const k of cvKeys) {
    const row = map.get(norm(k)) ?? { key: k, visits: 0, ad: 0, cv: 0 };
    row.cv += 1;
    map.set(norm(k), row);
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits || b.cv - a.cv);
};

/** サイト1つのサマリー（着地ページ別・流入元別）。⚠️ 画面でサイトを開いたときだけ呼ぶ */
export const trackingSiteSummary = async (staff: AuthenticatedStaff | null, siteIdValue: unknown): Promise<TrackingResult> => {
  if (!canManageTracking(staff)) return { httpStatus: 403, body: { status: 'error', message: 'この画面は管理者だけが使えます。' } };
  const siteId = Number(siteIdValue);
  if (!Number.isInteger(siteId) || siteId <= 0) return { httpStatus: 400, body: { status: 'error', message: 'サイトが指定されていません。' } };

  /** ⚠️ expr は SQL に直接入る（列名か、VENDOR_CASE_SQL などの定数だけ） */
  const group = (expr: string): Promise<GroupRow[]> => query<GroupRow>(
    `SELECT ${expr} AS k, COUNT(*) AS visits, SUM(${AD_TOUCH_SQL}) AS ad
       FROM tracking_touches t
      WHERE t.site_id = ? AND t.created_at >= NOW() - INTERVAL ${DAYS} DAY
      GROUP BY k`,
    [siteId]
  );
  const [landingRows, sourceRows, vendorRows, conversions] = await Promise.all([
    group('t.landing_url'), group('t.source'), group(VENDOR_CASE_SQL), attributeConversions(siteId),
  ]);
  const cv = conversions.get(siteId) ?? [];
  const landing = mergeRows(landingRows, cv.map((c) => c.landingUrl), false);
  const source = mergeRows(sourceRows, cv.map((c) => c.source), true);
  // v2.2.232 業者別。⚠️ 業者が0件でも行を出す（帯グラフの凡例をそろえる）
  // ⚠️ どの業者にも当たらない分は返さない（割合の分母は _pt1・_pt2 の付いた分だけ。2026-10-30 の指示）
  const byVendor = new Map(mergeRows(vendorRows, cv.map((c) => vendorOf(c.campaign)), false).map((r) => [r.key, r]));
  const vendors = TRACKING_VENDORS.map((v) => {
    const row = byVendor.get(v.key);
    return { key: v.key, suffix: v.suffix, name: v.name, visits: row?.visits ?? 0, cv: row?.cv ?? 0 };
  });

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      siteId,
      days: DAYS,
      kpi: {
        visits: landing.reduce((s, r) => s + r.visits, 0),
        ad: landing.reduce((s, r) => s + r.ad, 0),
        cv: cv.length,
      },
      landing,
      source,
      vendors,
    },
  };
};
