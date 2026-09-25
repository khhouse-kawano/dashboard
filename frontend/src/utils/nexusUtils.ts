/**
 * Nexus（自社の別システム）へ顧客データを移行できる形かどうかを判定する。
 *
 * ⚠️⚠️ **移行のルールは2つだけ**（2026-09-25 の指示）。
 *   1. ふりがなが **カタカナ**
 *   2. 顧客名の姓名間に **半角スペース**
 *
 * ⚠️ **連絡先・住所は判定に入れないこと。**
 *   予約なしで来場した顧客など、**聞き取れずに空のままになる欄**である。
 *   必須にすると入力できない顧客が出る。
 *
 * ⚠️ 判定するのは **氏名①・フリガナ①だけ**（2026-09-25 にオーナーが指定）。
 *   氏名②（配偶者など）は空のことが多く、含めると大半が false になる。
 *
 * ⚠️ 対象は **注文事業のみ**。建売分譲・中古リノベの画面には入れていない。
 */

/** ひらがな。⚠️ `ゝ ゞ`（U+309D/309E）は下の KANA_ITERATION で別に扱う */
const HIRAGANA_RANGE = /[ぁ-ゖ]/u;

/**
 * ひらがな → カタカナ。
 *
 * ⚠️ `ぁ-ゖ` に **0x60 を足すだけ**でカタカナになる
 *   （小書きの ぁぃぅ、濁点つきの がざだば、`ゔ` もこの範囲に入る）。
 * ⚠️ 繰り返し記号だけは範囲外なので個別に置き換える。
 * ⚠️ **長音符（ー）・中黒（・）・スペースはそのまま残す。**
 */
const KANA_ITERATION: Record<string, string> = {
    'ゝ': 'ヽ', // ゝ → ヽ
    'ゞ': 'ヾ', // ゞ → ヾ
};

export const hiraToKata = (value: string): string =>
    (value ?? '')
        .replace(/[ぁ-ゖ]/gu, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
        .replace(/[ゝゞ]/gu, (char) => KANA_ITERATION[char] ?? char);

/** ひらがなが1文字でも混ざっているか。⚠️ 空文字は false（未入力は咎めない） */
export const hasHiragana = (value: string): boolean =>
    HIRAGANA_RANGE.test(value ?? '') || /[ゝゞ]/u.test(value ?? '');

/**
 * カタカナだけで書かれているか。
 *
 * ⚠️ 許すのは **カタカナ・長音符・中黒・スペース**だけ。
 *   ⚠️ 空文字は false を返す（移行できる形ではないため）。
 */
export const isKatakanaOnly = (value: string): boolean => {
    const trimmed = (value ?? '').trim();
    if (trimmed === '') return false;
    return /^[ァ-ヺーヽヾ・\s　]+$/u.test(trimmed);
};

/**
 * 姓名が半角スペースで分かれているか。
 *
 * ⚠️⚠️ **全角スペースは通さない。** Nexus 側が半角しか受け付けない。
 * ⚠️ 前後の空白は数えない（`' 国分太郎'` は分かれていない）。
 */
export const hasHalfWidthSpace = (value: string): boolean => {
    const trimmed = (value ?? '').trim();
    if (trimmed === '') return false;
    return / /u.test(trimmed);
};

/**
 * Nexus へ連携する顧客ランク。
 *
 * ⚠️⚠️ **Eランクと未設定は連携しない**（2026-09-25 の指示）。
 * ⚠️ 値は `TableRank.tsx` の option と同じ文字列。
 *   ⚠️ **`Sランク` のように「ランク」まで含めて持っている。**
 *   ⚠️ 顧客データベースの表示だけ `.replace('ランク','')` で落としているので、
 *     ⚠️ **判定は落とす前の値で行うこと。**
 */
export const NEXUS_RANKS: string[] = ['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク'];

/** ⚠️ 顧客ランクの列は `customized_input_01J82Z5F366ZQ897PXWF6H5ZAM` */
export const RANK_KEY = 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM';

export const isNexusRank = (rank?: string): boolean =>
    NEXUS_RANKS.includes((rank ?? '').trim());

/** ⚠️ 一覧・編集のどちらからも同じ判定を通すための素の関数 */
const nexusOk = (name?: string, kana?: string, rank?: string): boolean =>
    hasHalfWidthSpace(name ?? '')
    && isKatakanaOnly(kana ?? '')
    && hasHalfWidthSpace(kana ?? '')
    && isNexusRank(rank);

/**
 * Nexus へ移行できる顧客か。
 *
 * ⚠️⚠️ **条件は4つ**（2026-09-25 に 3・4 を追加）。
 *   1. 氏名①の姓名間に半角スペース
 *   2. フリガナ①がカタカナ
 *   3. ⚠️ **フリガナ①の姓名間にも半角スペース**
 *   4. ⚠️ **顧客ランクが S〜D**
 *
 * ⚠️ 画面では **この結果で印を出すだけ**である。
 *   ⚠️⚠️ **保存は止めない**（2026-09-25 に alert をやめ、欄の下に赤字を出す形にした）。
 */
export const isNexus = (information: Record<string, string>): boolean =>
    nexusOk(
        information?.customer_contacts_name,
        information?.customer_contacts_name_kana,
        information?.[RANK_KEY]
    );

/**
 * 一覧の行用。
 *
 * ⚠️ 顧客一覧APIは `customer` / `customer_contacts_name_kana` / `rank` という別名で返す。
 *   ⚠️ **中身の判定は isNexus と同じ**（どちらも nexusOk を通る）。
 */
export const isNexusRow = (name?: string, kana?: string, rank?: string): boolean =>
    nexusOk(name, kana, rank);

/**
 * お客様名の欄に出す注意書き。
 *
 * ⚠️⚠️ **保存は止めない。** 出るのは赤字のメッセージだけである。
 *   ⚠️ 連絡先や住所と違い、⚠️ **顧客名はこちらでコントロールできる**ので促すだけにする。
 * ⚠️ 文言は指示書のまま。⚠️ **変えるときはオーナーに確認すること。**
 * ⚠️ 見るのは **氏名①・フリガナ①だけ**。氏名②は空のことが多い。
 */
export const nexusNameMessages = (information: Record<string, string>): string[] => {
    const name = information?.customer_contacts_name ?? '';
    const kana = information?.customer_contacts_name_kana ?? '';
    const messages: string[] = [];

    if (!hasHalfWidthSpace(name)) messages.push('Nexus連携のためには姓名間に半角スペースが必要');
    if (hasHiragana(kana)) messages.push('Nexus連携のためにはふりがなをカタカナで表記');
    if (!hasHalfWidthSpace(kana)) messages.push('Nexus連携のためにはフリガナの姓名間に半角スペースが必要');

    return messages;
};

/**
 * 顧客ランクの欄に出す注意書き。
 *
 * ⚠️ **ランク未設定か Eランクのときだけ**返す。⚠️ それ以外は null。
 */
export const nexusRankMessage = (information: Record<string, string>): string | null =>
    isNexusRank(information?.[RANK_KEY]) ? null : 'S~Dランクの顧客がNexusに連携されます';
