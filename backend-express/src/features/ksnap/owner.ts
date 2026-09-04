import { Buffer } from 'node:buffer';
import { createCipheriv } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * 公開ギャラリーに返す owner の決定論的暗号化。
 *
 * 移植元: backend/src/core/ksnap.php の ksnapEncryptOwner()
 *
 * ⚠️ 固定IVを使うため「同じ入力 → 常に同じ暗号文」になる。これは意図した仕様。
 *   フロントが owner でグループ化・絞り込みを行うため、毎回変わると機能しない。
 *   その代償として「同じ人かどうか」は第三者にも分かる。
 *
 * ⚠️⚠️ PHP と**バイト単位で同じ結果**を出さなければならない。
 *   異なると、公開ギャラリーの絞り込みが ① 経由と ② 経由で食い違う。
 *   下記2点が落とし穴。
 */

const ALGORITHM = 'aes-256-cbc';

/** aes-256 の鍵長 */
const KEY_BYTES = 32;
/** CBC の IV 長 */
const IV_BYTES = 16;

/**
 * 鍵とIVを OpenSSL と同じ長さに整える。
 *
 * ⚠️⚠️ ここが最大の落とし穴。
 *
 *   PHP の openssl_encrypt() は、鍵が32バイトに足りない場合**NULLバイトで埋め**、
 *   長い場合は**切り捨てる**。IV も同様。
 *   一方 Node の createCipheriv() は長さが違うと**例外を投げる**。
 *
 *   移行元の鍵は 31バイトで、32バイトではない（コメントには32と書かれているが
 *   実際は1バイト足りない）。そのまま渡すと Node は落ち、
 *   長さを合わせても詰め方が違えば別の暗号文になる。
 *   **NULL埋め・切り捨てを明示的に再現すること。**
 */
const fitLength = (value: string, length: number): Buffer => {
  const raw = Buffer.from(value, 'binary');
  if (raw.length === length) return raw;

  if (raw.length > length) return raw.subarray(0, length);

  const padded = Buffer.alloc(length, 0);
  raw.copy(padded);
  return padded;
};

/**
 * owner を暗号化する。設定が無い場合や失敗時は空文字。
 *
 * ⚠️ 未設定のときに平文を返してはいけない。氏名がそのまま公開される。
 *   PHP 側と同じく空文字にして、原因はログへ残す。
 */
export const encryptOwner = (value: string): string => {
  if (value === '') return '';

  const { ownerKey, ownerIv } = env.ksnap;
  if (ownerKey === undefined || ownerIv === undefined) {
    logger.error('ksnap: KSNAP_OWNER_KEY / KSNAP_OWNER_IV が未設定です');
    return '';
  }

  try {
    const cipher = createCipheriv(
      ALGORITHM,
      fitLength(ownerKey, KEY_BYTES),
      fitLength(ownerIv, IV_BYTES)
    );

    // ⚠️ PHP の openssl_encrypt は既定で base64 の文字列を返す。
    //   さらに移植元がその結果をもう一度 base64_encode している（二重）。
    //   仕様として揃えるため、ここでも二重にする。
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const base64Once = encrypted.toString('base64');
    return Buffer.from(base64Once, 'utf8').toString('base64');
  } catch (error) {
    logger.error(`ksnap: owner の暗号化に失敗しました ${(error as Error).message}`);
    return '';
  }
};

/** 取得した行の owner を暗号化済みに差し替える */
export const encryptOwnerColumn = (
  rows: Record<string, unknown>[]
): Record<string, unknown>[] =>
  rows.map((row) => {
    if (!('owner' in row)) return row;
    return { ...row, owner: encryptOwner(String(row.owner ?? '')) };
  });
