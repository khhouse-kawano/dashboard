import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import type { AmbassadorResult } from './index';

/**
 * アンバサダー画面で使う店舗・担当営業のマスタ。
 *
 * ─────────────────────────────────────────────
 * ⚠️ **既存の `shop_list` / `callStatusList` を流用してはいけない。**
 *
 *   shop_list      … `WHERE show_flag = 1`（画面に出す店舗）
 *   こちらが欲しいもの … `WHERE report_flag = 1`（報告対象の店舗）
 *
 *   この2つは一致しない。実データで **report_flag = 1 なのに show_flag = 0 の
 *   店舗が存在する**（ローカルDBで5件）。流用すると、その店舗が選択肢から
 *   黙って消え、担当を割り当てられない反響が生まれる。
 *   エラーにならないので気づけない。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 店舗と担当営業を1回のリクエストで返す。別々にすると、
 *   片方だけ失敗したときに「店舗は選べるが担当が選べない」という
 *   中途半端な状態になり、原因が分かりにくい。
 *
 * ⚠️ この request に PHP ハンドラは無い。② が落ちたら ① で 404 になる。
 *   意図的にそうしている。① の shop_list（show_flag = 1）へ暗黙に
 *   フォールバックすると、**間違った選択肢が正しい顔をして出てしまう。**
 *   出ないほうが安全である。
 */

interface ShopRow extends RowDataPacket {
  brand: string | null;
  shop: string | null;
  section: string | null;
  area: string | null;
  division: string | null;
}

interface StaffRow extends RowDataPacket {
  name: string;
  shop: string;
  section: string;
  position: string;
  /** 年度。'2026' のような文字列。⚠️ 絞り込みは画面側で行う */
  period: string;
  status: string;
}

/**
 * 報告対象の店舗。
 *
 * ⚠️ 並び順は brand_sort → id。ブランドごとにまとまって出るようにしている。
 *   ORDER BY を外すとDB任せの順になり、選択肢の並びが日によって変わる。
 */
const SHOP_SQL = `
  SELECT brand, shop, section, area, division
    FROM shop_list
   WHERE report_flag = 1
   ORDER BY brand_sort, id
`;

/**
 * 営業職の担当者。
 *
 * ⚠️ `category = 1` が営業職。ここを外すと事務・工務まで担当候補に出る。
 *
 * ⚠️ 年度（period）では**絞り込まない。** 画面側で当年度に絞る仕様のため、
 *   ここで絞ると画面側のフィルタが二重になり、
 *   「年度をまたいだときに誰も出てこない」原因の切り分けができなくなる。
 *
 * ⚠️ 同姓同名や、複数店舗に同じ名前が並ぶことがある。
 *   画面側でキーを作るときは name だけでなく shop と組み合わせること。
 */
const STAFF_SQL = `
  SELECT name, shop, section, position, period, status
    FROM staff_list
   WHERE category = 1
   ORDER BY sort, id
`;

export const runAmbassadorMaster = async (): Promise<AmbassadorResult> => {
  const [shop, staff] = await Promise.all([
    query<ShopRow>(SHOP_SQL),
    query<StaffRow>(STAFF_SQL),
  ]);

  return { httpStatus: 200, body: { status: 'ok', shop, staff } };
};
