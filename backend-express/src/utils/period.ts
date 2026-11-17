/**
 * 画面が送る期間（startMonth / endMonth、'YYYYMM'）を月の一覧にする。
 * v2.2.274 で反響一覧用に作り、v2.2.277 で共通にした（反響一覧・店舗別反響推移。v2.2.278 で販促媒体別反響推移も使う）。
 *
 * ⚠️⚠️ ① の backend/src/core/period.php と同じ規則にすること。
 *   ⚠️ ② が落ちたときは ① の PHP が同じ応答を返す（件数が食い違わないように）。
 *
 *   両方とも無い          … null（今までどおり全件）
 *   開始月が終了月より後  … []（0件）
 *   書式が違う・片方だけ・120か月を超える … 'invalid'（400）
 */

const MONTH_PATTERN = /^\d{4}(0[1-9]|1[0-2])$/;
const MAX_MONTHS = 120;

const asMonthText = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return String(value);
  return null;
};

export const periodMonths = (startValue: unknown, endValue: unknown): string[] | null | 'invalid' => {
  const isEmpty = (v: unknown) => v === undefined || v === null || v === '';
  if (isEmpty(startValue) && isEmpty(endValue)) return null;

  const start = asMonthText(startValue);
  const end = asMonthText(endValue);
  if (start === null || end === null || !MONTH_PATTERN.test(start) || !MONTH_PATTERN.test(end)) return 'invalid';

  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(4, 6));
  const endYear = Number(end.slice(0, 4));
  const endMonth = Number(end.slice(4, 6));
  const months: string[] = [];
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}/${String(month).padStart(2, '0')}`);
    if (months.length > MAX_MONTHS) return 'invalid';
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
};

/**
 * 前年同月を足した月の一覧（昨年実績を出すとき用）。⚠️ 重複は除き、古い順に並べる。
 */
export const withLastYearMonths = (months: string[]): string[] => {
  const lastYear = months.map(m => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`);
  return [...new Set([...lastYear, ...months])].sort();
};

/** パラメータ付きの SQL の断片 */
export interface MonthCondition {
  sql: string;
  params: string[];
}

/**
 * 日付の列を月で絞る条件。⚠️ 画面の判定（'-' を '/' にして先頭7文字）と同じ。
 * ⚠️ column は呼び出し側の固定の列名だけを渡す（利用者の入力を入れない）。
 */
export const monthCondition = (column: string, months: string[] | null): MonthCondition => {
  if (months === null) return { sql: '1 = 1', params: [] };
  if (months.length === 0) return { sql: '1 = 0', params: [] };
  return {
    sql: `LEFT(REPLACE(${column}, '-', '/'), 7) IN (${months.map(() => '?').join(', ')})`,
    params: months,
  };
};

/**
 * 日付の列の「どれか1つ」が月の一覧に入る行に絞る条件（店舗別反響推移など）。
 * ⚠️ NULL の列があっても条件が NULL にならないよう COALESCE する。
 * ⚠️ columns は呼び出し側の固定の列名だけを渡す（利用者の入力を入れない）。
 */
export const anyMonthCondition = (columns: readonly string[], months: string[] | null): MonthCondition => {
  if (months === null) return { sql: '1 = 1', params: [] };
  if (months.length === 0 || columns.length === 0) return { sql: '1 = 0', params: [] };
  const parts = columns.map(column => monthCondition(`COALESCE(${column}, '')`, months));
  return {
    sql: `(${parts.map(p => p.sql).join(' OR ')})`,
    params: parts.flatMap(p => p.params),
  };
};
