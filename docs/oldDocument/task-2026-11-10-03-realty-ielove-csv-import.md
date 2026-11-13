# 作業記録 2026-11-10-03　v2.2.260　いえらぶの物件一覧（CSV）を Dashboard で取り込む

## 依頼
- いえらぶ（ielove.jp）のログインで、2段階認証（メール）が義務になった。いえらぶの管理画面では IP 制限を設定できない。
- `Downloads/sale_20261110.csv` が該当のファイル。これをもとに、取り込みの機能を作る。

## 経緯
- 2026-11-10 の Heroku のログ（v2.2.259 の sync の判定を入れたもの）で、**ログインの送信の直後が 403** だった（`login/changePc/1`・画面タイトル 403 Forbidden）。ローカルでは成功する。
- 2段階認証の義務化と合わせて、sync（Heroku）の自動の取り込み（`runIeloveProperty.ts`）は続けられないと判断した。担当者が CSV を落として上げる形にした（利用者の了承）。

## CSV（sale_20261110.csv）
- 形：Shift_JIS・CRLF・132列・30行（本店の新築一戸建て。1店舗分）。
- 見出しは sync の `propertyHeaderMap` と同じ。28列＋「オリジナル項目1〜99」＋末尾の5列。
- 数字は `="…"` の形。物件番号は6桁で、重なりはない。
- ⚠️ 売主・所有者など個人の情報を含むので、中身は画面・ログ・記録に出していない（見出しと件数だけを確かめた）。

## 作り
```
設定・データ管理「いえらぶの物件一覧を取り込む（CSV）」（RealtyIeloveImport.tsx）
  ファイルを選ぶ（複数可）→ ブラウザで Shift_JIS を読む（TextDecoder）→ = を外す → CSV を読む（parseCsv）
  → 見出しを英語の列名に（sync と同じ対応。オリジナル項目は外す）→ 同じ物件番号は後のファイル
  → ② planner:ielove_import に 200 行ずつ（1行ずつ JSON の文字列。① で {} が [] になるため）
       dryRun …… 書かずに 新規・更新・価格の変更・店舗ごとの件数
       取り込む … 書く。最後の束（finish）のあと、v2.2.258 の突き合わせ（runIeloveMatch）
```
- 書き方は、① の `property_db_update.php` とほぼ同じにした（⚠️ 下の「CSV に無い列」のほかは、どちらかだけを変えない）。
  - 34列だけを書く。**CSV に無い列は上書きしない**（利用者の決定。下の「追加の決定」）。CSV にあって空の値は NULL で書く。
  - 空文字は NULL にし、前後の空白は落とす。
  - 物件番号で `INSERT … ON DUPLICATE KEY UPDATE`。
  - `price_raw` は価格の履歴（`[{date, value}]`）で、前回と違う価格のときだけ1件足す。CSV に「価格(単位なし)」が無いときは、履歴を変えない。
  - `registered` は今日（YYYY/MM/DD）。
- 足したこと
  - 物件番号が6桁の数字でない行は取り込まない（件数を見せる）。
  - 1束ずつトランザクション（`FOR UPDATE`）で書く。
  - 値は1つ5000字まで、1回500行まで。
- 権限：担当事業が realty・used・all の人（`REALTY_SHOPS`）。Master だけにはしていない（担当者がいえらぶに登録するたびに上げるため）。
- いえらぶに無くなった物件は消さない（sync と同じ）。

## 変えたもの
| 区分 | ファイル | 内容 |
|---|---|---|
| ② | `backend-express/src/features/realty/ieloveImport.ts`（**新規**） | `runIeloveImport`（dryRun・finish）、`runIeloveImportStatus`（件数・中古住宅専門店の件数・最後に取り込んだ日） |
| ② | `backend-express/src/gateway/registry.ts` | `planner:ielove_import`・`planner:ielove_import_status`（REALTY_SHOPS） |
| ① | `backend/src/core/express_proxy.php` | 上の2つを両方のリストに |
| 画面 | `frontend/src/components/realty/settings/RealtyIeloveImport.tsx`（**新規**） | 取り込みのカード（手順・件数の案内・下見・取り込み・結果） |
| 画面 | `frontend/src/components/realty/settings/RealtySettings.tsx` | カードを足した（休業日・架電キューの下、以前のアプリの取り込みの上） |
| 画面 | `frontend/src/components/realty/settings/RealtyLogImport.tsx` | `parseCsv` を export（中身は変えていない） |
| 画面 | `frontend/src/utils/version.ts` | 2.2.260 |
| ① DB | `backend/scripts/sql/2026-11-10_update_log_2.2.260.sql`（**新規**） | 更新履歴＋業務ガイド1本。⚠️ 表の変更なし |
| 記事 | `common/screen-270.md` | 下の「業務ガイド」 |

## 業務ガイド
記事「設定（不動産企画係）」（common/screen-270）に、節「いえらぶの物件一覧を取り込む（CSV）」を足した。
- 内容：2段階認証で自動の取り込みが止まったこと、手順4つ、上書き・価格の履歴・消さない・突き合わせが動くこと。
- 注意：Excel で保存し直さない。
- 要確認：だれがいつ取り込むかは係で決める。
- summary にも足した。

