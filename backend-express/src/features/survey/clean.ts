/**
 * 面談アンケート（survey）の値の整え方（v2.2.257）。
 * ⚠️ お客様の端末から届く値は信用しない（features/beforeSurvey/entry.ts と同じ考え方）。長さで切り、制御文字を落とす。
 */

/** 制御文字（改行を含む） */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
/** 制御文字（改行は残す） */
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** 1行の文字 */
export const cleanLine = (value: unknown, max: number): string =>
  asText(value).replace(CONTROL_CHARS, '').trim().slice(0, max);

/** 複数行の文字（自由記入） */
export const cleanText = (value: unknown, max: number): string =>
  asText(value).replace(/\r\n?/g, '\n').replace(CONTROL_CHARS_KEEP_NEWLINE, '').trim().slice(0, max);

/** 選択肢の配列を区切り文字でつなぐ（旧 PHP の implode）。配列でなければ1つの文字として扱う */
export const cleanList = (value: unknown, sep: string, max = 1000): string =>
  (Array.isArray(value) ? value.map((v) => cleanLine(v, 200)).filter((v) => v !== '') : [cleanLine(value, 200)].filter((v) => v !== ''))
    .join(sep)
    .slice(0, max);

/** 決まった項目だけを持つオブジェクト（家族・勤務先）。⚠️ 知らない項目は捨てる */
export const cleanObject = (value: unknown, keys: readonly string[], max = 200): Record<string, string> => {
  const src = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(keys.map((k) => [k, cleanLine(src[k], max)]));
};

/** 日本時間の 'YYYY/MM/DD HH:mm:ss'（旧 PHP の date('Y/m/d H:i:s')） */
export const jstStamp = (now = new Date()): string => {
  const d = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString();
  return `${d.slice(0, 10).replace(/-/g, '/')} ${d.slice(11, 19)}`;
};
