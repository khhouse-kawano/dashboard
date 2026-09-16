/**
 * キャンペーン画面で扱うブランド。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ここ以外にブランド一覧を書かないこと。**
 *   ⚠️ 2026-09-16 まで `CampaignList.tsx` と `FormBuilder.tsx` に
 *     同じ配列が別々に書かれていた。⚠️ 片方だけ増やすと、
 *     **一方の画面にだけ出ないブランド**ができる（エラーにならないので気づけない）。
 *
 * ⚠️ この値は `form_table.brand` に入っているキーである。
 *   ⚠️ 表示名や `inquiry_customer.brand` の値とは**別物**。
 *     例: キーは `nagomi` だが、保存される brand は `なごみ`。
 *     ⚠️ 変換は ② の `features/campaignForm/brands.ts` が持っている。
 * ─────────────────────────────────────────────
 */
export const CAMPAIGN_BRANDS = ['kh', 'djh', 'nagomi', '2l', 'fh', 'pg', 'jh', 'khg'] as const;

export type CampaignBrand = (typeof CAMPAIGN_BRANDS)[number];

/**
 * ブランドのロゴ。
 * ⚠️ ① に置かれている画像を指している。⚠️ ファイル名はブランドキーと同じ。
 */
export const brandLogo = (brand: string): string =>
    `https://khg-marketing.info/dashboard/form/img/${brand}.png`;
