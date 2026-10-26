# 簡単見積もり（2L・JH）・オーナーズハウスの見学予約の受け口と URL パラメータ（v2.2.216）

## 依頼
- A：ダウンロードの mitsumori を参考に、各見積もりサイトに url_params・landing_params をフォームで送る機能を足し、受け取りを ② と ① の handlers に作る
- B：react/owners_house を改修して url_params・landing_params を送る機能を足し、受け取りを ② と ① の handlers に作る
- C（オーナーズハウス募集の取り込みの重複対策）は不要（もう使わない）
- 見積もりサイトの見た目は今後相談。今回は送信と受け取りだけ
- 改修したフロントはダウンロードフォルダに置く

## 分かったこと
- 3つとも Heroku の中継（projects/hub の `/update`。polar-journey…）→ 消えた ① khg-marketing.info/api/（`Authorization: registration`、`request: homepage` / `owners_house`）へ送っていた
  - 2L：2lhome.net/mitsumori/result_api.php（サーバー）から。⚠️ khg-marketing.info/confirm/ は「見積もりからの来場予約」（別の古い仕組み）
  - JH：react/estimate をビルドしたもの（Downloads/mitsumori/jh。/estimate/ に置く）。react/proposal は estimate の写し（Result.tsx は同じ中身）
  - オーナーズハウス：react/owners_house の Owners.tsx
- DB では 2L 簡単見積もり 9/07、JH 9/04 を最後に止まっていた
- 2L の index.html に外部サービス（HotLead）の api_key の行がある → ⚠️ CLAUDE.md に従い index.html は書き換えず、params.js を別に作った（利用者が `<script>` を1行足す）

## 作ったもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/estimate/ | **entry.ts**（新規） | `runEstimateEntry`：見積もりの3キャンペーンだけ受け、`runCampaignFormEntry`（公開フォームの受付）をそのまま呼ぶ |
| backend-express/src/features/ownersHouse/ | **reservation.ts**（新規） | `runOwnersHouseReservation`：inquiry_customer（url_params・landing_params）・pgcloud（21列）・メール2通 |
| backend-express/src/gateway/ | registry.ts | `estimate_entry`・`owners_house_reservation`（auth none） |
| backend-express/src/middlewares/ | publicFormRateLimit.ts | 2つを回数制限（同じ IP から10分に5回）の対象に |
| backend/src/core/ | express_proxy.php | 許可リストに2つ（⚠️ Exclusive には入れない。① の予備を動かすため） |
| backend/src/handlers/ | **estimate_entry.php**（新規） | ① の予備。3キャンペーンを確かめて `campaign_form.php`（roll: entry）を使う |
| backend/src/handlers/ | **owners_house_reservation.php**（新規） | ① の予備。② と同じ処理＋「② が10分以内に保存した同じ人」は飛ばす |
| backend/scripts/brand_form_api/ | index.php | 8サイトの中継に `estimate_entry`・`owners_house_reservation` の読み替えを足した（`$routes`） |
| backend/scripts/estimate_2l/ | **result_api.php・params.js**（新規） | 2L の送信先（② → 届かなければ ① へ直接）と、URL パラメータを送る JS |
| backend/scripts/sql/ | **2026-10-23_update_log_2.2.216.sql** | update_log（ローカル no=316） |
| frontend/src/utils/ | version.ts | 2.2.216 |
| （リポジトリ外）react/estimate・react/proposal・react/owners_house | src/api/entry.ts（新規）・main.tsx・Content.tsx・Result.tsx・Owners.tsx | 送り先の付け替え・URL パラメータ。⚠️ 3つとも git 管理外。改修前のソースは作業用フォルダに控えた |
| Downloads/upload_v2.2.216/ | 2l_mitsumori・jh_estimate・owners_house・form_api・README.txt | アップロード用（ビルド済み） |

### 決めごと
- **送り先**：ブラウザ（JH・オーナーズハウス）→ ② `api.khg-marketing.info`。届かなければ同じサイトの `/form/api/`（Authorization: request 名）→ ①。2L はサーバーから ② → 届かなければ ① へ直接
- **url_params**：送ったページの `?` 以降。**landing_params**：最後に開いたパラメータ付きページの `?` 以降（localStorage）。form_get の pageParams.ts と同じ考え方
- 見積もりの受け口は公開フォームの受付と同じ処理（通知先・お礼の可否は form_table から。画面から送っていた mail_to / mail_cc / thanks は使わない・送らない）。⚠️ 受けるのは `2l:20250000_2l_mitsumori`・`jh:20250000_jhkyotsu_estimate`・`jh:20250000_jhkyotsu_reserveestimate` だけ
- 見学予約：
  - 社内通知の Cc は**コードの表**（ブランド別。以前は画面が組み立てて送っていた。画面からは外した）
  - ブランドの表記をそろえる（Nagomi → なごみ、PGH → PG HOUSE）。店舗名の頭（国分ハウジング・デイジャストハウス・なごみ工務店・ニーエルホーム・フルコミホーム・ジャスフィーホーム・PG HOUSE）を略称に。空なら「◯◯店舗未設定」
  - 備考に見学先（名前・平屋など）・ページの URL・ご質問
  - ⚠️⚠️ **画面からは `category` を `house_category` という名前で送る。** `category` はゲートウェイの振り分けの鍵に入り、② が「ループ検知」502 を返した（テストで発見）
  - ⚠️ pgcloud は**21列すべて**を埋める。以前の15列では「名」に既定値が無く、保存できなかった（テストで発見）

## 確かめたこと
1. **① 経由で ②**：見積もり（キャンペーンなし・対象外 → 400、JH・2L → 保存）、見学予約（連絡先なし → 400、なごみ・PGH・知らないブランド → 保存。ブランド・店舗の表記、url_params・landing_params・備考を DB で確認）。6回目は回数制限で 429
2. **② を止めて ① の PHP**：見積もり・見学予約とも保存（inquiry_id が homepage で始まる）
   - ⚠️ 「② が10分以内に保存した同じ人を飛ばす」は、ローカルの ② が UTC で動いているため効かなかった（本番の ② は TZ=Asia/Tokyo。v2.2.213 で日本時間の行を使って確認済み）
3. **① のメール**（組み込みサーバーでファイルに書き出し）：見学予約のお礼（お客様宛）と社内通知（To mkt@kh-house.jp・info-djh@…・djh@…）。リクエストの mail_to / mail_cc は使われない
4. **画面**（Playwright。ビルドしたものを PHP 8.0 で配信し、② への送信をローカルの ① へ向け直した）
   - JH 簡単見積もり：6段階を選んで送信 → 結果ページへ。`request: estimate_entry`・landing_params あり・mail_cc を送っていない。② を切ると同じサイトの /form/api/ へ `Authorization: estimate_entry` で送り直して成功
   - 見学予約：入力 → 確認 → 予約 → 完了の表示。`house_category`・url_params・landing_params あり、`category`・mail_cc なし。② を切ったときも /form/api/ 経由で成功
   - 2L（キーの入った index.html は使わず、最小のテストページ＋params.js）：送信 → 結果ページへ移る。url_params / landing_params が DB に入る。② を止めると ① へ送り直して保存
