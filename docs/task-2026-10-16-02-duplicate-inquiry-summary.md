# 2026-10-16 重複反響サマリー（v2.2.193）

## 依頼（ReadMeClaude.md）
- Header.tsx の「反響管理」に **重複反響サマリー** を追加（fullscreen）
- KHG・KH・DJH・なごみ・2L・JH・PGH・かえる・中専のカードをグリッド表示。ブランド色で視認性を上げる
- 上部に期間指定（startMonth / endMonth）
- 各カード: パネル①（総反響・来場・次アポ・契約）→ 横棒（他ブランドごとの重複反響数、多い順、資料請求／来場／次アポ／契約の積み上げ）→ パネル②（他ブランドごとの歩留まり）
- 重複判定: master_data / master_data_kaeru / master_data_resale（show_dashboard=0 も含む）の電話・携帯・メール・extra_address_info を trim＋空白除去で比較
- KHG はグループ全体（提案）
- 追記: 中専は master_data_resale の in_charge_store＝「買い:中古リノベ」のみ
- 確認事項への回答（2026-10-16）: 1. 案A（相手ブランド側の到達段階で色分け） 2. 電話はハイフンも除く 3. extra_address_info は8文字未満を比べない 4. status＝重複はカードの数から除き、相手としては含める 5. カードの無いブランドは「その他」

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features | **duplicateSummary.ts**（新規） | 関数 `runDuplicateSummary`・`keysOf`・`stageOf`・`squash`・`toMonth`・`inRange`・`addStage`・`otherRows`、定数 `CARD_BRANDS`・`OTHER_BRAND`・`ORDER_BRAND`・`SHOP_BRAND`・`RESALE_STORE`・`STAGE` |
| backend-express/src/gateway | **registry.ts** | `duplicate_summary` を登録（auth: staff） |
| backend/src/core | **express_proxy.php** | `expressProxyRequests()`・`expressProxyExclusive()` に `duplicate_summary` |
| frontend/src/components/header | **DuplicateInquirySummary.tsx**（新規） | 画面。部品 `FunnelPanel`・`StackedBars`・`OthersTable`・`BrandMark`、関数 `brandColorOf` |
| frontend/src/components/header | **Header.tsx** | 反響管理の配列（Master・それ以外の両方）・editMapping・isFullscreenMenu・import |
| frontend/src/utils | version.ts | 2.2.193 |
| backend/scripts/sql | 2026-10-16_update_log_2.2.193.sql（新規） | ローカルは no=292 で投入済み |

## 仕様
- ブランド: master_data は brand（国分ハウジング→KH ほか）。空なら担当店舗の shop_list.brand。フルコミホーム等・不明は「その他」。master_data_kaeru＝かえる、master_data_resale（買い:中古リノベのみ）＝中専
- 重複キー: 電話・携帯（空白・ハイフン除去後に数字10桁以上）／メール（空白除去・小文字、@ を含む）／extra_address_info（空白除去後8文字以上）。種類ごとに接頭辞を付けて比べる（電話と携帯は同じ種類）
- 重複＝キーのどれかが **別ブランド** の顧客と一致（同じブランドどうしは数えない）
- 段階: 契約＝status 契約済み／次アポ＝事前審査・第二面談・契約の日付あり／来場＝初回面談の日付あり／それ以外＝資料請求
- カードの数字（パネル①）: status＝重複 を除き、反響取得日が期間内のもの
- 横棒・パネル②: カードの反響のうち、相手ブランドに同じ人がいるもの。段階は **相手ブランド側で最も進んだ段階**。相手側は期間・status に関係なく全件と比べる
- KHG: パネル①＝全ブランドの合計、横棒＝ブランドごとの「他ブランドと重複した反響」（相手が複数なら最も進んだ段階）、表＝ブランドごとの総反響・重複・重複率・他で契約。重複（延べ）＝ブランドごとの重複の合計

## 確認（ローカル）
- ② 型チェック通過・集計 約0.7〜0.9秒（全3台帳 約3.8万件）
- 全期間: KHG 総反響 37,612／来場 9,807／次アポ 4,532／契約 1,910。重複率 KH 32.9%・DJH 67.2%・PGH 80.7%・なごみ 76.5%・かえる 18.8%・中専 28.0%・2L 39.6%・JH 19.9%
- 期間 2026-04〜09 で KH の数字が変わる・開始月＞終了月で0件
- 多数の顧客が共有する値（同じ電話が699件など）を除いても重複率はほぼ変わらない（しきい値10〜50で検証）→ 判定は承認どおりのまま
- ① 経由（localhost:8080/、トークン無し）→ 401「認証が必要です。」（② まで届いている）。PHP 構文チェック通過
- フロント: 型チェックは既存の5件以外なし、ビルド main.52118cc0.js、Playwright でカード9枚・横棒・期間変更で再取得を確認
- ⚠️ 未確認: ログインした状態で開発環境の画面から開く確認

