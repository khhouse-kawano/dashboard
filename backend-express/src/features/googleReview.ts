import type { RowDataPacket } from 'mysql2/promise';
// ⚠️ 参照は query、書き込みは execute。query は RowDataPacket しか返せない
import { query, execute } from '../db/pool';

/**
 * Google クチコミの取得（google_review テーブル）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-15 に作り直した。以前の実装は失われている。**
 *   ① にあった `post_review.php` / `shop_review.php` は現行の
 *   backend/src/handlers/ から消えており、
 *   `backup/back/20260625/api/actions/` にだけ残っていた。
 *   ⚠️ 取得側（projects/sync）のスクリプトも残っていない。
 *   ⚠️ 最終取得は **2026-04-10**（review_history の最後の要素）。
 *
 * ⚠️⚠️ **① に PHP ハンドラは無い。フォールバックできない。**
 *   express_proxy.php の expressProxyExclusive() に入れてあり、
 *   転送に失敗したら 502 で終わる（① で二重に実行されない）。
 *
 * ─────────────────────────────────────────────
 * 取得の仕組み
 *
 *   1. projects/sync が `google_review:list` で店舗と Place ID を取る
 *   2. sync が Places API (New) を叩く
 *   3. sync が `google_review:save` へ結果を送る
 *   4. **ここで既存のクチコミと突き合わせ、増えた分だけ足す**
 *
 * ⚠️⚠️ **突き合わせをサーバー側でやるのは意図的である。**
 *   蓄積の判定を sync 側に置くと、sync が既存データを全部受け取ってから
 *   送り返すことになり、往復が増えるうえに競合すると取りこぼす。
 *
 * ⚠️⚠️ **Places API はクチコミを最大5件しか返さない。**
 *   全件（多い店舗で74件）は取れない。毎回5件を取り、
 *   **まだ持っていないものだけを足していく**運用である。
 *   ⚠️ 実際 recently_review には5件を超える件数が溜まっている
 *     （薩摩川内店で13件）。過去もこの方式だったとみられる。
 *   ⚠️ 全件が要るなら Google Business Profile API が必要だが、
 *     あちらは利用申請と OAuth が要る。
 * ─────────────────────────────────────────────
 */

interface ReviewRow extends RowDataPacket {
  no: number;
  shop: string;
  id: string;
  average: string;
  amount: string;
  recently_review: string;
  review_history: string;
}

/** 蓄積しているクチコミ1件。⚠️ 既存データに合わせた形 */
export type StoredReview = {
  /** 星の数 */
  rating: number;
  /** 投稿日時（ISO文字列）。⚠️ 既存データは publishTime をここに入れている */
  date: string;
  /** 本文。⚠️ 既存データは改行が `<br>` になっている */
  text: string;
  /**
   * Places API のリソース名（`places/XXX/reviews/YYY`）。
   * ⚠️ 2026-09-15 から保存している。**既存の要素には入っていない。**
   *   そのため重複判定は「name があれば name、無ければ date + text」で行う。
   */
  name?: string;
};

/** 評価の推移1件 */
type HistoryPoint = { date: string; amount: number; average: number };

export interface GoogleReviewResult {
  httpStatus: number;
  body: unknown;
}

/** JSON 列を安全に配列へ。⚠️ 壊れていても落とさない（取得を止めないため） */
const parseArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

/**
 * クチコミの同一判定に使う鍵。1件につき複数返す。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **「name があれば name だけ」で判定してはいけない。**
 *   2026-09-15 の検証で見つかった落とし穴である。
 *
 *   既存の13件には `name` が**入っていない**（旧実装が保存していなかった）。
 *   一方、これから Places API が返す5件には `name` が付く。
 *   ⚠️ `name` だけで比べると、**同じクチコミなのに別物と判定され、
 *     まったく同じ本文が二重に溜まっていく。**
 *
 * ⚠️ そこで **date + 本文の鍵も必ず作り、どちらか一方でも一致したら同一**とする。
 *   ⚠️ `name` が両方に揃うのは、次回以降に保存した分だけである。
 *
 * ⚠️ 本文は編集されうるので date + 本文は完全ではないが、
 *   既存データに他の手掛かりが無い。`name` が揃えばそちらで拾える。
 * ─────────────────────────────────────────────
 */
const reviewKeys = (r: StoredReview): string[] => {
  const keys = [`d:${r.date ?? ''}|${(r.text ?? '').slice(0, 200)}`];
  if (r.name && r.name !== '') keys.push(`n:${r.name}`);
  return keys;
};

/**
 * 店舗と Place ID の一覧。
 * ⚠️ sync が「どの店舗を取りに行くか」を決めるのに使う。
 * ⚠️ クチコミ本文は返さない。取得側は要らないうえ、転送量が無駄になる。
 */
export const runGoogleReviewList = async (): Promise<GoogleReviewResult> => {
  const rows = await query<ReviewRow>(
    `SELECT no, shop, id, address, average, amount, url FROM google_review ORDER BY no`
  );
  return { httpStatus: 200, body: { status: 'ok', shops: rows } };
};

