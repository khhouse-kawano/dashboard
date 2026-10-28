import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../../db/pool';
import type { Tx } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import type { Result } from './index';

/**
 * 不動産企画係の設定・週次行動計画・コンプライアンス（v2.2.223。② だけにある）。
 *
 * ─────────────────────────────────────────────
 * 保存先は app_state の3行（本番アプリの Supabase app_state と同じ形）。
 *   settings   … 期首年月・担当者と目標・反響元・買いポータル・反響単価・テンプレート・宅建業者情報 など
 *   weekly     … { 'YYYY-MM': [{ week, staff, cg, ca, tg, ta, ng, na, sg, sa }, …] }
 *   compliance … [{ id, no, item, staff, date, status, target, note }, …]
 * ⚠️ 形を変えないこと。切り替えの日に本番アプリ（Supabase）から**そのまま上書きで取り込む**。
 *
 * ⚠️⚠️ 書き込みは**項目ごと**に JSON_SET で差し込む（全体を読んで書き戻さない）。
 *   ・settings には契約書の下書き（docDrafts）も入っていて大きくなる。全体を書き戻すと
 *     mysql2 の 64KB の不具合（db/pool.ts の executeLarge の注記）に当たる
 *   ・同時に別の人が別の項目を直しても、互いに消し合わない
 *
 * ⚠️ 週次行動計画の「架電実績（ca）」は保存しない。画面が売り反響の架電記録から数える（本番アプリと同じく手入力不可）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body });
const fail = (httpStatus: number, message: string): Result => ({ httpStatus, body: { status: 'error', message } });

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

const parseJson = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// 日付（⚠️ 日本時間で判断する。② のサーバーの時計の時刻帯に左右されないように）
// ---------------------------------------------------------------------------

/** 日本時間の 'YYYY-MM-DD' */
const jstToday = (now = new Date()): string => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

const prevMonthKey = (mk: string): string => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** 翌月のこの日までは、前月の目標も直せる（本番アプリの LOCK_GRACE_DAY） */
const LOCK_GRACE_DAY = 5;

/** 目標を誰でも直せる月か（本番アプリの wOpenMonth）。今月以降と、5日までの前月 */
const isOpenMonth = (mk: string, today = jstToday()): boolean => {
  const cur = today.slice(0, 7);
  if (mk >= cur) return true;
  return mk === prevMonthKey(cur) && Number(today.slice(8, 10)) <= LOCK_GRACE_DAY;
};

/**
 * 確定済みの月の目標も直せる人（本番アプリの WEEKLY_ADMINS = 時任 さん）。
 * ⚠️ Dashboard では名前ではなく権限で決める: マスター・マネージャー
 */
const WEEKLY_ADMIN_AUTHORITIES = ['Master', 'Manager'];
const isWeeklyAdmin = (staff: AuthenticatedStaff): boolean => WEEKLY_ADMIN_AUTHORITIES.includes(staff.brand);

// ---------------------------------------------------------------------------
// 読み出し
// ---------------------------------------------------------------------------

const STATE_DEFAULTS = { settings: '{}', weekly: '{}', compliance: '[]' } as const;
type StateKey = keyof typeof STATE_DEFAULTS;

/** 行が無ければ空で作る（JSON_SET は行が無いと何もしないため） */
const ensureStateRow = (tx: Tx, key: StateKey) =>
  tx.execute('INSERT IGNORE INTO app_state (`key`, `data`) VALUES (?, ?)', [key, STATE_DEFAULTS[key]]);

/**
 * 3画面の元データ。
 * ⚠️ 売り反響（kind = leads）は週次行動計画の架電実績を数えるためだけに返す（id・担当・架電記録だけ）。
 * ⚠️ 削除済み（show_dashboard = 0）は数えない（画面の isSoftDeleted と同じ）。
 */
export const runPlannerState = async (staff: AuthenticatedStaff): Promise<Result> => {
  const [states, sellLeads] = await Promise.all([
    query<DynamicRow>("SELECT `key`, `data` FROM app_state WHERE `key` IN ('settings', 'weekly', 'compliance')"),
    query<DynamicRow>(
      "SELECT `id`, `staff`, `callDates` FROM brokerage_listings WHERE kind = 'leads' AND (show_dashboard IS NULL OR show_dashboard <> 0)"
    ),
  ]);
  const byKey = (key: StateKey, fallback: unknown) => {
    const parsed = parseJson(states.find((r) => r.key === key)?.data);
    return parsed === null ? fallback : parsed;
  };
  const settings = byKey('settings', {});
  const weekly = byKey('weekly', {});
  const compliance = byKey('compliance', []);
  return ok({
    status: 'success',
    settings: isObject(settings) ? settings : {},
    weekly: isObject(weekly) ? weekly : {},
    compliance: Array.isArray(compliance) ? compliance : [],
    sellLeads,
    isWeeklyAdmin: isWeeklyAdmin(staff),
    today: jstToday(),
  });
};