---

## backend-express/src/features/duplicateSummary.ts（全文）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 重複反響サマリー（ヘッダー → 反響管理 → 重複反響サマリー）。v2.2.193 新規。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面: frontend/src/components/header/DuplicateInquirySummary.tsx
 *
 * ⚠️⚠️ **「重複」は status＝重複 のことではない。** ⚠️ 連絡先が他ブランドの顧客と一致すること。
 *   ⚠️ 比べる列: 電話・携帯・メール・extra_address_info（2026-10-16 の指示）。
 *   ⚠️ trim ＋ 空白（全角含む）を除いて比べる。⚠️ 電話はハイフンも除く（指示で承認済み）。
 *   ⚠️⚠️ **短すぎる値は比べない**（⚠️ 「201」「-」「0」などで別人どうしが一致するため）。
 *     電話は数字10桁以上、メールは @ を含むもの、extra_address_info は8文字以上。
 *
 * ⚠️ 対象の表（show_dashboard = 0 も含む。指示）:
 *   master_data（KH / DJH / なごみ / 2L / JH / PGH / その他）
 *   master_data_kaeru（かえる）
 *   master_data_resale のうち ⚠️⚠️ **in_charge_store＝「買い:中古リノベ」だけ**（中専。指示）
 *
 * ⚠️ カードの数字（総反響・来場・次アポ・契約）は ⚠️⚠️ **status＝重複 を除く**（ほかの画面と同じ）。
 *   ⚠️ ただし **重複の相手としては含める**（指示で承認済み）。
 *
 * ⚠️⚠️ **横棒の色分けとパネル②は「相手ブランド側での到達段階」**（案A。2026-10-16 の指示）。
 *   例: KH のカードの「DJH」の棒 … KH の反響のうち DJH にも同じ人がいるもの。
 *       色はその人が **DJH で** どこまで進んだか（資料請求のみ／来場／次アポ／契約）。
 * ─────────────────────────────────────────────
 */

/** 商談フェーズの列。⚠️ staffContract.ts と同じ列ID（⚠️ DBのコメントは当てにならない） */
const COL_INQUIRY = 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99';     // 反響取得日
const COL_INTERVIEW = 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7';   // 初回面談（＝来場）
const COL_SCREENING = 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR';   // 事前審査
const COL_APPOINTMENT = 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'; // 第二面談
const COL_CONTRACT = 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG';    // 契約

/** カードのブランド（⚠️ 画面の並び順もこの順。KHG は画面側で先頭に足す） */
export const CARD_BRANDS = ['KH', 'DJH', 'なごみ', '2L', 'JH', 'PGH', 'かえる', '中専'] as const;
/** カードの無いブランド（フルコミホームなど）・ブランド不明 */
export const OTHER_BRAND = 'その他';

/** master_data.brand → カードの表記 */
const ORDER_BRAND: Record<string, string> = {
  国分ハウジング: 'KH',
  デイジャストハウス: 'DJH',
  なごみ工務店: 'なごみ',
  ニーエルホーム: '2L',
  ジャスフィーホーム: 'JH',
  'PG HOUSE': 'PGH',
};
/** shop_list.brand → カードの表記（⚠️ master_data.brand が空のときに担当店舗から補う） */
const SHOP_BRAND: Record<string, string> = {
  KH: 'KH', DJH: 'DJH', なごみ: 'なごみ', '2L': '2L', JH: 'JH', PGH: 'PGH',
};

/** 中専として使う担当店舗。⚠️ 売り:ポータル・買い:ポータルなどは使わない（重複の相手にもしない） */
const RESALE_STORE = '買い:中古リノベ';

/** 到達段階。⚠️ 数字が大きいほど先まで進んでいる */
const STAGE = { request: 0, visit: 1, next: 2, contract: 3 } as const;
type Stage = (typeof STAGE)[keyof typeof STAGE];

interface CustomerRow extends RowDataPacket {
  brand: string | null;
  store: string | null;
  status: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  extra: string | null;
  col_inquiry: string | null;
  col_interview: string | null;
  col_screening: string | null;
  col_appointment: string | null;
  col_contract: string | null;
}

interface ShopRow extends RowDataPacket {
  shop: string;
  brand: string | null;
}

export interface MonthRange {
  /** `YYYY-MM`。⚠️ 空なら絞らない */
  start: string;
  end: string;
}

/** 総反響・来場・次アポ・契約。⚠️ 来場は「来場以降」、次アポは「次アポ以降」（累積） */
export interface Funnel {
  inquiry: number;
  visit: number;
  next: number;
  contract: number;
}

/** 横棒1本＋パネル②の1行（相手ブランドごと） */
export interface OtherBrandRow extends Funnel {
  brand: string;
  /** 積み上げの内訳（⚠️ 最も進んだ段階で1人1つ。合計＝inquiry） */
  stack: { request: number; visit: number; next: number; contract: number };
}

