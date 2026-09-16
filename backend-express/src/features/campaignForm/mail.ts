import { logger } from '../../utils/logger';
import { sanitizeHeader, sendMail } from '../../utils/mailer';
import {
    DEFAULT_INTERNAL_BODY,
    DEFAULT_INTERNAL_SUBJECT,
    DEFAULT_MEMBER_BODY,
    DEFAULT_THANKS_BODY,
    DEFAULT_THANKS_SUBJECT,
    MEMBER_CAMPAIGN_ID,
    pick,
    render,
    type TemplateValues,
} from './mailTemplate';

/**
 * キャンペーンフォーム反響のメール2通。
 *
 *   顧客宛 … 受け付けた控え（サンクスメール）
 *   社内宛 … form_table.mail_to / mail_cc へ通知
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **どちらの失敗も反響の保存に影響させない。** 保存を確定させたあとに送る。
 * ⚠️ 2通は独立して送る。片方が失敗しても、もう片方は送る。
 *
 * ⚠️⚠️ **宛先は必ず無害化する。**
 *   ⚠️ 移植元は `Cc:` の行に**リクエストの値をそのまま**入れていた。
 *     改行を仕込めば `Bcc:` を追加でき、**任意の宛先へ送信できた**。
 *   ⚠️ ここでは form_table から引いた値しか使わないが、
 *     **DB の値が汚れている可能性もある**ので同じように検査する。
 * ─────────────────────────────────────────────
 */

/** 顧客が入力した内容。entry.ts の Answers と同じ形 */
export interface FormAnswers {
    sei: string; mei: string; seiKana: string; meiKana: string;
    zip: string; pref: string; city: string; town: string; street: string;
    phone: string; mail: string; age: string;
    shop: string; date: string; time: string;
    medium: string; question: string;
    campaign: string;
}

/**
 * カンマ区切りの宛先を、送ってよい形に直す。
 *
 * ⚠️⚠️ **改行は「削除」ではなく「区切り」として扱う。**
 *   ⚠️ 削除すると `ok@a.jp\r\nBcc: 悪い宛先` が `ok@a.jpBcc: 悪い宛先` という
 *     1つの不正な文字列になり、**正当な宛先まで丸ごと消える**
 *     （社内通知の Cc が届かなくなる）。
 *   ⚠️ 区切りに変えれば、正当な分は残り、注入された行だけが落ちる。
 */
export const safeAddressList = (value: string): string[] => {
    if (typeof value !== 'string' || value === '') return [];

    const normalized = value
        .split('')
        .map(ch => {
            const code = ch.codePointAt(0) ?? 0;
            // ⚠️ 制御文字（改行・タブを含む）をカンマにする
            return code < 32 || code === 127 ? ',' : ch;
        })
        .join('');

    const seen = new Set<string>();
    for (const one of normalized.split(',')) {
        const trimmed = one.trim();
        // ⚠️ 素朴な形の検査で十分。ここの目的はヘッダを壊させないことであって
        //   アドレスの実在確認ではない
        if (trimmed !== '' && /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(trimmed)) {
            seen.add(trimmed);
        }
    }

    // ⚠️ 宛先が増えすぎないよう上限を掛ける。通常は数件しかない
    return [...seen].slice(0, 20);
};

/**
 * 差し込みに渡す値を組み立てる。
 * ⚠️ `TemplateValues` に無い項目は差し込めない。⚠️ 通知先は**入れない**。
 */
const toValues = (
    a: FormAnswers,
    brandName: string,
    questionnaire: string,
    receivedAt: string
): TemplateValues => ({
    sei: a.sei, mei: a.mei, seiKana: a.seiKana, meiKana: a.meiKana,
    zip: a.zip, pref: a.pref, city: a.city, town: a.town, street: a.street,
    phone: a.phone, mail: a.mail, age: a.age,
    shop: a.shop, date: a.date, time: a.time,
    medium: a.medium, question: a.question,
    campaign: a.campaign,
    brandName, receivedAt, questionnaire,
});

// ---------------------------------------------------------------------------
// 顧客宛
// ---------------------------------------------------------------------------

