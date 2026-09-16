/**
 * キャンペーン画面で扱うブランド。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ここ以外にブランド一覧を書かないこと。**
 *   ⚠️ 2026-09-16 まで `CampaignList.tsx` と `FormBuilder.tsx` に
 *     同じ配列が別々に書かれていた。⚠️ 片方だけ増やすと、
 *     **一方の画面にだけ出ないブランド**ができる（エラーにならないので気づけない）。
 *
 * ⚠️ キーは `form_table.brand` に入っている値である。
 *   ⚠️ 表示名や `inquiry_customer.brand` の値とは**別物**。
 *     例: キーは `nagomi` だが、保存される brand は `なごみ`。
 *     ⚠️ 変換は ② の `features/campaignForm/brands.ts` が持っている。
 * ─────────────────────────────────────────────
 */

/**
 * ⚠️⚠️ **並び順に意味がある**（2026-09-16 の指示）。
 *   ⚠️ 五十音順でもキー順でもない。**この順で画面に出すこと。**
 */
export const CAMPAIGN_BRANDS = [
    'kh', 'djh', 'nagomi', '2l', 'jh', 'pg', 'fh', 'khg',
] as const;

export type CampaignBrand = (typeof CAMPAIGN_BRANDS)[number];

/**
 * 画面に出す表記。
 * ⚠️ キーをそのまま出さないこと（`2l` や `khg` では利用者に通じない）。
 */
const LABEL: Record<string, string> = {
    kh: '国分ハウジング',
    djh: 'デイジャストハウス',
    nagomi: 'なごみ工務店',
    '2l': '2Lhome',
    jh: 'ジャスフィーホーム',
    pg: 'PG HOUSE',
    fh: 'フルコミホーム',
    khg: '国分ハウジンググループ',
};

/** ⚠️ 知らないキーはそのまま返す。画面から消えるより、キーが見えるほうがよい */
export const brandLabel = (brand: string): string => LABEL[brand] ?? brand;

/**
 * ブランドのロゴ。
 * ⚠️ ① に置かれている画像を指している。⚠️ ファイル名はブランドキーと同じ。
 */
export const brandLogo = (brand: string): string =>
    `https://khg-marketing.info/dashboard/form/img/${brand}.png`;
