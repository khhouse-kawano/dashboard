import { execute } from '../../db/pool';
import { logger } from '../../utils/logger';
import { sanitizeHeader, sendMail } from '../../utils/mailer';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';

/**
 * 見学クラウド（www.ie-miru.jp）の予約を inquiry_customer へ保存する。認証なし。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは見学クラウドの完了画面に置いた GTM のカスタム HTML
 *   （gtm_reserve_save.html で予約内容を localStorage に保存 → gtm_reserve_send.html が送信）。
 *   ⚠️ `sendBeacon` ／ fetch ／ XHR で **フォーム形式（x-www-form-urlencoded）** で届く。JSON でも受ける。
 * ⚠️ 移植元は ① `khg-marketing.info/api/kengakuCloud/all/`。保存する列・inquiry_id の形・社内通知は同じにした。
 *   ⚠️ ただし住所（full_address）は保存しない（住所の無い予約もあるため。移植元は building に入れていた）。社内通知には載せる。
 *   違うところ:
 *   - NOT NULL の列をすべて埋める（移植元は 13 列だけで、sql_mode が緩いから通っていた）
 *   - reserved_time・line_id・URL パラメータ・質問（remarks）も保存する
 *   - 保存に失敗したらメールを送らない（移植元は失敗しても送っていた）
 *   - inquiry_id の末尾にミリ秒（同じ秒に2件来ると inquiry_id が重なり、同期で別の反響まで同期済みになるため）
 * ─────────────────────────────────────────────
 */

export interface KengakuCloudResult {
    httpStatus: number;
    body: { status: 'success' | 'error'; message: string; id?: string };
}

/** 予約内容として受ける名前。⚠️ これ以外の英数字の名前は URL パラメータとして扱う（url_params が無いとき） */
const FORM_KEYS = new Set([
    'request', 'roll', 'name', 'kana', 'mail', 'mobile', 'full_address', 'brand', 'shop', 'campaign',
    'medium', 'reserved_date', 'reserved_time', 'age', 'line_id', 'message', 'benefit_agreement', 'url_params',
]);

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

/** 店舗 → 社内通知の Cc（移植元と同じ） */
const SHOP_CC: Record<string, string> = {
    'KH鹿児島店': 'hs_kh-kagoshima@kh-group.jp',
    'KH霧島店': 'hs_kh-kirishima@kh-group.jp',
    'KH姶良店': 'hs_kh-aira@kh-group.jp',
    'KH鹿屋店': 'hs_kh-kanoya@kh-group.jp',
    'KH薩摩川内店': 'hs_kh-sendai@kh-group.jp',
    'KH出水阿久根店': 'hs_kh-izumi-akune@kh-group.jp',
    'KH加世田店': 'hs_kh-kaseda@kh-group.jp',
    'KH八代店': 'hs_kh-yatsushiro@kh-group.jp',
    'KH熊本店': 'hs_kh-kumamoto@kh-group.jp',
    'KH都城店': 'hs_kh-miyakonojo@kh-group.jp',
    'KH宮崎店': 'hs_kh-miyazaki@kh-group.jp',
    'KH延岡店': 'hs_kh-nobeoka@kh-group.jp',
    'KH大分店': 'hs_kh-ooita@kh-group.jp',
    'KH佐賀店': 'hs_kh-saga@kh-group.jp',
    'KH久留米店': 'hs_kh-kurume@kh-group.jp',
    'DJH鹿児島北店': 'hs_djh-kagoshima-kita@kh-group.jp',
    'DJH霧島店': 'hs_djh-kirishima@kh-group.jp',
    'DJH鹿屋店': 'hs_kh-kanoya@kh-group.jp',
    'DJH薩摩川内店': 'hs_djh-kirishima@kh-group.jp',
    'DJH加世田店': 'hs_kh-kaseda@kh-group.jp',
    'DJH都城店': 'hs_djh-miyakonojo@kh-group.jp',
    'DJH宮崎店': 'hs_djh-miyazaki@kh-group.jp',
    'DJH延岡店': 'hs_kh-nobeoka@kh-group.jp',
};

const MAIL_TO = 'marketing@kh-group.jp';

/** ⚠️ サーバーの時刻帯に関係なく日本時間で作る（移植元も Asia/Tokyo） */
const jstParts = (d: Date): Record<'y' | 'mo' | 'd' | 'h' | 'mi' | 's', string> => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(d);
    const get = (type: string): string => parts.find(p => p.type === type)?.value ?? '';
    return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
};

const encodePair = (key: string, value: unknown): string =>
    `${encodeURIComponent(key)}=${encodeURIComponent(String(value ?? ''))}`;

/**
 * URL パラメータを `a=1&b=2` の形にそろえる（公開フォームの url_params と同じ形）。
 * - `url_params` があればそれを使う。⚠️ GTM は localStorage の JSON（`{"utm_source":"…"}`）のまま送ってくる。`a=1&b=2` の形でも受ける
 * - 無ければ、予約内容以外の英数字の名前を URL パラメータとみなす（GTM が予約内容と同じ階層に展開して送ってくる形）
 */
export const readUrlParams = (body: Record<string, unknown>): string => {
    const raw = typeof body.url_params === 'string' ? body.url_params.trim() : '';
    if (raw !== '') {
        if (raw.startsWith('{')) {
            try {
                const parsed: unknown = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return Object.entries(parsed as Record<string, unknown>)
                        .map(([k, v]) => encodePair(k, v)).join('&').slice(0, 2000);
                }
            } catch {
                logger.warn(`kengaku_cloud:entry: url_params を読めませんでした: ${raw.slice(0, 80)}`);
            }
        }
        return clean(raw.replace(/^\?/, ''), 2000);
    }
    return Object.entries(body)
        .filter(([k]) => !FORM_KEYS.has(k) && /^[A-Za-z0-9_.-]+$/.test(k))
        .map(([k, v]) => encodePair(k, v)).join('&').slice(0, 2000);
};

