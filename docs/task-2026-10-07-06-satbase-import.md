# 2026-10-07 SatBaseサマリーに「物件更新」（CSV で satbase_property を更新）を追加（v2.2.170）

## 依頼（ReadMeClaude.md）
- `frontend/src/components/header/SatbaseDatabase.tsx`（実ファイル名は `SatBaseDatabase.tsx`）に CSV アップロード機能を追加
- 上部コントロールの **表示項目** の右隣に **物件更新** を追加 → satbase_property を更新する CSV をアップロード、property_id で突合して更新

## 決定事項（2026-10-07 にユーザー確認）
| 論点 | 決定 |
|---|---|
| DB に無い物件ID（10/7 の CSV に10件） | **追加する**（property_id で突合、あれば更新・無ければ追加） |
| CSV の空欄 | **空（NULL）で上書きする**（SatBase 側が正） |
| 使える人 | **Master のみ**（ボタンも ② も） |
| 流れ | **確認してから更新**（dryRun で件数 → 「更新する」で反映） |
- CSV に無い物件は消さない。`satbase_property_flag`（広告出稿・Instagram のトグル）には触らない

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features` | **satbase.ts** | `IMPORT_COLUMNS` / `normalizeDate` / `toCell` / `same` / **`runSatbaseImport`** を追加。import に `withTransaction` / `SqlParam` |
| `backend-express/src/gateway` | **registry.ts** | `satbase_import`（auth: master）を登録 |
| `backend/src/core` | **express_proxy.php** | `expressProxyRequests()` と `expressProxyExclusive()` の両方に `satbase_import` |
| `frontend/src/components/header` | **SatBaseImport.tsx（新規）** | 物件更新モーダル（md） |
| `frontend/src/components/header` | **SatBaseDatabase.tsx** | Master だけに「物件更新」ボタン。一覧の取得を `loadProperties`（useCallback）に出し、反映後に再取得 |
| `frontend/src/utils` | version.ts | `2.2.170` |
| `backend/scripts/sql` | 2026-10-07_update_log_2.2.170.sql | update_log（ローカル no=266 投入済み） |

## CSV の形
- SatBase「KHF物件管理【KHG】 - 中間加工（物件）」の出力そのまま。**38列・位置で読む**（列順は `IMPORT_COLUMNS`）
- **見出し行は有ったり無かったりする**（9/29 出力は有り、10/7 出力は無し）→ 画面で1行目の先頭が数字でなければ見出しとして飛ばす
- UTF-8 / Shift_JIS どちらでも可（`utils/csv.ts` の `decodeCsv`）
- 日付は `2017/11/25` と `2017-11-25` が混在 → `YYYY-MM-DD` にそろえる。数値はカンマ・円記号を落として読む
- 1行でも不正（列数・物件IDなし/重複・日付/数値でない・文字数超過）があれば **何も書かない**（エラーは最大50件返す）

## 確認（ローカル。⚠️ satbase の2表は事前に mariadb-dump で退避し、テスト後に戻した）
| ケース | 結果 |
|---|---|
| 9/29 CSV（見出しあり）dryRun | 1,918件：追加0・更新1,918。書き込みなし |
| 10/7 CSV（見出しなし）dryRun | 1,928件：**追加10**・更新1,918 |
| 不正4行（存在しない日付・`1,980万`・ID重複・30列） | error、4行のエラー、**件数・トグル変化なし** |
| 10/7 CSV 反映 | 1,919 → **1,929件**、439ms。トグル（ad/ig）は変化なし |
| 反映後に同じ CSV を dryRun | 変更なし 1,928 |
| 物件1956（新規） | 着工前／販売中で入った |
- ② 起動ログに `👑 satbase_import`（Master）。フロントは `npm run build` 成功（変更ファイルに警告なし）
- ⚠️ ブラウザでの操作確認は未実施

## ⚠️ 気づいたこと（実データ）
- **初回の取り込みは全行が「更新」になる。** 現在の表は phpMyAdmin の CSV 取り込みで入れたため、空欄が `''`・日付の空が `0000-00-00`・工程表作成済みの空が `0` で入っている。この機能は空欄を NULL で入れるので、初回は 決済日（仕入）・契約日（仕入）・位置情報 などが全行「変わる項目」に出る（画面上は `0000-00-00` が空欄になる）
- **チーム（係）は DB 側が全件空**で、CSV（10/7）には約800件に値がある（鹿児島三係・宮崎係 等）→ 初回で入る
- **property_id = 0 の行が1件ある**（見出し行が取り込まれたもの。位置情報=「位置情報」、チーム=「チーム（係）」）。CSV に無いので残る。消すなら `DELETE FROM satbase_property WHERE property_id = 0;`（⚠️ 未実行・要判断）

---

## コード全文

### backend-express/src/features/satbase.ts（追加部分）
```ts
// ---------------------------------------------------------------------------
// 物件更新（CSV 取り込み）。v2.2.170 新規。
//
// ─────────────────────────────────────────────
// ⚠️ SatBase の「KHF物件管理【KHG】 - 中間加工（物件）」の CSV で satbase_property を更新する。
//   ⚠️ ⚠️ **property_id で突き合わせ、あれば更新・無ければ追加**（2026-10-08 の決定）。
//   ⚠️ ⚠️ **CSV に無い物件は消さない**（⚠️ 残したまま）。
//   ⚠️ ⚠️ **空欄は NULL で上書きする**（⚠️ SatBase 側が正。2026-10-08 の決定）。
//   ⚠️ ⚠️ **`satbase_property_flag`（画面のトグル）には触らない。**
//
// ⚠️ Master だけ（⚠️ registry の auth: 'master'。⚠️ 画面のボタンも Master だけに出す）。
//
// ⚠️⚠️ **列は「位置」で読む。** ⚠️ SatBase の出力は見出し行が付くときと付かないときがある
//   （9/29 の出力は見出しあり、10/7 は無し）。⚠️ 見出しの有無は画面側で判定して、⚠️ **データ行だけ送る。**
//   ⚠️ ⚠️ **並びは下の IMPORT_COLUMNS と同じ 38 列。** ⚠️ SatBase 側で列が増減したらここを直すこと。
//
// ⚠️ 1行でも不正があれば ⚠️ **何も書かない**（⚠️ 一部だけ入ると、どこまで入ったか分からなくなる）。
// ⚠️ `dryRun: true` のときは書かずに件数だけ返す（⚠️ 画面の確認ステップ）。
// ─────────────────────────────────────────────

