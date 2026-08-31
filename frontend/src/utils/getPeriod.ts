export const getPeriod = (year: number, month: number) => {
    const start = new Date(year, month - 2, 1);
    const monthArray:string[] = [];
    for (let i = 1; i <= 12; i++) {
        const next = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const nextMonthStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        monthArray.push(nextMonthStr);
    }
    return monthArray;
};