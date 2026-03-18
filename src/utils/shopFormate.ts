export const shopFormate = (shop: string, brand: string, shopArray: any) => {
    let shopValue;
    if (shop.includes('PG HOUSE')) {
        shopValue = shop.replace('PG HOUSE', 'PGH');
    } else if (shop.includes('2L')) {
        shopValue = '2L鹿児島店';
    } else if (shop.includes('KHG')) {
        shopValue = 'ブランド・店舗未設定';
    } else if (!shopArray.some(value => value.shop === shop)) {
        const formattedBrand = brand.replace('Nagomi', 'なごみ').replace('PG HOUSE', 'PGH');
        shopValue = `${formattedBrand}店舗未設定`
    } else {
        shopValue = shop;
    }
    return shopValue;
};