type ImportKind = 'int' | 'date' | 'text';

interface ImportColumn {
  key: string;
  /** CSV の見出し（⚠️ エラー表示に使う。⚠️ 画面の見出し判定は SatBaseImport.tsx 側） */
  label: string;
  kind: ImportKind;
  /** text の最大文字数（⚠️ DB の varchar と同じ） */
  max?: number;
}

/** ⚠️⚠️ **CSV の列順そのまま。** ⚠️ 入れ替えないこと */
export const IMPORT_COLUMNS: readonly ImportColumn[] = [
  { key: 'property_id', label: '物件ID', kind: 'int' },
  { key: 'property_name', label: '物件名称', kind: 'text', max: 128 },
  { key: 'usage_type', label: '用途', kind: 'int' },
  { key: 'customer_name', label: 'お客様名', kind: 'text', max: 128 },
  { key: 'contract_staff', label: '契約担当', kind: 'text', max: 64 },
  { key: 'progress_status', label: '工程状況', kind: 'text', max: 32 },
  { key: 'sales_status', label: '販売状況', kind: 'text', max: 32 },
  { key: 'area', label: 'エリア', kind: 'text', max: 64 },
  { key: 'site_staff', label: '現場管理/営業担当', kind: 'text', max: 64 },
  { key: 'design_staff', label: '設計', kind: 'text', max: 64 },
  { key: 'construction_staff', label: '施工管理', kind: 'text', max: 64 },
  { key: 'foundation_start_date', label: '基礎着工日', kind: 'date' },
  { key: 'completion_date', label: '完工日', kind: 'date' },
  { key: 'exterior_completion_date', label: '外構完了', kind: 'date' },
  { key: 'payment_date', label: '入金日', kind: 'date' },
  { key: 'delivery_date', label: '引渡日', kind: 'date' },
  { key: 'land_cost', label: '内土地代', kind: 'int' },
  { key: 'sales_price', label: '販売価格', kind: 'int' },
  { key: 'contract_recorded_date', label: '契約計上日', kind: 'date' },
  { key: 'land_id', label: '土地ID', kind: 'int' },
  { key: 'permit_date', label: '確認許可日', kind: 'date' },
  { key: 'property_id_general', label: '物件ID（一般）', kind: 'int' },
  { key: 'plan', label: 'プラン', kind: 'text', max: 32 },
  { key: 'ground_improvement', label: '地盤改良', kind: 'int' },
  { key: 'price_changed_date', label: '販売価格変更日', kind: 'date' },
  { key: 'previous_sales_price', label: '変更前販売価格', kind: 'int' },
  { key: 'desired_start_date', label: '着工希望日', kind: 'date' },
  { key: 'purchase_settlement_date', label: '決済日（仕入）', kind: 'date' },
  { key: 'purchase_contract_date', label: '契約日（仕入）', kind: 'date' },
  { key: 'lat_lng', label: '位置情報', kind: 'text', max: 64 },
  { key: 'property_id_manager', label: 'ID（管理職）', kind: 'int' },
  { key: 'spec', label: '仕様', kind: 'text', max: 32 },
  { key: 'prefecture', label: '県', kind: 'text', max: 32 },
  { key: 'sales_period', label: '販売期間', kind: 'text', max: 16 },
  { key: 'portal_posted_date', label: 'ポータル掲載日', kind: 'date' },
  { key: 'kaeru_hp_posted_date', label: 'かえるHP掲載', kind: 'date' },
  { key: 'schedule_created', label: '工程表作成済み', kind: 'int' },
  { key: 'team', label: 'チーム（係）', kind: 'text', max: 32 },
];

