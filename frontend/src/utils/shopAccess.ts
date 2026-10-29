/**
 * 担当事業（staff.shop）で入れる事業（category）（v2.2.227）。
 *
 * ⚠️ staff.shop は店舗名ではなく事業区分（order / spec / used / realty / estate / all）。
 * ⚠️ 2026-10-29 の指示: 建売（spec）と不動産企画係（realty）の人が、中古（used）と不動産企画係の両方を見られるように。
 *   「まとめてもいい」→ 新しい値 estate（建売・中古・不動産企画係）にまとめた（backend/scripts/sql/2026-10-29_staff_shop_estate.sql）。
 * ⚠️ ② の features/realty/index.ts（REALTY_SHOPS・BROKER_SHOPS）・staffAdmin.ts（AUTH_SHOPS）、
 *   ① の core/authz.php（AUTHZ_REALTY_SHOPS・AUTHZ_BROKER_SHOPS）も同じ考え方でそろえること。
 */

/** estate の人が入れる事業 */
export const ESTATE_CATEGORIES = ['spec', 'used', 'realty'];

/** その事業に入れるか（Category.tsx の入場判定・業務ガイドの切り替え） */
export const canEnterCategory = (shop: string, category: string): boolean =>
    shop === 'all' || shop === category || (shop === 'estate' && ESTATE_CATEGORIES.includes(category));
