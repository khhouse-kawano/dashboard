# 2026-10-07 ローン情報更新（CSV アップロード）とシステム管理の統合（v2.2.168）

## 依頼
- Claude Desktop で調べた CSV をアップロードする仕様にする
  - ① CSV のテンプレート
  - ② Header.tsx の改修: 店舗管理とスタッフ管理を **システム管理** に統合 → その中に **ローン情報更新** を追加 → onClick で UploadLoan.tsx を開く → size='md' のシンプルな CSV アップロード画面

## 確認した回答
- 権限: ⚠️ **Master だけ**（メニューも ② も）
- ② の API（loan_rate_upload）: ⚠️ **今回作る**（差分表示のため loan_rate_latest も）
- 登録: ⚠️ **登録＝確定**（押した人を確定者として記録）

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features/` | ⚠️ 新規 `loanRate.ts` | `getLatestLoanRates` / `uploadLoanRates` / `LOAN_CSV_COLUMNS` |
| `backend-express/src/gateway/` | `registry.ts` | `loan_rate_latest`（staff）/ `loan_rate_upload`（⚠️ master）を登録 |
| `backend/src/core/` | `express_proxy.php` | ⚠️ 2つを **転送リストと転送専用リストの両方**に追加 |
| `frontend/src/utils/` | ⚠️ 新規 `csv.ts` | `decodeCsv`（UTF-8 / Shift_JIS）/ `parseCsv` / `csvToObjects` |
| `frontend/src/components/header/` | ⚠️ 新規 `UploadLoan.tsx` | CSV アップロード画面（自前のモーダル、既定サイズ＝md） |
| `frontend/src/components/header/` | `Header.tsx` | 「システム管理」に統合、「ローン情報更新」を追加（Master のみ）、`uploadLoan` state |
| `frontend/public/templates/` | ⚠️ 新規 `loan_rate_template.csv` | テンプレート（⚠️ LOANS から機械生成。UTF-8 BOM・CRLF・33商品） |
| `frontend/public/templates/` | ⚠️ 新規 `loan_rate_instructions.md` | Claude Desktop への依頼文（⚠️ `.txt` は deploy-dashboard が送らないため `.md`） |
| `backend/scripts/sql/` | `2026-10-06_update_log_2.2.168.sql` | 文言を更新（⚠️ ローカルは UPDATE で揃え済み） |
| `docs/` | `deploy-v2.2.168.md` | ② / ① PHP / ① フロントの手順を追加 |
| `docs/oldDocument/` | 移動 | 2026-10-05 作成の docs（2日経過） |

## 設計メモ
- ⚠️ CSV の列は funding-plan の `LOANS` のキーと同じ（`id,g,fi,pn,type,rate,asof,fee,feeMode,feeVal,hosho,hoshoVal,dan,note,warn,url,source`）。
- 登録の規則（`uploadLoanRates`）:
  - ⚠️ **1行でも誤りがあれば何も書かない**（新旧の金利が混ざらないように）
  - 既存の商品は区分・名前・タイプ・URL を更新（並び順・active は変えない）。新規は末尾に追加
  - ⚠️ CSV に無い商品は触らない（前回の金利のまま）
  - `(id, base_date)` の金利行を作る。⚠️ **同じ基準日なら上書き（訂正扱い）**、別の日は履歴として残る
  - `confirmed_at = NOW()`, `confirmed_by = 登録した人`
- 検査は画面（事前の案内）と ② （⚠️ 必ず）の両方で同じ条件: id 形式、fi/pn 必須、type v|f、rate 0〜20、feeMode rate|fixed、feeVal ≥0（rate のとき 10 未満）、hoshoVal ≥0、id 重複。
- Modal の `size` に `'md'` は渡せない（react-bootstrap の型は sm/lg/xl）。⚠️ 指定しない＝既定が md 相当。

## 確認（ローカル）
- `tsc --noEmit`（② / フロント）エラーなし、`php -l express_proxy.php` 通過、build `main.1c29c380.js`。
  - ⚠️ build の Header.tsx の警告（`no-empty-pattern` 50行目 `({ })`）は ⚠️ **元からある**もの。UploadLoan.tsx / csv.ts は警告なし。
- テンプレート CSV を `csv.ts` で読み直し → ⚠️ **LOANS と 33商品 × 16項目一致**。値の中のカンマ（`"借入額×2.2% or 定額55,000円"`）も正しく読める。
- ⚠️ Shift_JIS（PowerShell で cp932 で書いたファイル）も読める。
- 認証なしで `loan_rate_latest` / `loan_rate_upload` → ⚠️ 401。
- `uploadLoanRates` をコンテナ内で直接実行:

| # | 内容 | 結果 |
|---|---|---|
| 1 | 登録前の最新 | 33商品、基準日 2026-08-20、kagin 1.6 |
| 2 | kagin を 1.65 に＋新商品1件で登録 | ok、34商品、新規1 |
| 3 | 登録後の最新 | 34商品、基準日 2026-10-06、kagin 1.65、flat35 3.29、新商品は末尾 |
| 4 | 同じ基準日で再登録 | ok、⚠️ 行数 67 → 67（上書き） |
| 5 | rate=175 と id=`MUFG!` を混ぜる | ⚠️ error「2 行に誤りがあります。何も登録していません。」、⚠️ その日の行 0 |
| 6 | id 重複 | 3行目「id が重複しています: kagin」 |
| 7 | 基準日 `2026/10/07` | error「基準日を正しく指定してください。」 |
| 8 | 確定者 | confirmed_by / created_by = 登録した人、confirmed_at 入り |

- テストの行は削除し、33 / 33（kagin 1.600）に戻した。
- ⚠️ ブラウザでの画面確認は ⚠️ **未実施**。

## コード

### backend-express/src/features/loanRate.ts（新規・全文）
```ts
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
```

### backend-express/src/gateway/registry.ts（差分）
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 5b8417f7..a38733c9 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -128,6 +128,7 @@ import { runPropertySuumo } from '../features/property';
 import { runSuumoPropertyInsert } from '../features/suumoProperty';
 import { runShopList } from '../features/shopList';
 import { runUpdateLog } from '../features/updateLog';
+import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
 import type { GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
 
@@ -2267,6 +2268,33 @@ register({
   },
 });
 
+/**
+ * 住宅ローン金利（v2.2.168）。features/loanRate.ts 参照。
+ *
+ * ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある。**
+ *   ⚠️ ① の express_proxy.php の ⚠️ **転送リストと転送専用リストの両方**に入れてある。
+ *
+ * ⚠️ 読むのは全員（⚠️ 計画書が使う）、⚠️ 登録は Master だけ（⚠️ お客様に出る金利のため）。
+ */
+register({
+  request: 'loan_rate_latest',
+  summary: '住宅ローン金利（商品ごとの最新の確定済み金利）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async () => getLatestLoanRates(),
+});
+
+register({
+  request: 'loan_rate_upload',
+  summary: '【書き込み】住宅ローン金利を CSV の内容で登録・確定する',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'master',
+  handler: async (ctx) => uploadLoanRates(
+    { base_date: ctx.body.base_date, rows: ctx.body.rows },
+    String(ctx.staff?.name ?? '')
+  ),
+});
+
 // ---------------------------------------------------------------------------
 // 反響の付帯情報の更新（同期サービス projects/sync から呼ばれる）
 //
```

