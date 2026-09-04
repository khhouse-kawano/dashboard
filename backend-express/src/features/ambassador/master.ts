import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import type { AmbassadorResult } from './index';

/**
 * 反響画面で使う店舗・担当営業のマスタ。
 *
 * ⚠️ **アンバサダー専用ではない。** 次の画面が同じものを使う。
 *     header/AmbassadorList.tsx      公式アンバサダー台帳
 *     header/InquiryAmbassador.tsx   アンバサダー反響一覧
 *     header/InquiryIntroductory.tsx 紹介キャンペーン反響一覧
 *   request 名が `ambassador_master` のままなのは、先にアンバサダーで
 *   作ったという経緯によるもの。**条件を変えると3画面すべてに効く。**
 *
 * ─────────────────────────────────────────────
 * 店舗の絞り込み条件の変更（2026-09-06）
 *
 *   旧: `WHERE report_flag = 1`（報告対象の店舗）
 *   新: `WHERE show_flag = 1`（画面に出す店舗）
 *
 *   ⚠️ この2つは一致しない。ローカルDBでの実測は次のとおり。
 *     report_flag = 1 かつ show_flag = 0 … 5件（不動産企画室4・注文事業1）→ **選択肢から消える**
 *     show_flag = 1 かつ report_flag = 0 … 14件（注文事業13・区分なし1）→ **選択肢に増える**
 *
 *   担当を割り振る操作なので「今運用している店舗」＝ show_flag が適切、
 *   という判断で切り替えた（report_flag は集計の対象を決めるフラグ）。
 *   ⚠️ 戻すときは3画面すべてに影響することを前提に判断すること。
 *
 *   これで条件が `backend/src/handlers/shop_list.php` と同じになったが、
 *   統合はしていない。あちらは `{ status }` で包まない**配列そのもの**を返す
 *   仕様で、呼び出し側が `res.data.filter(...)` と直接扱っているため。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 店舗と担当営業を1回のリクエストで返す。別々にすると、
 *   片方だけ失敗したときに「店舗は選べるが担当が選べない」という
 *   中途半端な状態になり、原因が分かりにくい。
 *
 * ⚠️ この request に PHP ハンドラは無い。② が落ちたら ① で 404 になる。
 */

interface ShopRow extends RowDataPacket {
  brand: string | null;
  shop: string | null;
  section: string | null;
  area: string | null;
  /** 事業区分。⚠️ 画面側で 注文事業／建売分譲事業／中古リノベ を絞るのに使う */
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
 * 運用中の店舗。
 *
 * ⚠️ `division` を必ず返すこと。事業区分（注文／建売／中古）で
 *   店舗の選択肢を絞るために使っている。返さないと、建売の反響に
 *   注文事業の店舗を割り当てられてしまう。
 *
 * ⚠️ 並び順は brand_sort → id。ブランドごとにまとまって出るようにしている。
 *   ORDER BY を外すとDB任せの順になり、選択肢の並びが日によって変わる。
 */
const SHOP_SQL = `
  SELECT brand, shop, section, area, division
    FROM shop_list
   WHERE show_flag = 1
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
