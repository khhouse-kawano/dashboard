import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../db/pool';
import type { SqlParam } from '../db/pool';

/**
 * 予算テーブル（budget の一覧と CSV での追加）。v2.2.243 新規。
 *
 * ─────────────────────────────────────────────
 *   budget_table_list   … 期間などで絞った行・件数と金額の合計・絞り込みの選択肢
 *   budget_table_upload … CSV の行を budget へ INSERT する（mode = 'check' は確かめるだけ、'save' で登録）
 *
 *   画面: frontend/src/components/header/system/BudgetTable.tsx（ヘッダーの「システム管理 → 予算テーブル」）
 *   列  : backend/scripts/sql/2026-11-04_budget_remarks.sql（remarks を足した）
 *
 * ⚠️⚠️ **Master と BrandAdmin だけ。** registry.ts で `auth: 'staff'` のうえ BUDGET_TABLE_AUTHORITY を確かめる。
 * ⚠️⚠️ **budget には UNIQUE キーが無い**（eventBudget.ts の注記）。同じ CSV を2回登録すると2組になる。
 *   ⚠️ 防ぐのは画面の確認（mode = 'check' で「同じ内容がすでにある行」を数えて出す）。⚠️ 登録は止めない（同じ金額の伝票が実在するため）。
 * ⚠️ 表の中での修正・削除は作らない（2026-11-04 決定）。
 * ─────────────────────────────────────────────
 */

export const BUDGET_TABLE_AUTHORITY = ['Master', 'BrandAdmin'];

/** 一度に返す行の上限（⚠️ 2026-11 時点で全体 33,000 行。期間で絞って使う） */
const MAX_ROWS = 3000;
/** 一度に受ける CSV の行の上限（⚠️ 誤って表を丸ごと書き出した CSV を入れたときの歯止め） */
const MAX_UPLOAD_ROWS = 5000;
/** 1回の INSERT に入れる行数 */
const CHUNK = 200;

/** budget.section の値。⚠️ 中古は `use`（`used` ではない。eventBudget.ts の SECTION_BY_DIVISION の注記） */
const SECTIONS = ['order', 'spec', 'use'];
const CATEGORIES = ['MKT', 'PR'];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

interface BudgetRow extends RowDataPacket {
  id: number;
  budget_period: string;
  shop: string;
  medium: string;
  budget_value: number;
  note: string;
  company: string;
  remarks: string | null;
  response_medium: number;
  category: string;
  section: string | null;
  order_section: string;
}

interface RangeRow extends RowDataPacket { from_month: string; to_month: string }
interface TotalRow extends RowDataPacket { category: string; rows_count: number; total: number | string | null }
interface ValueRow extends RowDataPacket { v: string }
interface KeyRow extends RowDataPacket { k: string }

/** 制御文字を落として前後の空白を除き、長さで切る */
const text = (value: unknown, max = 1000): string =>
  String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

/** LIKE の特殊文字を逃がす */
const likeOf = (q: string): string => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// ---------------------------------------------------------------------------
// 一覧
// ---------------------------------------------------------------------------

/**
 * ⚠️ budget_period は text（'2026/10/01'。⚠️ '2025/12/1' のように0の無い値もある）。
 *   ⚠️ 月は先頭7文字（'2026/10'）を文字列で比べる。
 * ⚠️ 期間の既定は DB の今月を含む直近3か月。
 * ⚠️ 件数・合計は絞り込み全体で数える（⚠️ 返す行が上限で切れても合計は正しい）。
 */
