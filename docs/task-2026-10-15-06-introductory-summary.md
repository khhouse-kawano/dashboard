# 2026-10-15 紹介キャンペーンサマリー（v2.2.192）

## 依頼（ReadMeClaude.md）
- Header.tsx の「紹介キャンペーン」に **紹介キャンペーンサマリー** を追加。KPI ごとの歩留まりをリアルタイムで表示
  - 参照: Downloads/contract_analysis_2026-10-15.html（紹介の章）
- UI は Dashboard のトンマナで SaaS 風（GoogleReview.tsx 参照）。モーダルは fullscreen
- 年 × 紹介元は不要。代わりに `startMonth` / `endMonth`（反響取得日）、`targetShop` / `targetArea` で絞り込み
  - 店舗の選択肢は shop_list の report_flag=1 かつ parent_shop IS NULL
- master_data・master_data_kaeru・master_data_resale で全事業部が対象。sales_promotion_name = '紹介' のみ
- 推論の文章は不要。KPI ごとの歩留まりの数字だけ
- 確認事項への回答（2026-10-15）: ①併売店の担当は親店舗として数える ②末尾に改行が付いた「紹介」も含める

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/introductory | **summary.ts**（新規） | 関数 `runIntroductorySummary`・`funnelOf`・`groupFunnel`・`crossFunnel`・`areaFromName`・`toMonth`・`toDate`・`inRange`、定数 `TABLES`・`UNSET_SOURCE`・`PREFECTURES` |
| backend-express/src/gateway | **registry.ts** | `introductory_summary` を登録（auth: staff） |
| frontend/src/components/header | **IntroductorySummary.tsx**（新規） | 画面。部品 `FunnelTable`・`FunnelBar`・`CrossTable` |
| frontend/src/components/header | **Header.tsx** | メニュー・editMapping・isFullscreenMenu に追加、import |
| frontend/src/utils | version.ts | 2.2.192 |
| backend/scripts/sql | 2026-10-15_update_log_2.2.192.sql（新規） | ローカルは no=288 で投入済み |

⚠️ ① の PHP・DB の列は変更なし。

## 仕様
- 対象: 3台帳の `TRIM(REPLACE(REPLACE(sales_promotion_name, CR, ''), LF, '')) = '紹介'`。status＝重複は除く
- 面談＝初回面談以降の日付あり（または契約済み）／次アポ＝事前審査・第二面談・契約の日付あり（または契約済み）／契約＝status 契約済み。率の分母は反響
- 期間: 反響取得日（step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99）の `YYYY-MM`。`/` と `-` の両方を読む。期間を指定したときは日付が読めない顧客を外す
- 店舗: 担当店舗（in_charge_store）。**併売店（parent_shop あり）は親店舗に含める**
- エリア: 担当店舗の shop_list.area。**area が空の店舗（建売・中古・不動産企画室）は店舗名の県名から補う**（宮崎係→宮崎県 など。外販・中古住宅専門店・不動産企画係は不明）
- 店舗・エリアの選択肢は絞り込みに関係なく全部返す。エリアを選ぶと店舗の選択肢がそのエリアに絞られる
- 画面の表: KPI（反響・面談・次アポ・契約・契約までの日数）／紹介元別／事業部別／エリア別／ブランド別／ブランド×紹介元／エリア×紹介元／店舗別。見出しクリックで並べ替え。反響10件未満は灰色

## 確認（ローカル）
| 条件 | 反響 | 面談 | 次アポ | 契約 |
|---|---|---|---|---|
| 指定なし | 803（注文776・建売27・中古0） | 674 | 504 | 253 |
| 2025-06〜2026-06 | 453 | 395 | 305 | 158 |
| KH鹿屋店（併売店 DJH鹿屋店 4件を含む＝29＋4） | 33 | 28 | 21 | 16 |
| 宮崎県（宮崎係の建売を含む） | 174 | 134 | 80 | 44 |
- 注文の 776 / 契約 246 は contract_analysis_2026-10-15.html の紹介の数字と一致
- 画面: ビルドを Playwright で表示（API は ② の実際の集計結果を返す偽物）。エリア「宮崎県」で店舗の選択肢が KH宮崎店・KH都城店・KH延岡店・DJH都城店・DJH宮崎店・PGH宮崎店・宮崎係・宮崎県 に絞られ、選ぶたびに `introductory_summary` が絞り込み付きで呼ばれることを確認
- 型チェック: ② は通過。フロントは既存の5件以外なし。ビルド main.e10fc675.js / main.b8a7c60b.css