5. 回帰：member_entry・kagosuma_entry・tochishinchaku_entry・myhomes_entry・owners_house_application_list は ① 経由で 401、campaign_form:public は 200
6. `tsc --noEmit`（②）OK、`php -l`（8.2・8.0）OK、`node --check params.js` OK、estimate・owners_house のビルド OK
   - ⚠️ react/proposal は**改修前から**ビルドできない（Content.tsx の画像が無い・使っていない変数）。ソースは直したがビルドしていない
7. 後片付け：テストの行（inquiry_customer 23・pgcloud 19・form_cv 13）を削除、テスト用のサーバーを止めた

## 残りの作業
- デプロイ（deploy-v2.2.216.md）。⚠️ 2L の index.html に `<script src="./params.js"></script>` を足す
- 見積もりサイトの見た目（今後相談）
- Heroku の中継（projects/hub）を止めるかどうか

## コード

### backend-express/src/features/estimate/entry.ts（新規）
```ts
import { logger } from '../../utils/logger';
import { runCampaignFormEntry, type EntryResult } from '../campaignForm/entry';
import { clean } from '../campaignForm/text';

/**
 * 簡単見積もり（2L・JH）の反響受付。（v2.2.216）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送り元:
 *   - 2L … 2lhome.net/mitsumori/result_api.php（サーバー）
 *   - JH … 簡単見積もりの画面（react/estimate。proposal も同じ）
 *   ⚠️ 以前は Heroku の中継（polar-journey…/update）→ ① khg-marketing.info/api/（Authorization: registration,
 *     request: homepage）へ送っていた。⚠️ その php が誤って消え、2026-09 上旬から反響が入っていなかった。
 * ⚠️ 中身は公開フォームの受付（campaign_form:entry）と同じ。⚠️ そのまま呼ぶ:
 *   inquiry_customer（url_params・landing_params も）・pgcloud・form_cv・メール2通（通知先・お礼の可否は form_table から）
 * ⚠️⚠️ **受け付けるのは下の3キャンペーンだけ。**（ほかのキャンペーンは campaign_form を使う）
 *   ⚠️ 2L の「簡単見積もりからの来場予約」（20250000_2l_mitsumori_reserve）は別の古い仕組み（khg-marketing.info/confirm/）から
 *     送っており、ここへは来ない。⚠️ ここへ送るように変えたら下に足すこと
 * ⚠️ ② に届かないとき、送り元は ① の handlers/estimate_entry.php へ送り直す（① の campaign_form.php を使う。同じ処理）。
 * ─────────────────────────────────────────────
 */

/** brand（form_table のキー）＋ campaign_id。⚠️ ① の estimate_entry.php と同じにすること */
const ESTIMATE_CAMPAIGNS = new Set([
    '2l:20250000_2l_mitsumori',
    'jh:20250000_jhkyotsu_estimate',
    'jh:20250000_jhkyotsu_reserveestimate',
]);

export const runEstimateEntry = async (body: Record<string, unknown>): Promise<EntryResult> => {
    const brand = clean(body.brand, 30);
    const campaignId = clean(body.campaign_id, 120);
    if (!ESTIMATE_CAMPAIGNS.has(`${brand}:${campaignId}`)) {
        logger.warn(`estimate_entry: 見積もりのキャンペーンではありません brand="${brand}" campaign_id="${campaignId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '登録に失敗しました。' } };
    }
    return runCampaignFormEntry(body);
};
```

### backend-express/src/features/ownersHouse/reservation.ts（新規）
```ts
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
```

### backend-express/src/gateway/registry.ts（追加分）
```ts
import { runOwnersHouseReservation } from '../features/ownersHouse/reservation';
import { runEstimateEntry } from '../features/estimate/entry';

/**
 * ⚠️⚠️ **簡単見積もり（2L・JH）の反響受付。認証なしの書き込み口である。**（v2.2.216）
 *   ⚠️ 中身は campaign_form:entry（見積もりの3キャンペーンだけ受ける）。⚠️ publicFormRateLimit の対象。
 *   ⚠️ ② に届かないとき送り元は ① の handlers/estimate_entry.php へ送り直す（① の campaign_form.php を使う）。
 */
register({
  request: 'estimate_entry',
  summary: '【書き込み・認証なし】簡単見積もり（2L・JH）の反響受付（inquiry_customer）',
  phpSource: 'khg-marketing.info/api/（Authorization: registration, request: homepage。消えた）→ handlers/estimate_entry.php',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runEstimateEntry(ctx.body as Record<string, unknown>);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * ⚠️⚠️ **オーナーズハウスの見学予約。認証なしの書き込み口である。**（v2.2.216）
 *   ⚠️ publicFormRateLimit の対象。⚠️ 社内通知の宛先はコードの表から（リクエストの値は使わない）。
 *   ⚠️ ② に届かないとき送り元は ① の handlers/owners_house_reservation.php へ送り直す（同じ処理）。
 */
register({
  request: 'owners_house_reservation',
  summary: '【書き込み・認証なし】オーナーズハウスの見学予約（inquiry_customer）',
  phpSource: 'khg-marketing.info/api/（Authorization: registration, request: owners_house。消えた）→ handlers/owners_house_reservation.php',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runOwnersHouseReservation(ctx.body as Record<string, unknown>);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});
```

### backend-express/src/middlewares/publicFormRateLimit.ts（追加分）
```ts
    // ⚠️ v2.2.216 簡単見積もり（2L・JH）・オーナーズハウスの見学予約の受付。認証なしの書き込み口
    //   ⚠️ 2L は 2lhome.net の result_api.php（サーバー）から届くので、2L のお客様全員が同じ IP になる（件数は月に十件ほど）
    'estimate_entry',
    'owners_house_reservation',
```

### backend/src/core/express_proxy.php（expressProxyRequests() に追加）
```php
        // ⚠️ v2.2.216。簡単見積もり（2L・JH）・オーナーズハウスの見学予約。⚠️ member_entry と同じ理由で例外として入れる
        //   ⚠️ ① の予備は handlers/estimate_entry.php・owners_house_reservation.php。
        //   ⚠️ 見積もりは campaign_form と同じく、② が保存した直後に応答が失われて ① が動くと二重になりうる
        //     （① の campaign_form.php が「② が10分以内に保存した同じ人」を飛ばすので、見積もりは防げる）
        'estimate_entry',
        'owners_house_reservation',
```

### backend/src/handlers/estimate_entry.php（新規）
```php
<?php

/**
 * 簡単見積もり（2L・JH）の反響受付。（v2.2.216）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/estimate/entry.ts の予備である。** ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 * ⚠️ 中身は公開フォームの受付と同じなので、v2.2.213 の handlers/campaign_form.php（roll: entry）をそのまま使う。
 *   （inquiry_customer・pgcloud・form_cv・メール2通。② が10分以内に保存した同じ人は飛ばす）
 * ⚠️⚠️ **受け付けるのは見積もりの3キャンペーンだけ。** ⚠️ ② の ESTIMATE_CAMPAIGNS と同じにすること。
 * ─────────────────────────────────────────────
 */

$estimateCampaigns = [
    '2l:20250000_2l_mitsumori',
    'jh:20250000_jhkyotsu_estimate',
    'jh:20250000_jhkyotsu_reserveestimate',
];

$estimateKey = trim((string)($data['brand'] ?? '')) . ':' . trim((string)($data['campaign_id'] ?? ''));
if (!is_array($data) || !in_array($estimateKey, $estimateCampaigns, true)) {
    error_log("estimate_entry: 見積もりのキャンペーンではありません key=\"{$estimateKey}\"");
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => '登録に失敗しました。'], JSON_UNESCAPED_UNICODE);
    exit;
}

