import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';
import { RANK_COLUMN, RANK_TABLE, rankSql } from './queries';
import type { RankCategory } from './queries';

/**
 * ランク管理（rank/RankOrder.tsx / RankKaeru.tsx / RankResale.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/rank.php とその配下 rankAction/
 *
 * ⚠️⚠️ **1つの request が3つの処理を兼ねている。** rank.php の分岐をそのまま写す。
 *
 *   1. memo あり            → 担当営業メモの保存（staff_list.memo）      【書き込み】
 *                             ⚠️ ここで**打ち切る**（PHP は exit）。
 *                                以降の分岐に進まない。
 *   2. rank / rank_period   → 顧客のランク更新 ＋ 一覧の再取得            【書き込み】
 *   3. どちらも無し          → 画面の初期データ一式                        【参照】
 *
 * ⚠️ roll では分岐していない（本文の中身で決まる）。そのためゲートウェイの
 *   登録は category ごとの1件で、分岐はこの中で行う。
 *
 * ⚠️⚠️ **① の PHP ハンドラは実在する。** 書き込みの分岐（1・2）は
 *   転送失敗時に ① で再実行されると二重更新になるため、
 *   backend/src/core/express_proxy.php の isExclusiveToExpress() で
 *   **書き込みのときだけ**フォールバックを禁止している。
 *   参照（3）は ① にフォールバックしてよい。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface RankResult {
  httpStatus: number;
  body: unknown;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * ⚠️ PHP の `$data['category'] ?? 'order'` と同じにする。
 *   **キーが無い／null のときだけ 'order'** になる。
 *   空文字が明示されている場合は '' のままで、下の妥当性チェックで 400 になる。
 *   `|| 'order'` と書くと空文字も 'order' になってしまい挙動が変わる。
 */
const resolveCategory = (raw: unknown): string => {
  if (raw === undefined || raw === null) return 'order';
  return asString(raw);
};

const ALLOWED: RankCategory[] = ['order', 'spec', 'used'];

const isRankCategory = (value: string): value is RankCategory =>
  (ALLOWED as string[]).includes(value);

/**
 * 書き込みの分岐に入るか。
 *
 * ⚠️⚠️ **backend/src/core/express_proxy.php の rankRequestIsWrite() と
 *   同じ条件にすること。** 片方だけ変えると、
 *   ・こちらが書き込みなのに ① がフォールバックを許す → 二重更新
 *   ・こちらが参照なのに ① が 502 を返す → 画面が開かない
 *   のどちらかが起きる。
 */
export const rankIsWrite = (data: Record<string, unknown>): boolean => {
  if (asString(data.memo) !== '') return true;
  if (asString(data.rank) !== '') return true;
  if (asString(data.rank_period) !== '') return true;
  return false;
};

// ---------------------------------------------------------------------------
// 1. 担当営業メモ（rankAction/rank_memo.php）
// ---------------------------------------------------------------------------

/**
 * ⚠️ 移植元は `if ($memo)` で入る。PHP の真偽判定なので
 *   '0' も空扱いになるが、メモに '0' だけを入れる運用は無いため
 *   空文字判定に揃えている（`asString(...) !== ''`）。
 *
 * ⚠️ WHERE は name と shop の複合。同姓同名が別店舗にいるため
 *   name だけにすると別人のメモを書き換える。
 *
 * ⚠️ PHP は何も出力せずに exit する（本文が空）。
 *   フロント（RankOrder.tsx / RankKaeru.tsx / RankResale.tsx）は
 *   応答を読んでいないため、ここでは空のオブジェクトを返す。
 */
const runRankMemo = async (data: Record<string, unknown>): Promise<RankResult> => {
  const memo = asString(data.memo);
  const name = asString(data.staff);
  const shop = asString(data.shop);

  // ⚠️ 空の name / shop で実行すると条件に合う行が無く0件更新になるだけだが、
  //   誤呼び出しを見つけられるようログに残す
  if (name === '' || shop === '') {
    logger.warn('rank: メモの保存先（staff / shop）が空です');
    return { httpStatus: 200, body: {} };
  }

  await execute('UPDATE staff_list SET memo = ? WHERE name = ? AND shop = ?', [
    memo,
    name,
    shop,
  ]);

  return { httpStatus: 200, body: {} };
};

