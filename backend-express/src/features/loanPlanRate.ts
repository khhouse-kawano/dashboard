import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../db/pool';
import type { SqlParam } from '../db/pool';
import { listReports } from './analysis/report';

/**
 * 商圏内の金融機関のプラン別金利（loan_plan_rate）。v2.2.240 新規。
 *
 * ─────────────────────────────────────────────
 *   loan_plan_rate_list   … 登録済みの月・指定した月の行・その月までの分析レポートの一覧（⚠️ 全員が読める）
 *   loan_plan_rate_upload … plan_rates_YYYY-MM.csv の内容で、その月を丸ごと入れ替える（⚠️ Master だけ）
 *
 *   画面: frontend/src/components/header/LoanRates.tsx
 *   表  : backend/scripts/sql/2026-11-03_loan_plan_rate.sql
 *
 * ⚠️ 列名は CSV の見出しと同じ（g,id,fi,plan,rtype,term,feeType,dan,cond,rate,base,prev,asof,url,conf）。⚠️ 改名しないこと。
 * ⚠️ 資金計画書の金利（loanRate.ts。loan_product / loan_rate）とは別物。⚠️ ここから計画書の金利は書き換えない。
 * ⚠️ 分析レポート（HTML）は analysis_report（category = 'loan_rate'・period = 'YYYY-MM'）。
 *   ⚠️ 登録・本文の取得は既存の analysis_report_upload / analysis_report_get を使う。
 * ─────────────────────────────────────────────
 */

/** 分析レポートの種類（analysis_report.category） */
const LOAN_REPORT_CATEGORY = 'loan_rate';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** ⚠️ 一度に受ける行数の上限（今は約1,100行。⚠️ 誤って巨大なファイルを送られたときの歯止め） */
const MAX_ROWS = 5000;
/** 1回の INSERT に入れる行数（⚠️ プレースホルダーが増えすぎないように） */
const CHUNK = 200;

interface PlanRateRow {
  line: number;
  g: string;
  id: string;
  fi: string;
  plan: string;
  rtype: string;
  term: string;
  feeType: string;
  dan: string;
  cond: string;
  rate: number | null;
  base: number | null;
  prev: number | null;
  asof: string;
  url: string;
  conf: string;
}

interface DbRow extends RowDataPacket {
  line: number;
  g: string; id: string; fi: string; plan: string; rtype: string; term: string; feeType: string; dan: string; cond: string;
  rate: string | null; base: string | null; prev: string | null;
  asof: string; url: string; conf: string;
}

interface MonthRow extends RowDataPacket {
  month: string;
  rows_count: number;
  updated: string;
}

/** ⚠️ DECIMAL は文字列で返るので数値に戻す。NULL はそのまま */
const toNumber = (v: string | null): number | null => (v === null ? null : Number(v));

/** 登録済みの月（新しい順） */
const loadMonths = async (): Promise<{ month: string; rows: number; updated: string }[]> =>
  (await query<MonthRow>(
    `SELECT month, COUNT(*) AS rows_count, DATE_FORMAT(MAX(created_at), '%Y-%m-%d %H:%i') AS updated
       FROM loan_plan_rate GROUP BY month ORDER BY month DESC`
  )).map((r) => ({ month: r.month, rows: Number(r.rows_count), updated: r.updated }));

/**
 * 一覧。⚠️ month が無い・登録の無い月なら、いちばん新しい月。
 * ⚠️ 前月比は CSV の prev 列をそのまま使う（Claude デスクトップが同じプランを照合して入れている。⚠️ ここで前月の行と突き合わせない）。
 */
export const listLoanPlanRates = async (body: { month?: unknown }): Promise<Record<string, unknown>> => {
  const months = await loadMonths();
  const asked = String(body.month ?? '');
  const month = months.some((m) => m.month === asked) ? asked : (months[0]?.month ?? '');
  const rows = month === ''
    ? []
    : (await query<DbRow>(
      `SELECT line, g, id, fi, plan, rtype, term, feeType, dan, cond, rate, base, prev, asof, url, conf
         FROM loan_plan_rate WHERE month = ? ORDER BY line`,
      [month]
    )).map((r): PlanRateRow => ({
      line: Number(r.line), g: r.g, id: r.id, fi: r.fi, plan: r.plan, rtype: r.rtype, term: r.term, feeType: r.feeType,
      dan: r.dan, cond: r.cond, rate: toNumber(r.rate), base: toNumber(r.base), prev: toNumber(r.prev),
      asof: r.asof, url: r.url, conf: r.conf,
    }));
  // ⚠️ 本文は含まない（一覧だけ。本文は analysis_report_get で開くときに取る）
  const reports = (await listReports(LOAN_REPORT_CATEGORY)).map((r) => ({
    no: Number(r.no), title: String(r.title ?? ''), period: String(r.period ?? ''), created: String(r.created ?? ''),
  }));
  return { status: 'ok', month, months, rows, reports };
};

