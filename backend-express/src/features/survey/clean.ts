import type { RowDataPacket } from 'mysql2/promise';

/**
 * 面談アンケート（survey）の値の整え方（v2.2.257）。
 * ⚠️ お客様の端末から届く値は信用しない（features/beforeSurvey/entry.ts と同じ考え方）。長さで切り、制御文字を落とす。
 */

/** SELECT の1行（staff.ts・public.ts） */
export interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 制御文字（改行を含む） */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
/** 制御文字（改行は残す） */
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** 1行の文字 */
export const cleanLine = (value: unknown, max: number): string =>
  asText(value).replace(CONTROL_CHARS, '').trim().slice(0, max);

/**
 * 1行の文字（⚠️ 前後の空白を残す）。お客様の名前用。
 *   ⚠️ 新規のお客様は、あとで projects/sync が before_interview を name・shop で探す。heroku へは加工しない名前が届くので、そろえる
 */
export const cleanRaw = (value: unknown, max: number): string =>
  asText(value).replace(CONTROL_CHARS, '').slice(0, max);

/** 複数行の文字（自由記入） */
export const cleanText = (value: unknown, max: number): string =>
  asText(value).replace(/\r\n?/g, '\n').replace(CONTROL_CHARS_KEEP_NEWLINE, '').trim().slice(0, max);

/** 選択肢の配列（空を除く）。配列でなければ1つの文字として扱う。区切り（', ' か ','）は呼び出し側で join する（旧 PHP の implode） */
export const cleanItems = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).map((v) => cleanLine(v, 200)).filter((v) => v !== '').slice(0, 30);

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