/**
 * 口コミ集計画面（header/GoogleReview.tsx）の初期データ。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`list` とは別に用意している。** あちらは projects/sync 専用で
 *   本文を返さない（取得側は要らないため）。こちらは画面用で本文が要る。
 *   ⚠️ `list` に本文を足すと、sync の往復が無駄に重くなる。
 *
 * ⚠️ `shop_list` も一緒に返す。画面が店舗名を shop_list の表記へ
 *   揃えたうえで、事業区分・営業課で絞り込むため。
 *   ⚠️ 突き合わせの規則はフロント（googleReviewUtils.ts）にある。
 *
 * ⚠️ `review_history` は返さない。画面では使わない（2026-09-15 の指示）。
 *   ⚠️ 必要になったら足すこと。今は転送量を増やさない。
 * ─────────────────────────────────────────────
 */
export const runGoogleReviewSummary = async (): Promise<GoogleReviewResult> => {
  // ⚠️ 互いに独立しているので並列で投げる
  const [reviews, shop] = await Promise.all([
    query<ReviewRow>(
      `SELECT no, shop, id, address, average, amount, recently_review, url
         FROM google_review ORDER BY no`
    ),
    // ⚠️ 擬似店舗（全店舗／店舗未設定）も返す。除くのはフロントの仕事にする
    //   （ここで絞ると、なぜ消えたのかが画面側から分からなくなる）
    query<RowDataPacket & { shop: string }>(
      `SELECT shop, section, division, brand FROM shop_list`
    ),
  ]);

  return { httpStatus: 200, body: { status: 'ok', reviews, shop } };
};

/** sync から送られてくる1店舗分 */
type IncomingShop = {
  /** Place ID。⚠️ google_review.id と突き合わせる */
  id?: unknown;
  average?: unknown;
  amount?: unknown;
  reviews?: unknown;
};

/**
 * 取得結果を保存する。
 *
 * ⚠️ 1回の呼び出しで**全店舗分**を受け取る（31店舗なので十分小さい）。
 * ⚠️ 店舗ごとに「新しいクチコミだけ足す」「評価の推移に1点足す」を行う。
 *
 * ⚠️⚠️ **INSERT はしない。** 店舗の行は事前に登録されている前提である
 *   （Place ID が分からないと取得できないため、行の追加は手作業）。
 *   ⚠️ 見つからない Place ID は `skipped` として返す。黙って捨てない。
 */
export const runGoogleReviewSave = async (body: Record<string, unknown>): Promise<GoogleReviewResult> => {
  const incoming = Array.isArray(body.data) ? (body.data as IncomingShop[]) : [];
  if (incoming.length === 0) {
    return { httpStatus: 400, body: { status: 'error', message: '保存するデータがありません。' } };
  }

  const existing = await query<ReviewRow>(
    `SELECT no, shop, id, average, amount, recently_review, review_history FROM google_review`
  );
  const byPlaceId = new Map(existing.map(r => [String(r.id), r]));

  const now = new Date().toISOString();
  const updated: string[] = [];
  const skipped: string[] = [];
  let addedTotal = 0;

  for (const one of incoming) {
    const placeId = String(one.id ?? '');
    const row = byPlaceId.get(placeId);
    if (!row) {
      skipped.push(placeId);
      continue;
    }

    // ---- クチコミの蓄積 ----
    const stored = parseArray<StoredReview>(row.recently_review);
    // ⚠️ 既存の鍵をすべて集める（1件につき date+本文、あれば name も）
    const seen = new Set(stored.flatMap(reviewKeys));
    const fresh: StoredReview[] = [];
    for (const r of parseArray<StoredReview>(one.reviews)) {
      const keys = reviewKeys(r);
      // ⚠️ どれか1つでも既存と一致したら「持っている」とみなす
      if (keys.some(k => seen.has(k))) continue;
      // ⚠️ 同じ応答の中に同じクチコミが2つ来ても二重に足さない
      keys.forEach(k => seen.add(k));
      fresh.push(r);
    }

    // ⚠️ 新しいものを後ろに足す。並べ替えない
    //   （既存の並びが変わると、画面で見たときに差分が追えなくなる）
    const nextReviews = [...stored, ...fresh];
    addedTotal += fresh.length;

    // ---- 評価の推移 ----
    const history = parseArray<HistoryPoint>(row.review_history);
    const average = Number(one.average ?? 0);
    const amount = Number(one.amount ?? 0);

    /**
     * ⚠️ 前回と件数・平均が同じなら履歴に足さない。
     *   ⚠️ 毎日動かすと同じ点が並び、推移が読めなくなるため。
     *   ⚠️ 最終取得日は履歴の最後の要素で分かるので、
     *     「動いたのに増えていない」ことは別途ログで見る。
     */
    const last = history[history.length - 1];
    const changed = !last || Number(last.amount) !== amount || Number(last.average) !== average;
    const nextHistory = changed ? [...history, { date: now, amount, average }] : history;

    await execute(
      `UPDATE google_review
          SET average = ?, amount = ?, recently_review = ?, review_history = ?
        WHERE id = ?`,
      [
        String(one.average ?? ''),
        String(one.amount ?? ''),
        JSON.stringify(nextReviews),
        JSON.stringify(nextHistory),
        placeId,
      ]
    );
    updated.push(row.shop);
  }

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      updated: updated.length,
      added: addedTotal,
      // ⚠️ 取りこぼしを黙らせない。Place ID の登録漏れはここで気づく
      skipped,
    },
  };
};
