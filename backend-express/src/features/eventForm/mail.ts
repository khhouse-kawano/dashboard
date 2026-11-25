import { logger } from '../../utils/logger';
import { sanitizeHeader, sendMail } from '../../utils/mailer';
import { safeAddressList } from '../campaignForm/mail';

/**
 * イベントの予約フォーム（v2.2.298）のメール2通。
 *
 *   申し込んだ本人 … 受付完了（入力した内容の控え）
 *   社内           … event_form.mail_to / mail_cc へ通知
 *
 * ⚠️ どちらの失敗も申し込みの保存に影響させない（保存のあとに送る。sendMail は例外を出さない）。
 * ⚠️ 宛先は DB の値と本人の入力なので、必ず safeAddressList を通す（ヘッダの注入を防ぐ）。
 * ⚠️ ログに氏名・電話・メールを残さない（フォームの番号だけ）。
 */

export interface EntryMailData {
  formId: number;
  /** 画面に出すイベント名（先頭の開催日を外したもの） */
  eventName: string;
  /** 開催日（'2026年12月6日（日）'。分からなければ空） */
  eventDate: string;
  name: string;
  mail: string;
  /** 入力した内容（ラベルと値。表示した欄だけ・空は除く） */
  lines: Array<{ label: string; value: string }>;
  receivedAt: string;
}

const RULE = '────────────────────';

/** 「■見出し」と値の組を、空行で区切って並べる */
const block = (pairs: Array<{ label: string; value: string }>): string =>
  pairs.map(({ label, value }) => `■${label}\n${value}`).join('\n\n');

/** 本人宛の件名と本文 */
export const thanksMail = (d: EntryMailData): { subject: string; text: string } => ({
  subject: `【${d.eventName}】お申し込みありがとうございます`,
  text: [
    `${d.name} 様`,
    '',
    `このたびは「${d.eventName}」にお申し込みいただき、誠にありがとうございます。`,
    '以下の内容で受け付けました。',
    '',
    RULE,
    block([...(d.eventDate === '' ? [] : [{ label: '開催日', value: d.eventDate }]), ...d.lines]),
    RULE,
    '',
    '内容の確認のため、担当者からご連絡を差し上げる場合がございます。',
    'お心当たりのない場合は、お手数ですがこのメールを破棄してください。',
  ].join('\n'),
});

/** 社内宛の件名と本文 */
export const noticeMail = (d: EntryMailData): { subject: string; text: string } => ({
  subject: `【${d.eventName}／フォーム予約】${d.name}様`,
  text: [
    `「${d.eventName}」のフォームから予約がありました。`,
    '',
    block([{ label: 'フォーム番号', value: String(d.formId) }, { label: '受付日時', value: d.receivedAt }, ...d.lines]),
    '',
    RULE,
    'Dashboard の「集客イベント → 反響一覧」で確認できます。',
  ].join('\n'),
});

export const sendEntryThanks = async (d: EntryMailData): Promise<boolean> => {
  const to = safeAddressList(d.mail);
  if (to.length === 0) return false;
  const { subject, text } = thanksMail(d);
  const ok = await sendMail({ to, subject: sanitizeHeader(subject), text });
  if (!ok) logger.warn(`event_form_entry: 受付完了メールを送れませんでした form=${d.formId}`);
  return ok;
};

export const sendEntryNotice = async (d: EntryMailData, mailTo: string, mailCc: string): Promise<boolean> => {
  const to = safeAddressList(mailTo);
  const cc = safeAddressList(mailCc);
  if (to.length === 0) {
    logger.warn(`event_form_entry: 社内通知の宛先がありません form=${d.formId}`);
    return false;
  }
  const { subject, text } = noticeMail(d);
  // ⚠️ Cc は宛先に足して送る（campaignForm と同じ。ヘッダを自前で組み立てない）
  const ok = await sendMail({ to: [...to, ...cc], subject: sanitizeHeader(subject), text });
  if (!ok) logger.error(`event_form_entry: 社内通知を送れませんでした form=${d.formId}`);
  return ok;
};
