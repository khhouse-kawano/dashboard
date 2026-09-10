import QRCode from 'qrcode';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { sanitizeHeader, sendMail } from '../../utils/mailer';

/**
 * イベント予約の確認メール。
 *
 * ⚠️ **QRコードはここで作り直す。** フォーム側も画面表示用に同じQRを生成しているが、
 *   その画像データを送ってもらう設計にはしていない。公開エンドポイントで
 *   数KBの画像を受け取ると、任意の画像を送り込める穴になるため。
 *   `id` さえあれば同じQRを再現できる。
 *
 * ⚠️ フォーム側（LPの index.html）と**同じURLを埋め込むこと。**
 *   ずれると、メールのQRと画面のQRで別の内容になる。
 */

/** ⚠️ LPの index.html の reservationUrl と一致させること */
const RESERVATION_URL_BASE = 'https://kh-house.jp/festa/reservation/';

export interface ReservationMailData {
  id: string;
  name: string;
  kana: string;
  date: string;
  time: string;
  mail: string;
  phone: string;
  address: string;
  area: string;
  interview: string;
  request: string;
  title: string;
  /**
   * 個人情報の取り扱いへの同意。1 = 同意済み。
   *
   * ⚠️ フォームは同意を必須にしているため実際には常に 1 になる。
   *   それでも 0 の表記を用意しておくこと。フォームを介さず
   *   直接APIを叩かれた場合に「チェック済み」と誤記録しないため。
   *
   * ⚠️ LPの同意文には**写真撮影と広報利用**の了承も含まれる。
   *   この値はその同意も兼ねている。文面を変えるときは
   *   LPの .form__privacy と揃えること。
   */
  agree: number;
}

/**
 * QRコードをPNGのバッファで作る。
 *
 * ⚠️ 失敗しても例外を投げない。QRが作れないことを理由に予約の確認メールを
 *   丸ごと止めるべきではない（予約自体は保存済みで、受付は手入力でもできる）。
 *
 * ⚠️ **呼び出し側で1回だけ作って、顧客宛・社内宛の両方に渡すこと。**
 *   メールごとに作ると同じ画像を2度生成することになる。
 */
export const buildQrPng = async (id: string): Promise<Buffer | null> => {
  try {
    return await QRCode.toBuffer(`${RESERVATION_URL_BASE}?id=${id}`, {
      width: 600,
      margin: 1,
    });
  } catch (error) {
    logger.error(`QRコードの生成に失敗しました id=${id}: ${(error as Error).message}`);
    return null;
  }
};

/** 複数選択の値を箇条書きにする。⚠️ 保存形式はカンマ区切り（既存データに合わせている） */
const bulletize = (value: string): string =>
  value === ''
    ? '  （なし）'
    : value
        .split(',')
        .map((v) => `  ・${v.trim()}`)
        .join('\n');

/**
 * 同意欄の表記。
 *
 * ⚠️ 顧客宛・社内宛で同じ文言を使う。片方だけ変えると、
 *   問い合わせ対応のときに突き合わせができなくなる。
 */
const agreeLabel = (agree: number): string =>
  agree === 1 ? '【個人情報の同意】チェック済み' : '【個人情報の同意】未同意';

const nowJst = (): string =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

/**
 * 予約者へ確認メールを送る（QRコード添付）。
 *
 * ⚠️ LPの完了画面に「メールアドレスにも添付しております」と明記されている。
 *   ここを止めると案内と実装が食い違い、問い合わせが増える。
 */
