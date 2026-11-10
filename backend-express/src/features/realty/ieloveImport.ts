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