// ⚠️ campaign_form.php は $data['roll'] で振り分ける。⚠️ 見積もりは必ず entry（送られた roll は使わない）
$data['roll'] = 'entry';
require __DIR__ . '/campaign_form.php';
```

### backend/src/handlers/owners_house_reservation.php（新規）
```php
<?php

/**
 * オーナーズハウスの見学予約。（v2.2.216）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/ownersHouse/reservation.ts の予備である。同じ処理を持つ。**
 *   ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 *   ⚠️ 動くのは ② に届かなかったとき（画面が kh-house.jp/form/api/ 経由で送り直したとき・① からの転送が失敗したとき）。
 *   ⚠️ ここを変えたら reservation.ts も同じように変えること。
 * ⚠️ 社内通知の Cc はコードの表から（リクエストの値は使わない）。メールは文字だけ。
 * ⚠️ ② が保存した直後に応答が失われて ① へ回ったとき、二重に保存しない（同じキャンペーン・同じメールか電話で、② が10分以内に保存していれば飛ばす）。
 * ⚠️ 全体で1分に30件まで（kh-house.jp/form/api/ を経由するので、お客様の IP は見えない）
 * ─────────────────────────────────────────────
 */

date_default_timezone_set('Asia/Tokyo');

const OHR_NOTICE_TO = 'mkt@kh-house.jp';
const OHR_CAMPAIGN_ID = '20250000_khg_owners_house';
const OHR_MAIL_FROM = 'pgcloud@khg-marketing.info';

function ohrRespond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** 制御文字を空白にし、連続する空白を1つにして長さで切る（② の clean と同じ） */
function ohrClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 改行だけ残す（② の cleanMultiline と同じ） */
function ohrCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

/** カンマ区切りの宛先を、送ってよい形に直す（② の safeAddressList と同じ） */
function ohrAddresses(string $value): array
{
    $value = preg_replace('/[\x00-\x1F\x7F]/', ',', $value) ?? '';
    $seen = [];
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && preg_match('/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/', $one)) {
            $seen[$one] = true;
        }
    }
    return array_slice(array_keys($seen), 0, 20);
}

function ohrSendMail(array $to, string $subject, string $body, string $fromName): bool
{
    if (!$to) {
        return false;
    }
    mb_language('uni');
    mb_internal_encoding('UTF-8');
    $headers = 'From: ' . mb_encode_mimeheader($fromName, 'UTF-8') . ' <' . OHR_MAIL_FROM . '>';
    return mb_send_mail(implode(',', $to), preg_replace('/[\x00-\x1F\x7F]/', ' ', $subject) ?? '', $body, $headers);
}

function ohrRateLimited(): bool
{
    $fp = @fopen(sys_get_temp_dir() . '/owners_house_reservation_rate.json', 'c+');
    if ($fp === false) {
        return false;
    }
    flock($fp, LOCK_EX);
    $times = json_decode((string)stream_get_contents($fp), true);
    $now = time();
    $times = array_values(array_filter(is_array($times) ? $times : [], function ($t) use ($now) {
        return $now - (int)$t < 60;
    }));
    $limited = count($times) >= 30;
    if (!$limited) {
        $times[] = $now;
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($times));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $limited;
}

/** 画面が送る brand → [inquiry_customer.brand, 店舗の頭, ブランド名, 社内通知の Cc]（② の BRANDS と同じ） */
$ohrBrands = [
    'KH' => ['KH', 'KH', '国分ハウジング', 'kh@kh-group.jp,lead@kh-group.jp,kh-t@kh-house.jp'],
    'DJH' => ['DJH', 'DJH', 'デイジャストハウス', 'info-djh@royalhome.co.jp,djh@kh-group.jp'],
    'Nagomi' => ['なごみ', 'なごみ', 'なごみ工務店', 'nagomi@kh-group.jp,nagomi@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com'],
    '2L' => ['2L', '2L', 'ニーエルホーム', '2lhome@kh-group.jp,2lhome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com'],
    'FH' => ['FH', 'FH', 'フルコミホーム', 'furukomihome@kh-group.jp,furukomihome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com'],
    'PGH' => ['PG HOUSE', 'PGH', 'PG-HOUSE', 'pghouse@kh-house.jp,koukoku@pure-growth.net,pghouse@pure-growth.net,pgh@kh-group.jp'],
    'JH' => ['JH', 'JH', 'JUSFY HOME', 'jh@kh-group.jp'],
];

if (ohrRateLimited()) {
    error_log('owners_house_reservation: 送信が多すぎるため断りました');
    ohrRespond(429, ['status' => 'error', 'message' => '登録に失敗しました。']);
}

$a = [
    'brand' => ohrClean($data['brand'] ?? '', 20),
    'shop' => ohrClean($data['shop'] ?? '', 80),
    'place' => ohrClean($data['place'] ?? '', 120),
    // ⚠️⚠️ 本文のキーは house_category（⚠️ `category` はゲートウェイの振り分けの鍵に入る）
    'category' => ohrClean($data['house_category'] ?? '', 60),
    'date' => ohrClean($data['date'] ?? '', 20),
    'time' => ohrClean($data['time'] ?? '', 20),
    'name' => ohrClean($data['name'] ?? '', 60),
    'kana' => ohrClean($data['kana'] ?? '', 60),
    'age' => ohrClean($data['age'] ?? '', 20),
    'phone' => ohrClean($data['phone'] ?? '', 30),
    'mail' => ohrClean($data['mail'] ?? '', 190),
    'zip' => ohrClean($data['zip'] ?? '', 10),
    'address' => ohrClean($data['address'] ?? '', 200),
    'medium' => ohrClean($data['medium'] ?? '', 60),
    'demand' => ohrCleanMultiline($data['demand'] ?? '', 2000),
    'url' => ohrClean($data['url'] ?? '', 500),
    'urlParams' => ohrClean($data['url_params'] ?? '', 2000),
    'landingParams' => ohrClean($data['landing_params'] ?? '', 2000),
];
if ($a['name'] === '' || ($a['phone'] === '' && $a['mail'] === '')) {
    ohrRespond(400, ['status' => 'error', 'message' => '登録に失敗しました。']);
}