---

## backend-express/src/features/introductory/summary.ts（全文）
```ts
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

/** 紹介元が空のときの表示。⚠️ 実測で約4割が空（2026-10-15） */
export const UNSET_SOURCE = '（未入力）';

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
  /** エリア（shop_list.area）。⚠️ 空なら絞らない */
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

/** キーごとの歩留まり。⚠️ 反響の多い順（⚠️ 未入力は最後） */
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
    .sort((a, b) => Number(a.key === UNSET_SOURCE) - Number(b.key === UNSET_SOURCE) || b.inquiry - a.inquiry);
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
      source: hasValue(row.source) ? String(row.source).trim() : UNSET_SOURCE,
      brand: hasValue(row.brand) ? String(row.brand).trim() : '（未入力）',
      shop: shop === '' ? '（未入力）' : shop,
      area: area === '' ? '（不明）' : area,
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
```

## backend-express/src/gateway/registry.ts（追加部分）
```ts
import { runIntroductorySummary } from '../features/introductory/summary';
```
```ts
/**
 * 紹介キャンペーンサマリー（v2.2.192）。
 *
 * ⚠️⚠️ **お友達紹介の受付表（inquiry_introductory）ではなく、3つの顧客台帳の「紹介」を集計する。**
 *   ⚠️ 中身は features/introductory/summary.ts。
 * ⚠️ 期間は `YYYY-MM`（反響取得日）。店舗は親店舗（併売店は親店舗として数える）。⚠️ 空はすべて「絞らない」。
 */
register({
  request: 'introductory_summary',
  summary: '紹介（注文・建売・中古）の紹介元・事業部・ブランド・エリア別の歩留まり',
  phpSource: '（新規。PHP版なし）',
  auth: 'staff',
  handler: async (ctx) => {
    const text = (key: string) => (typeof ctx.body[key] === 'string' ? (ctx.body[key] as string).trim() : '');
    const result = await runIntroductorySummary({
      startMonth: text('startMonth'),
      endMonth: text('endMonth'),
      shop: text('shop'),
      area: text('area'),
    });
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});
```

## frontend/src/components/header/Header.tsx（変更部分）
```tsx
import IntroductorySummary from './IntroductorySummary';
        // ⚠️ v2.2.192: 「紹介キャンペーンサマリー」を追加（⚠️ 顧客台帳の「紹介」の歩留まり。IntroductorySummary.tsx）
        '紹介キャンペーン': ['反響一覧', '紹介キャンペーンサマリー'],
        '紹介キャンペーン/紹介キャンペーンサマリー': <IntroductorySummary />,
        // ⚠️ 紹介キャンペーンサマリー（v2.2.192）は表が縦に7つ並び、横にも広い（2026-10-15 の指示で全画面）。
        //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。**
        //     ⚠️ コンポーネント側に閉じるボタンを実装しないこと。二重になる。
        '紹介キャンペーン/紹介キャンペーンサマリー',
```