### backend/src/core/express_proxy.php（差分）
```diff
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index d187ee5b..34e7d80d 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -309,6 +309,15 @@ function expressProxyRequests(): array
         'analysis_report_upload',
         'analysis_report_delete',
 
+        // -----------------------------------------------------------------
+        // 2026-10-06 新規（v2.2.168）。住宅ローン金利（loan_product / loan_rate）。
+        //
+        // ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある。**
+        //   ⚠️ ⚠️ **expressProxyExclusive() にも入れてある。片方だけにしないこと。**
+        // -----------------------------------------------------------------
+        'loan_rate_latest',
+        'loan_rate_upload',
+
         // -----------------------------------------------------------------
         // 2026-09-22 新規。SatBaseサマリー（物件台帳）。
         //
@@ -670,6 +679,15 @@ function expressProxyExclusive(): array
         'analysis_report_upload',
         'analysis_report_delete',
 
+        // -----------------------------------------------------------------
+        // 2026-10-06 新規（v2.2.168）。住宅ローン金利（loan_product / loan_rate）。
+        //
+        // ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある。**
+        //   ⚠️ ここに入れておくと ② が落ちたとき 502 になる（入れないと ① が404を返す）。
+        // -----------------------------------------------------------------
+        'loan_rate_latest',
+        'loan_rate_upload',
+
         // -----------------------------------------------------------------
         // 2026-09-22 新規。SatBaseサマリー（物件台帳）。
         //
```

