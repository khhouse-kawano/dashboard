# 2026-09-16 に新規追加したファイルの全文

⚠️ CLAUDE.md に「**新たに追加したコンポネントなども長くなっていいのでそのまま書くこと。レビューが必要なため。**」が
2026-09-17 に追加された。⚠️ **それ以前に書いた指示ごとの記録（`task-2026-09-16-01`〜`17`）は抜粋しか載せていない。**

⚠️ ここは ⚠️ **新ルールを満たしていない分だけ**をまとめたもの。
⚠️ **既存の記録は修正していない**（2026-09-17 の指示）。⚠️ 経緯・検証・判断の理由は各記録のほうにある。

---

## 対象の一覧

⚠️ 2026-09-16 のコミットで**新規追加**された、⚠️ **ドキュメント以外**のファイル。

| 指示 | ディレクトリ | ファイル | 役割 |
|---|---|---|---|
| ② | `backend-express/src/features/campaignForm/` | `brands.ts` | ブランドの対応表 |
| ② | `backend-express/src/features/campaignForm/` | `entry.ts` | 反響の受付・保存・メール |
| ② | `backend-express/src/features/campaignForm/` | `index.ts` | `campaign_form` の入口 |
| ② | `backend-express/src/features/campaignForm/` | `mail.ts` | メール送信 |
| ② | `backend-express/src/features/campaignForm/` | `text.ts` | 値の整形 |
| ② | `frontend/src/components/campaign/` | `brands.ts` | 画面側のブランド一覧 |
| ② | `frontend/src/components/campaign/` | `campaignApi.ts` | 通信 |
| ② | `frontend/src/components/campaign/` | `formBuilderUtils.ts` | 項目定義と設定の解釈 |
| ② | `frontend/src/components/campaign/` | ⚠️ `FormBuilder.tsx` | ⚠️ **コンポーネント** |
| ③ | `backend/forms/` | `form-proxy.php` | 8サイトの `form/api/index.php` |
| ④ | `backend-express/src/features/` | `metaAds.ts` | 他社広告ライブラリ |
| ④ | `frontend/src/components/header/` | ⚠️ `MetaAdsSummary.tsx` | ⚠️ **コンポーネント** |
| ④ | `frontend/src/components/header/` | `metaAdsUtils.ts` | 集計 |
| ⑥ | `backend-express/src/features/` | `lostList.ts` | 失注一覧 |
| ⑨ | `backend-express/src/features/` | `campaignSummary.ts` | キャンペーン集計 |
| ⑪ | `backend-express/src/features/campaignForm/` | `mailTemplate.ts` | 文面のひな型と差し込み |
| ⑪ | `frontend/src/components/campaign/` | `mailTemplateFields.ts` | 差し込み語の一覧と検査 |
| ⑪ | `backend/forms/` | ⚠️ `khg-api-form-register.snippet.php` | ⚠️ **① 用の下書き（未適用）** |
| ⑪ | `backend/scripts/sql/` | `2026-09-16_form_mail_template.sql` | ⚠️ **本番適用済み** |
| ⑫ | `backend/forms/` | `form-htaccess.txt` | ⚠️ **未設置** |

### ⚠️ ここに載せていないもの

| ファイル | 理由 |
|---|---|
| `backend/forms/index.php` | ⚠️ `form-proxy.php` と**完全に同一**（`diff` で確認済み）。配置時のファイル名違いだけ |
| `react/form_get/src/App.tsx` | ⚠️ **git 管理外**だが、⑫ の記録に**全文が載っている** |
| `docs/` 配下 | ドキュメントのため |

⚠️ ⚠️ **既存ファイルへの修正はここに載せていない。** ⚠️ 修正した関数は各記録に載っている。

---

## `backend-express/src/features/campaignForm/brands.ts`

| | |
|---|---|
| 指示 | ② |
| 行数 | 167 |
| 備考 | ⚠️ ⑬（フルコミホームの誤字）・⑭（`formTableBrand()`）の追記も入っている |

```ts
/**
 * ブランドの対応表。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **移植元は同じ対応表を4か所に書き写しており、中身が食い違っていた。**
 *
 *   ⚠️ `form_register` と `registration/homepage` で分岐の数が違う
 *     （`khf` / `khg` が前者に**無い**）。
 *     → そのブランドで登録すると `brand` が**空文字**で保存されていた。
 *
 *   ⚠️ 本番（khg-marketing.info）は `2l`、ローカルの控え（react/form_get）は
 *     `nieru` と、**同じブランドに別のキー**を使っていた。
 *     → 両方受け付ける。片方だけにすると、古いフォームからの反響が落ちる。
 *
 * ⚠️ **ここ以外にブランドの分岐を書かないこと。** 増やすと必ずまた食い違う。
 * ─────────────────────────────────────────────
 */

export interface BrandSpec {
    /** `inquiry_customer.brand` に入る値。⚠️ 既存データの表記に合わせる */
    value: string;
    /** メールの差出人名・件名に使う */
    name: string;
    /** サンクスメールに載せる事前アンケートのURL。⚠️ 無いブランドは空 */
    questionnaire: string;
    /**
     * `inquiry_customer.shop` を組み立てるときの接頭辞。
     * ⚠️ PG HOUSE だけ `brand` の値（`PG HOUSE`）ではなく `PGH` を使う。
     *   移植元にも同じ特例がある（`$brand_value === 'PG HOUSE' ? 'PGH' . ... `）。
     */
    shopPrefix: string;
}

const KH: BrandSpec = {
    value: 'KH', name: '国分ハウジング', shopPrefix: 'KH',
    questionnaire: 'https://khg-marketing.info/survey_kh/',
};
const DJH: BrandSpec = {
    value: 'DJH', name: 'デイジャストハウス', shopPrefix: 'DJH',
    questionnaire: 'https://khg-marketing.info/survey_djh/',
};
const NAGOMI: BrandSpec = {
    value: 'なごみ', name: 'なごみ工務店', shopPrefix: 'なごみ',
    questionnaire: 'https://khg-marketing.info/survey_nagomi/',
};
const NIERU: BrandSpec = {
    value: '2L', name: 'ニーエルホーム', shopPrefix: '2L',
    questionnaire: 'https://khg-marketing.info/survey_2l/',
};
const FH: BrandSpec = {
    /**
     * ⚠️⚠️ **`name` は「フルコミホーム」。** ⚠️ 移植元（① の PHP）は
     *   **`フルコミコーム` という誤字**で、⚠️ 今も本番のメールがその名前で届いている。
     *   ⚠️ 今までは差出人名が `SMTP_FROM` の「国分ハウジング」で固定されており
     *     誤字は表に出ていなかったが、⚠️ v2.2.134 で**顧客に見えるようになる**ため直した
     *     （2026-09-16 に利用者と確認）。
     * ⚠️ `value`（`FH`）と `shopPrefix`（`FH`）は**既存データの表記なので触らない**。
     */
    value: 'FH', name: 'フルコミホーム', shopPrefix: 'FH',
    questionnaire: 'https://khg-marketing.info/survey_fh/',
};
const PG: BrandSpec = {
    // ⚠️ brand は 'PG HOUSE'（空白あり）だが、店舗の接頭辞は 'PGH'。取り違えないこと
    value: 'PG HOUSE', name: 'PG-HOUSE', shopPrefix: 'PGH',
    questionnaire: 'https://khg-marketing.info/survey_pg/',
};
const JH: BrandSpec = {
    value: 'JH', name: 'JUSFY HOME', shopPrefix: 'JH',
    questionnaire: 'https://khg-marketing.info/survey_jh/',
};
const KHF: BrandSpec = {
    // ⚠️ かえるホーム。アンケートは無い
    value: 'KHG', name: 'かえるホーム', shopPrefix: 'KHG', questionnaire: '',
};
const KHG: BrandSpec = {
    // ⚠️ グループ共通。アンケートは「どの店舗を選んだか」で決まる（下の questionnaireFor）
    value: 'KHG', name: '国分ハウジンググループ', shopPrefix: 'KHG', questionnaire: '',
};

/**
 * フォームが送ってくる `brand` の値 → 仕様。
 * ⚠️ `2l` と `nieru` は**同じブランド**。どちらも受ける（移植元で割れていたため）。
 */
const BRANDS: Record<string, BrandSpec> = {
    kh: KH,
    djh: DJH,
    /**
     * ⚠️⚠️ **`form_table.brand` に入っているのは `nagomi`（ローマ字）である。**
     *   ⚠️ 移植元の PHP は `"なごみ"`（かな）でしか判定しておらず、
     *     **なごみのフォームからの反響は brand が空文字で保存されていた**
     *     （2026-09-16 時点で homepage 反響のうち20件）。
     *   ⚠️ ローマ字・かなの両方を受ける。片方だけにすると取りこぼす。
     */
    nagomi: NAGOMI,
    'なごみ': NAGOMI,
    '2l': NIERU,
    nieru: NIERU,
    fh: FH,
    pg: PG,
    jh: JH,
    khf: KHF,
    khg: KHG,
};

/**
 * ⚠️ 知らないブランドでも**反響を捨てない**。
 *   ⚠️ 移植元は該当なしのとき brand を空文字で保存していた。
 *     ここでも同じく空で通すが、呼び出し側が必ずログに残すこと。
 */
export const brandOf = (raw: string): BrandSpec | null =>
    BRANDS[(raw ?? '').trim()] ?? null;

/**
 * 送られてきた `brand` → **`form_table.brand` に入っているキー**。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **公開フォームが送る `brand` は、`form_table.brand` と一致しない。**
 *
 *   ⚠️ 公開フォームは送信の直前に
 *       `brand: form.brand === 'nagomi' ? 'なごみ' : form.brand`
 *     と**かなへ書き換える**（① の PHP がかなでしか判定しないため）。
 *     ⚠️ ところが `form_table.brand` は **`nagomi`（ローマ字）**である。
 *
 *   ⚠️ KHG 共通フォームはさらに、**選んだ店舗のブランドへ書き換える**
 *     （`khg` → `kh` など）。⚠️ `form_table` の行は `khg` のままである。
 *
 *   ⚠️⚠️ **そのまま引くと行が見つからず、メールが1通も飛ばない。**
 *     ⚠️ 反響は保存されるので**成功に見える**（2026-09-16 に実際に起きた）。
 *
 * ⚠️ `campaign_id` だけで引いてはいけない。
 *   ⚠️ **別ブランドで同じ campaign_id が5組ある**（実データ）。
 *     通知先が別ブランドのものになる。
 * ─────────────────────────────────────────────
 */
const FORM_TABLE_BRAND: Record<string, string> = {
    // ⚠️ かな → ローマ字（form_table はローマ字）
    'なごみ': 'nagomi',
    // ⚠️ 本番とローカルで割れていた名残
    nieru: '2l',
};

export const formTableBrand = (raw: string, isKhgForm = false): string => {
    const value = (raw ?? '').trim();
    // ⚠️ KHG 共通フォームの設定は必ず `khg` の行にある
    if (isKhgForm) return 'khg';
    return FORM_TABLE_BRAND[value] ?? value;
};

/**
 * 事前アンケートのURL。
 *
 * ⚠️ `khg`（グループ共通フォーム）だけは、**選ばれた店舗名**で決まる。
 *   移植元の `registration/homepage` にある分岐をそのまま写している。
 */
const KHG_SURVEY: Record<string, string> = {
    '国分ハウジング': KH.questionnaire,
    'デイジャストハウス': DJH.questionnaire,
    'なごみ工務店': NAGOMI.questionnaire,
    'ニーエルホーム': NIERU.questionnaire,
    'フルコミホーム': FH.questionnaire,
};

export const questionnaireFor = (spec: BrandSpec | null, shop: string): string => {
    if (!spec) return '';
    if (spec === KHG) return KHG_SURVEY[(shop ?? '').trim()] ?? '';
    return spec.questionnaire;
};
```

---

## `backend-express/src/features/campaignForm/entry.ts`

| | |
|---|---|
| 指示 | ② |
| 行数 | 400 |
| 備考 | ⚠️ ⑪・⑭・⑰ の修正も入っている |

```ts
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
```

---

## `backend-express/src/features/campaignForm/index.ts`

| | |
|---|---|
| 指示 | ② |
| 行数 | 264 |
| 備考 | ⚠️ ⑪ の `MAIL_TEMPLATE_COLUMNS` も入っている |

```ts
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';

/**
 * キャンペーンフォームの設定（`form_table`）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **移植元は `index 2.php`（`https://khg-marketing.info/api/`）である。**
 *   ⚠️ dashboard のゲートウェイとは**別のAPI**で、
 *     ルーティングに `request` ではなく **`Authorization` ヘッダ**を使っている
 *     （`Authorization: form_list` 等）。
 *
 * ⚠️⚠️ **移植したのはダッシュボードが使う5つだけである。**
 *
 *     form_list     → campaign_form:list    （一覧）
 *     form_edit     → campaign_form:detail  （1件取得）
 *     form_post     → campaign_form:insert  （新規登録）
 *     form_update   → campaign_form:update  （更新）
 *     form_database → campaign_form:master  （ブランド既定値）
 *
 * ⚠️⚠️ **`form_get` と `form_register` は移植してはいけない。**
 *   ⚠️ **公開済みのフォーム272件が、生成された HTML の中で
 *     `https://khg-marketing.info/api/` を直接叩いている。**
 *   ⚠️ 移植して ① の PHP を消すと、**272件すべてを作り直して
 *     差し替えるまで反響が止まる。**
 *   ⚠️ あちらは ① に残したままにすること。
 * ─────────────────────────────────────────────
 */