// ---------------------------------------------------------------------------
// 設定（planner:settings）
// ---------------------------------------------------------------------------

class InvalidInput extends Error {}

const text = (v: unknown, max: number, label: string): string => {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string' && typeof v !== 'number') throw new InvalidInput(`${label}が文字ではありません`);
  const s = String(v).trim();
  if (s.length > max) throw new InvalidInput(`${label}は${max}文字までです`);
  return s;
};

/** 0 以上の整数（円・件）。空は 0 */
const amount = (v: unknown, label: string): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new InvalidInput(`${label}は0以上の数で入力してください`);
  return Math.round(n);
};

const nameList = (v: unknown, label: string): string[] => {
  if (!Array.isArray(v) || v.length > 100) throw new InvalidInput(`${label}の形が正しくありません`);
  const out: string[] = [];
  for (const item of v) {
    const s = text(item, 50, label);
    if (s !== '' && !out.includes(s)) out.push(s);
  }
  return out;
};

const costMap = (v: unknown, label: string): Record<string, number> => {
  if (!isObject(v)) throw new InvalidInput(`${label}の形が正しくありません`);
  const out: Record<string, number> = {};
  for (const [k, raw] of Object.entries(v)) {
    const n = amount(raw, label);
    if (n > 0) out[text(k, 50, label)] = n; // ⚠️ 0 は「未設定」なので持たない（本番アプリの costSet と同じ）
  }
  return out;
};

const COMPANY_FIELDS = ['name', 'rep', 'dept', 'addr', 'tel', 'fax', 'license', 'assoc', 'agent', 'agentNo'] as const;
const CALLQ_SCRIPT_KEYS = ['first', 'firstBuy', 'redial', 'report', 'newprop', 'overdue', 'long', 'ask'] as const;

/**
 * 画面から直せる設定の項目と、その確かめ方。
 * ⚠️ ここに無い項目（docDrafts・resaleGpMode・resaleCostSets・mailNotify など）は受け付けない。
 *   それらを使う画面を移すときに足す。
 */
const SETTINGS_FIELDS: Record<string, (v: unknown) => unknown> = {
  fiscalStart: (v) => {
    const s = text(v, 7, '期首年月');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new InvalidInput('期首年月は YYYY-MM で入力してください');
    return s;
  },
  staff: (v) => {
    if (!Array.isArray(v)) throw new InvalidInput('担当者の形が正しくありません');
    if (v.length > 10) throw new InvalidInput('担当者は10名までです');
    return v.map((raw, i) => {
      if (!isObject(raw)) throw new InvalidInput('担当者の形が正しくありません');
      const label = `担当者${i + 1}行目の`;
      return {
        id: text(raw.id, 40, `${label}ID`),
        name: text(raw.name, 30, `${label}担当者名`),
        abbr: text(raw.abbr, 10, `${label}略称`),
        budget: amount(raw.budget, `${label}年間予算`),
        monthlyGoal: amount(raw.monthlyGoal, `${label}今月目標売上`),
        baikaiTarget: amount(raw.baikaiTarget, `${label}年間媒介目標`),
      };
    });
  },
  sources: (v) => nameList(v, '反響元'),
  buyPortals: (v) => nameList(v, '買いポータル'),
  srcCosts: (v) => costMap(v, '反響単価（売り）'),
  portalCosts: (v) => costMap(v, '反響単価（買い）'),
  templates: (v) => {
    if (!Array.isArray(v)) throw new InvalidInput('テンプレートの形が正しくありません');
    if (v.length > 30) throw new InvalidInput('テンプレートは30件までです');
    return v.map((raw) => {
      if (!isObject(raw)) throw new InvalidInput('テンプレートの形が正しくありません');
      return { id: text(raw.id, 40, 'テンプレートのID'), title: text(raw.title, 100, 'テンプレート名'), body: text(raw.body, 5000, 'テンプレートの本文') };
    });
  },
  company: (v) => {
    if (!isObject(v)) throw new InvalidInput('宅建業者情報の形が正しくありません');
    const out: Record<string, string> = {};
    for (const f of COMPANY_FIELDS) out[f] = text(v[f], 200, '宅建業者情報');
    return out;
  },
  // ⚠️ v2.2.226: 今日の架電キューの抽出ルール（以前のアプリの CQ_DEFAULTS と V16.setSize / setConf の範囲）
  //   ⚠️ 以前のアプリは件数だけ 1〜50 に丸め、ほかは 1 以上しか確かめない（実データに「週目標÷10」がある）。上限は桁あふれよけ
  callq: (v) => {
    if (!isObject(v)) throw new InvalidInput('架電キューの設定の形が正しくありません');
    const int = (raw: unknown, min: number, max: number, label: string): number => {
      const n = Math.round(Number(raw));
      if (!Number.isFinite(n) || n < min || n > max) throw new InvalidInput(`${label}は${min}〜${max}で入力してください`);
      return n;
    };
    return {
      size: int(v.size, 1, 50, '1日に並べる件数'),
      staleSell: int(v.staleSell, 1, 9999, '売り反響の日数'),
      staleBuy: int(v.staleBuy, 1, 9999, '買い反響の日数'),
      dailyDivisor: int(v.dailyDivisor, 1, 9999, '1日の目標の割る数'),
      includeBuy: v.includeBuy !== false,
    };
  },
  // ⚠️ v2.2.226: 今日の架電キューの一言目（要件タグごと。以前のアプリの CQ_SCRIPTS のキー）
  callqScripts: (v) => {
    if (!isObject(v)) throw new InvalidInput('一言目の形が正しくありません');
    const out: Record<string, string> = {};
    for (const k of CALLQ_SCRIPT_KEYS) out[k] = text(v[k], 2000, '一言目');
    return out;
  },
};

