/**
 * 反響を顧客として取り込むときの事業区分。
 *
 * ⚠️ **バックエンドの backend-express/src/features/inquirySync.ts と対の定義である。**
 *   片方だけ増やすと、画面では選べるのにサーバーが 400 を返す（またはその逆）。
 *   区分を追加・変更するときは必ず両方を直すこと。
 *
 * ⚠️ 同期先のテーブルが区分ごとに違う。
 *     注文 → master_data
 *     建売 → master_data_kaeru
 *     中古 → master_data_resale
 *   顧客一覧はテーブル単位で表示しているため、区分を間違えると
 *   **作ったのに担当者の画面に出てこない顧客**になる。
 */

export const DIVISION_KEYS = ['注文', '建売', '中古'] as const;

export type DivisionKey = (typeof DIVISION_KEYS)[number];

/**
 * 事業区分 → `shop_list.division` の値。
 *
 * ⚠️ 表示名（注文）とマスタの値（注文事業）は違う。
 *   マスタの値をそのまま select に出すと運用の呼び方とずれる。
 */
export const SHOP_DIVISION: Record<DivisionKey, string> = {
    注文: '注文事業',
    建売: '建売分譲事業',
    中古: '中古リノベ',
};

/** 不正な値を安全側へ寄せる。⚠️ 既定は注文（既存データがすべて注文事業のため） */
export const asDivision = (value: unknown): DivisionKey => {
    const text = typeof value === 'string' ? value.trim() : '';
    return (DIVISION_KEYS as readonly string[]).includes(text) ? (text as DivisionKey) : '注文';
};

/**
 * イベント予約の同期（roll: 'insert'）の取り込み先（v2.2.178）。
 * ⚠️ **選んだ店舗の shop_list.division で決める**（⚠️ 開いている画面の category ではない）。
 *   注文事業 → order（master_data）／ 建売分譲事業 → spec（master_data_kaeru）／ 中古リノベ → used（master_data_resale）
 * ⚠️ 画面の category で決めていたため、建売・中古の画面から開いて注文の店舗へ同期すると
 *   ⚠️ master_data に入らなかった（⚠️「成功」と出るので気づけない）。
 * ⚠️ division が無い・知らない値（不動産企画室など）の店舗は order（⚠️ asDivision と同じく注文に寄せる）。
 * ⚠️ 使っている画面: FestaDashboard.tsx / EventList.tsx
 */
export type SyncCategory = 'order' | 'spec' | 'used';
const SYNC_CATEGORY_OF_DIVISION: Record<string, SyncCategory> = {
    [SHOP_DIVISION['注文']]: 'order',
    [SHOP_DIVISION['建売']]: 'spec',
    [SHOP_DIVISION['中古']]: 'used',
};
export const syncCategoryOfShop = (
    shop: string,
    shopList: { shop: string | null; division: string | null }[],
): SyncCategory => {
    const master = shopList.find(s => (s.shop ?? '').trim() === shop.trim());
    return SYNC_CATEGORY_OF_DIVISION[(master?.division ?? '').trim()] ?? 'order';
};
