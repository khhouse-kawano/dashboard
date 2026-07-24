export const staffSorter = () => {
    const positionArray: string[] = ['課長', '課長代理', '店長', '店長代理', '一般', 'IC'];

    const getPositionScore = (item: any) => {
        if (item.name === '予算') return 100;
        if (item.name === '実績') return 101;
        const index = positionArray.indexOf(item.position);
        return index !== -1 ? index : 99;
    };

    const getIdNumber = (item: any) => {
        const id = (item.khg_id ?? '').trim();
        return id ? Number(id) : 99999;
    };

    return (a: any, b: any) => {
        const scoreA = getPositionScore(a);
        const scoreB = getPositionScore(b);

        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }
        if (scoreA >= 100) return 0;

        return getIdNumber(a) - getIdNumber(b);
    };
};