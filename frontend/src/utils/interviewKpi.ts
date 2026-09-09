/**
 * 商談ステップ（interview_log）から KPI 日付を導き出す。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **backend-express/src/features/interviewKpi.ts と対になっている。**
 *   規則（最古を採る／導出できない列は触らない／削除時の条件）のどれかを
 *   片方だけ変えると、顧客詳細から保存したときと商談ステップ画面から
 *   保存したときで KPI 日付が食い違う。必ず両方直すこと。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **なぜ必要か（2026-09-09）**
 *
 *   TableInterview.tsx は従来「入力欄を触った瞬間に setInformation で
 *   その列を書く」方式だった。そのため入力の順番で結果が変わっていた。
 *
 *     ・アクションを先に選ぶと、その時点の日付（空）が列に入る
 *       ⚠️ そのまま「追加」を押さずに離脱すると、既存のKPI日付が消えたまま
 *     ・あとから直しても `!information[key]` の条件で無視される
 *     ・同じアクションが2件あるとき1件消すと列が空になる
 *     ・対応列が無いアクションを削除すると information['undefined'] が生える
 *
 *   本モジュールは **interview_log からまとめて導出する**。
 *   入力順・後からの修正・複数同一アクション・削除のどれでも同じ結果になる。
 */

export type InterviewLogEntry = {
    day?: unknown;
    action?: unknown;
    note?: unknown;
    staff?: unknown;
};

/**
 * 日付を 'YYYY-MM-DD' に揃える。
 *
 * ⚠️ 保存されている日付は 'YYYY-MM-DD' と 'YYYY/MM/DD' が混在している。
 *   文字列比較で最古を選ぶため、必ず揃えてから比べる。
 *   ⚠️ 揃えずに比べると '2026/03/01' < '2026-04-02' が false になり、
 *     書式が混ざった顧客で最古の判定が壊れる。
 *
 * ⚠️ Date に変換しない。'2026-03-01' を new Date で解釈すると UTC 扱いになり、
 *   タイムゾーンで1日ずれることがある。
 */
export const normalizeDay = (value: unknown): string => {
    const s = String(value ?? '').trim().replace(/\//g, '-');
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
};

/**
 * アクション名を actionMap のキーに揃える。
 *
 * ⚠️ 建売・中古では `自社契約,物件A` のように「アクション,物件名」で
 *   保存されている。先頭だけを見る。
 */
export const baseAction = (value: unknown): string => String(value ?? '').split(',')[0] ?? '';

/**
 * interview_log から KPI 列の値を導出する。
 *
 * ⚠️⚠️ **同じアクションが複数あるときは「最も古い日付」を採る**
 *   （2026-09-09 決定）。ファネルは「いつ到達したか」を見るものなので、
 *   最初の到達日が自然で、面談を重ねても集計が後ろへずれない。
 *
 * ⚠️ 中古は同じ列に別のアクションが割り当たる組み合わせがあるため、
 *   列単位でも最古を採る。
 *
 * ⚠️ 日付が空の行は無視する。空を入れると既存の日付を消してしまう。
 */
export const deriveKpiColumns = (
    logs: InterviewLogEntry[],
    actionMap: Record<string, string>
): Map<string, string> => {
    const derived = new Map<string, string>();

    for (const log of logs) {
        if (log === null || typeof log !== 'object') continue;

        const column = actionMap[baseAction(log.action)];
        if (column === undefined) continue;

        const day = normalizeDay(log.day);
        if (day === '') continue;

        const current = derived.get(column);
        if (current === undefined || day < current) derived.set(column, day);
    }

    return derived;
};

/**
 * 削除された商談ステップに対応する列を空にしてよいか判定する。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **無条件に空にしてはいけない。**
 *
 *   2026-09-09 に本番相当データで数えた結果、
 *   「interview_log に根拠が無いのに KPI 日付が入っている」セルが
 *
 *     注文 1,295セル / 建売 512セル / 中古 137セル
 *     ────────────────────────
 *     合計 1,944セル（1,668顧客）… うち契約日 1,147件
 *
 *   ある。さらに注文は 24,133件中 **18,086件が interview_log 未登録**で、
 *   interview_log は KPI 日付の主たる出所ではない
 *   （ポータル同期・直接編集・interview_log 導入前のデータがある）。
 *
 *   そこで次の**両方**を満たす列だけ空にする。
 *
 *     (1) 残った interview_log から、その列を導出できない
 *     (2) 現在の値が、削除された行の日付と一致する
 *         → その KPI 日付は、まさに今消した行が入れたものだと言える
 *
 *   (2) があるので、他の経路で入った日付は消えない。
 * ─────────────────────────────────────────────
 */
export const canClearColumn = (
    column: string | undefined,
    removedDay: unknown,
    derived: Map<string, string>,
    currentValue: unknown
): boolean => {
    // ⚠️ 対応列が無いアクションでは何もしない。
    //   従来は key が undefined でも `[key]: ''` を実行しており、
    //   information['undefined'] というキーが生えていた
    if (column === undefined || column === '') return false;

    // (1) 残りの log から導出できるなら、そちらが正しい
    if (derived.has(column)) return false;

    const day = normalizeDay(removedDay);
    if (day === '') return false;

    // (2) 現在値が削除した行の日付と一致するときだけ
    return normalizeDay(currentValue) === day;
};
