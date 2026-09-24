import { execute } from '../db/pool';

/**
 * SUUMO 掲載順位の収集結果を1件保存する。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/suumo_property.php`
 *
 * ⚠️⚠️ **呼び出し元はブラウザではない。**
 *   `C:\Users\shinji-kawano\extensions\meta_scraper\suumo_scraper.ts`
 *   （playwright のスクレイパー）が **オーナーのPCで週1回**実行される。
 *   ⚠️ 送信先は ① のゲートウェイのままで、① が ② へ転送する。
 *
 * ⚠️ 読み出し側（`property::suumo`）は features/property.ts に移植済み。
 *   ⚠️ **同じテーブルの読み書きが別ファイルに分かれている**ことに注意。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **`suumo_property` には UNIQUE キーが無い。**
 *   ⚠️ 二重に実行すれば**同じ物件が2行できる**。
 *   ⚠️ そのため ① の `expressProxyExclusive()`（フォールバック禁止）に登録している。
 *     ⚠️ **`expressProxyRequests()` に移してはいけない。**
 *
 * ⚠️ 代償: ② が落ちている間は 502 になり、そのエリアは保存されない。
 *   ⚠️ 週1の手動実行なので、掛け直せばよい。
 */

/** ⚠️ 列はすべて `text`。数値も文字列で入っている（`rank` も含む） */
const INSERT_SQL =
    'INSERT INTO suumo_property ' +
    // ⚠️⚠️ **`rank` はバックチックで囲むこと。** ⚠️ 予約語（ウィンドウ関数）である
    '(`rank`, `area`, `company`, `name`, `price`, `plan`, `url`, `registered_at`) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

/**
 * 値を1つ、列に入れられる形へ寄せる。
 *
 * ⚠️ 移植元は `$data['x'] ?? null` で、**型を見ていない**。
 *   ⚠️ `rank` は数値で送られてくるが列は `text` なので、PDO が文字列にして入れていた。
 *   ⚠️ ここでも同じく文字列へ寄せる。数値のまま渡すと
 *     **既存の行（文字列）と型が揃わない**。
 *
 * ⚠️ `undefined` と `null` は null のまま返す（移植元と同じ）。
 */
const asColumn = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    // ⚠️ 配列やオブジェクトは想定していない。
    //   ⚠️ 移植元は PDO が bindValue で落ちていたので、ここでも保存しない
    return null;
};

export interface SuumoPropertyInsertResult {
    httpStatus: number;
    body: { status: 'success' | 'error'; message: string };
}

/**
 * ⚠️⚠️ **応答の形を変えないこと。**
 *   ⚠️ スクレイパーは `response.data.status === 'success'` だけを見ている
 *     （suumo_scraper.ts の POST 部分）。
 *   ⚠️ 失敗しても **HTTP は 200** で返す。移植元がそうしており、
 *     ここだけ 500 にすると axios が例外を投げて
 *     **「通信エラー」と表示され、原因の切り分けが変わる**。
 */
export const runSuumoPropertyInsert = async (
    body: Record<string, unknown>
): Promise<SuumoPropertyInsertResult> => {
    try {
        await execute(INSERT_SQL, [
            asColumn(body.rank),
            asColumn(body.area),
            asColumn(body.company),
            asColumn(body.name),
            asColumn(body.price),
            asColumn(body.plan),
            asColumn(body.url),
            asColumn(body.registered_at),
        ]);

        return { httpStatus: 200, body: { status: 'success', message: 'DB保存完了' } };
    } catch (error) {
        // ⚠️ 移植元は error_log に出していた。② では標準エラーに出す（docker logs で読める）
        console.error('[suumo_property] INSERT に失敗しました:', error);
        return { httpStatus: 200, body: { status: 'error', message: 'DB保存エラー' } };
    }
};