### frontend/src/utils/csv.ts（新規・全文）
```ts
/**
 * CSV の読み込み（v2.2.168 新規。⚠️ ライブラリは使っていない）。
 *
 * ⚠️ 値の中のカンマ・改行・`"` に対応する（`"..."` で囲み、`"` は `""`）。
 *   ⚠️ 金利の備考（note）には読点代わりのカンマや改行が入るため、単純な split(',') では壊れる。
 */

/**
 * ファイルの中身を文字列にする。
 *
 * ⚠️ UTF-8 で読めなければ Shift_JIS として読む（⚠️ Excel で保存し直すと Shift_JIS になる）。
 * ⚠️ 先頭の BOM は落とす。
 */
export const decodeCsv = (buffer: ArrayBuffer): string => {
    let text: string;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        text = new TextDecoder('shift_jis').decode(buffer);
    }
    return text.replace(/^﻿/, '');
};

/** CSV を行 × 列の配列にする。⚠️ 空行は捨てる */
export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                field += c;
            }
            continue;
        }
        if (c === '"') {
            quoted = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            // ⚠️ CRLF は1つの改行として扱う
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            if (row.some((v) => v.trim() !== '')) rows.push(row);
            row = [];
        } else {
            field += c;
        }
    }
    row.push(field);
    if (row.some((v) => v.trim() !== '')) rows.push(row);
    return rows;
};

/**
 * 1行目を見出しとして、2行目以降を「見出し → 値」のオブジェクトにする。
 *
 * ⚠️ 見出しは前後の空白を落として照合する。⚠️ 知らない見出しの列はそのまま入る（使う側で無視する）。
 */
export const csvToObjects = (rows: string[][]): { header: string[]; records: Record<string, string>[] } => {
    const [head = [], ...body] = rows;
    const header = head.map((h) => h.trim());
    const records = body.map((cells) => {
        const record: Record<string, string> = {};
        header.forEach((h, i) => { record[h] = (cells[i] ?? '').trim(); });
        return record;
    });
    return { header, records };
};
```