$spec = $ohrBrands[$a['brand']] ?? null;
if ($spec === null) {
    error_log("owners_house_reservation: 知らないブランドです brand=\"{$a['brand']}\"");
}
$brandValue = $spec[0] ?? 'KHG';
// ⚠️ 店舗名の頭のブランド名を略称にする（② の normalizeShop と同じ）
$shopValue = preg_replace(
    ['/^国分ハウジング/u', '/^デイジャストハウス/u', '/^なごみ工務店/u', '/^ニーエルホーム/u', '/^フルコミホーム/u', '/^ジャスフィーホーム/u', '/^(PG ?HOUSE|PGハウス)/iu'],
    ['KH', 'DJH', 'なごみ', '2L', 'FH', 'JH', 'PGH'],
    $a['shop']
) ?? $a['shop'];
if ($shopValue === '') {
    $shopValue = $spec !== null ? $spec[1] . '店舗未設定' : 'ブランド・店舗未設定';
}
$campaign = ($spec[1] ?? 'KHG') . 'オーナーズハウス';
$now = time();
$remarks = implode("\n", array_filter([
    $a['place'] !== '' ? '見学希望：' . $a['place'] . ($a['category'] !== '' ? "（{$a['category']}）" : '') : '',
    $a['url'] !== '' ? 'ページ：' . $a['url'] : '',
    $a['demand'] !== '' ? 'ご質問・ご要望：' . $a['demand'] : '',
]));

try {
    // ⚠️ ② が10分以内に保存した同じ人なら、保存もメールもせずに成功を返す
    $contact = [];
    $params = [$campaign, 'form' . date('YmdHis', $now - 600)];
    if ($a['mail'] !== '') {
        $contact[] = 'mail = ?';
        $params[] = $a['mail'];
    }
    if ($a['phone'] !== '') {
        $contact[] = 'mobile = ?';
        $params[] = $a['phone'];
    }
    $stmt = $pdo->prepare(
        "SELECT id FROM inquiry_customer WHERE hp_campaign = ? AND inquiry_id LIKE 'form%' AND inquiry_id >= ? AND ("
        . implode(' OR ', $contact) . ') LIMIT 1'
    );
    $stmt->execute($params);
    if ($stmt->fetch()) {
        error_log('owners_house_reservation: ② が10分以内に保存済みのため ① では保存しません');
        ohrRespond(200, ['status' => 'success', 'message' => 'オーナーズハウス見学の登録に成功しました。']);
    }

    // ⚠️ NOT NULL の列をすべて埋める（② の NOT_NULL_COLUMNS と同じ）。⚠️ url_params・landing_params は NULL 可
    $notNullColumns = [
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
    ];
    $values = array_fill_keys($notNullColumns, '');
    $values['sync'] = 0;
    $values['delete_flag'] = 0;
    // ⚠️ ① で保存した反響は homepage で始まる（移植元と同じ。② の form と見分けられる）
    $values['inquiry_id'] = 'homepage' . date('YmdHis', $now) . '20250000_khgownershouse';
    $values['inquiry_date'] = date('Y/m/d', $now);
    $values['medium'] = 'ホームページ反響';
    $values['response_medium'] = $a['medium'];
    $values['brand'] = $brandValue;
    $values['shop'] = $shopValue;
    $values['first_name'] = $a['name'];
    $values['first_name_kana'] = $a['kana'];
    $values['mobile'] = $a['phone'];
    $values['mail'] = $a['mail'];
    $values['zip'] = $a['zip'];
    $values['street'] = $a['address'];
    $values['reserved_date'] = $a['date'];
    $values['reserved_time'] = $a['time'];
    $values['hp_campaign'] = $campaign;
    $values['remarks'] = $remarks;
    $values['url_params'] = $a['urlParams'] === '' ? null : $a['urlParams'];
    $values['landing_params'] = $a['landingParams'] === '' ? null : $a['landingParams'];
    $columns = array_keys($values);
    $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')')
        ->execute(array_values($values));
} catch (PDOException $e) {
    error_log("owners_house_reservation: inquiry_customer への保存に失敗 name=\"{$a['name']}\": " . $e->getMessage());
    ohrRespond(500, ['status' => 'error', 'message' => '登録に失敗しました。']);
}
error_log("owners_house_reservation を ① で受け付けました（② に届かなかった） brand=\"{$brandValue}\" shop=\"{$shopValue}\"");

// ---- pgcloud（⚠️ 失敗しても反響は保存済み。⚠️ 全21列を埋める。② と同じ） ----
try {
    $pdo->prepare(
        'INSERT INTO pgcloud (タイムスタンプ, ブランド, 店舗, 姓, 名, セイ, メイ, 郵便番号,'
        . ' 都道府県, `市・区`, `町村・番地`, `ビル名・建物名`, ご予約のきっかけ, その他質問,'
        . ' 希望日, 希望時間, 携帯番号, メールアドレス, 年齢, キャンペーン名, キャンペーンID)'
        . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        date('Y/m/d H:i:s', $now), $brandValue, $a['shop'], $a['name'], '', $a['kana'], '', $a['zip'],
        '', '', '', $a['address'], $a['medium'], $a['demand'],
        $a['date'], $a['time'], $a['phone'], $a['mail'], $a['age'], $campaign, OHR_CAMPAIGN_ID,
    ]);
} catch (PDOException $e) {
    error_log('owners_house_reservation: pgcloud への保存に失敗: ' . $e->getMessage());
}

// ---- メール2通（⚠️ 2通は別々に送る） ----
$brandName = $spec[2] ?? '国分ハウジンググループ';
$detail = [];
foreach ([
    '見学希望場所' => $a['place'], 'お名前' => $a['name'], 'お名前（カナ）' => $a['kana'],
    '来場希望日' => $a['date'], '来場希望時間' => $a['time'], '携帯番号' => $a['phone'], 'メールアドレス' => $a['mail'],
    '年齢' => $a['age'], '郵便番号' => $a['zip'], '住所' => $a['address'], 'お問い合わせのきっかけ' => $a['medium'],
    'その他ご質問・ご要望' => $a['demand'],
] as $label => $value) {
    if ($value !== '') {
        $detail[] = $label . '：' . $value;
    }
}
$detail = implode("\n", $detail);

