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
