import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { logger } from '../../utils/logger';

/**
 * オーナーズハウス・モデルハウスの物件（ownershouse）。（v2.2.283）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 読む画面: react/owners_house（kh-house.jp/owners_house/）の Map.tsx（一覧）・Owners.tsx（1件）。ブラウザから直接。
 * ⚠️ 移植元: kh-house.jp/owners_house/api/（request: owners_house / owners_id。khgweb_ownwershouse の ownershouse）。
 *   ⚠️ 2026-11-18 から、物件データの元は ① の DB（Dashboard と同じ）の ownershouse にする。管理画面は Dashboard に後で作る。
 * ⚠️ 公開してよい物件情報だけの表（個人情報は無い）なので認証なし。⚠️ 表示するのは flag = 1 の行だけ。
 * ⚠️ 応答の形は移植元と同じ（{ status, data }。1件で見つからないときは data: false）。
 * ⚠️ 移植元は no = 1 に列名が入った見出しの行（category = 'category'）も返していた。画面は category で絞るので出ない。形を変えないため、そのまま返す。
 * ─────────────────────────────────────────────
 */

interface HouseRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 返す列（⚠️ 表の全列。足したらここにも足す） */
const COLUMNS = [
  'no', 'id', 'category', 'pref', 'area', 'name', 'title', 'brand', 'shop', 'shop_zip', 'shop_address', 'staff', 'tag',
  'feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5', 'img_1', 'img_2', 'img_3', 'img_4', 'img_5',
  'map_address', 'lat_and_long', 'structure', 'large', 'plan', 'flag',
].join(', ');

export interface HouseResult {
  httpStatus: number;
  body: { status: 'success' | 'error'; data?: unknown; message?: string };
}

/** 一覧（request: owners_house_list） */
export const listOwnersHouses = async (): Promise<HouseResult> => {
  try {
    const rows = await query<HouseRow>(`SELECT ${COLUMNS} FROM ownershouse WHERE flag = '1' ORDER BY no`);
    return { httpStatus: 200, body: { status: 'success', data: rows } };
  } catch (error) {
    logger.error(`owners_house_list 失敗: ${(error as Error).message}`);
    return { httpStatus: 500, body: { status: 'error', message: '物件データの取得に失敗しました。' } };
  }
};

/** 1件（request: owners_house_detail。本文の id） */
export const getOwnersHouse = async (body: Record<string, unknown>): Promise<HouseResult> => {
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (id === '') return { httpStatus: 400, body: { status: 'error', message: '物件が指定されていません。' } };
  try {
    const rows = await query<HouseRow>(`SELECT ${COLUMNS} FROM ownershouse WHERE id = ? AND flag = '1' LIMIT 1`, [id]);
    return { httpStatus: 200, body: { status: 'success', data: rows[0] ?? false } };
  } catch (error) {
    logger.error(`owners_house_detail 失敗 id=${id}: ${(error as Error).message}`);
    return { httpStatus: 500, body: { status: 'error', message: '物件データの取得に失敗しました。' } };
  }
};
