import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import type { Result } from './index';
import { runIeloveCandidates, type IeloveState } from './ieloveMatch';

/**
 * v2.2.308 媒介獲得台帳（database/DatabaseBroker.tsx）を少しずつ読む（broker_ledger_list。GET・② だけ）。
 *
 * 引数（すべて任意）：
 *   address（住所）・customer（顧客名）・staff（担当）・propCategory（物件種別）・status（物件ステータス）・ielove（いえらぶの状態）
 *   ⚠️ 物件種別を category で送らない（本文の category はゲートウェイの鍵に入り、登録の無い鍵になって 502「ループ検知」になる）
 *   sort・dir（並べ替え）・offset・limit（何件目から何件。既定 0・30）・ledgerNo（売り反響から来たとき。その台帳が入るところまで返す）
 * 応答：{ status: 'ok', rows, total, offset, staffList, categories, ieloveBase, sameProperty }
 *
 * ⚠️ 台帳は数百件なので、表示する台帳（kind = 'ledger'・show_dashboard = 1）を全部読んでから JS で絞って並べる。
 * ⚠️⚠️ 画面の予備（② に届かないとき。frontend/src/components/database/brokerLedgerFilter.ts）と同じ式にしてある。片方だけ直さない。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 1回に返す件数（既定）と上限（保存のあとの読み直しで、読み込み済みの件数をまとめて読む） */
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 1000;

export const LEDGER_SORT_KEYS = ['displayName', 'displayAddress', 'displayPrice', 'phase', 'staff', 'date', 'medium', 'updated_at'] as const;
type SortKey = (typeof LEDGER_SORT_KEYS)[number];

const sortValueOf = (r: DynamicRow, key: SortKey): string | number => {
  switch (key) {
    case 'displayName': return str(r.seller) || str(r.name) || str(r.customer);
    case 'displayAddress': return `${str(r.addr1)} ${str(r.addr2)} ${str(r.addr)}`.trim() || str(r.property) || str(r.targetProperty);
    case 'displayPrice': return Number(r.price) || Number(r.budget) || 0;
    case 'date': return str(r.contractDate);
    case 'phase': return str(r.phase) || str(r.currentStatus);
    case 'staff': return str(r.staff);
    case 'medium': return str(r.source);
    case 'updated_at': return str(r.updated_at);
    default: return '';
  }
};

/** 今年度の担当者（画面が以前 broker:list の staff から作っていたものと同じ。期は6月〜5月・日本時間） */
const fiscalYearJst = (): string => {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  return String(jst.getUTCMonth() <= 4 ? year : year + 1);
};

