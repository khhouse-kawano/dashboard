export const removeSpaces = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/[\s\u3000]+/g, '');
};

export const formatDate = (dateStr: string | null | Date) => {
    if (!dateStr || String(dateStr).startsWith('0000')) return '―';
    if (dateStr instanceof Date) {
        const y = dateStr.getFullYear();
        const m = String(dateStr.getMonth() + 1).padStart(2, '0');
        const d = String(dateStr.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    }
    return dateStr.replace(/-/g, '/');
};

// ==========================================
// 💡 コンパクトな共通スタイル
// ==========================================
export const s = {
    card: {
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        border: '1px solid #e9ecef',
        marginBottom: '16px',
        minWidth: '1200px'
    } as React.CSSProperties,
    cardTitle: {
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    } as React.CSSProperties,
    th: {
        padding: '6px 8px',
        fontSize: '11px',
        backgroundColor: '#f8f9fa',
        color: '#495057',
        borderBottom: '1px solid #dee2e6',
        whiteSpace: 'nowrap' as const,
        verticalAlign: 'middle',
        fontWeight: 'bold'
    } as React.CSSProperties,
    td: {
        padding: '6px 8px',
        fontSize: '11px',
        borderBottom: '1px solid #dee2e6',
        verticalAlign: 'middle',
    } as React.CSSProperties,
    badge: (bgColor: string, color: string = '#fff') => ({
        backgroundColor: bgColor,
        color: color,
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 'bold',
        display: 'inline-block'
    } as React.CSSProperties)
};

export const safeParse = (data: any) => {
    if (typeof data !== 'string' || data.trim() === '') return data ?? [];
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("JSONの解析に失敗しました。不正なデータです:", data);
        return [];
    }
};