## テスト
- 型チェック：② とフロントの `npx tsc --noEmit` が通過。
- API（① 経由。`scratchpad/api_260.cjs`）：**14項目 OK**（下の追加の決定のあとに流し直した）
  - 権限
    - トークン無しは、取り込み・件数とも 401。
    - 担当事業が注文の人は 403。
    - 行が無いと 400。
  - 下見
    - 新規2・不正2（5桁、JSON でない）。同じ番号は後の行を使う。
    - 下見では書かない。
  - 取り込み
    - 新規2。突き合わせの結果（matched）が返る。
    - registered は今日。price_raw は履歴1件。
  - 2回目の取り込み
    - 新規1・更新2・価格の変更1。
    - 価格が変わった物件は履歴2件、変わらない物件は1件。
    - CSV に無い列は上書きしない（値が残る）。
    - 価格の列が無いファイル：物件名は更新、価格と履歴はそのまま、CSV にある空の列は NULL。
  - 件数と最後に取り込んだ日が返る。
- 画面（Playwright・3100。`scratchpad/pw_260.cjs`。**実物の CSV**）：**10項目 OK**
  - 件数の案内が出る。いえらぶの CSV でないファイルは断る。
  - 下見：30件・新規0・更新30（ローカルの DB と一致）。
  - 取り込み：結果と突き合わせの件数が出る。DB に30件・registered は今日・物件番号は6桁。
  - 画面のエラーなし。自動のつながりの記録は増えていない（本店の新築のため）。
  - ⚠️ 影響する property_db の30件は、テストの前に控え、テストのあとに元へ戻した（30件）。
- 後片付け：テストの行（9999xx）・仮スタッフ 999999・999998 を削除。開発サーバー 3100 を停止。

## 追加の決定（2026-11-10。利用者「1で」）
- 比べた結果（`scratchpad/cmp_260.cjs`）：CSV の30件は、すべて property_db にあった。
  - 33列のうち31列は全件一致した。
  - `price_raw` は比べ方の誤りで、最新の値は一致していた。
  - `expiry_date`（掲載期限）だけが違い、CSV のほうが新しかった（ローカルの最後の取り込みは 2026/11/02）。
- CSV の132列のうち、取り込むのは33列。画面で使っている列は、さらにその一部（物件番号・物件名・担当店舗名・所在地・価格・物件種別・間取り・面積など）。
- いえらぶで出力の項目を絞ったときに、ほかの列の値が消えないよう、**CSV にある列だけを上書きする**ように変えた（案 1）。
  - 案 2（必ず要る列を増やす）・案 3（売主・所有者を取り込まない）は入れていない。
- 実装：`toRow` が書く列（`cols`）を返し、書く列が同じ行ごとにまとめて INSERT する。画面は、CSV にある見出しの列だけを行に入れて送る（以前から）。
- 画面の案内文と、業務ガイドの記事（screen-270）にも書いた。

## 残したこと・注意
- sync の `runIeloveProperty.ts`（property タスク）は、毎回 403 で失敗し、「同期の実行結果」に失敗として残る。sync を呼ぶ側（定期の実行）の targetTasks から `property` を外すことを勧めた。
- ① の `property_db_update.php` は、ログイン無しで property_db を書ける口のまま（以前から）。sync が使わなくなったら、閉じることを検討する（別の版）。

## 新規ファイルの全文と git diff

### backend-express/src/features/realty/ieloveImport.ts
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../../db/pool';
import { logger } from '../../utils/logger';
import { runIeloveMatch } from './ieloveMatch';
import type { Result } from './index';

/**
 * いえらぶの物件一覧（CSV）を property_db に取り込む（v2.2.260。不動産企画係の「設定・データ管理」）。
 *
 * ─────────────────────────────────────────────
 *   ⚠️ 以前は sync（Heroku）の runIeloveProperty.ts が毎日 CSV を取り、① の property_db_update.php へ送っていた。
 *     2026-11 に、いえらぶの2段階認証（メール）が義務になり、Heroku からのログインも 403 で拒否されるようになったので、
 *     担当者が いえらぶの画面から CSV を落として、Dashboard に上げる形にした。
 *   ⚠️ 書き方は property_db_update.php とほぼ同じ（⚠️ 下の1点のほかは、どちらかだけを変えないこと）
 *     ・34列だけ。⚠️ ただし、**CSV に無い列は上書きしない**（v2.2.260 の利用者の決定。PHP は NULL で上書きする）
 *     ・空文字は NULL、前後の空白は落とす（normalizeRow）
 *     ・物件番号（property_id。一意の鍵）で INSERT … ON DUPLICATE KEY UPDATE
 *     ・price_raw は価格の履歴（[{date, value}] の JSON）。前回と違う価格のときだけ1件足す
 *     ・registered は取り込んだ日（YYYY/MM/DD）
 *   画面（RealtyIeloveImport.tsx）が CSV を読み、見出しを英語の列名に置き換えて、行を JSON の文字列で送る
 *   （⚠️ ① を通ると {} が [] になるため）。dryRun なら書かずに件数だけ返す。
 *   最後の束（finish）のあとに、媒介獲得台帳・買い反響との突き合わせ（ieloveMatch.ts）を動かす。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const ALLOWED_COLUMNS = [
  'property_id', 'management_code', 'store_name', 'property_staff',
  'transaction_type', 'property_type', 'address', 'property_name',
  'room_number', 'land_area', 'building_area', 'layout',
  'building_age', 'price', 'gross_yield', 'transportation',
  'agency', 'staff_in_charge', 'tel', 'report_date',
  'next_report_date', 'expected_yield', 'total_units', 'structure',
  'zoning', 'zoning_2', 'seller', 'owner', 'price_raw',
  'investment_type', 'expiry_date', 'publishing_instruction',
  'internal_note', 'registered',
] as const;
type Column = (typeof ALLOWED_COLUMNS)[number];
type PropertyRow = Record<Column, string | null>;
/** 1行と、その行で書く列（⚠️ v2.2.260: CSV にある列だけ。property_id・registered は必ず） */
type Incoming = { row: PropertyRow; cols: Column[] };

