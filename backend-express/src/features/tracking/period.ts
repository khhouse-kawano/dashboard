/**
 * アクセス解析の期間（v2.2.287）。画面（header/TrackingSettings.tsx）の上の期間を、GET の startDate / endDate で受ける。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 日付は日本時間の 'YYYY-MM-DD'（created_at も日本時間で入っている）。⚠️ 終わりの日はその日の 23:59:59 まで。
 * ⚠️ 指定が無い・読めないときは、今日を含む直近7日（今日−6日〜今日）。⚠️ 逆なら入れ替える。
 * ⚠️ 長さは最大 MAX_DAYS 日（⚠️ 長いと一覧の CV の計算に時間がかかるため）。超えたら終わりの日から数えて切る。
 * ─────────────────────────────────────────────
 */

export const DEFAULT_DAYS = 7;
export const MAX_DAYS = 92;

export interface Period {
  /** 'YYYY-MM-DD' */
  start: string;
  end: string;
  /** 日数（両端を含む） */
  days: number;
  /** 'YYYY-MM-DD 00:00:00' / 'YYYY-MM-DD 23:59:59' */
  since: string;
  until: string;
}

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (d: string): number => Date.parse(`${d}T00:00:00Z`);
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const valid = (v: unknown): v is string => typeof v === 'string' && DATE_PATTERN.test(v) && !Number.isNaN(toUtc(v)) && fromUtc(toUtc(v)) === v;

/** 日本時間の今日 */
export const todayJst = (): string => fromUtc(Date.now() + 9 * 3600_000);

export const parsePeriod = (startValue: unknown, endValue: unknown): Period => {
  let end = valid(endValue) ? endValue : todayJst();
  let start = valid(startValue) ? startValue : fromUtc(toUtc(end) - (DEFAULT_DAYS - 1) * DAY_MS);
  if (start > end) [start, end] = [end, start];
  if ((toUtc(end) - toUtc(start)) / DAY_MS + 1 > MAX_DAYS) start = fromUtc(toUtc(end) - (MAX_DAYS - 1) * DAY_MS);
  return { start, end, days: (toUtc(end) - toUtc(start)) / DAY_MS + 1, since: `${start} 00:00:00`, until: `${end} 23:59:59` };
};

/** 期間の日（古い順） */
export const periodDays = (p: Period): string[] => Array.from({ length: p.days }, (_, i) => fromUtc(toUtc(p.start) + i * DAY_MS));

/** 画面に返す形 */
export const periodBody = (p: Period): { start: string; end: string; days: number } => ({ start: p.start, end: p.end, days: p.days });
