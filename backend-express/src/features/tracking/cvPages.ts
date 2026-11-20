/**
 * 完了ページ（CV にするページ。v2.2.287）。tracking_sites.cv_pages に入れる。画面は header/TrackingSettings.tsx（サイトの編集）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 形は [{ pattern: 'パスの先頭（/event_ok/ など）', kind: 'CV の種類' }]。⚠️ 上から順に見て、最初に当てはまったものの種類にする。
 * ⚠️ パスの先頭で見る（⚠️ 「含む」にすると tracking_pageviews の索引が効かず、サイトごとに数秒かかるため）。⚠️ / で始まらなければ / を足す。
 * ⚠️ 1件も無いサイトは、今までどおり反響の流入の記録（landing_params の khg_vid）で CV を数える（conversions.ts）。
 * ⚠️ 画面から ① を通ると {} が [] になるので、画面は JSON の文字列で送る（parseCvPages は文字列も配列も受ける）。
 * ─────────────────────────────────────────────
 */

export interface CvPage {
  pattern: string;
  kind: string;
}

/** 1サイトに登録できる完了ページの数・文字数の上限 */
export const CV_PAGE_LIMIT = 30;
const PATTERN_MAX = 200;
const KIND_MAX = 50;

/** DB の値・画面の入力 → 完了ページ（⚠️ 壊れた値・空の行は捨てる。同じ pattern は最初の1件） */
export const parseCvPages = (raw: unknown): CvPage[] => {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.trim() === '') return [];
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pages: CvPage[] = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue;
    const typed = String((item as Record<string, unknown>).pattern ?? '').trim().slice(0, PATTERN_MAX);
    const pattern = typed === '' || typed.startsWith('/') ? typed : `/${typed}`;
    const kind = String((item as Record<string, unknown>).kind ?? '').trim().slice(0, KIND_MAX);
    if (pattern === '' || kind === '' || seen.has(pattern)) continue;
    seen.add(pattern);
    pages.push({ pattern, kind });
    if (pages.length >= CV_PAGE_LIMIT) break;
  }
  return pages;
};

/** ページの URL → パス（⚠️ tracking_pageviews.url はオリジン＋パス。? 以降は入っていない） */
export const pathOf = (url: string): string => url.replace(/^https?:\/\/[^/]+/i, '') || '/';

/** ページの URL → CV の種類（当てはまらなければ null） */
export const cvKindOf = (pages: CvPage[], url: string): string | null => {
  const path = pathOf(url);
  return pages.find((p) => path.startsWith(p.pattern))?.kind ?? null;
};

/**
 * CV 用のタグ（cv.js。tracking_conversions.form）のフォーム → CV の種類。
 * ⚠️ 完了ページが記録されないフォームの補い（かえるホーム）。⚠️ 会員情報の変更（memberc）は CV にしない（null）。
 */
const FORM_KIND: Record<string, string | null> = {
  member: '会員登録', shop_reserve: '来店予約', search: '物件の問い合わせ', sakidori: '先取り物件の問い合わせ',
  event: 'イベント予約', contact: '問い合わせ', memberc: null,
};
export const formKindOf = (form: string): string | null => (form in FORM_KIND ? FORM_KIND[form] : form === '' ? null : form);