/** ⚠️ 1回に受け付ける行数の上限（⚠️ 実データは 1,930 行前後。⚠️ 桁違いの送信を弾く） */
const IMPORT_MAX_ROWS = 10_000;

/** ⚠️ 1回の INSERT に入れる行数（⚠️ 38列 × 200行 = 7,600 個のプレースホルダ） */
const IMPORT_CHUNK = 200;

/** ⚠️ 返すエラーの上限（⚠️ 全行エラーのときに応答が膨らまないように） */
const IMPORT_MAX_ERRORS = 50;

/** INT(11) の範囲 */
const INT_MAX = 2_147_483_647;

type CellValue = string | number | null;

interface ImportError {
  /** ⚠️ 画面が数えた CSV の行番号（⚠️ 見出し行を含めた数え方） */
  line: number;
  message: string;
}

export interface SatbaseImportInput {
  rows: unknown;
  /** ⚠️ 各行の CSV 上の行番号（⚠️ 無ければ 1 始まりの連番で数える） */
  lines?: unknown;
  dryRun: boolean;
}

export interface SatbaseImportResult {
  status: 'ok' | 'error';
  message?: string;
  errors?: ImportError[];
  dryRun?: boolean;
  total?: number;
  inserted?: number;
  updated?: number;
  unchanged?: number;
  /** ⚠️ 変わる列ごとの件数（⚠️ 確認画面で「何が変わるか」を見せる） */
  changedColumns?: { label: string; count: number }[];
}