/**
 * ⚠️⚠️ **JSON として保存されている列。**
 *   ⚠️ 移植元は `json_encode()` した文字列を TEXT 列へ入れている。
 *     読む側（画面）は `JSON.parse` する前提なので、
 *     **ここでオブジェクトに変換してはいけない**（PHP と同じ形で返す）。
 *   ⚠️ 既存データには改行や不揃いな空白が含まれるが、そのまま返す。
 */
/**
 * ⚠️⚠️ **メール本文のひな型。空なら実装側の既定を使う。**
 *   ⚠️ 移行時に既存行へ書き写していない。空のままにしておくこと。
 *   ⚠️ ① の `form_post` / `form_update` はこれらの列を知らない。
 *     そのため DB 側に `DEFAULT ''` を付けてある。
 */
const MAIL_TEMPLATE_COLUMNS = [
    'thanks_subject', 'thanks_body', 'internal_subject', 'internal_body',
] as const;

const JSON_COLUMNS = [
    'notice', 'name', 'kana', 'age', 'phone', 'mail',
    'address', 'question', 'shop', 'date', 'medium', 'attention',
] as const;

/** 画面から受け取る1件ぶん。⚠️ 値の検証は下の各関数で行う */
type FormBody = Record<string, unknown>;

interface FormRow extends RowDataPacket {
    [key: string]: unknown;
}

/** PHP と同じ応答の形 */
export interface FormResult {
    status: 'success' | 'empty' | 'duplicate' | 'error' | 'not_found';
    data?: unknown;
    message?: string;
}

/** ⚠️ 文字列として取り出す。undefined を SQL へ渡すとドライバが落ちる */
const str = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
};

/**
 * JSON 列へ入れる値。
 * ⚠️ 移植元の `json_encode($data['x'], JSON_UNESCAPED_UNICODE)` に相当する。
 *   ⚠️ 画面はオブジェクトを送ってくるので、ここで文字列化する。
 *   ⚠️ 既に文字列なら二重にエンコードしない（画面が古い形で送ってきた場合）。
 */
const jsonText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
};