export const runBrokerLedgerList = async (body: Record<string, unknown>): Promise<Result> => {
  const address = str(body.address).toLowerCase();
  const customer = str(body.customer).toLowerCase();
  const staff = str(body.staff);
  const category = str(body.propCategory);
  const status = str(body.status);
  const ieloveFilter = str(body.ielove);
  const sort: SortKey = (LEDGER_SORT_KEYS as readonly string[]).includes(str(body.sort)) ? (str(body.sort) as SortKey) : 'date';
  const dir = str(body.dir) === 'asc' ? 'asc' : 'desc';
  const offset = Math.max(0, Math.floor(Number(body.offset)) || 0);
  const limitAsked = Math.floor(Number(body.limit)) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, limitAsked), MAX_LIMIT);
  const ledgerNo = str(body.ledgerNo);

  const [ledgers, staffRows, ieloveAll] = await Promise.all([
    query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind = 'ledger' AND show_dashboard = 1 ORDER BY internal_id"),
    query<DynamicRow>("SELECT name, shop, period FROM staff_list WHERE rank = 1 AND shop IN ('不動産企画係', '中古住宅専門店')"),
    ieloveFilter ? cachedIeloveStates() : Promise.resolve({} as IeloveStates),
  ]);

  const ieloveStateOf = (r: DynamicRow): IeloveState | '' => (str(r.property_db_id) ? 'linked' : ieloveAll[str(r.id)]?.state ?? '');

  const filtered = ledgers.filter((r) => {
    const combinedAddress = `${str(r.addr1)} ${str(r.addr2)} ${str(r.addr)} ${str(r.property)} ${str(r.targetProperty)}`.toLowerCase();
    const combinedCustomer = `${str(r.seller)} ${str(r.name)} ${str(r.customer)}`.toLowerCase();
    return (!address || combinedAddress.includes(address))
      && (!customer || combinedCustomer.includes(customer))
      && (!staff || r.staff === staff)
      && (!category || r.category === category)
      && (!status || r.propStatus === status)
      && (!ieloveFilter || ieloveStateOf(r) === ieloveFilter);
  });
  filtered.sort((a, b) => {
    const av = sortValueOf(a, sort);
    const bv = sortValueOf(b, sort);
    if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  // ⚠️ 売り反響から来たとき（?ledgerNo=）は、その台帳が入るところまで返す（画面がその行へ動かす）
  let end = offset + limit;
  if (ledgerNo !== '' && offset === 0) {
    const at = filtered.findIndex((r) => str(r.no) === ledgerNo);
    if (at >= end) end = Math.min(at + 1, MAX_LIMIT);
  }
  const rows = filtered.slice(offset, end);

  /** 返す行の物件の、同じ媒介物件の台帳 No.（2件以上のときだけ） */
  const propertyIds = new Set(rows.map((r) => str(r.propertyId)).filter(Boolean));
  const sameProperty: Record<string, string[]> = {};
  for (const r of ledgers) {
    const pid = str(r.propertyId);
    if (pid && propertyIds.has(pid)) (sameProperty[pid] = sameProperty[pid] ?? []).push(str(r.no) || '―');
  }
  for (const pid of Object.keys(sameProperty)) if (sameProperty[pid].length < 2) delete sameProperty[pid];

  /**
   * 絞り込みの選択肢（⚠️ 絞り込む前の、表示する台帳すべてから）。
   * ieloveBase：いえらぶの状態ごとの件数の元（つながっている台帳の数と、つながっていない台帳の id）。
   *   ⚠️ 状態（要確認・未採番など）は画面が broker:ielove_candidates で別に読み、その id で数える（計算が重いのでここでは出さない）
   */
  const fy = fiscalYearJst();
  const staffList = staffRows.filter((s) => str(s.period) === fy).map((s) => str(s.name));
  const categories = [...new Set(ledgers.map((r) => str(r.category)).filter(Boolean))].sort();
  const ieloveBase = {
    linked: ledgers.filter((r) => str(r.property_db_id) !== '').length,
    unlinkedIds: ledgers.filter((r) => str(r.property_db_id) === '').map((r) => str(r.id)),
  };

  return {
    httpStatus: 200,
    body: { status: 'ok', rows, total: filtered.length, offset, staffList, categories, ieloveBase, sameProperty },
  };
};

type IeloveStates = Record<string, { state: IeloveState; count: number }>;

/**
 * いえらぶの状態（broker:ielove_candidates と同じ）。⚠️ 計算に数秒かかるので、いえらぶで絞るときだけ使い、60秒は使い回す
 * （スクロールで続きを読むたびに計算しない）。⚠️ 失敗したら使い回さない
 */
const IELOVE_CACHE_MS = 60 * 1000;
let ieloveCache: { at: number; value: Promise<IeloveStates> } | null = null;
const cachedIeloveStates = (): Promise<IeloveStates> => {
  if (ieloveCache && Date.now() - ieloveCache.at < IELOVE_CACHE_MS) return ieloveCache.value;
  const value = runIeloveCandidates({}).then((r) => (r.body.ledgers ?? {}) as IeloveStates);
  const entry = { at: Date.now(), value };
  ieloveCache = entry;
  value.catch(() => { if (ieloveCache === entry) ieloveCache = null; });
  return value;
};
