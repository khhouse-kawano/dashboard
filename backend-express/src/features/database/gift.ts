import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';

/**
 * ギフト進呈可否の判定。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **移植元は backend/src/core/gift.php。条件を変えるときは両方直すこと。**
 *   片方だけ直すと、② が生きているときと ① にフォールバックしたときで
 *   画面のドットの色が変わる。**普段は動いているので気づくのが遅れる。**
 *
 * 進呈可の条件（4つすべてを満たすこと）
 *   ① in_charge_user が入っており、かつ「管理」を含まない
 *      「KH大分店 管理」「グループ管理」などは担当者が未割当のプレースホルダで、
 *      実在の担当者ではない（master_data で約19,000件が該当）。
 *   ② 反響取得日（step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99）が入っている
 *   ③ interview_sheet の同一IDの interview_log に、
 *      action = '初回面談' かつ note が記入済みの要素が1つ以上ある
 *      ⚠️ **同じ要素の中で両方成立していること。** 配列全体で別々に存在するだけでは不可。
 *   ④ family_info に同一IDの行があり、family_info が入っている
 *
 * ⚠️ 注文事業と建売分譲で**同じ判定**を使う。各ハンドラに直接書くと
 *   片方だけ直されて画面ごとに色が違う状態になる。
 *
 * ─────────────────────────────────────────────
 * なぜ ③ ④ を JOIN にしないのか（性能）
 *
 *   interview_sheet には id の索引が無い（PRIMARY は no のみ）。
 *   ③の判定結果を導出テーブルにして master_data と id で結合すると、
 *   索引の無い TEXT 列どうしの総当たりになり、
 *   **実測で顧客一覧の取得が65秒かかった**（結合前は数秒）。
 *
 *   ⚠️ そこで「条件を満たす id の一覧だけを取り、Set に載せて突き合わせる」形にしてある。
 *   ⚠️ 素直に JOIN に書き換えないこと。同じ罠を踏む。
 * ─────────────────────────────────────────────
 */

interface IdRow extends RowDataPacket {
  id: string;
}

/**
 * 条件①②だけを判定する SELECT 用の列。
 *
 * ⚠️ どちらも顧客テーブル1つで判定できるため結合が要らない。
 * ⚠️ 列名を gift にしていないのは、まだ4条件のうち2つしか見ていないため。
 *   この値をそのまま画面に出すと「進呈可」を過大に表示してしまう。
 */
export const giftBaseSelectSql = (): string =>
  `CASE WHEN COALESCE(in_charge_user, '') <> ''
         AND COALESCE(in_charge_user, '') NOT LIKE '%管理%'
         AND COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') <> ''
        THEN 1 ELSE 0 END AS gift_base`;

/**
 * 条件③を満たす顧客ID。
 *
 * ⚠️⚠️ **JSON_SEARCH では書けない。**
 *   JSON_SEARCH は「action が一致する要素の note」を見に行けないため、
 *   action と note が別々の要素にあるだけの顧客まで拾ってしまう
 *   （実測: 要素単位 2,273件 に対して、配列全体では 9,109件 と4倍に膨らむ）。
 *
 * ⚠️ MySQL の JSON_TABLE があれば素直に書けるが **MariaDB 10.11 は未対応**。
 *   添字を 0〜31 まで展開している（interview_log の最大要素数は実測16）。
 */
const INTERVIEW_SQL = `
  WITH RECURSIVE seq AS (
      SELECT 0 AS i
      UNION ALL
      SELECT i + 1 FROM seq WHERE i < 31
  )
  SELECT DISTINCT iv.id
    FROM interview_sheet iv
    JOIN seq ON seq.i < JSON_LENGTH(iv.interview_log)
   WHERE JSON_UNQUOTE(JSON_EXTRACT(iv.interview_log, CONCAT('$[', seq.i, '].action'))) = '初回面談'
     AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(iv.interview_log, CONCAT('$[', seq.i, '].note'))), '') <> ''
`;

/** 条件④を満たす顧客ID */
const FAMILY_SQL = `SELECT DISTINCT id FROM family_info WHERE COALESCE(family_info, '') <> ''`;

/** gift を持つ顧客の行。⚠️ id と gift_base が要る */
type GiftRow = Record<string, unknown> & { id?: unknown; gift_base?: unknown };

/**
 * 顧客一覧の各行に gift（1 = 進呈可 / 0 = 不可）を付ける。
 *
 * ⚠️ `gift_base` は中間値なので、gift を確定させたら行から外す。
 *   画面に2つ渡すと、どちらを見ればよいのか分からなくなる。
 *
 * ⚠️ 行を**その場で書き換える**。顧客一覧は注文事業で24,000件・建売で10,000件あり、
 *   新しい配列を作ると複製のぶんメモリを余分に使う
 *   （① の PHP では複製だけで memory_limit を超えて Fatal error になった）。
 */
export const giftApplyToCustomers = async (customers: GiftRow[]): Promise<void> => {
  // ⚠️ 2本は独立しているので並列で投げる
  const [interviewRows, familyRows] = await Promise.all([
    query<IdRow>(INTERVIEW_SQL),
    query<IdRow>(FAMILY_SQL),
  ]);

  // ⚠️ 突き合わせは Set で行う。配列の includes だと顧客数 × ID数の総当たりになる
  const interviewIds = new Set(interviewRows.map(r => String(r.id)));
  const familyIds = new Set(familyRows.map(r => String(r.id)));

  for (const customer of customers) {
    const id = String(customer.id ?? '');
    customer.gift = (Number(customer.gift_base ?? 0) === 1
      && interviewIds.has(id)
      && familyIds.has(id)) ? 1 : 0;
    delete customer.gift_base;
  }
};
