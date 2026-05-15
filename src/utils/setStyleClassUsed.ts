import { CSSProperties } from 'react';

export const setStyleClassUsed = (shop: string): CSSProperties => {
    const backgroundColors = [
        { category: '買い:中古リノベ', color: '#1f77b4' },
        { category: '買い:ポータル', color: '#ff7f0e' },
        { category: '売り:ポータル', color: '#d62728' }
    ];

    // ホットリード優先
    const backgroundValue =
        shop.includes('ホットリード')
            ? '#0f3675'
            : backgroundColors.find(b => shop.startsWith(b.category))?.color
              ?? '#198754'; // 見つからない＝店舗未設定扱い（success）

    const isGrey =
        shop.includes('KHG') ||
        shop === 'ブランド・店舗未設定';

    return {
        backgroundColor: isGrey ? 'grey' : backgroundValue,
        color: '#fff',
        padding: '2px 7px',
        fontSize: '11px',
        borderRadius: '10px',
        border: 'none',
        textAlign: 'center',
    };
};