/** `2017/1/5` / `2017-01-05` → `2017-01-05`。⚠️ 実在しない日付は null */
const normalizeDate = (raw: string): string | null => {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/**
 * 1セルを DB に入れる値にする。
 *
 * ⚠️ 空欄は null（⚠️ 上書きで消す。決定どおり）。
 * ⚠️ 数値はカンマ・円記号を落として読む（⚠️ Excel で開き直すと付くことがある）。
 */
const toCell = (column: ImportColumn, raw: unknown): { value: CellValue } | { error: string } => {
  const text = String(raw ?? '').trim();
  if (text === '') return { value: null };

  if (column.kind === 'int') {
    const cleaned = text.replace(/[,，¥￥円\s]/g, '');
    if (!/^-?\d+$/.test(cleaned)) return { error: `${column.label}が数値ではありません（${text.slice(0, 20)}）` };
    const n = Number(cleaned);
    if (Math.abs(n) > INT_MAX) return { error: `${column.label}が大きすぎます（${text.slice(0, 20)}）` };
    return { value: n };
  }

  if (column.kind === 'date') {
    const date = normalizeDate(text);
    return date === null ? { error: `${column.label}が日付ではありません（${text.slice(0, 20)}）` } : { value: date };
  }

  if (column.max !== undefined && [...text].length > column.max) {
    return { error: `${column.label}が長すぎます（${column.max}文字まで）` };
  }
  return { value: text };
};

/** ⚠️ 比べるために値をそろえる（⚠️ DB の数値と CSV の数値、null と null を同じに見る） */
const same = (a: unknown, b: CellValue): boolean =>
  (a === null || a === undefined ? null : String(a)) === (b === null ? null : String(b));

/**
 * 物件更新（CSV 取り込み）。
 *
 * ⚠️ 流れ: 検証 → 今の値と比較（件数）→ ⚠️ dryRun ならここで返す → ⚠️ トランザクションで一括反映。
 */
export const runSatbaseImport = async (input: SatbaseImportInput): Promise<SatbaseImportResult> => {
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { status: 'error', message: 'CSV にデータ行がありません。' };
  }
  if (input.rows.length > IMPORT_MAX_ROWS) {
    return { status: 'error', message: `一度に取り込めるのは ${IMPORT_MAX_ROWS.toLocaleString()} 行までです。` };
  }
  const lines: unknown[] = Array.isArray(input.lines) ? input.lines : [];

  // --- 検証 -------------------------------------------------------------
  const errors: ImportError[] = [];
  const records: CellValue[][] = [];
  const seen = new Map<number, number>();

  (input.rows as unknown[]).forEach((row, index) => {
    const line = Number.isInteger(lines[index]) ? Number(lines[index]) : index + 1;
    if (!Array.isArray(row)) {
      errors.push({ line, message: '行の形式が正しくありません。' });
      return;
    }
    if (row.length !== IMPORT_COLUMNS.length) {
      errors.push({
        line,
        message: `列の数が ${row.length} です（${IMPORT_COLUMNS.length} 列のはず）。SatBase の出力をそのまま使ってください。`,
      });
      return;
    }

    const values: CellValue[] = [];
    for (let i = 0; i < IMPORT_COLUMNS.length; i++) {
      const cell = toCell(IMPORT_COLUMNS[i], row[i]);
      if ('error' in cell) {
        errors.push({ line, message: cell.error });
        return;
      }
      values.push(cell.value);
    }

    const id = values[0];
    if (typeof id !== 'number' || id <= 0) {
      errors.push({ line, message: '物件IDがありません。' });
      return;
    }
    const firstLine = seen.get(id);
    if (firstLine !== undefined) {
      errors.push({ line, message: `物件ID ${id} が ${firstLine} 行目と重複しています。` });
      return;
    }
    seen.set(id, line);
    records.push(values);
  });

  if (errors.length > 0) {
    return {
      status: 'error',
      message: `${errors.length.toLocaleString()} 行に問題があるため、取り込みませんでした。`,
      errors: errors.slice(0, IMPORT_MAX_ERRORS),
    };
  }

  // --- 今の値と比較 ------------------------------------------------------
  // ⚠️ 列名は IMPORT_COLUMNS（固定）から作る。⚠️ 外から来た値は SQL に入らない
  const columnList = IMPORT_COLUMNS.map((c) => `\`${c.key}\``).join(', ');
  const current = await query<DynamicRow>(`SELECT ${columnList} FROM satbase_property`);
  const byId = new Map<number, DynamicRow>(current.map((r) => [Number(r.property_id), r]));

  let inserted = 0;
  let updated = 0;
  const changedCount = new Map<string, number>();
  const toWrite: CellValue[][] = [];

  for (const values of records) {
    const before = byId.get(Number(values[0]));
    if (before === undefined) {
      inserted++;
      toWrite.push(values);
      continue;
    }
    let changed = false;
    IMPORT_COLUMNS.forEach((c, i) => {
      if (!same(before[c.key], values[i])) {
        changed = true;
        changedCount.set(c.label, (changedCount.get(c.label) ?? 0) + 1);
      }
    });
    if (changed) {
      updated++;
      toWrite.push(values);
    }
  }

  const summary = {
    total: records.length,
    inserted,
    updated,
    unchanged: records.length - inserted - updated,
    changedColumns: [...changedCount.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  };

  if (input.dryRun) {
    return { status: 'ok', dryRun: true, ...summary };
  }

  // --- 反映 --------------------------------------------------------------
  // ⚠️ 変わる行だけ書く（⚠️ 変更なしの行は触らない）
  if (toWrite.length > 0) {
    const updates = IMPORT_COLUMNS.slice(1)
      .map((c) => `\`${c.key}\` = VALUES(\`${c.key}\`)`)
      .join(', ');
    const placeholders = `(${IMPORT_COLUMNS.map(() => '?').join(', ')})`;

    await withTransaction(async (tx) => {
      for (let i = 0; i < toWrite.length; i += IMPORT_CHUNK) {
        const chunk = toWrite.slice(i, i + IMPORT_CHUNK);
        await tx.execute(
          `INSERT INTO satbase_property (${columnList})
           VALUES ${chunk.map(() => placeholders).join(', ')}
           ON DUPLICATE KEY UPDATE ${updates}`,
          chunk.flat() as SqlParam[]
        );
      }
    });
  }

  return { status: 'ok', dryRun: false, ...summary };
};
```

### backend-express/src/gateway/registry.ts（追加部分。import に `runSatbaseImport` を追加）
```ts
// ⚠️ 物件更新（CSV 取り込み）。v2.2.170 新規。⚠️ **Master だけ**（台帳を丸ごと書き換えるため）。
//   ⚠️ `dryRun: true` は件数を返すだけ（⚠️ 書かない）。
register({
  request: 'satbase_import',
  summary: '【書き込み】SatBase の CSV で物件台帳（satbase_property）を更新・追加する',
  phpSource: '（新規。PHP版なし）',
  auth: 'master',
  handler: async (ctx) =>
    runSatbaseImport({
      rows: ctx.body.rows,
      lines: ctx.body.lines,
      dryRun: ctx.body.dryRun === true,
    }),
});
```

### frontend/src/components/header/SatBaseImport.tsx（新規・全文）
```tsx
import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { decodeCsv, parseCsv } from '../../utils/csv';

/**
 * 物件更新（v2.2.170 新規）。SatBaseサマリー（SatBaseDatabase.tsx）の「物件更新」から開く。
 *
 * ─────────────────────────────────────────────
 *   SatBase の「KHF物件管理【KHG】 - 中間加工（物件）」の CSV で satbase_property を更新する。
 *   ⚠️ 物件ID で突き合わせ、⚠️ **あれば更新・無ければ追加**。⚠️ CSV に無い物件は消さない。
 *   ⚠️ 空欄は空で上書き（⚠️ SatBase 側が正）。⚠️ 広告出稿・Instagram のトグルは変わらない。
 *
 *   ⚠️ ⚠️ **Master だけ**（⚠️ ボタンも Master だけに出す。⚠️ ② も auth: 'master'）。
 *
 *   ⚠️ 流れ: ファイルを選ぶ → ⚠️ ② に `dryRun: true` で送って件数を受け取る（⚠️ 書かない）
 *           → 「更新する」で ⚠️ 同じ行をもう一度送って反映。
 *
 *   ② : backend-express/src/features/satbase.ts（satbase_import）
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **見出し行は付くときと付かないときがある**（9/29 の出力は付き、10/7 は無し）。
 *   ⚠️ 1行目の先頭が数字でなければ見出しとみなして飛ばす。⚠️ 列は位置で読む（② の IMPORT_COLUMNS）。
 *
 * ⚠️ 大きさは react-bootstrap の既定（＝ md）。
 */

type Props = {
    show: boolean;
    setShow: React.Dispatch<React.SetStateAction<boolean>>;
    /** ⚠️ 反映したあと一覧を取り直す（⚠️ SatBaseDatabase.tsx が渡す） */
    onImported: () => void;
};

type RowError = { line: number; message: string };

type Summary = {
    total: number;
    inserted: number;
    updated: number;
    unchanged: number;
    changedColumns: { label: string; count: number }[];
};

/** ⚠️ SatBase の出力の列数（⚠️ ② の IMPORT_COLUMNS と同じ） */
const COLUMN_COUNT = 38;

const SatBaseImport = ({ show, setShow, onImported }: Props) => {
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<string[][]>([]);
    const [lines, setLines] = useState<number[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [errors, setErrors] = useState<RowError[]>([]);
    const [fileError, setFileError] = useState('');
    const [busy, setBusy] = useState<'' | 'check' | 'apply'>('');
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    // ⚠️ 開くたびに初期化する（⚠️ 前回のファイルが残っていると、誤って同じ内容を反映しかねない）
    useEffect(() => {
        if (!show) return;
        setFileName('');
        setRows([]);
        setLines([]);
        setSummary(null);
        setErrors([]);
        setFileError('');
        setResult(null);
    }, [show]);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // ⚠️ 同じファイルを選び直しても onChange が走るように空にする
        e.target.value = '';
        if (!file) return;

        setFileName(file.name);
        setRows([]);
        setLines([]);
        setSummary(null);
        setErrors([]);
        setFileError('');
        setResult(null);

        let parsed: string[][];
        try {
            parsed = parseCsv(decodeCsv(await file.arrayBuffer()));
        } catch (error) {
            console.error('CSV の読み込みに失敗しました:', error);
            setFileError('CSV を読み込めませんでした。ファイルの形式をご確認ください。');
            return;
        }

        // ⚠️ 1行目の先頭が数字でなければ見出し
        const hasHeader = parsed.length > 0 && !/^\d+$/.test(String(parsed[0][0] ?? '').trim());
        const data = hasHeader ? parsed.slice(1) : parsed;
        if (data.length === 0) {
            setFileError('物件の行がありません。');
            return;
        }
        if (data[0].length !== COLUMN_COUNT) {
            setFileError(`列の数が ${data[0].length} です（SatBase の出力は ${COLUMN_COUNT} 列）。SatBase から出力した CSV をそのまま選んでください。`);
            return;
        }
        // ⚠️ 行番号は見出しを含めて数える（⚠️ Excel で開いたときの行番号に合わせる。⚠️ 空行は数えていない）
        const lineNumbers = data.map((_, i) => i + (hasHeader ? 2 : 1));
        setRows(data);
        setLines(lineNumbers);

        // ⚠️ 確認（⚠️ 書かない）
        setBusy('check');
        try {
            const res = await apiClient.post('', { request: 'satbase_import', rows: data, lines: lineNumbers, dryRun: true });
            const body = res.data ?? {};
            if (body.status === 'ok') {
                setSummary(body as Summary);
            } else {
                setFileError(body.message || '確認できませんでした。');
                if (Array.isArray(body.errors)) setErrors(body.errors);
                setRows([]);
            }
        } catch (error) {
            console.error('物件更新の確認に失敗しました:', error);
            setFileError('確認できませんでした。時間をおいて再度お試しください。');
            setRows([]);
        } finally {
            setBusy('');
        }
    };

    const changes = summary ? summary.inserted + summary.updated : 0;
    const canApply = summary !== null && changes > 0 && rows.length > 0 && busy === '';

    const apply = async () => {
        if (!canApply) return;
        setBusy('apply');
        setResult(null);
        try {
            const res = await apiClient.post('', { request: 'satbase_import', rows, lines, dryRun: false });
            const body = res.data ?? {};
            if (body.status === 'ok') {
                setResult({ ok: true, message: `更新 ${body.updated}件・追加 ${body.inserted}件を反映しました。` });
                setRows([]);
                setSummary(null);
                setFileName('');
                onImported();
            } else {
                setResult({ ok: false, message: body.message || '反映できませんでした。' });
                if (Array.isArray(body.errors)) setErrors(body.errors);
            }
        } catch (error) {
            console.error('物件更新に失敗しました:', error);
            setResult({ ok: false, message: '反映できませんでした。時間をおいて再度お試しください。' });
        } finally {
            setBusy('');
        }
    };

    return (
        <Modal show={show} onHide={() => setShow(false)} centered>
            <Modal.Header closeButton className="py-2">
                <Modal.Title style={{ fontSize: '15px' }} className="fw-bold">
                    <i className="fa-solid fa-file-csv me-2 text-primary" aria-hidden="true" />
                    物件更新
                </Modal.Title>
            </Modal.Header>

            <Modal.Body style={{ fontSize: '13px' }}>
                <div className="text-muted mb-3" style={{ fontSize: '12px' }}>
                    SatBase から出力した「中間加工（物件）」の CSV を選んでください。物件ID で突き合わせて、
                    登録済みの物件は更新、まだ無い物件は追加します。CSV に無い物件はそのまま残ります。
                    空欄の項目は空で上書きされます。広告出稿・Instagram の状況は変わりません。
                </div>

                <div className="mb-3">
                    <label className="form-label mb-1 fw-bold" htmlFor="satbase_csv" style={{ fontSize: '12px' }}>CSV ファイル</label>
                    <input
                        id="satbase_csv"
                        type="file"
                        accept=".csv,text/csv"
                        className="form-control form-control-sm"
                        onChange={handleFile}
                        disabled={busy !== ''}
                    />
                </div>

                {busy === 'check' && <div className="text-muted mb-2">内容を確認しています…</div>}

                {fileError && <div className="alert alert-danger py-2 mb-2">{fileError}</div>}

                {summary && (
                    <div className="border rounded p-2 mb-2" style={{ background: '#f8f9fa' }}>
                        <div className="mb-1">
                            <b>{fileName}</b>：{summary.total.toLocaleString()}件
                        </div>
                        <div className="mb-1">
                            更新 <b>{summary.updated.toLocaleString()}</b>件 ／ 追加 <b>{summary.inserted.toLocaleString()}</b>件 ／
                            <span className="text-muted"> 変更なし {summary.unchanged.toLocaleString()}件</span>
                        </div>
                        {summary.changedColumns.length > 0 && (
                            <div className="text-muted" style={{ fontSize: '12px' }}>
                                変わる項目: {summary.changedColumns.map((c) => `${c.label}（${c.count}）`).join('、')}
                            </div>
                        )}
                        {changes === 0 && <div className="text-muted mt-1">反映する変更はありません。</div>}
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="alert alert-danger py-2 mb-2">
                        <div className="fw-bold mb-1">誤りのある行（直してから選び直してください）</div>
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
                <button type="button" className="btn btn-sm btn-primary" disabled={!canApply} onClick={apply}>
                    {busy === 'apply' ? '更新中…' : '更新する'}
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default SatBaseImport;
```

### SatBaseDatabase.tsx / express_proxy.php（差分）
```diff
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 34e7d80d..fe6088f0 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -326,6 +326,8 @@ function expressProxyRequests(): array
         // -----------------------------------------------------------------
         'satbase_list',
         'satbase_update',
+        // ⚠️ v2.2.170 新規。物件更新（CSV 取り込み）。⚠️ Master だけ（② の auth: 'master'）
+        'satbase_import',
 
         // -----------------------------------------------------------------
         // 2026-09-16 移植。キャンペーン別集計（参照のみ）。
@@ -696,6 +698,8 @@ function expressProxyExclusive(): array
         // -----------------------------------------------------------------
         'satbase_list',
         'satbase_update',
+        // ⚠️ v2.2.170 新規。物件更新（CSV 取り込み）。⚠️ Master だけ（② の auth: 'master'）
+        'satbase_import',
 
         // -----------------------------------------------------------------
         // 2026-10-01 新規。アンバサダー台帳のKPI（歩留まり）。
diff --git a/frontend/src/components/header/SatBaseDatabase.tsx b/frontend/src/components/header/SatBaseDatabase.tsx
index 48e08dee..bf42251f 100644
--- a/frontend/src/components/header/SatBaseDatabase.tsx
+++ b/frontend/src/components/header/SatBaseDatabase.tsx
@@ -1,5 +1,7 @@
-import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
+import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
 import apiClient from '../../utils/apiClient';
+import AuthContext from '../../context/AuthContext';
+import SatBaseImport from './SatBaseImport';
 
 /**
  * SatBaseサマリー（ヘッダー → 土地・物件管理 → SatBaseサマリー）。
@@ -19,6 +21,9 @@ import apiClient from '../../utils/apiClient';
  *     ⚠️ **スクロールに合わせて30行ずつ描画する**（下の `visibleCount`）。
  *     ⚠️ ページ送りにしなかったのは、⚠️ **絞り込みながら上から眺める使い方**のため。
  *
+ * ⚠️ v2.2.170: 「表示項目」の右に ⚠️ **「物件更新」（CSV で台帳を更新）** を追加。⚠️ **Master だけ**に出す。
+ *   ⚠️ 中身は SatBaseImport.tsx。⚠️ 反映したら一覧を取り直す（`loadProperties`）。
+ *
  * ⚠️ 表が横に広いので Header.tsx の `isFullscreenMenu` に入れてある。
  *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出す。ここに実装しないこと。**
  * ─────────────────────────────────────────────
@@ -131,6 +136,10 @@ const formatValue = (column: Column, value: string | number | null): string => {
 };
 
 const SatBaseDatabase = () => {
+    const { authority } = useContext(AuthContext);
+    const isMaster = authority === 'Master';
+    const [importOpen, setImportOpen] = useState(false);
+
     const [properties, setProperties] = useState<Property[]>([]);
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState('');
@@ -158,29 +167,31 @@ const SatBaseDatabase = () => {
     const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
     const sentinel = useRef<HTMLDivElement | null>(null);
 
-    useEffect(() => {
-        const fetchData = async () => {
-            try {
-                const res = await apiClient.post('', { request: 'satbase_list' });
-                const rows = (res.data?.properties ?? []) as Property[];
-                /**
-                 * ⚠️ サーバーも `ORDER BY property_id DESC` で返しているが、
-                 *   ⚠️ **画面側でも数値として並べ直す**（指示）。
-                 *   ⚠️ ⚠️ **文字列のまま並べると 999 が 1000 より後ろに来る。**
-                 */
-                rows.sort((a, b) => Number(b.property_id) - Number(a.property_id));
-                setProperties(rows);
-                setError('');
-            } catch (e) {
-                console.error(e);
-                setError('物件データを取得できませんでした。時間をおいて再度お試しください。');
-            } finally {
-                setLoading(false);
-            }
-        };
-        void fetchData();
+    /** ⚠️ v2.2.170: 物件更新のあとにも呼ぶので useEffect の外に出した（⚠️ 中身は従来どおり） */
+    const loadProperties = useCallback(async () => {
+        try {
+            const res = await apiClient.post('', { request: 'satbase_list' });
+            const rows = (res.data?.properties ?? []) as Property[];
+            /**
+             * ⚠️ サーバーも `ORDER BY property_id DESC` で返しているが、
+             *   ⚠️ **画面側でも数値として並べ直す**（指示）。
+             *   ⚠️ ⚠️ **文字列のまま並べると 999 が 1000 より後ろに来る。**
+             */
+            rows.sort((a, b) => Number(b.property_id) - Number(a.property_id));
+            setProperties(rows);
+            setError('');
+        } catch (e) {
+            console.error(e);
+            setError('物件データを取得できませんでした。時間をおいて再度お試しください。');
+        } finally {
+            setLoading(false);
+        }
     }, []);
 
+    useEffect(() => {
+        void loadProperties();
+    }, [loadProperties]);
+
     /** 絞り込みの選択肢は実データから作る（⚠️ 直書きにすると実態とずれる） */
     const optionsOf = useCallback((key: string): string[] =>
         [...new Set(properties.map(p => String(p[key] ?? '')).filter(v => v !== ''))].sort(),
@@ -414,6 +425,11 @@ const SatBaseDatabase = () => {
                 <button className="sb_btn" onClick={() => setColumnPanel(v => !v)}>
                     表示項目（{shownColumns.length}/{COLUMNS.length}）
                 </button>
+                {isMaster && (
+                    <button className="sb_btn" onClick={() => setImportOpen(true)}>
+                        <i className="fa-solid fa-file-csv me-1" aria-hidden="true" />物件更新
+                    </button>
+                )}
                 <span className="sb_count">{filtered.length.toLocaleString()} 件中 {rows.length.toLocaleString()} 件を表示</span>
             </div>
 
@@ -477,6 +493,10 @@ const SatBaseDatabase = () => {
                 {/* ⚠️ ここが見えたら30行足す。⚠️ 表の外に置くと監視が効かない */}
                 <div ref={sentinel} style={{ height: 1 }} />
             </div>
+
+            {isMaster && (
+                <SatBaseImport show={importOpen} setShow={setImportOpen} onImported={() => void loadProperties()} />
+            )}
         </div>
     );
 };
```
