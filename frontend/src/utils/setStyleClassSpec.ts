import { CSSProperties } from 'react';

export const setStyleClassSpec = (shop: string): CSSProperties => {
    const backgroundColors = [
        { category: '鹿児島1係', color: '#1f77b4' },
        { category: '鹿児島2係', color: '#ff7f0e' },
        { category: '鹿児島3係', color: '#525252' },
        { category: '宮崎係',   color: '#d62728' },
        { category: '熊本係',   color: '#9467bd' },
        { category: '大分係',   color: '#8c564b' },
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

