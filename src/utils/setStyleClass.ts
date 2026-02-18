import { CSSProperties } from 'react';

export const setStyleClass = (shop: string): CSSProperties => {
    const backgroundColors = [
        { category: 'KH', color: '#0f3675' },
        { category: 'DJ', color: '#28aeba' },
        { category: 'なご', color: '#956134' },
        { category: '2L', color: '#0d9f6d' },
        { category: 'JH', color: '#dc4235' },
        { category: 'FH', color: '#cd3c33' },
        { category: 'PG', color: '#000' },
    ];

    const backgroundValue = shop.includes('ホットリード') ? '#0f3675' :
        backgroundColors.find(b => b.category === shop.slice(0, 2))?.color ?? '';

    return {
        backgroundColor: (shop.includes('KHG') || shop === 'ブランド・店舗未設定') ? 'grey' : backgroundValue,
        color: '#fff',
        padding: '2px 7px',
        fontSize: '11px',
        borderRadius: '10px',
        border: 'none',
        textAlign: 'center'
    };
};
