export const toHalfWidth = (str: string): string =>
    str.normalize('NFKC').replace(/\D/g, '');

export const dateFormate = (value: string) => {
    if (!value) return '-';
    return value.slice(0, 10).replace(/-/g, '/');
};

// 💡 「xms + ランダム英数字10文字」を生成する関数
export const generateNewId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < 10; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'xms' + randomPart;
};

export const parseTextWithUrl = (text?: string | null) => {
    if (!text) return { cleanText: '-', mapUrl: null };
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = text.match(urlRegex);
    const mapUrl = match ? match[0] : null;
    const cleanText = text.replace(urlRegex, '').replace(/[\s\t ]+$/, '');
    return { cleanText, mapUrl };
};

export const removeAllSpaces = (str: string): string => {
    if (!str) return '';
    return str.replace(/[ \u3000]+/g, '');
};

export const styles = {
    label: { color: '#303030', fontSize: '11px', marginBottom: '4px', letterSpacing: '.6px', fontWeight: '500', display: 'block' },
    input: { border: '1px solid #D3D3D3', borderRadius: '4px', height: '35px', width: '100%', paddingLeft: '10px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box' as const },
    textarea: { border: '1px solid #D3D3D3', borderRadius: '4px', width: '100%', padding: '10px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box' as const },
    // ボタン(キャンセル等)
    buttonSecondary: { color: '#495057', backgroundColor: '#f8f9fa', border: '1px solid #d2d6da', borderRadius: '6px', padding: '0 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.6px', height: '35px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content' },
    // ボタン(保存等 - ベースは同じで色だけ落ち着いたブルーグレーに変更)
    buttonPrimary: { color: '#ffffff', backgroundColor: '#5e72e4', border: '1px solid #5e72e4', borderRadius: '6px', padding: '0 24px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.6px', height: '35px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content' },
    // サジェストリストの枠
    suggestList: { zIndex: 9999, maxHeight: '250px', overflowY: 'auto' as const, top: 'calc(100% + 2px)', left: 0, backgroundColor: '#fff', border: '1px solid #D3D3D3', borderRadius: '4px', padding: 0, margin: 0, listStyle: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%', position: 'absolute' as const },
    // サジェストリストの各アイテム
    suggestItem: { cursor: 'pointer', fontSize: '12px', minHeight: '36px', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', color: '#303030', letterSpacing: '.6px', display: 'flex', alignItems: 'center' }
};

export const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', backgroundColor: '#f8f9fa', whiteSpace: 'nowrap' };

export const getReinsStatus = (reinsDate?: string | null, baikaiType?: string | null) => {
    if (reinsDate) {
        return { label: '登録済み', color: 'bg-success' }; // 緑色のバッジ
    }

    if (!reinsDate && (baikaiType === '専任媒介' || baikaiType === '専属専任媒介')) {
        return { label: '要登録', color: 'bg-danger' }; // 赤色のバッジ
    }

    return { label: '未登録', color: 'bg-secondary' }; // グレーのバッジ
};

export const getPropertyStatus = (status?: string) => {
    if (status === 'アクティブ') {
        return { label: 'アクティブ', color: 'bg-light text-secondary' }
    }
    if (status === '媒介終了') {
        return { label: '媒介終了', color: 'bg-dark text-light' }
    }
    if (status === '成約完了') {
        return { label: '成約完了', color: 'bg-primary text-white' }
    }
    if (!status) {
        return { label: '未設定', color: '' }
    }
    return { label: '未設定', color: 'bg-light text-secondary' };
};


export const getContractExpirationDate = (contractDate?: string | null, baikaiType?: string | null): string => {
    if (!contractDate || !baikaiType) return '-';
    if (baikaiType !== '専任媒介' && baikaiType !== '専属専任媒介') return '-';

    const date = new Date(contractDate);

    date.setMonth(date.getMonth() + 3);
    date.setDate(date.getDate() - 1);

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return `${y}/${m}/${d}`;
};

export const getRemainingDays = (expirationDateStr: string): number | null => {
    if (expirationDateStr === '-') return null;

    // 今日の日付を取得（時間は00:00:00にリセットして純粋な日付比較にするのがTS/JSの鉄則）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expDate = new Date(expirationDateStr);
    expDate.setHours(0, 0, 0, 0);

    // 差分（ミリ秒）を日数に変換
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
};

export const getContractStatusInfo = (remainingDays: number | null) => {
    if (remainingDays === null) return { label: '-', color: 'bg-light text-secondary' };

    if (remainingDays >= 30) {
        return { label: '有効', color: 'bg-success' }; // OKの代わりの表現
    } else if (remainingDays >= 0) {
        return { label: '⚠ 期限間近', color: 'bg-warning text-dark' };
    } else {
        return { label: '★ 期限切れ', color: 'bg-danger' };
    }
};
