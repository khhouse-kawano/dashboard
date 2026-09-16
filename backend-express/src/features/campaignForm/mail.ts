import { logger } from '../../utils/logger';
import { sanitizeHeader, sendMail } from '../../utils/mailer';

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

/** 未入力は書かない。⚠️ 空行だと項目が抜けたのか空なのか分からない */
const line = (label: string, value: string): string =>
    value.trim() === '' ? '' : `${label}：${value.trim()}\n`;

const address = (a: FormAnswers): string => {
    if (a.zip.trim() === '') return '';
    return `郵便番号：${a.zip}\n住所：${a.pref}${a.city}${a.town}${a.street}\n`;
};

const detail = (a: FormAnswers): string =>
    line('来場希望場所', a.shop)
    + `お名前：${a.sei} ${a.mei}\n`
    + `お名前（カナ）：${a.seiKana} ${a.meiKana}\n`
    + line('来場希望日', a.date)
    + line('来場希望時間', a.time)
    + line('携帯番号', a.phone)
    + line('メールアドレス', a.mail)
    + line('年齢', a.age)
    + address(a)
    + line('お問い合わせのきっかけ', a.medium)
    + line('その他ご質問・ご要望', a.question);

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
}

/**
 * ⚠️ デイジャストハウスの会員登録フォームだけ本文が別。
 *   移植元に同じ特例がある（campaign_id で判定している）。
 */
const MEMBER_CAMPAIGN_ID = '20240000_djh_kyotsu_member';

const memberBody = (a: FormAnswers): string =>
    `${a.sei} ${a.mei} 様\n\n`
    + 'お世話になっております。\nデイジャストハウスです。\n\n'
    + 'この度は、会員登録にお申込みいただき、誠にありがとうございます。\n登録が無事完了いたしました。\n\n'
    + '限定コンテンツログイン情報をお送りいたします。\n大切に保管をお願いいたします。\n\n'
    + '───────────────────────────────\n'
    + '●会員限定公開プラン　ログイン情報\n'
    + '───────────────────────────────\n\n'
    + 'ユーザー名：dayjust\n'
    + 'パスワード：plan\n\n'
    + '厳選プランページURL：\nhttps://day-just-house.com/plan/\n\n'
    + '上記ご案内したログイン情報より弊社ホームページの会員限定公開プランの閲覧が可能です。\n\n'
    + 'デイジャストハウスではお客様との出会いを大切に誠実に丁寧に対応させていただきます。\n'
    + 'なんでもお気軽にご相談・お問い合わせください。\n\n'
    /**
     * ⚠️⚠️ **移植元ではこの署名が本文に入っていなかった。**
     *   `"...ください。\n\n";` で文が終わり、次の行の `"デイジャストハウス";` が
     *   **どこにも代入されない孤立した式**になっていた。ここでは正しく連結している。
     */
    + 'デイジャストハウス';

const thanksBody = (input: ThanksInput): string => {
    const a = input.answers;

    return `${a.sei} ${a.mei} 様\n`
        + 'お問い合わせを受け付けました。\n\n'
        + 'お問い合わせ内容は以下となります。\n\n'
        + detail(a)
        + '\nこちらのメールは配信用のため返信できません。\n'
        + 'ご意見・ご要望はご予約の店舗までお寄せください。\n\n'
        + '※お問い合わせいただいた日時が18:00以降または火曜日、水曜日の場合、'
        + '翌営業日以降のご連絡となりますのであらかじめご了承ください。\n'
        /**
         * ⚠️⚠️ **URL が空なら案内ごと出さない。**
         *   ⚠️ 移植元の `form_register` は日付か時間があれば必ず出しており、
         *     アンケートを持たないブランド（かえるホーム等）では
         *     **URL 無しで「▼事前アンケートでギフトカードプレゼント！」だけ**届いていた。
         */
        + ((a.date !== '' || a.time !== '') && input.questionnaire !== ''
            ? `\n▼事前アンケートでギフトカードプレゼント！\n\n${input.questionnaire}\n`
            : '');
};

export const sendCustomerThanks = async (input: ThanksInput): Promise<void> => {
    const to = safeAddressList(input.to);
    if (to.length === 0) {
        logger.warn('campaign_form: サンクスメールの宛先が不正です');
        return;
    }

    const body = input.campaignId === MEMBER_CAMPAIGN_ID
        ? memberBody(input.answers)
        : thanksBody(input);

    const ok = await sendMail({
        to,
        subject: sanitizeHeader(`${input.brandName}/お問い合わせありがとうございます。`),
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
    const body = `${a.campaign}からの登録がありました。\n\n`
        + `お問合わせ日時：${input.receivedAt}\n\n`
        + '====================\nお客様情報\n====================\n'
        + detail(a)
        + '====================\n'
        + '※のちほどダッシュボードへ反映されます。\n';

    /**
     * ⚠️ Cc は `to` に足して送る。
     *   ⚠️ nodemailer は宛先を配列で受けるため、**ヘッダを自前で組み立てない**。
     *     移植元の事故（文字列連結でヘッダを作り、改行を注入された）は
     *     この作りでは起きない。
     */
    const ok = await sendMail({
        to: [...to, ...cc],
        subject: sanitizeHeader(`${input.brandName}/${a.campaign}からの登録がありました。`),
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
