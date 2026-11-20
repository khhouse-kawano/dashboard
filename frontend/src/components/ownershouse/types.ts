/**
 * オーナーズハウスの管理画面（v2.2.284）の型と小さな関数。
 * ⚠️ 物件の表は ownershouse（列の意味は表のコメント）。読み書きは ② の owners_house_admin_list / owners_house_admin_save。
 */

/** 画像の枠の数（v2.2.285。1〜4 メイン・5〜14 カルーセル） */
export const IMAGE_SLOTS = 14;
/** 画像の列名 img_1〜img_14 */
export const IMAGE_KEYS = ['img_1', 'img_2', 'img_3', 'img_4', 'img_5', 'img_6', 'img_7', 'img_8', 'img_9', 'img_10', 'img_11', 'img_12', 'img_13', 'img_14'] as const;

/** ownershouse の1行（② はすべて文字列で返す。no だけ数値。⚠️ 画像の列は ② が公開URLにして返す） */
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
    img_6: string;
    img_7: string;
    img_8: string;
    img_9: string;
    img_10: string;
    img_11: string;
    img_12: string;
    img_13: string;
    img_14: string;
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
    img_1: '', img_2: '', img_3: '', img_4: '', img_5: '', img_6: '', img_7: '', img_8: '', img_9: '', img_10: '',
    img_11: '', img_12: '', img_13: '', img_14: '', map_address: '', lat_and_long: '', structure: '', large: '', plan: '', flag: '0',
    updated_at: null, updated_by: null,
});

/** 「31.36, 130.81」→ { lat, lng }。形が違えば null */
export const parseLatLng = (value: string): { lat: number; lng: number } | null => {
    const m = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
};

/** { lat, lng } → 「31.360309, 130.818042」（⚠️ owners_house は ', ' で区切って読む） */
export const formatLatLng = (p: { lat: number; lng: number }): string => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

/**
 * 店舗名のブランド部分：略称（shop_list の店舗名の頭）⇔ 正式名称（ownershouse.shop・サイトの表示）。
 * ⚠️ 管理画面は shop_list（注文事業）の略称で選び、保存するときに正式名称に直す（サイトの「管理店舗」は正式名称で出す。2026-11-18 の指示）。
 * ⚠️ 見学予約（② ownersHouse/reservation.ts の SHOP_PREFIX）は正式名称を略称に戻して使う。ブランドを足すときは両方に足す。
 * ⚠️ 長い略称から先に比べる（DJH を先に見ないと、将来 'D' などが増えたときに取り違える）。
 */
const SHOP_BRAND_NAMES: ReadonlyArray<readonly [short: string, formal: string]> = [
    ['DJH', 'デイジャストハウス'],
    ['なごみ', 'なごみ工務店'],
    ['PGH', 'PG HOUSE'],
    ['KH', '国分ハウジング'],
    ['2L', 'ニーエルホーム'],
    ['FH', 'フルコミホーム'],
    ['JH', 'ジャスフィーホーム'],
];

/** 略称の店舗名 → 正式名称（例 KH霧島店 → 国分ハウジング霧島店）。当てはまらなければそのまま */
export const toFormalShopName = (shop: string): string => {
    if (SHOP_BRAND_NAMES.some(([, formal]) => shop.startsWith(formal))) return shop;
    const hit = SHOP_BRAND_NAMES.find(([short]) => shop.startsWith(short));
    return hit ? hit[1] + shop.slice(hit[0].length) : shop;
};

/** 正式名称の店舗名 → shop_list の略称（例 国分ハウジング霧島店 → KH霧島店）。当てはまらなければそのまま */
export const toShortShopName = (shop: string): string => {
    const hit = SHOP_BRAND_NAMES.find(([, formal]) => shop.startsWith(formal));
    return hit ? hit[0] + shop.slice(hit[1].length) : shop;
};

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