interface ThanksInput {
    to: string;
    brandName: string;
    /** 事前アンケートのURL。⚠️ 空なら案内そのものを出さない */
    questionnaire: string;
    answers: FormAnswers;
    campaignId: string;
    /** ⚠️ form_table.thanks_subject。空なら既定 */
    subjectTemplate: string;
    /** ⚠️ form_table.thanks_body。空なら既定 */
    bodyTemplate: string;
}

export const sendCustomerThanks = async (input: ThanksInput): Promise<void> => {
    const to = safeAddressList(input.to);
    if (to.length === 0) {
        logger.warn('campaign_form: サンクスメールの宛先が不正です');
        return;
    }

    /**
     * ⚠️⚠️ **デイジャストハウスの会員登録だけ既定の本文が別。**
     *   ⚠️ ひな型が入っていれば**そちらが優先**される。
     *     特例が効くのは「未設定のまま」のときだけ。
     */
    const defaultBody = input.campaignId === MEMBER_CAMPAIGN_ID
        ? DEFAULT_MEMBER_BODY
        : DEFAULT_THANKS_BODY;

    const values = toValues(input.answers, input.brandName, input.questionnaire, '');

    const body = render(pick(input.bodyTemplate, defaultBody), values);
    const subject = render(pick(input.subjectTemplate, DEFAULT_THANKS_SUBJECT), values);

    const ok = await sendMail({
        to,
        // ⚠️ 件名はヘッダに入る。⚠️ ひな型はDBの値なので、必ずここで無害化する
        subject: sanitizeHeader(subject),
        text: body,
    });

    if (!ok) {
        // ⚠️ 反響は保存済み。送れなかったことだけ残す
        logger.warn(`campaign_form: サンクスメールを送れませんでした name="${input.answers.sei} ${input.answers.mei}"`);
    }
};

// ---------------------------------------------------------------------------
// 社内宛
// ---------------------------------------------------------------------------

interface NoticeInput {
    /** ⚠️ form_table.mail_to。リクエストの値ではない */
    to: string;
    /** ⚠️ form_table.mail_cc（khg のみ店舗別で上書き） */
    cc: string;
    brandName: string;
    answers: FormAnswers;
    receivedAt: string;
    /** ⚠️ form_table.internal_subject。空なら既定 */
    subjectTemplate: string;
    /** ⚠️ form_table.internal_body。空なら既定 */
    bodyTemplate: string;
}

export const sendInternalNotice = async (input: NoticeInput): Promise<void> => {
    const to = safeAddressList(input.to);
    const cc = safeAddressList(input.cc);

    if (to.length === 0) {
        // ⚠️ 通知先が無いフォームは実在する。⚠️ 反響は保存済みなのでエラーにはしない
        logger.warn(`campaign_form: 社内通知の宛先がありません campaign="${input.answers.campaign}"`);
        return;
    }

    const a = input.answers;
    const values = toValues(a, input.brandName, '', input.receivedAt);

    // ⚠️ ② はプレーンテキストで送る（mailer の方針）。① は HTML へ直す
    const body = render(pick(input.bodyTemplate, DEFAULT_INTERNAL_BODY), values);
    const subject = render(pick(input.subjectTemplate, DEFAULT_INTERNAL_SUBJECT), values);

    /**
     * ⚠️ Cc は `to` に足して送る。
     *   ⚠️ nodemailer は宛先を配列で受けるため、**ヘッダを自前で組み立てない**。
     *     移植元の事故（文字列連結でヘッダを作り、改行を注入された）は
     *     この作りでは起きない。
     */
    const ok = await sendMail({
        to: [...to, ...cc],
        // ⚠️ 件名はヘッダに入る。⚠️ ひな型はDBの値なので、必ずここで無害化する
        subject: sanitizeHeader(subject),
        text: body,
    });

    if (!ok) {
        // ⚠️ 社内が気づけないと反響が放置される。必ず残す
        logger.error(
            `campaign_form: 社内通知を送れませんでした campaign="${a.campaign}"`
            + ` name="${a.sei} ${a.mei}" mail="${a.mail}" phone="${a.phone}"`
        );
    }
};