export const listBudgetTable = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const [range] = await query<RangeRow>(
    "SELECT DATE_FORMAT(CURDATE() - INTERVAL 2 MONTH, '%Y-%m') AS from_month, DATE_FORMAT(CURDATE(), '%Y-%m') AS to_month"
  );
  const from = MONTH.test(String(body.from ?? '')) ? String(body.from) : range.from_month;
  const to = MONTH.test(String(body.to ?? '')) ? String(body.to) : range.to_month;
  const section = SECTIONS.includes(String(body.section ?? '')) ? String(body.section) : '';
  const category = CATEGORIES.includes(String(body.category ?? '')) ? String(body.category) : '';
  const medium = text(body.medium, 200);
  const shop = text(body.shop, 200);
  const q = text(body.q, 100);

  const where = ['LEFT(budget_period, 7) >= ?', 'LEFT(budget_period, 7) <= ?'];
  const params: SqlParam[] = [from.replace('-', '/'), to.replace('-', '/')];
  if (section !== '') { where.push('section = ?'); params.push(section); }
  if (category !== '') { where.push('category = ?'); params.push(category); }
  if (medium !== '') { where.push('medium = ?'); params.push(medium); }
  if (shop !== '') { where.push('shop = ?'); params.push(shop); }
  if (q !== '') {
    where.push('(note LIKE ? OR company LIKE ? OR remarks LIKE ? OR shop LIKE ? OR medium LIKE ? OR order_section LIKE ?)');
    const like = likeOf(q);
    params.push(like, like, like, like, like, like);
  }
  const condition = where.join(' AND ');

  const rows = await query<BudgetRow>(
    `SELECT id, budget_period, shop, medium, budget_value, note, company, remarks, response_medium, category, section, order_section
       FROM budget WHERE ${condition}
      ORDER BY budget_period DESC, id DESC LIMIT ${MAX_ROWS + 1}`,
    params
  );
  const totals = await query<TotalRow>(
    `SELECT category, COUNT(*) AS rows_count, SUM(budget_value) AS total FROM budget WHERE ${condition} GROUP BY category`,
    params
  );
  // ⚠️ 選択肢は表全体から（⚠️ 期間で絞ると、選んだ値が別の月で消えて選び直せなくなる）
  const media = await query<ValueRow>("SELECT DISTINCT medium AS v FROM budget WHERE medium <> '' ORDER BY medium");
  const shops = await query<ValueRow>("SELECT DISTINCT shop AS v FROM budget WHERE shop <> '' ORDER BY shop");

  const sumOf = (cat?: string) => totals
    .filter((t) => cat === undefined || t.category === cat)
    .reduce((acc, t) => ({ rows: acc.rows + Number(t.rows_count), total: acc.total + Number(t.total ?? 0) }), { rows: 0, total: 0 });

  return {
    status: 'ok',
    from,
    to,
    totals: { all: sumOf(), mkt: sumOf('MKT'), pr: sumOf('PR') },
    rows: rows.slice(0, MAX_ROWS).map((r) => ({
      id: Number(r.id),
      period: r.budget_period,
      shop: r.shop,
      medium: r.medium,
      value: Number(r.budget_value),
      note: r.note,
      company: r.company,
      remarks: r.remarks ?? '',
      responseMedium: Number(r.response_medium),
      category: r.category,
      section: r.section ?? '',
      orderSection: r.order_section,
    })),
    truncated: rows.length > MAX_ROWS,
    maxRows: MAX_ROWS,
    options: { media: media.map((m) => m.v), shops: shops.map((s) => s.v) },
  };
};

// ---------------------------------------------------------------------------
// CSV での追加
// ---------------------------------------------------------------------------

/*
 * ⚠️ CSV の見出しは budget の列名と同じ（画面の BudgetTable.tsx の REQUIRED_COLUMNS で確かめている）。
 *   ⚠️ id の列は無視する。⚠️ remarks の列は無くてもよい。
 */

/**
 * 請求先の括弧書きを詳細へ分ける（⚠️ 2026-11-04_budget_remarks.sql と同じ規則）。
 * ⚠️ 括弧より前に文字があり、末尾が閉じ括弧の値だけ。⚠️ 詳細の列に値があるときは分けない。
 */