export interface DuplicateSummaryResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const hasValue = (value: unknown): boolean => String(value ?? '').trim() !== '';

/** 日付から `YYYY-MM`。読めなければ空文字（⚠️ staffContract.ts と同じ） */
const toMonth = (value: unknown): string => {
  const matched = /^(\d{4})[-/](\d{1,2})(?:[-/]|$)/.exec(String(value ?? '').trim());
  if (matched === null) return '';
  return `${matched[1]}-${matched[2].padStart(2, '0')}`;
};

/** ⚠️ 期間が空なら日付が読めない顧客も通す */
const inRange = (month: string, range: MonthRange): boolean => {
  if (range.start === '' && range.end === '') return true;
  if (month === '') return false;
  if (range.start !== '' && month < range.start) return false;
  if (range.end !== '' && month > range.end) return false;
  return true;
};

/** trim ＋ 空白（全角・改行を含む）を除く */
const squash = (value: unknown): string => String(value ?? '').trim().replace(/\s/g, '');

/**
 * 重複判定のキー。⚠️ 種類ごとに接頭辞を付ける（⚠️ メールと住所が偶然同じ文字列でも混ざらない）。
 * ⚠️ 電話と携帯は同じ種類として比べる（⚠️ 片方の電話欄に携帯番号を入れている顧客がいる）。
 */
const keysOf = (row: CustomerRow): string[] => {
  const keys: string[] = [];
  for (const tel of [row.phone, row.mobile]) {
    const digits = squash(tel).replace(/[-‐－―ー−]/g, '');
    if (/^\d{10,}$/.test(digits)) keys.push(`tel:${digits}`);
  }
  const mail = squash(row.email).toLowerCase();
  if (mail.includes('@')) keys.push(`mail:${mail}`);
  const extra = squash(row.extra);
  if (extra.length >= 8) keys.push(`addr:${extra}`);
  return [...new Set(keys)];
};

const stageOf = (row: CustomerRow): Stage => {
  if (row.status === '契約済み') return STAGE.contract;
  if (hasValue(row.col_screening) || hasValue(row.col_appointment) || hasValue(row.col_contract)) return STAGE.next;
  if (hasValue(row.col_interview)) return STAGE.visit;
  return STAGE.request;
};

/** 1件分（集計用に整えたもの） */
interface Customer {
  brand: string;
  /** カードの数字に数えるか（⚠️ status＝重複 は数えない。相手としては使う） */
  counted: boolean;
  /** 期間に入っているか */
  inPeriod: boolean;
  stage: Stage;
  keys: string[];
}

const emptyFunnel = (): Funnel => ({ inquiry: 0, visit: 0, next: 0, contract: 0 });
const addStage = (funnel: Funnel, stage: Stage): void => {
  funnel.inquiry += 1;
  if (stage >= STAGE.visit) funnel.visit += 1;
  if (stage >= STAGE.next) funnel.next += 1;
  if (stage >= STAGE.contract) funnel.contract += 1;
};
const STACK_KEY = ['request', 'visit', 'next', 'contract'] as const;

/** 相手ブランドごとの行を作る器 */
const otherRows = () => {
  const map = new Map<string, OtherBrandRow>();
  return {
    add(brand: string, stage: Stage) {
      const row = map.get(brand) ?? { brand, ...emptyFunnel(), stack: { request: 0, visit: 0, next: 0, contract: 0 } };
      addStage(row, stage);
      row.stack[STACK_KEY[stage]] += 1;
      map.set(brand, row);
    },
    /** ⚠️ 多い順（⚠️ 同数ならカードの並び順） */
    list(): OtherBrandRow[] {
      const order = (b: string) => { const i = (CARD_BRANDS as readonly string[]).indexOf(b); return i < 0 ? 99 : i; };
      return [...map.values()].sort((a, b) => b.inquiry - a.inquiry || order(a.brand) - order(b.brand));
    },
  };
};

/**
 * 重複反響サマリーを返す。
 *
 * ⚠️ 期間は **カードのブランド側の反響取得日** で絞る。⚠️ 相手側は期間に関係なく全件と比べる
 *   （⚠️ 先に他ブランドへ問い合わせていた人も「重複」として拾うため）。
 */