### frontend/src/components/header/UploadLoan.tsx（新規・全文）
```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { csvToObjects, decodeCsv, parseCsv } from '../../utils/csv';

/**
 * ローン情報更新（v2.2.168 新規）。ヘッダーの「システム管理 → ローン情報更新」から開く。
 *
 * ─────────────────────────────────────────────
 *   Claude Desktop で調べた住宅ローン金利の CSV をアップロードし、loan_rate に登録・確定する。
 *   ⚠️ 登録＝確定（2026-10-06 の決定）。⚠️ 押した人が確定者として記録される。
 *
 *   ⚠️ ⚠️ **Master だけ**（⚠️ メニューも Master だけに出す。⚠️ ② も auth: 'master'）。
 *   ⚠️ 顧客の計画書（funding_plan.loans）は変わらない。⚠️ 変わるのは「これから作る計画書」の金利。
 *
 *   ② : backend-express/src/features/loanRate.ts（loan_rate_latest / loan_rate_upload）
 *   テンプレート: frontend/public/templates/loan_rate_template.csv
 * ─────────────────────────────────────────────
 *
 * ⚠️ 自前のモーダルを持つ（⚠️ Header の共通モーダル（xl）には載せない。二重になる）。
 * ⚠️ 大きさは react-bootstrap の既定（＝ md）。⚠️ `size` に 'md' は渡せない（型が sm / lg / xl のみ）。
 */

type Props = {
    show: boolean;
    setShow: React.Dispatch<React.SetStateAction<boolean>>;
};

/** ② の loan_rate_latest が返す1商品（⚠️ 差分の表示に使う列だけ） */
type LatestLoan = {
    id: string;
    fi: string;
    pn: string;
    rate: number;
};

type RowError = { line: number; message: string };

/** ⚠️ 必須の見出し。⚠️ 足りなければ CSV ごと受け付けない */
const REQUIRED_COLUMNS = ['id', 'fi', 'pn', 'rate'];

const ID_PATTERN = /^[a-z0-9_]{1,64}$/;

const templateUrl = (file: string) => `${process.env.PUBLIC_URL}/templates/${file}`;

/** 今日（ローカル時刻）を YYYY-MM-DD で */
const today = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 数値に。⚠️ % や カンマ が付いていても読む（② と同じ扱い） */
const toNumber = (value: string | undefined): number | null => {
    const s = String(value ?? '').replace(/[,%％\s]/g, '');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

/**
 * 1行の検査。⚠️ ② の validateRow と同じ条件（⚠️ ② でも必ず検査する。ここは事前の案内用）。
 */
const validateRecord = (r: Record<string, string>): string | null => {
    if (!ID_PATTERN.test(r.id ?? '')) return `id が正しくありません（英小文字・数字・_ のみ）: ${r.id || '（空）'}`;
    if (!r.fi) return '金融機関名（fi）が空です';
    if (!r.pn) return '商品名（pn）が空です';
    if (r.type && r.type !== 'v' && r.type !== 'f') return `type は v（変動）か f（固定）です: ${r.type}`;
    const rate = toNumber(r.rate);
    if (rate === null || rate <= 0 || rate >= 20) return `金利（rate）が正しくありません: ${r.rate ?? ''}`;
    if (r.feeMode && r.feeMode !== 'rate' && r.feeMode !== 'fixed') return `feeMode は rate か fixed です: ${r.feeMode}`;
    const feeVal = toNumber(r.feeVal) ?? 0;
    if (feeVal < 0) return `feeVal が負の値です: ${r.feeVal}`;
    if (r.feeMode === 'rate' && feeVal >= 10) return `feeMode=rate のとき feeVal は % です（10未満）: ${r.feeVal}`;
    if ((toNumber(r.hoshoVal) ?? 0) < 0) return `hoshoVal が負の値です: ${r.hoshoVal}`;
    return null;
};

const UploadLoan = ({ show, setShow }: Props) => {
    const [baseDate, setBaseDate] = useState(today);
    const [latest, setLatest] = useState<LatestLoan[]>([]);
    const [latestAsof, setLatestAsof] = useState('');
    const [fileName, setFileName] = useState('');
    const [records, setRecords] = useState<Record<string, string>[]>([]);
    const [errors, setErrors] = useState<RowError[]>([]);
    const [fileError, setFileError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const loadLatest = useCallback(async () => {
        try {
            const res = await apiClient.post('', { request: 'loan_rate_latest' });
            setLatest(res.data?.loans ?? []);
            setLatestAsof(res.data?.asof ?? '');
        } catch (error) {
            // ⚠️ 取れなくても登録はできる（⚠️ 差分が「新規」に見えるだけ）
            console.error('現在の金利の取得に失敗しました:', error);
        }
    }, []);

    // ⚠️ 開くたびに初期化する（⚠️ 前回のファイルが残っていると、誤って同じ内容を登録しかねない）
    useEffect(() => {
        if (!show) return;
        setBaseDate(today());
        setFileName('');
        setRecords([]);
        setErrors([]);
        setFileError('');
        setResult(null);
        loadLatest();
    }, [show, loadLatest]);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // ⚠️ 同じファイルを選び直しても onChange が走るように空にする
        e.target.value = '';
        if (!file) return;

        setFileName(file.name);
        setRecords([]);
        setErrors([]);
        setFileError('');
        setResult(null);

        try {
            const { header, records: parsed } = csvToObjects(parseCsv(decodeCsv(await file.arrayBuffer())));
            const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
            if (missing.length > 0) {
                setFileError(`見出しに ${missing.join('・')} がありません。テンプレートの1行目をそのまま使ってください。`);
                return;
            }
            if (parsed.length === 0) {
                setFileError('商品の行がありません。');
                return;
            }

            const found: RowError[] = [];
            const seen = new Set<string>();
            parsed.forEach((r, i) => {
                const line = i + 2;
                const message = validateRecord(r);
                if (message) found.push({ line, message });
                else if (seen.has(r.id)) found.push({ line, message: `id が重複しています: ${r.id}` });
                seen.add(r.id);
            });
            setRecords(parsed);
            setErrors(found);
        } catch (error) {
            console.error('CSV の読み込みに失敗しました:', error);
            setFileError('CSV を読み込めませんでした。ファイルの形式をご確認ください。');
        }
    };

    /** 今の金利との差（⚠️ 新規・金利が変わった・変わらない） */
    const diff = useMemo(() => {
        const byId = new Map(latest.map((l) => [l.id, l]));
        const added: Record<string, string>[] = [];
        const changed: { fi: string; pn: string; from: number; to: number }[] = [];
        let same = 0;
        records.forEach((r) => {
            const now = byId.get(r.id);
            const rate = toNumber(r.rate);
            if (!now) added.push(r);
            else if (rate !== null && Math.abs(rate - now.rate) > 1e-9) changed.push({ fi: r.fi, pn: r.pn, from: now.rate, to: rate });
            else same++;
        });
        return { added, changed, same };
    }, [records, latest]);

    const canSubmit = records.length > 0 && errors.length === 0 && !fileError && !!baseDate && !submitting;

    const submit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setResult(null);
        try {
            const res = await apiClient.post('', { request: 'loan_rate_upload', base_date: baseDate, rows: records });
            const data = res.data ?? {};
            if (data.status === 'ok') {
                setResult({ ok: true, message: `${data.rates}件の金利を登録しました（新しい商品 ${data.newProducts}件）。これから作る計画書に反映されます。` });
                setRecords([]);
                setFileName('');
                loadLatest();
            } else {
                setResult({ ok: false, message: data.message || '登録できませんでした。' });
                if (Array.isArray(data.errors)) setErrors(data.errors);
            }
        } catch (error) {
            console.error('金利の登録に失敗しました:', error);
            setResult({ ok: false, message: '登録できませんでした。時間をおいて再度お試しください。' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal show={show} onHide={() => setShow(false)} centered>
            <Modal.Header closeButton className="py-2">
                <Modal.Title style={{ fontSize: '15px' }} className="fw-bold">
                    <i className="fa-solid fa-building-columns me-2 text-primary" aria-hidden="true" />
                    ローン情報更新
                </Modal.Title>
            </Modal.Header>

            <Modal.Body style={{ fontSize: '13px' }}>
                <div className="text-muted mb-3" style={{ fontSize: '12px' }}>
                    現在の金利の基準日: <b>{latestAsof || '－'}</b>（{latest.length}商品）
                    <div className="mt-1 d-flex flex-wrap gap-3">
                        <a href={templateUrl('loan_rate_template.csv')} download>
                            <i className="fa-solid fa-file-csv me-1" aria-hidden="true" />テンプレート（CSV）
                        </a>
                        <a href={templateUrl('loan_rate_instructions.md')} download>
                            <i className="fa-solid fa-file-lines me-1" aria-hidden="true" />Claude への依頼文
                        </a>
                    </div>
                </div>

                <div className="mb-2">
                    <label className="form-label mb-1 fw-bold" htmlFor="loan_base_date" style={{ fontSize: '12px' }}>基準日</label>
                    <input
                        id="loan_base_date"
                        type="date"
                        className="form-control form-control-sm"
                        value={baseDate}
                        onChange={(e) => setBaseDate(e.target.value)}
                    />
                </div>

                <div className="mb-3">
                    <label className="form-label mb-1 fw-bold" htmlFor="loan_csv" style={{ fontSize: '12px' }}>CSV ファイル</label>
                    <input id="loan_csv" type="file" accept=".csv,text/csv" className="form-control form-control-sm" onChange={handleFile} />
                </div>

                {fileError && <div className="alert alert-danger py-2 mb-2">{fileError}</div>}

                {records.length > 0 && (
                    <div className="border rounded p-2 mb-2" style={{ background: '#f8f9fa' }}>
                        <div className="mb-1">
                            <b>{fileName}</b>：{records.length}商品
                            <span className="ms-2 text-muted">
                                新規 {diff.added.length} ／ 金利変更 {diff.changed.length} ／ 変更なし {diff.same}
                            </span>
                        </div>
                        {diff.changed.length > 0 && (
                            <ul className="mb-1 ps-3" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                {diff.changed.map((c) => (
                                    <li key={`${c.fi}/${c.pn}`}>
                                        {c.fi}　{c.from}% → <b className={c.to > c.from ? 'text-danger' : 'text-primary'}>{c.to}%</b>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {diff.added.length > 0 && (
                            <div className="text-muted">新規: {diff.added.map((a) => a.fi).join('、')}</div>
                        )}
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="alert alert-danger py-2 mb-2">
                        <div className="fw-bold mb-1">{errors.length}行に誤りがあります（直してから選び直してください）</div>
                        <ul className="mb-0 ps-3" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                            {errors.map((e) => <li key={`${e.line}/${e.message}`}>{e.line}行目: {e.message}</li>)}
                        </ul>
                    </div>
                )}

                {result && (
                    <div className={`alert ${result.ok ? 'alert-success' : 'alert-danger'} py-2 mb-0`}>{result.message}</div>
                )}
            </Modal.Body>

            <Modal.Footer className="py-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShow(false)}>閉じる</button>
                <button type="button" className="btn btn-sm btn-primary" disabled={!canSubmit} onClick={submit}>
                    {submitting ? '登録中…' : '登録して確定'}
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default UploadLoan;
```

