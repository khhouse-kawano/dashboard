/**
 * キャンペーンフォームのメール本文（ひな型）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`form_table` の列が空のときは、ここの既定文面を使う。**
 *   ⚠️ 移行時に既存340件へ本文を書き写していない。
 *     書き写すと、⚠️ **将来ひな型を直しても古い本文が全件に残り続ける**。
 *   ⚠️ したがって「空＝既定」は仕様である。空にする＝既定に戻す。
 *
 * ⚠️⚠️ **② はどちらもプレーンテキストで送る。**
 *   ⚠️ `utils/mailer.ts` が**プレーンテキスト専用**である
 *     （HTMLメールは迷惑メール判定が厳しくなるため使わない方針）。
 *   ⚠️ ① は社内通知を HTML で送っているが、**② の方針は変えない**。
 *     ⚠️ ひな型の書き方は同じ。① 側で `<br>` へ直す。
 *
 * ⚠️⚠️ **通知先アドレスを差し込む語は作らないこと。**
 *   ⚠️ 顧客宛の本文に社内の宛先を書けてしまう。
 * ─────────────────────────────────────────────
 */

/** 差し込みに使う値。⚠️ entry.ts / mail.ts が持っているものだけ */
export interface TemplateValues {
    sei: string;
    mei: string;
    seiKana: string;
    meiKana: string;
    zip: string; pref: string; city: string; town: string; street: string;
    phone: string; mail: string; age: string;
    shop: string; date: string; time: string;
    medium: string; question: string;
    campaign: string;
    brandName: string;
    receivedAt: string;
    /** 事前アンケートのURL。⚠️ 無いブランドは空 */
    questionnaire: string;
}

/** 未入力は行ごと書かない。⚠️ 空行だと項目が抜けたのか空なのか分からない */
const line = (label: string, value: string): string =>
    value.trim() === '' ? '' : `${label}：${value.trim()}\n`;

/**
 * 入力項目の一覧（`{{お問い合わせ内容}}` の中身）。
 *
 * ⚠️ 並びと文言は ① の PHP と同じにすること。
 *   ⚠️ 社内がこの順で目を通しているため、並べ替えると見落としが出る。
 */
export const detailBlock = (v: TemplateValues): string => {
    const address = v.zip.trim() === ''
        ? ''
        : `郵便番号：${v.zip}\n住所：${v.pref}${v.city}${v.town}${v.street}\n`;

    return line('来場希望場所', v.shop)
        + `お名前：${v.sei} ${v.mei}\n`
        + `お名前（カナ）：${v.seiKana} ${v.meiKana}\n`
        + line('来場希望日', v.date)
        + line('来場希望時間', v.time)
        + line('携帯番号', v.phone)
        + line('メールアドレス', v.mail)
        + line('年齢', v.age)
        + address
        + line('お問い合わせのきっかけ', v.medium)
        + line('その他ご質問・ご要望', v.question);
};

/**
 * 事前アンケートの案内（`{{事前アンケート}}` の中身）。
 *
 * ⚠️⚠️ **URL が空なら案内ごと出さない。**
 *   ⚠️ ① は日付か時間があれば見出しを必ず出しており、
 *     アンケートを持たないブランド（かえるホーム等）では
 *     **URL 無しで「▼事前アンケートでギフトカードプレゼント！」だけ**届いていた。
 */
const questionnaireBlock = (v: TemplateValues): string => {
    if (v.questionnaire === '') return '';
    if (v.date === '' && v.time === '') return '';
    return `\n▼事前アンケートでギフトカードプレゼント！\n\n${v.questionnaire}\n`;
};

// ---------------------------------------------------------------------------
// 差し込み
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **ここに無い語は差し込まない。**
 *   ⚠️ 画面（NewCampaign.tsx）の一覧と**必ず揃えること**。
 *     片方だけ増やすと「画面には出るが効かない語」ができる。
 */
export const PLACEHOLDERS = [
    'お名前', '姓', '名', 'お名前カナ',
    'お問い合わせ内容', 'キャンペーン名', 'ブランド名', '受付日時',
    '来場希望場所', '来場希望日', '来場希望時間',
    '携帯番号', 'メールアドレス', '年齢',
    '事前アンケート', '事前アンケートURL',
] as const;