const SPLIT = /^(.+?)\s*[(（](.*)[)）]\s*$/;
const HAS_HEAD = /^[^(（]*[^(（\s][^(（]*[(（]/;

/** '2026/10/01'・'2026-10-1' → '2026/10/01'。⚠️ 日付として正しくなければ null */
const periodOf = (value: string): string | null => {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[1]}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
};

/** 金額。⚠️ カンマ・円記号・空白は落とす。⚠️ 負の値も認める（返金・修正の伝票が実在する）。⚠️ 整数だけ */
const valueOf = (value: string): number | null => {
  const s = value.replace(/[,，¥￥円\s]/g, '');
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Math.abs(n) <= 2147483647 ? n : null;
};

interface UploadRow {
  period: string;
  shop: string;
  medium: string;
  value: number;
  note: string;
  company: string;
  remarks: string | null;
  responseMedium: number;
  category: string;
  section: string;
  orderSection: string;
}

/** 同じ内容の行を見分ける鍵（⚠️ 期間・店舗・媒体・金額・内容・請求先） */
const keyOf = (r: UploadRow): string =>
  [r.period, r.shop, r.medium, r.value, r.note, r.company].join('\u0001');

const checkRow = (raw: unknown): { row?: UploadRow; error?: string; split?: boolean } => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { error: '行の形式が正しくありません' };
  const r = raw as Record<string, unknown>;

  const period = periodOf(text(r.budget_period, 20));
  if (period === null) return { error: `budget_period が日付ではありません（例: 2026/11/01）: ${text(r.budget_period, 20)}` };
  const shop = text(r.shop, 200);
  if (shop === '') return { error: 'shop が空です' };
  const medium = text(r.medium, 200);
  if (medium === '') return { error: 'medium が空です' };
  const value = valueOf(text(r.budget_value, 30));
  if (value === null) return { error: `budget_value が整数ではありません: ${text(r.budget_value, 30)}` };
  const responseRaw = text(r.response_medium, 5);
  if (responseRaw !== '0' && responseRaw !== '1') return { error: `response_medium は 0 か 1 です: ${responseRaw}` };
  const category = text(r.category, 10).toUpperCase();
  if (!CATEGORIES.includes(category)) return { error: `category は MKT か PR です: ${text(r.category, 10)}` };
  const section = text(r.section, 10);
  if (!SECTIONS.includes(section)) {
    return { error: `section は order・spec・use のどれかです${section === 'used' ? '（中古は use）' : ''}: ${section}` };
  }

  let company = text(r.company, 500);
  // ⚠️ phpMyAdmin で書き出した CSV は、空の詳細が引用符なしの NULL になる
  const remarksRaw = text(r.remarks, 1000);
  let remarks: string | null = remarksRaw === '' || remarksRaw === 'NULL' ? null : remarksRaw;
  let split = false;
  const m = remarks === null ? SPLIT.exec(company) : null;
  if (m && HAS_HEAD.test(company)) {
    company = m[1].trim();
    remarks = m[2].trim() || null;
    split = true;
  }

  return {
    row: {
      period, shop, medium, value, note: text(r.note, 2000), company, remarks,
      responseMedium: Number(responseRaw), category, section, orderSection: text(r.order_section, 200),
    },
    split,
  };
};

/**
 * CSV の行（見出しをキーにしたオブジェクトの配列）を確かめ、mode = 'save' なら INSERT する。
 * ⚠️ 1行でも誤りがあれば何も登録しない（⚠️ 登録は1つのトランザクション）。
 * ⚠️ 行番号は CSV の行（見出しが1行目なので、1件目は2行目）。
 */
export const uploadBudgetTable = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const mode = body.mode === 'save' ? 'save' : 'check';
  if (!Array.isArray(body.rows) || body.rows.length === 0) return { status: 'error', message: 'CSV に行がありません。' };
  if (body.rows.length > MAX_UPLOAD_ROWS) {
    return { status: 'error', message: `行が多すぎます（上限 ${MAX_UPLOAD_ROWS.toLocaleString()} 行）。月ごとなどに分けてください。` };
  }

  const errors: { line: number; message: string }[] = [];
  const rows: { line: number; row: UploadRow }[] = [];
  let splitCount = 0;
  body.rows.forEach((raw, i) => {
    const line = i + 2;
    const result = checkRow(raw);
    if (result.error !== undefined) errors.push({ line, message: result.error });
    else if (result.row !== undefined) {
      rows.push({ line, row: result.row });
      if (result.split) splitCount++;
    }
  });
  if (errors.length > 0) {
    return { status: 'error', message: `${errors.length} 行に誤りがあります。何も登録していません。`, errors: errors.slice(0, 50), errorCount: errors.length };
  }

  // 同じ内容がすでにある行（⚠️ CSV の中の重なりも数える）
  const periods = [...new Set(rows.map((r) => r.row.period))];
  const existing = new Set(
    (await query<KeyRow>(
      `SELECT CONCAT_WS(CHAR(1), budget_period, shop, medium, budget_value, note, company) AS k
         FROM budget WHERE budget_period IN (${periods.map(() => '?').join(', ')})`,
      periods
    )).map((r) => r.k)
  );
  const seen = new Set<string>();
  const duplicateLines: number[] = [];
  for (const { line, row } of rows) {
    const k = keyOf(row);
    if (existing.has(k) || seen.has(k)) duplicateLines.push(line);
    seen.add(k);
  }

  const summary = {
    rows: rows.length,
    total: rows.reduce((n, r) => n + r.row.value, 0),
    from: periods.reduce((a, b) => (a < b ? a : b)),
    to: periods.reduce((a, b) => (a > b ? a : b)),
    splitCount,
    duplicates: duplicateLines.length,
    duplicateLines: duplicateLines.slice(0, 20),
  };
  if (mode === 'check') return { status: 'ok', mode, ...summary };

  await withTransaction(async (tx) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK).map((r) => r.row);
      await tx.execute(
        `INSERT INTO budget (budget_period, shop, medium, budget_value, note, company, remarks, response_medium, category, section, order_section)
         VALUES ${part.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        part.flatMap((r): SqlParam[] => [
          r.period, r.shop, r.medium, r.value, r.note, r.company, r.remarks, r.responseMedium, r.category, r.section, r.orderSection,
        ])
      );
    }
  });
  return { status: 'ok', mode, inserted: rows.length, ...summary };
};