### frontend/src/components/header/Header.tsx（差分）
```diff
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 9bb80ad4..2edf5494 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -28,10 +28,11 @@ import EventList from './EventList';
 import EventSummary from './EventSummary';
 import EventBudget from './EventBudget';
 import GoogleReview from './GoogleReview';
+import UploadLoan from './UploadLoan';
 import { useNavigate } from "react-router-dom";
 
 // 型安全のための定義
-type MenuKey = '店舗管理' | 'スタッフ管理' | '反響管理' | '土地・物件管理' | '他社動向' | '架電状況' | '日報' | '公式アンバサダー' | '紹介キャンペーン' | '集客イベント' | 'Google口コミ';
+type MenuKey = 'システム管理' | '反響管理' | '土地・物件管理' | '他社動向' | '架電状況' | '日報' | '公式アンバサダー' | '紹介キャンペーン' | '集客イベント' | 'Google口コミ';
 
 /**
  * 他社動向メニューの最後に出す項目。
@@ -69,9 +70,14 @@ const Header = ({ }) => {
      *   対応しているが、閉じる順を変えないこと。
      */
     const [eventBudget, setEventBudget] = useState<boolean>(false);
+    /**
+     * ローン情報更新（v2.2.168）。
+     * ⚠️ UploadLoan も自前のモーダル（md）を持つため、共通モーダル（xl）には載せず専用の state で開く。
+     */
+    const [uploadLoan, setUploadLoan] = useState<boolean>(false);
     const [modal, setModal] = useState<boolean>(false);
     const [callStatusShow, setCallStatusShow] = useState(true);
-    const menuArray: MenuKey[] = ['店舗管理', 'スタッフ管理', '反響管理', '土地・物件管理', '他社動向', '日報', '架電状況', '公式アンバサダー', '紹介キャンペーン', '集客イベント', 'Google口コミ'];
+    const menuArray: MenuKey[] = ['システム管理', '反響管理', '土地・物件管理', '他社動向', '日報', '架電状況', '公式アンバサダー', '紹介キャンペーン', '集客イベント', 'Google口コミ'];
     const [newEstate, setNewEstate] = useState<number | null>(0);
 
     const navigate = useNavigate();
@@ -125,8 +131,12 @@ const Header = ({ }) => {
     }, [isSp]);
 
     const menuMapping: Record<MenuKey, string[]> = {
-        '店舗管理': ['店舗編集'],
-        'スタッフ管理': ['スタッフ編集・追加', '権限編集'],
+        // ⚠️ v2.2.168 に「店舗管理」「スタッフ管理」を1つにまとめた。
+        // ⚠️ ローン情報更新は ⚠️⚠️ **Master だけ**（⚠️ お客様に出る金利を確定するため）。
+        //   ⚠️ ⚠️ **ここを外すだけでは権限は閉じない**（⚠️ ② の loan_rate_upload も auth: 'master'）。
+        'システム管理': authority === 'Master'
+            ? ['店舗編集', 'スタッフ編集・追加', '権限編集', 'ローン情報更新']
+            : ['店舗編集', 'スタッフ編集・追加', '権限編集'],
         '反響管理': authority === 'Master' ? ['販促媒体設定', 'ブラックリスト設定', '広告費シミュレーター', '事後アンケート'] : ['販促媒体設定', 'ブラックリスト設定', '事後アンケート'],
         // ⚠️⚠️ **2026-09-22 に土地情報同期・土地情報一覧をメニューから外した**（指示）。
         //   ⚠️ ⚠️ **コンポーネント（SyncEstate / Estate）は消していない。**
@@ -169,9 +179,10 @@ const Header = ({ }) => {
      *   気づきにくい（2026-09-06 にこの形へ変更した）。
      */
     const editMapping: Record<string, React.ReactNode> = {
-        'スタッフ管理/スタッフ編集・追加': <EditStaff />,
-        'スタッフ管理/権限編集': <EditAuth />,
-        '店舗管理/店舗編集': <EditShop />,
+        // ⚠️ 'システム管理/ローン情報更新' はここに入れない（⚠️ UploadLoan は自前のモーダル。下の JSX を参照）
+        'システム管理/スタッフ編集・追加': <EditStaff />,
+        'システム管理/権限編集': <EditAuth />,
+        'システム管理/店舗編集': <EditShop />,
         '反響管理/ブラックリスト設定': <EditBlackList />,
         '他社動向/他社広告ライブラリ': <MetaAdsDashboard />,
         '他社動向/他社資料': <CompetitorMaterials />,
@@ -368,6 +379,11 @@ const Header = ({ }) => {
                                             setEventBudget(true);
                                             return;
                                         }
+                                        // ⚠️ ローン情報更新も自前のモーダル（md）を持つ（v2.2.168）
+                                        if (menu === 'システム管理' && item === 'ローン情報更新') {
+                                            setUploadLoan(true);
+                                            return;
+                                        }
                                         // ⚠️ キーは `メニュー/項目`。項目名だけだと
                                         //   複数のメニューにある「反響一覧」が区別できない
                                         setEditMenu(`${menu}/${item}`);
@@ -478,6 +494,9 @@ const Header = ({ }) => {
             {/* 広告費入力。⚠️ 集客サマリーの上に重ねて開くこともあるため、
                 共通モーダルの外（ここ）に置く */}
             <EventBudget show={eventBudget} setShow={setEventBudget} />
+
+            {/* ローン情報更新（v2.2.168）。⚠️ 自前のモーダル（md）なので共通モーダルの外に置く */}
+            <UploadLoan show={uploadLoan} setShow={setUploadLoan} />
         </>
     );
 };
```