/**
 * ひな型に値を差し込む。
 *
 * ⚠️⚠️ **知らない語はそのまま残す。**
 *   ⚠️ 黙って空にすると、打ち間違い（`{{お名前さま}}` 等）に
 *     **誰も気づけないまま顧客へ届く**。残っていれば次の送信前に直せる。
 *   ⚠️ 画面側でも保存前に警告している。
 */
export const render = (template: string, v: TemplateValues): string => {
    const table: Record<string, string> = {
        'お名前': `${v.sei} ${v.mei}`,
        '姓': v.sei,
        '名': v.mei,
        'お名前カナ': `${v.seiKana} ${v.meiKana}`,
        'お問い合わせ内容': detailBlock(v),
        'キャンペーン名': v.campaign,
        'ブランド名': v.brandName,
        '受付日時': v.receivedAt,
        '来場希望場所': v.shop,
        '来場希望日': v.date,
        '来場希望時間': v.time,
        '携帯番号': v.phone,
        'メールアドレス': v.mail,
        '年齢': v.age,
        '事前アンケート': questionnaireBlock(v),
        '事前アンケートURL': v.questionnaire,
    };

    return template.replace(
        /\{\{([^{}]{1,40})\}\}/g,
        (whole, key: string) => {
            const value = table[key.trim()];
            // ⚠️ 知らない語はそのまま返す（消さない）
            return value === undefined ? whole : value;
        }
    );
};

// ---------------------------------------------------------------------------
// 既定の文面
// ---------------------------------------------------------------------------

/** ⚠️ 件名はヘッダに入る。⚠️ 送る直前に sanitizeHeader を通すこと */
export const DEFAULT_THANKS_SUBJECT = '{{ブランド名}}/お問い合わせありがとうございます。';

export const DEFAULT_THANKS_BODY =
    '{{お名前}} 様\n'
    + 'お問い合わせを受け付けました。\n\n'
    + 'お問い合わせ内容は以下となります。\n\n'
    + '{{お問い合わせ内容}}'
    + '\nこちらのメールは配信用のため返信できません。\n'
    + 'ご意見・ご要望はご予約の店舗までお寄せください。\n\n'
    + '※お問い合わせいただいた日時が18:00以降または火曜日、水曜日の場合、'
    + '翌営業日以降のご連絡となりますのであらかじめご了承ください。\n'
    + '{{事前アンケート}}';

/**
 * ⚠️ デイジャストハウスの会員登録フォームだけ本文が別。
 *   ⚠️ ① にも同じ特例がある（campaign_id で判定）。
 *   ⚠️ **ひな型が空のときだけ**この既定を使う。
 *     画面で本文を入れれば、そちらが優先される。
 */
export const MEMBER_CAMPAIGN_ID = '20240000_djh_kyotsu_member';

export const DEFAULT_MEMBER_BODY =
    '{{お名前}} 様\n\n'
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
     * ⚠️⚠️ **① ではこの署名が本文に入っていない（2か所とも）。**
     *   `"...ください。\n\n";` で文が終わり、次の行の `"デイジャストハウス";` が
     *   **どこにも代入されない孤立した式**になっている。ここでは正しく連結する。
     */
    + 'デイジャストハウス';

export const DEFAULT_INTERNAL_SUBJECT = '{{ブランド名}}/{{キャンペーン名}}からの登録がありました。';

export const DEFAULT_INTERNAL_BODY =
    '{{キャンペーン名}}からの登録がありました。\n\n'
    + 'お問合わせ日時：{{受付日時}}\n\n'
    + '====================\nお客様情報\n====================\n'
    + '{{お問い合わせ内容}}'
    + '====================\n'
    + '※のちほどダッシュボードへ反映されます。\n';

/**
 * ひな型を選ぶ。⚠️ 空なら既定。
 *
 * ⚠️ 空白だけの入力も「空」として扱う。
 *   ⚠️ うっかり全消ししたときに**件名の無いメール**が飛ばないようにする。
 */
export const pick = (stored: string | null | undefined, fallback: string): string => {
    const value = (stored ?? '').trim();
    return value === '' ? fallback : (stored as string);
};
