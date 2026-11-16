import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { databaseSql } from './queries';
import type { DatabaseCategory } from './queries';
import { giftApplyToCustomers } from './gift';

/**
 * 顧客一覧の初期データ（database/DatabaseOrder.tsx / DatabaseKaeru.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 参照のみ。① に database.php / databaseAction/database_{category}.php が
 *   実在するのでフォールバックしてよい。
 *
 * ⚠️⚠️ **応答が大きい。** 顧客は注文で約24,000件・建売で約10,000件ある。
 *   転送に時間がかかると forwardToExpress の CURLOPT_TIMEOUT（120秒）に近づく。
 *   2026-09-11 に別の request が 17MB・120秒で切れている。
 *   ⚠️ **列を足すときは転送量を意識すること。**
 *
 * ⚠️ 応答のキーの順序も ① に揃えてある。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface DatabaseResult {
  httpStatus: number;
  body: unknown;
}

/**
 * 行の配列を「列名1回＋値の並び」にする（v2.2.271）。
 * ⚠️ 注文では 21MB のうち 14.6MB が列名の繰り返しだった。画面は databaseUtils.ts の decodeRows で元の形に戻す。
 * ⚠️ 列は全行の列名を合わせたもの（SQL の行は同じ列だが、gift のように後から足す列があっても落とさない）。
 */
export const toColumnar = (rows: Record<string, unknown>[]): { cols: string[]; rows: unknown[][] } => {
  const set = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) set.add(k);
  const cols = [...set];
  return { cols, rows: rows.map((r) => cols.map((c) => r[c])) };
};

/**
 * 注文の家族情報を、画面の家族名検索に使う「名前」だけにする（v2.2.271。1.8MB → 数百KB）。
 * ⚠️ 形は今までと同じ `{ id, family_info: JSON 文字列 }`（画面は safeParse して .name を見る）。
 * ⚠️ 読めない値は '[]'（画面の safeParse も読めなければ [] にしていた）。
 */
export const familyNamesOnly = (rows: Record<string, unknown>[]): Record<string, unknown>[] =>
  rows.map((r) => {
    let names: { name: unknown }[] = [];
    try {
      const parsed: unknown = typeof r.family_info === 'string' ? JSON.parse(r.family_info) : [];
      if (Array.isArray(parsed)) {
        names = parsed.map((p) => ({ name: (p as { name?: unknown } | null)?.name }));
      }
    } catch {
      names = [];
    }
    return { id: r.id, family_info: JSON.stringify(names) };
  });

export const runDatabase = async (category: DatabaseCategory): Promise<DatabaseResult> => {
  const sql = databaseSql(category);

  // ⚠️ 互いに独立しているので並列で投げる。
  //   ⚠️ 返さないもの（spec の event など）は空配列を返す関数にしておき、
  //     プールに無駄なクエリを投げない
  const [staff, shop, medium, customer, family, event, hotlead, introductory] = await Promise.all([
    query<DynamicRow>(sql.staff),
    query<DynamicRow>(sql.shop),
    query<DynamicRow>(sql.medium),
    query<DynamicRow>(sql.customer),
    query<DynamicRow>(sql.family),
    sql.event ? query<DynamicRow>(sql.event) : Promise.resolve([]),
    sql.hotlead ? query<DynamicRow>(sql.hotlead) : Promise.resolve([]),
    sql.introductory ? query<DynamicRow>(sql.introductory) : Promise.resolve([]),
  ]);

  // ギフト進呈可否を確定させる（条件③④の突き合わせ）。⚠️ customer をその場で書き換える
  await giftApplyToCustomers(customer as unknown as Record<string, unknown>[]);

  /**
   * ⚠️⚠️ **キーは ① の PHP と同じものだけを返す。**
   *   order にしか無いキー（event / hotlead / introductory）を spec にも
   *   空配列で入れると、① にフォールバックしたときだけキーが消えることになり、
   *   画面が「② のときは動くのに ① だと壊れる」状態になりうる。
   */
  const body: Record<string, unknown> = {
    staff,
    shop,
    medium,
    // ⚠️ v2.2.271: ② だけ「列名1回＋値の並び」。① の PHP は従来の配列のまま（画面はどちらでも読む）
    customer: toColumnar(customer as unknown as Record<string, unknown>[]),
    family: category === 'order' ? familyNamesOnly(family as unknown as Record<string, unknown>[]) : family,
  };

  if (category === 'order') {
    body.introductory = introductory;
    body.event = event;
    body.hotlead = hotlead;
  }

  return { httpStatus: 200, body };
};
