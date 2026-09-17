import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { brandOf, formTableBrand, questionnaireFor } from './brands';
import { sendCustomerThanks, sendInternalNotice } from './mail';
import { clean, cleanMultiline, dateOnly, dateTime, stamp } from './text';

/**
 * キャンペーンフォームの公開受付。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **社外の誰でも叩ける書き込み口である。**
 *
 *   反響元: 各ブランドサイトの `/form/`（272件のフォームが同じバンドルを読む）
 *   経路:   フォーム → 各サイトの `form/api/index.php`（転送するだけ）→ ここ
 *
 *   ⚠️ したがって**リクエストの値を一切信用しない。**
 *
 * ⚠️⚠️ **通知先はリクエストから受け取らない。**
 *   ⚠️ 移植元は `mail_to` / `mail_cc` を**ブラウザから受け取って**
 *     メールヘッダへ入れていた。改行を仕込めば `Bcc:` を追加でき、
 *     **貴社ドメインから任意の宛先へ送信できた**（ヘッダインジェクション）。
 *   ⚠️ ここでは `form_table` から引く。**リクエストの値は無視する。**
 *
 * ⚠️⚠️ **`brand === 'khg'` のときの通知先に注意。**
 *   ⚠️ 移植元はフロント（Confirm.tsx）が**店舗ごとに mail_cc を上書き**していた。
 *     DB から引くだけに変えると、かえるホーム・PG HOUSE などの通知先が変わる。
 *   ⚠️ そのため `form_table.mail_cc` に店舗別の指定が無い場合に備えて、
 *     下の KHG_CC で補っている。**フロントの分岐をここへ移したもの。**
 * ─────────────────────────────────────────────
 */

/** PHP と同じ応答の形 */
export interface EntryResult {
    httpStatus: number;
    body: { status: 'success' | 'error'; message: string };
}

interface FormRow extends RowDataPacket {
    campaign: string;
    campaign_id: string;
    brand: string;
    mail_to: string;
    mail_cc: string;
    redirect: string;
    thanks: number;
    /** ⚠️ メール本文のひな型。⚠️ 空なら mailTemplate.ts の既定を使う */
    thanks_subject: string;
    thanks_body: string;
    internal_subject: string;
    internal_body: string;
}

/**
 * ⚠️ `brand === 'khg'` のときの店舗別 Cc。
 *   ⚠️ 元は `frontend` の Confirm.tsx にあった。**ブラウザに宛先を持たせない**ため移した。
 *   ⚠️ ここに無い店舗は form_table の mail_cc をそのまま使う。
 */
const KHG_CC: Record<string, string> = {
    '国分ハウジング': 'kh@kh-group.jp,lead@kh-group.jp,kh-t@kh-house.jp',
    'デイジャストハウス': 'info-djh@royalhome.co.jp,djh@kh-group.jp',
    'なごみ工務店': 'nagomi@kh-group.jp,nagomi@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com',
    'ニーエルホーム': '2lhome@kh-group.jp,2lhome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com',
    'フルコミホーム': 'furukomihome@kh-group.jp,furukomihome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com',
    'ジャスフィーホーム': 'jh@kh-group.jp',
    'PG HOUSE': 'pghouse@kh-house.jp,koukoku@pure-growth.net,pghouse@pure-growth.net,pgh@kh-group.jp',
    'かえるホーム': 'kaeru@kh-house.jp',
};

/**
 * ⚠️ `brand === 'khg'` のときの店舗別ブランドキー。同じく Confirm.tsx から移した。
 * ⚠️ **8店舗すべてを写すこと。** 抜けると、その店舗の反響だけ
 *   brand / shop が別物になり、一覧から消えたように見える。
 */
const KHG_BRAND: Record<string, string> = {
    '国分ハウジング': 'kh',
    'デイジャストハウス': 'djh',
    'なごみ工務店': 'なごみ',
    'ニーエルホーム': '2l',
    'フルコミホーム': 'fh',
    'ジャスフィーホーム': 'jh',
    'PG HOUSE': 'pg',
    'かえるホーム': 'khf',
};

/**
 * ⚠️⚠️ **`inquiry_customer` は既定値なしの NOT NULL が42列ある。**
 *   ⚠️ 1つでも欠けると INSERT がまるごと失敗し、反響が消える。
 *   ⚠️ 移植元は20列しか指定しておらず、**sql_mode が緩いから通っていた**だけである。
 *     STRICT なら全件失敗する。ここでは全部埋める。
 */
