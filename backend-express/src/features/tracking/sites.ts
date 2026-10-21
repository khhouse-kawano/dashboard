import { randomBytes } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { isMetaConfigured } from '../metaAds/importer';
import { CV_TARGETS } from './conversion';
import { attributeConversions } from './conversions';
import { AD_TOUCH_SQL } from './params';
import { clearTrackingSiteCache, normalizeOrigin, parseOrigins } from './touch';

/**
 * 広告流入トラッキング（v2.2.199）のサイト登録。画面は header/TrackingSettings.tsx（反響管理 → トラッキング設定）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 見る・登録するのは authority が Master / BrandAdmin の人だけ（⚠️ registry の auth: 'master' は BrandAdmin が入れないので、ここで判定する）。
 * ⚠️ サイトは消さない（⚠️ 着地の記録が残るため）。⚠️ is_active = 0 で止める。
 * ⚠️ site_key は登録のときに1回だけ作る（⚠️ 変えるとタグを貼り直すことになる）。
 * ─────────────────────────────────────────────
 */

const MANAGERS = ['Master', 'BrandAdmin'];
export const canManageTracking = (staff: AuthenticatedStaff | null): boolean => staff !== null && MANAGERS.includes(staff.brand);

/** ブランドキー（⚠️ form_get の gateway.ts の FALLBACK_URL と同じ） */
export const TRACKING_BRANDS = ['kh', 'djh', 'nagomi', 'fh', '2l', 'pg', 'jh', 'khf'] as const;

interface SiteRow extends RowDataPacket {
  id: number;
  site_key: string;
  name: string;
  brand: string | null;
  allowed_origins: string | string[];
  is_active: number;
  memo: string;
  updated_by: string;
  updated_at: string;
  touches_30d: number;
  last_touch: string | null;
}

export interface TrackingResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): TrackingResult => ({ httpStatus: 200, body: { status: 'ok', ...body } });
const fail = (httpStatus: number, message: string): TrackingResult => ({ httpStatus, body: { status: 'error', message } });

/**
 * 一覧（⚠️ 運用の確認用に、直近30日の着地数と最後の着地も返す。⚠️ 画面の見出しが「広告からの着地」なので広告の分だけ数える）。
 * ⚠️ v2.2.202 直近30日の CV も返す（数え方は conversions.ts。⚠️ 広告以外の訪問からの CV も含む）。
 * ⚠️ v2.2.205 CV 用のタグ（cv.js）を使うブランドのサイトは、直近30日に cv.js が送った件数と、反響に結びついた件数も返す（cvForm）。
 *   ⚠️ 送っているのに結びつかないなら、フォームの入力欄の名前が変わったなど（cvMatch.ts）。⚠️ 表がまだ無い＝① に SQL を流す前なら 0。
 */
export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promise<TrackingResult> => {
  if (!canManageTracking(staff)) return fail(403, 'この画面は管理者だけが使えます。');
  const conversions = await attributeConversions();
  // ⚠️ v2.2.203 Meta 広告の最後の取り込み（⚠️ 表がまだ無い＝① に SQL を流す前なら null）
  const lastImport = await query<RowDataPacket & { at: string | null }>("SELECT DATE_FORMAT(MAX(imported_at), '%Y-%m-%d %H:%i') AS at FROM meta_ad_items")
    .then((r) => r[0]?.at ?? null)
    .catch(() => null);
  const cvForm = await query<RowDataPacket & { site_id: number; sent: number; matched: number }>(
    `SELECT site_id, COUNT(*) AS sent, SUM(matched_at IS NOT NULL) AS matched
       FROM tracking_conversions WHERE created_at >= NOW() - INTERVAL 30 DAY GROUP BY site_id`
  )
    .then((r) => new Map(r.map((x) => [Number(x.site_id), { sent: Number(x.sent), matched: Number(x.matched) }])))
    .catch(() => new Map<number, { sent: number; matched: number }>());
  const rows = await query<SiteRow>(
    `SELECT s.id, s.site_key, s.name, s.brand, s.allowed_origins, s.is_active, s.memo, s.updated_by,
            DATE_FORMAT(s.updated_at, '%Y-%m-%d %H:%i') AS updated_at,
            (SELECT COUNT(*) FROM tracking_touches t WHERE t.site_id = s.id AND t.created_at >= NOW() - INTERVAL 30 DAY AND ${AD_TOUCH_SQL}) AS touches_30d,
            (SELECT DATE_FORMAT(MAX(t.created_at), '%Y-%m-%d %H:%i') FROM tracking_touches t WHERE t.site_id = s.id AND ${AD_TOUCH_SQL}) AS last_touch
       FROM tracking_sites s
      ORDER BY s.is_active DESC, s.id`
  );
  return ok({
    brands: TRACKING_BRANDS,
    meta: { configured: isMetaConfigured(), lastImportedAt: lastImport },
    sites: rows.map((r) => ({
      id: Number(r.id), siteKey: r.site_key, name: r.name, brand: r.brand ?? '', origins: parseOrigins(r.allowed_origins),
      active: Number(r.is_active) === 1, memo: r.memo, updatedBy: r.updated_by, updatedAt: r.updated_at,
      touches30d: Number(r.touches_30d), lastTouch: r.last_touch, cv30d: conversions.get(Number(r.id))?.length ?? 0,
      cvForm: CV_TARGETS[r.brand ?? ''] === undefined ? null : cvForm.get(Number(r.id)) ?? { sent: 0, matched: 0 },
    })),
  });
};