export const runDuplicateSummary = async (range: MonthRange): Promise<DuplicateSummaryResult> => {
  const columns = `brand, in_charge_store AS store, status,
                   customer_contacts_phone_number AS phone,
                   customer_contacts_mobile_phone_number AS mobile,
                   customer_contacts_email AS email,
                   extra_address_info AS extra,
                   ${COL_INQUIRY} AS col_inquiry,
                   ${COL_INTERVIEW} AS col_interview,
                   ${COL_SCREENING} AS col_screening,
                   ${COL_APPOINTMENT} AS col_appointment,
                   ${COL_CONTRACT} AS col_contract`;

  const [shops, order, kaeru, resale] = await Promise.all([
    query<ShopRow>('SELECT shop, brand FROM shop_list'),
    query<CustomerRow>(`SELECT ${columns} FROM master_data`),
    query<CustomerRow>(`SELECT ${columns} FROM master_data_kaeru`),
    query<CustomerRow>(`SELECT ${columns} FROM master_data_resale WHERE in_charge_store = ?`, [RESALE_STORE]),
  ]);

  const shopBrand = new Map<string, string>();
  for (const s of shops) if (hasValue(s.brand)) shopBrand.set(s.shop, String(s.brand).trim());

  /** master_data のブランド。⚠️ 空なら担当店舗の shop_list.brand で補う。⚠️ 決まらなければ「その他」 */
  const orderBrandOf = (row: CustomerRow): string => {
    const named = ORDER_BRAND[String(row.brand ?? '').trim()];
    if (named !== undefined) return named;
    if (hasValue(row.brand)) return OTHER_BRAND; // フルコミホームなど
    return SHOP_BRAND[shopBrand.get(String(row.store ?? '').trim()) ?? ''] ?? OTHER_BRAND;
  };

  const toCustomer = (row: CustomerRow, brand: string): Customer => ({
    brand,
    counted: row.status !== '重複',
    inPeriod: inRange(toMonth(row.col_inquiry), range),
    stage: stageOf(row),
    keys: keysOf(row),
  });
  const customers: Customer[] = [
    ...order.map((r) => toCustomer(r, orderBrandOf(r))),
    ...kaeru.map((r) => toCustomer(r, 'かえる')),
    ...resale.map((r) => toCustomer(r, '中専')),
  ];

  /** キー → そのキーを持つ顧客 */
  const byKey = new Map<string, Customer[]>();
  for (const c of customers) {
    for (const key of c.keys) {
      const found = byKey.get(key);
      if (found === undefined) byKey.set(key, [c]);
      else found.push(c);
    }
  }

  /**
   * 相手ブランド → その人の相手ブランド側での最も進んだ段階。
   * ⚠️ 同じブランドの顧客は相手にしない（⚠️ 横軸は「カード以外のブランド」）。
   */
  const counterpartsOf = (c: Customer): Map<string, Stage> => {
    const result = new Map<string, Stage>();
    for (const key of c.keys) {
      for (const other of byKey.get(key) ?? []) {
        if (other === c || other.brand === c.brand) continue;
        const best = result.get(other.brand);
        if (best === undefined || other.stage > best) result.set(other.brand, other.stage);
      }
    }
    return result;
  };

  const brands = [...CARD_BRANDS, OTHER_BRAND];
  const cards: Record<string, { own: Funnel; duplicated: number; others: OtherBrandRow[] }> = {};
  const groupOwn = emptyFunnel();
  /** KHG カードの横棒・パネル②: ブランドごとの「他ブランドと重複した反響」 */
  const groupRows = new Map<string, { brand: string; total: number; dup: Funnel; stack: OtherBrandRow['stack'] }>();

  for (const brand of brands) {
    const own = emptyFunnel();
    const others = otherRows();
    let duplicated = 0;
    const groupRow = { brand, total: 0, dup: emptyFunnel(), stack: { request: 0, visit: 0, next: 0, contract: 0 } };

    for (const c of customers) {
      if (c.brand !== brand || !c.counted || !c.inPeriod) continue;
      addStage(own, c.stage);
      addStage(groupOwn, c.stage);
      groupRow.total += 1;

      const counterparts = counterpartsOf(c);
      if (counterparts.size === 0) continue;
      duplicated += 1;
      for (const [otherBrand, stage] of counterparts) others.add(otherBrand, stage);

      // ⚠️ KHG は相手が複数あれば最も進んだ段階で数える
      const best = Math.max(...counterparts.values()) as Stage;
      addStage(groupRow.dup, best);
      groupRow.stack[STACK_KEY[best]] += 1;
    }
    cards[brand] = { own, duplicated, others: others.list() };
    groupRows.set(brand, groupRow);
  }

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      range,
      brands: CARD_BRANDS,
      cards,
      group: {
        own: groupOwn,
        // ⚠️ 重複の多い順
        byBrand: [...groupRows.values()].filter((r) => r.total > 0).sort((a, b) => b.dup.inquiry - a.dup.inquiry),
      },
    },
  };
};
```

## backend-express/src/gateway/registry.ts（追加部分）
```ts
import { runDuplicateSummary } from '../features/duplicateSummary';
/**
 * 重複反響サマリー（v2.2.193）。
 *
 * ⚠️⚠️ **status＝重複 ではなく、連絡先が他ブランドの顧客と一致する反響を数える。**
 *   ⚠️ 中身は features/duplicateSummary.ts。⚠️ 期間は `YYYY-MM`（反響取得日）。空は「絞らない」。
 */
