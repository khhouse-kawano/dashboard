/**
 * 広告の業者（v2.2.232。v2.2.238 で判定を変更）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面は header/TrackingSettings.tsx（流入元タブの「業者別」）と header/TrackingVendorFunnel.tsx（歩留まり）。
 * ⚠️⚠️ v2.2.238（2026-11-02 の指示）:
 *   ⚠️ 対象は Google リスティング広告の訪問だけ（utm_source が google、utm_medium が cpc で始まる。cpc_pt1 なども含む）。
 *     ⚠️ Google ディスプレイ・Yahoo・Meta などは業者別に入れない。⚠️ クリックID（gclid）だけで utm の無い訪問も外す（検索かディスプレイか分からないため）。
 *   ⚠️ 対象は _pt が付き始めた 2026-10-22 以降の訪問だけ（VENDOR_START）。
 *   ⚠️ utm_campaign か utm_medium のどこかに _pt2 があれば Bander。それ以外（_pt1 を含む・どちらも含まない）は PURE GROWTH。
 *     ⚠️ _pt は utm_medium（cpc_pt1）に付いていることもある。⚠️ 末尾でなく「含む」で見る。⚠️ 大文字・小文字は区別しない。
 * ⚠️ 業者を足すときは、TRACKING_VENDORS と VENDOR_CASE_SQL・vendorOf の判定をそろえて直す。
 * ─────────────────────────────────────────────
 */

export interface TrackingVendor {
  /** 画面とのやり取りに使うキー */
  key: string;
  /** 画面に出す判定の説明 */
  rule: string;
  name: string;
}

export const TRACKING_VENDORS: readonly TrackingVendor[] = [
  { key: 'pt1', rule: '_pt1 を含む、または _pt1・_pt2 のどちらも含まない', name: 'PURE GROWTH' },
  { key: 'pt2', rule: '_pt2 を含む', name: 'Bander' },
];

/** 業者別の対象を始める日時（⚠️ _pt が付き始めた日。2026-11-02 の指示） */
export const VENDOR_START = '2026-10-22 00:00:00';

export const findVendor = (key: unknown): TrackingVendor | undefined => TRACKING_VENDORS.find((v) => v.key === key);

/** tracking_touches（別名 t）の行が業者別の対象（2026-10-22 以降の Google リスティング広告）か（SQL） */
export const GOOGLE_LISTING_SQL = `(LOWER(TRIM(t.utm_source)) = 'google' AND LOWER(TRIM(t.utm_medium)) LIKE 'cpc%' AND t.created_at >= '${VENDOR_START}')`;

/** tracking_touches（別名 t）の行 → 業者のキー（SQL）。⚠️ GOOGLE_LISTING_SQL で絞った行に使う。⚠️ `_` は LIKE の1文字なので逃がす */
export const VENDOR_CASE_SQL = `CASE WHEN LOWER(CONCAT(COALESCE(t.utm_campaign, ''), ' ', COALESCE(t.utm_medium, ''))) LIKE '%\\_pt2%' THEN 'pt2' ELSE 'pt1' END`;

/** 訪問1件が業者別の対象か（GOOGLE_LISTING_SQL と同じ判定）。touchedAt は 'YYYY-MM-DD HH:MM:SS' */
export const isGoogleListing = (utmSource: string | null | undefined, utmMedium: string | null | undefined, touchedAt: string): boolean =>
  String(utmSource ?? '').trim().toLowerCase() === 'google'
  && String(utmMedium ?? '').trim().toLowerCase().startsWith('cpc')
  && touchedAt >= VENDOR_START;

/** 訪問1件 → 業者のキー（VENDOR_CASE_SQL と同じ判定） */
export const vendorOf = (utmCampaign: string | null | undefined, utmMedium: string | null | undefined): string =>
  `${String(utmCampaign ?? '')} ${String(utmMedium ?? '')}`.toLowerCase().includes('_pt2') ? 'pt2' : 'pt1';
