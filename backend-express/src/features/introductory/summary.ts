import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';

/**
 * 紹介キャンペーンサマリー（ヘッダー → 紹介キャンペーン → 紹介キャンペーンサマリー）。v2.2.192 新規。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面: frontend/src/components/header/IntroductorySummary.tsx
 *
 * ⚠️⚠️ **対象は3つの顧客台帳の「紹介」だけ**（注文 master_data／建売 master_data_kaeru／中古 master_data_resale）。
 *   ⚠️ `sales_promotion_name` の**前後の空白・改行を落として「紹介」と一致するもの**（2026-10-15 の指示）。
 *     ⚠️ 実測: 末尾に CR / CRLF が付いた「紹介」が4件ある（`紹介\r`・`紹介\r\n`）。完全一致だと落ちる。
 *   ⚠️ お友達紹介キャンペーンの受付表（inquiry_introductory）**ではない。**
 *
 * ⚠️ 歩留まりの定義は営業別契約率（staffContract.ts）と同じ列を使う。
 *   面談＝初回面談以降の日付あり／次アポ＝事前審査・第二面談・契約の日付あり／契約＝status 契約済み。
 *   ⚠️⚠️ **status＝重複は数えない。**
 *
 * ⚠️⚠️ **併売店（shop_list.parent_shop がある店舗）の担当は、親店舗として数える**（2026-10-15 の指示）。
 *   ⚠️ 店舗の選択肢に併売店は出さない（report_flag=1 かつ parent_shop IS NULL）。
 *     ⚠️ 親店舗にまとめないと、どの店舗を選んでも出てこない顧客ができる。
 *
 * ⚠️ 集計はここで行う（⚠️ 紹介は全事業で千件に届かないので、毎回全件読んで絞る）。
 * ─────────────────────────────────────────────
 */

/** 商談フェーズの列。⚠️ staffContract.ts と同じ列ID（⚠️ DBのコメントは当てにならない） */
const COL_INQUIRY = 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99';     // 反響取得日
const COL_INTERVIEW = 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7';   // 初回面談
const COL_SCREENING = 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR';   // 事前審査
const COL_APPOINTMENT = 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'; // 第二面談
const COL_CONTRACT = 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG';    // 契約

/** 顧客台帳。⚠️ SQL に直接埋め込むので、**この定数以外の値を入れないこと** */
const TABLES = [
  { table: 'master_data', division: '注文' },
  { table: 'master_data_kaeru', division: '建売' },
  { table: 'master_data_resale', division: '中古' },
] as const;

/** 紹介元・ブランド・店舗が空のときの表示。⚠️ 紹介元は実測で約4割が空（2026-10-15） */
export const UNSET_LABEL = '（未入力）';
/** エリアが分からないときの表示（⚠️ 店舗が shop_list に無い、または名前に県名が無い） */
export const UNKNOWN_AREA = '（不明）';

interface ReferralRow extends RowDataPacket {
  division: string;
  status: string | null;
  source: string | null;
  brand: string | null;
  store: string | null;
  col_inquiry: string | null;
  col_interview: string | null;
  col_screening: string | null;
  col_appointment: string | null;
  col_contract: string | null;
}

interface ShopRow extends RowDataPacket {
  shop: string;
  area: string | null;
  parent_shop: string | null;
  report_flag: number;
  division: string | null;
}

export interface SummaryFilter {
  /** `YYYY-MM`。⚠️ 空なら絞らない */
  startMonth: string;
  endMonth: string;
  /** 店舗（親店舗）。⚠️ 空なら絞らない */
  shop: string;
  /** エリア（shop_list.area。⚠️ 空の店舗は店舗名の県名で補ったもの）。⚠️ 空なら絞らない */
  area: string;
}

/** 歩留まり1行。⚠️ 率は画面で出す（分母0の見せ方は画面の判断） */
export interface FunnelRow {
  key: string;
  inquiry: number;
  meeting: number;
  next: number;
  contract: number;
  /** 反響取得日 → 契約日の日数（中央値）。⚠️ 両方の日付が読める契約だけで出す */
  lagMedian: number | null;
}

export interface SummaryResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const hasValue = (value: unknown): boolean => String(value ?? '').trim() !== '';

/**
 * 日付から `YYYY-MM` を取り出す。読めなければ空文字。
 * ⚠️ staffContract.ts の toMonth と同じ（`2026-02-28` / `2026/06/01` の両方がある）。
 */
