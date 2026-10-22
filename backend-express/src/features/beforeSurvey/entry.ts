import { execute } from '../../db/pool';
import { logger } from '../../utils/logger';
import { sanitizeHeader, sendMail } from '../../utils/mailer';
import { BRANDS, QUESTIONS } from './questions';
import type { SurveyBrand } from './questions';

/**
 * 事前アンケートの受付（v2.2.207。`before_survey_entry`。⚠️ 公開・認証なし）。
 *
 * ─────────────────────────────────────────────
 * 送信元: https://khg-marketing.info/survey_<ブランド>/（backend/forms/survey/index.html）
 * ⚠️ v2.2.206 までは confirm.php → thanks.php がメールを送り、GAS（Pre_survey）がそのメールを読んで before_survey に入れていた。
 *   ⚠️⚠️ **このデプロイと同時に GAS の Pre_survey を止める**（止めないと通知メールを読んで二重に入る）。
 * ⚠️ 社外の誰でも叩ける書き込み口。⚠️ リクエストの値を信用しない（features/ambassador/inquiry.ts と同じ考え方）。
 *   ⚠️ 列名はすべて questions.ts の定数。⚠️ 長さで切る・制御文字を落とす。⚠️ ブランドは BRANDS のキーだけ。
 *   ⚠️ 流量の上限は middlewares/publicFormRateLimit.ts。
 * ⚠️ 選択肢の値は検証しない（選択肢を変えたときにフォームと食い違っても回答を捨てないため）。必須の未入力だけ弾く。
 * ⚠️ お客様へのサンクスメールは送らない（指示書）。⚠️ 通知メールの失敗では 500 にしない（保存は済んでいる。再送で二重になる）。
 * ─────────────────────────────────────────────
 */

/** 制御文字（改行を含む） */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
/** 制御文字（改行は残す） */
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const cleanLine = (value: unknown, max: number): string =>
  asText(value).replace(CONTROL_CHARS, '').trim().slice(0, max);

const cleanMultiline = (value: unknown, max: number): string =>
  asText(value)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_KEEP_NEWLINE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);

/** 複数選択。⚠️ 配列でも文字列でも受ける。半角スペースでつなぐ */
const cleanChecks = (value: unknown, max: number): string => {
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => cleanLine(item, 200).replace(/\s+/g, ' '))
    .filter((item) => item !== '')
    .join(' ')
    .slice(0, max);
};

/** 今日（日本時間）を yyyy/MM/dd。⚠️ dateStr は GAS の Utilities.formatDate(date, 'JST', 'yyyy/MM/dd') と同じ形（反響一覧が月で絞る） */
const todayJst = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts.replace(/-/g, '/');
};

const nowJst = (): string =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

export interface BeforeSurveyResult {
  httpStatus: number;
  body: unknown;
}

const failure = (httpStatus: number, message: string): BeforeSurveyResult => ({ httpStatus, body: { status: 'error', message } });

/** 通知メールの本文（v2.2.206 までの thanks.php のメールと同じ件名・項目の並び） */
const noticeText = (brand: SurveyBrand, answers: Record<string, string>): string =>
  [
    `【${brand.short}共通】事前アンケートへの回答がありました。`,
    '',
    `回答日時：${nowJst()}`,
    '====================',
    ...QUESTIONS.flatMap((q) => [`■ ${q.label}`, answers[q.column] === '' ? '（未回答）' : answers[q.column], '']),
    '====================',
    '※自動送信メールです。',
  ].join('\n');

export const runBeforeSurveyEntry = async (body: Record<string, unknown>): Promise<BeforeSurveyResult> => {
  const brandKey = cleanLine(body.brand, 20).toLowerCase();
  const brand = Object.prototype.hasOwnProperty.call(BRANDS, brandKey) ? BRANDS[brandKey] : undefined;
  if (brand === undefined) return failure(400, 'アンケートの種類が分かりません。ページを開き直してください。');

  const answers: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const raw = body[q.column];
    answers[q.column] =
      q.kind === 'check' ? cleanChecks(raw, q.max) : q.kind === 'textarea' ? cleanMultiline(raw, q.max) : cleanLine(raw, q.max);
  }
  const missing = QUESTIONS.filter((q) => q.required && answers[q.column] === '');
  if (missing.length > 0) return failure(400, `未回答の必須項目があります（${missing[0].label}）。`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.emailAddress)) return failure(400, 'メールアドレスの形式が正しくありません。');

  // ⚠️ 列名は questions.ts の定数だけ。⚠️ sync は 0 固定（リクエストから受け取らない）
  const row: Record<string, string | number> = { sync: 0, brand: brand.code, dateStr: todayJst(), ...answers };
  const columns = Object.keys(row);
  let id = 0;
  try {
    const result = await execute(
      `INSERT INTO before_survey (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      Object.values(row)
    );
    id = result.insertId;
  } catch (error) {
    // ⚠️ 失われた回答を復元できるのはこのログだけ
    logger.error(`before_survey_entry: 保存に失敗 brand=${brand.code} name="${answers.name}" mail="${answers.emailAddress}": ${(error as Error).message}`);
    return failure(500, '送信に失敗しました。お手数ですが時間をおいて再度お試しください。');
  }
  logger.info(`before_survey_entry: 受け付けました id=${id} brand=${brand.code}`);

  const sent = await sendMail({
    to: brand.notify,
    subject: sanitizeHeader(`【${brand.short}共通】事前アンケートへの回答がありました。`),
    text: noticeText(brand, answers),
    fromName: brand.name,
  });
  if (!sent) logger.error(`before_survey_entry: 通知メールを送れませんでした id=${id} brand=${brand.code}。反響一覧で直接確認してください。`);

  return { httpStatus: 200, body: { status: 'ok' } };
};
