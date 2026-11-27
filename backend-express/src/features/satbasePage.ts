import { runSatbaseList } from './satbase';

/**
 * v2.2.309 SatBaseサマリー（header/system/SatBaseDatabase.tsx）を少しずつ読む（satbase_page。GET・② だけ・Master だけ）。
 *
 * 引数（すべて任意）：
 *   keyword（物件名称・物件ID）・progress（工程状況）・sales（販売状況）・pref（県）・team（チーム）
 *   ad・insta（広告出稿・Instagram。'1' 済み / '0' 未）・sort・dir（並べ替え）・offset・limit（既定 0・30）
 *   ⚠️ 絞り込みのキーに category を使わない（本文の category はゲートウェイの鍵に入り、502「ループ検知」になる）
 * 応答：{ status: 'ok', rows, total, offset, options, kpi }
 *
 * ⚠️ 物件は約1,900件なので、satbase_list と同じ全件を読んでから JS で絞って並べる。
 * ⚠️⚠️ 画面の予備（② に届かないとき。frontend/src/components/header/system/satbaseFilter.ts）と同じ式にしてある。片方だけ直さない。
 */

type Row = Record<string, unknown>;

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 1000;

/** 並べ替えられる列（画面の列と、トグルの2列）。数値として並べる列 */
export const SATBASE_SORT_KEYS = [
  'ad_posted', 'instagram_posted',
  'property_id', 'property_name', 'progress_status', 'sales_status', 'prefecture', 'area', 'team', 'sales_price', 'land_cost',
  'sales_period', 'spec', 'plan', 'usage_type', 'customer_name', 'contract_staff', 'site_staff', 'design_staff', 'construction_staff',
  'foundation_start_date', 'desired_start_date', 'completion_date', 'exterior_completion_date', 'permit_date', 'contract_recorded_date',
  'payment_date', 'delivery_date', 'portal_posted_date', 'kaeru_hp_posted_date', 'price_changed_date', 'previous_sales_price',
  'ground_improvement', 'schedule_created', 'land_id', 'property_id_general', 'property_id_manager',
  'purchase_settlement_date', 'purchase_contract_date', 'lat_lng', 'updated', 'updated_by',
];
const NUMERIC_KEYS = new Set([
  'ad_posted', 'instagram_posted', 'property_id', 'sales_price', 'land_cost', 'usage_type', 'previous_sales_price',
  'ground_improvement', 'schedule_created', 'land_id', 'property_id_general', 'property_id_manager',
]);

export interface SatbaseConditions {
  keyword: string;
  progress: string;
  sales: string;
  pref: string;
  team: string;
  ad: string;
  insta: string;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const sortValueOf = (r: Row, key: string): string | number | null => {
  const v = r[key];
  if (v === null || v === undefined || v === '') return null;
  return NUMERIC_KEYS.has(key) ? Number(v) : String(v);
};

export const filterAndSortSatbase = (rows: Row[], c: SatbaseConditions, sort: string, dir: 'asc' | 'desc'): Row[] => {
  const word = c.keyword.trim();
  const filtered = rows.filter((r) => {
    if (word !== '' && !str(r.property_name).includes(word) && !str(r.property_id).includes(word)) return false;
    if (c.progress !== '' && str(r.progress_status) !== c.progress) return false;
    if (c.sales !== '' && str(r.sales_status) !== c.sales) return false;
    if (c.pref !== '' && str(r.prefecture) !== c.pref) return false;
    if (c.team !== '' && str(r.team) !== c.team) return false;
    if (c.ad !== '' && String(Number(r.ad_posted ?? 0)) !== c.ad) return false;
    if (c.insta !== '' && String(Number(r.instagram_posted ?? 0)) !== c.insta) return false;
    return true;
  });
  // ⚠️ 空の値は並べ方によらず最後。同じ値どうしは物件IDの新しい順
  return filtered.sort((a, b) => {
    const av = sortValueOf(a, sort);
    const bv = sortValueOf(b, sort);
    if (av === null || bv === null) {
      if (av !== bv) return av === null ? 1 : -1;
    } else {
      let d = 0;
      if (typeof av === 'number' && typeof bv === 'number') d = av - bv;
      else if (av < bv) d = -1;
      else if (av > bv) d = 1;
      if (d !== 0) return dir === 'asc' ? d : -d;
    }
    return Number(b.property_id) - Number(a.property_id);
  });
};

/**
 * カードの数（⚠️ 絞り込んだ物件から数える）。
 *   着工・着工予定：用途が建売（usage_type 0）で、キャンセル以外。基礎着工日で数える（1970-01-01 は未入力）。
 *   今期は6月1日から今日まで。着工予定は今日より後。
 */
export const satbaseKpiOf = (rows: Row[], today: string) => {
  const year = Number(today.slice(0, 4));
  const fyStart = `${Number(today.slice(5, 7)) >= 6 ? year : year - 1}-06-01`;
  let started = 0; let planned = 0; let building = 0; let selling = 0; let sellingNoAd = 0;
  for (const r of rows) {
    const spec = r.usage_type !== null && r.usage_type !== undefined && r.usage_type !== '' && Number(r.usage_type) === 0;
    const start = str(r.foundation_start_date).slice(0, 10);
    if (spec && str(r.sales_status) !== 'キャンセル' && start > '1970-01-01') {
      if (start >= fyStart && start <= today) started++;
      else if (start > today) planned++;
    }
    if (str(r.progress_status) === '建築中') building++;
    if (str(r.sales_status) === '販売中') {
      selling++;
      if (Number(r.ad_posted ?? 0) !== 1) sellingNoAd++;
    }
  }
  return { total: rows.length, started, planned, building, selling, sellingNoAd, fyStart };
};

/** 絞り込みの選択肢（⚠️ 絞り込む前の全部の物件から） */
export const satbaseOptionsOf = (rows: Row[]) => {
  const of = (key: string) => [...new Set(rows.map((r) => str(r[key])).filter((v) => v !== ''))].sort();
  return { progress: of('progress_status'), sales: of('sales_status'), pref: of('prefecture'), team: of('team') };
};

/** 今日（日本時間 'YYYY-MM-DD'） */
const todayJst = (): string => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const runSatbasePage = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const conditions: SatbaseConditions = {
    keyword: str(body.keyword), progress: str(body.progress), sales: str(body.sales), pref: str(body.pref),
    team: str(body.team), ad: str(body.ad), insta: str(body.insta),
  };
  const sort = SATBASE_SORT_KEYS.includes(str(body.sort)) ? str(body.sort) : 'property_id';
  const dir = str(body.dir) === 'asc' ? 'asc' : 'desc';
  const offset = Math.max(0, Math.floor(Number(body.offset)) || 0);
  const limit = Math.min(Math.max(1, Math.floor(Number(body.limit)) || DEFAULT_LIMIT), MAX_LIMIT);

  const { properties } = (await runSatbaseList()) as { properties: Row[] };
  const filtered = filterAndSortSatbase(properties, conditions, sort, dir);
  return {
    status: 'ok',
    rows: filtered.slice(offset, offset + limit),
    total: filtered.length,
    offset,
    options: satbaseOptionsOf(properties),
    kpi: satbaseKpiOf(filtered, todayJst()),
  };
};