/** 1回に受ける行の上限（画面は 200 ずつ送る） */
const MAX_ROWS = 500;
/** 1つの値の長さの上限（TEXT の列でも、おかしな CSV で表を膨らませない） */
const MAX_VALUE = 5000;

const fail = (httpStatus: number, message: string): Result => ({ httpStatus, body: { status: 'error', message } });
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 今日（日本時間）の YYYY/MM/DD（sync と同じ形） */
const todaySlash = (): string => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '/');

/**
 * 1行を確かめて、34列の形と、書く列にする。⚠️ 物件番号が6桁の数字でない行は null（取り込まない）
 * ⚠️ 書く列は、送られてきた行にある列だけ（CSV にある列。空の値は NULL で書く）。
 *   いえらぶの CSV の出力項目を絞っても、絞った列の値が DB から消えないように（利用者の決定。PHP の property_db_update.php とはここが違う）
 */
const toRow = (raw: unknown, registered: string): Incoming | null => {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  const row = {} as PropertyRow;
  const cols: Column[] = [];
  for (const c of ALLOWED_COLUMNS) {
    const v = str(o[c]).trim().slice(0, MAX_VALUE);
    row[c] = v === '' ? null : v;
    if (c === 'property_id' || c === 'registered' || Object.prototype.hasOwnProperty.call(o, c)) cols.push(c);
  }
  if (!/^\d{6}$/.test(row.property_id ?? '')) return null;
  row.registered = registered;
  return { row, cols };
};

type PriceEntry = { date: string; value: string | null };

/** price_raw（DB）を履歴の配列に。⚠️ 以前のデータが文字列だけのときは 2000/01/01 の1件とみなす（PHP と同じ） */
const historyOf = (dbValue: unknown): PriceEntry[] => {
  const s = str(dbValue);
  try {
    const v: unknown = JSON.parse(s);
    if (Array.isArray(v)) return v as PriceEntry[];
  } catch { /* 下へ */ }
  return s === '' ? [] : [{ date: '2000/01/01', value: s }];
};

/** 価格の履歴を作る。⚠️ 前回と同じ価格なら足さない */
const withHistory = (row: PropertyRow, dbValue: unknown, exists: boolean): { json: string; changed: boolean } => {
  const incoming = row.price_raw;
  const date = row.registered ?? todaySlash();
  if (!exists) return { json: JSON.stringify([{ date, value: incoming }]), changed: false };
  const hist = historyOf(dbValue);
  const last = hist.length ? hist[hist.length - 1] : null;
  const changed = str(last?.value) !== str(incoming);
  if (changed) hist.push({ date, value: incoming });
  return { json: JSON.stringify(hist), changed };
};

/**
 * planner:ielove_import。body = { rows: string[]（1行ずつ JSON）, dryRun?: boolean, finish?: boolean }
 * 応答: { status, total, invalid, inserted, updated, priceChanged, stores: { 店舗名: 件数 }, matched? }
 *   ⚠️ 同じ物件番号が1回の中に2行あれば、後の行を使う
 */
