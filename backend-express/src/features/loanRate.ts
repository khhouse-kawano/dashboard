import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../db/pool';
import type { SqlParam } from '../db/pool';

/**
 * 住宅ローン金利（loan_product / loan_rate）。v2.2.168 新規。
 *
 * ─────────────────────────────────────────────
 *   loan_rate_latest … 商品ごとの最新の確定済み金利（⚠️ 全員が読める）
 *   loan_rate_upload … CSV の内容を登録して確定する（⚠️ Master だけ）
 *
 *   画面: frontend/src/components/header/UploadLoan.tsx
 *   表  : backend/scripts/sql/2026-10-06_loan_rate.sql
 *
 * ⚠️⚠️ **列名・キー名は funding-plan の `LOANS` と同じ**（`fi` `pn` `feeMode` …）。
 *   ⚠️ 計画書の `applyFeed()` にそのまま渡せる形にしてある。⚠️ 改名しないこと。
 *
 * ⚠️⚠️ **顧客の計画書（funding_plan.loans）は書き換えない。**
 *   ⚠️ 計画書は保存時点の金利を持つ。後から金利が変わっても過去の数字は動かない。
 * ─────────────────────────────────────────────
 */

/** ⚠️ CSV の列。⚠️ テンプレート（frontend/public/templates/loan_rate_template.csv）と同じ順 */
export const LOAN_CSV_COLUMNS = [
  'id', 'g', 'fi', 'pn', 'type', 'rate', 'asof', 'fee', 'feeMode', 'feeVal',
  'hosho', 'hoshoVal', 'dan', 'note', 'warn', 'url', 'source',
] as const;

export interface LoanRateRow {
  id: string;
  g: string;
  fi: string;
  pn: string;
  type: string;
  url: string;
  sort: number;
  rate: number;
  asof: string;
  fee: string;
  feeMode: string;
  feeVal: number;
  hosho: string;
  hoshoVal: number;
  dan: string;
  note: string;
  warn: string;
  source: string;
  base_date: string;
}

interface LatestRow extends RowDataPacket {
  id: string;
  g: string;
  fi: string;
  pn: string;
  type: string;
  url: string | null;
  sort: number;
  rate: string;
  asof: string | null;
  fee: string | null;
  feeMode: string;
  feeVal: string;
  hosho: string | null;
  hoshoVal: string;
  dan: string | null;
  note: string | null;
  warn: string | null;
  source: string | null;
  base_date: string;
}

/**
 * 商品ごとの最新の確定済み金利。
 *
 * ⚠️ 「最新」= 確定済み（confirmed_at が入っている）行のうち base_date が最も新しいもの。
 * ⚠️ active = 0 の商品は返さない。⚠️ 確定済みの金利が1件も無い商品も返さない。
 */
const LATEST_SQL = `
  SELECT p.id, p.g, p.fi, p.pn, p.type, p.url, p.sort,
         r.rate, r.asof, r.fee, r.feeMode, r.feeVal, r.hosho, r.hoshoVal,
         r.dan, r.note, r.warn, r.source,
         DATE_FORMAT(r.base_date, '%Y-%m-%d') AS base_date
  FROM loan_product p
  JOIN loan_rate r ON r.id = p.id
  JOIN (
    SELECT id, MAX(base_date) AS base_date
    FROM loan_rate
    WHERE confirmed_at IS NOT NULL
    GROUP BY id
  ) latest ON latest.id = r.id AND latest.base_date = r.base_date
  WHERE p.active = 1
  ORDER BY p.sort, p.id`;

export const getLatestLoanRates = async (): Promise<{ asof: string; loans: LoanRateRow[] }> => {
  const rows = await query<LatestRow>(LATEST_SQL);
  const loans = rows.map((r): LoanRateRow => ({
    id: r.id,
    g: r.g,
    fi: r.fi,
    pn: r.pn,
    type: r.type,
    url: r.url ?? '',
    sort: Number(r.sort),
    // ⚠️ DECIMAL は文字列で返るので数値に戻す（計画書は数値で計算する）
    rate: Number(r.rate),
    asof: r.asof ?? '',
    fee: r.fee ?? '',
    feeMode: r.feeMode,
    feeVal: Number(r.feeVal),
    hosho: r.hosho ?? '',
    hoshoVal: Number(r.hoshoVal),
    dan: r.dan ?? '',
    note: r.note ?? '',
    warn: r.warn ?? '',
    source: r.source ?? '',
    base_date: r.base_date,
  }));
  // ⚠️ 全体の基準日は、商品の中で最も新しいもの
  const asof = loans.reduce((max, l) => (l.base_date > max ? l.base_date : max), '');
  return { asof, loans };
};

