/**
 * 広告の業者（v2.2.232）。⚠️ utm_campaign の末尾で見分ける（例: `xxx_pt1` は PURE GROWTH）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面は header/TrackingSettings.tsx（流入元タブの「業者別」）と header/TrackingVendorFunnel.tsx（歩留まり）。
 * ⚠️ 末尾の大文字・小文字は区別しない（⚠️ SQL の LIKE も区別しないので、JS もそろえる）。
 * ⚠️ 業者を足すときは、この配列に1行足す（SQL も画面もここから作る）。
 * ─────────────────────────────────────────────
 */

export interface TrackingVendor {
  /** 画面とのやり取りに使うキー */
  key: string;
  /** utm_campaign の末尾 */
  suffix: string;
  name: string;
}

export const TRACKING_VENDORS: readonly TrackingVendor[] = [
  { key: 'pt1', suffix: '_pt1', name: 'PURE GROWTH' },
  { key: 'pt2', suffix: '_pt2', name: 'Bander' },
];

/** どの業者にも当たらない分のキー（⚠️ 画面には出さない。業者別の割合の分母に入れない） */
export const OTHER_VENDOR_KEY = '';

export const findVendor = (key: unknown): TrackingVendor | undefined => TRACKING_VENDORS.find((v) => v.key === key);

/** utm_campaign → 業者のキー（当たらなければ OTHER_VENDOR_KEY） */
export const vendorOf = (campaign: string | null | undefined): string => {
  const value = String(campaign ?? '').trim().toLowerCase();
  return TRACKING_VENDORS.find((v) => value.endsWith(v.suffix))?.key ?? OTHER_VENDOR_KEY;
};

/** LIKE の値（⚠️ `_` は LIKE の1文字なので逃がす） */
export const vendorLike = (vendor: TrackingVendor): string => `%${vendor.suffix.replace(/_/g, '\\_')}`;

/** tracking_touches（別名 t）の行 → 業者のキー（SQL）。⚠️ 値は TRACKING_VENDORS の定数だけ */
export const VENDOR_CASE_SQL = `CASE ${TRACKING_VENDORS.map((v) => `WHEN TRIM(t.utm_campaign) LIKE '${vendorLike(v)}' THEN '${v.key}'`).join(' ')} ELSE '${OTHER_VENDOR_KEY}' END`;