const NOT_NULL_COLUMNS = [
    'inquiry_id', 'pg_id', 'mhl_id', 'mhl_url', 'mhl_mail', 'inquiry_date',
    'medium', 'response_medium',
    'first_name', 'last_name', 'first_name_kana', 'last_name_kana',
    'mobile', 'landline', 'mail',
    'zip', 'pref', 'city', 'town', 'street', 'building',
    'brand', 'shop', 'sync', 'staff', 'area',
    'reserved_date', 'reserved_time', 'black_list', 'hp_campaign',
    'delete_flag', 'duplicate', 'note',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'referrer', 'first_visit', 'hotlead_url', 'remarks',
] as const;

/** 受け取った入力を、そのまま使う形にまとめたもの */
interface Answers {
    sei: string; mei: string; seiKana: string; meiKana: string;
    zip: string; pref: string; city: string; town: string; street: string;
    phone: string; mail: string; age: string;
    shop: string; date: string; time: string;
    medium: string; question: string;
    campaign: string; campaignId: string;
    url: string; source: string;
}

const readAnswers = (body: Record<string, unknown>): Answers => ({
    sei: clean(body.sei, 60),
    mei: clean(body.mei, 60),
    seiKana: clean(body.seiKana, 60),
    meiKana: clean(body.meiKana, 60),
    zip: clean(body.zip, 10),
    pref: clean(body.pref, 20),
    city: clean(body.city, 60),
    town: clean(body.town, 60),
    street: clean(body.street, 120),
    phone: clean(body.phone, 30),
    mail: clean(body.mail, 190),
    age: clean(body.age, 20),
    shop: clean(body.shop, 80),
    date: clean(body.date, 20),
    time: clean(body.time, 20),
    medium: clean(body.medium, 60),
    question: cleanMultiline(body.question, 2000),
    campaign: clean(body.campaign, 120),
    campaignId: clean(body.campaign_id, 120),
    url: clean(body.url, 500),
    source: clean(body.source, 200),
});

/**
 * 反響を受け付ける。
 *
 * ⚠️⚠️ **保存を確定させてからメールを送る。**
 *   逆にすると、メールサーバーが不調な間の反響が丸ごと消える。
 * ⚠️ メール2通は独立して送る。片方が失敗しても、もう片方は送る。
 */