// ---------------------------------------------------------------------------
// 登録
// ---------------------------------------------------------------------------

/** ⚠️ 一度に受ける行数の上限（今は33商品。⚠️ 誤って巨大なファイルを送られたときの歯止め） */
const MAX_ROWS = 300;

/** ⚠️ 商品ID。⚠️ 英小文字・数字・_ だけ（LOANS の id と同じ形） */
const ID_PATTERN = /^[a-z0-9_]{1,64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 文字列にして前後の空白を落とし、長さで切る */
const text = (value: unknown, max: number): string =>
  String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

/** 数値。⚠️ 空・数値でないものは null（呼び出し側でエラーにする） */
const numberOrNull = (value: unknown): number | null => {
  const s = String(value ?? '').replace(/[,%％\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export interface UploadResult {
  status: 'ok' | 'error';
  message?: string;
  /** 行番号（CSV の何行目か。⚠️ 見出しを1行目として数える）→ 理由 */
  errors?: { line: number; message: string }[];
  products?: number;
  newProducts?: number;
  rates?: number;
}

interface ValidRow {
  id: string; g: string; fi: string; pn: string; type: string; url: string;
  rate: number; asof: string; fee: string; feeMode: string; feeVal: number;
  hosho: string; hoshoVal: number; dan: string; note: string; warn: string; source: string;
}

/**
 * 1行を検査する。⚠️ 画面でも同じ検査をしているが、⚠️ **サーバーでも必ず行う**（画面を通らない送信がありうる）。
 */
const validateRow = (raw: Record<string, unknown>): { row?: ValidRow; message?: string } => {
  const id = text(raw.id, 64);
  if (!ID_PATTERN.test(id)) return { message: `id が正しくありません（英小文字・数字・_ のみ）: ${id || '（空）'}` };

  const fi = text(raw.fi, 191);
  if (fi === '') return { message: '金融機関名（fi）が空です' };
  const pn = text(raw.pn, 191);
  if (pn === '') return { message: '商品名（pn）が空です' };

  const type = text(raw.type, 8) || 'v';
  if (type !== 'v' && type !== 'f') return { message: `type は v（変動）か f（固定）です: ${type}` };

  const rate = numberOrNull(raw.rate);
  // ⚠️ 0% 以下・20% 以上は打ち間違いとみなす（⚠️ 「1.75」を「175」と書いた等）
  if (rate === null || rate <= 0 || rate >= 20) return { message: `金利（rate）が正しくありません: ${String(raw.rate ?? '')}` };

  const feeMode = text(raw.feeMode, 16) || 'fixed';
  if (feeMode !== 'rate' && feeMode !== 'fixed') return { message: `feeMode は rate か fixed です: ${feeMode}` };

  const feeVal = numberOrNull(raw.feeVal) ?? 0;
  if (feeVal < 0) return { message: `feeVal が負の値です: ${feeVal}` };
  if (feeMode === 'rate' && feeVal >= 10) return { message: `feeMode=rate のとき feeVal は % です（10未満）: ${feeVal}` };

  const hoshoVal = numberOrNull(raw.hoshoVal) ?? 0;
  if (hoshoVal < 0) return { message: `hoshoVal が負の値です: ${hoshoVal}` };

  return {
    row: {
      id, fi, pn, type, rate, feeMode, feeVal, hoshoVal,
      g: text(raw.g, 64) || 'その他',
      url: text(raw.url, 255),
      asof: text(raw.asof, 16),
      fee: text(raw.fee, 191),
      hosho: text(raw.hosho, 191),
      dan: text(raw.dan, 191),
      note: text(raw.note, 2000),
      warn: text(raw.warn, 2000),
      source: text(raw.source, 191),
    },
  };
};

const orNull = (s: string): string | null => (s === '' ? null : s);

/**
 * CSV の内容を登録して確定する。
 *
 * ⚠️⚠️ **全行が正しいときだけ登録する**（1行でも誤りがあれば何も書かない）。
 *   ⚠️ 一部だけ入ると、計画書に新旧の金利が混ざる。
 *
 * ⚠️ 商品（loan_product）:
 *   ・既にある id … 区分・名前・タイプ・URL を CSV の値で更新する（⚠️ 並び順・active は変えない）
 *   ・無い id … 新規。並び順は末尾、active = 1
 *   ・⚠️ CSV に無い商品は ⚠️ **触らない**（⚠️ 前回の金利のまま計画書に出続ける）
 *
 * ⚠️ 金利（loan_rate）:
 *   ・(id, base_date) の行を作る。⚠️ ⚠️ **同じ基準日の行が既にあれば上書きする**
 *     （⚠️ 同じ日に出し直す＝訂正とみなす。⚠️ 別の日の行＝履歴は消さない）
 *   ・confirmed_at = 今、confirmed_by = 登録した人（⚠️ 登録＝確定。2026-10-06 の決定）
 */
export const uploadLoanRates = async (
  body: { base_date?: unknown; rows?: unknown },
  staffName: string
): Promise<UploadResult> => {
  const baseDate = text(body.base_date, 10);
  if (!DATE_PATTERN.test(baseDate) || Number.isNaN(Date.parse(baseDate))) {
    return { status: 'error', message: '基準日を正しく指定してください。' };
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return { status: 'error', message: 'CSV に商品の行がありません。' };
  }
  if (body.rows.length > MAX_ROWS) {
    return { status: 'error', message: `行が多すぎます（上限 ${MAX_ROWS} 行）。` };
  }

  const errors: { line: number; message: string }[] = [];
  const valid: ValidRow[] = [];
  const seen = new Set<string>();
  body.rows.forEach((raw, i) => {
    // ⚠️ 見出しが1行目なので、データの1件目は2行目
    const line = i + 2;
    if (raw === null || typeof raw !== 'object') {
      errors.push({ line, message: '行の形式が正しくありません' });
      return;
    }
    const { row, message } = validateRow(raw as Record<string, unknown>);
    if (!row) {
      errors.push({ line, message: message ?? '不明なエラー' });
      return;
    }
    if (seen.has(row.id)) {
      errors.push({ line, message: `id が重複しています: ${row.id}` });
      return;
    }
    seen.add(row.id);
    valid.push(row);
  });
  if (errors.length > 0) {
    return { status: 'error', message: `${errors.length} 行に誤りがあります。何も登録していません。`, errors };
  }

  const confirmedBy = staffName || '不明';

  return withTransaction(async (tx) => {
    interface IdRow extends RowDataPacket { id: string }
    interface MaxRow extends RowDataPacket { m: number | null }

    const existing = new Set((await tx.query<IdRow>('SELECT id FROM loan_product')).map((r) => r.id));
    const maxSort = Number((await tx.query<MaxRow>('SELECT MAX(sort) AS m FROM loan_product'))[0]?.m ?? 0);

    let nextSort = maxSort;
    let newProducts = 0;
    for (const r of valid) {
      if (existing.has(r.id)) {
        await tx.execute(
          'UPDATE loan_product SET g = ?, fi = ?, pn = ?, type = ?, url = ? WHERE id = ?',
          [r.g, r.fi, r.pn, r.type, orNull(r.url), r.id]
        );
      } else {
        nextSort += 10;
        newProducts++;
        await tx.execute(
          'INSERT INTO loan_product (id, g, fi, pn, type, url, sort, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          [r.id, r.g, r.fi, r.pn, r.type, orNull(r.url), nextSort]
        );
      }

      const params: SqlParam[] = [
        r.id, baseDate, r.rate, orNull(r.asof), orNull(r.fee), r.feeMode, r.feeVal,
        orNull(r.hosho), r.hoshoVal, orNull(r.dan), orNull(r.note), orNull(r.warn), orNull(r.source),
        confirmedBy, confirmedBy,
      ];
      await tx.execute(
        `INSERT INTO loan_rate
           (id, base_date, rate, asof, fee, feeMode, feeVal, hosho, hoshoVal, dan, note, warn, source,
            confirmed_at, confirmed_by, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
         ON DUPLICATE KEY UPDATE
           rate = VALUES(rate), asof = VALUES(asof), fee = VALUES(fee), feeMode = VALUES(feeMode),
           feeVal = VALUES(feeVal), hosho = VALUES(hosho), hoshoVal = VALUES(hoshoVal), dan = VALUES(dan),
           note = VALUES(note), warn = VALUES(warn), source = VALUES(source),
           confirmed_at = NOW(), confirmed_by = VALUES(confirmed_by)`,
        params
      );
    }

    return { status: 'ok', products: valid.length, newProducts, rates: valid.length };
  });
};
