import { execute } from '../../db/pool';
import { logger } from '../../utils/logger';
import { sanitizeHeader, sendMail } from '../../utils/mailer';
import { NOT_NULL_COLUMNS, type EntryResult } from '../campaignForm/entry';
import { safeAddressList } from '../campaignForm/mail';
import { clean, cleanMultiline, dateOnly, dateTime, stamp } from '../campaignForm/text';

/**
 * オーナーズハウスの見学予約（kh-house.jp/owners_house/ の各オーナーズハウスのページ）。（v2.2.216）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送り元: react/owners_house の Owners.tsx（ブラウザから直接）。
 *   ⚠️ ② に届かないときは kh-house.jp/form/api/（Authorization: owners_house_reservation）経由で
 *     ① の handlers/owners_house_reservation.php へ送り直す。**同じ処理を PHP にも持っている。**
 *   ⚠️ ここを変えたら owners_house_reservation.php も同じように変えること。
 * ⚠️ 移植元: 消えた ① khg-marketing.info/api/（Authorization: registration, request: owners_house）。
 *   以前は Heroku の中継（polar-journey…/update）を経由していた。⚠️ 2026-09 上旬から止まっていた。
 * ⚠️ 移植元から直したところ:
 *   - 社内通知の Cc を**リクエストから受け取らない**（下の BRANDS の表から引く。移植元は画面が決めて送っていた）
 *   - ブランドの表記をそろえる（Nagomi → なごみ、PGH → PG HOUSE。移植元は送られた値のまま保存していた）
 *   - メールは文字だけ（移植元は入力値をそのまま HTML に入れていた）
 *   - url_params / landing_params・見学先・お問い合わせ内容を残す
 * ─────────────────────────────────────────────
 */

interface BrandSpec {
    /** inquiry_customer.brand */
    value: string;
    /** 店舗名の頭（例 KH延岡店） */
    prefix: string;
    /** メールの差出人名・件名 */
    name: string;
    /** 社内通知の Cc（⚠️ 移植元の Owners.tsx の表と同じ） */
    cc: string;
}

/** 画面が送る brand（オーナーズハウスの登録データの値）→ 仕様 */
const BRANDS: Record<string, BrandSpec> = {
    KH: { value: 'KH', prefix: 'KH', name: '国分ハウジング', cc: 'kh@kh-group.jp,lead@kh-group.jp,kh-t@kh-house.jp' },
    DJH: { value: 'DJH', prefix: 'DJH', name: 'デイジャストハウス', cc: 'info-djh@royalhome.co.jp,djh@kh-group.jp' },
    Nagomi: { value: 'なごみ', prefix: 'なごみ', name: 'なごみ工務店', cc: 'nagomi@kh-group.jp,nagomi@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com' },
    '2L': { value: '2L', prefix: '2L', name: 'ニーエルホーム', cc: '2lhome@kh-group.jp,2lhome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com' },
    FH: { value: 'FH', prefix: 'FH', name: 'フルコミホーム', cc: 'furukomihome@kh-group.jp,furukomihome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com' },
    PGH: { value: 'PG HOUSE', prefix: 'PGH', name: 'PG-HOUSE', cc: 'pghouse@kh-house.jp,koukoku@pure-growth.net,pghouse@pure-growth.net,pgh@kh-group.jp' },
    JH: { value: 'JH', prefix: 'JH', name: 'JUSFY HOME', cc: 'jh@kh-group.jp' },
};
const NOTICE_TO = 'mkt@kh-house.jp';
const CAMPAIGN_ID = '20250000_khg_owners_house';

