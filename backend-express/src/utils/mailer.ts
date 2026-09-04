import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * メール送信。
 *
 * ─────────────────────────────────────────────
 * ⚠️ **送信の失敗でアプリを落とさない。** 送れたかどうかを true / false で返し、
 *   例外は外へ出さない。呼び出し側は「保存は済んでいる」前提で結果を記録する。
 *
 * ⚠️ SMTP が未設定なら**何も送らずに false を返す。**
 *   開発環境で本物の顧客へメールが飛ぶ事故を防ぐため、
 *   設定が無いときは黙って送信しないのが既定の動作である。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 送信ドメインは ① レンタルサーバー側のもの（kh-house.jp）を使う。
 *   ② から自前の名前で送ると SPF / DKIM が合わず迷惑メールになる。
 */

export interface MailMessage {
  to: string | string[];
  subject: string;
  /** プレーンテキスト本文。⚠️ HTMLメールは使わない（迷惑メール判定が厳しくなる） */
  text: string;
}

/**
 * 件名・宛先に使う値から改行を落とす。
 *
 * ⚠️⚠️ **必須。** 顧客が入力した氏名をそのまま件名に入れると、
 *   改行に続けて `Bcc: ...` と書かれた値でヘッダを追加され、
 *   任意の宛先へメールを送られる（ヘッダインジェクション）。
 *   nodemailer 側でも弾かれるが、こちらで確実に落としておく。
 */
export const sanitizeHeader = (value: string): string =>
  value.replace(/[\r\n]+/g, ' ').trim();

let transporter: Transporter | null = null;
/** 未設定の警告を毎回出すと反響のたびにログが埋まるため、1度だけにする */
let warnedMissingConfig = false;

/**
 * 送信可能かどうか。未設定なら null を返す。
 *
 * ⚠️ 接続は使い回す。反響ごとに作ると、そのたびにTLSハンドシェイクが走り、
 *   送信元IPが短時間に何度も接続することになる（接続数制限に掛かりうる）。
 */
const getTransporter = (): Transporter | null => {
  const { host, port, user, pass, from } = env.smtp;

  if (host === undefined || user === '' || pass === '' || from === '') {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      logger.warn(
        'SMTP が未設定のためメールを送信しません。' +
          '本番で送る場合は SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_FROM を設定してください。'
      );
    }
    return null;
  }

  if (transporter !== null) return transporter;

  transporter = nodemailer.createTransport({
    host,
    port,
    // ⚠️ 465 は接続直後から SSL、587 は STARTTLS。
    //   ここを取り違えると「接続はできるが応答が返らない」状態になる
    secure: port === 465,
    auth: { user, pass },
    // ⚠️ タイムアウトを必ず入れる。既定は無制限に近く、
    //   メールサーバーが不調なときにフォームの送信が固まる
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 5_000,
  });

  return transporter;
};

/**
 * 1通送る。送れたら true。
 *
 * ⚠️ 呼び出し側で try / catch を書かなくてよいようにしてある。
 *   ここで throw すると、保存済みの反響に対して 500 を返すことになり、
 *   顧客が再送して**同じ反響が重複する。**
 */
export const sendMail = async (message: MailMessage): Promise<boolean> => {
  const mailer = getTransporter();
  if (mailer === null) return false;

  const to = Array.isArray(message.to) ? message.to : [message.to];
  if (to.length === 0) {
    logger.warn('メールの宛先が空のため送信しませんでした。');
    return false;
  }

  try {
    await mailer.sendMail({
      from: env.smtp.from,
      to,
      // ⚠️ noreply から送るため、これが無いと顧客の返信が誰にも届かない
      replyTo: env.smtp.replyTo === '' ? undefined : env.smtp.replyTo,
      subject: sanitizeHeader(message.subject),
      text: message.text,
    });
    return true;
  } catch (error) {
    // ⚠️ 宛先は残すが、本文は残さない（個人情報がログに溜まる）。
    //   宛先だけあれば、後から手動で送り直せる
    logger.error(
      `メール送信に失敗しました to=${to.join(',')} subject="${sanitizeHeader(message.subject)}": ` +
        `${(error as Error).message}`
    );
    return false;
  }
};
