import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * テーブル定義書（v2.2.301。header/TableDefinition.tsx。システム管理 → テーブル定義書。Master だけ・閲覧のみ）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 説明は table_definition / column_definition（原稿は backend/scripts/tabledef/tables/*.md。画面からは書き換えない）。
 * ⚠️ 型・NULL・既定値・キーは持たずに実物から読む（SHOW FULL COLUMNS）。⚠️ ① では information_schema が使えないので使わない。
 * ⚠️ テーブル名は SHOW TABLES にあるものだけを受ける（SQL に名前を埋め込むため）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface TableDefinitionResult {
  httpStatus: number;
  body: unknown;
}

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/** 実物のテーブル（行数は SHOW TABLE STATUS の概算） */
const actualTables = async (): Promise<Map<string, { rows: number; comment: string }>> => {
  const rows = await query<DynamicRow>('SHOW TABLE STATUS');
  return new Map(
    rows
      .filter((r) => text(r.Comment) !== 'VIEW')
      .map((r) => [text(r.Name), { rows: Number(r.Rows ?? 0), comment: text(r.Comment) }])
  );
};

/**
 * 一覧（table を付けないとき）。
 * ⚠️ 実物にあって定義書に無いテーブルは「未記載」（title が空）、定義書にあって実物に無いテーブルは exists = false で返す。
 * ⚠️ columns は列名・説明の検索用（型は持たない）。
 */
const listDefinitions = async (): Promise<TableDefinitionResult> => {
  const [actual, defs, cols] = await Promise.all([
    actualTables(),
    query<DynamicRow>('SELECT table_name, title, business, description, source FROM table_definition'),
    query<DynamicRow>('SELECT table_name, column_name, description FROM column_definition ORDER BY table_name'),
  ]);
  const defOf = new Map(defs.map((d) => [text(d.table_name), d]));
  const countOf = new Map<string, number>();
  for (const c of cols) countOf.set(text(c.table_name), (countOf.get(text(c.table_name)) ?? 0) + 1);
  const names = [...new Set([...actual.keys(), ...defOf.keys()])].sort();
  const tables = names.map((name) => {
    const d = defOf.get(name);
    const a = actual.get(name);
    return {
      table_name: name,
      exists: a !== undefined,
      rows: a?.rows ?? 0,
      title: text(d?.title),
      business: text(d?.business),
      description: text(d?.description) || (a?.comment ?? ''),
      source: text(d?.source),
      columns: countOf.get(name) ?? 0,
    };
  });
  return {
    httpStatus: 200,
    body: {
      status: 'success',
      tables,
      columns: cols.map((c) => ({ table_name: text(c.table_name), column_name: text(c.column_name), description: text(c.description) })),
    },
  };
};

/** 1テーブル（table を付けたとき）。実物の列の順に、定義書の説明を重ねる。実物に無い列の説明は後ろに付ける */
const detailDefinition = async (table: string): Promise<TableDefinitionResult> => {
  const actual = await actualTables();
  const a = actual.get(table);
  const [[def], descs] = await Promise.all([
    query<DynamicRow>('SELECT title, business, description, source, updated_version FROM table_definition WHERE table_name = ?', [table]),
    query<DynamicRow>('SELECT column_name, description, source FROM column_definition WHERE table_name = ?', [table]),
  ]);
  if (a === undefined && def === undefined) return { httpStatus: 404, body: { status: 'error', message: 'そのテーブルはありません' } };

  const descOf = new Map(descs.map((d) => [text(d.column_name), d]));
  // ⚠️ 名前は SHOW TABLE STATUS にあったものだけ（a !== undefined）。⚠️ ` は二重にして囲む
  const real = a === undefined ? [] : await query<DynamicRow>(`SHOW FULL COLUMNS FROM \`${table.replace(/`/g, '``')}\``);
  const columns = real.map((r) => {
    const d = descOf.get(text(r.Field));
    return {
      column_name: text(r.Field),
      exists: true,
      type: text(r.Type),
      nullable: text(r.Null) === 'YES',
      key: text(r.Key),
      default_value: r.Default === null ? null : text(r.Default),
      extra: text(r.Extra),
      comment: text(r.Comment),
      description: text(d?.description),
      source: text(d?.source),
    };
  });
  const realNames = new Set(columns.map((c) => c.column_name));
  for (const d of descs) {
    if (realNames.has(text(d.column_name))) continue;
    columns.push({
      column_name: text(d.column_name), exists: false, type: '', nullable: false, key: '', default_value: null, extra: '', comment: '',
      description: text(d.description), source: text(d.source),
    });
  }
  return {
    httpStatus: 200,
    body: {
      status: 'success',
      table: {
        table_name: table,
        exists: a !== undefined,
        rows: a?.rows ?? 0,
        comment: a?.comment ?? '',
        title: text(def?.title),
        business: text(def?.business),
        description: text(def?.description),
        source: text(def?.source),
        updated_version: text(def?.updated_version),
      },
      columns,
    },
  };
};

/** table_definition（GET）。table を付ければその表の列、付けなければ一覧 */
export const runTableDefinition = async (body: Record<string, unknown>): Promise<TableDefinitionResult> => {
  const table = text(body.table).trim();
  return table === '' ? listDefinitions() : detailDefinition(table);
};
