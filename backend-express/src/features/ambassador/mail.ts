import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { sendMail } from '../../utils/mailer';

/**
 * アンバサダー反響のメール2通。
 *
 *   顧客宛   … 受け付けたことの控え（サンクスメール）
 *   社内宛   … mkt@kh-house.jp への通知
 *
 * ⚠️ **どちらの失敗も反響の保存には影響させない。** 保存を確定させたあとに送る。
 *   逆にすると、メールサーバーが不調な間の反響が丸ごと消える。
 *
 * ⚠️ 2通は独立して送る。片方が失敗しても、もう片方は送る。
 *   顧客宛が失敗しても社内が気づけるようにすることが重要。
 */

/** 顧客が入力した値。フォームの項目そのまま */
export interface InquiryMailData {
  name: string;
  kana: string;
  zip: string;
  address: string;
  buildArea: string;
  mail: string;
  phone: string;
  account: string;
  /** 紹介元。台帳に照合できたときだけ入る */
  ambassadorNo: number | null;
  ambassadorName: string;
  ambassadorAccount: string;
  /** URL から届いた生の値。照合できなかった原因を社内宛に載せる */
  ambassadorId: string;
}

/** 未入力は「（未入力）」と書く。空行だと項目が抜けたのか空なのか分からない */
const orBlank = (value: string): string => (value.trim() === '' ? '（未入力）' : value.trim());

/** 顧客が入力した内容の一覧。2通で同じものを使う */
const detailLines = (data: InquiryMailData): string =>
  [
    `お名前：${orBlank(data.name)}`,
    `ふりがな：${orBlank(data.kana)}`,
    `郵便番号：${orBlank(data.zip)}`,
    `ご住所：${orBlank(data.address)}`,
    `建築希望地：${orBlank(data.buildArea)}`,
    `メールアドレス：${orBlank(data.mail)}`,
    `電話番号：${orBlank(data.phone)}`,
    `インスタグラムのアカウント名：${data.account.trim() === '' ? '（未入力）' : `@${data.account.trim()}`}`,
  ].join('\n');

/** 日時。⚠️ ② のコンテナは UTC のことがあるため、日本時間に直して書く */
const nowJst = (): string =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

// ---------------------------------------------------------------------------
// 顧客宛
// ---------------------------------------------------------------------------

const customerBody = (data: InquiryMailData): string =>
  `${orBlank(data.name)} 様

お問い合わせいただきありがとうございます。
以下の内容で承りました。担当者より折り返しご連絡いたします。

------------------------------------------------------------
${detailLines(data)}
------------------------------------------------------------

内容に誤りがある場合や、お急ぎの場合は本メールにご返信ください。

株式会社国分ハウジング
https://kh-house.jp/
`;

/**
 * 顧客へサンクスメールを送る。
 *
 * ⚠️ 宛先は**フォームに入力された任意のアドレス**である。
 *   つまりこの機能は、第三者へメールを送る踏み台になりうる。
 *   抑止しているのは公開受付の流量制限（1IPあたり10分で5件）だけ。
 *   件数を増やすときはこの点を思い出すこと。
 */
export const sendCustomerThanks = async (data: InquiryMailData): Promise<boolean> => {
  const to = data.mail.trim();
  if (to === '') {
    // 電話番号だけで送信された反響。エラーではない
    logger.info('サンクスメール: メールアドレスが未入力のため送信しません。');
    return false;
  }

  return sendMail({
    to,
    subject: '【国分ハウジング】お問い合わせありがとうございます',
    text: customerBody(data),
  });
};

// ---------------------------------------------------------------------------
// 社内宛
// ---------------------------------------------------------------------------

/**
 * 反響元（紹介したアンバサダー）の氏名。件名にも本文にも使う。
 *
 * ⚠️ 台帳（ambassador_list.name）の**現在の氏名**を使う。
 *   反響側には氏名が保存されていないため、ここでしか出せない。
 *
 * ⚠️ 照合できなかった場合は「不明」と書く。空欄にすると、
 *   担当者が「アンバサダー経由ではない」と誤解する。
 */
const ambassadorName = (data: InquiryMailData): string => {
  if (data.ambassadorNo === null) return '不明';
  const name = data.ambassadorName.trim();
  return name === '' ? '氏名未登録' : name;
};

/**
 * 反響元の詳細行。
 *
 * ⚠️ 照合できなかったときは受信した生の id も載せる。
 *   URLの配布ミス（`?` の付け忘れ等）を追える唯一の手掛かりになる。
 */
const ambassadorLine = (data: InquiryMailData): string => {
  if (data.ambassadorNo === null) {
    const raw = data.ambassadorId.trim();
    return `反響元：⚠️ 台帳と照合できませんでした（受信したid: ${raw === '' ? 'なし' : raw}）`;
  }
  const account = data.ambassadorAccount.trim();
  const suffix = account === '' ? '' : ` / @${account}`;
  return `反響元：${ambassadorName(data)}様${suffix}（ID: ${data.ambassadorNo}）`;
};

const notifyBody = (data: InquiryMailData): string =>
  `公式アンバサダーLPから反響がありました。

受付日時：${nowJst()}
${ambassadorLine(data)}

------------------------------------------------------------
${detailLines(data)}
------------------------------------------------------------

ダッシュボードの「アンバサダー反響一覧」から担当店舗・担当営業を割り当ててください。
担当店舗を設定しないと顧客情報へ取り込めません。
`;

/**
 * 社内へ通知する。
 *
 * ⚠️ **この失敗は顧客宛の失敗より重い。** 誰も反響に気づかないまま
 *   時間が経つことになる。失敗は必ずログに残し、画面にも印を出す。
 */
export const sendInternalNotice = async (data: InquiryMailData): Promise<boolean> => {
  const to = env.ambassadorNotifyTo;
  if (to.length === 0) {
    logger.warn(
      'アンバサダー反響の社内通知先が未設定です。AMBASSADOR_NOTIFY_TO を設定してください。'
    );
    return false;
  }

  const customer = data.name.trim();
  return sendMail({
    to,
    // ⚠️ 件名の【】内は**反響元のアンバサダー名**（顧客名ではない）。
    //   誰の紹介が動いているかを受信箱の一覧で把握できるようにするため。
    //
    // ⚠️ そのうえで顧客名も付ける。同じアンバサダーから複数届いたときに
    //   件名だけで区別できないと、対応済みかどうかが分からなくなる。
    //
    // ⚠️ 改行は sendMail 側で落としている（ヘッダインジェクション対策）
    subject:
      `【公式アンバサダーからの反響/${ambassadorName(data)}様】` +
      `${customer === '' ? '氏名未入力' : `${customer}様`}`,
    text: notifyBody(data),
  });
};
