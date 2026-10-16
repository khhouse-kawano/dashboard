import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../db/pool';
import type { AuthenticatedStaff } from '../types/staff';

/**
 * 業務ガイド（v2.2.194 新規）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面: frontend/src/components/guide/Guide.tsx（別ウインドウで開く `/guide`）
 * ⚠️ 表:   guide_article / guide_history（backend/scripts/sql/2026-10-16_guide_article.sql）
 *
 * ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ express_proxy.php の転送リストと転送専用リストの両方に入れてある。
 *
 * ⚠️ 読むのはログインした人全員。⚠️⚠️ **書くのは authority が Master / BrandAdmin の人だけ。**
 *   ⚠️ registry の `auth: 'master'` は Master しか通さない（BrandAdmin が入れない）ので、
 *     ⚠️ `auth: 'staff'` で受けてここで判定する（`canEditGuide`）。
 *
 * ⚠️ 事業区分（order / spec / used / common）。⚠️ 絞り込みは画面側（Guide.tsx）で行う（⚠️ リンクは事業をまたいで張れる）。
 * ⚠️ 記事は消さない（⚠️ published = 0 で隠す）。⚠️ 保存のたびに直前の内容を guide_history に積む。
 * ─────────────────────────────────────────────
 */

/** 編集できる authority（⚠️ staff.brand に入っている値） */
const EDITORS = ['Master', 'BrandAdmin'];
export const canEditGuide = (staff: AuthenticatedStaff | null): boolean => staff !== null && EDITORS.includes(staff.brand);

/** 分類（⚠️ 画面の並び順もこの順） */
export const GUIDE_SECTIONS = ['業務の流れ', '画面の使い方', '用語'] as const;
/** 事業区分。⚠️ common は全事業に出す。⚠️ 建売・中古は 2026-10-16 の指示で追加 */
export const GUIDE_DIVISIONS = ['order', 'spec', 'used', 'common'] as const;

/**
 * 本文の上限（バイト）。
 * ⚠️⚠️ **mysql2 の execute() は 65,535 バイト以上の値で落ちる**（db/pool.ts の executeLarge の説明）。
 *   ⚠️ 記事にそこまでの長さは要らないので、executeLarge を使わず上限で止める。
 */
const MAX_BODY_BYTES = 60000;

interface ArticleRow extends RowDataPacket {
  id: number;
  title: string;
  division: string;
  section: string;
  summary: string;
  body?: string;
  sort: number;
  published: number;
  updated_by: string;
  updated_at: string;
}

export interface GuideResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): GuideResult => ({ httpStatus: 200, body: { status: 'ok', ...body } });
const fail = (httpStatus: number, message: string): GuideResult => ({ httpStatus, body: { status: 'error', message } });
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** 一覧（⚠️ 本文なし）。⚠️ 編集できる人には隠した記事も返す（⚠️ 戻せるように） */
export const listGuide = async (staff: AuthenticatedStaff | null): Promise<GuideResult> => {
  const editor = canEditGuide(staff);
  const rows = await query<ArticleRow>(
    `SELECT id, title, division, section, summary, sort, published, updated_by,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated_at
       FROM guide_article
      ${editor ? '' : 'WHERE published = 1'}
      ORDER BY FIELD(section, ${GUIDE_SECTIONS.map(() => '?').join(', ')}), sort, id`,
    [...GUIDE_SECTIONS]
  );
  return ok({ canEdit: editor, sections: GUIDE_SECTIONS, articles: rows });
};

/** 記事1本（id で取る）。⚠️ 隠した記事は編集できる人だけ */
export const getGuide = async (staff: AuthenticatedStaff | null, idValue: unknown): Promise<GuideResult> => {
  const id = Number(idValue);
  if (!Number.isInteger(id) || id <= 0) return fail(400, '記事が指定されていません。');
  const rows = await query<ArticleRow>(
    `SELECT id, title, division, section, summary, body, sort, published, updated_by,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated_at
       FROM guide_article WHERE id = ?`,
    [id]
  );
  const article = rows[0];
  if (article === undefined || (article.published !== 1 && !canEditGuide(staff))) return fail(404, '記事が見つかりません。');
  return ok({ article });
};

interface SaveInput {
  id?: unknown;
  title?: unknown;
  division?: unknown;
  section?: unknown;
  summary?: unknown;
  body?: unknown;
  sort?: unknown;
  published?: unknown;
}

/**
 * 記事を保存する（⚠️ id が無ければ新規）。
 * ⚠️ 更新のときは、上書きする前の内容を guide_history に積む（同じトランザクション）。
 */
export const saveGuide = async (staff: AuthenticatedStaff | null, input: SaveInput): Promise<GuideResult> => {
  if (!canEditGuide(staff) || staff === null) return fail(403, '業務ガイドを編集する権限がありません。');

  const title = text(input.title, 191);
  const section = text(input.section, 32);
  const division = text(input.division, 16) || 'order';
  const summary = text(input.summary, 255);
  const body = typeof input.body === 'string' ? input.body.replace(/\r\n/g, '\n') : '';
  const sort = Number.isInteger(Number(input.sort)) ? Number(input.sort) : 0;
  const published = input.published === 0 || input.published === '0' || input.published === false ? 0 : 1;
  const id = input.id === undefined || input.id === null || input.id === '' ? null : Number(input.id);

  if (title === '') return fail(400, 'タイトルを入力してください。');
  if (/[[\]]/.test(title)) return fail(400, 'タイトルに [ ] は使えません（リンクの記号と区別できなくなるため）。');
  if (!(GUIDE_SECTIONS as readonly string[]).includes(section)) return fail(400, '分類を選んでください。');
  if (!(GUIDE_DIVISIONS as readonly string[]).includes(division)) return fail(400, '事業区分が正しくありません。');
  if (body.trim() === '') return fail(400, '本文を入力してください。');
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return fail(400, '本文が長すぎます。記事を分けてください。');
  if (id !== null && (!Number.isInteger(id) || id <= 0)) return fail(400, '記事の指定が正しくありません。');

  const duplicate = await query<ArticleRow>('SELECT id FROM guide_article WHERE title = ? AND id <> ?', [title, id ?? 0]);
  if (duplicate.length > 0) return fail(409, '同じタイトルの記事がすでにあります。');

  const savedId = await withTransaction(async (tx) => {
    if (id === null) {
      const result = await tx.execute(
        `INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, division, section, summary, body, sort, published, staff.name]
      );
      return result.insertId;
    }
    const before = await tx.query<ArticleRow>('SELECT id FROM guide_article WHERE id = ? FOR UPDATE', [id]);
    if (before.length === 0) return null;
    await tx.execute(
      `INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
       SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE id = ?`,
      [id]
    );
    await tx.execute(
      `UPDATE guide_article SET title = ?, division = ?, section = ?, summary = ?, body = ?, sort = ?, published = ?, updated_by = ?
        WHERE id = ?`,
      [title, division, section, summary, body, sort, published, staff.name, id]
    );
    return id;
  });
  if (savedId === null) return fail(404, '記事が見つかりません。');
  return ok({ id: savedId });
};
