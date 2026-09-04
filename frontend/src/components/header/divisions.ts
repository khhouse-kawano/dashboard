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
