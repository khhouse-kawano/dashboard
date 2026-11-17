import { createHash } from 'crypto';

/**
 * 重複判定の鍵（v2.2.276）。⚠️ 注文・建売・中古の反響をまたいで、メールか携帯が同じなら重複。氏名は使わない。
 *
 * ⚠️ 正規化は画面の listUtils.ts の toHalfWidth と同じく NFKC（全角→半角）を通す。
 *   ⚠️ SQL の REGEXP_REPLACE('[^0-9]') は全角数字を「消す」ので、鍵は SQL ではなくここで作る。
 * ⚠️ 個人情報削除で伏せた値（********）は `@` も数字も無いので、自然に鍵が空になる（重複から外れる）。
 */

/** 事業 → 反響の表。⚠️ 表の名前はここからだけ選ぶ（リクエストの値を SQL に入れない） */
export const DUP_TABLES = {
  order: 'inquiry_customer',
  spec: 'inquiry_customer_kaeru',
  used: 'inquiry_customer_resale',
} as const;

export type DupBrand = keyof typeof DUP_TABLES;
export const DUP_BRANDS = Object.keys(DUP_TABLES) as DupBrand[];

export const isDupBrand = (value: unknown): value is DupBrand =>
  typeof value === 'string' && (DUP_BRANDS as string[]).includes(value);

const MAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** ⚠️ 表の列の長さ（VARCHAR(254)） */
const MAIL_MAX = 254;
/** ⚠️ 携帯は 070 / 080 / 090 / 050 で始まる 11桁だけ（2026-11-17 の決定。固定電話・桁の足りない番号は使わない） */
const MOBILE_PATTERN = /^0[5789]0\d{8}$/;

/** メール: NFKC → 空白（全角も）を除く → 小文字。⚠️ 形がメールでなければ null */
export const mailKey = (value: unknown): string | null => {
  const text = String(value ?? '').normalize('NFKC').replace(/[\s　]+/g, '').toLowerCase();
  return text.length <= MAIL_MAX && MAIL_PATTERN.test(text) ? text : null;
};

/** 携帯: NFKC → 数字だけ（ハイフン・Excel の ="…" も落ちる）。⚠️ 携帯の 11桁でなければ null */
export const mobileKey = (value: unknown): string | null => {
  const digits = String(value ?? '').normalize('NFKC').replace(/\D/g, '');
  return MOBILE_PATTERN.test(digits) ? digits : null;
};

/** 除外の名簿と同じ形のハッシュ（SQL の SHA2(値, 256) と同じ16進の小文字） */
export const keyHash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

/** メールのドメイン（@ の後ろ）。⚠️ mailKey を通した値に使う */
export const mailDomain = (mail: string): string => mail.slice(mail.lastIndexOf('@') + 1);
