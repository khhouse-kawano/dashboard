import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';

/**
 * 商談・架電記録から検索する（v2.2.296。顧客DB の database_list の条件 record）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 見るのは記録の本文（interview_sheet.interview_log・call_sheet.call_log の各要素の note）だけ。
 * ⚠️⚠️ v2.2.297 DB の JSON の関数（JSON_TABLE・JSON_SEARCH・JSON_VALID など）は使わない。
 *   本番の MariaDB は古く、JSON_TABLE が構文エラーになった（v2.2.296 の本番で 502）。ローカルの DB は新しいので通ってしまう。
 *   DB では記録の列を文字のまま LIKE で粗く探し、本文に語があるかは ② で JSON をほどいてから決める。
 * ⚠️ 記録の一部は日本語が \uXXXX、「/」が \/ の形で保存されている（古い PHP の json_encode）。
 *   そのままの形だけで LIKE すると取りこぼすので、語を保存されうる形（likeVariants）すべてで探す。
 * ⚠️ 架電記録には JSON として読めない行がある（約20行）。ほどけない行は飛ばす。
 * ⚠️ 記録の表に id の索引は無い。全件を読むので1回に数秒かかる（2つの表は並行して読む）。
 *   同じ語でページ・表示件数を変えたときに読み直さないよう、結果を RECORD_CACHE_MS だけ覚えておく。
 * ⚠️ 当たった語の前後 RECORD_CONTEXT 字ずつを返す。1人あたり新しい順に RECORD_ITEMS 件まで（残りは件数だけ）。
 * ─────────────────────────────────────────────
 */

/** 当たった語の前後に出す字数 */
const RECORD_CONTEXT = 40;
/** 1人あたりに返す記録の件数 */
const RECORD_ITEMS = 5;
/** 検索の結果を覚えておく時間（ミリ秒）と語の数 */
const RECORD_CACHE_MS = 60_000;
const RECORD_CACHE_SIZE = 20;
/** 受ける語の長さ（⚠️ 長すぎる語は切る） */
const RECORD_KEYWORD_MAX = 100;

export type RecordKind = '架電' | '商談';

/** 画面に出す記録1件（before + match + after が本文の抜き出し） */
export interface RecordHit {
  day: string;
  kind: RecordKind;
  action: string;
  before: string;
  match: string;
  after: string;
}

/** 顧客1人分（items は新しい順に RECORD_ITEMS 件まで。total は当たった記録の数） */
export interface RecordHitGroup {
  total: number;
  items: RecordHit[];
}

interface SheetRow extends RowDataPacket {
  id: string;
  log: string | null;
}

/** 記録の列（JSON の配列）の各要素で使う項目 */
interface LogEntry {
  day?: unknown;
  action?: unknown;
  note?: unknown;
}

const SHEETS: ReadonlyArray<{ kind: RecordKind; table: string; column: string }> = [
  { kind: '架電', table: 'call_sheet', column: 'call_log' },
  { kind: '商談', table: 'interview_sheet', column: 'interview_log' },
];

/** 画面から来た語を整える（前後の空白を落とし、長さを切る） */
export const recordKeywordOf = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, RECORD_KEYWORD_MAX) : '');

/**
 * 語が記録の列（JSON の文字）の中に現れうる形をすべて返す。
 * ⚠️ JSON の中では「"」「\」は必ず \" \\ になる。日本語などは そのまま／\uXXXX、「/」は そのまま／\/ のどちらもある。
 */
