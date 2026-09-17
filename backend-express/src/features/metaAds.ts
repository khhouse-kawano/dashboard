import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/pool';

/**
 * 他社広告ライブラリ（`meta_ads`）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/meta_ads.php`
 *
 *   ⚠️ 移植元は **1つの request で読み書きを兼ねていた**（`id` があれば更新）。
 *     ⚠️ 許可リストに request 名だけで載せると、
 *       **書き込みまで一緒に ② へ流れる**。roll で分けること。
 *
 * ⚠️⚠️ **競合他社のバナーを週1で集めたものである**（`advertiser_area = '自社'` も含む）。
 *   ⚠️ `ad_hash` が UNIQUE なので **1広告1行**。
 *     ⚠️ 同じ広告が複数の取得日にまたがらないため、
 *       **「いつまで出ていたか」は分からない。** 掲載期間を作らないこと。
 * ─────────────────────────────────────────────
 */

interface AdRow extends RowDataPacket {
    id: number;
    advertiser_name: string;
    advertiser_area: string;
    advertiser_period: string;
    ad_title: string;
    image_filename: string;
    lp_url: string;
    scraped_date: string;
    bookmark: number | null;
}

/**
 * 一覧。
 *
 * ⚠️ 移植元は `SELECT *` だった。⚠️ `ad_hash` と `created_at` は画面で使わないので返さない
 *   （3,814行あり、無駄に太らせない）。
 *
 * ⚠️⚠️ **`scraped_date` を文字列で返すこと。**
 *   ⚠️ `date` 型のまま JSON にすると環境によって `2026-09-09T00:00:00.000Z` になり、
 *     ⚠️ 画面の日付表示とソートが**PHP版とずれる**。
 */
export const runMetaAdsList = async (): Promise<{ ads: AdRow[] }> => {
    const ads = await query<AdRow>(
        `SELECT id, advertiser_name, advertiser_area, advertiser_period,
                ad_title, image_filename, lp_url,
                DATE_FORMAT(scraped_date, '%Y-%m-%d') AS scraped_date,
                bookmark
           FROM meta_ads
          ORDER BY scraped_date DESC, id DESC`
    );

    return { ads };
};

/**
 * ブックマークの更新。
 *
 * ⚠️ 移植元は `id` があれば更新、無ければ一覧という分岐だった。
 *   ⚠️ ここでは roll で分けている（許可リストで書き込みだけを絞れるようにするため）。
 */
export const runMetaAdsBookmark = async (
    body: Record<string, unknown>
): Promise<{ status: 'success' | 'error'; message: string }> => {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
        return { status: 'error', message: '対象が指定されていません。' };
    }

    // ⚠️ 0 / 1 以外を入れさせない。列は tinyint
    const bookmark = Number(body.bookmark) === 1 ? 1 : 0;

    const result = await execute('UPDATE meta_ads SET bookmark = ? WHERE id = ?', [bookmark, id]);

    /**
     * ⚠️⚠️ **0行なら成功にしない。**
     *   ⚠️ 移植元は実行できれば必ず success を返しており、
     *     **存在しない id でも「更新しました」**と答えていた。
     */
    if (result.affectedRows === 0) {
        return { status: 'error', message: '対象が見つかりませんでした。' };
    }

    return { status: 'success', message: 'ブックマークを更新しました' };
};
