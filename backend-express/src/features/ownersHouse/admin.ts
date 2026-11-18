import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { SqlParam } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { logger } from '../../utils/logger';

/**
 * オーナーズハウスの管理画面（Dashboard の「オーナーズハウス」。frontend/src/components/ownershouse/）。（v2.2.284）
 *
 * ─────────────────────────────────────────────
 *   owners_house_admin_list … 物件（非公開も含む）・店舗（shop_list の注文事業）・地方公共団体コード
 *   owners_house_admin_save … 1件の保存（no があれば更新、無ければ新規）
 * ⚠️ サイトが読むのは houses.ts（flag = 1 だけ）。ここで flag を '1' 以外にするとサイトから消える。
 * ⚠️ no = 1 は列名が入った見出しの行（category = 'category'）。管理画面には出さず、書き換えもさせない。
 * ⚠️ map_address（物件ページの地図の iframe）は、保存のたびに lat_and_long から作り直す（画面では直させない）。
 * ⚠️ 画像（img_1〜）は v2.2.285 で登録の仕組みを作る。いまは URL をそのまま保存するだけ。
 * ─────────────────────────────────────────────
 */

interface Row extends RowDataPacket {
  [key: string]: unknown;
}

const HEADER_ROW_NO = 1;

/** 画面から直せる列（⚠️ リクエストのキーを列名に使わないための許可リスト。no・id・map_address・updated_* は入れない） */
const EDITABLE = [
  'category', 'pref', 'area', 'lg_code', 'name', 'title', 'brand', 'shop', 'shop_zip', 'shop_address', 'staff', 'tag',
  'feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5', 'img_1', 'img_2', 'img_3', 'img_4', 'img_5',
  'lat_and_long', 'structure', 'large', 'plan', 'flag',
] as const;

const CATEGORIES = ['オーナーズハウス', 'モデルハウス', '完成見学会'];
/** ⚠️ 見学予約の通知先の表（reservation.ts の BRANDS）のキーと同じ */
export const OWNERS_HOUSE_BRANDS = ['KH', 'DJH', 'Nagomi', '2L', 'FH', 'PGH', 'JH'];

export interface AdminResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const fail = (httpStatus: number, message: string): AdminResult => ({ httpStatus, body: { status: 'error', message } });

/** 「31.36, 130.81」→ [31.36, 130.81]。形が違えば null */
export const parseLatLng = (value: string): [number, number] | null => {
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
};

/** 物件ページの地図（Google マップ埋め込み。API キー不要の形）。⚠️ owners_house の Owners.tsx は iframe の src を取り出して使う */
const mapIframe = ([lat, lng]: [number, number]): string =>
  `<iframe src="https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;

export const listOwnersHouseAdmin = async (): Promise<AdminResult> => {
  try {
    const [houses, shops, codes] = await Promise.all([
      query<Row>(`SELECT * FROM ownershouse WHERE no <> ? ORDER BY CAST(id AS UNSIGNED) DESC, no DESC`, [HEADER_ROW_NO]),
      query<Row>(`SELECT shop, brand FROM shop_list WHERE division = '注文事業' AND shop <> '' ORDER BY shop`),
      query<Row>(`SELECT code, pref_short, city_short FROM lg_code ORDER BY code`),
    ]);
    return {
      httpStatus: 200,
      body: { status: 'success', houses, shops, codes, categories: CATEGORIES, brands: OWNERS_HOUSE_BRANDS },
    };
  } catch (error) {
    logger.error(`owners_house_admin_list 失敗: ${(error as Error).message}`);
    return fail(500, '物件データの取得に失敗しました。');
  }
};

export const saveOwnersHouseAdmin = async (staff: AuthenticatedStaff | null, body: Record<string, unknown>): Promise<AdminResult> => {
  /**
   * ⚠️⚠️ 種別は本文の `house_category` で受ける。`category` で送ると、ゲートウェイが振り分けの鍵に使い
   *   （request + category）、該当なしで「ループ検知」の 502 になる。本文の category は読まない。
   */
  const source: Record<string, unknown> = { ...body, category: body.house_category };
  const values: Record<string, string> = {};
  for (const column of EDITABLE) {
    const raw = source[column];
    if (raw === undefined) continue;
    values[column] = typeof raw === 'string' ? raw.trim() : raw === null ? '' : String(raw);
  }

  if (values.category !== undefined && !CATEGORIES.includes(values.category)) return fail(400, '種別が不正です。');
  if (values.brand !== undefined && values.brand !== '' && !OWNERS_HOUSE_BRANDS.includes(values.brand)) return fail(400, 'ブランドが不正です。');
  if (values.flag !== undefined) values.flag = values.flag === '1' ? '1' : '0';

  const sets: string[] = [];
  const params: SqlParam[] = [];
  for (const [column, value] of Object.entries(values)) {
    if (column === 'lg_code') {
      sets.push('lg_code = ?');
      params.push(/^\d{6}$/.test(value) ? value : null);
      continue;
    }
    sets.push(`${column} = ?`);
    params.push(value);
  }
  if (values.lat_and_long !== undefined) {
    const latLng = values.lat_and_long === '' ? null : parseLatLng(values.lat_and_long);
    if (values.lat_and_long !== '' && latLng === null) return fail(400, '地図の位置が不正です。');
    sets.push('map_address = ?');
    params.push(latLng ? mapIframe(latLng) : '');
  }
  sets.push('updated_at = NOW()', 'updated_by = ?');
  params.push(staff?.name ?? '');

  const no = Number(body.no);
  try {
    if (Number.isInteger(no) && no > 0) {
      if (no === HEADER_ROW_NO) return fail(400, 'この行は直せません。');
      const result = await execute(`UPDATE ownershouse SET ${sets.join(', ')} WHERE no = ?`, [...params, no]);
      if (result.affectedRows === 0) return fail(404, '物件が見つかりません。');
      return { httpStatus: 200, body: { status: 'success', no } };
    }

    if (!values.category) return fail(400, '種別を選んでください。');
    // ⚠️ 新しい物件の id は、今ある id の最大 ＋ 1（8桁）。⚠️ text の NOT NULL 列は空文字で埋める
    const [{ next }] = await query<Row>(`SELECT LPAD(COALESCE(MAX(CAST(id AS UNSIGNED)), 0) + 1, 8, '0') AS next FROM ownershouse WHERE id REGEXP '^[0-9]+$'`);
    const id = String(next);
    const columns = ['id', 'feature_5', 'img_1', 'img_2', 'img_3', 'img_4', 'img_5', 'map_address'];
    const fill: Record<string, string> = { id, feature_5: '', img_1: '', img_2: '', img_3: '', img_4: '', img_5: '', map_address: '' };
    const allText = ['category', 'pref', 'area', 'name', 'title', 'brand', 'shop', 'shop_zip', 'shop_address', 'staff', 'tag',
      'feature_1', 'feature_2', 'feature_3', 'feature_4', 'lat_and_long', 'structure', 'large', 'plan', 'flag'];
    for (const c of allText) { columns.push(c); fill[c] = c === 'flag' ? '0' : ''; }
    const result = await execute(
      `INSERT INTO ownershouse (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((c) => fill[c]),
    );
    const newNo = result.insertId;
    await execute(`UPDATE ownershouse SET ${sets.join(', ')} WHERE no = ?`, [...params, newNo]);
    return { httpStatus: 200, body: { status: 'success', no: newNo, id } };
  } catch (error) {
    logger.error(`owners_house_admin_save 失敗 no=${body.no ?? '(新規)'}: ${(error as Error).message}`);
    return fail(500, '保存に失敗しました。');
  }
};