/** `https://example.jp` の形だけ受ける（⚠️ パス・クエリ・ワイルドカードは不可） */
const ORIGIN_PATTERN = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/;

export interface SaveSiteInput {
  id?: unknown;
  name?: unknown;
  brand?: unknown;
  origins?: unknown;
  active?: unknown;
  memo?: unknown;
}

const newSiteKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return `s_${Array.from(randomBytes(16), (b) => chars[b % chars.length]).join('')}`;
};

/** 登録・更新。⚠️ 無効化も is_active で行う */
export const saveTrackingSite = async (staff: AuthenticatedStaff | null, input: SaveSiteInput): Promise<TrackingResult> => {
  if (!canManageTracking(staff) || staff === null) return fail(403, 'この画面は管理者だけが使えます。');
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 255) : '';
  if (name === '') return fail(400, 'サイト名を入れてください。');
  const brand = typeof input.brand === 'string' ? input.brand.trim() : '';
  if (brand !== '' && !(TRACKING_BRANDS as readonly string[]).includes(brand)) return fail(400, 'ブランドを選び直してください。');
  const rawOrigins = Array.isArray(input.origins) ? input.origins.filter((o): o is string => typeof o === 'string') : [];
  const origins = [...new Set(rawOrigins.map(normalizeOrigin).filter((o) => o !== ''))];
  if (origins.length === 0) return fail(400, '許可するオリジン（例 https://kh-house.jp）を1つ以上入れてください。');
  const bad = origins.find((o) => !ORIGIN_PATTERN.test(o));
  if (bad !== undefined) return fail(400, `「${bad}」はオリジンの形ではありません。https://ドメイン の形で入れてください（/ 以降は不要）。`);
  const active = input.active === false || input.active === 0 ? 0 : 1;
  const memo = typeof input.memo === 'string' ? input.memo.trim().slice(0, 500) : '';
  const id = Number(input.id);

  if (Number.isInteger(id) && id > 0) {
    const result = await execute(
      'UPDATE tracking_sites SET name = ?, brand = ?, allowed_origins = ?, is_active = ?, memo = ?, updated_by = ? WHERE id = ?',
      [name, brand === '' ? null : brand, JSON.stringify(origins), active, memo, staff.name, id]
    );
    clearTrackingSiteCache();
    if (result.affectedRows === 0) return fail(404, 'サイトが見つかりません。一覧を開き直してください。');
    return ok({ id });
  }
  const siteKey = newSiteKey();
  const result = await execute(
    'INSERT INTO tracking_sites (site_key, name, brand, allowed_origins, is_active, memo, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [siteKey, name, brand === '' ? null : brand, JSON.stringify(origins), active, memo, staff.name]
  );
  clearTrackingSiteCache();
  return ok({ id: Number(result.insertId), siteKey });
};
