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