const jsonForms = (keyword: string): string[] => {
  const plain = JSON.stringify(keyword).slice(1, -1);
  // ⚠️ \uXXXX は UTF-16 の単位ごと（絵文字などは2つ並ぶ）。16進の大文字小文字は、探すときに列と語を小文字にそろえて吸収する
  const unicode = plain.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const slashed = (s: string) => s.replace(/\//g, '\\/');
  return [...new Set([plain, slashed(plain), unicode, slashed(unicode)])];
};

/** LIKE の % _ \ を文字として扱う */
const likePattern = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** 本文の改行・連続する空白を1つの空白にして、語の前後を切り出す */
const excerpt = (note: string, keyword: string): Pick<RecordHit, 'before' | 'match' | 'after'> => {
  const text = note.replace(/\s+/g, ' ').trim();
  const at = text.toLowerCase().indexOf(keyword.toLowerCase());
  // ⚠️ 語が空白をまたぐ（本文では改行だった）ときなどは位置が分からない：先頭から出して色は付けない
  if (at < 0) return { before: '', match: '', after: text.slice(0, RECORD_CONTEXT * 2) + (text.length > RECORD_CONTEXT * 2 ? '…' : '') };
  const end = at + keyword.length;
  return {
    before: (at > RECORD_CONTEXT ? '…' : '') + text.slice(Math.max(0, at - RECORD_CONTEXT), at),
    match: text.slice(at, end),
    after: text.slice(end, end + RECORD_CONTEXT) + (text.length > end + RECORD_CONTEXT ? '…' : ''),
  };
};

/** 日付の新しい順（'2026/01/02' も '2026-01-02' と同じに並べる。日付の無い記録は最後） */
const byDayDesc = (a: { day: string }, b: { day: string }): number => b.day.replace(/\//g, '-').localeCompare(a.day.replace(/\//g, '-'));

const textOf = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** 記録の列をほどく（⚠️ JSON として読めない行・配列でない行は空） */
const entriesOf = (log: string | null): LogEntry[] => {
  if (!log) return [];
  try {
    const parsed: unknown = JSON.parse(log);
    return Array.isArray(parsed) ? parsed.filter((e): e is LogEntry => typeof e === 'object' && e !== null) : [];
  } catch {
    return [];
  }
};

const cache = new Map<string, { at: number; hits: Map<string, RecordHitGroup> }>();

/** 返すページの顧客の分だけ（画面は顧客ID で引く） */
export const recordsOfPage = (ids: unknown[], hits: Map<string, RecordHitGroup>): Record<string, RecordHitGroup> =>
  Object.fromEntries(ids.filter((id): id is string => typeof id === 'string' && hits.has(id)).map((id) => [id, hits.get(id) as RecordHitGroup]));

/** 語が本文にある記録を、顧客ID ごとにまとめて返す */
export const searchRecords = async (keyword: string): Promise<Map<string, RecordHitGroup>> => {
  const now = Date.now();
  const cached = cache.get(keyword);
  if (cached && now - cached.at < RECORD_CACHE_MS) return cached.hits;

  // ⚠️ 記録の列は大文字小文字を区別する照合（JSON の列は utf8mb4_bin）。列も語も小文字にそろえて探す
  const patterns = [...new Set(jsonForms(keyword).map((s) => likePattern(s.toLowerCase())))];
  const results = await Promise.all(SHEETS.map(({ table, column }) => query<SheetRow>(
    `SELECT id, ${column} AS log FROM ${table} WHERE id <> '' AND (${patterns.map(() => `LOWER(${column}) LIKE ?`).join(' OR ')})`,
    patterns,
  )));

  // ⚠️ 本文に語があるかは大文字小文字を区別しない（列の LIKE と同じ）
  const lower = keyword.toLowerCase();
  const all = new Map<string, Array<{ day: string; kind: RecordKind; action: string; note: string }>>();
  results.forEach((rows, i) => {
    for (const r of rows) {
      for (const e of entriesOf(r.log)) {
        const note = textOf(e.note);
        if (!note.toLowerCase().includes(lower)) continue;
        const list = all.get(r.id) ?? [];
        list.push({ day: textOf(e.day), kind: SHEETS[i].kind, action: textOf(e.action), note });
        all.set(r.id, list);
      }
    }
  });
  // ⚠️ 抜き出しは返す分（新しい順に RECORD_ITEMS 件）だけ作る（短い語だと当たる記録が数万件になる）
  const hits = new Map<string, RecordHitGroup>();
  for (const [id, list] of all) {
    const items = list.sort(byDayDesc).slice(0, RECORD_ITEMS).map(({ note, ...h }) => ({ ...h, ...excerpt(note, keyword) }));
    hits.set(id, { total: list.length, items });
  }

  for (const [key, v] of cache) if (now - v.at >= RECORD_CACHE_MS) cache.delete(key);
  if (cache.size >= RECORD_CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  cache.set(keyword, { at: now, hits });
  return hits;
};
