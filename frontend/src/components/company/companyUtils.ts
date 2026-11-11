export const dateFormate = (date: string) => {
    return date ? date.replace(/-/g, '/') : ''
};

export const monthFormate = (date: string) => {
    return date ? date.replace(/\//g, '-').slice(0, 7) : ''
};

export const lastYearMonthFormate = (date: string, type: string) => {
    if (!date) return '';
    if (type === '-') {
        const [year, month] = date.slice(0, 7).replace('/', '-').split('-');
        return `${Number(year) - 1}-${month}`;
    }
    if (type === '/') {
        const [year, month] = date.slice(0, 7).replace('/', '-').split('-');
        return `${Number(year) - 1}/${month}`;
    }
};

const today = new Date();

export const formattedThisMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;

export const lastYearStyle = { top: '10px', fontSize: '8px', backgroundColor: '#f3f3f3', width: '15px', height: '15px', borderRadius: '50%', color: '#555555' };