/** 店舗名の頭のブランド名を略称にする（⚠️ 画面は国分ハウジング・デイジャストハウス・なごみ・ニーエルだけ直していた） */
const SHOP_PREFIX: Array<[RegExp, string]> = [
    [/^国分ハウジング/, 'KH'], [/^デイジャストハウス/, 'DJH'], [/^なごみ工務店/, 'なごみ'], [/^ニーエルホーム/, '2L'],
    [/^フルコミホーム/, 'FH'], [/^ジャスフィーホーム/, 'JH'], [/^(PG ?HOUSE|PGハウス)/i, 'PGH'],
];

const normalizeShop =(shop: string, spec: BrandSpec | null): string => {
    let value = shop;
    for (const [pattern, prefix] of SHOP_PREFIX) value = value.replace(pattern, prefix);
    if (value === '') return spec ? `${spec.prefix}店舗未設定` : 'ブランド・店舗未設定';
    return value;
};

export const runOwnersHouseReservation = async (raw: Record<string, unknown>): Promise<EntryResult> => {
    const body = raw ?? {};
    const a = {
        brand: clean(body.brand, 20),
        shop: clean(body.shop, 80),
        place: clean(body.place, 120),
        // ⚠️⚠️ 本文のキーは house_category（⚠️ `category` はゲートウェイの振り分けの鍵に入り、「ループ検知」502 になる）
        category: clean(body.house_category, 60),
        date: clean(body.date, 20),
        time: clean(body.time, 20),
        name: clean(body.name, 60),
        kana: clean(body.kana, 60),
        age: clean(body.age, 20),
        phone: clean(body.phone, 30),
        mail: clean(body.mail, 190),
        zip: clean(body.zip, 10),
        address: clean(body.address, 200),
        medium: clean(body.medium, 60),
        demand: cleanMultiline(body.demand, 2000),
        url: clean(body.url, 500),
        urlParams: clean(body.url_params, 2000),
        landingParams: clean(body.landing_params, 2000),
    };
    if (a.name === '' || (a.phone === '' && a.mail === '')) {
        return { httpStatus: 400, body: { status: 'error', message: '登録に失敗しました。' } };
    }

    const spec = BRANDS[a.brand] ?? null;
    if (!spec) logger.warn(`owners_house_reservation: 知らないブランドです brand="${a.brand}"`);
    const brandValue = spec?.value ?? 'KHG';
    const shopValue = normalizeShop(a.shop, spec);
    const campaign = `${spec?.prefix ?? 'KHG'}オーナーズハウス`;
    const now = new Date();
    const remarks = [
        a.place !== '' ? `見学希望：${a.place}${a.category !== '' ? `（${a.category}）` : ''}` : '',
        a.url !== '' ? `ページ：${a.url}` : '',
        a.demand !== '' ? `ご質問・ご要望：${a.demand}` : '',
    ].filter(Boolean).join('\n');

    // ---- 1. inquiry_customer ----
    const values: Record<string, string | number | null> = {};
    for (const column of NOT_NULL_COLUMNS) values[column] = '';
    values.sync = 0;
    values.delete_flag = 0;
    values.inquiry_id = `form${stamp(now)}_${CAMPAIGN_ID}`;
    values.inquiry_date = dateOnly(now);
    values.medium = 'ホームページ反響';
    values.response_medium = a.medium;
    values.brand = brandValue;
    values.shop = shopValue;
    values.first_name = a.name;
    values.first_name_kana = a.kana;
    values.mobile = a.phone;
    values.mail = a.mail;
    values.zip = a.zip;
    values.street = a.address;
    values.reserved_date = a.date;
    values.reserved_time = a.time;
    values.hp_campaign = campaign;
    values.remarks = remarks;
    values.url_params = a.urlParams === '' ? null : a.urlParams;
    values.landing_params = a.landingParams === '' ? null : a.landingParams;
    const columns = [...(NOT_NULL_COLUMNS as unknown as string[]), 'url_params', 'landing_params'];
    try {
        await execute(
            `INSERT INTO inquiry_customer (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
            columns.map(c => values[c])
        );
    } catch (error) {
        logger.error(`owners_house_reservation: inquiry_customer への保存に失敗 name="${a.name}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: '登録に失敗しました。' } };
    }
    logger.info(`owners_house_reservation を受け付けました brand="${brandValue}" shop="${shopValue}" place="${a.place}"`);

    // ---- 2. pgcloud（⚠️ 失敗しても反響は保存済み） ----
    // ⚠️⚠️ 全21列を埋める（campaign_form と同じ列）。⚠️ 移植元は15列だけで、「名」などに既定値が無いため STRICT では入らない
    try {
        await execute(
            'INSERT INTO pgcloud (タイムスタンプ, ブランド, 店舗, 姓, 名, セイ, メイ, 郵便番号,'
            + ' 都道府県, `市・区`, `町村・番地`, `ビル名・建物名`, ご予約のきっかけ, その他質問,'
            + ' 希望日, 希望時間, 携帯番号, メールアドレス, 年齢, キャンペーン名, キャンペーンID)'
            + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [dateTime(now), brandValue, a.shop, a.name, '', a.kana, '', a.zip,
                '', '', '', a.address, a.medium, a.demand,
                a.date, a.time, a.phone, a.mail, a.age, campaign, CAMPAIGN_ID]
        );
    } catch (error) {
        logger.error(`owners_house_reservation: pgcloud への保存に失敗: ${(error as Error).message}`);
    }

    // ---- 3. メール2通（⚠️ 保存が終わってから。⚠️ 2通は別々に送る） ----
    const brandName = spec?.name ?? '国分ハウジンググループ';
    const detail = [
        ['見学希望場所', a.place], ['お名前', a.name], ['お名前（カナ）', a.kana],
        ['来場希望日', a.date], ['来場希望時間', a.time], ['携帯番号', a.phone], ['メールアドレス', a.mail],
        ['年齢', a.age], ['郵便番号', a.zip], ['住所', a.address], ['お問い合わせのきっかけ', a.medium],
        ['その他ご質問・ご要望', a.demand],
    ].filter(([, v]) => v !== '').map(([k, v]) => `${k}：${v}`).join('\n');

    const customerTo = safeAddressList(a.mail);
    if (customerTo.length > 0) {
        const ok = await sendMail({
            to: customerTo,
            subject: sanitizeHeader(`${brandName}/お問い合わせありがとうございます。`),
            text: `${a.name} 様\nオーナーズハウス見学のお問い合わせを受け付けました。\n\nお問い合わせ内容は以下となります。\n\n${detail}\n\n`
                + 'こちらのメールは配信用のため返信できません。ご意見・ご要望はご予約の店舗までお寄せください。\n\n'
                + '※お問い合わせいただいた日時が18:00以降または火曜日、水曜日の場合、翌営業日以降のご連絡となりますのであらかじめご了承ください。\n',
            fromName: brandName,
        });
        if (!ok) logger.warn(`owners_house_reservation: お礼のメールを送れませんでした name="${a.name}"`);
    }

    const ok = await sendMail({
        to: [...safeAddressList(NOTICE_TO), ...safeAddressList(spec?.cc ?? '')],
        subject: sanitizeHeader(`${brandName}/オーナーズハウスからの登録がありました。`),
        text: `オーナーズハウス見学のお問い合わせを受け付けました。\n\nお問い合わせ日時：${dateTime(now)}\n\n${detail}\n`
            + (a.url !== '' ? `該当URL：${a.url}\n` : '')
            + '\n管理店舗・担当営業はお施主様との日程調整をお願いします。\n====================\n※のちほどダッシュボードへ反映されます。\n',
        fromName: brandName,
    });
    if (!ok) {
        logger.error(`owners_house_reservation: 社内通知を送れませんでした name="${a.name}" mail="${a.mail}" phone="${a.phone}"`);
    }

    return { httpStatus: 200, body: { status: 'success', message: 'オーナーズハウス見学の登録に成功しました。' } };
};
