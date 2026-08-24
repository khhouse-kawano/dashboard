export const removeSpaces = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/[\s\u3000]+/g, '');
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

// ==========================================
// 💡 次回アクション必須化・追客終了理由（source.html の NEXT_QUICK / LEAD_ENDS / BUY_ENDS 相当）
// ==========================================
export const NEXT_QUICK: { label: string; days: number }[] = [
    { label: '明日', days: 1 },
    { label: '3日後', days: 3 },
    { label: '1週間後', days: 7 },
    { label: '2週間後', days: 14 },
    { label: '1ヶ月後', days: 30 },
];

export const addDaysISO = (base: string | null | undefined, days: number): string => {
    const d = base ? new Date(`${base}T00:00:00`) : new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const LEAD_END_REASONS = ['成約', '辞退・売側中止', '連絡不通', '対象外', 'その他'];
export const BUY_END_REASONS = ['成約', '購入見送り', '連絡不能', '対象外', 'その他'];