/** body.patch = { 項目: 新しい値 }。項目ごとに確かめてから差し込む */
export const runPlannerSettings = async (body: Record<string, unknown>): Promise<Result> => {
  if (!isObject(body.patch) || Object.keys(body.patch).length === 0) return fail(400, '保存する項目がありません');
  const entries: [string, unknown][] = [];
  try {
    for (const [key, value] of Object.entries(body.patch)) {
      const check = SETTINGS_FIELDS[key];
      if (!check) return fail(400, `この項目はここでは保存できません: ${key}`);
      entries.push([key, check(value)]);
    }
  } catch (e) {
    if (e instanceof InvalidInput) return fail(400, e.message);
    throw e;
  }

  const settings = await withTransaction(async (tx) => {
    await ensureStateRow(tx, 'settings');
    for (const [key, value] of entries) {
      // ⚠️ 項目名は SETTINGS_FIELDS のキーだけ（英字のみ）なのでパスに埋め込んでよい
      await tx.execute(
        `UPDATE app_state SET \`data\` = JSON_SET(\`data\`, '$.${key}', JSON_EXTRACT(?, '$')) WHERE \`key\` = 'settings'`,
        [JSON.stringify(value)]
      );
    }
    const rows = await tx.query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'settings'");
    return parseJson(rows[0]?.data);
  });
  return ok({ status: 'success', settings: isObject(settings) ? settings : {} });
};

// ---------------------------------------------------------------------------
// 週次行動計画（planner:weekly）
// ---------------------------------------------------------------------------

/** 目標（黄色のセル）。確定済みの月は管理者だけ */
const GOAL_KEYS = ['cg', 'tg', 'ng', 'sg'];
/** 実績（白のセル）。⚠️ 架電実績 ca は自動集計なので受け付けない。⚠️ 本番アプリの LOCK_ACTUALS = false（実績はいつでも直せる） */
const ACTUAL_KEYS = ['ta', 'na', 'sa'];
const WEEKLY_MAX = 99999;

type WeeklyRow = { week: number; staff: string; [key: string]: unknown };

const emptyWeeklyRow = (week: number, staff: string): WeeklyRow =>
  ({ week, staff, cg: 0, ca: 0, tg: 0, ta: 0, ng: 0, na: 0, sg: 0, sa: 0 });

/**
 * 1か月の行を、設定の担当者 × 第1〜4週がそろうように足す（本番アプリの ensureWeekly）。
 * ⚠️ 設定から外した担当者の行は消さない（過去の実績を残すため）。
 */
const ensureWeeklyRows = (rows: WeeklyRow[], staffNames: string[]): WeeklyRow[] => {
  const out = rows.slice();
  for (let w = 1; w <= 4; w++) {
    for (const s of staffNames) {
      if (!out.some((r) => r.week === w && r.staff === s)) out.push(emptyWeeklyRow(w, s));
    }
  }
  return out;
};

const settingsStaffNames = (raw: unknown): string[] => {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((s) => (isObject(s) ? String(s.name ?? '').trim() : ''))
    .filter((n) => n !== '');
};

/**
 * body = { month: 'YYYY-MM', cells: [{ week, staff, key, value }, …] }。
 * ⚠️ 前週コピーもこれで送る（画面が値を組み立てる）。
 */