// ---------------------------------------------------------------------------
// 2. ランク更新（rankAction/rank_{cat}_update_rank.php）
// ---------------------------------------------------------------------------

/**
 * ⚠️ rank と rank_period は**空でないものだけ**更新する（PHP と同じ）。
 *   空を「消す指示」と解釈して NULL を入れると、
 *   片方だけ変えたときにもう片方が消える。
 *
 * ⚠️ 列名は固定文字列のみ。リクエストの値を列名に使わない。
 */
const runRankUpdate = async (
  category: RankCategory,
  data: Record<string, unknown>
): Promise<RankResult> => {
  const rank = asString(data.rank);
  const rankPeriod = asString(data.rank_period);
  const id = asString(data.id);

  const setParts: string[] = [];
  const params: SqlParam[] = [];

  if (rank !== '') {
    setParts.push(`${RANK_COLUMN} = ?`);
    params.push(rank);
  }
  if (rankPeriod !== '') {
    setParts.push('rank_period = ?');
    params.push(rankPeriod);
  }

  if (setParts.length === 0) {
    // ⚠️ PHP と同じ応答。フロントはこの status を見ていないが、
    //   形を変えると差分比較が合わなくなる
    return {
      httpStatus: 200,
      body: { status: 'no_update', message: '更新対象がありません' },
    };
  }

  const sql = rankSql(category);

  try {
    // ⚠️ id が空でも PHP は実行していた（0件更新）。挙動を変えない
    await execute(`UPDATE ${RANK_TABLE[category]} SET ${setParts.join(', ')} WHERE id = ?`, [
      ...params,
      id,
    ]);

    const customers = await query<DynamicRow>(sql.updatedCustomer);

    return {
      httpStatus: 200,
      body: { status: 'success', newCustomers: customers },
    };
  } catch (error) {
    // ⚠️ PHP は例外メッセージをそのまま返していた（SQLや列名が漏れる）。
    //   ここでは返さずログに残す。フロントは status しか見ていない
    logger.error(`rank の更新に失敗しました category=${category} id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 200,
      body: { status: 'error', message: '更新エラー' },
    };
  }
};

// ---------------------------------------------------------------------------
// 3. 初期データ（rankAction/rank_{cat}.php）
// ---------------------------------------------------------------------------

const runRankRead = async (category: RankCategory): Promise<RankResult> => {
  const sql = rankSql(category);

  // ⚠️ 6本を並列で投げる。PHP は逐次だったが結果は同じで、
  //   顧客一覧が数万行あるため待ち時間が縮む
  const [staff, shop, section, customer, achievement, expected] = await Promise.all([
    query<DynamicRow>(sql.staff),
    query<DynamicRow>(sql.shop, [sql.division]),
    query<DynamicRow>(sql.section, [sql.division]),
    query<DynamicRow>(sql.customer),
    query<DynamicRow>(sql.achievement),
    query<DynamicRow>(sql.expected),
  ]);

  // ⚠️ キー名は PHP と同じにする。フロントが response.data.customer 等で読む
  return {
    httpStatus: 200,
    body: { staff, shop, section, customer, achievement, expected },
  };
};

// ---------------------------------------------------------------------------

export const runRank = async (body: unknown): Promise<RankResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  // ⚠️⚠️ memo が最優先。PHP は rank_memo.php を require したあと exit するため、
  //   memo と rank を同時に送っても**メモだけ**保存される。
  if (asString(data.memo) !== '') {
    return runRankMemo(data);
  }

  const category = resolveCategory(data.category);

  if (!isRankCategory(category)) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '無効なカテゴリです' },
    };
  }

  const isUpdate = asString(data.rank) !== '' || asString(data.rank_period) !== '';

  return isUpdate ? runRankUpdate(category, data) : runRankRead(category);
};