/** `YYYY/MM/DD`。⚠️ 移植元の `date("Y/m/d")` と同じ形 */
const today = (): string => {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// 一覧（form_list）
// ---------------------------------------------------------------------------

/**
 * ブランドのフォーム一覧。
 * ⚠️ 移植元と同じく `SELECT` する列を絞っている（設定の中身は返さない）。
 */
export const runCampaignFormList = async (body: FormBody): Promise<FormResult> => {
    const brand = str(body.brand);
    if (brand === '') return { status: 'empty', data: null };

    const rows = await query<FormRow>(
        `SELECT registered_date, brand, url, tag, campaign, campaign_id
           FROM form_table
          WHERE brand = ?
          ORDER BY id DESC`,
        [brand]
    );

    // ⚠️ 0件のとき data は null。移植元がそう返しており、画面がそれを見ている
    return { status: rows.length > 0 ? 'success' : 'empty', data: rows.length > 0 ? rows : null };
};

// ---------------------------------------------------------------------------
// 1件取得（form_edit）
// ---------------------------------------------------------------------------

/**
 * 編集用に1件取る。
 *
 * ⚠️ 移植元は `WHERE brand = ? AND campaign_id = ?` に **`$data['id']`** を渡している。
 *   ⚠️ キー名が `id` なのに中身は `campaign_id` である。紛らわしいが画面がそう送るので合わせる。
 */
export const runCampaignFormDetail = async (body: FormBody): Promise<FormResult> => {
    const brand = str(body.brand);
    // ⚠️ 画面は `id` で送ってくる。`campaign_id` でも受けられるようにしておく
    const campaignId = str(body.id) !== '' ? str(body.id) : str(body.campaign_id);

    if (brand === '' || campaignId === '') return { status: 'empty', data: null };

    const rows = await query<FormRow>(
        'SELECT * FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1',
        [brand, campaignId]
    );

    return { status: rows.length > 0 ? 'success' : 'empty', data: rows[0] ?? null };
};

// ---------------------------------------------------------------------------
// 新規登録（form_post）
// ---------------------------------------------------------------------------

/**
 * 新しいフォーム設定を登録する。
 *
 * ⚠️ 既に同じ brand + campaign_id があれば `duplicate` を返して**何もしない**。
 *   移植元と同じ挙動。
 */
export const runCampaignFormInsert = async (body: FormBody): Promise<FormResult> => {
    const brand = str(body.brand);
    const campaignId = str(body.campaign_id);
    const campaign = str(body.campaign);

    if (brand === '' || campaignId === '') {
        return { status: 'error', message: 'ブランドとキャンペーンIDは必須です。' };
    }

    const exists = await query<FormRow>(
        'SELECT id FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1',
        [brand, campaignId]
    );
    if (exists.length > 0) {
        return { status: 'duplicate', message: `${campaign}の登録に失敗しました。` };
    }

    const columns = [
        'registered_date', 'campaign', 'campaign_id', 'url', 'tag', 'brand',
        'mail_to', 'mail_cc', 'redirect', 'thanks',
        ...MAIL_TEMPLATE_COLUMNS, ...JSON_COLUMNS,
    ];

    const values = [
        today(), campaign, campaignId, str(body.url), str(body.tag), brand,
        str(body.mail_to), str(body.mail_cc), str(body.redirect),
        // ⚠️ thanks は tinyint。true/false で来るので 1/0 に直す
        body.thanks === true || body.thanks === 1 || body.thanks === '1' ? 1 : 0,
        // ⚠️ ひな型は素の文字列。⚠️ JSON 化しないこと
        ...MAIL_TEMPLATE_COLUMNS.map(key => str(body[key])),
        ...JSON_COLUMNS.map(key => jsonText(body[key])),
    ];

    await execute(
        `INSERT INTO form_table (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values
    );

    return { status: 'success', message: `${campaign}の登録に成功しました。` };
};

// ---------------------------------------------------------------------------
// 更新（form_update）
// ---------------------------------------------------------------------------

/**
 * フォーム設定を更新する。
 *
 * ⚠️⚠️ **移植元は `WHERE campaign_id = :campaign_id` だけだった。**
 *   ⚠️ 登録側は `brand + campaign_id` で重複を見ているのに、
 *     更新側は brand を見ていない。
 *   ⚠️ そのため**別ブランドに同じ campaign_id があると巻き込んで更新していた**。
 *   ⚠️ ここでは brand も条件に加えている。**戻さないこと。**
 */
export const runCampaignFormUpdate = async (body: FormBody): Promise<FormResult> => {
    const brand = str(body.brand);
    const campaignId = str(body.campaign_id);
    const campaign = str(body.campaign);

    if (brand === '' || campaignId === '') {
        return { status: 'error', message: 'ブランドとキャンペーンIDは必須です。' };
    }

    const sets = [
        'registered_date = ?', 'campaign = ?', 'mail_to = ?', 'mail_cc = ?',
        'redirect = ?', 'thanks = ?',
        ...MAIL_TEMPLATE_COLUMNS.map(key => `${key} = ?`),
        ...JSON_COLUMNS.map(key => `${key} = ?`),
    ];

    const values = [
        today(), campaign, str(body.mail_to), str(body.mail_cc), str(body.redirect),
        body.thanks === true || body.thanks === 1 || body.thanks === '1' ? 1 : 0,
        ...MAIL_TEMPLATE_COLUMNS.map(key => str(body[key])),
        ...JSON_COLUMNS.map(key => jsonText(body[key])),
        brand, campaignId,
    ];

    const result = await execute(
        `UPDATE form_table SET ${sets.join(', ')} WHERE brand = ? AND campaign_id = ?`,
        values
    );

    /**
     * ⚠️⚠️ **更新できなかったことを黙って成功にしない。**
     *   ⚠️ 移植元は execute() が例外を投げなければ常に success を返しており、
     *     **0行更新でも「修正に成功しました」と出ていた。**
     */
    if (result.affectedRows === 0) {
        return { status: 'error', message: `${campaign}が見つかりませんでした。` };
    }

    return { status: 'success', message: `${campaign}の修正に成功しました。` };
};

// ---------------------------------------------------------------------------
// ブランド既定値（form_database）
// ---------------------------------------------------------------------------

/**
 * ブランドごとのフォーム既定値。
 *
 * ⚠️ 移植元は成功時に**行をそのまま**（status を付けずに）返している。
 *   画面がその形を見ているため、ここでも同じにする。
 */
export const runCampaignFormMaster = async (body: FormBody): Promise<unknown> => {
    const brand = str(body.brand);

    const rows = await query<FormRow>('SELECT * FROM form_database WHERE brand = ? LIMIT 1', [brand]);

    if (rows.length === 0) {
        return { status: 'not_found', message: '該当するブランドが見つかりません' };
    }

    return rows[0];
};
```

---

## `backend-express/src/features/campaignForm/mail.ts`

| | |
|---|---|
| 指示 | ② |
| 行数 | 211 |
| 備考 | ⚠️ ⑪・⑬ の修正も入っている |

```ts
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
        /**
         * ⚠️⚠️ **差出人名はブランドごとに変える。**
         *   ⚠️ 渡さないと `SMTP_FROM` の表示名（1つだけ）が出るため、
         *     **全ブランドが同じ名前で届く**。① は差し替えていた。
         */
        fromName: input.brandName,
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
        // ⚠️ 社内宛もブランド名で届く（① と同じ）
        fromName: input.brandName,
    });

    if (!ok) {
        // ⚠️ 社内が気づけないと反響が放置される。必ず残す
        logger.error(
            `campaign_form: 社内通知を送れませんでした campaign="${a.campaign}"`
            + ` name="${a.sei} ${a.mei}" mail="${a.mail}" phone="${a.phone}"`
        );
    }
};
```

---

## `backend-express/src/features/campaignForm/text.ts`

| | |
|---|---|
| 指示 | ② |
| 行数 | 79 |
| 備考 | - |

```ts
/**
 * 公開フォームから届いた値の正規化。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **正規表現ではなくコード番号で判定している。**
 *   ⚠️ 文字クラスにエスケープを書くと、編集の過程で
 *     **生の制御文字がソースに紛れ込む**ことがある（2026-09-15 に実際に起きた）。
 *   ⚠️ 見た目では気づけないので、判定は数値で書くこと。
 *
 * ⚠️ 制御文字はフォームからは来ないが、**curl では送れる**。
 *   混入すると一覧の表示や CSV 出力が壊れる。
 * ─────────────────────────────────────────────
 */

/** 改行のコード番号。⚠️ ソースに生の改行を書かないため定数で持つ */
const LF = 10;
const CR = 13;
const DEL = 127;

/**
 * 文字列として取り出し、長さで切る。
 *
 * ⚠️⚠️ **上限を超えてもエラーにせず切り詰める。**
 *   ⚠️ 長すぎるという理由で反響を捨てるのは損失が大きい
 *     （ambassador/inquiry.ts と同じ方針）。
 */
export const clean = (value: unknown, max: number): string => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'string' ? value : String(value);

    let out = '';
    for (const ch of text) {
        const code = ch.codePointAt(0) ?? 0;
        out += code < 32 || code === DEL ? ' ' : ch;
    }
    return out.split(' ').filter(part => part !== '').join(' ').slice(0, max);
};

/**
 * 自由記述。
 * ⚠️ **改行だけは残す。** 潰すと問い合わせ内容が1行になって読めない。
 */
export const cleanMultiline = (value: unknown, max: number): string => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'string' ? value : String(value);
    const nl = String.fromCharCode(LF);

    let out = '';
    for (const ch of text) {
        const code = ch.codePointAt(0) ?? 0;
        if (code === LF || code === CR) { out += nl; continue; }
        out += code < 32 || code === DEL ? ' ' : ch;
    }
    return out.split(nl).map(line => line.trim()).join(nl).trim().slice(0, max);
};

// ---------------------------------------------------------------------------
// 日時
// ---------------------------------------------------------------------------

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * `YYYY/MM/DD`。
 * ⚠️ 移植元の `date("Y/m/d")` と同じ形。
 *   ⚠️ ローカルの控えの PHP は `Y/m/dH:i:s`（**スペース無し**）で、
 *     `inquiry_date` の形式が2種類に割れていた。**こちらに統一する。**
 */
export const dateOnly = (d: Date): string =>
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;

/** `YYYY/MM/DD HH:MM:SS` */
export const dateTime = (d: Date): string =>
    `${dateOnly(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** `YmdHis`。⚠️ inquiry_id に使う */
export const stamp = (d: Date): string =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    + `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
```

---

## `frontend/src/components/campaign/brands.ts`

| | |
|---|---|
| 指示 | ② |
| 行数 | 50 |
| 備考 | - |

```ts
/**
 * キャンペーン画面で扱うブランド。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ここ以外にブランド一覧を書かないこと。**
 *   ⚠️ 2026-09-16 まで `CampaignList.tsx` と `FormBuilder.tsx` に
 *     同じ配列が別々に書かれていた。⚠️ 片方だけ増やすと、
 *     **一方の画面にだけ出ないブランド**ができる（エラーにならないので気づけない）。
 *
 * ⚠️ キーは `form_table.brand` に入っている値である。
 *   ⚠️ 表示名や `inquiry_customer.brand` の値とは**別物**。
 *     例: キーは `nagomi` だが、保存される brand は `なごみ`。
 *     ⚠️ 変換は ② の `features/campaignForm/brands.ts` が持っている。
 * ─────────────────────────────────────────────
 */

/**
 * ⚠️⚠️ **並び順に意味がある**（2026-09-16 の指示）。
 *   ⚠️ 五十音順でもキー順でもない。**この順で画面に出すこと。**
 */
export const CAMPAIGN_BRANDS = [
    'kh', 'djh', 'nagomi', '2l', 'jh', 'pg', 'fh', 'khg',
] as const;

export type CampaignBrand = (typeof CAMPAIGN_BRANDS)[number];

/**
 * 画面に出す表記。
 * ⚠️ キーをそのまま出さないこと（`2l` や `khg` では利用者に通じない）。
 */
const LABEL: Record<string, string> = {
    kh: '国分ハウジング',
    djh: 'デイジャストハウス',
    nagomi: 'なごみ工務店',
    '2l': '2Lhome',
    jh: 'ジャスフィーホーム',
    pg: 'PG HOUSE',
    fh: 'フルコミホーム',
    khg: '国分ハウジンググループ',
};

/** ⚠️ 知らないキーはそのまま返す。画面から消えるより、キーが見えるほうがよい */
export const brandLabel = (brand: string): string => LABEL[brand] ?? brand;

/**
 * ブランドのロゴ。
 * ⚠️ ① に置かれている画像を指している。⚠️ ファイル名はブランドキーと同じ。
 */
export const brandLogo = (brand: string): string =>
    `https://khg-marketing.info/dashboard/form/img/${brand}.png`;
```

---

## `frontend/src/components/campaign/campaignApi.ts`

| | |
|---|---|
| 指示 | ② |
| 行数 | 68 |
| 備考 | - |

```ts
import apiClient from '../../utils/apiClient';

/**
 * キャンペーンフォームの設定（`form_table`）を読み書きする。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-16。① の別API から ② Express へ移した。**
 *
 *   旧: `https://khg-marketing.info/api/` に `Authorization: form_list` 等で直接
 *   新: dashboard のゲートウェイ経由 → ② の `campaign_form:*`
 *
 *   ⚠️ 旧は**ダッシュボードの認証をまったく通っていなかった**
 *     （`Authorization` をルーティングに使っていたため、Token も送っていない）。
 *     ⚠️ URL を知っていれば誰でも全ブランドのフォーム設定を読み書きできた。
 *   ⚠️ `apiClient` を使うと Token が自動で付き、② 側で `auth: 'staff'` が効く。
 *
 * ⚠️⚠️ **`Authorization` ヘッダを自分で上書きしないこと。**
 *   ⚠️ 上書きすると apiClient の認証が壊れ、② が401を返す。
 *
 * ⚠️ 公開フォーム側（react/form_get）は**ここを通らない**。
 *   あちらは ② を直接叩き、失敗したら ① へ回す（別の経路）。
 * ─────────────────────────────────────────────
 */

/** ② が返す形。⚠️ 移植元の PHP と同じキーにしてある */
export interface CampaignApiResult<T = unknown> {
    status: 'success' | 'empty' | 'duplicate' | 'error' | 'not_found';
    data?: T;
    message?: string;
}

/** 一覧に出す1行 */
export interface CampaignListRow {
    registered_date: string;
    brand: string;
    url: string;
    tag: string;
    campaign: string;
    campaign_id: string;
}

/** `form_table` の1行。⚠️ JSON 列は文字列のまま入っている */
export type CampaignRow = Record<string, string>;

const call = async <T>(roll: string, body: Record<string, unknown>): Promise<T> => {
    const res = await apiClient.post('', { request: 'campaign_form', roll, ...body });
    return res.data as T;
};

/** ブランドのフォーム一覧 */
export const fetchList = (brand: string) =>
    call<CampaignApiResult<CampaignListRow[]>>('list', { brand });

/** 編集用に1件取る。⚠️ 移植元が `id` というキーで campaign_id を送っていたので合わせる */
export const fetchDetail = (brand: string, campaignId: string) =>
    call<CampaignApiResult<CampaignRow>>('detail', { brand, id: campaignId });

/** ブランドごとの既定値（form_database）。⚠️ 行がそのまま返る（status で包まれない） */
export const fetchMaster = (brand: string) =>
    call<CampaignRow & { status?: string; message?: string }>('master', { brand });

/** 新規登録 */
export const insertCampaign = (form: Record<string, unknown>) =>
    call<CampaignApiResult>('insert', form);

/** 更新 */
export const updateCampaign = (form: Record<string, unknown>) =>
    call<CampaignApiResult>('update', form);
```

---

## `frontend/src/components/campaign/formBuilderUtils.ts`

| | |
|---|---|
| 指示 | ② |
| 行数 | 270 |
| 備考 | ⚠️ ⑧ の `readSettings()` も入っている |

```ts
/**
 * 単体で動く HTML フォームを組み立てる。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **デザインは付けない。** LP 側の CSS に任せる。
 *   ⚠️ ここで見た目を作り込むと、貼り付け先のデザインと必ず喧嘩する。
 *
 * ⚠️⚠️ **通知先・サンクスメール・サンクスページはここに埋め込まない。**
 *   ⚠️ 生成した HTML は**誰でもソースを読める**。宛先を書くと、
 *     書き換えて任意の宛先へ送らせることができる（過去に実際そうなっていた）。
 *   ⚠️ それらは `form_table` にあり、② が `brand + campaign_id` で引く。
 *     ⚠️ HTML が送るのは**入力値と、どのキャンペーンかだけ**。
 *
 * ⚠️ 既存の iframe 埋め込み（form_table.tag）とは**別物**である。
 *   あちらは React アプリを読み込む。こちらは単体で完結する。
 * ─────────────────────────────────────────────
 */

/** ② のゲートウェイ。⚠️ 生成した HTML はここへ直接 POST する */
export const ENTRY_URL = 'https://api.khg-marketing.info/api/gateway';

/** 生成する入力欄 */
export interface BuilderField {
    /** ② が受け取るキー。⚠️ entry.ts の readAnswers と合わせること */
    key: string;
    label: string;
    /** `text` / `tel` / `email` / `date` / `textarea` / `select` */
    type: 'text' | 'tel' | 'email' | 'date' | 'textarea' | 'select';
    required: boolean;
    /** select のときの選択肢 */
    options?: string[];
}

/**
 * ⚠️⚠️ **選べる項目はここに載っているものだけ。**
 *   ⚠️ ② の `features/campaignForm/entry.ts` が読むキーと**必ず一致させる**こと。
 *     一致しないと「フォームには出るが保存されない項目」ができる。
 */
export const BUILDER_FIELDS: BuilderField[] = [
    { key: 'shop', label: '来場希望場所', type: 'select', required: false, options: [] },
    { key: 'sei', label: '姓', type: 'text', required: true },
    { key: 'mei', label: '名', type: 'text', required: true },
    { key: 'seiKana', label: 'せい', type: 'text', required: false },
    { key: 'meiKana', label: 'めい', type: 'text', required: false },
    { key: 'phone', label: '電話番号', type: 'tel', required: true },
    { key: 'mail', label: 'メールアドレス', type: 'email', required: true },
    { key: 'age', label: '年齢', type: 'select', required: false, options: ['20代', '30代', '40代', '50代', '60代以上'] },
    { key: 'zip', label: '郵便番号', type: 'text', required: false },
    { key: 'pref', label: '都道府県', type: 'text', required: false },
    { key: 'city', label: '市区町村', type: 'text', required: false },
    { key: 'town', label: '町名', type: 'text', required: false },
    { key: 'street', label: '番地', type: 'text', required: false },
    { key: 'date', label: '来場希望日', type: 'date', required: false },
    { key: 'time', label: '来場希望時間', type: 'select', required: false, options: [] },
    { key: 'medium', label: 'お問い合わせのきっかけ', type: 'select', required: false, options: [] },
    { key: 'question', label: 'ご要望・ご質問', type: 'textarea', required: false },
];

/**
 * ⚠️⚠️ **`form_table` の設定キーと、ここの項目キーの対応表。**
 *
 *   ⚠️ `form_table` は項目を JSON で持っており、1つの JSON が
 *     **複数の入力欄をまとめている**ことがある。
 *       `name`    → 姓・名（sei / mei）
 *       `kana`    → せい・めい（seiKana / meiKana）
 *       `date`    → 来場希望日・時間（date / time）
 *       `address` → 郵便番号〜番地（zip / pref / city / town / street）
 *
 *   ⚠️ そのため「設定の1項目 = 画面の1チェック」ではない。
 *     ⚠️ 取り違えると、**キャンペーンで聞いている項目が
 *       フォーム作成側に出てこない**（エラーにならないので気づけない）。
 */
export const SETTING_TO_FIELDS: Record<string, string[]> = {
    shop: ['shop'],
    name: ['sei', 'mei'],
    kana: ['seiKana', 'meiKana'],
    phone: ['phone'],
    mail: ['mail'],
    age: ['age'],
    address: ['zip', 'pref', 'city', 'town', 'street'],
    date: ['date', 'time'],
    medium: ['medium'],
    question: ['question'],
};

/** `readSettings` の戻り値 */
export interface SettingFlags {
    /** 項目キー → その項目を聞いているか */
    used: Record<string, boolean>;
    /** 項目キー → 必須か */
    required: Record<string, boolean>;
}

/**
 * キャンペーン設定から「どの項目を聞いているか」「どれが必須か」を読み取る。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`form_table` の設定 JSON は `bool` と `required` を別々に持っている。**
 *   `bool`     … その項目を聞くかどうか
 *   `required` … 必須かどうか
 *
 *   ⚠️ 以前は `bool` しか読んでおらず、必須は BUILDER_FIELDS の
 *     **ベタ書き**（姓・名・電話・メールだけ true）のままだった。
 *     ⚠️ そのため**キャンペーン側で必須にしている来場希望場所や
 *       来場希望日が、生成した HTML では必須にならなかった**
 *       （2026-09-16 の指摘）。
 *
 *   ⚠️ 公開フォーム（react/form_get の Form.tsx）も
 *     `parsed.required === true && parsed.bool === true` で判定している。
 *     ⚠️ **同じ読み方に揃えること。**片方だけ変えると
 *       iframe 版と HTML 版で必須項目が食い違う。
 *
 * ⚠️ 設定は列ごとに JSON 文字列。⚠️ 壊れていても落とさず、その項目だけ諦める。
 * ─────────────────────────────────────────────
 */
export const readSettings = (row: Record<string, string>): SettingFlags => {
    const used: Record<string, boolean> = {};
    const required: Record<string, boolean> = {};
    // ⚠️ まず全部 false にする。設定に無い項目が前の選択のまま残らないように
    for (const field of BUILDER_FIELDS) {
        used[field.key] = false;
        required[field.key] = false;
    }

    for (const [setting, keys] of Object.entries(SETTING_TO_FIELDS)) {
        const raw = row[setting];
        if (!raw) continue;

        let on = false;
        let must = false;
        try {
            const parsed = JSON.parse(raw) as { bool?: unknown; required?: unknown };
            on = parsed.bool === true;
            // ⚠️ 聞いていない項目を必須にはできない。⚠️ bool と併せて見る
            must = on && parsed.required === true;
        } catch {
            console.error(`[formBuilder] 設定の解釈に失敗しました（${setting}）`);
            continue;
        }

        if (on) {
            for (const key of keys) {
                used[key] = true;
                required[key] = must;
            }
        }
    }

    return { used, required };
};

/** ⚠️ HTML に値を埋めるときは必ず通す。属性と本文の両方で使える形にする */
const esc = (value: string): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const inputFor = (field: BuilderField): string => {
    const req = field.required ? ' required' : '';
    const name = esc(field.key);

    if (field.type === 'textarea') {
        return `      <textarea name="${name}" rows="4"${req}></textarea>`;
    }
    if (field.type === 'select') {
        const options = (field.options ?? [])
            .filter(o => o.trim() !== '')
            .map(o => `        <option value="${esc(o)}">${esc(o)}</option>`)
            .join('\n');
        return `      <select name="${name}"${req}>\n`
            + `        <option value="">選択してください</option>\n`
            + `${options}\n`
            + `      </select>`;
    }
    return `      <input type="${field.type}" name="${name}"${req}>`;
};

export interface BuildInput {
    brand: string;
    campaignId: string;
    campaign: string;
    fields: BuilderField[];
    /** 送信後に飛ばす先。⚠️ 空ならページ内に完了文言を出す */
    thanksUrl: string;
}

/**
 * 貼り付けるだけで動く HTML を作る。
 *
 * ⚠️ 生成物には**デザインを入れない**（class も付けない）。
 * ⚠️ 二重送信を防ぐため、送信中はボタンを無効にする。
 */
export const buildHtml = (input: BuildInput): string => {
    const rows = input.fields.map(field =>
        `    <p>\n`
        + `      <label>${esc(field.label)}${field.required ? '（必須）' : ''}</label><br>\n`
        + `${inputFor(field)}\n`
        + `    </p>`
    ).join('\n');

    const done = input.thanksUrl.trim() !== ''
        ? `        location.href = ${JSON.stringify(input.thanksUrl.trim())};`
        : `        form.innerHTML = '<p>送信しました。ありがとうございました。</p>';`;

    return `<!-- ${esc(input.campaign)} / ${esc(input.campaignId)} -->
<!-- ⚠️ 通知先とサンクスメールはダッシュボードのキャンペーン設定で管理しています。
     ⚠️ このHTMLには宛先を書かないでください（誰でもソースを読めます）。 -->
<form id="khg-form">
${rows}
    <p>
      <button type="submit" id="khg-submit">送信する</button>
    </p>
    <p id="khg-error" style="color:red" hidden></p>
</form>

<script>
(function () {
  var form = document.getElementById('khg-form');
  var button = document.getElementById('khg-submit');
  var error = document.getElementById('khg-error');

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    // ⚠️ 二重送信を防ぐ。押した直後に無効にする
    if (button.disabled) return;
    button.disabled = true;
    error.hidden = true;

    var body = {
      request: 'campaign_form',
      roll: 'entry',
      brand: ${JSON.stringify(input.brand)},
      campaign_id: ${JSON.stringify(input.campaignId)},
      campaign: ${JSON.stringify(input.campaign)},
      // ⚠️ どのページから送られたかを残す。反響の出どころが追える
      url: location.href,
      source: (new URLSearchParams(location.search)).get('utm_source') || ''
    };

    new FormData(form).forEach(function (value, key) { body[key] = value; });

    fetch(${JSON.stringify(ENTRY_URL)}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.status === 'success') {
${done}
          return;
        }
        throw new Error(data && data.message ? data.message : '登録に失敗しました');
      })
      .catch(function (e) {
        // ⚠️ 黙って失敗しない。反響1件は営業の機会そのもの
        console.error(e);
        error.textContent = '送信できませんでした。時間をおいて再度お試しください。';
        error.hidden = false;
        button.disabled = false;
      });
  });
})();
</script>
`;
};
```

---

## `frontend/src/components/campaign/FormBuilder.tsx`

| | |
|---|---|
| 指示 | ② |
| 行数 | 299 |
| 備考 | ⚠️ **コンポーネント。** ⚠️ ⑧ の必須チェック修正も入っている |

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { fetchDetail, fetchList, CampaignListRow } from './campaignApi';
import { BUILDER_FIELDS, BuilderField, buildHtml, readSettings } from './formBuilderUtils';
import { CAMPAIGN_BRANDS, brandLabel } from './brands';

/**
 * LP に貼り付けるための HTML フォームを作る。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **既存の「埋め込みタグ」とは別物である。**
 *   埋め込みタグ … iframe で React アプリを読み込む（キャンペーン作成タブ）
 *   ここ        … **単体で動く HTML**。LP の中に直接書ける
 *
 * ⚠️⚠️ **通知先・サンクスメールはここでは設定しない。**
 *   ⚠️ 生成した HTML は誰でもソースを読めるため、宛先を書くと
 *     書き換えて任意の宛先へ送らせることができる。
 *   ⚠️ それらは**キャンペーン設定（form_table）側**で管理する。
 *     ここは「どのキャンペーンに紐づけるか」を選ぶだけでよい。
 * ─────────────────────────────────────────────
 */

interface Props {
    activeTab: string | null;
}

/** form_table の JSON 列から選択肢を取り出す。⚠️ 壊れていても落とさない */
const optionsFrom = (raw: string | undefined, key: string): string[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const list = parsed[key];
        return Array.isArray(list) ? list.map(v => String(v)) : [];
    } catch {
        console.error(`[formBuilder] 設定の解釈に失敗しました: ${raw.slice(0, 80)}`);
        return [];
    }
};

const FormBuilder: React.FC<Props> = ({ activeTab }) => {
    const navigate = useNavigate();
    const [brand, setBrand] = useState('');
    const [list, setList] = useState<CampaignListRow[]>([]);
    const [campaignId, setCampaignId] = useState('');
    const [fields, setFields] = useState<BuilderField[]>(BUILDER_FIELDS);
    const [thanksUrl, setThanksUrl] = useState('');
    const [html, setHtml] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    // ---- ブランドを選んだらキャンペーン一覧を取る ----
    useEffect(() => {
        // ⚠️ 未選択のうちは叩かない。必ず0件が返るだけ
        if (!brand) { setList([]); setCampaignId(''); return; }

        const run = async () => {
            setError('');
            try {
                const res = await fetchList(brand);
                setList(res.data ?? []);
            } catch (e) {
                console.error('キャンペーン一覧の取得に失敗:', e);
                setError('キャンペーン一覧を取得できませんでした。');
                setList([]);
            }
        };
        run();
    }, [brand]);

    // ---- キャンペーンを選んだら、その設定から選択肢を取り込む ----
    useEffect(() => {
        if (!brand || !campaignId) {
            setFields(BUILDER_FIELDS);
            // ⚠️ 前に選んだキャンペーンのチェックが残らないようにする
            setUsed(Object.fromEntries(BUILDER_FIELDS.map(f => [f.key, false])));
            return;
        }

        const run = async () => {
            setError('');
            try {
                const res = await fetchDetail(brand, campaignId);
                const row = res.data;
                if (!row) {
                    setError('キャンペーン設定が見つかりませんでした。');
                    return;
                }

                /**
                 * ⚠️⚠️ **チェックと必須をキャンペーン設定に合わせる。**
                 *   ⚠️ そのフォームで実際に聞いている項目だけにチェックが入る。
                 *   ⚠️ 設定の1項目が複数の入力欄に対応することがある
                 *     （name → 姓・名 など）。対応表は formBuilderUtils.ts。
                 */
                const flags = readSettings(row);

                /**
                 * ⚠️ 選択肢はキャンペーン設定から取る。
                 *   ⚠️ 手で打ち直すと、iframe 版のフォームと**選択肢が食い違う**。
                 *     同じキャンペーンなのに店舗の一覧が違う、という状態になる。
                 *
                 * ⚠️⚠️ **必須も設定から取る**（2026-09-16 の指摘）。
                 *   ⚠️ BUILDER_FIELDS のベタ書きを残すと、キャンペーン側で
                 *     必須にしている項目が必須にならない。
                 */
                setFields(BUILDER_FIELDS.map(field => {
                    const required = flags.required[field.key] ?? false;
                    if (field.key === 'shop') return { ...field, required, options: optionsFrom(row.shop, 'shopName') };
                    if (field.key === 'time') return { ...field, required, options: optionsFrom(row.date, 'time') };
                    if (field.key === 'medium') return { ...field, required, options: optionsFrom(row.medium, 'mediumName') };
                    return { ...field, required };
                }));

                setUsed(flags.used);

                // ⚠️ サンクスページは設定側の値を初期値にする。変えたければ画面で直せる
                setThanksUrl(row.redirect ?? '');
            } catch (e) {
                console.error('キャンペーン設定の取得に失敗:', e);
                setError('キャンペーン設定を取得できませんでした。');
            }
        };
        run();
    }, [brand, campaignId]);

    const selected = list.find(item => item.campaign_id === campaignId);

    /**
     * 使う項目。
     * ⚠️⚠️ **選んだキャンペーンの設定と連動する**（2026-09-16 の指示）。
     *   ⚠️ キャンペーンを選ぶと、そのフォームで実際に聞いている項目に
     *     チェックが入る。⚠️ 手で変えてもよい。
     *   ⚠️ 未選択のうちは全部外しておく（既定で勝手に項目が入らないように）。
     */
    const [used, setUsed] = useState<Record<string, boolean>>(
        () => Object.fromEntries(BUILDER_FIELDS.map(f => [f.key, false]))
    );

    const generate = () => {
        if (!brand || !campaignId) {
            setError('ブランドとキャンペーンを選んでください。');
            return;
        }
        const chosen = fields.filter(f => used[f.key]);
        if (chosen.length === 0) {
            setError('項目を1つ以上選んでください。');
            return;
        }
        setError('');
        setCopied(false);
        setHtml(buildHtml({
            brand,
            campaignId,
            campaign: selected?.campaign ?? '',
            fields: chosen,
            thanksUrl,
        }));
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(html);
            setCopied(true);
        } catch {
            // ⚠️ 権限が無い環境がある。⚠️ 黙らずに手動コピーを促す
            setError('コピーできませんでした。テキストを選択してコピーしてください。');
        }
    };

    if (activeTab !== 'builder') return null;

    return (
        <div className="bg-light p-3 w-100">
            <div className="bg-white" style={{ width: '90%', maxWidth: '960px', margin: '0 auto', padding: '24px', paddingBottom: '120px' }}>

                <div className="fw-bold mb-1" style={{ fontSize: '15px' }}>LP用フォームHTMLの作成</div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', lineHeight: 1.8 }}>
                    貼り付けるだけで動く HTML を作ります。デザインは付かないので、LP 側のCSSで整えてください。<br />
                    通知先・サンクスメールは「キャンペーン作成」タブの設定がそのまま使われます。
                </div>

                {!error || <div className="mb-3" style={{ color: 'red', fontSize: '13px' }}>{error}</div>}

                {/* ---- ブランド ---- */}
                <div className="mb-3">
                    <div style={{ fontSize: '13px', marginBottom: '6px' }}>ブランド</div>
                    <select value={brand} onChange={e => { setBrand(e.target.value); setCampaignId(''); setHtml(''); }}
                        style={{ fontSize: '13px', padding: '4px 8px', minWidth: '220px' }}>
                        <option value="">選択してください</option>
                        {CAMPAIGN_BRANDS.map(b => <option key={b} value={b}>{brandLabel(b)}</option>)}
                    </select>
                </div>

                {/* ---- キャンペーン ---- */}
                <div className="mb-4">
                    <div style={{ fontSize: '13px', marginBottom: '6px' }}>キャンペーン</div>
                    <select value={campaignId} onChange={e => { setCampaignId(e.target.value); setHtml(''); }}
                        disabled={!brand}
                        style={{ fontSize: '13px', padding: '4px 8px', minWidth: '420px', maxWidth: '100%' }}>
                        <option value="">選択してください</option>
                        {list.map(item =>
                            <option key={item.campaign_id} value={item.campaign_id}>{item.campaign}</option>)}
                    </select>
                    {!brand || list.length > 0 ||
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                            このブランドのキャンペーンはまだありません。
                        </div>}

                    {/**
                      * ⚠️ ここからも新しいキャンペーンを作れるようにする（2026-09-16 の指示）。
                      *   ⚠️ 作成画面は「キャンペーン作成」タブと同じものを使う。
                      *     ⚠️ 別の作成画面を増やすと、設定の項目が食い違う。
                      */}
                    {!brand ||
                        <div style={{ marginTop: '10px' }}>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => navigate(`/editcampaign?brand=${brand}`)}
                                style={{ fontSize: '12px' }}
                            >
                                <i className="fa-solid fa-plus me-1"></i>新しいキャンペーンを作成
                            </Button>
                            <span className="text-muted ms-2" style={{ fontSize: '11px' }}>
                                作成後、この画面に戻って選び直してください。
                            </span>
                        </div>}
                </div>

                {/* ---- 項目 ---- */}
                <div className="mb-4">
                    <div style={{ fontSize: '13px', marginBottom: '6px' }}>項目</div>
                    <Table style={{ fontSize: '12px' }}>
                        <thead>
                            <tr><td style={{ width: '60px' }}>使う</td><td>項目</td><td style={{ width: '90px' }}>必須</td><td>選択肢</td></tr>
                        </thead>
                        <tbody>
                            {fields.map(field => (
                                <tr key={field.key}>
                                    <td style={{ verticalAlign: 'middle' }}>
                                        <input type="checkbox" checked={used[field.key] ?? false}
                                            onChange={() => setUsed(prev => ({ ...prev, [field.key]: !prev[field.key] }))} />
                                    </td>
                                    <td style={{ verticalAlign: 'middle' }}>{field.label}</td>
                                    <td style={{ verticalAlign: 'middle' }}>
                                        <input type="checkbox" checked={field.required} disabled={!used[field.key]}
                                            onChange={() => setFields(prev => prev.map(f =>
                                                f.key === field.key ? { ...f, required: !f.required } : f))} />
                                    </td>
                                    <td style={{ verticalAlign: 'middle', color: '#666' }}>
                                        {field.type !== 'select' ? '—'
                                            : (field.options ?? []).length === 0
                                                ? 'キャンペーン設定に選択肢がありません'
                                                : (field.options ?? []).join(' / ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>

                {/* ---- サンクスページ ---- */}
                <div className="mb-4">
                    <div style={{ fontSize: '13px', marginBottom: '6px' }}>送信後に飛ばす先（空ならページ内に完了文言）</div>
                    <input type="text" value={thanksUrl} onChange={e => setThanksUrl(e.target.value)}
                        style={{ fontSize: '13px', padding: '4px 8px', width: '100%' }} />
                </div>

                <div className="mb-4">
                    {/* ⚠️ `hover` は共通CSSで下線が付く。ボタンには要らないので使わない */}
                    <button onClick={generate}
                        style={{ backgroundColor: 'blue', color: '#fff', border: 'none', borderRadius: '20px', padding: '8px 28px', fontSize: '13px', cursor: 'pointer' }}>
                        HTMLを作成
                    </button>
                </div>

                {/* ---- 生成結果 ---- */}
                {!html ||
                    <div>
                        <div className="d-flex align-items-center mb-2" style={{ gap: '12px' }}>
                            <div style={{ fontSize: '13px' }}>生成されたHTML</div>
                            <button onClick={copy}
                                style={{ backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '14px', padding: '2px 14px', fontSize: '12px', cursor: 'pointer' }}>
                                コピー
                            </button>
                            {!copied || <span style={{ fontSize: '12px', color: 'green' }}>コピーしました</span>}
                        </div>
                        <textarea value={html} readOnly rows={22}
                            onFocus={e => e.target.select()}
                            style={{ width: '100%', fontSize: '11px', fontFamily: 'monospace', border: '1px solid #D3D3D3', borderRadius: '5px', padding: '8px' }} />
                    </div>}
            </div>
        </div>
    );
};

export default FormBuilder;
```

---

## `backend/forms/form-proxy.php`

| | |
|---|---|
| 指示 | ③ |
| 行数 | 130 |
| 備考 | ⚠️ **8サイトへ未配布。** ⚠️ `index.php` にリネームして置く |

```php
<?php

/**
 * 公開フォーム用のプロキシ。
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
 * ⚠️⚠️ **このファイルには認証情報を書かないこと。**
 *   ⚠️ 転送するだけの役目である。DB には触らない。
 *
 * ⚠️⚠️ **2026-09-16 に2点を直した。**
 *
 *   1. メールヘッダに入る宛先（mail_to / mail_cc）を**無害化**する
 *   2. デバッグ出力（error_log）を**削除**した
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

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authToken = $headers['Authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? null);

/**
 * ⚠️⚠️ **デバッグ出力は置かないこと。**
 *   ⚠️ 2026-09-16 まで、ここに次の3行があった:
 *       error_log('=== DEBUG HEADERS === ' . print_r($headers, true));
 *       error_log('=== DEBUG HTTP_AUTHORIZATION === ' . ...);
 *       error_log('=== DEBUG TOKEN === ' . ...);
 *   ⚠️ **全リクエストのヘッダをサーバーのログに書き続けていた**（8サイトすべてで）。
 *   ⚠️ 消しても動作は変わらない。戻さないこと。
 */

if (json_last_error() !== JSON_ERROR_NONE || empty($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

if (!$authToken) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Missing Authorization header']);
    exit;
}

/**
 * ⚠️⚠️ **メールヘッダに入る宛先を無害化する。**
 *
 *   ⚠️ 転送先の PHP は `mail_cc` を**検証せずに `Cc:` の行へ入れている**。
 *     改行を含む値を送れば `Bcc:` を追加でき、
 *     **貴社ドメインから任意の宛先へ送信できてしまう**（ヘッダインジェクション）。
 *   ⚠️ 悪用されるとドメインの評判が落ち、**正規のメールが届かなくなる**。
 *
 *   ⚠️ 本来は転送先で直すべきだが、あちらには DB の接続情報が書かれており
 *     触る範囲を小さくしたい。⚠️ **入口で落としておく。**
 *   ⚠️ 転送先を直したあとも、この処理は**残しておいてよい**（二重の防御）。
 *
 * ⚠️⚠️ **改行は「削除」ではなく「カンマに置換」する。**
 *   ⚠️ 削除すると `ok@a.jp\r\nBcc: 悪い宛先` が `ok@a.jpBcc: 悪い宛先` という
 *     1つの不正な文字列になり、**正当な宛先まで丸ごと消える**
 *     （社内通知の Cc が届かなくなる）。
 *   ⚠️ カンマに置き換えれば、正当な分は残り、注入された行だけが落ちる。
 */
function safeAddressList($value)
{
    if (!is_string($value) || $value === '') {
        return '';
    }

    // ⚠️ 改行（CR / LF / タブ）を区切りに変える。ここが本体
    $value = str_replace(array("\r", "\n", "\t"), ',', $value);

    $clean = array();
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && filter_var($one, FILTER_VALIDATE_EMAIL)) {
            $clean[] = $one;
        }
    }

    // ⚠️ 宛先が増えすぎないよう上限を掛ける。通常は数件しかない
    $clean = array_slice(array_unique($clean), 0, 20);

    return implode(',', $clean);
}

// ⚠️ 宛先として使われうるキーだけを通す。⚠️ 他の値は加工しない
foreach (array('mail_to', 'mail_cc') as $key) {
    if (isset($data[$key])) {
        $data[$key] = safeAddressList($data[$key]);
    }
}

$targetUrl = 'https://khg-marketing.info/api/';

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: ' . $authToken
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
```

---

## `backend-express/src/features/metaAds.ts`

| | |
|---|---|
| 指示 | ④ |
| 行数 | 85 |
| 備考 | - |

```ts
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/pool';

/**
 * 他社広告ライブラリ（`meta_ads`）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/meta_ads.php`
 *
 *   ⚠️ 移植元は **1つの request で読み書きを兼ねていた**（`id` があれば更新）。
 *     ⚠️ 許可リストに request 名だけで載せると、
 *       **書き込みまで一緒に ② へ流れる**。roll で分けること。
 *
 * ⚠️⚠️ **競合他社のバナーを週1で集めたものである**（`advertiser_area = '自社'` も含む）。
 *   ⚠️ `ad_hash` が UNIQUE なので **1広告1行**。
 *     ⚠️ 同じ広告が複数の取得日にまたがらないため、
 *       **「いつまで出ていたか」は分からない。** 掲載期間を作らないこと。
 * ─────────────────────────────────────────────
 */

interface AdRow extends RowDataPacket {
    id: number;
    advertiser_name: string;
    advertiser_area: string;
    advertiser_period: string;
    ad_title: string;
    image_filename: string;
    lp_url: string;
    scraped_date: string;
    bookmark: number | null;
}

/**
 * 一覧。
 *
 * ⚠️ 移植元は `SELECT *` だった。⚠️ `ad_hash` と `created_at` は画面で使わないので返さない
 *   （3,814行あり、無駄に太らせない）。
 *
 * ⚠️⚠️ **`scraped_date` を文字列で返すこと。**
 *   ⚠️ `date` 型のまま JSON にすると環境によって `2026-09-09T00:00:00.000Z` になり、
 *     ⚠️ 画面の日付表示とソートが**PHP版とずれる**。
 */
export const runMetaAdsList = async (): Promise<{ ads: AdRow[] }> => {
    const ads = await query<AdRow>(
        `SELECT id, advertiser_name, advertiser_area, advertiser_period,
                ad_title, image_filename, lp_url,
                DATE_FORMAT(scraped_date, '%Y-%m-%d') AS scraped_date,
                bookmark
           FROM meta_ads
          ORDER BY scraped_date DESC, id DESC`
    );

    return { ads };
};

/**
 * ブックマークの更新。
 *
 * ⚠️ 移植元は `id` があれば更新、無ければ一覧という分岐だった。
 *   ⚠️ ここでは roll で分けている（許可リストで書き込みだけを絞れるようにするため）。
 */
export const runMetaAdsBookmark = async (
    body: Record<string, unknown>
): Promise<{ status: 'success' | 'error'; message: string }> => {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
        return { status: 'error', message: '対象が指定されていません。' };
    }

    // ⚠️ 0 / 1 以外を入れさせない。列は tinyint
    const bookmark = Number(body.bookmark) === 1 ? 1 : 0;

    const result = await execute('UPDATE meta_ads SET bookmark = ? WHERE id = ?', [bookmark, id]);

    /**
     * ⚠️⚠️ **0行なら成功にしない。**
     *   ⚠️ 移植元は実行できれば必ず success を返しており、
     *     **存在しない id でも「更新しました」**と答えていた。
     */
    if (result.affectedRows === 0) {
        return { status: 'error', message: '対象が見つかりませんでした。' };
    }

    return { status: 'success', message: 'ブックマークを更新しました' };
};
```

---

## `frontend/src/components/header/MetaAdsSummary.tsx`

| | |
|---|---|
| 指示 | ④ |
| 行数 | 196 |
| 備考 | ⚠️ **コンポーネント** |

```tsx
import React from 'react';
import { Table, Badge } from 'react-bootstrap';
import { AdvertiserSummary, TitleSummary, MonthlyRow } from './metaAdsUtils';

/**
 * 他社広告ライブラリの集計表示。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **「掲載期間」は出していない。出せない。**
 *   ⚠️ `advertiser_period` は**開始日だけ**で終了日が無く、
 *     `ad_hash` が UNIQUE なので同じ広告が複数の取得日にまたがらない。
 *   ⚠️ **「いつまで出ていたか」は分からない。**
 *     期間らしき指標を足さないこと（読む人が誤解する）。
 *
 * ⚠️⚠️ **取れなかった件数を必ず画面に出す。**
 *   ⚠️ 掲載開始日は実測で**30%（1,132件）が空か壊れている**。
 *     黙って除くと「先月は少なかった」と誤読される。
 * ─────────────────────────────────────────────
 */

interface Props {
    advertisers: AdvertiserSummary[];
    titles: TitleSummary[];
    monthly: { rows: MonthlyRow[]; unknown: number; since: string; beforeSince: number };
    /** 絞り込み後の総バナー数。⚠️ 表の合計と突き合わせられるように出す */
    total: number;
}

const MetaAdsSummary: React.FC<Props> = ({ advertisers, titles, monthly, total }) => {
    // ⚠️ グラフの縦幅を決めるための最大値。0除算を避ける
    const max = monthly.rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;

    return (
        <div className="mb-4">

            {/* ---- 月別の推移 ---- */}
            <div className="bg-white shadow-sm rounded p-3 mb-3">
                <div className="fw-bold text-secondary mb-1" style={{ fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-chart-column me-2"></i>掲載開始月ごとの新規バナー数
                </div>

                {/**
                  * ⚠️⚠️ **収集開始より前の月を出さない理由を必ず添える。**
                  *   ⚠️ 出すと右肩上がりのグラフに見えるが、実態は
                  *     「収集開始時点でまだ出ていた長期掲載の広告」が混ざっているだけ。
                  */}
                <div className="text-muted mb-3" style={{ fontSize: '0.7rem', lineHeight: 1.7 }}>
                    ⚠️ 収集を始めたのが {monthly.since.replace('-', '/')} のため、それ以前の月は
                    「収集開始時点でまだ出ていた広告」しか映りません。グラフからは外しています
                    （{monthly.beforeSince.toLocaleString()}件）。<br />
                    ⚠️ 掲載開始日が取れなかった {monthly.unknown.toLocaleString()}件 も含みません。
                </div>

                {monthly.rows.length === 0 ? (
                    <div className="text-muted py-3 text-center" style={{ fontSize: '0.8rem' }}>
                        表示できる月がありません。
                    </div>
                ) : (
                    <div className="d-flex align-items-end gap-2" style={{ height: '140px' }}>
                        {monthly.rows.map(row => (
                            <div key={row.month} className="d-flex flex-column align-items-center" style={{ flex: '1 1 0', minWidth: 0 }}>
                                <div className="text-secondary" style={{ fontSize: '0.7rem' }}>{row.count}</div>
                                <div
                                    // ⚠️ 高さは最大値との比。⚠️ 0件でも線が見えるよう下限を持たせる
                                    style={{
                                        width: '100%', backgroundColor: '#0d6efd', borderRadius: '3px 3px 0 0',
                                        height: `${Math.max(4, (row.count / max) * 100)}px`,
                                    }}
                                    title={`${row.month}：${row.count}件`}
                                />
                                <div className="text-muted text-nowrap" style={{ fontSize: '0.65rem', marginTop: '4px' }}>
                                    {row.month.slice(5)}月
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ---- 広告主ごと ---- */}
            <div className="bg-white shadow-sm rounded p-3 mb-3">
                <div className="fw-bold text-secondary mb-1" style={{ fontSize: '0.85rem' }}>
                    <i className="fa-regular fa-building me-2"></i>広告主ごと
                    <span className="text-muted fw-normal ms-2" style={{ fontSize: '0.75rem' }}>
                        {advertisers.length}社 / {total.toLocaleString()}バナー
                    </span>
                </div>
                <div className="text-muted mb-2" style={{ fontSize: '0.7rem' }}>
                    ⚠️「1見出しあたり」は、同じ見出しで画像やリンクを変えた別バナーが何本あるか。
                    大きいほど1つの訴求を作り込んでいます。
                </div>

                <div className="table-responsive">
                    <Table hover className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                        <thead className="table-light text-secondary text-nowrap">
                            <tr>
                                <th className="fw-normal py-2">広告主</th>
                                <th className="fw-normal py-2 text-end">バナー</th>
                                <th className="fw-normal py-2 text-end">見出し</th>
                                <th className="fw-normal py-2 text-end">1見出しあたり</th>
                                <th className="fw-normal py-2">エリア</th>
                                <th className="fw-normal py-2">最新の掲載開始</th>
                            </tr>
                        </thead>
                        <tbody>
                            {advertisers.map(row => (
                                <tr key={row.advertiser}>
                                    <td className="fw-bold text-dark">{row.advertiser}</td>
                                    <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.banners.toLocaleString()}</td>
                                    <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.titles.toLocaleString()}</td>
                                    <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.perTitle.toFixed(1)}</td>
                                    <td>
                                        <div className="d-flex flex-wrap gap-1">
                                            {row.areas.map(a => (
                                                <Badge key={a.area} bg="light" text="dark" className="fw-normal border">
                                                    {a.area} {a.count}
                                                </Badge>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="text-nowrap">
                                        {row.latestStart === ''
                                            // ⚠️ 空欄にせず「不明」と書く。空欄だと0件と区別できない
                                            ? <span className="text-muted">不明</span>
                                            : row.latestStart.replace(/-/g, '/')}
                                        {row.unknownStart === 0 || (
                                            <span className="text-muted ms-2" style={{ fontSize: '0.7rem' }}>
                                                （開始日不明 {row.unknownStart}）
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>

            {/* ---- 見出しごと ---- */}
            <div className="bg-white shadow-sm rounded p-3">
                <div className="fw-bold text-secondary mb-1" style={{ fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-quote-left me-2"></i>複数バナーを展開している見出し
                    <span className="text-muted fw-normal ms-2" style={{ fontSize: '0.75rem' }}>
                        上位50件 / 全{titles.length.toLocaleString()}種
                    </span>
                </div>
                <div className="text-muted mb-2" style={{ fontSize: '0.7rem' }}>
                    ⚠️ 同じ見出しを複数の広告主が使っていることがあります（スクレイピングの取りこぼし分を含む）。
                </div>

                <div className="table-responsive">
                    <Table hover className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                        <thead className="table-light text-secondary text-nowrap">
                            <tr>
                                <th className="fw-normal py-2" style={{ width: '50%' }}>見出し</th>
                                <th className="fw-normal py-2">広告主</th>
                                <th className="fw-normal py-2 text-end">バナー</th>
                                <th className="fw-normal py-2">掲載開始</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ⚠️ slice は非破壊。元の配列を並べ替えない */}
                            {titles.slice(0, 50).map(row => (
                                <tr key={row.title}>
                                    <td className="text-dark" style={{
                                        display: '-webkit-box', WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                    }}>
                                        {row.title}
                                    </td>
                                    <td>
                                        <div className="d-flex flex-wrap gap-1">
                                            {row.advertisers.map(a => (
                                                <Badge key={a} bg="secondary" className="fw-normal">{a}</Badge>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.banners}</td>
                                    <td className="text-nowrap text-muted" style={{ fontSize: '0.75rem' }}>
                                        {row.firstStart === ''
                                            ? '不明'
                                            : row.firstStart === row.latestStart
                                                ? row.firstStart.replace(/-/g, '/')
                                                : `${row.firstStart.replace(/-/g, '/')} 〜 ${row.latestStart.replace(/-/g, '/')}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default MetaAdsSummary;
```

---

## `frontend/src/components/header/metaAdsUtils.ts`

| | |
|---|---|
| 指示 | ④ |
| 行数 | 221 |
| 備考 | - |

```ts
/**
 * 他社広告ライブラリの集計。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **実データを見たうえでの前提**（2026-09-16 / 3,814行）
 *
 *   `advertiser_period` … **掲載開始日**。取得日より後のものが0件なので確定
 *   `scraped_date`      … 取得日（週1）
 *   `ad_hash`           … UNIQUE。**1広告1行**
 *
 * ⚠️⚠️ **「掲載期間」は作れない。**
 *   ⚠️ `advertiser_period` は開始日だけで終了日が無く、
 *     `ad_hash` が UNIQUE なので同じ広告が複数の取得日にまたがらない。
 *   ⚠️ **「いつまで出ていたか」は分からない。**
 *     期間を出したつもりの指標を作らないこと。
 *
 * ⚠️⚠️ **`advertiser_period` の2割強は日付として使えない。**
 *   空 822件 / 日付でない 310件（例: `2026/09/08に・合計アクティブ時間20時間`）
 *   ⚠️ スクレイピングの取りこぼしである。
 *   ⚠️ 黙って落とすと**集計から静かに消える**ので、必ず「不明」として数える。
 * ─────────────────────────────────────────────
 */

export type AdData = {
    id: string | number;
    advertiser_name: string;
    advertiser_area: string;
    advertiser_period: string;
    ad_title: string;
    image_filename: string;
    scraped_date: string;
    lp_url: string;
    bookmark?: number;
};

/**
 * 掲載開始日を `YYYY-MM` にする。
 * ⚠️ 日付として読めないものは null。⚠️ 呼び出し側が「不明」として数えること。
 */
export const startMonth = (period: string): string | null => {
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec((period ?? '').trim());
    return m ? `${m[1]}-${m[2]}` : null;
};

/** 掲載開始日（並べ替え用）。⚠️ 読めないものは空文字で末尾に寄る */
export const startDate = (period: string): string => {
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec((period ?? '').trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

// ---------------------------------------------------------------------------
// 広告主ごと
// ---------------------------------------------------------------------------

export interface AdvertiserSummary {
    advertiser: string;
    /** バナー数（＝行数）。⚠️ 出稿回数ではない */
    banners: number;
    /** 見出しの種類 */
    titles: number;
    /**
     * 1見出しあたりの展開数。
     * ⚠️ 同じ見出しで画像やLPを変えた別バナーが何本あるか。
     *   ⚠️ 大きいほど「1つの訴求を作り込んでいる」と読める。
     */
    perTitle: number;
    /** エリア別の内訳。⚠️ 多い順 */
    areas: { area: string; count: number }[];
    /** 最新の掲載開始日。⚠️ 読めるものが無ければ空 */
    latestStart: string;
    /** ⚠️ 掲載開始日が取れなかった件数 */
    unknownStart: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const summarizeByAdvertiser = (ads: AdData[]): AdvertiserSummary[] => {
    const map = new Map<string, AdData[]>();
    for (const ad of ads) {
        const key = ad.advertiser_name ?? '';
        const list = map.get(key);
        if (list) list.push(ad); else map.set(key, [ad]);
    }

    const rows: AdvertiserSummary[] = [];

    map.forEach((list, advertiser) => {
        const titles = new Set(list.map(a => (a.ad_title ?? '').trim()));

        const areaCount = new Map<string, number>();
        for (const a of list) {
            const area = (a.advertiser_area ?? '').trim() || '不明';
            areaCount.set(area, (areaCount.get(area) ?? 0) + 1);
        }

        const starts = list.map(a => startDate(a.advertiser_period)).filter(v => v !== '');

        rows.push({
            advertiser,
            banners: list.length,
            titles: titles.size,
            // ⚠️ 0除算はしない（titles が 0 になることは無いが念のため）
            perTitle: titles.size === 0 ? 0 : round1(list.length / titles.size),
            areas: [...areaCount.entries()]
                .map(([area, count]) => ({ area, count }))
                .sort((a, b) => b.count - a.count),
            // ⚠️ sort は破壊的。元の配列を壊さないよう作った配列に対して行う
            latestStart: starts.length === 0 ? '' : starts.slice().sort()[starts.length - 1],
            unknownStart: list.length - starts.length,
        });
    });

    return rows.sort((a, b) => b.banners - a.banners);
};

// ---------------------------------------------------------------------------
// 見出しごと
// ---------------------------------------------------------------------------

export interface TitleSummary {
    title: string;
    /** この見出しで出している広告主。⚠️ 複数のことがある */
    advertisers: string[];
    /** 展開しているバナー数 */
    banners: number;
    firstStart: string;
    latestStart: string;
}

/**
 * ⚠️⚠️ **SQL で数えた値と一致しないことがある。**
 *   ⚠️ MySQL の既定の照合（`utf8mb4_general_ci`）は大文字小文字などを
 *     **同一視する**が、ここは厳密一致で数えている。
 *   ⚠️ 実測（2026-09-16）: 複数バナーを持つ見出しは
 *       SQL の既定照合 … 555
 *       厳密一致（＝ここ）… 554
 *     ⚠️ SQL 側で確かめるときは `GROUP BY BINARY TRIM(ad_title)` にすること。
 *
 * ⚠️ 空の見出しは 720 件ある（スクレイピングの取りこぼし）。⚠️ 集計しない。
 *   ⚠️ `テキストなし` という見出しも 148 件あるが、**そのまま数えている**
 *     （広告主が実際に使っている表記かもしれず、勝手に捨てない）。
 */
export const summarizeByTitle = (ads: AdData[]): TitleSummary[] => {
    const map = new Map<string, AdData[]>();
    for (const ad of ads) {
        const key = (ad.ad_title ?? '').trim();
        // ⚠️ 見出しが空の行は集計しない（1つの巨大な塊になって読めなくなる）
        if (key === '') continue;
        const list = map.get(key);
        if (list) list.push(ad); else map.set(key, [ad]);
    }

    const rows: TitleSummary[] = [];

    map.forEach((list, title) => {
        const starts = list.map(a => startDate(a.advertiser_period)).filter(v => v !== '').sort();
        rows.push({
            title,
            advertisers: [...new Set(list.map(a => a.advertiser_name))],
            banners: list.length,
            firstStart: starts[0] ?? '',
            latestStart: starts[starts.length - 1] ?? '',
        });
    });

    return rows.sort((a, b) => b.banners - a.banners);
};

// ---------------------------------------------------------------------------
// 月別の推移
// ---------------------------------------------------------------------------

export interface MonthlyRow {
    month: string;
    count: number;
}

/**
 * 掲載開始月ごとの新規バナー数。
 *
 * ⚠️⚠️ **日付が取れなかった件数を別に返す。**
 *   ⚠️ 合計に混ぜると「先月は少なかった」と誤読される。
 */
export const summarizeByMonth = (ads: AdData[]): {
    rows: MonthlyRow[];
    unknown: number;
    /** ⚠️ 収集を始めた月。これより前は信用できない（下の注記を参照） */
    since: string;
    /** ⚠️ 収集開始より前の月に落ちた件数。⚠️ グラフには出さないが必ず数える */
    beforeSince: number;
} => {
    const count = new Map<string, number>();
    let unknown = 0;

    /**
     * ⚠️⚠️ **収集を始めた月より前は、グラフとして読んではいけない。**
     *   ⚠️ 収集開始は `scraped_date` の最小値（実測 2026-06-23）。
     *   ⚠️ それ以前の月に入るのは「収集開始時点でまだ出ていた＝長期掲載の広告」だけで、
     *     **その月に実際どれだけ出稿されたかではない。**
     *   ⚠️ そのまま並べると右肩上がりのグラフに見えるが、**実態は収集開始の影響**である。
     */
    const scraped = ads.map(a => (a.scraped_date ?? '').slice(0, 7)).filter(v => v !== '');
    const since = scraped.length === 0 ? '' : scraped.slice().sort()[0];

    for (const ad of ads) {
        const month = startMonth(ad.advertiser_period);
        if (!month) { unknown += 1; continue; }
        count.set(month, (count.get(month) ?? 0) + 1);
    }

    const all = [...count.entries()]
        .map(([month, c]) => ({ month, count: c }))
        .sort((a, b) => a.month.localeCompare(b.month));

    const rows = since === '' ? all : all.filter(r => r.month >= since);
    const beforeSince = all
        .filter(r => since !== '' && r.month < since)
        .reduce((s, r) => s + r.count, 0);

    return { rows, unknown, since, beforeSince };
};
```

---

## `backend-express/src/features/lostList.ts`

| | |
|---|---|
| 指示 | ⑥ |
| 行数 | 76 |
| 備考 | - |

```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 失注一覧（`master_data`）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/lostList.php`
 *
 * ⚠️⚠️ **移植元は `master_data` を全件返していた。**
 *   ⚠️ 画面（LostStatusList.tsx）は受け取ったあとで
 *     `status === '失注'` かつ 2026-06-01 以降に絞り込んでいる。
 *   ⚠️ つまり**使わない行まで全部送っていた**。
 *
 * ⚠️ ここでは SQL 側で `status = '失注'` に絞る。
 *   ⚠️ 日付の絞り込みは**画面に残す**。
 *     ⚠️ 起点（2026-06-01）が画面側の定数で、
 *       ここに写すと**片方だけ変わって食い違う**ため。
 *
 * ⚠️ 返す列は移植元と同じにすること。
 *   ⚠️ 画面は列名をそのまま使っている（`customized_input_...` を含む）。
 * ─────────────────────────────────────────────
 */

interface LostRow extends RowDataPacket {
    id: string;
    customer: string;
    status: string;
}

/**
 * ⚠️⚠️ **列と別名は移植元から1文字も変えないこと。**
 *   ⚠️ `customized_input_01JRF9CZSW65A151WR30NA4PB3`（詳細な失注理由）と
 *     `customized_input_01JSE7H4MQES619NBWX6PQDFRH` は
 *     **別名を付けずそのままの名前**で使われている。
 *   ⚠️ 読みやすい名前に変えると画面の「未入力」判定が壊れる。
 */
const SELECT_SQL = `
  SELECT
    id,
    COALESCE(customer_contacts_name, '') AS customer,
    COALESCE(in_charge_store, '') AS shop,
    COALESCE(in_charge_user, '') AS staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
    COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
    COALESCE(
      DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
      DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
      ''
    ) AS register,
    COALESCE(sales_promotion_name, '') AS medium,
    COALESCE(status, '') AS status,
    COALESCE(rank_period, '') AS rank_period,
    COALESCE(call_status, '') AS call_status,
    COALESCE(cancel_status, '') AS cancel_status,
    COALESCE(show_dashboard, 0) AS trash,
    COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
    COALESCE(full_address, '') AS full_address,
    COALESCE(hp_campaign, '') AS hp_campaign,
    COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
    COALESCE(introduction_person_category, '') AS introduction_person_category,
    COALESCE(competitor_lost_contract_reason, '') AS competitor_lost_contract_reason,
    COALESCE(competitors_text, '') AS competitors_text,
    COALESCE(competitor_name, '') AS competitor_name,
    COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') AS event,
    COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') AS customized_input_01JRF9CZSW65A151WR30NA4PB3,
    COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH,
    COALESCE(k_snap, '') AS k_snap
  FROM master_data
  WHERE status = '失注'
`;

export const runLostList = async (): Promise<{ customer: LostRow[] }> => {
    const customer = await query<LostRow>(SELECT_SQL);
    return { customer };
};
```

---

## `backend-express/src/features/campaignSummary.ts`

| | |
|---|---|
| 指示 | ⑨ |
| 行数 | 75 |
| 備考 | - |

```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * キャンペーン別の集計（campaign/CampaignSummary.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/campaignSummary.php`
 *
 * ⚠️⚠️ **列名・別名は移植元から1文字も変えないこと。**
 *   ⚠️ 画面は `register` / `interview` / `screening` / `appointment` /
 *     `contract` の5つを**日付文字列のまま**受け取り、
 *     「値があるか」で来場数・次アポ数・契約数を数えている。
 *   ⚠️ 別名を変えると集計が全部0になる（エラーは出ない）。
 *
 * ⚠️⚠️ **`step_migration_item_...` のどれがどの段階かは
 *   DB のコメントではなく、この対応表を正とすること。**
 *     01J82Z5F13B6QVM6X0TCWZHW99 … 反響日（register）
 *     01J82Z5F1GQB02S1DEBZPBFDW7 … 初回面談（interview）
 *     01JSE0CRECT96FMYTZ1ZREC3QR … 資金審査（screening）
 *     01JSENACS2FC422ZHEZWNSXNYA … 次アポ（appointment）
 *     01J82Z5F1RR18Z792C7KZS88QG … 契約（contract）
 *
 * ⚠️ 絞り込み（期間・ブランド・店舗・キャンペーン名）は**画面に残す**。
 *   ⚠️ 期間の起点が画面側の定数（getYearMonthArray(2025, 6)）で、
 *     ここに写すと**片方だけ変わって食い違う**ため。
 * ─────────────────────────────────────────────
 */

interface CampaignRow extends RowDataPacket {
    register: string;
    hp_campaign: string;
    in_charge_store: string;
}

interface ShopRow extends RowDataPacket {
    brand: string;
    shop: string;
}

/**
 * ⚠️ `hp_campaign <> ''` は移植元のまま。
 *   ⚠️ キャンペーン名の無い反響は集計の対象外（画面も使っていない）。
 */
const CAMPAIGN_SQL = `
  SELECT
    COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') AS register,
    COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') AS interview,
    COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') AS screening,
    COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') AS appointment,
    COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') AS contract,
    COALESCE(hp_campaign, '') AS hp_campaign,
    COALESCE(in_charge_store, '') AS in_charge_store
  FROM master_data
  WHERE hp_campaign <> ''
`;

/** ⚠️ `show_flag = 1` は移植元のまま。閉店した店舗を選択肢に出さないため */
const SHOP_SQL = `
  SELECT brand, shop, section, area
  FROM shop_list
  WHERE show_flag = 1
`;

export const runCampaignSummary = async (): Promise<{
    campaign: CampaignRow[];
    shop: ShopRow[];
}> => {
    // ⚠️ 移植元と同じく2つまとめて返す。画面が1回の通信で両方使う
    const [campaign, shop] = await Promise.all([
        query<CampaignRow>(CAMPAIGN_SQL),
        query<ShopRow>(SHOP_SQL),
    ]);
    return { campaign, shop };
};
```

---

## `backend-express/src/features/campaignForm/mailTemplate.ts`

| | |
|---|---|
| 指示 | ⑪ |
| 行数 | 201 |
| 備考 | - |

```ts
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
```

---

## `frontend/src/components/campaign/mailTemplateFields.ts`

| | |
|---|---|
| 指示 | ⑪ |
| 行数 | 71 |
| 備考 | - |

```ts
/**
 * メール本文のひな型に使える差し込み語。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の `campaignForm/mailTemplate.ts` の PLACEHOLDERS と必ず揃えること。**
 *   ⚠️ 片方だけ増やすと「画面には出るが効かない語」ができ、
 *     **打った本人は気づけないまま顧客へ届く**。
 *
 * ⚠️⚠️ **通知先アドレスの語は作らないこと。**
 *   ⚠️ 顧客宛の本文に社内の宛先を書けてしまう。
 *
 * ⚠️ 既定の文面は**ここに書かない**（② が持っている）。
 *   ⚠️ 写すと、既定を直しても画面の表示だけ古いままになる。
 * ─────────────────────────────────────────────
 */

export interface Placeholder {
    /** `{{ }}` の中に書く語 */
    key: string;
    /** 画面に出す説明 */
    note: string;
}

export const PLACEHOLDERS: Placeholder[] = [
    { key: 'お名前', note: '姓と名（間に半角空白）' },
    { key: '姓', note: '姓だけ' },
    { key: '名', note: '名だけ' },
    { key: 'お名前カナ', note: 'せいとめい' },
    { key: 'お問い合わせ内容', note: '入力項目の一覧（未入力の行は出ません）' },
    { key: 'キャンペーン名', note: '' },
    { key: 'ブランド名', note: '例）国分ハウジング' },
    { key: '受付日時', note: '社内通知メール向け' },
    { key: '来場希望場所', note: '' },
    { key: '来場希望日', note: '' },
    { key: '来場希望時間', note: '' },
    { key: '携帯番号', note: '' },
    { key: 'メールアドレス', note: '' },
    { key: '年齢', note: '' },
    { key: '事前アンケート', note: '案内文ごと。URLが無いブランドでは何も出ません' },
    { key: '事前アンケートURL', note: 'URLだけ' },
];

const KNOWN = new Set(PLACEHOLDERS.map(p => p.key));

/**
 * ひな型に書かれた「知らない語」を拾う。
 *
 * ⚠️⚠️ **知らない語は ② でもそのまま残る**（黙って消さない）。
 *   ⚠️ 消してしまうと打ち間違いに誰も気づけない。
 *   ⚠️ そのぶん、保存前にここで知らせる。
 *
 * @returns 重複を除いた語の一覧。順番は書かれた順
 */
export const unknownPlaceholders = (template: string): string[] => {
    const found: string[] = [];
    const seen = new Set<string>();

    // ⚠️ ② の正規表現と同じにすること（40文字まで・入れ子なし）
    const pattern = /\{\{([^{}]{1,40})\}\}/g;
    let match = pattern.exec(template);
    while (match !== null) {
        const key = match[1].trim();
        if (!KNOWN.has(key) && !seen.has(key)) {
            seen.add(key);
            found.push(key);
        }
        match = pattern.exec(template);
    }

    return found;
};
```

---

## `backend/forms/khg-api-form-register.snippet.php`

| | |
|---|---|
| 指示 | ⑪ |
| 行数 | 325 |
| 備考 | ⚠️ **下書き。そのまま動かすものではない。** ⚠️ ① へ未反映 |

```php
<?php

/**
 * ① `https://khg-marketing.info/api/` の index.php に差し替える部分。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **このファイルはそのまま動かすものではない。**
 *   ⚠️ 既存の `index.php` の中の
 *       elseif ($authHeader === 'form_register') { ... }
 *     の**中身**と、`registration` / `homepage` の**メール送信部分**を
 *     ここの関数呼び出しに置き換えるための下書きである。
 *
 * ⚠️⚠️ **認証情報は絶対に書かないこと。** 既存の $dbh をそのまま使う。
 *
 * ⚠️⚠️ **なぜ必要か**
 *   ⚠️ ② が落ちて ① へフォールバックしたとき、
 *     **ダッシュボードで編集した文面が効かない**ままになる。
 *   ⚠️ どちらの経路でも同じ文面が届くようにする（2026-09-16 の指示）。
 *
 * ⚠️⚠️ **ついでに塞ぐ穴**
 *   ⚠️ 現在の `form_register` は通知先を**リクエストから**受け取り、
 *     `'Cc:' . $data['mail_cc']` と**文字列でヘッダを組み立てている**。
 *     改行を仕込めば `Bcc:` を足せ、**任意の宛先へ送信できる**。
 *   ⚠️ 下では form_table から引き、`khgSafeAddressList()` で無害化する。
 *
 * ⚠️⚠️ **ブランド名の誤字も直すこと。**
 *   ⚠️ 既存の `form_register` / `registration:homepage` は
 *     `$brand_name = "フルコミコーム";` となっている（**「ホーム」が正しい**）。
 *   ⚠️ ② は 2026-09-16 に `フルコミホーム` へ直した。
 *     ⚠️ ここを直さないと、**② が落ちて ① へ退避したときだけ誤字で届く。**
 * ─────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// 1. 宛先の無害化（form-proxy.php と同じ考え方）
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **改行は「削除」ではなく「区切り」として扱う。**
 *   ⚠️ 削除すると `ok@a.jp\r\nBcc: 悪い宛先` が1つの不正な文字列になり、
 *     **正当な宛先まで丸ごと消える**（社内通知が届かなくなる）。
 */
function khgSafeAddressList($value)
{
    if (!is_string($value) || $value === '') return '';
    $value = str_replace(array("\r", "\n", "\t"), ',', $value);
    $clean = array();
    foreach (explode(',', $value) as $one) {
        $one = trim($one);
        if ($one !== '' && filter_var($one, FILTER_VALIDATE_EMAIL)) $clean[] = $one;
    }
    // ⚠️ 宛先が増えすぎないよう上限を掛ける。通常は数件しかない
    return implode(',', array_slice(array_unique($clean), 0, 20));
}

/** ⚠️ 件名はヘッダに入る。⚠️ 改行を必ず落とす */
function khgSanitizeHeader($value)
{
    return trim(str_replace(array("\r", "\n"), ' ', (string)$value));
}

// ---------------------------------------------------------------------------
// 1-2. 店舗名（⚠️ 空のときに「店舗未設定」を付ける）
// ---------------------------------------------------------------------------

/**
 * `inquiry_customer.shop` に入れる値。
 *
 * ⚠️⚠️ **既存の bindValue を、この関数の呼び出しに置き換えること。**
 *
 *   置き換え前（`form_register` と `registration:homepage` の2か所）:
 *     $stmt->bindValue(':shop',
 *         $brand_value === 'PG HOUSE' ? 'PGH' . $data['shop'] : $brand_value . $data['shop'],
 *         PDO::PARAM_STR);
 *
 *   置き換え後:
 *     $stmt->bindValue(':shop', khgShopValue($brand_value, $data['shop'] ?? ''), PDO::PARAM_STR);
 *
 * ⚠️⚠️ **来場希望場所を聞かないフォームが89件ある。**
 *   ⚠️ そのとき今は `KH` のように**接頭辞だけ**が入り、
 *     反響一覧で店舗が分からず営業が困る（2026-09-16 の指示）。
 *   ⚠️ 空のときは `KH店舗未設定` のようにする。② と同じ扱い。
 *
 * ⚠️ PG HOUSE だけ接頭辞が 'PGH'。⚠️ brand の値をそのまま使わない。
 */
function khgShopValue($brandValue, $shop)
{
    $prefix = ($brandValue === 'PG HOUSE') ? 'PGH' : (string)$brandValue;
    $shop = trim((string)$shop);
    return $prefix . ($shop === '' ? '店舗未設定' : $shop);
}

// ---------------------------------------------------------------------------
// 2. 差し込み（② の mailTemplate.ts と同じ規則）
// ---------------------------------------------------------------------------

/**
 * 入力項目の一覧（`{{お問い合わせ内容}}` の中身）。
 * ⚠️ 並びと文言は ② と同じにすること。社内がこの順で目を通している。
 */
function khgDetailBlock($d, $html)
{
    $br = $html ? '<br>' : "\n";
    $e  = $html
        ? function ($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
        : function ($v) { return (string)$v; };

    $line = function ($label, $value) use ($br, $e) {
        $value = trim((string)$value);
        return $value === '' ? '' : $label . '：' . $e($value) . $br;
    };

    $address = '';
    if (trim((string)($d['zip'] ?? '')) !== '') {
        $address = '郵便番号：' . $e($d['zip']) . $br
            . '住所：' . $e(($d['pref'] ?? '') . ($d['city'] ?? '') . ($d['town'] ?? '') . ($d['street'] ?? '')) . $br;
    }

    return $line('来場希望場所', $d['shop'] ?? '')
        . 'お名前：' . $e($d['sei'] ?? '') . ' ' . $e($d['mei'] ?? '') . $br
        . 'お名前（カナ）：' . $e($d['seiKana'] ?? '') . ' ' . $e($d['meiKana'] ?? '') . $br
        . $line('来場希望日', $d['date'] ?? '')
        . $line('来場希望時間', $d['time'] ?? '')
        . $line('携帯番号', $d['phone'] ?? '')
        . $line('メールアドレス', $d['mail'] ?? '')
        . $line('年齢', $d['age'] ?? '')
        . $address
        . $line('お問い合わせのきっかけ', $d['medium'] ?? '')
        . $line('その他ご質問・ご要望', $d['question'] ?? '');
}

/**
 * ⚠️⚠️ **URL が空なら案内ごと出さない。**
 *   ⚠️ 今は日付か時間があれば見出しを必ず出しており、
 *     アンケートを持たないブランドでは
 *     **URL 無しで見出しだけ**が届いている。
 */
function khgQuestionnaireBlock($d, $questionnaire, $html)
{
    if ($questionnaire === '') return '';
    if (($d['date'] ?? '') === '' && ($d['time'] ?? '') === '') return '';
    $br = $html ? '<br>' : "\n";
    return $br . '▼事前アンケートでギフトカードプレゼント！' . $br . $br . $questionnaire . $br;
}

/**
 * ひな型に値を差し込む。
 *
 * ⚠️⚠️ **知らない語はそのまま残す。**
 *   ⚠️ 黙って空にすると、打ち間違いに誰も気づけないまま顧客へ届く。
 * ⚠️ ② の `render()` と**同じ語・同じ正規表現**にすること。
 */
function khgRender($template, $d, $brandName, $receivedAt, $questionnaire, $html)
{
    $br = $html ? '<br>' : "\n";
    $e  = $html
        ? function ($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
        : function ($v) { return (string)$v; };

    $table = array(
        'お名前'           => $e($d['sei'] ?? '') . ' ' . $e($d['mei'] ?? ''),
        '姓'               => $e($d['sei'] ?? ''),
        '名'               => $e($d['mei'] ?? ''),
        'お名前カナ'       => $e($d['seiKana'] ?? '') . ' ' . $e($d['meiKana'] ?? ''),
        'お問い合わせ内容' => khgDetailBlock($d, $html),
        'キャンペーン名'   => $e($d['campaign'] ?? ''),
        'ブランド名'       => $e($brandName),
        '受付日時'         => $e($receivedAt),
        '来場希望場所'     => $e($d['shop'] ?? ''),
        '来場希望日'       => $e($d['date'] ?? ''),
        '来場希望時間'     => $e($d['time'] ?? ''),
        '携帯番号'         => $e($d['phone'] ?? ''),
        'メールアドレス'   => $e($d['mail'] ?? ''),
        '年齢'             => $e($d['age'] ?? ''),
        '事前アンケート'   => khgQuestionnaireBlock($d, $questionnaire, $html),
        '事前アンケートURL' => $e($questionnaire),
    );

    $out = preg_replace_callback(
        '/\{\{([^{}]{1,40})\}\}/u',
        function ($m) use ($table) {
            $key = trim($m[1]);
            // ⚠️ 知らない語はそのまま返す（消さない）
            return array_key_exists($key, $table) ? $table[$key] : $m[0];
        },
        $template
    );

    // ⚠️ HTML のときだけ改行を <br> にする。画面では改行で編集している
    return $html ? preg_replace('/\r?\n/', $br, $out) : $out;
}

/** ⚠️ 空白だけの入力も「空」として扱う。件名の無いメールを飛ばさない */
function khgPick($stored, $fallback)
{
    return trim((string)$stored) === '' ? $fallback : (string)$stored;
}

// ---------------------------------------------------------------------------
// 3. 既定の文面（⚠️ ② の mailTemplate.ts と同じ文面にすること）
// ---------------------------------------------------------------------------

define('KHG_DEFAULT_THANKS_SUBJECT', '{{ブランド名}}/お問い合わせありがとうございます。');

define('KHG_DEFAULT_THANKS_BODY',
    "{{お名前}} 様\n"
    . "お問い合わせを受け付けました。\n\n"
    . "お問い合わせ内容は以下となります。\n\n"
    . "{{お問い合わせ内容}}"
    . "\nこちらのメールは配信用のため返信できません。\n"
    . "ご意見・ご要望はご予約の店舗までお寄せください。\n\n"
    . "※お問い合わせいただいた日時が18:00以降または火曜日、水曜日の場合、翌営業日以降のご連絡となりますのであらかじめご了承ください。\n"
    . "{{事前アンケート}}");

/** ⚠️ 末尾の署名を必ず連結すること（今は孤立した式になっていて本文に入っていない） */
define('KHG_DEFAULT_MEMBER_BODY',
    "{{お名前}} 様\n\n"
    . "お世話になっております。\nデイジャストハウスです。\n\n"
    . "この度は、会員登録にお申込みいただき、誠にありがとうございます。\n登録が無事完了いたしました。\n\n"
    . "限定コンテンツログイン情報をお送りいたします。\n大切に保管をお願いいたします。\n\n"
    . "───────────────────────────────\n"
    . "●会員限定公開プラン　ログイン情報\n"
    . "───────────────────────────────\n\n"
    . "ユーザー名：dayjust\n"
    . "パスワード：plan\n\n"
    . "厳選プランページURL：\nhttps://day-just-house.com/plan/\n\n"
    . "上記ご案内したログイン情報より弊社ホームページの会員限定公開プランの閲覧が可能です。\n\n"
    . "デイジャストハウスではお客様との出会いを大切に誠実に丁寧に対応させていただきます。\nなんでもお気軽にご相談・お問い合わせください。\n\n"
    . "デイジャストハウス");

define('KHG_DEFAULT_INTERNAL_SUBJECT', '{{ブランド名}}/{{キャンペーン名}}からの登録がありました。');

define('KHG_DEFAULT_INTERNAL_BODY',
    "{{キャンペーン名}}からの登録がありました。\n\n"
    . "お問合わせ日時：{{受付日時}}\n\n"
    . "====================\nお客様情報\n====================\n"
    . "{{お問い合わせ内容}}"
    . "====================\n"
    . "※のちほどダッシュボードへ反映されます。\n");

define('KHG_MEMBER_CAMPAIGN_ID', '20240000_djh_kyotsu_member');

// ---------------------------------------------------------------------------
// 4. メール2通を送る
// ---------------------------------------------------------------------------

/**
 * 反響のメールを送る。
 *
 * ⚠️⚠️ **通知先・送信可否・文面はすべて form_table から引く。**
 *   ⚠️ `$data['mail_to']` / `$data['mail_cc']` / `$data['thanks']` は
 *     **ブラウザから来た値**なので使わないこと。
 *
 * @param PDO    $dbh          既存の接続をそのまま渡す
 * @param array  $data         リクエスト（顧客の入力）
 * @param string $brandName    メールの差出人名・件名に使う
 * @param string $questionnaire 事前アンケートのURL（無ければ空文字）
 */
function khgSendCampaignMails($dbh, $data, $brandName, $questionnaire)
{
    $stmt = $dbh->prepare(
        'SELECT mail_to, mail_cc, thanks, thanks_subject, thanks_body, internal_subject, internal_body'
        . ' FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1'
    );
    $stmt->execute(array($data['brand'] ?? '', $data['campaign_id'] ?? ''));
    $form = $stmt->fetch(PDO::FETCH_ASSOC);

    // ⚠️ 設定が無いフォームからの送信。⚠️ 反響は保存済みなので黙って戻る
    if (!$form) return;

    $receivedAt = date('Y/m/d H:i:s');

    // ---- 顧客宛（プレーンテキスト） ----
    if ((int)$form['thanks'] === 1 && !empty($data['mail'])) {
        $defaultBody = (($data['campaign_id'] ?? '') === KHG_MEMBER_CAMPAIGN_ID)
            ? KHG_DEFAULT_MEMBER_BODY
            : KHG_DEFAULT_THANKS_BODY;

        $subject = khgRender(khgPick($form['thanks_subject'], KHG_DEFAULT_THANKS_SUBJECT), $data, $brandName, $receivedAt, $questionnaire, false);
        $message = khgRender(khgPick($form['thanks_body'], $defaultBody), $data, $brandName, $receivedAt, $questionnaire, false);

        mb_language('Japanese');
        mb_internal_encoding('UTF-8');

        $headers = array();
        $headers[] = 'From: ' . mb_encode_mimeheader($brandName, 'ISO-2022-JP') . ' <pgcloud@khg-marketing.info>';
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-Type: text/plain; charset=ISO-2022-JP';
        $headers[] = 'Content-Transfer-Encoding: 7bit';

        $to = khgSafeAddressList($data['mail']);
        if ($to !== '') {
            mb_send_mail(
                $to,
                khgSanitizeHeader($subject),
                mb_convert_encoding($message, 'ISO-2022-JP', 'UTF-8'),
                implode("\r\n", $headers)
            );
        }
    }

    // ---- 社内宛（HTML） ----
    $to = khgSafeAddressList($form['mail_to']);
    // ⚠️ 通知先が無いフォームは実在する。⚠️ エラーにはしない
    if ($to === '') return;

    $cc = khgSafeAddressList($form['mail_cc']);

    $subjectResponse = khgRender(khgPick($form['internal_subject'], KHG_DEFAULT_INTERNAL_SUBJECT), $data, $brandName, $receivedAt, $questionnaire, false);
    $bodyResponse    = khgRender(khgPick($form['internal_body'], KHG_DEFAULT_INTERNAL_BODY), $data, $brandName, $receivedAt, $questionnaire, true);

    $message = '<html lang="ja"><head><title>' . htmlspecialchars($brandName, ENT_QUOTES, 'UTF-8')
        . '</title></head><body><div>' . $bodyResponse . '</div></body></html>';

    /**
     * ⚠️⚠️ **Cc は無害化した値だけを入れること。**
     *   ⚠️ ここに $data の値をそのまま入れると、改行で Bcc を足され
     *     **任意の宛先へ送信できる**（元の実装がそうなっている）。
     */
    $headersResponse = 'From:' . khgSanitizeHeader($brandName) . ' <pgcloud@khg-marketing.info>' . "\r\n"
        . ($cc === '' ? '' : 'Cc:' . $cc . "\r\n")
        . 'Content-type: text/html; charset=UTF-8';

    mail($to, khgSanitizeHeader($subjectResponse), $message, $headersResponse);
}
```

---

## `backend/scripts/sql/2026-09-16_form_mail_template.sql`

| | |
|---|---|
| 指示 | ⑪ |
| 行数 | 22 |
| 備考 | ⚠️ **本番適用済み** |

```sql
-- ---------------------------------------------------------------------------
-- キャンペーンフォームのメール本文を編集できるようにする（2026-09-16 の指示）
--
-- ⚠️⚠️ **DEFAULT '' を必ず付けること。**
--   ⚠️ ① の `khg-marketing.info/api/` にある `form_post` は
--     これらの列を知らないまま INSERT する。
--   ⚠️ 既定値が無いと **新規登録がまるごと失敗する**。
--
-- ⚠️⚠️ **`notice_*` という名前にしないこと。**
--   ⚠️ `form_table.notice` は既にあり、**フォーム画面の「注意書き」**である。
--     社内通知メールと取り違えると事故る。ここでは `internal_*` を使う。
--
-- ⚠️⚠️ **既存340件へ本文を書き写さない。**
--   ⚠️ 空のときは実装側の既定文面を使う（mailTemplate.ts の DEFAULT_*）。
--   ⚠️ 書き写すと、将来ひな型を直しても**古い本文が全件に残り続ける**。
-- ---------------------------------------------------------------------------

ALTER TABLE form_table
  ADD COLUMN thanks_subject   TEXT     NOT NULL DEFAULT '' COMMENT 'サンクスメールの件名。空なら既定',
  ADD COLUMN thanks_body      LONGTEXT NOT NULL DEFAULT '' COMMENT 'サンクスメールの本文。空なら既定',
  ADD COLUMN internal_subject TEXT     NOT NULL DEFAULT '' COMMENT '社内通知メールの件名。空なら既定',
  ADD COLUMN internal_body    LONGTEXT NOT NULL DEFAULT '' COMMENT '社内通知メールの本文。空なら既定';
```

---

## `backend/forms/form-htaccess.txt`

| | |
|---|---|
| 指示 | ⑫ |
| 行数 | 46 |
| 備考 | ⚠️ `form/.htaccess` として置く。⚠️ **未設置** |

```apache
# ---------------------------------------------------------------------------
# 公開フォーム用の .htaccess
#
# 配置先: 各ブランドサイトの `form/.htaccess`（KHG は `khg/form/.htaccess`）
#   ⚠️ ファイル名は `.htaccess`。⚠️ このファイル名（.txt）のまま置かないこと。
#
# ─────────────────────────────────────────────
# ⚠️⚠️ **なぜ必要か（2026-09-16 に実際に起きた）**
#
#   ⚠️ `index.html` に Cache-Control が無く、ブラウザが勝手にキャッシュしていた。
#   ⚠️ 古い `index.html` は**古い JS** を指す。
#   ⚠️ その古い JS がサーバーに残っていたため**普通に読めてしまい**、
#     ⚠️ **移行前のフォームが動き続けた。**
#
#   ⚠️ 症状: 送信すると関係のない置き場所へ飛び、**メールも届かない**。
#     ⚠️ 配布した側は新しい画面が出ているので**気づけない**。
#
# ⚠️⚠️ **assets/ は逆に長くキャッシュさせてよい。**
#   ⚠️ ファイル名にハッシュが付くため、中身が変われば名前が変わる。
#   ⚠️ 古い名前が読まれることはない。
# ─────────────────────────────────────────────

# ⚠️ index.html は毎回確かめさせる。⚠️ ここを緩めると上の事故が再発する
<FilesMatch "^index\.html$">
    <IfModule mod_headers.c>
        Header set Cache-Control "no-cache, must-revalidate"
        Header set Pragma "no-cache"
    </IfModule>
</FilesMatch>

# ⚠️ ハッシュ付きの資材は長期キャッシュでよい
<FilesMatch "\.(js|css|woff2?|png|jpg|jpeg|gif|svg)$">
    <IfModule mod_headers.c>
        Header set Cache-Control "public, max-age=31536000, immutable"
    </IfModule>
</FilesMatch>

# ⚠️⚠️ **Authorization ヘッダを PHP へ渡す。**
#   ⚠️ サーバーによっては削られ、プロキシが
#     `Missing Authorization header` を返して**フォームが動かなくなる**。
#   ⚠️ 既に動いているサイトでは不要だが、付けても害はない。
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTP:Authorization} ^(.*)$
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]
</IfModule>
```