export const runPlannerWeekly = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const month = typeof body.month === 'string' ? body.month : '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail(400, '対象月が正しくありません');
  if (!Array.isArray(body.cells) || body.cells.length === 0 || body.cells.length > 400) return fail(400, '保存する値がありません');

  const cells: { week: number; staff: string; key: string; value: number }[] = [];
  for (const raw of body.cells) {
    if (!isObject(raw)) return fail(400, '保存する値の形が正しくありません');
    const week = Number(raw.week);
    const key = String(raw.key ?? '');
    const value = raw.value === '' || raw.value === null || raw.value === undefined ? 0 : Number(raw.value);
    if (![1, 2, 3, 4].includes(week)) return fail(400, '週が正しくありません');
    if (key === 'ca') return fail(400, '架電実績は売り反響の架電記録から自動集計されます（手入力不可）');
    if (!GOAL_KEYS.includes(key) && !ACTUAL_KEYS.includes(key)) return fail(400, '項目が正しくありません');
    if (!Number.isInteger(value) || value < 0 || value > WEEKLY_MAX) return fail(400, `半角の整数（0〜${WEEKLY_MAX}）で入力してください`);
    cells.push({ week, staff: String(raw.staff ?? ''), key, value });
  }

  if (cells.some((c) => GOAL_KEYS.includes(c.key)) && !isOpenMonth(month) && !isWeeklyAdmin(staff)) {
    return fail(403, '確定済みの月のため編集できません（管理者のみ変更可）');
  }

  const result = await withTransaction(async (tx) => {
    await ensureStateRow(tx, 'weekly');
    // ⚠️ FOR UPDATE: 同じ月を同時に保存したとき、後の人が先の人の値を消さないように
    const [state] = await tx.query<DynamicRow>(
      "SELECT JSON_EXTRACT(`data`, ?) AS month_rows FROM app_state WHERE `key` = 'weekly' FOR UPDATE",
      [`$."${month}"`]
    );
    const [settingsRow] = await tx.query<DynamicRow>(
      "SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings'"
    );
    const names = settingsStaffNames(settingsRow?.staff);
    const current = parseJson(state?.month_rows);
    const rows = ensureWeeklyRows(Array.isArray(current) ? (current as WeeklyRow[]) : [], names);

    for (const c of cells) {
      const row = rows.find((r) => r.week === c.week && r.staff === c.staff);
      if (!row) return null; // 設定に無い担当者
      row[c.key] = c.value;
    }
    await tx.execute(
      "UPDATE app_state SET `data` = JSON_SET(`data`, ?, JSON_EXTRACT(?, '$')) WHERE `key` = 'weekly'",
      [`$."${month}"`, JSON.stringify(rows)]
    );
    return rows;
  });
  if (result === null) return fail(400, '設定に無い担当者です。設定画面の担当者を確かめてください');
  return ok({ status: 'success', month, rows: result });
};

// ---------------------------------------------------------------------------
// コンプライアンス（planner:compliance）
// ---------------------------------------------------------------------------

const COMP_STATES = ['', '✅完了', '⏳確認中', '❌未対応', '➖対象外'];
const COMP_FIELDS = ['staff', 'date', 'status', 'target', 'note'];

/**
 * body = { id, field, value } で1か所を直す。body = { reset: true } で全項目の入力を消す（本番アプリの resetComp）。
 * ⚠️ チェック項目（item）と並び（no）は直せない（本番アプリにも画面が無い）。
 */
export const runPlannerCompliance = async (body: Record<string, unknown>): Promise<Result> => {
  const reset = body.reset === true;
  const id = typeof body.id === 'string' ? body.id : '';
  const field = typeof body.field === 'string' ? body.field : '';
  let value = '';
  if (!reset) {
    if (id === '') return fail(400, 'IDがありません');
    if (!COMP_FIELDS.includes(field)) return fail(400, '項目が正しくありません');
    try {
      value = text(body.value, 200, '入力');
    } catch (e) {
      if (e instanceof InvalidInput) return fail(400, e.message);
      throw e;
    }
    if (field === 'status' && !COMP_STATES.includes(value)) return fail(400, '状態が正しくありません');
    if (field === 'date' && value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail(400, '確認日が正しくありません');
  }

  const result = await withTransaction(async (tx) => {
    await ensureStateRow(tx, 'compliance');
    const [state] = await tx.query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'compliance' FOR UPDATE");
    const parsed = parseJson(state?.data);
    const items = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    if (reset) {
      for (const c of items) for (const f of COMP_FIELDS) c[f] = '';
    } else {
      const item = items.find((c) => c.id === id);
      if (!item) return null;
      item[field] = value;
    }
    // ⚠️ 15項目・数KBなので全体を書き戻す
    await tx.execute("UPDATE app_state SET `data` = ? WHERE `key` = 'compliance'", [JSON.stringify(items)]);
    return items;
  });
  if (result === null) return fail(404, 'チェック項目が見つかりません');
  return ok({ status: 'success', compliance: result });
};
