/**
 * オーナーズハウスの管理画面（v2.2.284）の型と小さな関数。
 * ⚠️ 物件の表は ownershouse（列の意味は表のコメント）。読み書きは ② の owners_house_admin_list / owners_house_admin_save。
 */

/** ownershouse の1行（② はすべて文字列で返す。no だけ数値） */
export type OwnersHouse = {
    no: number;
    id: string;
    category: string;
    pref: string;
    area: string;
    lg_code: string | null;
    name: string;
    title: string;
    brand: string;
    shop: string;
    shop_zip: string;
    shop_address: string;
    staff: string;
    tag: string;
    feature_1: string;
    feature_2: string;
    feature_3: string;
    feature_4: string;
    feature_5: string;
    img_1: string;
    img_2: string;
    img_3: string;
    img_4: string;
    img_5: string;
    map_address: string;
    lat_and_long: string;
    structure: string;
    large: string;
    plan: string;
    flag: string;
    updated_at: string | null;
    updated_by: string | null;
};

export type ShopOption = { shop: string; brand: string };
/** 地方公共団体コード。city_short が空の行は都道府県そのもの */
export type LgCode = { code: string; pref_short: string; city_short: string };

export type AdminListResponse = {
    status: string;
    message?: string;
    houses: OwnersHouse[];
    shops: ShopOption[];
    codes: LgCode[];
    categories: string[];
    brands: string[];
};

/** 新規のときの空の物件。no = 0 が「新規」の印 */
export const emptyHouse = (category: string): OwnersHouse => ({
    no: 0, id: '', category, pref: '', area: '', lg_code: null, name: '', title: '', brand: '', shop: '', shop_zip: '', shop_address: '',
    staff: '', tag: '', feature_1: '', feature_2: '', feature_3: '', feature_4: '', feature_5: '',
    img_1: '', img_2: '', img_3: '', img_4: '', img_5: '', map_address: '', lat_and_long: '', structure: '', large: '', plan: '', flag: '0',
    updated_at: null, updated_by: null,
});

/** 「31.36, 130.81」→ { lat, lng }。形が違えば null */
export const parseLatLng = (value: string): { lat: number; lng: number } | null => {
    const m = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
};

/** { lat, lng } → 「31.360309, 130.818042」（⚠️ owners_house は ', ' で区切って読む） */
export const formatLatLng = (p: { lat: number; lng: number }): string => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

/** 店舗名の頭 → ブランド略称（⚠️ ② ownersHouse/reservation.ts の BRANDS のキー） */
export const brandOfShop = (shop: string): string => {
    if (shop.startsWith('JH') || shop.startsWith('ジャスフィー')) return 'JH';
    if (shop.startsWith('DJH') || shop.startsWith('デイジャスト')) return 'DJH';
    if (shop.startsWith('KH') || shop.startsWith('国分ハウジング')) return 'KH';
    if (shop.startsWith('2L') || shop.startsWith('ニーエル')) return '2L';
    if (shop.startsWith('なごみ')) return 'Nagomi';
    if (shop.startsWith('FH') || shop.startsWith('フルコミ')) return 'FH';
    if (shop.startsWith('PG')) return 'PGH';
    return '';
};