const toMonth = (value: unknown): string => {
  const matched = /^(\d{4})[-/](\d{1,2})(?:[-/]|$)/.exec(String(value ?? '').trim());
  if (matched === null) return '';
  return `${matched[1]}-${matched[2].padStart(2, '0')}`;
};

const toDate = (value: unknown): Date | null => {
  const matched = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(value ?? '').trim());
  return matched === null ? null : new Date(+matched[1], +matched[2] - 1, +matched[3]);
};

/**
 * shop_list.area が空の店舗のエリアを、店舗名に含まれる県名から補う。
 *
 * ⚠️⚠️ **建売・中古・不動産企画室の店舗は area が空**（実測 2026-10-15。例: 宮崎係・鹿児島1係・熊本係）。
 *   ⚠️ 補わないと、建売の紹介がすべて「（不明）」に入り、⚠️ **エリアで絞ると消える。**
 *   ⚠️ 県名が無い店舗（外販・中古住宅専門店など）は空のまま（＝「（不明）」）。
 */
const PREFECTURES = ['鹿児島', '宮崎', '熊本', '大分', '佐賀', '福岡', '長崎'];
const areaFromName = (shop: string): string => {
  const found = PREFECTURES.find((p) => shop.includes(p));
  return found === undefined ? '' : `${found}県`;
};

/** ⚠️ 期間が空なら日付が読めない顧客も通す（⚠️ 何も選んでいないのに件数が減らないように） */
const inRange = (month: string, filter: SummaryFilter): boolean => {
  if (filter.startMonth === '' && filter.endMonth === '') return true;
  if (month === '') return false;
  if (filter.startMonth !== '' && month < filter.startMonth) return false;
  if (filter.endMonth !== '' && month > filter.endMonth) return false;
  return true;
};

/** 1人分（集計用に整えたもの） */
interface Customer {
  division: string;
  source: string;
  brand: string;
  shop: string;
  area: string;
  meeting: boolean;
  next: boolean;
  contract: boolean;
  lag: number | null;
}

const isUnset = (key: string): boolean => key === UNSET_LABEL || key === UNKNOWN_AREA;

const funnelOf = (key: string, list: Customer[]): FunnelRow => {
  const lags = list.map((c) => c.lag).filter((v): v is number => v !== null && v >= 0).sort((a, b) => a - b);
  return {
    key,
    inquiry: list.length,
    meeting: list.filter((c) => c.meeting).length,
    next: list.filter((c) => c.next).length,
    contract: list.filter((c) => c.contract).length,
    lagMedian: lags.length === 0 ? null : lags[Math.floor(lags.length / 2)],
  };
};

/** キーごとの歩留まり。⚠️ 反響の多い順（⚠️ 未入力・不明は最後） */
const groupFunnel = (list: Customer[], keyOf: (c: Customer) => string): FunnelRow[] => {
  const groups = new Map<string, Customer[]>();
  for (const c of list) {
    const key = keyOf(c);
    const found = groups.get(key);
    if (found === undefined) groups.set(key, [c]);
    else found.push(c);
  }
  return [...groups.entries()]
    .map(([key, rows]) => funnelOf(key, rows))
    .sort((a, b) => Number(isUnset(a.key)) - Number(isUnset(b.key)) || b.inquiry - a.inquiry);
};

/** 行 × 紹介元。⚠️ 画面で表にする（セルは歩留まり） */
const crossFunnel = (list: Customer[], rowOf: (c: Customer) => string): { rows: string[]; cells: Record<string, Record<string, FunnelRow>> } => {
  const rows = groupFunnel(list, rowOf).map((r) => r.key);
  const cells: Record<string, Record<string, FunnelRow>> = {};
  for (const row of rows) {
    cells[row] = {};
    for (const f of groupFunnel(list.filter((c) => rowOf(c) === row), (c) => c.source)) cells[row][f.key] = f;
  }
  return { rows, cells };
};

/**
 * 紹介キャンペーンのサマリーを返す。
 *
 * ⚠️⚠️ **選択肢（店舗・エリア）は絞り込みに関係なく全部返す。**
 *   ⚠️ 絞り込んだ結果から作ると、選んだ瞬間に他の選択肢が消えて戻れなくなる。
 */
