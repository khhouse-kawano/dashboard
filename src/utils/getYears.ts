export const getYears = () => {
    const now = new Date();
    const year = now.getFullYear();
    const start = 2025;
    const thisYear = now.getMonth() <= 4 ? year : year + 1;
    let yearArray: string[] = [];
    for (let i = start; i <= thisYear; i++) {
        yearArray.push(String(i));
    }
    return yearArray;
};