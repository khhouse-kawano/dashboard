/**
 * 「YYYY/MM」に月数を足して「YYYY/MM」で返す（年をまたぐ。2026/12 に 1 → 2027/01）。
 * ⚠️ v2.2.303: ランクの画面が月の数字に1・2を足していて「2026/13」になっていた。
 * ⚠️ 形が違う値（期の「2027」だけなど）はそのまま返す。
 */
export const addMonths = (yearMonth: string, months: number): string => {
    const m = /^(\d{4})\/(\d{1,2})$/.exec(yearMonth);
    if (!m) return yearMonth;
    const d = new Date(Number(m[1]), Number(m[2]) - 1 + months, 1);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