### frontend/public/templates/loan_rate_instructions.md（新規・全文）
```text
住宅ローン金利CSVの作成依頼（Claude Desktop に貼り付けて使う）
==================================================================

添付の CSV（loan_rate_template.csv）は、国分ハウジンググループの資金計画書で使う
九州の住宅ローン商品の一覧です。各商品の最新の金利・手数料などを、各金融機関の
公式サイトで調べて更新し、同じ形式の CSV で返してください。

■ 守ってほしいこと
1. 列の並びと見出し（1行目）は変えないこと。
2. id は変えないこと（商品を見分ける鍵です）。新しい商品を足すときだけ、
   英小文字・数字・_ で新しい id を付けてください（例: kagin_fix10）。
3. 調べても分からなかった値は、推測で埋めずに元の値のままにし、
   warn 列に「最新は公式要確認」と書いてください。
4. 数値の列（rate / feeVal / hoshoVal）は数字だけにしてください（% や 円 や カンマを付けない）。
5. 値にカンマや改行が入るときは、その値全体を " で囲んでください。
6. 出力は CSV だけにしてください（前後に説明文を付けない）。

■ 各列の意味
id        商品ID（変えない）
g         区分（鹿児島 / 九州の地銀 / 福岡・佐賀・長崎 / 労金・JA / ネット銀行 / メガ・フラット35）
fi        金融機関名（例: 鹿児島銀行）
pn        商品名（例: 住宅ローン（変動））
type      金利タイプ。v = 変動 / f = 固定
rate      適用金利（%）。例: 0.875  ※最も条件の良い優遇後の金利
asof      金融機関側の適用月。例: 2026/10
fee       事務手数料の表記（例: 借入額×2.2%  / 55,000円）
feeMode   事務手数料の計算方法。rate = 借入額×feeVal% / fixed = feeVal 円
feeVal    事務手数料の値（feeMode が rate なら %、fixed なら 円）
hosho     保証料の表記（例: 0円（手数料型））
hoshoVal  保証料（円）。分からなければ 0
dan       団信の表記（例: 一般団信無料・がん団信+0.1%）
note      備考（優遇条件・改定の予定など）
warn      注意書き（画面で目立たせたいこと）
url       公式サイトのURL
source    出典（例: 鹿児島銀行公式サイト（2026年10月1日時点））

■ 返してもらった CSV の使い方
Dashboard の「システム管理 → ローン情報更新」で基準日を選び、CSV をアップロードします。
アップロード前に、金利が変わった商品と誤りのある行が画面に表示されます。
```