## frontend/src/components/header/IntroductorySummary.tsx（全文）
```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';

/**
 * 紹介キャンペーンサマリー（ヘッダー → 紹介キャンペーン → 紹介キャンペーンサマリー）。v2.2.192 新規。
 *
 * ─────────────────────────────────────────────
 * ⚠️ データは ② の `introductory_summary`（features/introductory/summary.ts）。
 *   ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ ② が落ちるとこの画面は動かない。
 *
 * ⚠️⚠️ **対象は注文・建売・中古の顧客台帳の「紹介」**（sales_promotion_name）。
 *   ⚠️ お友達紹介の受付表（反響一覧＝InquiryIntroductory）とは別物。
 *
 * ⚠️ 絞り込み（期間・店舗・エリア）は ⚠️⚠️ **すべてサーバーで行う**（選ぶたびに取り直す）。
 *   ⚠️ 期間は反響取得日。⚠️ 店舗は親店舗（⚠️ 併売店の担当は親店舗に含まれる）。
 *
 * ⚠️ 推論の文章は出さない（AI を動かさない。数字だけ。2026-10-15 の指示）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせてある。
 * ⚠️ モーダルは ⚠️⚠️ **全画面**（Header.tsx の isFullscreenMenu）。
 *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出すので、ここには作らないこと。**
 * ─────────────────────────────────────────────
 */

/** 歩留まり1行。⚠️ ② の FunnelRow と同じ形 */
type FunnelRow = {
    key: string;
    inquiry: number;
    meeting: number;
    next: number;
    contract: number;
    lagMedian: number | null;
};

type Cross = { rows: string[]; cells: Record<string, Record<string, FunnelRow>> };
type ShopOption = { name: string; area: string; division: string };

type Summary = {
    total: FunnelRow;
    bySource: FunnelRow[];
    byDivision: FunnelRow[];
    byBrand: FunnelRow[];
    byArea: FunnelRow[];
    byShop: FunnelRow[];
    brandSource: Cross;
    areaSource: Cross;
};

/** ⚠️ ② が空のときに返す紹介元の表示。⚠️ summary.ts の UNSET_SOURCE と同じ */
const UNSET_SOURCE = '（未入力）';

/** マトリクスの列に出す紹介元の最低件数。⚠️ 少ない紹介元まで並べると列が20近くになる */
const MIN_SOURCE_COLUMN = 5;

/** 率。⚠️⚠️ **分母が0なら null**（⚠️ 0% と出さない。「記録が無い」と「0件」は違う） */
const rate = (count: number, denominator: number): number | null =>
    denominator === 0 ? null : Math.round((count / denominator) * 1000) / 10;
const percent = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

/**
 * 月の選択肢。⚠️ 当月から過去36ヶ月。
 * ⚠️⚠️ **`new Date(y, m, 1)` で作る。** ⚠️ 文字列から作ると UTC 解釈で月がずれることがある。
 */
const MONTHS = (() => {
    const now = new Date();
    const list: string[] = [];
    for (let i = 0; i < 36; i += 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
})();

type SortKey = 'key' | 'inquiry' | 'meetingRate' | 'nextRate' | 'contract' | 'contractRate' | 'lagMedian';

const valueOf = (row: FunnelRow, key: SortKey): number | string => {
    switch (key) {
        case 'key': return row.key;
        case 'inquiry': return row.inquiry;
        case 'meetingRate': return rate(row.meeting, row.inquiry) ?? -1;
        case 'nextRate': return rate(row.next, row.inquiry) ?? -1;
        case 'contract': return row.contract;
        case 'contractRate': return rate(row.contract, row.inquiry) ?? -1;
        case 'lagMedian': return row.lagMedian ?? -1;
        default: return 0;
    }
};

/**
 * 歩留まりの表（紹介元・事業部・ブランド・エリア・店舗で共用）。
 * ⚠️ 並べ替えは見出しクリック（GoogleReview.tsx と同じ作法）。⚠️ 表ごとに独立して並べ替える。
 */
const FunnelTable = ({ title, rows, label }: { title: string; rows: FunnelRow[]; label: string }) => {
    /** ⚠️ 既定は反響の多い順。⚠️ **率を既定にすると分母1件で100%の行が先頭に来る** */
    const [sortKey, setSortKey] = useState<SortKey>('inquiry');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const sorted = useMemo(() => [...rows].sort((a, b) => {
        // ⚠️ 未入力は並べ替えに関係なく最後（⚠️ 先頭に来ると目立ちすぎる）
        if (a.key === UNSET_SOURCE && b.key !== UNSET_SOURCE) return 1;
        if (b.key === UNSET_SOURCE && a.key !== UNSET_SOURCE) return -1;
        const x = valueOf(a, sortKey);
        const y = valueOf(b, sortKey);
        const diff = typeof x === 'string' || typeof y === 'string'
            ? String(x).localeCompare(String(y), 'ja')
            : x - y;
        if (diff === 0) return a.key.localeCompare(b.key, 'ja');
        return sortOrder === 'asc' ? diff : -diff;
    }), [rows, sortKey, sortOrder]);

    const Head = ({ text, keyName, align = 'right', note }: { text: string; keyName: SortKey; align?: 'left' | 'right'; note?: string }) => {
        const active = sortKey === keyName;
        return (
            <th
                className={`ics_th ics_th_sort text-${align}`}
                title={note ?? 'クリックで並べ替え'}
                onClick={() => {
                    if (active) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(keyName); setSortOrder('desc'); }
                }}
            >
                {text}
                <span className={`ics_sort_icon${active ? ' is_active' : ''}`}>
                    {active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };

    return (
        <section className="ics_section">
            <div className="ics_section_title">{title}</div>
            <div className="ics_table_wrap">
                <table className="ics_table">
                    <thead>
                        <tr>
                            <Head text={label} keyName="key" align="left" />
                            <Head text="反響" keyName="inquiry" />
                            <Head text="面談率" keyName="meetingRate" note="初回面談以降の日付がある人 ÷ 反響" />
                            <Head text="次アポ率" keyName="nextRate" note="事前審査・第二面談・契約の日付がある人 ÷ 反響" />
                            <Head text="契約" keyName="contract" />
                            <Head text="契約率" keyName="contractRate" note="契約済み ÷ 反響" />
                            <th className="ics_th text-end" title="面談した人のうち契約した割合">面談→契約</th>
                            <Head text="契約まで" keyName="lagMedian" note="反響取得日から契約日までの日数（中央値）" />
                            {/* ⚠️ 棒は列幅いっぱい（⚠️ 半分幅の表で固定幅にすると右へはみ出す） */}
                            <th className="ics_th" style={{ width: '18%' }}>歩留まり</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr><td className="ics_td ics_empty" colSpan={9}>該当する紹介がありません</td></tr>
                        ) : sorted.map(row => (
                            <tr key={row.key} className={`ics_row${row.inquiry < 10 ? ' is_small' : ''}`}>
                                <td className="ics_td ics_name">{row.key}</td>
                                <td className="ics_td ics_num">{row.inquiry.toLocaleString()}</td>
                                <td className="ics_td ics_num">{percent(rate(row.meeting, row.inquiry))}</td>
                                <td className="ics_td ics_num">{percent(rate(row.next, row.inquiry))}</td>
                                <td className="ics_td ics_num">{row.contract.toLocaleString()}</td>
                                <td className="ics_td ics_num ics_main">{percent(rate(row.contract, row.inquiry))}</td>
                                <td className="ics_td ics_num">{percent(rate(row.contract, row.meeting))}</td>
                                <td className="ics_td ics_num">{row.lagMedian === null ? '—' : `${row.lagMedian}日`}</td>
                                <td className="ics_td"><FunnelBar row={row} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

/** 横棒（反響＝100%）。⚠️ 面談・次アポ・契約を重ねる */
const FunnelBar = ({ row }: { row: FunnelRow }) => {
    if (row.inquiry === 0) return null;
    const w = (n: number) => `${(n / row.inquiry) * 100}%`;
    return (
        <div className="ics_bar" title={`面談 ${row.meeting} / 次アポ ${row.next} / 契約 ${row.contract}`}>
            <i className="ics_bar_meet" style={{ width: w(row.meeting) }} />
            <i className="ics_bar_next" style={{ width: w(row.next) }} />
            <i className="ics_bar_contract" style={{ width: w(row.contract) }} />
        </div>
    );
};

/**
 * 行 × 紹介元の表。セルは契約率と「契約/反響」。
 * ⚠️ 列は反響が MIN_SOURCE_COLUMN 件以上の紹介元だけ（⚠️ 未入力は常に最後に出す）。
 */
const CrossTable = ({ title, label, cross, sources }: { title: string; label: string; cross: Cross; sources: string[] }) => (
    <section className="ics_section">
        <div className="ics_section_title">{title}</div>
        <div className="ics_table_wrap">
            <table className="ics_table">
                <thead>
                    <tr>
                        <th className="ics_th">{label}</th>
                        {sources.map(s => <th key={s} className="ics_th text-end">{s}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {cross.rows.length === 0 ? (
                        <tr><td className="ics_td ics_empty" colSpan={sources.length + 1}>該当する紹介がありません</td></tr>
                    ) : cross.rows.map(row => (
                        <tr key={row} className="ics_row">
                            <td className="ics_td ics_name">{row}</td>
                            {sources.map(s => {
                                const cell = cross.cells[row]?.[s];
                                if (!cell) return <td key={s} className="ics_td ics_num ics_muted">—</td>;
                                const value = rate(cell.contract, cell.inquiry);
                                // ⚠️ 色は契約率 0〜60% を薄→濃。⚠️ 反響10件未満は色を付けない（参考値）
                                const strength = cell.inquiry < 10 || value === null ? 0 : Math.min(value / 60, 1);
                                return (
                                    <td
                                        key={s}
                                        className={`ics_td ics_num ics_cell${cell.inquiry < 10 ? ' is_small' : ''}`}
                                        style={strength > 0 ? { background: `rgba(15, 118, 110, ${(0.08 + strength * 0.5).toFixed(2)})` } : undefined}
                                        title={`面談 ${percent(rate(cell.meeting, cell.inquiry))} / 次アポ ${percent(rate(cell.next, cell.inquiry))}`}
                                    >
                                        {percent(value)}
                                        <small>{cell.contract}/{cell.inquiry}</small>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </section>
);

const IntroductorySummary = () => {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [shops, setShops] = useState<ShopOption[]>([]);
    const [areas, setAreas] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /** ⚠️ 絞り込み。⚠️⚠️ **既定はすべて空＝全期間・全店舗・全エリア** */
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [targetArea, setTargetArea] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', {
                request: 'introductory_summary',
                startMonth,
                endMonth,
                shop: targetShop,
                area: targetArea,
            });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '集計を取得できませんでした。');
                return;
            }
            setSummary(res.data as Summary);
            setShops(res.data.shops ?? []);
            setAreas(res.data.areas ?? []);
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '集計を取得できませんでした。分析サーバーが停止している可能性があります。');
        } finally {
            setLoading(false);
        }
    }, [startMonth, endMonth, targetShop, targetArea]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    /** 店舗の選択肢。⚠️ エリアを選んだらそのエリアの店舗だけ（⚠️ ② が返す shop_list の id 順のまま） */
    const shopOptions = useMemo(
        () => (targetArea === '' ? shops : shops.filter(s => s.area === targetArea)),
        [shops, targetArea]
    );

    /**
     * 紹介元の列（マトリクス用）。⚠️ 反響の多い順。⚠️ 未入力は最後。
     * ⚠️ 少数の紹介元は列にしない（⚠️ 紹介元別の表には全部出ている）。
     */
    const sourceColumns = useMemo(() => {
        const list = (summary?.bySource ?? []).filter(r => r.inquiry >= MIN_SOURCE_COLUMN && r.key !== UNSET_SOURCE).map(r => r.key);
        if ((summary?.bySource ?? []).some(r => r.key === UNSET_SOURCE)) list.push(UNSET_SOURCE);
        return list;
    }, [summary]);

    const total = summary?.total;
    const unset = summary?.bySource.find(r => r.key === UNSET_SOURCE);
    const filtered = startMonth !== '' || endMonth !== '' || targetShop !== '' || targetArea !== '';

    /** KPI の1段。⚠️ 下の小さい数字は「前の段からの率」 */
    const Step = ({ label, count, base, baseLabel, main = false }: { label: string; count: number; base: number; baseLabel: string; main?: boolean }) => (
        <div className={`ics_kpi_card${main ? ' is_main' : ''}`}>
            <div className="ics_kpi_label">{label}</div>
            <div className="ics_kpi_value">{count.toLocaleString()}</div>
            <div className="ics_kpi_sub">
                反響の <b>{percent(rate(count, total?.inquiry ?? 0))}</b>
                {baseLabel !== '' && <span className="ms-2">{baseLabel} {percent(rate(count, base))}</span>}
            </div>
        </div>
    );

    return (
        <div className="ics_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden**（Header.tsx）。
                 *   ⚠️ 余白はこちらで持ち、⚠️ **この外枠だけをスクロールさせる**（表が縦に5つ以上並ぶため）。
                 */
                .ics_wrap { font-size: 13px; color: #1f2937; height: 100%; overflow: auto;
                            padding: 16px 40px 28px; box-sizing: border-box; }
                .ics_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
                .ics_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .ics_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .ics_note { font-size: 11px; color: #6b7280; }
                .ics_bar_filter { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                                  background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .ics_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .ics_reset { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer;
                             background: none; border: none; padding: 4px 0; white-space: nowrap; }
                .ics_reset:hover { text-decoration: underline; }
                .ics_reset:disabled { color: #cbd5e1; cursor: default; text-decoration: none; }

                /* ⚠️ KPI。⚠️ 反響 → 面談 → 次アポ → 契約 の順に横へ並べる（⚠️ 歩留まりの流れが読めるように） */
                .ics_kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
                .ics_kpi_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .ics_kpi_card.is_main { border-color: #99d5cf; background: #f2fbf9; }
                .ics_kpi_label { font-size: 11px; color: #6b7280; }
                .ics_kpi_value { font-size: 22px; font-weight: 700; line-height: 1.25; font-variant-numeric: tabular-nums; }
                .ics_kpi_card.is_main .ics_kpi_value { color: #0f766e; }
                .ics_kpi_sub { font-size: 11px; color: #6b7280; font-variant-numeric: tabular-nums; }
                .ics_kpi_sub b { color: #1f2937; }

                .ics_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb;
                               border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; }
                .ics_caution b { color: #78350f; }

                .ics_grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 620px), 1fr)); gap: 14px; }
                .ics_section_title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
                .ics_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; }
                .ics_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .ics_th { background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 8px 10px;
                          font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                .ics_th_sort { cursor: pointer; user-select: none; }
                .ics_th_sort:hover { background: #eef2f7; }
                .ics_sort_icon { margin-left: 5px; font-size: 10px; color: #cbd5e1; }
                .ics_sort_icon.is_active { color: #2563eb; }
                .ics_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; white-space: nowrap; }
                .ics_row:hover > .ics_td { background: #f8fafc; }
                .ics_row:last-child > .ics_td { border-bottom: none; }
                .ics_name { font-weight: 700; white-space: normal; min-width: 120px; }
                .ics_num { text-align: right; font-variant-numeric: tabular-nums; }
                .ics_main { font-weight: 700; color: #0f766e; }
                /* ⚠️ 反響10件未満は薄く出す（⚠️ 率が1件で大きく動くため参考値） */
                .ics_row.is_small > .ics_td, .ics_cell.is_small { color: #9ca3af; }
                .ics_row.is_small > .ics_main { color: #9ca3af; }
                .ics_cell small { display: block; font-size: 10px; color: inherit; opacity: .7; line-height: 1.2; }
                .ics_muted { color: #cbd5e1; }
                .ics_empty { color: #9ca3af; text-align: center; padding: 20px; }

                .ics_bar { position: relative; width: 100%; min-width: 70px; height: 12px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
                .ics_bar i { position: absolute; left: 0; top: 0; bottom: 0; }
                .ics_bar_meet { background: #cbd5e1; }
                .ics_bar_next { background: #7fb8b1; }
                .ics_bar_contract { background: #0f766e; }
                .ics_legend { display: flex; gap: 14px; font-size: 11px; color: #6b7280; }
                .ics_legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
            `}</style>

            <div className="ics_inner">
                <div className="ics_head">
                    <span className="ics_title">
                        <i className="fa-solid fa-handshake me-2" style={{ color: '#0f766e' }} aria-hidden="true" />
                        紹介キャンペーンサマリー
                    </span>
                    <span className="ics_note">注文・建売・中古の顧客台帳で、媒体が「紹介」の顧客（重複を除く）</span>
                </div>

                <div className="ics_bar_filter">
                    <div>
                        <div className="ics_label">エリア</div>
                        <Form.Select
                            size="sm" value={targetArea} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => {
                                const area = e.target.value;
                                setTargetArea(area);
                                // ⚠️ 別エリアの店舗が選ばれたままだと0件になる。外す
                                if (targetShop !== '' && area !== '' && !shops.some(s => s.name === targetShop && s.area === area)) setTargetShop('');
                            }}
                        >
                            <option value="">すべて</option>
                            {areas.map(a => <option key={a} value={a}>{a}</option>)}
                        </Form.Select>
                    </div>
                    <div>
                        <div className="ics_label">店舗</div>
                        <Form.Select
                            size="sm" value={targetShop} style={{ width: '180px', fontSize: '12px' }}
                            onChange={(e) => setTargetShop(e.target.value)}
                        >
                            <option value="">すべて</option>
                            {shopOptions.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </Form.Select>
                    </div>
                    <div>
                        <div className="ics_label">開始月（反響取得日）</div>
                        <Form.Select
                            size="sm" value={startMonth} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => setStartMonth(e.target.value)}
                        >
                            <option value="">指定なし</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Form.Select>
                    </div>
                    <div>
                        <div className="ics_label">終了月（反響取得日）</div>
                        <Form.Select
                            size="sm" value={endMonth} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => setEndMonth(e.target.value)}
                        >
                            <option value="">指定なし</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Form.Select>
                    </div>
                    <button
                        type="button"
                        className="ics_reset"
                        disabled={!filtered}
                        onClick={() => { setStartMonth(''); setEndMonth(''); setTargetShop(''); setTargetArea(''); }}
                    >
                        絞り込みを外す
                    </button>
                    {/* ⚠️ 開始が終了より後だと0件になる。⚠️ **黙って空にしない** */}
                    {startMonth !== '' && endMonth !== '' && startMonth > endMonth && (
                        <span className="ics_note text-danger">開始月が終了月より後になっています</span>
                    )}
                    {loading && summary !== null && <span className="ics_note ms-auto">更新中…</span>}
                </div>

                {error !== '' && <div className="alert alert-danger mb-0" style={{ fontSize: '13px' }}>{error}</div>}

                {summary === null || total === undefined ? (
                    loading && (
                        <div className="text-center py-5">
                            <div className="spinner-border" style={{ color: '#0f766e' }} role="status">
                                <span className="visually-hidden">読み込み中</span>
                            </div>
                        </div>
                    )
                ) : (
                    <>
                        <div className="ics_kpi">
                            <div className="ics_kpi_card">
                                <div className="ics_kpi_label">紹介の反響</div>
                                <div className="ics_kpi_value">{total.inquiry.toLocaleString()}</div>
                                <div className="ics_kpi_sub">
                                    紹介元が未入力 <b>{unset?.inquiry ?? 0}</b>（{percent(rate(unset?.inquiry ?? 0, total.inquiry))}）
                                </div>
                            </div>
                            <Step label="面談" count={total.meeting} base={total.inquiry} baseLabel="" />
                            <Step label="次アポ" count={total.next} base={total.meeting} baseLabel="面談から" />
                            <Step label="契約" count={total.contract} base={total.next} baseLabel="次アポから" main />
                            <div className="ics_kpi_card">
                                <div className="ics_kpi_label">反響から契約まで（中央値）</div>
                                <div className="ics_kpi_value">{total.lagMedian === null ? '—' : `${total.lagMedian}日`}</div>
                                <div className="ics_kpi_sub">面談した人の契約率 <b>{percent(rate(total.contract, total.meeting))}</b></div>
                            </div>
                        </div>

                        {/* ⚠️⚠️ **この注記を外さないこと。** 期間の終わりが最近だと契約が出そろっていない */}
                        <div className="ics_caution">
                            ※ 面談＝初回面談以降の日付がある人、次アポ＝事前審査・第二面談・契約の日付がある人、契約＝状況が「契約済み」の人です。
                            率はすべて<b>反響の人数</b>が分母です。
                            <br />
                            ※ 期間は<b>反響取得日</b>で絞ります。契約は反響から1〜2ヶ月後に出ることが多いため、
                            <b>直近の月を含めると契約率は低めに出ます。</b>
                            <br />
                            ※ 店舗は担当店舗で数え、<b>併売店の担当は親店舗に含めています。</b>反響10件未満の行は灰色（参考値）です。
                        </div>

                        <div className="ics_legend">
                            <span><i style={{ background: '#cbd5e1' }} />面談</span>
                            <span><i style={{ background: '#7fb8b1' }} />次アポ</span>
                            <span><i style={{ background: '#0f766e' }} />契約</span>
                            <span>（反響＝棒の全幅）</span>
                            <span className="ms-auto">見出しをクリックすると並び替わります</span>
                        </div>

                        <FunnelTable title="紹介元別" label="紹介元" rows={summary.bySource} />

                        <div className="ics_grid2">
                            <FunnelTable title="事業部別" label="事業部" rows={summary.byDivision} />
                            <FunnelTable title="エリア別" label="エリア" rows={summary.byArea} />
                        </div>

                        <FunnelTable title="ブランド別" label="ブランド" rows={summary.byBrand} />

                        <CrossTable title="ブランド × 紹介元（契約率・契約/反響）" label="ブランド" cross={summary.brandSource} sources={sourceColumns} />
                        <CrossTable title="エリア × 紹介元（契約率・契約/反響）" label="エリア" cross={summary.areaSource} sources={sourceColumns} />

                        <FunnelTable title="店舗別" label="店舗" rows={summary.byShop} />
                    </>
                )}
            </div>
        </div>
    );
};

export default IntroductorySummary;
```