// ---------------------------------------------------------------------------
// 登録
// ---------------------------------------------------------------------------

/** 文字列にして前後の空白を落とし、長さで切る（loanRate.ts と同じ） */
const text = (value: unknown, max: number): string =>
  String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

/** 金利の列。⚠️ 空は null。⚠️ 数字以外・0 以下・20 以上は誤り（undefined） */
const rateOf = (value: unknown): number | null | undefined => {
  const s = String(value ?? '').replace(/[%％\s]/g, '');
  if (s === '') return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return n > 0 && n < 20 ? n : undefined;
};

export interface PlanUploadResult {
  status: 'ok' | 'error';
  message?: string;
  errors?: { line: number; message: string }[];
  rows?: number;
  replaced?: number;
}

/**
 * plan_rates_YYYY-MM.csv の内容で、その月を丸ごと入れ替える。
 * ⚠️ 全行が正しいときだけ書く（1行でも誤りがあれば何も書かない）。⚠️ 入れ替えは1つのトランザクション。
 * ⚠️ 本文: month（YYYY-MM）・rows（CSV の行のオブジェクトの配列。キーは見出し）。
 */
export const uploadLoanPlanRates = async (body: { month?: unknown; rows?: unknown }, staffName: string): Promise<PlanUploadResult> => {
  const month = text(body.month, 7);
  if (!MONTH_PATTERN.test(month)) return { status: 'error', message: '対象月を正しく指定してください（例: 2026-11）。' };
  if (!Array.isArray(body.rows) || body.rows.length === 0) return { status: 'error', message: 'CSV にプランの行がありません。' };
  if (body.rows.length > MAX_ROWS) return { status: 'error', message: `行が多すぎます（上限 ${MAX_ROWS} 行）。` };

  const errors: { line: number; message: string }[] = [];
  const values: SqlParam[][] = [];
  body.rows.forEach((raw, i) => {
    const line = i + 2;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ line, message: '行の形式が正しくありません' });
      return;
    }
    const r = raw as Record<string, unknown>;
    const fi = text(r.fi, 191);
    const plan = text(r.plan, 255);
    if (fi === '') { errors.push({ line, message: '金融機関名（fi）が空です' }); return; }
    if (plan === '') { errors.push({ line, message: 'プラン名（plan）が空です' }); return; }
    const nums = (['rate', 'base', 'prev'] as const).map((c) => [c, rateOf(r[c])] as const);
    const bad = nums.find(([, v]) => v === undefined);
    if (bad) { errors.push({ line, message: `${bad[0]} が正しくありません（数字のみ・0より大きく20未満）: ${String(r[bad[0]] ?? '')}` }); return; }
    const [rate, base, prev] = nums.map(([, v]) => v as number | null);
    values.push([
      month, line, text(r.g, 64), text(r.id, 64), fi, plan, text(r.rtype, 32), text(r.term, 16), text(r.feeType, 32),
      text(r.dan, 64), text(r.cond, 255), rate, base, prev, text(r.asof, 16), text(r.url, 255), text(r.conf, 16), staffName || '不明',
    ]);
  });
  if (errors.length > 0) return { status: 'error', message: `${errors.length} 行に誤りがあります。何も登録していません。`, errors };

  return withTransaction(async (tx) => {
    const removed = await tx.execute('DELETE FROM loan_plan_rate WHERE month = ?', [month]);
    for (let i = 0; i < values.length; i += CHUNK) {
      const part = values.slice(i, i + CHUNK);
      await tx.execute(
        `INSERT INTO loan_plan_rate (month, line, g, id, fi, plan, rtype, term, feeType, dan, cond, rate, base, prev, asof, url, conf, created_by)
         VALUES ${part.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        part.flat()
      );
    }
    return { status: 'ok', rows: values.length, replaced: removed.affectedRows };
  });
};
