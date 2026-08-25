import { z } from 'zod';

/**
 * 機能ファイル間で使い回すスキーマ部品。
 *
 * クエリ文字列とパスパラメータは **必ず文字列で届く** ため、
 * 数値・真偽値として扱いたい場合は z.coerce.* を通す必要がある。
 * よく使う形をここにまとめて、各機能ファイルでの書き間違いを防ぐ。
 */

/** URL に含まれる ID（例: /customers/123） */
export const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

/** 一覧取得の共通クエリ。`.extend()` で機能ごとの絞り込み条件を足す */
export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/** 'true' / '1' / 'on' を真として扱うクエリ用の真偽値 */
export const booleanQuery = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean' ? value : ['true', '1', 'on'].includes(value.toLowerCase())
  );

/** 'YYYY-MM-DD' 形式の日付文字列 */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で指定してください');

/** 空文字を undefined として扱う（フォーム由来の値の正規化） */
export const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();