$customerTo = ohrAddresses($a['mail']);
if ($customerTo) {
    $body = "{$a['name']} 様\nオーナーズハウス見学のお問い合わせを受け付けました。\n\nお問い合わせ内容は以下となります。\n\n{$detail}\n\n"
        . "こちらのメールは配信用のため返信できません。ご意見・ご要望はご予約の店舗までお寄せください。\n\n"
        . "※お問い合わせいただいた日時が18:00以降または火曜日、水曜日の場合、翌営業日以降のご連絡となりますのであらかじめご了承ください。\n";
    if (!ohrSendMail($customerTo, "{$brandName}/お問い合わせありがとうございます。", $body, $brandName)) {
        error_log("owners_house_reservation: お礼のメールを送れませんでした name=\"{$a['name']}\"");
    }
}

$noticeBody = "オーナーズハウス見学のお問い合わせを受け付けました。\n\nお問い合わせ日時：" . date('Y/m/d H:i:s', $now) . "\n\n{$detail}\n"
    . ($a['url'] !== '' ? "該当URL：{$a['url']}\n" : '')
    . "\n管理店舗・担当営業はお施主様との日程調整をお願いします。\n====================\n※のちほどダッシュボードへ反映されます。\n";
if (!ohrSendMail(array_merge(ohrAddresses(OHR_NOTICE_TO), ohrAddresses($spec[3] ?? '')), "{$brandName}/オーナーズハウスからの登録がありました。", $noticeBody, $brandName)) {
    error_log("owners_house_reservation: 社内通知を送れませんでした name=\"{$a['name']}\" mail=\"{$a['mail']}\" phone=\"{$a['phone']}\"");
}

ohrRespond(200, ['status' => 'success', 'message' => 'オーナーズハウス見学の登録に成功しました。']);
```

### backend/scripts/brand_form_api/index.php（全体）
```php
<?php

/**
 * 公開フォーム用のプロキシ（② が落ちたときの退避先）。（v2.2.213 で転送先を付け替えた）
 *
 * 配置先: 各ブランドサイトの `form/api/index.php`（**8サイト**）
 *
 *   https://kh-house.jp/form/api/
 *   https://day-just-house.com/form/api/
 *   https://www.nagomi-koumuten.jp/form/api/
 *   https://furukomi-home.com/form/api/
 *   https://2lhome.net/form/api/
 *   https://miyazaki.pg-house.jp/form/api/
 *   https://jusfy-home.com/form/api/
 *   https://kh-house.jp/khg/form/api/
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **このファイルには認証情報を書かないこと。** 転送するだけの役目である。DB には触らない。
 *
 * ⚠️⚠️ **2026-10-23（v2.2.213）に転送先を付け替えた。**
 *   ⚠️ 以前の転送先 `https://khg-marketing.info/api/`（Authorization ヘッダで振り分ける PHP）は**誤って消えた**。
 *   ⚠️ 新しい転送先は ① ダッシュボードのゲートウェイ `https://khg-marketing.info/dashboard/api/gateway/` の
 *     `campaign_form`（handlers/campaign_form.php。② の campaign_form の予備）。
 *   ⚠️ ゲートウェイは本文の `request` / `roll` で振り分けるので、ヘッダを読み替えて本文に入れる:
 *       Authorization: form_get      → request: campaign_form, roll: public（フォームの設定の読み込み）
 *       Authorization: form_register → request: campaign_form, roll: entry （反響の受付）
 *       Authorization: estimate_entry / owners_house_reservation → 同じ名前の request（v2.2.216。下の $routes）
 *   ⚠️ それ以外の Authorization は断る（以前の転送先にあった他の口は、ここからは使われていない）。
 *
 * ⚠️ 公開フォーム（form_get の gateway.ts）は ② に届かなかったときだけここへ来る。ふだんは使われない。
 *
 * ⚠️⚠️ **2026-09-16 に直した2点はそのまま残す。**
 *   1. メールヘッダに入る宛先（mail_to / mail_cc）の無害化（受け側は使わないが二重の防御）
 *   2. デバッグ出力（error_log でヘッダを書き出していた）を置かない
 * ─────────────────────────────────────────────
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

/** ⚠️ 転送先。⚠️ 環境変数はテスト用（本番のブランドサイトでは設定しない） */
$targetUrl = getenv('FORM_GATEWAY_URL') ?: 'https://khg-marketing.info/dashboard/api/gateway/';

/**
 * Authorization ヘッダ → ゲートウェイの [request, roll]
 * ⚠️ v2.2.216 で簡単見積もり（JH の画面）・オーナーズハウスの見学予約（kh-house.jp）を足した。
 *   どちらも ② に届かなかったときだけ、この中継を経由して ① の handlers/estimate_entry.php・owners_house_reservation.php へ届く。
 */
$routes = [
    'form_get' => ['campaign_form', 'public'],
    'form_register' => ['campaign_form', 'entry'],
    'estimate_entry' => ['estimate_entry', ''],
    'owners_house_reservation' => ['owners_house_reservation', ''],
];

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authToken = $headers['Authorization'] ?? ($headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? null));

// ⚠️⚠️ デバッグ出力は置かないこと（以前は全リクエストのヘッダをログに書き続けていた）

if (json_last_error() !== JSON_ERROR_NONE || !is_array($data) || empty($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

if (!$authToken) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Missing Authorization header']);
    exit;
}

if (!isset($routes[$authToken])) {
    http_response_code(404);
    echo json_encode(['status' => 'error', 'message' => 'Unknown Authorization']);
    exit;
}

/**
 * ⚠️ メールヘッダに入りうる宛先を無害化する（⚠️ 改行は「削除」ではなく「カンマに置換」）。
 * ⚠️ 受け側（campaign_form.php）は通知先を form_table から引くので使わないが、二重の防御として残す。
 */
function safeAddressList($value)
{
    if (!is_string($value) || $value === '') {
        return '';
    }
    $value = str_replace(array("\r", "\n", "\t"), ',', $value);
    $clean = array();
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && filter_var($one, FILTER_VALIDATE_EMAIL)) {
            $clean[] = $one;
        }
    }
    return implode(',', array_slice(array_unique($clean), 0, 20));
}

foreach (array('mail_to', 'mail_cc') as $key) {
    if (isset($data[$key])) {
        $data[$key] = safeAddressList($data[$key]);
    }
}

// ⚠️ ゲートウェイの振り分けに使う値。⚠️ フォームが送ってきた request / roll は上書きする
$data['request'] = $routes[$authToken][0];
$data['roll'] = $routes[$authToken][1];

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data, JSON_UNESCAPED_UNICODE));
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 25);

$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode === 0) {
    error_log('form/api: 転送に失敗しました: ' . $curlError);
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => '通信エラーが発生しました。']);
    exit;
}

http_response_code($httpCode);
echo $response;
```

### backend/scripts/estimate_2l/result_api.php（新規）
```php
<?php

