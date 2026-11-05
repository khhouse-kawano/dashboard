/**
 * 売り反響・買い反響の連絡先（contact「電話 / メール」）から、電話番号とメールアドレスを取り出す（v2.2.251）。
 *
 * ─────────────────────────────────────────────
 *   以前のアプリには連絡先の欄が contact の1つしか無く、取り込み（importer.ts）は contact だけを写していた。
 *   Dashboard の一覧・編集画面は phone・mail の列を見るので、取り込みのときに phone・mail も入れる。
 *
 *   電話 … メールアドレスの部分を除き、最初の「数字とハイフン類のかたまり」を数字だけにする
 *          0 から始まる 10〜11桁ならそのまま。50・70・80・90 から始まる 10桁は、先頭の 0 が落ちた携帯・IP電話とみて 0 を足す。
 *          それ以外の形は '' （入れない）
 *   メール … メールアドレスの形の最初のもの
 * ─────────────────────────────────────────────
 *
 * ⚠️ backend/scripts/sql/2026-11-05_realty_lead_contact_split.sql（今あるデータを直す SQL）と同じ取り出し方。⚠️ どちらかを変えたら両方を変える
 */

const MAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}/;
const MAIL_PATTERN_ALL = new RegExp(MAIL_PATTERN.source, 'g');
/** 数字とハイフン類のかたまり（SQL の '[0-9][-‐－⁻ー−0-9]{7,14}[0-9]' と同じ） */
const PHONE_RUN = /[0-9][-‐－⁻ー−0-9]{7,14}[0-9]/;

export const phoneFromContact = (contact: unknown): string => {
  const text = String(contact ?? '').replace(MAIL_PATTERN_ALL, ' ');
  const digits = (text.match(PHONE_RUN)?.[0] ?? '').replace(/[^0-9]/g, '');
  if (/^0[0-9]{9,10}$/.test(digits)) return digits;
  if (/^[5789]0[0-9]{8}$/.test(digits)) return `0${digits}`;
  return '';
};

export const mailFromContact = (contact: unknown): string => String(contact ?? '').match(MAIL_PATTERN)?.[0] ?? '';