export const runCampaignFormEntry = async (
    body: Record<string, unknown>
): Promise<EntryResult> => {
    const a = readAnswers(body);
    const rawBrand = clean(body.brand, 30);

    if (a.campaignId === '') {
        return { httpStatus: 400, body: { status: 'error', message: '登録に失敗しました。' } };
    }

    /**
     * ⚠️⚠️ **KHG 共通フォームからの送信かどうか。**
     *   ⚠️ 判定に `brand` は使えない。⚠️ 公開フォームが送信前に
     *     **選んだ店舗のブランドへ書き換えてしまう**ため、
     *     ここへ届く `brand` は `khg` ではなく `kh` などになっている。
     *   ⚠️ KHG 共通フォームの「来場希望場所」は**ブランド名そのもの**なので、
     *     それで判定できる。
     */
    const isKhgForm = KHG_BRAND[a.shop] !== undefined;

    // ---- 1. フォーム設定を引く ----
    // ⚠️⚠️ 通知先・サンクス送信の可否は**必ずここから**。リクエストの値は使わない
    const lookupBrand = formTableBrand(rawBrand, isKhgForm);

    const forms = await query<FormRow>(
        'SELECT campaign, campaign_id, brand, mail_to, mail_cc, redirect, thanks,'
        + ' thanks_subject, thanks_body, internal_subject, internal_body'
        + ' FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1',
        [lookupBrand, a.campaignId]
    );
    const form = forms[0];

    if (!form) {
        /**
         * ⚠️ 設定が無いフォームからの送信。⚠️ 反響は捨てず、通知だけ出せない形で進める。
         * ⚠️⚠️ **ここに落ちるとメールが1通も飛ばない。** 見かけ上は成功するので、
         *   ⚠️ 引いたキーも必ず残すこと（2026-09-16 に原因の特定へ丸1時間かかった）。
         */
        logger.warn(
            `campaign_form:entry: form_table に無い組み合わせです`
            + ` brand="${rawBrand}" 引いたキー="${lookupBrand}" campaign_id="${a.campaignId}"`
        );
    }

    // ---- 2. ブランドを解決する ----
    // ⚠️ khg のときは選ばれた店舗で実ブランドが決まる（元はフロントの分岐）
    const effectiveBrand = isKhgForm ? (KHG_BRAND[a.shop] ?? rawBrand) : rawBrand;
    const spec = brandOf(effectiveBrand);

    if (!spec) {
        // ⚠️ 移植元は brand を空文字で保存していた。同じ挙動にするが**必ず気づけるようにする**
        logger.warn(`campaign_form:entry: 知らないブランドです brand="${rawBrand}"`);
    }

    const now = new Date();
    const brandValue = spec?.value ?? '';

    /**
     * 保存する店舗名。
     *
     * ─────────────────────────────────────────────
     * ⚠️ PG HOUSE だけ接頭辞が 'PGH'。⚠️ brand の値をそのまま使わない。
     *
     * ⚠️⚠️ **来場希望場所が空でも、空文字では保存しない**（2026-09-16 の指示）。
     *
     *   ⚠️ 来場希望場所を**聞かない**フォームが実在する（89件）。
     *     ⚠️ そのとき公開フォームは空を送ってくるため、
     *       **反響一覧で店舗が空になり、営業が誰の担当か分からない。**
     *
     *   ⚠️⚠️ **移植前（① の PHP）は `brand_value . shop` と連結するだけで、
     *     空のときは `KH` のように接頭辞だけが入っていた。**
     *     ⚠️ 実データに `KH` 119件 / `2L` 61件 / `DJH` 44件 などが残っている。
     *     ⚠️ ② で `a.shop === '' ? ''` としたため、**それすら入らなくなっていた。**
     *
     *   ⚠️ ここでは接頭辞に「店舗未設定」を付ける。
     *     ⚠️ 指示書の対応表（KH店舗未設定 / PGH店舗未設定 …）と**一致する**。
     *
     * ⚠️⚠️ **新しい対応表を作らないこと。** ⚠️ `shopPrefix` をそのまま使う。
     *   ⚠️ ブランドの対応表は過去に4か所へ写されて中身が食い違った。
     *
     * ⚠️ ブランドも分からないときは `店舗未設定` だけになる。
     *   ⚠️ 空よりは一覧で見つけられるので、これでよい（利用者と確認済み）。
     * ─────────────────────────────────────────────
     */
    const UNSET_SHOP = '店舗未設定';
    const shopValue = `${spec?.shopPrefix ?? ''}${a.shop === '' ? UNSET_SHOP : a.shop}`;

    // ---- 3. inquiry_customer へ保存 ----
    const values: Record<string, string | number> = {};
    for (const column of NOT_NULL_COLUMNS) values[column] = '';

    /**
     * ⚠️⚠️ **`sync` と `delete_flag` は数値列（tinyint）である。**
     *   ⚠️ 他の列と同じく空文字を入れると
     *     `Incorrect integer value: '' for column 'sync'` で
     *     **INSERT がまるごと失敗し、反響が丸ごと消える。**
     *   ⚠️ 既定値も持たないので、必ずここで 0 を入れること。
     */
    values.sync = 0;
    values.delete_flag = 0;

    values.inquiry_id = `form${stamp(now)}_${a.campaignId}`;
    // ⚠️ `Y/m/d` に統一する。控えの PHP は `Y/m/dH:i:s`（スペース無し）で、形式が割れていた
    values.inquiry_date = dateOnly(now);
    values.medium = 'ホームページ反響';
    values.response_medium = a.medium;
    values.brand = brandValue;
    values.shop = shopValue;
    /**
     * ⚠️⚠️ **姓と名は「逆」で保存する。**
     *   first_name に姓（sei）、last_name に名（mei）を入れる。
     *   ⚠️ 移植元がそうなっており、**既存の18,098件すべてが同じ形**である。
     *   ⚠️ 直すと過去データと不整合になるため、意図的にこのままにしている。
     *     良かれと思って入れ替えないこと。
     */
    values.first_name = a.sei;
    values.last_name = a.mei;
    values.first_name_kana = a.seiKana;
    values.last_name_kana = a.meiKana;
    values.zip = a.zip;
    values.pref = a.pref;
    values.city = a.city;
    values.town = a.town;
    values.street = a.street;
    values.mobile = a.phone;
    values.mail = a.mail;
    values.reserved_date = a.date;
    values.reserved_time = a.time;
    values.hp_campaign = a.campaign;
    // ⚠️ 自由記述は remarks へ。note は社内の申し送りに使われているので触らない
    values.remarks = a.question;

    const columns = NOT_NULL_COLUMNS as unknown as string[];

    try {
        await execute(
            `INSERT INTO inquiry_customer (${columns.join(', ')})`
            + ` VALUES (${columns.map(() => '?').join(', ')})`,
            columns.map(c => values[c])
        );
    } catch (error) {
        // ⚠️ 例外の中身は応答に含めない（SQLや列名が漏れる）
        logger.error(
            `campaign_form:entry: inquiry_customer への保存に失敗 campaign_id="${a.campaignId}"`
            + ` mail="${a.mail}" phone="${a.phone}": ${(error as Error).message}`
        );
        return { httpStatus: 500, body: { status: 'error', message: '登録に失敗しました。' } };
    }

    logger.info(
        `campaign_form:entry を受け付けました campaign_id="${a.campaignId}"`
        + ` brand="${brandValue}" shop="${shopValue}" name="${a.sei} ${a.mei}"`
    );

    // ---- 4. pgcloud へも残す（移植元と同じ） ----
    // ⚠️ 列名が日本語。⚠️ 失敗しても反響は保存済みなので続行する
    try {
        await execute(
            'INSERT INTO pgcloud (タイムスタンプ, ブランド, 店舗, 姓, 名, セイ, メイ, 郵便番号,'
            + ' 都道府県, `市・区`, `町村・番地`, `ビル名・建物名`, ご予約のきっかけ, その他質問,'
            + ' 希望日, 希望時間, 携帯番号, メールアドレス, 年齢, キャンペーン名, キャンペーンID)'
            + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                dateTime(now), brandValue, a.shop, a.sei, a.mei, a.seiKana, a.meiKana, a.zip,
                a.pref, a.city, a.town, '', a.medium, a.question,
                a.date, a.time, a.phone, a.mail, a.age, a.campaign, a.campaignId,
            ]
        );
    } catch (error) {
        logger.error(`campaign_form:entry: pgcloud への保存に失敗: ${(error as Error).message}`);
    }

    // ---- 5. コンバージョンを記録する ----
    try {
        await execute(
            'INSERT INTO form_cv (time, brand, campaignName, campaignId, url, source) VALUES (?, ?, ?, ?, ?, ?)',
            [dateTime(now), rawBrand, a.campaign, a.campaignId, a.url, a.source]
        );
    } catch (error) {
        logger.error(`campaign_form:entry: form_cv への記録に失敗: ${(error as Error).message}`);
    }

    // ---- 6. メール2通（⚠️ 保存が終わってから） ----
    // ⚠️⚠️ thanks の可否も form_table から。リクエストの値は使わない
    if (form && Number(form.thanks) === 1 && a.mail !== '') {
        await sendCustomerThanks({
            to: a.mail,
            brandName: spec?.name ?? '',
            questionnaire: questionnaireFor(spec, a.shop),
            answers: a,
            campaignId: a.campaignId,
            subjectTemplate: form.thanks_subject ?? '',
            bodyTemplate: form.thanks_body ?? '',
        });
    }

    if (form) {
        // ⚠️ KHG 共通フォームのときだけ店舗別の Cc で上書きする（元はフロントの分岐）
        // ⚠️ rawBrand では判定できない（書き換えられている）。isKhgForm を使う
        const cc = isKhgForm ? (KHG_CC[a.shop] ?? form.mail_cc) : form.mail_cc;
        await sendInternalNotice({
            to: form.mail_to,
            cc,
            brandName: spec?.name ?? '',
            answers: a,
            receivedAt: dateTime(now),
            subjectTemplate: form.internal_subject ?? '',
            bodyTemplate: form.internal_body ?? '',
        });
    }

    return { httpStatus: 200, body: { status: 'success', message: `${a.campaign}の登録に成功しました。` } };
};

