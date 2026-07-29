export const sortStyle = { position: 'fixed' as const, zIndex: '1000', backgroundColor: '#fff', width: '100%', height: '60px' };

export const tableStyle = (isSp: boolean) => { return ({ fontSize: isSp ? '9px' : '12px' }) };

export const tdStyle = (isSp: boolean) => { return ({ width: isSp ? '40px' : '70px', minWidth: isSp ? '40px' : '70px', maxWidth: isSp ? '40px' : '70px', letterSpacing: '1px' }) };

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

export const cancelStyle = { background: 'red', color: 'white', padding: '0px 3px', fontSize: '8px', borderRadius: '50%', marginLeft: '3px' };

export const lastYearStyle = { top: '10px', fontSize: '8px', backgroundColor: '#f3f3f3', width: '15px', height: '15px', borderRadius: '50%', color: '#555555' };