export const sendReservationConfirm = async (
  data: ReservationMailData,
  qr: Buffer | null
): Promise<boolean> => {
  if (data.mail === '') return false;

  const lines = [
    `${data.name} 様`,
    '',
    `この度は「${data.title}」にご予約いただき、誠にありがとうございます。`,
    '以下の内容で承りました。',
    '',
    `【来場日】${data.date}`,
    `【来場時間】${data.time}`,
    `【お名前】${data.name}${data.kana === '' ? '' : `（${data.kana}）`}`,
    `【電話番号】${data.phone}`,
    `【お住まいの地域】${data.address}`,
    data.area === '' ? '' : `【建築/購入希望エリア】${data.area}`,
    '【当日したいこと】',
    bulletize(data.interview),
    data.request === '' ? '' : '【マイホームのご検討】',
    data.request === '' ? '' : bulletize(data.request),
    agreeLabel(data.agree),
    '',
    '──────────────────────',
    '当日の受付について',
    '──────────────────────',
    '添付のQRコードを受付でご提示ください。スムーズにご案内できます。',
    '画像を保存いただくか、このメールをそのままご提示いただいても構いません。',
    '',
    // ⚠️ 添付を紛失したときの逃げ道。ここからQRを再表示できる
    'QRコードは下記のページでも表示できます。',
    `${RESERVATION_URL_BASE}?id=${data.id}`,
    '',
    // ⚠️ 添付が作れなかった場合に「添付があるはず」と探させない
    qr === null
      ? '※QRコードの添付に失敗しました。上記のページからご確認いただくか、受付でお名前をお伝えください。'
      : '',
    '',
    'ご不明な点がございましたら、このメールにご返信ください。',
    '',
    '国分ハウジング',
  ].filter((line) => line !== '');

  return sendMail({
    to: data.mail,
    subject: `【${data.title}】ご予約ありがとうございます`,
    text: lines.join('\n'),
    attachments:
      qr === null
        ? undefined
        : [{ filename: `${data.id}.png`, content: qr, contentType: 'image/png' }],
  });
};

/**
 * 社内へ予約通知を送る（QRコード添付）。
 *
 * ⚠️ 宛先は EVENT_NOTIFY_TO（未設定なら AMBASSADOR_NOTIFY_TO）。
 *   ⚠️ どちらも空なら送らない。空のまま運用すると、
 *   ダッシュボードを見るまで誰も予約に気づけない。
 *
 * ⚠️ 社内宛にもQRを添付する。来場者がQRを紛失して問い合わせてきたときに、
 *   この通知メールから転送すれば済む（DBを見に行かなくてよい）。
 */
export const sendInternalNotice = async (
  data: ReservationMailData,
  qr: Buffer | null
): Promise<boolean> => {
  const to = env.eventNotifyTo;
  if (to.length === 0) return false;

  const customer = data.name === '' ? '氏名未入力' : `${data.name}様`;

  const lines = [
    `${data.title} のLPから予約が入りました。`,
    '',
    `【受付日時】${nowJst()}`,
    `【予約ID】${data.id}`,
    `【来場日】${data.date}`,
    `【来場時間】${data.time}`,
    `【お名前】${data.name}${data.kana === '' ? '' : `（${data.kana}）`}`,
    `【メールアドレス】${data.mail === '' ? '（未入力）' : data.mail}`,
    `【電話番号】${data.phone === '' ? '（未入力）' : data.phone}`,
    `【お住まいの地域】${data.address}`,
    `【建築/購入希望エリア】${data.area === '' ? '（未入力）' : data.area}`,
    '【当日したいこと】',
    bulletize(data.interview),
    '【マイホームのご検討】',
    bulletize(data.request),
    agreeLabel(data.agree),
    '',
    'ダッシュボードの「集客イベント → 反響一覧」から確認・編集できます。',
    '',
    '当日の受付用QRコードを添付しています。',
    `${RESERVATION_URL_BASE}?id=${data.id}`,
  ];

  return sendMail({
    to,
    subject: sanitizeHeader(`【${data.title}／予約】${customer}`),
    text: lines.join('\n'),
    attachments:
      qr === null
        ? undefined
        : [{ filename: `${data.id}.png`, content: qr, contentType: 'image/png' }],
  });
};