/**
 * 2L 簡単見積もりの送信先（2lhome.net/mitsumori/result_api.php）。（v2.2.216 で送り先を付け替えた）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 以前は Heroku の中継（polar-journey…/update）→ ① khg-marketing.info/api/ へ送っていた。
 *   ⚠️ その php が誤って消え、2026-09 上旬から反響が入っていなかった。
 * ⚠️ 新しい送り先:
 *   1. ② https://api.khg-marketing.info/api/gateway （request: estimate_entry）
 *   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
 *      （サーバーからの送信なので ① へ直接送ってよい。① の handlers/estimate_entry.php が同じ処理をする）
 * ⚠️ 通知先・お礼メールを送るかどうかは受け側が form_table（2l / 20250000_2l_mitsumori）から引く。⚠️ ここで決めない。
 * ⚠️ url_params / landing_params は index.html に足す params.js がフォームに入れて送ってくる。
 * ⚠️ 入力の受け取り方・見積もりの中身の組み立ては以前のまま（⚠️ 画面は今後相談して作り直す）。
 * ─────────────────────────────────────────────
 */

session_start();

// ⚠️ 送り先。⚠️ 環境変数はテスト用（本番では設定しない）
define('ESTIMATE_EXPRESS_URL', getenv('ESTIMATE_EXPRESS_URL') ?: 'https://api.khg-marketing.info/api/gateway');
define('ESTIMATE_PHP_URL', getenv('ESTIMATE_PHP_URL') ?: 'https://khg-marketing.info/dashboard/api/gateway/');
const ESTIMATE_RESULT_URL = 'https://2lhome.net/mitsumori_result/';

// 1. 受信データをまとめる（以前のまま）
$input = [
    'wall'        => $_POST['wall']               ?? '',
    'sash'        => $_POST['sash']               ?? '',
    'roof'        => $_POST['roof']               ?? '',
    'entrance'    => $_POST['entrance']           ?? '',
    'eave'        => $_POST['eave']               ?? '',
    'interior'    => $_POST['interior_value']     ?? '',
    'madori'      => $_POST['madori']             ?? '',
    'option1'     => $_POST['option1']            ?? '',
    'option2'     => $_POST['option2']            ?? '',
    'option3'     => $_POST['option3']            ?? '',
    'option4'     => $_POST['option4']            ?? '',
    'option5'     => $_POST['option5']            ?? '',
    'option6'     => $_POST['option6']            ?? '',
    'option7'     => $_POST['option7']            ?? '',
    'option8'     => $_POST['option8']            ?? '',
    'option9'     => $_POST['option9']            ?? '',
    'name'        => $_POST['f_item_name']        ?? '',
    'name_kana'   => $_POST['f_item_name_kana']   ?? '',
    'mail'        => $_POST['f_item_mail']        ?? '',
    'tel'         => $_POST['f_item_tel']         ?? '',
    'zip'         => $_POST['f_item_zip']         ?? '',
    'pref'        => $_POST['f_item_pref']        ?? '',
    'city'        => $_POST['f_item_city']        ?? '',
    'street'      => $_POST['f_item_address_street']   ?? '',
    'building'    => $_POST['f_item_address_building'] ?? '',
    'media'       => 'SNS広告',
];

// 2. セッションにも保存（以前のまま。結果ページが使う）
$_SESSION = array_merge($_SESSION, $input);

// 3. question文字列を組み立てる（以前のまま）
$modelMap = [
    1 => "No.64 S-21 3LDK 平屋 … 1158.3万円",
    2 => "No.65 S-22 2LDK 平屋 … 1207.8万円",
];
$optionsMap = [
    'option1' => [1 => '太陽光発電システム'],
    'option2' => [2 => '浴室乾燥機'],
];

$question = $modelMap[intval($input['madori'])] ?? '';
foreach ($optionsMap as $key => $map) {
    $val = intval($input[$key]);
    if (isset($map[$val])) {
        $question .= ' ' . $map[$val];
    }
}

/** URL パラメータ（? 以降）。⚠️ 長すぎる値は切る */
function estimateParam(string $key): string
{
    $value = $_POST[$key] ?? '';
    return is_string($value) ? mb_substr(ltrim($value, '?'), 0, 2000, 'UTF-8') : '';
}

// 4. 送る内容
$apiData = [
    'request'        => 'estimate_entry',
    'sei'            => $input['name'],
    'mei'            => '',
    'seiKana'        => $input['name_kana'],
    'meiKana'        => '',
    'medium'         => 'SNS広告',
    'date'           => '',
    'time'           => '',
    'age'            => '',
    'mail'           => $input['mail'],
    'phone'          => $input['tel'],
    'zip'            => $input['zip'],
    'pref'           => $input['pref'],
    'city'           => $input['city'],
    'town'           => $input['street'],
    'street'         => $input['building'],
    'question'       => trim($question),
    'campaign'       => '20250000【2L鹿児島】簡単見積もり',
    'campaign_id'    => '20250000_2l_mitsumori',
    'brand'          => '2l',
    'shop'           => '鹿児島店',
    'url'            => 'https://2lhome.net/mitsumori/',
    'source'         => 'mitsumori',
    'url_params'     => estimateParam('url_params'),
    'landing_params' => estimateParam('landing_params'),
];

if (!($apiData['sei'] && $apiData['seiKana'] && $apiData['mail'] && $apiData['phone'] && $apiData['zip'] && $apiData['pref'] && $apiData['city'] && $apiData['town'])) {
    echo '<script>alert("未入力の項目があります。"); history.back();</script>';
    exit;
}

/**
 * 送る。② → だめなら ①。⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。
 * ⚠️ 戻り値は [HTTP の番号, 応答の本文（配列）]
 */
function estimatePost(array $data): array
{
    foreach ([ESTIMATE_EXPRESS_URL, ESTIMATE_PHP_URL] as $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json; charset=utf-8'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT        => 20,
        ]);
        $response = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($response === false || $code === 0) {
            error_log("mitsumori/result_api.php: 送信エラー {$url}: {$error}");
            continue;
        }
        if ($code >= 500) {
            error_log("mitsumori/result_api.php: {$url} が {$code} を返しました");
            continue;
        }
        $body = json_decode($response, true);
        return [$code, is_array($body) ? $body : []];
    }
    return [0, []];
}

[$code, $data] = estimatePost($apiData);

if ($code === 200 && ($data['status'] ?? '') === 'success') {
    header('Location: ' . ESTIMATE_RESULT_URL);
    exit;
}

$errorMsg = $code === 0
    ? '通信エラーが発生しました。再度お試しください。'
    : ($data['message'] ?? '登録に失敗しました。再度トライしてください。');
echo '<script>alert(' . json_encode($errorMsg, JSON_UNESCAPED_UNICODE) . '); history.back();</script>';
exit;
```

### backend/scripts/estimate_2l/params.js（新規）
```js
/*
 * 2L 簡単見積もり（2lhome.net/mitsumori/）の URL パラメータを、フォームと一緒に送る。（v2.2.216）
 *
 * ⚠️ index.html の </body> の直前に <script src="./params.js"></script> を1行足して使う。
 * ⚠️ 送る値（form_get の pageParams.ts と同じ考え方）:
 *   - url_params     … 送信したページの ? 以降（# より前）
 *   - landing_params … このサイトで最後に開いた、パラメータ付きページの ? 以降（localStorage に覚える）
 * ⚠️ 保存を禁止したブラウザでは覚えられないが、送信は止めない。
 */
