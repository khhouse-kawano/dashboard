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
 * Nexus へ移行できる顧客か。
 *
 * ⚠️ 画面では **この結果でアイコンを出すだけ**である。
 *   保存を止めるのは handleSave 側の個別チェック（文言が項目ごとに違うため）。
 */
export const isNexus = (information: Record<string, string>): boolean =>
    hasHalfWidthSpace(information?.customer_contacts_name ?? '')
    && isKatakanaOnly(information?.customer_contacts_name_kana ?? '');

/** 一覧の行（`customer` / `customer_contacts_name_kana`）用。⚠️ 中身の判定は isNexus と同じ */
export const isNexusRow = (name?: string, kana?: string): boolean =>
    hasHalfWidthSpace(name ?? '') && isKatakanaOnly(kana ?? '');

/** ⚠️ 指示書の文言そのまま。変えるときはオーナーに確認すること */
export const NEXUS_ALERT_SPACE = '姓名間に半角スペースを入力すること。例）×国分太郎 〇国分 太郎';
export const NEXUS_ALERT_KANA = 'ふりがなはカタカナで入力すること。';