// ---------------------------------------------------------------------------
// 公開フォームの初期表示（form_get）
// ---------------------------------------------------------------------------

/**
 * フォームの設定を返し、表示を記録する。
 *
 * ⚠️⚠️ **`mail_to` / `mail_cc` を返してはいけない。**
 *   ⚠️ 移植元は `SELECT *` で**通知先アドレスをブラウザへ返していた**。
 *     フォームのソースを見れば誰でも読める状態だった。
 *   ⚠️ 表示に必要な列だけを返す。
 */
export const runCampaignFormPublic = async (
    body: Record<string, unknown>
): Promise<{ status: 'success' | 'empty'; data: unknown }> => {
    const brand = clean(body.brand, 30);
    const campaignId = clean(body.campaign_id, 120);

    const rows = await query<RowDataPacket>(
        'SELECT campaign, campaign_id, brand, url, tag, redirect, thanks, notice,'
        + ' name, kana, age, phone, mail, address, question, shop, date, medium, attention'
        + ' FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1',
        [brand, campaignId]
    );

    // ⚠️ 表示の記録。⚠️ 失敗しても画面は出す（ログのために反響機会を潰さない）
    try {
        await execute(
            'INSERT INTO form_show (time, brand, campaign, url, source, campaign_name) VALUES (?, ?, ?, ?, ?, ?)',
            [
                dateTime(new Date()), brand, campaignId,
                clean(body.url, 500), clean(body.source, 200), clean(body.campaign, 120),
            ]
        );
    } catch (error) {
        logger.error(`campaign_form:public: form_show への記録に失敗: ${(error as Error).message}`);
    }

    return { status: rows.length > 0 ? 'success' : 'empty', data: rows[0] ?? null };
};
