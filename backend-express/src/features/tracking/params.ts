/**
 * 広告流入トラッキング（v2.2.199）の対象パラメータ。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **public/tracker.js と同じ並び・同じ長さにすること。** 片方だけ直すと、
 *   ⚠️ ブラウザが landing_params に書いたキーを ② が捨てる（または逆）。
 * ⚠️ source の決め方はフォーム（form_get の Form.tsx の sourceMap）と同じ順。
 * ─────────────────────────────────────────────
 */

export const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'yclid'] as const;

/** キー → 保存する最大の長さ（⚠️ 表の列の長さ） */
export const TRACKING_KEYS: Record<string, number> = {
  gclid: 500,
  gbraid: 500,
  wbraid: 500,
  fbclid: 500,
  yclid: 500,
  gad_source: 100,
  gad_campaignid: 100,
  utm_source: 500,
  utm_medium: 500,
  utm_campaign: 500,
  utm_term: 500,
  utm_content: 500,
  flyer: 100,
};

export type TrackingParams = Partial<Record<string, string>>;

/** 対象のキーだけを残し、長さを切る。⚠️ 空の値は落とす */
export const pickTrackingParams = (raw: unknown): TrackingParams => {
  const result: TrackingParams = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const [key, max] of Object.entries(TRACKING_KEYS)) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().slice(0, max);
    if (trimmed !== '') result[key] = trimmed;
  }
  return result;
};

/** 流入元。⚠️ フォームと同じ順（utm_source → fbclid → gclid/wbraid/gbraid → yclid → flyer） */
export const sourceOf = (p: TrackingParams): string | null => {
  if (p.utm_source) return p.utm_source.slice(0, 200);
  if (p.fbclid) return 'Facebook/Instagram';
  if (p.gclid || p.wbraid || p.gbraid) return 'Google';
  if (p.yclid) return 'Yahoo';
  if (p.flyer) return 'Flyer';
  return null;
};

/** landing_params（クエリ文字列）を読む。⚠️ 壊れた % を含んでも落ちない */
export const parseLandingParams = (text: string | null | undefined): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!text) return result;
  try {
    new URLSearchParams(text.replace(/^\?/, '')).forEach((value, key) => {
      if (result[key] === undefined) result[key] = value;
    });
  } catch {
    // 読めない値は空として扱う
  }
  return result;
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
