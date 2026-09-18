/**
 * 建売分譲事業の販促媒体の表記ゆれをまとめる（customer/CustomerKaeru.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **3つのテーブルで同じ媒体が別の名前で入っている**（2026-09-18 の指示）。
 *     master_data_kaeru.sales_promotion_name … 顧客が選んだ反響媒体
 *     medium_kaeru                            … ⚠️ **基準にする名前**
 *     budget.medium                           … 販促費
 *   ⚠️ 突合できないと**分子（顧客）と分母（販促費）が別の行に乗り**、
 *     単価がまるで合わなくなる。
 *
 * ⚠️⚠️ **`medium_kaeru` の名前を正とする。** 画面の行もこの名前で出る。
 *
 * ⚠️ 対応表に無いものは**そのまま**扱う（`SUUMO` / `HOME'S` / `チラシ` など。指示）。
 * ─────────────────────────────────────────────
 */

/**
 * 正式名 → その名前として扱う値の一覧。
 *
 * ⚠️⚠️ **キーは `medium_kaeru.medium` に実在する名前にすること。**
 *   ⚠️ 実在しない名前を作ると、⚠️ **その行が画面に出てこない**
 *     （行は `medium_kaeru` から作るため）。
 *
 * ⚠️⚠️ **`インターネット検索` と `ネット` を `Web検索` に入れている**（2026-09-18 に利用者が決定）。
 *   ⚠️ 指示書の原文は `ネット検索` だったが、⚠️ **実データは `インターネット検索`** で
 *     ⚠️ **販促費の最多（¥98,218,945／全体の35%）**である。1文字違いで丸ごと漏れていた。
 *   ⚠️ 顧客側の `ネット` は ⚠️ **4,892件（建売の反響の59%）**で、これも漏れていた。
 *
 * ⚠️ `Youtube` は `medium_kaeru` では `YouTube`（T が大文字）である。
 *   ⚠️ **両方を書いておく。** 大文字小文字を無視する作りにはしていない
 *     （`HOME'S` のような記号混じりで思わぬ一致を生むため）。
 */
export const MEDIUM_ALIAS: Record<string, string[]> = {
    'アットホーム': ['アットホーム', 'athome'],
    'Instagram': ['Instagram', 'SNS広告', 'Facebook'],
    'Web検索': [
        'Web検索', 'WEB検索', 'ネット検索', 'ネット広告',
        // ⚠️ 2026-09-18 に追加（利用者の決定）
        'インターネット検索', 'ネット',
    ],
    'カゴスマ・タテルヤ': ['カゴスマ・タテルヤ', 'カゴスマ'],
    '公式LINE': ['公式LINE', 'ALLGRIT'],
    'その他': ['その他', 'テレビCM', '住宅展示場', 'Yahoo!不動産', 'Youtube', 'YouTube'],
};

/**
 * 値 → 正式名 の引き当て表。
 *
 * ⚠️ 毎回 `Object.entries` を回すと行数×顧客数だけ繰り返すことになるので、
 *   ⚠️ **読み込み時に1度だけ作る。**
 */
const CANONICAL = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(MEDIUM_ALIAS)) {
    for (const alias of aliases) CANONICAL.set(alias, canonical);
}

/**
 * 媒体名の掃除。
 *
 * ⚠️⚠️ **実データには末尾の空白と改行が混ざっている。**
 *   ⚠️ 掃除せずに比べると**静かに落ちる**（エラーは出ず、件数がわずかに減るだけ）。
 * ⚠️ budgetSimulatorUtils.ts の `cleanMedium()` と同じ考え方である。
 */
export const cleanMedium = (value: string): string =>
    (value ?? '').replace(/[\r\n]/g, '').trim();

/**
 * 表記を `medium_kaeru` の名前に揃える。
 *
 * ⚠️⚠️ **対応表に無いものはそのまま返す**（指示）。
 *   ⚠️ 勝手に「その他」へ寄せない。⚠️ **寄せると、拾えていないことに気づけなくなる。**
 *
 * ⚠️⚠️ **`Instagram、Web検索` のような複数選択はそのまま返る。**
 *   ⚠️ 実データに約50件ある。⚠️ **どの行にも乗らない**（数え方が未決のため）。
 *   ⚠️ 総反響の行には入るので、⚠️ **媒体別の合計と総反響は一致しない。**
 */
export const normalizeMedium = (value: string): string => {
    const cleaned = cleanMedium(value);
    return CANONICAL.get(cleaned) ?? cleaned;
};