/** 予約日時の行（移植元のメールと同じ並び。空の項目は出さない） */
const line = (label: string, value: string): string => (value === '' ? '' : `${label}：${value}\n`);

export const runKengakuCloudEntry = async (
    raw: Record<string, unknown>
): Promise<KengakuCloudResult> => {
    const body = raw ?? {};
    const name = clean(body.name, 120);
    const kana = clean(body.kana, 120);
    const mail = clean(body.mail, 190);
    const mobile = clean(body.mobile, 30);

    // ⚠️ 移植元と同じ必須項目。⚠️ 応答も 200（GTM の XHR が 200 以外で警告を出すため、移植元に合わせる）
    if (name === '' || kana === '' || mail === '' || mobile === '') {
        logger.warn('kengaku_cloud:entry: 未入力項目があります');
        return { httpStatus: 200, body: { status: 'error', message: '未入力項目があります' } };
    }

    const address = clean(body.full_address, 300);
    const brand = clean(body.brand, 30);
    const shop = clean(body.shop, 80);
    const campaign = clean(body.campaign, 200);
    const medium = clean(body.medium, 120);
    const reservedDate = clean(body.reserved_date, 20);
    const reservedTime = clean(body.reserved_time, 20);
    const age = clean(body.age, 20);
    const lineId = clean(body.line_id, 200).replace(/\s+/g, '').slice(0, 100);
    const message = cleanMultiline(body.message, 2000);
    const urlParams = readUrlParams(body);
    const query = new URLSearchParams(urlParams);

    const now = new Date();
    const t = jstParts(now);
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const id = `kengakucloud_${t.y}${t.mo}${t.d}_${t.h}${t.mi}${t.s}_${ms}`;

    const values: Record<string, string | number | null> = {};
    for (const column of NOT_NULL_COLUMNS) values[column] = '';
    // ⚠️ 数値列。空文字だと INSERT ごと失敗する
    values.sync = 0;
    values.delete_flag = 0;

    values.inquiry_id = id;
    values.inquiry_date = `${t.y}/${t.mo}/${t.d}`;
    values.medium = 'ホームページ反響';
    values.response_medium = medium;
    // ⚠️ 移植元と同じく氏名・かなは分けずに first_name / first_name_kana
    values.first_name = name;
    values.first_name_kana = kana;
    values.mail = mail;
    values.mobile = mobile;
    values.brand = brand;
    values.shop = shop;
    values.hp_campaign = campaign;
    values.reserved_date = reservedDate;
    values.reserved_time = reservedTime;
    values.remarks = message;
    for (const key of UTM_KEYS) values[key] = clean(query.get(key), 200);
    values.line_id = lineId === '' ? null : lineId;
    /**
     * ⚠️ 見学クラウドで取れるのは「最後に見たパラメータ付きページ」の ? 以降だけ（GTM が localStorage に覚えたもの）。
     *   ⚠️ 公開フォームの url_params / landing_params どちらで探しても見つかるよう、両方に同じ値を入れる。
     */
    values.url_params = urlParams === '' ? null : urlParams;
    values.landing_params = values.url_params;

    const columns = [...(NOT_NULL_COLUMNS as unknown as string[]), 'line_id', 'url_params', 'landing_params'];

    try {
        await execute(
            `INSERT INTO inquiry_customer (${columns.join(', ')})`
            + ` VALUES (${columns.map(() => '?').join(', ')})`,
            columns.map(c => values[c])
        );
    } catch (error) {
        logger.error(`kengaku_cloud:entry: inquiry_customer への保存に失敗: ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データ追加に失敗しました。' } };
    }

    logger.info(`kengaku_cloud:entry を受け付けました id="${id}" brand="${brand}" shop="${shop}"`);

    // ---- 社内通知（移植元と同じ宛先・件名・本文。② の方針でプレーンテキスト） ----
    const cc = SHOP_CC[shop];
    const text = `${campaign}からの登録がありました。\n\n`
        + `お問合わせ日時：${t.y}/${t.mo}/${t.d} ${t.h}:${t.mi}:${t.s}\n\n`
        + '====================\nお客様情報\n====================\n'
        + line('来場希望場所', shop)
        + line('お名前', name)
        + line('お名前（カナ）', kana)
        + line('来場希望日', reservedDate)
        + line('来場希望時間', reservedTime)
        + line('携帯番号', mobile)
        + line('メールアドレス', mail)
        + line('LINE ID', lineId)
        + line('年齢', age)
        + line('住所', address)
        + line('お問い合わせのきっかけ', medium)
        + '====================\n※のちほどDashboardへ反映されます。\n';

    const ok = await sendMail({
        to: cc === undefined ? [MAIL_TO] : [MAIL_TO, cc],
        subject: sanitizeHeader(`${shop}/${campaign}からの登録がありました。`),
        text,
        // ⚠️ 移植元と同じく差出人の表示名は店舗名
        fromName: sanitizeHeader(shop),
    });
    if (!ok) {
        // ⚠️ 反響は保存済み。⚠️ 社内が気づけるよう必ず残す
        logger.error(`kengaku_cloud:entry: 社内通知を送れませんでした id="${id}" shop="${shop}"`);
    }

    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが正常に追加されました。`, id } };
};
