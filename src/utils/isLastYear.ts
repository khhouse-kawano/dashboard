export const isLastYear = (value: string) => {
    const [y, m] = value.split("/").map(Number);

    // 1年前の同じ月
    const lastYear = y - 1;
    const lastYearMonth = m;

    // 基準：2025年1月（含む）
    const baseYear = 2025;
    const baseMonth = 1;

    // 年で比較
    if (lastYear > baseYear) return true;
    if (lastYear < baseYear) return false;

    // 年が同じなら月で比較（>=）
    return lastYearMonth >= baseMonth;
}