### テンプレートの生成スクリプト（scratchpad/gen_template.js。リポジトリには入れていない）
```js
// funding-plan/index.html の LOANS から CSV テンプレートを作る（UTF-8 BOM 付き・CRLF）
const fs = require('fs');
const [htmlPath, outPath] = process.argv.slice(2);
const src = fs.readFileSync(htmlPath, 'utf8').replace(/\r\n/g, '\n');
const s = src.indexOf('var LOANS = [');
const e = src.indexOf('\n];', s);
const LOANS = Function('return ' + src.slice(src.indexOf('[', s), e + 2))();
const SOURCE = src.match(/var LN_SOURCE_DEFAULT = "([^"]+)";/)[1];

// ⚠️ backend-express/src/features/loanRate.ts の LOAN_CSV_COLUMNS と同じ順
const COLUMNS = ['id', 'g', 'fi', 'pn', 'type', 'rate', 'asof', 'fee', 'feeMode', 'feeVal',
  'hosho', 'hoshoVal', 'dan', 'note', 'warn', 'url', 'source'];

const cell = (v) => {
  const t = v === undefined || v === null ? '' : String(v);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const lines = [COLUMNS.join(',')];
for (const p of LOANS) lines.push(COLUMNS.map((c) => cell(c === 'source' ? SOURCE : p[c])).join(','));
fs.writeFileSync(outPath, '﻿' + lines.join('\r\n') + '\r\n');
console.log('rows', LOANS.length);
```