(function () {
    'use strict';
    var KEY = 'landing_params';
    var query = location.search.replace(/^\?/, '');

    try {
        if (query !== '') localStorage.setItem(KEY, query);
    } catch (e) { /* 覚えられなくても送信には影響しない */ }

    function landing() {
        try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
    }

    function put(form, name, value) {
        var input = form.querySelector('input[name="' + name + '"]');
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
        }
        input.value = value;
    }

    function attach() {
        var form = document.querySelector('form[action*="result_api.php"]');
        if (!form) return;
        // ⚠️ 送る直前に入れる（ページを開いたあとに覚えた値も拾う）
        form.addEventListener('submit', function () {
            put(form, 'url_params', query);
            put(form, 'landing_params', landing());
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
})();
```

### react/estimate/src/api/entry.ts（新規。⚠️ react/proposal・react/owners_house にも同じもの）
```ts
import axios from 'axios';

/**
 * 反響の送信（v2.2.216）。⚠️ react/estimate・react/proposal・react/owners_house に同じファイルを置いている。⚠️ 直すときは3つとも
 *
 * ─────────────────────────────────────────────
 * ⚠️ 以前は Heroku の中継（polar-journey…/update）→ ① khg-marketing.info/api/（Authorization: registration）へ送っていた。
 *   ⚠️ その php が誤って消え、2026-09 上旬から反響が入っていなかった。
 * ⚠️ 新しい送り先（form_get の src/api/gateway.ts と同じ考え方）:
 *   通常   : ブラウザ ──▶ ② https://api.khg-marketing.info/api/gateway（本文の request で振り分け）
 *   ② 失敗 : ブラウザ ──▶ 同じサイトの /form/api/（Authorization: request 名）──▶ ① の同じ名前の handlers
 *   ⚠️ ブラウザから khg-marketing.info へ直接送らない（広告で除外されたドメインのため。同じサイトの /form/api/ が中継する）
 * ⚠️ url_params / landing_params を必ず付ける（下の pageParams）。
 * ─────────────────────────────────────────────
 */

const EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
/** ⚠️ ② を待つ上限。⚠️ 長すぎると送信ボタンを押した人が待たされる */
const TIMEOUT_MS = 15000;
const LANDING_KEY = 'landing_params';

/** このページの ? 以降（# より前） */
const currentQuery = (): string => window.location.search.replace(/^\?/, '');

/**
 * パラメータ付きのページを開いたら覚える（最後に開いたものだけ）。⚠️ main.tsx で最初に1回呼ぶ。
 * ⚠️ 保存を禁止したブラウザでは覚えられないが、送信は止めない。
 */
export const rememberLandingParams = (): void => {
    const query = currentQuery();
    if (query === '') return;
    try {
        localStorage.setItem(LANDING_KEY, query);
    } catch {
        // 覚えられなくても送信には影響しない
    }
};

/** 送信に付ける url_params（送ったページ）・landing_params（最後に開いたパラメータ付きページ） */
export const pageParams = (): { url_params: string; landing_params: string } => {
    let landing = '';
    try {
        landing = localStorage.getItem(LANDING_KEY) ?? '';
    } catch {
        landing = '';
    }
    return { url_params: currentQuery(), landing_params: landing };
};

export interface EntryResponse {
    status: string;
    message?: string;
}

/**
 * 反響を送る。⚠️ ② が落ちていても、タイムアウトしても ① へ回す（反響を失わないことを優先）。
 * ⚠️ ① の受け皿は「② が10分以内に保存した同じ人」を飛ばすので、② が保存した直後にタイムアウトしても二重にはならない。
 */
export const postEntry = async (request: 'estimate_entry' | 'owners_house_reservation', body: Record<string, unknown>): Promise<EntryResponse> => {
    const data = { ...body, ...pageParams() };
    try {
        const res = await axios.post(EXPRESS_URL, { ...data, request }, { headers: { 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS });
        return res.data as EntryResponse;
    } catch (error) {
        // ⚠️ 握りつぶさない。毎回 ① へ落ちている状態に気づけなくなる
        console.warn(`[entry] ② への送信に失敗しました。① へ回します: ${String(error)}`);
    }
    // ⚠️ 同じサイトの /form/api/ はヘッダで振り分ける。⚠️ 本文の request は中継が上書きする
    const res = await axios.post(`${window.location.origin}/form/api/`, data, {
        headers: { 'Content-Type': 'application/json', Authorization: request },
        timeout: TIMEOUT_MS,
    });
    return res.data as EntryResponse;
};
```

## フロントの変更（改修前との差分）
### react/estimate/src/main.tsx
```diff
@@ -2,6 +2,10 @@
 import { createRoot } from 'react-dom/client'
 import './index.css'
 import App from './App.tsx'
+import { rememberLandingParams } from './api/entry'
+
+// ⚠️ v2.2.216: パラメータ付きで開いたら覚える（送信時に landing_params として付ける）
+rememberLandingParams()
 
 createRoot(document.getElementById('root')!).render(
   <StrictMode>
```

### react/estimate/src/components/Content.tsx
```diff
@@ -66,7 +66,7 @@
 import OptionPantry from '../assets/images/option_pantry.png';
 import { useNavigate } from 'react-router-dom';
 import { useState, useEffect } from 'react';
-import axios from 'axios';
+import { postEntry } from '../api/entry';
 
 const Content = () => {
   const [plan, setPlan] = useState<{
@@ -233,9 +233,7 @@
         mei: '',
         seiKana: plan.kana,
         meiKana: '',
-        request: 'homepage',
-        mail_to: 'mkt@kh-house.jp',
-        mail_cc: 'jh@kh-group.jp',
+        // ⚠️ v2.2.216: request・通知先（mail_to / mail_cc）は送らない（request は postEntry が付け、通知先は受け側が form_table から引く）
         mail: plan.mail,
         phone: plan.phone,
         age: plan.age,
@@ -255,12 +253,13 @@
         floorPlan: plan.floorPlan,
         option: plan.option
       }
-      const response = await axios.post('https://polar-journey-96649-4e62a17d857f.herokuapp.com/update', postData, { headers: { "Content-Type": "application/json" } });
+      // ⚠️ v2.2.216: Heroku の中継（消えた php へ送っていた）をやめて ② へ（届かなければ同じサイトの /form/api/ → ①）
+      const response = await postEntry('estimate_entry', postData);
 
-      if (response.data.status === "success") {
+      if (response.status === "success") {
         navigate('/result', { state: { data: postData } });
       } else {
-        console.log(response.data)
+        console.log(response)
         alert("登録に失敗しました。再度トライしてください。");
       }
     } catch (error) {
```

### react/estimate/src/components/Result.tsx
```diff
@@ -35,7 +35,7 @@
 import NikaiMiddle3 from '../assets/images/nikai_middle_3.png';
 import NikaiLarge1 from '../assets/images/nikai_large_1.png';
 import NikaiLarge2 from '../assets/images/nikai_large_2.png';
-import axios from 'axios';
+import { postEntry } from '../api/entry';
 
 import { useState, useEffect, useMemo } from 'react';
 import { useLocation } from 'react-router-dom';
@@ -269,9 +269,7 @@
         mei: '',
         seiKana: customerInfo.kana,
         meiKana: '',
-        request: 'homepage',
-        mail_to: 'mkt@kh-house.jp',
-        mail_cc: 'jh@kh-group.jp',
+        // ⚠️ v2.2.216: request・通知先（mail_to / mail_cc）は送らない（request は postEntry が付け、通知先は受け側が form_table から引く）
         mail: customerInfo.mail,
         phone: customerInfo.phone,
         age: customerInfo.age,
@@ -286,12 +284,13 @@
         question: customerInfo.demand,
       };
 
-      const response = await axios.post('https://polar-journey-96649-4e62a17d857f.herokuapp.com/update', postData, { headers: { "Content-Type": "application/json" } });
+      // ⚠️ v2.2.216: Heroku の中継（消えた php へ送っていた）をやめて ② へ（届かなければ同じサイトの /form/api/ → ①）
+      const response = await postEntry('estimate_entry', postData);
 
-      if (response.data.status === "success") {
+      if (response.status === "success") {
         window.location.href = 'https://jusfy-home.com/lp/thanks2/';
       } else {
-        console.log(response.data)
+        console.log(response)
         alert("登録に失敗しました。再度トライしてください。");
       }
     } catch (error) {
```

### react/proposal/src/main.tsx
```diff
@@ -2,6 +2,10 @@
 import { createRoot } from 'react-dom/client'
 import './index.css'
 import App from './App.tsx'
+import { rememberLandingParams } from './api/entry'
+
+// ⚠️ v2.2.216: パラメータ付きで開いたら覚える（送信時に landing_params として付ける）
+rememberLandingParams()
 
 createRoot(document.getElementById('root')!).render(
   <StrictMode>
```

### react/owners_house/src/main.tsx
```diff
@@ -2,6 +2,10 @@
 import { createRoot } from 'react-dom/client'
 import './index.css'
 import App from './App.tsx'
+import { rememberLandingParams } from './api/entry'
+
+// ⚠️ v2.2.216: パラメータ付きで開いたら覚える（見学予約の送信時に landing_params として付ける）
+rememberLandingParams()
 
 createRoot(document.getElementById('root')!).render(
   <StrictMode>
```

### react/owners_house/src/components/Owners.tsx
```diff
@@ -2,6 +2,7 @@
 import './style2.css';
 import { useLocation, useNavigate } from 'react-router-dom';
 import axios from 'axios';
+import { postEntry } from '../api/entry';
 import { Table } from 'react-bootstrap';
 import { Modal } from 'react-bootstrap';
 import OwnerImg2_pc from '../assets/images/ownerImg2_pc.png';
@@ -10,10 +11,6 @@
 
 type ShopInfo = { no: number | null; id: string; category: string; pref: string; area: string; name: string; title: string; brand: string; shop: string; shop_zip: string; shop_address: string; staff: string; tag: string; feature_1: string; feature_2: string; feature_3: string; feature_4: string; feature_5: string; img_1: string; img_2: string; img_3: string; img_4: string; img_5: string; map_address: string; lat_and_long: string; structure: string; large: string; plan: string; flag: number | null; };
 type CustomerInfo = { brand: string; shop: string; place: string; category: string; date: string; time: string; name: string; kana: string; age: string; phone: string; mail: string; zip: string; address: string; medium: string; demand: string }
-interface ApiResponse {
-    status: string;
-    message?: string;
-}
 const Owners = () => {
     const location = useLocation();
     const navigate = useNavigate();
@@ -192,32 +189,19 @@
 
         try {
             const urlValue = `https://kh-house.jp/owners_house/owners?id=${masterData.id}`;
-            let mail_ccValue;
-            if (customerInfo.brand === 'KH') {
-                mail_ccValue = 'kh@kh-group.jp,lead@kh-group.jp,kh-t@kh-house.jp';
-            } else if (customerInfo.brand === 'DJH') {
-                mail_ccValue = 'info-djh@royalhome.co.jp,djh@kh-group.jp';
-            } else if (customerInfo.brand === 'Nagomi') {
-                mail_ccValue = 'nagomi@kh-group.jp,nagomi@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com';
-            } else if (customerInfo.brand === '2L') {
-                mail_ccValue = '2lhome@kh-group.jp,2lhome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com';
-            } else if (customerInfo.brand === 'FH') {
-                mail_ccValue = 'furukomihome@kh-group.jp,furukomihome@kh-group.jp.test-google-a.com,lead@kh-group.jp.test-google-a.com';
-            } else if (customerInfo.brand === 'PGH') {
-                mail_ccValue = 'pghouse@kh-house.jp,koukoku@pure-growth.net,pghouse@pure-growth.net,pgh@kh-group.jp';
-            } else if (customerInfo.brand === 'JH') {
-                mail_ccValue = 'jh@kh-group.jp';
-            }
+            // ⚠️⚠️ v2.2.216: 社内通知の宛先（mail_to / mail_cc）はこの画面で決めない（以前はブランドごとの Cc をここで組み立てて送っていた）。
+            //   ⚠️ 受け側（② features/ownersHouse/reservation.ts・① handlers/owners_house_reservation.php）が表から引く。⚠️ ここへ書き戻さないこと
+            // ⚠️⚠️ category は house_category の名前で送る（⚠️ `category` は送り先の振り分けの鍵に入り、② が受け付けない）
+            const { category, ...rest } = customerInfo;
             const postData = {
-                ...customerInfo,
-                request: 'owners_house',
+                ...rest,
+                house_category: category,
                 url: urlValue,
-                mail_to: 'mkt@kh-house.jp',
-                mail_cc: mail_ccValue
             }
-            const response = await axios.post<ApiResponse>('https://polar-journey-96649-4e62a17d857f.herokuapp.com/update', postData, { headers: { "Content-Type": "application/json" } });
+            // ⚠️ v2.2.216: Heroku の中継（消えた php へ送っていた）をやめて ② へ（届かなければ kh-house.jp/form/api/ → ①）
+            const response = await postEntry('owners_house_reservation', postData);
 
-            if (response.data.status === "success") {
+            if (response.status === "success") {
                 setRegistered(true);
             } else {
                 alert("フォームの登録に失敗しました。再度トライしてください。");
```

### react/proposal/src/components/Result.tsx
（react/estimate/src/components/Result.tsx と同じ。改修前も同じ中身だったので、そのまま写した）

