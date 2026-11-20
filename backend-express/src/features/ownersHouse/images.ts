import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { logger } from '../../utils/logger';

/**
 * オーナーズハウスの画像（v2.2.285）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 置き場：② の owners-house-img ボリューム（env.ownersHouseImgDir）。公開：env.ownersHouseImgBase（app.ts の /owners_house/img）。
 * ⚠️ 名前の決まり：<物件ID>/<物件ID>_<枠番号2桁>_<中身の sha1 の頭6文字>.<jpg|png|webp>（例 00000002/00000002_01_3f9a1c.jpg）。
 *   ⚠️ 入れ替えると名前が変わるので、ブラウザが古い画像を出し続けない（公開は長くキャッシュさせている）。
 * ⚠️ 列（img_1〜img_14）にはファイル名だけを入れる。http で始まる値は引っ越し前の kh-house.jp の URL（そのまま返す）。
 *   1〜4 はメイン（1 は一覧・地図のサムネイル）、5〜14 は物件ページのカルーセル。
 * ⚠️ 受け取るのは JPEG / PNG / WebP だけ（先頭のバイトで確かめる。拡張子や申告の種類は信じない）。
 * ─────────────────────────────────────────────
 */

export const IMAGE_SLOTS = 14;
export const IMAGE_COLUMNS = Array.from({ length: IMAGE_SLOTS }, (_, i) => `img_${i + 1}`);
/** 1枚の上限（縮めずに送られても受けられる大きさ） */
const MAX_BYTES = 6 * 1024 * 1024;

interface Row extends RowDataPacket {
  [key: string]: unknown;
}

/** 列の値 → 公開URL（空はそのまま、http はそのまま、ファイル名は公開URLを前に付ける） */
export const toImageUrl = (value: unknown): string => {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v === '' || /^https?:\/\//.test(v)) return v;
  return env.ownersHouseImgBase + v.split('/').map(encodeURIComponent).join('/');
};

/** 物件の行の img_1〜img_14 を公開URLにした写し */
export const withImageUrls = <T extends Record<string, unknown>>(row: T): T => {
  const copy: Record<string, unknown> = { ...row };
  for (const c of IMAGE_COLUMNS) if (c in copy) copy[c] = toImageUrl(copy[c]);
  return copy as T;
};

/** 先頭のバイトから拡張子。対応していなければ null */
const detectExt = (buf: Buffer): 'jpg' | 'png' | 'webp' | null => {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
};

const isSafeId = (id: string): boolean => /^\d{1,12}$/.test(id);

/** 決まりどおりの名前 */
export const imageFileName = (id: string, slot: number, buf: Buffer, ext: string): string =>
  `${id}/${id}_${String(slot).padStart(2, '0')}_${createHash('sha1').update(buf).digest('hex').slice(0, 6)}.${ext}`;

/** 置き場に書く（フォルダが無ければ作る）。返り値は列に入れるファイル名 */
export const storeImage = async (id: string, slot: number, buf: Buffer): Promise<string> => {
  const ext = detectExt(buf);
  if (!ext) throw new Error('unsupported image');
  const name = imageFileName(id, slot, buf, ext);
  const full = path.join(env.ownersHouseImgDir, name);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return name;
};

/** 置き場のファイルを消す（ファイル名の値だけ。http の値・決まりに合わない値は触らない） */
const removeStored = async (value: string): Promise<void> => {
  if (!/^\d{1,12}\/\d{1,12}_\d{2}_[0-9a-f]{6}\.(jpg|png|webp)$/.test(value)) return;
  await unlink(path.join(env.ownersHouseImgDir, value)).catch(() => undefined);
};

export interface ImageResult {
  httpStatus: number;
  body: Record<string, unknown>;
}
const fail = (httpStatus: number, message: string): ImageResult => ({ httpStatus, body: { status: 'error', message } });

/**
 * 1枠の登録・入れ替え・削除（request: owners_house_admin_image）。
 *   本文：no（物件の連番）・slot（1〜14）・data（data:image/...;base64,... 。空なら削除）
 */
export const saveOwnersHouseImage = async (staff: AuthenticatedStaff | null, body: Record<string, unknown>): Promise<ImageResult> => {
  const no = Number(body.no);
  const slot = Number(body.slot);
  if (!Number.isInteger(no) || no <= 1) return fail(400, '物件が指定されていません。');
  if (!Number.isInteger(slot) || slot < 1 || slot > IMAGE_SLOTS) return fail(400, '画像の枠が不正です。');
  const column = `img_${slot}`;

  try {
    const rows = await query<Row>(`SELECT id, ${column} AS current FROM ownershouse WHERE no = ?`, [no]);
    if (rows.length === 0) return fail(404, '物件が見つかりません。');
    const id = String(rows[0].id ?? '');
    const current = String(rows[0].current ?? '');
    if (!isSafeId(id)) return fail(400, '物件の ID が不正です。');

    const data = typeof body.data === 'string' ? body.data : '';
    let next = '';
    if (data !== '') {
      const m = data.match(/^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return fail(400, '画像の形式が不正です。');
      const buf = Buffer.from(m[1], 'base64');
      if (buf.length === 0 || buf.length > MAX_BYTES) return fail(400, '画像が大きすぎます（6MB まで）。');
      if (!detectExt(buf)) return fail(400, 'JPEG・PNG・WebP の画像を選んでください。');
      next = await storeImage(id, slot, buf);
    }

    await execute(`UPDATE ownershouse SET ${column} = ?, updated_at = NOW(), updated_by = ? WHERE no = ?`, [next, staff?.name ?? '', no]);
    if (current !== next) await removeStored(current);
    return { httpStatus: 200, body: { status: 'success', slot, value: next, url: toImageUrl(next) } };
  } catch (error) {
    logger.error(`owners_house_admin_image 失敗 no=${no} slot=${slot}: ${(error as Error).message}`);
    return fail(500, '画像の保存に失敗しました。');
  }
};

/**
 * 引っ越し（cli/ownersHouseMigrateImages.ts から1回呼ぶ）。
 *   img_1〜img_14 のうち http で始まる値の画像を取ってきて置き場に置き、列をファイル名に書き換える。
 *   ⚠️ 何度実行してもよい（済んだ列はファイル名なので飛ばす）。⚠️ 取れなかった画像は URL のまま残し、件数を返す。
 */
export const migrateOwnersHouseImages = async (log: (line: string) => void): Promise<{ moved: number; failed: number }> => {
  const houses = await query<Row>(`SELECT no, id, ${IMAGE_COLUMNS.join(', ')} FROM ownershouse WHERE no > 1 ORDER BY no`);
  let moved = 0;
  let failed = 0;
  for (const h of houses) {
    const id = String(h.id ?? '');
    if (!isSafeId(id)) continue;
    for (let slot = 1; slot <= IMAGE_SLOTS; slot++) {
      const value = String(h[`img_${slot}`] ?? '').trim();
      if (!/^https?:\/\//.test(value)) continue;
      try {
        const res = await fetch(value, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const name = await storeImage(id, slot, buf);
        await execute(`UPDATE ownershouse SET img_${slot} = ? WHERE no = ? AND img_${slot} = ?`, [name, Number(h.no), value]);
        moved++;
        log(`OK  ${id} 画像${slot} → ${name}`);
      } catch (error) {
        failed++;
        log(`NG  ${id} 画像${slot} ${value}: ${(error as Error).message}`);
      }
    }
  }
  return { moved, failed };
};
