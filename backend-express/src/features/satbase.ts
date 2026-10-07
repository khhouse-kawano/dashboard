import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from '../db/pool';
import type { SqlParam } from '../db/pool';

/**
 * SatBaseサマリー（header/SatBaseDatabase.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 取り込み元は SatBase の物件台帳（中間加工）。
 *   ⚠️ テーブルは `backend/scripts/sql/2026-09-22_satbase_property.sql` で作る。
 *
 * ⚠️⚠️ **2026-09-29（v2.2.152）から表が2つに分かれている。**
 *   ⚠️ `satbase_property`      … ⚠️⚠️ **SatBaseの写し。CSVで丸ごと入れ替えてよい**
 *   ⚠️ `satbase_property_flag` … ⚠️⚠️ **画面から入れた値。取り込みで触らない**
 *   ⚠️ ⚠️ **分けた理由**: 同居していた頃は、⚠️ **CSVを入れ直すたびに
 *     ⚠️ トグルがゼロに戻っていた。**
 *   ⚠️ 作る SQL: `backend/scripts/sql/2026-09-29_satbase_property_flag.sql`
 *   ⚠️ 入れ替え手順: `backend/scripts/sql/2026-09-29_satbase_property_reload.sql`
 *
 * ⚠️⚠️ **画面から更新できるのは `ad_posted` と `instagram_posted` の2列だけ。**
 *   ⚠️ ⚠️ **他の列は SatBase 側が正である。** ⚠️ 画面から書き換えてはならない。
 *   ⚠️ 列名を受け取って UPDATE する作りにしないこと（どの列でも書けてしまう）。
 *   ⚠️ ⚠️ **いまは書き込み先が flag 表しかないので、そもそも台帳側へは届かない。**
 *     ⚠️ ただし許可リストは残す（⚠️ **flag 表の中でも列は選ばせない**）。
 *
 * ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある。**
 *   ⚠️ そのため `express_proxy.php` の
 *     ⚠️ **`expressProxyRequests()` と `expressProxyExclusive()` の両方**に入れる。
 *
 * ⚠️ 1,900行ほど。⚠️ **全件を1度に返し、絞り込みと並べ替えは画面で行う。**
 *   ⚠️ 列が40あるため、⚠️ **列を足すときは転送量を意識すること。**
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * ⚠️⚠️ **画面から書き換えてよい列。**
 *   ⚠️ ⚠️ **ここに無い列名は受け付けない。** ⚠️ 追加するときは指示を受けてからにすること。
 */
const EDITABLE_COLUMNS = ['ad_posted', 'instagram_posted'] as const;

type EditableColumn = (typeof EDITABLE_COLUMNS)[number];

const isEditableColumn = (value: string): value is EditableColumn =>
  (EDITABLE_COLUMNS as readonly string[]).includes(value);

/**
 * 一覧。
 *
 * ⚠️ 並べ替えは ⚠️ **`property_id` の降順**（新しい物件が上）。
 *   ⚠️ ⚠️ **文字列ではなく数値で並べる**。⚠️ 列が INT なので SQL 側で正しく並ぶ。
 *
 * ⚠️⚠️ **LEFT JOIN であること。**
 *   ⚠️ ⚠️ **flag 表には「一度でも触られた物件」しか行が無い。**
 *     ⚠️ 内部結合にすると ⚠️ **未操作の物件が一覧から消える。**
 *
 * ⚠️⚠️ **`COALESCE` で 0 に落とすこと。**
 *   ⚠️ 画面は `Number(p.ad_posted ?? 0)` で見ているので NULL でも動くが、
 *     ⚠️ ⚠️ **絞り込み（未出稿）が NULL と 0 で割れる**ため揃えておく。
 *
 * ⚠️ ⚠️ **返す形は分割前と同じ。** ⚠️ 画面側（SatBaseDatabase.tsx）は変えていない。
 */
export const runSatbaseList = async (): Promise<unknown> => {
  const rows = await query<DynamicRow>(
    `SELECT p.*,
            COALESCE(f.ad_posted, 0)        AS ad_posted,
            COALESCE(f.instagram_posted, 0) AS instagram_posted,
            f.updated                       AS updated,
            f.updated_by                    AS updated_by
       FROM satbase_property p
       LEFT JOIN satbase_property_flag f ON f.property_id = p.property_id
      ORDER BY p.property_id DESC`
  );

  return { properties: rows };
};

export interface SatbaseUpdateInput {
  propertyId: number;
  column: string;
  value: number;
  staff: string;
}

/**
 * トグルの更新。
 *
 * ⚠️⚠️ **列名は許可リストと突き合わせてから SQL に入れる。**
 *   ⚠️ ⚠️ **プレースホルダは列名には使えない**ので、ここを通さないと
 *     ⚠️ **任意の列を書き換えられる穴になる。**
 *
 * ⚠️ 値は 0 か 1 に丸める。⚠️ **画面がトグルなので、それ以外は来ない前提にしない。**
 *
 * ⚠️⚠️ **書き込み先は `satbase_property_flag`。**
 *   ⚠️ ⚠️ **初回は行が無いので UPDATE では入らない。** ⚠️ 追加と更新を兼ねる形にする。
 *   ⚠️ ⚠️ **触っていない方の列は 0 で入る**（⚠️ 既定値と同じなので問題ない）。
 *
 * ⚠️⚠️ **物件の存在は台帳側で確かめる。**
 *   ⚠️ ⚠️ **追加と更新を兼ねる書き方では、存在しない物件IDでも黙って1行増える。**
 *     ⚠️ 台帳に無い物件の行が溜まるのを防ぐため、先に見に行く。
 */
export const runSatbaseUpdate = async (
  input: SatbaseUpdateInput
): Promise<{ status: string; message?: string }> => {
  if (!Number.isInteger(input.propertyId) || input.propertyId <= 0) {
    return { status: 'error', message: '物件が指定されていません。' };
  }

  if (!isEditableColumn(input.column)) {
    // ⚠️ 列名はそのまま返さない（何が書ける列かを外へ知らせない）
    return { status: 'error', message: 'この項目は画面から変更できません。' };
  }

  const exists = await query<DynamicRow>(
    'SELECT property_id FROM satbase_property WHERE property_id = ? LIMIT 1',
    [input.propertyId]
  );

  if (exists.length === 0) {
    return { status: 'error', message: '物件が見つかりませんでした。' };
  }

  const value = input.value === 1 ? 1 : 0;
  const adPosted = input.column === 'ad_posted' ? value : 0;
  const instagramPosted = input.column === 'instagram_posted' ? value : 0;

  // ⚠️ 列名は許可リストを通っているので、ここで埋め込んでよい
  await execute(
    `INSERT INTO satbase_property_flag
       (property_id, ad_posted, instagram_posted, updated, updated_by)
     VALUES (?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       ${input.column} = VALUES(${input.column}),
       updated         = NOW(),
       updated_by      = VALUES(updated_by)`,
    [input.propertyId, adPosted, instagramPosted, input.staff.slice(0, 128)]
  );

  return { status: 'ok' };
};

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