export const runIntroductorySummary = async (filter: SummaryFilter): Promise<SummaryResult> => {
  const [shops, ...perTable] = await Promise.all([
    query<ShopRow>('SELECT shop, area, parent_shop, report_flag, division FROM shop_list ORDER BY id'),
    ...TABLES.map(({ table, division }) =>
      query<ReferralRow>(
        `SELECT ? AS division, status,
                introduction_person_category AS source,
                brand, in_charge_store AS store,
                ${COL_INQUIRY} AS col_inquiry,
                ${COL_INTERVIEW} AS col_interview,
                ${COL_SCREENING} AS col_screening,
                ${COL_APPOINTMENT} AS col_appointment,
                ${COL_CONTRACT} AS col_contract
           FROM ${table}
          WHERE TRIM(REPLACE(REPLACE(sales_promotion_name, '\\r', ''), '\\n', '')) = '紹介'`,
        [division]
      )
    ),
  ]);

  /** 店舗 → 親店舗。⚠️ 併売店は親店舗として数える */
  const parentOf = new Map<string, string>();
  /** 店舗 → エリア。⚠️ 併売店は親店舗のエリアを使う（⚠️ 実測では親と同じ県） */
  const areaOf = new Map<string, string>();
  for (const s of shops) areaOf.set(s.shop, hasValue(s.area) ? String(s.area).trim() : areaFromName(s.shop));
  for (const s of shops) {
    const parent = hasValue(s.parent_shop) ? String(s.parent_shop).trim() : s.shop;
    parentOf.set(s.shop, parent);
    if (parent !== s.shop && hasValue(areaOf.get(parent))) areaOf.set(s.shop, areaOf.get(parent) ?? '');
  }

  const customers: Customer[] = [];
  for (const row of perTable.flat()) {
    if (row.status === '重複') continue;
    if (!inRange(toMonth(row.col_inquiry), filter)) continue;

    const store = String(row.store ?? '').trim();
    const shop = parentOf.get(store) ?? store;
    const area = areaOf.get(store) ?? '';
    if (filter.shop !== '' && shop !== filter.shop) continue;
    if (filter.area !== '' && area !== filter.area) continue;

    const contract = row.status === '契約済み';
    const inquiryDate = toDate(row.col_inquiry);
    const contractDate = toDate(row.col_contract);
    customers.push({
      division: row.division,
      source: hasValue(row.source) ? String(row.source).trim() : UNSET_LABEL,
      brand: hasValue(row.brand) ? String(row.brand).trim() : UNSET_LABEL,
      shop: shop === '' ? UNSET_LABEL : shop,
      area: area === '' ? UNKNOWN_AREA : area,
      contract,
      meeting: contract || hasValue(row.col_interview) || hasValue(row.col_screening)
        || hasValue(row.col_appointment) || hasValue(row.col_contract),
      next: contract || hasValue(row.col_screening) || hasValue(row.col_appointment) || hasValue(row.col_contract),
      lag: contract && inquiryDate !== null && contractDate !== null
        ? Math.round((contractDate.getTime() - inquiryDate.getTime()) / 86_400_000)
        : null,
    });
  }

  /**
   * 店舗の選択肢。⚠️⚠️ **report_flag=1 かつ parent_shop IS NULL**（2026-10-15 の指示）。
   *   ⚠️ 全事業部（注文・建売・中古・不動産企画室）。⚠️ shop_list の id 順。
   */
  const shopOptions = shops
    .filter((s) => Number(s.report_flag) === 1 && !hasValue(s.parent_shop))
    .map((s) => ({ name: s.shop, area: areaOf.get(s.shop) ?? '', division: s.division ?? '' }));
  const areaOptions = [...new Set(shopOptions.map((s) => s.area).filter((a) => a !== ''))];

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      filter,
      total: funnelOf('全体', customers),
      bySource: groupFunnel(customers, (c) => c.source),
      byDivision: groupFunnel(customers, (c) => c.division),
      byBrand: groupFunnel(customers, (c) => c.brand),
      byArea: groupFunnel(customers, (c) => c.area),
      byShop: groupFunnel(customers, (c) => c.shop),
      brandSource: crossFunnel(customers, (c) => c.brand),
      areaSource: crossFunnel(customers, (c) => c.area),
      shops: shopOptions,
      areas: areaOptions,
    },
  };
};
