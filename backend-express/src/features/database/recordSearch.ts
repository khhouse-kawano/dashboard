import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';

/**
 * 商談・架電記録から検索する（v2.2.296。顧客DB の database_list の条件 record）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 見るのは記録の本文（interview_sheet.interview_log・call_sheet.call_log の各要素の note）だけ。
 * ⚠️ JSON は DB の JSON_TABLE でほどいてから LIKE する。
 *   ⚠️ 記録の一部は日本語が \uXXXX、「/」が \/ の形で保存されている（古い PHP の json_encode）。
 *     列をそのまま LIKE すると、その記録を取りこぼす（ローカルの実測で「ローン」の商談記録 876人 → 正しくは 1,284人）。
 *   ⚠️ 架電記録には JSON として読めない行がある（約20行）。JSON_VALID で外さないと JSON_TABLE がエラーになる。
 * ⚠️ 記録の表に id の索引は無い。全件を読むので1回に約1秒かかる（2つの表は並行して読む）。
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

interface LogRow extends RowDataPacket {
  id: string;
  day: string | null;
  action: string | null;
  note: string | null;
}

const SHEETS: ReadonlyArray<{ kind: RecordKind; sql: string }> = [
  {
    kind: '架電',
    sql: `SELECT c.id AS id, jt.day AS day, jt.action AS action, jt.note AS note
      FROM call_sheet c, JSON_TABLE(c.call_log, '$[*]' COLUMNS(day VARCHAR(50) PATH '$.day', action VARCHAR(100) PATH '$.action', note LONGTEXT PATH '$.note')) jt
      WHERE c.id <> '' AND c.call_log IS NOT NULL AND JSON_VALID(c.call_log) AND jt.note LIKE ?`,
  },
  {
    kind: '商談',
    sql: `SELECT i.id AS id, jt.day AS day, jt.action AS action, jt.note AS note
      FROM interview_sheet i, JSON_TABLE(i.interview_log, '$[*]' COLUMNS(day VARCHAR(50) PATH '$.day', action VARCHAR(100) PATH '$.action', note LONGTEXT PATH '$.note')) jt
      WHERE i.id <> '' AND JSON_VALID(i.interview_log) AND jt.note LIKE ?`,
  },
];

/** 画面から来た語を整える（前後の空白を落とし、長さを切る） */
export const recordKeywordOf = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, RECORD_KEYWORD_MAX) : '');

/** 本文の改行・連続する空白を1つの空白にして、語の前後を切り出す */
const excerpt = (note: string, keyword: string): Pick<RecordHit, 'before' | 'match' | 'after'> => {
  const text = note.replace(/\s+/g, ' ').trim();
  const at = text.toLowerCase().indexOf(keyword.toLowerCase());
  // ⚠️ DB の照合（大文字小文字などを区別しない）では当たったが、ここで位置が分からないとき：先頭から出して色は付けない
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

const cache = new Map<string, { at: number; hits: Map<string, RecordHitGroup> }>();

/** 返すページの顧客の分だけ（画面は顧客ID で引く） */
export const recordsOfPage = (ids: unknown[], hits: Map<string, RecordHitGroup>): Record<string, RecordHitGroup> =>
  Object.fromEntries(ids.filter((id): id is string => typeof id === 'string' && hits.has(id)).map((id) => [id, hits.get(id) as RecordHitGroup]));

/** 語が本文にある記録を、顧客ID ごとにまとめて返す */
export const searchRecords = async (keyword: string): Promise<Map<string, RecordHitGroup>> => {
  const now = Date.now();
  const cached = cache.get(keyword);
  if (cached && now - cached.at < RECORD_CACHE_MS) return cached.hits;

  const pattern = `%${keyword.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const results = await Promise.all(SHEETS.map(({ sql }) => query<LogRow>(sql, [pattern])));
  const all = new Map<string, Array<{ day: string; kind: RecordKind; action: string; note: string }>>();
  results.forEach((rows, i) => {
    for (const r of rows) {
      const list = all.get(r.id) ?? [];
      list.push({ day: r.day ?? '', kind: SHEETS[i].kind, action: r.action ?? '', note: r.note ?? '' });
      all.set(r.id, list);
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