export const runIeloveImport = async (body: Record<string, unknown>): Promise<Result> => {
  const list = Array.isArray(body.rows) ? body.rows : [];
  if (list.length === 0) return fail(400, '取り込む行がありません');
  if (list.length > MAX_ROWS) return fail(400, `一度に送れるのは ${MAX_ROWS} 行までです`);
  const dryRun = body.dryRun === true || body.dryRun === 'true' || body.dryRun === 1;
  const finish = body.finish === true || body.finish === 'true' || body.finish === 1;

  const registered = todaySlash();
  const byId = new Map<string, Incoming>();
  let invalid = 0;
  for (const raw of list) {
    const inc = toRow(raw, registered);
    if (inc === null) { invalid += 1; continue; }
    byId.set(inc.row.property_id as string, inc);
  }
  const incoming = [...byId.values()];
  const rows = incoming.map((i) => i.row);
  const stores: Record<string, number> = {};
  for (const r of rows) stores[r.store_name ?? '（店舗なし）'] = (stores[r.store_name ?? '（店舗なし）'] ?? 0) + 1;
  if (rows.length === 0) return { httpStatus: 200, body: { status: 'success', total: list.length, invalid, inserted: 0, updated: 0, priceChanged: 0, stores } };

  const ids = rows.map((r) => r.property_id as string);
  const counts = await withTransaction(async (tx) => {
    // ⚠️ 価格の履歴を読んで足すので、同時に取り込まれても履歴が欠けないよう行を押さえる
    const existing = await tx.query<DynamicRow>(
      `SELECT property_id, price_raw FROM property_db WHERE property_id IN (${ids.map(() => '?').join(', ')})${dryRun ? '' : ' FOR UPDATE'}`,
      ids
    );
    const prev = new Map(existing.map((e) => [str(e.property_id), e.price_raw]));
    let priceChanged = 0;
    for (const { row: r, cols } of incoming) {
      // ⚠️ 価格の履歴は、CSV に「価格(単位なし)」の列があるときだけ（無いときは履歴を変えない）
      if (!cols.includes('price_raw')) continue;
      const h = withHistory(r, prev.get(r.property_id as string), prev.has(r.property_id as string));
      if (h.changed) priceChanged += 1;
      r.price_raw = h.json;
    }
    if (!dryRun) {
      // ⚠️ 書く列が同じ行ごとにまとめて書く（ふつうは1つのファイル＝1つの組）
      const groups = new Map<string, Incoming[]>();
      for (const inc of incoming) {
        const key = inc.cols.join(',');
        groups.set(key, [...(groups.get(key) ?? []), inc]);
      }
      for (const group of groups.values()) {
        const cols = group[0].cols;
        const updates = cols.filter((c) => c !== 'property_id').map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
        await tx.execute(
          `INSERT INTO property_db (${cols.map((c) => `\`${c}\``).join(', ')})
           VALUES ${group.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ')}
           ON DUPLICATE KEY UPDATE ${updates}`,
          group.flatMap((g) => cols.map((c) => g.row[c]))
        );
      }
    }
    return { inserted: rows.length - prev.size, updated: prev.size, priceChanged };
  });

  let matched: { ledgers: number; buyLeads: number } | null = null;
  if (!dryRun && finish) {
    matched = await runIeloveMatch().catch((error: unknown) => {
      logger.error('realty: いえらぶの CSV の取り込みのあとの突き合わせに失敗しました', error);
      return null;
    });
  }
  if (!dryRun) logger.info(`realty: いえらぶの CSV を取り込みました（新規 ${counts.inserted} 件・更新 ${counts.updated} 件・価格の変更 ${counts.priceChanged} 件）`);
  return { httpStatus: 200, body: { status: 'success', total: list.length, invalid, ...counts, stores, matched } };
};

/** 取り込んだ物件の数（中古住宅専門店とすべて）と、最後に取り込んだ日（画面の案内用） */
export const runIeloveImportStatus = async (): Promise<Result> => {
  const [row] = await query<DynamicRow>(
    `SELECT COUNT(*) AS total,
            SUM(REPLACE(REPLACE(store_name, ' ', ''), '　', '') = '国分ハウジンググループ中古住宅専門店') AS used_store,
            MAX(registered) AS last_registered
       FROM property_db`
  );
  return { httpStatus: 200, body: { status: 'success', total: Number(row?.total ?? 0), usedStore: Number(row?.used_store ?? 0), lastRegistered: str(row?.last_registered) || null } };
};
```

### frontend/src/components/realty/settings/RealtyIeloveImport.tsx
```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { post } from '../common/realtyState';
import { parseCsv } from './RealtyLogImport';

/**
 * いえらぶの物件一覧（CSV）を取り込む（不動産企画係の「設定・データ管理」。v2.2.260）。
 *
 * ─────────────────────────────────────────────
 *   ⚠️ 以前は sync（Heroku）の runIeloveProperty.ts が毎日自動で取っていた。
 *     2026-11 に、いえらぶの2段階認証（メール）が義務になり、Heroku からのログインも 403 で拒否されるようになったので、
 *     担当者が いえらぶの「売買物件一覧」から「一覧をダウンロード → CSV」で落としたファイル（sale_YYYYMMDD.csv）を上げる形にした。
 *   ⚠️ ファイルは Shift_JIS。⚠️ 数字の列は ="0123" の形（Excel のゼロ落ち防止）なので = を外して読む（sync と同じ）。
 *   ⚠️ 見出し → 列名の対応は、sync の runIeloveProperty.ts の propertyHeaderMap と同じ（⚠️ 片方だけ変えない）。
 *     「オリジナル項目1〜99」は取り込まない。
 *   ⚠️ 複数のファイル（店舗ごとに落としたもの）をまとめて選べる。同じ物件番号は後のファイルを使う。
 *   ⚠️ 行には CSV にある見出しの列だけを入れて送る。② は送られた列だけを上書きする（出力の項目を絞った CSV でも、ほかの列が消えない）。
 *   ② の planner:ielove_import（features/realty/ieloveImport.ts）。先に dryRun で件数を見せ、「取り込む」で書く。
 *   取り込み終えると、② が媒介獲得台帳・買い反響との突き合わせ（v2.2.258）を動かす。
 * ─────────────────────────────────────────────
 */

const HEADER_MAP: Record<string, string> = {
    '物件番号': 'property_id',
    '管理コード': 'management_code',
    '担当店舗名': 'store_name',
    '物件担当者': 'property_staff',
    '取引態様': 'transaction_type',
    '物件種別': 'property_type',
    '所在地': 'address',
    '物件名': 'property_name',
    '空き物件内容（部屋番号）': 'room_number',
    '土地面積': 'land_area',
    '建物面積': 'building_area',
    '間取り': 'layout',
    '築年数': 'building_age',
    '価格': 'price',
    '表面利回り': 'gross_yield',
    '交通1': 'transportation',
    '取扱業者': 'agency',
    '担当者': 'staff_in_charge',
    '電話番号': 'tel',
    '活動報告日': 'report_date',
    '活動報告予定日': 'next_report_date',
    '想定利回り': 'expected_yield',
    '総戸数・総区画数': 'total_units',
    '建物構造': 'structure',
    '用途地域': 'zoning',
    '用途地域2': 'zoning_2',
    '売主': 'seller',
    '所有者': 'owner',
    '価格(単位なし)': 'price_raw',
    '実需・投資': 'investment_type',
    '掲載期限': 'expiry_date',
    '物件掲載指示': 'publishing_instruction',
    '社内用メモ１': 'internal_note',
};
/** 無ければ、いえらぶの物件一覧の CSV ではないとみなす見出し */
const NEED = ['物件番号', '担当店舗名', '所在地', '物件種別'];
const BATCH = 200;

type Mapped = Record<string, string>;
type Summary = { total: number; invalid: number; inserted: number; updated: number; priceChanged: number; stores: Record<string, number> };
type Loaded = { names: string[]; rows: Mapped[]; preview: Summary };

/** Shift_JIS（いえらぶ）で読む。⚠️ UTF-8 で保存し直したファイルも読めるように、UTF-8 として正しければ UTF-8 */
const decode = (buf: ArrayBuffer): string => {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('shift_jis').decode(buf); }
};

/** 1ファイルを読み、列名を英語にした行にする。⚠️ いえらぶの CSV でなければ例外 */
const readFile = async (file: File): Promise<Mapped[]> => {
    const text = decode(await file.arrayBuffer()).replace(/="/g, '"');
    const rows = parseCsv(text);
    if (!rows.length) throw new Error(`${file.name}：行がありません`);
    const missing = NEED.filter(h => !(h in rows[0]));
    if (missing.length) throw new Error(`${file.name}：いえらぶの物件一覧の CSV ではないようです（${missing.join('・')} の列がありません）`);
    return rows.map(r => {
        const m: Mapped = {};
        for (const [ja, en] of Object.entries(HEADER_MAP)) if (ja in r) m[en] = r[ja];
        return m;
    });
};

const add = (a: Summary, d: Record<string, unknown>): Summary => {
    const stores = { ...a.stores };
    for (const [k, v] of Object.entries((d.stores as Record<string, number>) ?? {})) stores[k] = (stores[k] ?? 0) + Number(v);
    return {
        total: a.total + (Number(d.total) || 0),
        invalid: a.invalid + (Number(d.invalid) || 0),
        inserted: a.inserted + (Number(d.inserted) || 0),
        updated: a.updated + (Number(d.updated) || 0),
        priceChanged: a.priceChanged + (Number(d.priceChanged) || 0),
        stores,
    };
};
const EMPTY: Summary = { total: 0, invalid: 0, inserted: 0, updated: 0, priceChanged: 0, stores: {} };

/** 200行ずつ ② へ送る。⚠️ ① を通ると {} が [] になるため、1行ずつ JSON の文字列で送る */
const send = async (rows: Mapped[], dryRun: boolean, onProgress?: (done: number) => void) => {
    let sum = EMPTY;
    let matched: { ledgers: number; buyLeads: number } | null = null;
    for (let i = 0; i < rows.length; i += BATCH) {
        const last = i + BATCH >= rows.length;
        const d = await post('ielove_import', { rows: rows.slice(i, i + BATCH).map(r => JSON.stringify(r)), dryRun, finish: last });
        sum = add(sum, d);
        if (d.matched) matched = d.matched as { ledgers: number; buyLeads: number };
        onProgress?.(Math.min(i + BATCH, rows.length));
    }
    return { sum, matched };
};

const storeList = (s: Summary) => Object.entries(s.stores).map(([k, v]) => `${k.replace(/\s+/g, ' ')} ${v}件`).join('／');

const RealtyIeloveImport: React.FC = () => {
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<{ sum: Summary; matched: { ledgers: number; buyLeads: number } | null } | null>(null);
    const [status, setStatus] = useState<{ total: number; usedStore: number; lastRegistered: string | null } | null>(null);

    const loadStatus = useCallback(() => {
        post('ielove_import_status')
            .then(d => setStatus({ total: Number(d.total) || 0, usedStore: Number(d.usedStore) || 0, lastRegistered: (d.lastRegistered as string) || null }))
            .catch(e => console.error('[RealtyIeloveImport] 件数を読めませんでした', e));
    }, []);
    useEffect(() => { loadStatus(); }, [loadStatus]);

    const onFiles = async (files: File[]) => {
        setLoaded(null);
        setResult(null);
        if (!files.length) return;
        setBusy(true);
        setProgress('読み込み中…');
        try {
            // ⚠️ 同じ物件番号は後のファイルを使う（② でも同じ）
            const byId = new Map<string, Mapped>();
            for (const f of files) for (const r of await readFile(f)) byId.set(r.property_id ?? `?${byId.size}`, r);
            const rows = [...byId.values()];
            const { sum } = await send(rows, true);
            setLoaded({ names: files.map(f => f.name), rows, preview: sum });
        } catch (e) {
            alert((e as Error).message);
        } finally {
            setBusy(false);
            setProgress('');
        }
    };

    const run = async () => {
        if (!loaded) return;
        const p = loaded.preview;
        if (!window.confirm(`いえらぶの物件を取り込みます。\n新しい物件 ${p.inserted}件・更新 ${p.updated}件（うち価格の変更 ${p.priceChanged}件）\nよろしいですか？`)) return;
        setBusy(true);
        try {
            const r = await send(loaded.rows, false, done => setProgress(`${done.toLocaleString()} / ${loaded.rows.length.toLocaleString()} 件`));
            setResult(r);
            setLoaded(null);
            loadStatus();
        } catch (e) {
            alert(`途中で止まりました。もう一度同じファイルを取り込むと、続きから入ります（同じ物件は上書きです）: ${(e as Error).message}`);
        } finally {
            setBusy(false);
            setProgress('');
        }
    };

    return (
        <div className="rlt-card">
            <div className="rlt-card-head">
                <h3>いえらぶの物件一覧を取り込む（CSV）</h3>
                <span className="rlt-note">
                    いえらぶの2段階認証の義務化で、自動の取り込みができなくなったため、ここから取り込みます
                    {status && `（いま ${status.total.toLocaleString()} 件・うち中古住宅専門店 ${status.usedStore.toLocaleString()} 件／最後に取り込んだ日 ${status.lastRegistered ?? 'なし'}）`}
                </span>
            </div>
            <div className="rlt-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ol className="rlt-sub" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                    <li>いえらぶ cloud の「売買物件一覧」を、店舗ごとに開く</li>
                    <li>「一覧をダウンロード」→「CSV 形式でダウンロード」で、ファイル（sale_日付.csv）を保存する</li>
                    <li>下でファイルを選ぶ（店舗ごとの複数のファイルを、まとめて選べます）→ 件数を確かめて「取り込む」</li>
                </ol>
                {/* ⚠️ 選んだら空に戻す（同じファイルを選び直しても読み直すように） */}
                <input type="file" accept=".csv,text/csv" multiple disabled={busy} aria-label="いえらぶの物件一覧の CSV"
                    onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void onFiles(fs); }} />
                {progress && <span className="rlt-note">{progress}</span>}
                {loaded && (
                    <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                        <div>{loaded.names.join('・')}：<b>{loaded.rows.length.toLocaleString()} 件</b>（{storeList(loaded.preview)}）</div>
                        <div>
                            新しい物件 <b>{loaded.preview.inserted}</b> 件・更新 <b>{loaded.preview.updated}</b> 件（うち価格の変更 {loaded.preview.priceChanged} 件）
                            {loaded.preview.invalid > 0 && <span style={{ color: '#dc3545' }}>・物件番号が読めない行 {loaded.preview.invalid} 件（取り込みません）</span>}
                        </div>
                        <button className="rlt-btn" disabled={busy || loaded.preview.inserted + loaded.preview.updated === 0} onClick={() => void run()}>取り込む</button>
                    </div>
                )}
                {result && (
                    <div className="rlt-saved">
                        取り込みました：新しい物件 {result.sum.inserted} 件・更新 {result.sum.updated} 件（うち価格の変更 {result.sum.priceChanged} 件）。
                        {result.matched
                            ? `媒介獲得台帳 ${result.matched.ledgers} 件・買い反響 ${result.matched.buyLeads} 件が、新しくいえらぶの物件につながりました。`
                            : '台帳との突き合わせは、30分以内に自動で動きます。'}
                    </div>
                )}
                <p className="rlt-sub">
                    同じ物件番号の物件は、CSV にある項目だけを上書きします（CSV に無い項目は、今の値のまま）。価格が変わったときは、価格の履歴に残ります。いえらぶに無くなった物件は消しません。
                </p>
            </div>
        </div>
    );
};

export default RealtyIeloveImport;
```

### git diff（既存ファイル。main からの差）
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 1ab0a4b7d..a651eccdd 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -186,6 +186,7 @@ import { runImportCheck, runImportFinish, runImportRecords } from '../features/r
 import { runCallLogs, runCallLogsImport, runCallMark, runCallUndo, runNaviSave, runPracticeLogsImport } from '../features/realty/calls';
 import { runLedgerLink } from '../features/realty/ledgerLink';
 import { runIeloveCandidates, runIeloveMatchNow } from '../features/realty/ieloveMatch';
+import { runIeloveImport, runIeloveImportStatus } from '../features/realty/ieloveImport';
 import { runUsedQueueList, runUsedQueueMark } from '../features/callq/usedQueue';
 import { INQUIRY_CATEGORIES, MASTER_CATEGORIES, runPrivacyEraseInquiry, runPrivacyEraseMaster } from '../features/privacy';
 import type { AuthenticatedStaff } from '../types/staff';
@@ -1237,6 +1238,10 @@ register({ request: 'broker', roll: 'update', summary: '【書き込み】台帳
 //   台帳の編集画面（PropertyRegister.tsx）は中古の顧客DB・顧客詳細からも開くので broker と同じ担当事業
 register({ request: 'broker', roll: 'ielove_candidates', summary: '媒介獲得台帳の、いえらぶの物件の候補と状態', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(BROKER_SHOPS, (_s, body) => runIeloveCandidates(body)) });
 register({ request: 'broker', roll: 'ielove_match', summary: '【書き込み】媒介獲得台帳といえらぶの物件・買い反響を今すぐ突き合わせる', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(BROKER_SHOPS, () => runIeloveMatchNow()) });
+// ⚠️ v2.2.260 新規（② だけ）。いえらぶの物件一覧（CSV）の取り込み（設定・データ管理）。features/realty/ieloveImport.ts
+//   ⚠️ いえらぶの2段階認証の義務化で sync（runIeloveProperty.ts）の自動の取り込みが止まったための代わり
+register({ request: 'planner', roll: 'ielove_import', summary: '【書き込み】いえらぶの物件一覧（CSV）を property_db に取り込む（dryRun なら件数だけ）', phpSource: '(Express のみ。① の property_db_update.php と同じ書き方)', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runIeloveImport(body)) });
+register({ request: 'planner', roll: 'ielove_import_status', summary: 'いえらぶの物件の件数と、最後に取り込んだ日', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, () => runIeloveImportStatus()) });
 register({ request: 'activity', roll: 'history', summary: '不動産企画係: 変更履歴', phpSource: 'activityAction/activity_history.php', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runActivityHistory(body)) });
 register({ request: 'activity', roll: 'notice', summary: '不動産企画係: 本人宛の通知', phpSource: 'activityAction/activity_notice.php', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runActivityNotice(s, body)) });
 register({ request: 'activity', roll: 'read', summary: '【書き込み】不動産企画係: 本人宛の通知を既読にする', phpSource: 'activityAction/activity_read.php', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runActivityRead(s, body)) });
diff --git a/backend/scripts/guide/articles/common/screen-270.md b/backend/scripts/guide/articles/common/screen-270.md
index fb21775de..a3c16a07c 100644
--- a/backend/scripts/guide/articles/common/screen-270.md
+++ b/backend/scripts/guide/articles/common/screen-270.md
@@ -2,7 +2,7 @@
 title: 設定（不動産企画係）
 section: 画面の使い方
 sort: 270
-summary: 不動産企画係の期首年月・担当者と目標・反響元・反響単価・テンプレート・宅建業者情報・休業日・架電キューを直す。以前のアプリのデータと通話記録の取り込み。
+summary: 不動産企画係の期首年月・担当者と目標・反響元・反響単価・テンプレート・宅建業者情報・休業日・架電キューを直す。いえらぶの物件一覧（CSV）・以前のアプリのデータと通話記録の取り込み。
 ---
 不動産企画係の左のメニュー「設定」で開きます。ここで直した値は、[[チームサマリー（不動産企画係）]]や[[週次行動計画（不動産企画係）]]など、不動産企画係のすべての画面に反映されます。
 
@@ -54,6 +54,26 @@ summary: 不動産企画係の期首年月・担当者と目標・反響元・
 
 一言目には次の言葉を入れておくと、反響に合わせて置き換わります：{{name}}（顧客名）・{{staff}}（担当者）・{{company}}（会社名）・{{addr}}（物件所在地）・{{property}}（問合せ物件）・{{next}}（前回の次回アクション）。「一言目を初期値に戻す」で以前のアプリの文面に戻せます。
 
+## いえらぶの物件一覧を取り込む（CSV）
+いえらぶ cloud の物件（物件番号・所在地・物件名・種別・価格など）を Dashboard に取り込みます。取り込んだ物件は、[[反響から商談案件へのつながり（不動産企画係）]]の「いえらぶの物件とつなぐ」で、媒介獲得台帳とつながります。
+
+> 2026年11月から、いえらぶのログインに2段階認証（メール）が必要になり、毎日の自動の取り込みができなくなりました。いえらぶに物件を登録・更新したら、ここから取り込んでください。
+
+1. いえらぶ cloud の「売買物件一覧」を、店舗ごとに開く
+2. 「一覧をダウンロード」→「CSV 形式でダウンロード」で、ファイル（sale_日付.csv）を保存する
+3. この画面の「いえらぶの物件一覧を取り込む（CSV）」でファイルを選ぶ。店舗ごとの複数のファイルを、まとめて選べます
+4. 件数（新しい物件・更新・価格の変更）を確かめて「**取り込む**」を押す
+
+- 同じ物件番号の物件は、CSV にある項目だけを上書きします。CSV に無い項目（いえらぶで出力の項目を減らしたときなど）は、今の値のまま残ります
+- 価格が変わったときは、価格の履歴に残ります
+- いえらぶに無くなった物件は消しません
+- 取り込み終わると、媒介獲得台帳とのつながりの確かめも、すぐ動きます。新しくつながった台帳・買い反響の件数が出ます
+- カードの上に、今の物件の数と、最後に取り込んだ日が出ます
+
+> 注意：ファイルは、いえらぶからダウンロードしたまま選んでください。Excel で開いて保存し直すと、物件番号の先頭の0や形が崩れることがあります。
+
+> 要確認：だれが・いつ取り込むか（物件を登録した日ごと、毎朝など）は、係の中で決めてください。
+
 ## 以前のアプリのデータを取り込む（マスターだけ）
 以前のアプリの全データ（反響・商談・媒介台帳・買取再販・変更履歴など）と、設定・週次行動計画・コンプライアンスを、Dashboard に取り込んで最新にします。この節は権限が「マスター」の人にだけ表示されます。
 
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 566064f7c..2cfbde648 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -171,6 +171,9 @@ function expressProxyRequests(): array
         // ⚠️ v2.2.258: 媒介獲得台帳といえらぶの物件の候補・今すぐ突き合わせ（② だけ）
         'broker:ielove_candidates',
         'broker:ielove_match',
+        // ⚠️ v2.2.260: いえらぶの物件一覧（CSV）の取り込み（② だけ）
+        'planner:ielove_import',
+        'planner:ielove_import_status',
         // ⚠️ v2.2.239。中古リノベの今日の架電キュー（② だけ）。expressProxyExclusive() にも入れてある
         'callq_used:list',
         'callq_used:mark',
@@ -879,6 +882,9 @@ function expressProxyExclusive(): array
         // ⚠️ v2.2.258: 媒介獲得台帳といえらぶの物件の候補・今すぐ突き合わせ（② だけ）
         'broker:ielove_candidates',
         'broker:ielove_match',
+        // ⚠️ v2.2.260: いえらぶの物件一覧（CSV）の取り込み（② だけ）
+        'planner:ielove_import',
+        'planner:ielove_import_status',
         // v2.2.239 新規。中古リノベの今日の架電キュー（mark は書き込み）。⚠️ ① に PHP ハンドラは無い（② だけ）
         'callq_used:list',
         'callq_used:mark',
diff --git a/frontend/src/components/realty/settings/RealtyLogImport.tsx b/frontend/src/components/realty/settings/RealtyLogImport.tsx
index ad51be61c..e9026fd43 100644
--- a/frontend/src/components/realty/settings/RealtyLogImport.tsx
+++ b/frontend/src/components/realty/settings/RealtyLogImport.tsx
@@ -19,8 +19,8 @@ const KINDS: Record<Kind, { label: string; roll: string; need: string[] }> = {
 
 const BATCH = 200;
 
-/** CSV を読む（RFC 4180。"…" の中の , と改行と "" を扱う）。1行目は列名 */
-const parseCsv = (text: string): Record<string, string>[] => {
+/** CSV を読む（RFC 4180。"…" の中の , と改行と "" を扱う）。1行目は列名。⚠️ v2.2.260 から RealtyIeloveImport.tsx も使う */
+export const parseCsv = (text: string): Record<string, string>[] => {
     const rows: string[][] = [];
     let row: string[] = [];
     let cell = '';
diff --git a/frontend/src/components/realty/settings/RealtySettings.tsx b/frontend/src/components/realty/settings/RealtySettings.tsx
index e2fd93b8b..63625a98e 100644
--- a/frontend/src/components/realty/settings/RealtySettings.tsx
+++ b/frontend/src/components/realty/settings/RealtySettings.tsx
@@ -2,6 +2,7 @@ import React, { useCallback, useContext, useEffect, useRef, useState } from 'rea
 import AuthContext from '../../../context/AuthContext';
 import RealtyImport from './RealtyImport';
 import RealtyLogImport from './RealtyLogImport';
+import RealtyIeloveImport from './RealtyIeloveImport';
 import { CQ_SCRIPTS, TAGS, callqConf, callqScripts } from '../callq/callqLogic';
 import type { CallqConf } from '../callq/callqLogic';
 import {
@@ -414,6 +415,9 @@ const RealtySettings: React.FC = () => {
                 </div>
             </div>
 
+            {/* ⚠️ v2.2.260: いえらぶの物件一覧（CSV）の取り込み。担当者みんなが使う（いえらぶの2段階認証の義務化で、自動の取り込みが止まったため） */}
+            <RealtyIeloveImport />
+
             {/* ⚠️ v2.2.224: 以前のアプリのバックアップの取り込み。マスターだけ（② も auth: 'master' で確かめる） */}
             {authority === 'Master' && <RealtyImport onFinished={reload} />}
             {/* ⚠️ v2.2.226: 以前のアプリの通話記録・練習記録（Supabase の CSV）。マスターだけ */}
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 718a6f152..8e7cd2322 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.259';
+export const newVersion = '2.2.260';
```