register({
  request: 'duplicate_summary',
  summary: 'ブランドごとの他ブランドとの重複反響と、相手ブランドでの来場・次アポ・契約',
  phpSource: '（新規。PHP版なし）',
  auth: 'staff',
  handler: async (ctx) => {
    const text = (key: string) => (typeof ctx.body[key] === 'string' ? (ctx.body[key] as string).trim() : '');
    const result = await runDuplicateSummary({ start: text('startMonth'), end: text('endMonth') });
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

```

## backend/src/core/express_proxy.php（追加部分）
```php

        // -----------------------------------------------------------------
        // 2026-10-16 新規（v2.2.193）。重複反響サマリー（header/DuplicateInquirySummary.tsx）。
        //
        // ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある**（features/duplicateSummary.ts）。
        //   ⚠️ ⚠️ **入れないと ① が404を返す。** ⚠️ expressProxyExclusive() にも入れてある。
        // -----------------------------------------------------------------
        'duplicate_summary',
        // ⚠️ 2026-10-16 新規（v2.2.193）。重複反響サマリー。⚠️ 理由は上と同じ
        'duplicate_summary',
```

## frontend/src/components/header/Header.tsx（変更部分）
```tsx
import DuplicateInquirySummary from './DuplicateInquirySummary';
        // ⚠️ v2.2.193: 「重複反響サマリー」を追加（⚠️ 全員。DuplicateInquirySummary.tsx）
        '反響管理': authority === 'Master'
            ? ['販促媒体設定', 'ブラックリスト設定', '広告費シミュレーター', '事後アンケート', '重複反響サマリー']
            : ['販促媒体設定', 'ブラックリスト設定', '事後アンケート', '重複反響サマリー'],
        '反響管理/重複反響サマリー': <DuplicateInquirySummary />,
        // ⚠️ 重複反響サマリー（v2.2.193）はカード9枚をグリッドで並べる（2026-10-16 の指示で全画面）。
        //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。** コンポーネント側に作らないこと。
        '反響管理/重複反響サマリー',
```

## frontend/src/components/header/DuplicateInquirySummary.tsx（全文）
```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import apiClient from '../../utils/apiClient';
import { setStyleClass } from '../../utils/setStyleClass';

/**
 * 重複反響サマリー（ヘッダー → 反響管理 → 重複反響サマリー）。v2.2.193 新規。
 *
 * ─────────────────────────────────────────────
 * ⚠️ データは ② の `duplicate_summary`（features/duplicateSummary.ts）。
 *   ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ ① の express_proxy.php の許可リストで ② へ転送している。
 *
 * ⚠️⚠️ **「重複」は status＝重複 ではない。** 電話・携帯・メール・extra_address_info が
 *   ⚠️ **他ブランドの顧客と一致する反響**のこと（判定は ② 側）。
 *
 * ⚠️ カード: KHG（グループ全体）＋ KH / DJH / なごみ / 2L / JH / PGH / かえる / 中専。
 *   ⚠️ 横棒とパネル②は ⚠️⚠️ **相手ブランド側での到達段階**（2026-10-16 の指示・案A）。
 *
 * ⚠️ 見た目は GoogleReview.tsx の作法（CLAUDE.md のデザインポリシー）。
 * ⚠️ モーダルは ⚠️⚠️ **全画面**（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンはここに作らない。
 * ─────────────────────────────────────────────
 */

type Funnel = { inquiry: number; visit: number; next: number; contract: number };
type Stack = { request: number; visit: number; next: number; contract: number };
type OtherBrandRow = Funnel & { brand: string; stack: Stack };
type Card = { own: Funnel; duplicated: number; others: OtherBrandRow[] };
type GroupRow = { brand: string; total: number; dup: Funnel; stack: Stack };
type Summary = {
    brands: string[];
    cards: Record<string, Card>;
    group: { own: Funnel; byBrand: GroupRow[] };
};

/**
 * 積み上げの段階。⚠️ 色は資料請求 → 契約で薄 → 濃（⚠️ 進んだほど目立つ）。
 * ⚠️ IntroductorySummary.tsx の歩留まりの棒と同じ色の系統。
 */
const STAGES: { key: keyof Stack; label: string; color: string }[] = [
    { key: 'request', label: '資料請求', color: '#cbd5e1' },
    { key: 'visit', label: '来場', color: '#8fc4bd' },
    { key: 'next', label: '次アポ', color: '#3f9c92' },
    { key: 'contract', label: '契約', color: '#0f5f58' },
];

/**
 * ブランドの色。⚠️⚠️ **utils/setStyleClass.ts（反響一覧のブランド色）から借りる**（FestaDashboard.tsx と同じ）。
 *   ⚠️ ここに色を書き写さない。⚠️ setStyleClass は店舗名の先頭2文字で引くので読み替える。
 * ⚠️ 中専は setStyleClass に無いのでオレンジ（FestaDashboard.tsx と同じ #ff7f0e）。
 * ⚠️ KHG はグループ（灰ではなく濃い色にして、他のカードと区別する）。
 */
const BRAND_SHOP_PREFIX: Record<string, string> = {
    KH: 'KH', DJH: 'DJ', なごみ: 'なご', '2L': '2L', JH: 'JH', PGH: 'PG', かえる: 'かえ',
};
const brandColorOf = (brand: string): string => {
    if (brand === 'KHG') return '#334155';
    if (brand === '中専') return '#ff7f0e';
    const color = setStyleClass(BRAND_SHOP_PREFIX[brand] ?? '').backgroundColor;
    return typeof color === 'string' && color !== '' ? color : '#8898aa';
};

/** 率。⚠️ 分母0は null（⚠️ 0% と出さない） */
const rate = (count: number, denominator: number): number | null =>
    denominator === 0 ? null : Math.round((count / denominator) * 1000) / 10;
const percent = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

/** 月の選択肢。⚠️ 当月から過去36ヶ月。⚠️ `new Date(y, m, 1)` で作る（文字列から作ると月がずれることがある） */
const MONTHS = (() => {
    const now = new Date();
    const list: string[] = [];
    for (let i = 0; i < 36; i += 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
})();

/** パネル①：総反響 → 来場 → 次アポ → 契約。⚠️ 下の小さい数字は総反響に対する率 */
const FunnelPanel = ({ funnel }: { funnel: Funnel }) => (
    <div className="ds_funnel">
        {[
            { label: '総反響', value: funnel.inquiry, sub: null },
            { label: '来場', value: funnel.visit, sub: rate(funnel.visit, funnel.inquiry) },
            { label: '次アポ', value: funnel.next, sub: rate(funnel.next, funnel.inquiry) },
            { label: '契約', value: funnel.contract, sub: rate(funnel.contract, funnel.inquiry) },
        ].map(item => (
            <div key={item.label} className="ds_funnel_cell">
                <div className="ds_funnel_label">{item.label}</div>
                <div className="ds_funnel_value">{item.value.toLocaleString()}</div>
                <div className="ds_funnel_sub">{item.sub === null ? ' ' : percent(item.sub)}</div>
            </div>
        ))}
    </div>
);

/** 横棒（積み上げ）。⚠️ 1本の長さ＝重複した反響数。⚠️ 多い順に上から */
const StackedBars = ({ rows }: { rows: { brand: string; stack: Stack }[] }) => {
    if (rows.length === 0) return <div className="ds_empty">他ブランドとの重複はありません</div>;
    const data = rows.map(r => ({ brand: r.brand, ...r.stack }));
    return (
        <div style={{ width: '100%', height: Math.max(120, rows.length * 26 + 30) }}>
            <ResponsiveContainer>
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barCategoryGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#9ca3af" width={52} />
                    <Tooltip contentStyle={{ fontSize: '12px' }} cursor={{ fill: '#f8fafc' }} />
                    {STAGES.map(stage => (
                        <Bar key={stage.key} dataKey={stage.key} name={stage.label} stackId="dup" fill={stage.color} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

/** パネル②：相手ブランドごとの総反響・来場・次アポ・契約（⚠️ 相手ブランド側での到達段階） */
const OthersTable = ({ rows }: { rows: OtherBrandRow[] }) => (
    <table className="ds_table">
        <thead>
            <tr>
                <th className="ds_th">他ブランド</th>
                <th className="ds_th text-end">総反響</th>
                <th className="ds_th text-end">来場</th>
                <th className="ds_th text-end">次アポ</th>
                <th className="ds_th text-end">契約</th>
            </tr>
        </thead>
        <tbody>
            {rows.map(r => (
                <tr key={r.brand} className="ds_row">
                    <td className="ds_td"><BrandMark brand={r.brand} /></td>
                    <td className="ds_td ds_num">{r.inquiry.toLocaleString()}</td>
                    {(['visit', 'next', 'contract'] as const).map(key => (
                        <td key={key} className="ds_td ds_num">
                            {r[key].toLocaleString()}
                            <small>{percent(rate(r[key], r.inquiry))}</small>
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
);

/** ブランド名の左に色の印 */
const BrandMark = ({ brand }: { brand: string }) => (
    <span className="ds_mark"><i style={{ background: brandColorOf(brand) }} />{brand}</span>
);

const DuplicateInquirySummary = () => {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /** ⚠️ 期間（反響取得日）。⚠️ 既定は空＝全期間 */
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'duplicate_summary', startMonth, endMonth });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '集計を取得できませんでした。');
                return;
            }
            setSummary(res.data as Summary);
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '集計を取得できませんでした。分析サーバーが停止している可能性があります。');
        } finally {
            setLoading(false);
        }
    }, [startMonth, endMonth]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    /** KHG カードの横棒（ブランドごとの重複反響）とパネル② */
    const groupBars = useMemo(
        () => (summary?.group.byBrand ?? []).filter(r => r.dup.inquiry > 0).map(r => ({ brand: r.brand, stack: r.stack })),
        [summary]
    );
    /**
     * KHG の重複件数。⚠️⚠️ **延べ件数**（ブランドごとの重複反響の合計）。
     *   ⚠️ 同じ人が KH と DJH の両方に反響していれば、KH 側で1・DJH 側で1の計2と数える。
     */
    const groupDupTotal = useMemo(
        () => (summary?.group.byBrand ?? []).reduce((sum, r) => sum + r.dup.inquiry, 0),
        [summary]
    );

    return (
        <div className="ds_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden**（Header.tsx）。
                 *   ⚠️ 余白はこちらで持ち、⚠️ **この外枠だけをスクロールさせる**（カードが縦に3段並ぶため）。
                 */
                .ds_wrap { font-size: 13px; color: #1f2937; height: 100%; overflow: auto;
                           padding: 16px 40px 28px; box-sizing: border-box; }
                .ds_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
                .ds_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .ds_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .ds_note { font-size: 11px; color: #6b7280; }
                .ds_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .ds_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .ds_reset { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer;
                            background: none; border: none; padding: 4px 0; white-space: nowrap; }
                .ds_reset:hover { text-decoration: underline; }
                .ds_reset:disabled { color: #cbd5e1; cursor: default; text-decoration: none; }
                .ds_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb;
                              border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; }
                .ds_caution b { color: #78350f; }
                .ds_legend { display: flex; gap: 14px; font-size: 11px; color: #6b7280; flex-wrap: wrap; }
                .ds_legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }

                /* ⚠️ カードの並び。⚠️ 広い画面は3列、狭くなると2列・1列に落ちる */
                .ds_grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 14px; }
                /* ⚠️ ブランド色は左の縁（4px）と見出しの印。⚠️ --ds-brand で受け取る */
                .ds_card { background: #fff; border: 1px solid #e5e7eb; border-left: 5px solid var(--ds-brand);
                           border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
                .ds_card.is_group { background: #fbfcfe; }
                .ds_card_head { display: flex; align-items: center; gap: 8px; }
                .ds_card_brand { font-weight: 800; font-size: 18px; letter-spacing: .02em; color: var(--ds-brand); }
                .ds_card_sub { font-size: 11px; color: #6b7280; }
                .ds_card_dup { margin-left: auto; font-size: 11px; color: #4b5563; background: #f3f4f6;
                               border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
                .ds_card_dup b { color: #1f2937; }
                .ds_section_label { font-size: 11px; font-weight: 700; color: #6b7280; }

                .ds_funnel { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
                .ds_funnel_cell { background: #f8fafc; border: 1px solid #eef2f7; border-radius: 8px; padding: 6px 8px; }
                .ds_funnel_label { font-size: 10px; color: #6b7280; }
                .ds_funnel_value { font-size: 17px; font-weight: 700; line-height: 1.25; font-variant-numeric: tabular-nums; }
                .ds_funnel_sub { font-size: 10px; color: #0f766e; font-weight: 700; font-variant-numeric: tabular-nums; }

                .ds_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .ds_th { background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 6px 8px;
                         font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                .ds_td { border-bottom: 1px solid #f1f5f9; padding: 5px 8px; vertical-align: middle; white-space: nowrap; }
                .ds_row:hover > .ds_td { background: #f8fafc; }
                .ds_row:last-child > .ds_td { border-bottom: none; }
                .ds_num { text-align: right; font-variant-numeric: tabular-nums; }
                .ds_num small { display: block; font-size: 10px; color: #6b7280; line-height: 1.2; }
                .ds_mark { font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
                .ds_mark i { display: inline-block; width: 4px; height: 14px; border-radius: 2px; }
                .ds_table_wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: auto; }
                .ds_empty { color: #9ca3af; font-size: 12px; text-align: center; padding: 14px; }
            `}</style>

            <div className="ds_inner">
                <div className="ds_head">
                    <span className="ds_title">
                        <i className="fa-solid fa-people-arrows me-2" style={{ color: '#0f766e' }} aria-hidden="true" />
                        重複反響サマリー
                    </span>
                    <span className="ds_note">連絡先（電話・携帯・メール・住所の補足）が他ブランドの顧客と一致する反響</span>
                </div>

                <div className="ds_bar">
                    <div>
                        <div className="ds_label">開始月（反響取得日）</div>
                        <Form.Select size="sm" value={startMonth} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => setStartMonth(e.target.value)}>
                            <option value="">指定なし</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Form.Select>
                    </div>
                    <div>
                        <div className="ds_label">終了月（反響取得日）</div>
                        <Form.Select size="sm" value={endMonth} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => setEndMonth(e.target.value)}>
                            <option value="">指定なし</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Form.Select>
                    </div>
                    <button type="button" className="ds_reset" disabled={startMonth === '' && endMonth === ''}
                        onClick={() => { setStartMonth(''); setEndMonth(''); }}>
                        期間を外す
                    </button>
                    {/* ⚠️ 開始が終了より後だと0件になる。⚠️ **黙って空にしない** */}
                    {startMonth !== '' && endMonth !== '' && startMonth > endMonth && (
                        <span className="ds_note text-danger">開始月が終了月より後になっています</span>
                    )}
                    {loading && summary !== null && <span className="ds_note ms-auto">更新中…</span>}
                </div>

                {error !== '' && <div className="alert alert-danger mb-0" style={{ fontSize: '13px' }}>{error}</div>}

                {/* ⚠️⚠️ **この注記を外さないこと。** 「重複」の意味が status の「重複」と取り違えられやすい */}
                <div className="ds_caution">
                    ※ <b>重複</b>＝電話・携帯・メール・住所の補足（extra_address_info）のどれかが、<b>他ブランドの顧客と一致</b>する反響です
                    （空白とハイフンは除いて比べます。短すぎる値は比べません）。状況「重複」の顧客はカードの数字から除いています。
                    <br />
                    ※ 横棒とパネル②の来場・次アポ・契約は、<b>相手のブランドで</b>どこまで進んだかです。
                    期間は<b>カードのブランドの反響取得日</b>で絞ります（相手のブランドは期間に関係なく比べます）。
                    <br />
                    ※ 来場＝初回面談以降の日付あり、次アポ＝事前審査・第二面談・契約の日付あり、契約＝状況が「契約済み」です。
                    中専は担当店舗が「買い:中古リノベ」の顧客だけです。
                </div>

                <div className="ds_legend">
                    {STAGES.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
                    <span>（横棒の長さ＝重複した反響数）</span>
                </div>

                {summary === null ? (
                    loading && (
                        <div className="text-center py-5">
                            <div className="spinner-border" style={{ color: '#0f766e' }} role="status">
                                <span className="visually-hidden">読み込み中</span>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="ds_grid">
                        {/* KHG: グループ全体 */}
                        <article className="ds_card is_group" style={{ ['--ds-brand' as string]: brandColorOf('KHG') } as React.CSSProperties}>
                            <div className="ds_card_head">
                                <span className="ds_card_brand">KHG</span>
                                <span className="ds_card_sub">グループ全体</span>
                                <span className="ds_card_dup" title="ブランドごとの重複反響の合計（同じ人が2ブランドにいれば2と数える）">
                                    重複（延べ） <b>{groupDupTotal.toLocaleString()}</b>
                                </span>
                            </div>
                            <FunnelPanel funnel={summary.group.own} />
                            <div className="ds_section_label">ブランドごとの「他ブランドと重複した反響」</div>
                            <StackedBars rows={groupBars} />
                            <div className="ds_section_label">ブランドごとの重複率</div>
                            <div className="ds_table_wrap">
                                <table className="ds_table">
                                    <thead>
                                        <tr>
                                            <th className="ds_th">ブランド</th>
                                            <th className="ds_th text-end">総反響</th>
                                            <th className="ds_th text-end">重複</th>
                                            <th className="ds_th text-end">重複率</th>
                                            <th className="ds_th text-end" title="重複した人が他ブランドで契約した数">他で契約</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.group.byBrand.map(r => (
                                            <tr key={r.brand} className="ds_row">
                                                <td className="ds_td"><BrandMark brand={r.brand} /></td>
                                                <td className="ds_td ds_num">{r.total.toLocaleString()}</td>
                                                <td className="ds_td ds_num">{r.dup.inquiry.toLocaleString()}</td>
                                                <td className="ds_td ds_num" style={{ fontWeight: 700 }}>{percent(rate(r.dup.inquiry, r.total))}</td>
                                                <td className="ds_td ds_num">{r.dup.contract.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </article>

                        {summary.brands.map(brand => {
                            const card = summary.cards[brand];
                            if (!card) return null;
                            return (
                                <article key={brand} className="ds_card" style={{ ['--ds-brand' as string]: brandColorOf(brand) } as React.CSSProperties}>
                                    <div className="ds_card_head">
                                        <span className="ds_card_brand">{brand}</span>
                                        <span className="ds_card_dup">
                                            重複 <b>{card.duplicated.toLocaleString()}</b>（{percent(rate(card.duplicated, card.own.inquiry))}）
                                        </span>
                                    </div>
                                    <FunnelPanel funnel={card.own} />
                                    <div className="ds_section_label">他ブランドとの重複反響（相手ブランドでの到達段階）</div>
                                    <StackedBars rows={card.others} />
                                    {card.others.length > 0 && (
                                        <div className="ds_table_wrap"><OthersTable rows={card.others} /></div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DuplicateInquirySummary;
```
