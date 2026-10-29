/**
 * 担当事業（staff.shop）で入れる事業（category）（v2.2.227 で作成・v2.2.228 で変更）。
 *
 * ⚠️ staff.shop は店舗名ではなく事業区分（order / spec / used / realty / all）。
 * ⚠️ 2026-10-29 の指示（v2.2.228）: 「order 注文／spec 建売／used・realty 中古・不動産企画係」
 *   → 中古（used）の人と不動産企画係（realty）の人は、どちらも中古リノベと不動産企画係の両方に入れる。
 *   ⚠️ v2.2.227 で足した estate（建売・中古・不動産企画係）はなくした（本番の担当事業も戻した。2026-10-29_staff_shop_estate_cleanup.sql）。
 * ⚠️ ② の features/realty/index.ts（REALTY_SHOPS・BROKER_SHOPS）・staffAdmin.ts（AUTH_SHOPS）、
 *   ① の core/authz.php（AUTHZ_REALTY_SHOPS・AUTHZ_BROKER_SHOPS）も同じ考え方でそろえること。
 */

/** 担当事業 → 入れる事業。⚠️ all はすべて（下の canEnterCategory） */
const SHOP_CATEGORIES: Record<string, string[]> = {
    order: ['order'],
    spec: ['spec'],
    used: ['used', 'realty'],
    realty: ['used', 'realty'],
};

/** その事業に入れるか（Category.tsx の入場判定・業務ガイドの切り替え） */
export const canEnterCategory = (shop: string, category: string): boolean =>
    shop === 'all' || (SHOP_CATEGORIES[shop] ?? []).includes(category);
