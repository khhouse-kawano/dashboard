import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../db/pool';
import { AppError } from '../errors/AppError';

/**
 * 分析API用の APIキー認証。
 *
 * ブラウザ向けの `requireApiToken`（staff.api_token）とは別物で、
 * Claude Desktop の MCP サーバーのような「機械」からの接続に使う。
 *
 * ─────────────────────────────────────────────
 * なぜ staff.api_token を流用しないのか
 *   api_token は無期限で、失効・有効期限・用途の区別が無い。
 *   分析APIは全店舗の成績を横断で引ける口をインターネットに晒すため、
 *   「漏れたら1本だけ止める」ができる必要がある。
 *   また、キーが漏れたときにブラウザのセッションまで巻き込まれるのも避けたい。
 * ─────────────────────────────────────────────
 */

/** キーの接頭辞。ログや画面で「これは分析APIのキーだ」と判別できるようにする */
export const ANALYSIS_KEY_PREFIX = 'khg_kpi_';

interface ApiKeyRow extends RowDataPacket {
  id: number;
  staff_id: number;
  label: string;
  expires_at: string | null;
  revoked_at: string | null;
  staff_name: string;
  staff_authority: string;
}

/** 認証を通ったキーの情報。ハンドラと監査ログから参照する */
export interface AuthenticatedApiKey {
  id: number;
  staffId: number;
  staffName: string;
  label: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: AuthenticatedApiKey;
    }
  }
}

/**
 * リクエストからキーを取り出す。
 * MCP／HTTPクライアントの標準に合わせ `Authorization: Bearer` を第一とする。
 */
const extractKey = (authorization: string | undefined): string | null => {
  if (authorization === undefined) return null;
  const matched = /^Bearer\s+(\S+)$/i.exec(authorization);
  return matched === null ? null : matched[1];
};

/** キー本体からDB照合用のハッシュを作る。発行時と検証時で必ず同じ関数を使うこと */
export const hashApiKey = (key: string): string =>
  createHash('sha256').update(key, 'utf8').digest('hex');

/**
 * 分析APIの認証。
 *
 * 認証（誰のキーか）と認可（Master権限か）をまとめて確認する。
 * キーの所有者が Master 権限を外れた場合、キーが有効でも拒否される
 * （権限を落としたのにキーだけ生き続けるのを防ぐ）。
 */
export const requireAnalysisApiKey: RequestHandler = async (req, _res, next) => {
  const key = extractKey(req.header('Authorization'));

  if (key === null) {
    next(AppError.unauthorized('Authorization: Bearer <APIキー> が必要です'));
    return;
  }

  // キー本体ではなくハッシュで検索し、一意索引で1件に引く。
  // 比較をアプリ側で行わないため、文字列比較の時間差から
  // 「どこまで一致したか」が漏れる余地が無い（定数時間比較は不要）。
  const rows = await query<ApiKeyRow>(
    `SELECT k.id, k.staff_id, k.label, k.expires_at, k.revoked_at,
            s.name AS staff_name, s.brand AS staff_authority
       FROM analysis_api_key k
       JOIN staff s ON s.id = k.staff_id
      WHERE k.key_hash = ?
      LIMIT 1`,
    [hashApiKey(key)]
  );

  const row = rows[0];

  // キーそのものはログにも例外メッセージにも絶対に出さない
  if (row === undefined) {
    next(AppError.unauthorized('APIキーが無効です'));
    return;
  }
  if (row.revoked_at !== null) {
    next(AppError.unauthorized('このAPIキーは失効しています'));
    return;
  }
  if (row.expires_at !== null && new Date(row.expires_at).getTime() < Date.now()) {
    next(AppError.unauthorized('このAPIキーは有効期限が切れています'));
    return;
  }
  if (row.staff_authority !== 'Master') {
    // PHP 側 core/authz.php の requireMaster と同じ判定にそろえる
    next(AppError.forbidden('この操作を行う権限がありません'));
    return;
  }

  req.apiKey = {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    label: row.label,
  };

  // 棚卸し用の最終利用時刻。失敗してもリクエスト自体は通す
  // （認証は済んでおり、記録漏れのために業務を止める理由がない）
  execute('UPDATE analysis_api_key SET last_used_at = NOW() WHERE id = ?', [row.id]).catch(
    (error: unknown) => {
      console.error('[analysis] last_used_at の更新に失敗しました', error);
    }
  );

  next();
};
