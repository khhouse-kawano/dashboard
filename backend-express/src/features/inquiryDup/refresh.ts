import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../../db/pool';
import { logger } from '../../utils/logger';
import { DUP_BRANDS, DUP_TABLES, keyHash, mailDomain, mailKey, mobileKey } from './keys';
import type { DupBrand } from './keys';

/**
 * 重複判定の表（inquiry_dup_key）を最新にする（v2.2.276。② だけ）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ 反響が入る・変わる経路は ①②・GAS・phpMyAdmin を合わせて 40 近くある。
 *   ⚠️ 経路ごとに表を直すと必ず漏れるので、⚠️ **読む側で確かめて作り直す**。
 *   1. 3つの反響の表と除外の名簿の「指紋」（件数・最大 id・氏名/メール/携帯の CRC の XOR）を取る（約30ms）
 *   2. 前回と同じなら何もしない
 *   3. 変わっていたら、全件の鍵と重複件数を計算し直し、⚠️ 変わった行だけを書く（1つのトランザクション）
 *   呼ぶところ: 反響一覧（list）と重複の詳細（inquiryDup）の冒頭、10分ごとの安全網（startInquiryDupScheduler）
 * ⚠️ 個人情報削除（privacy_erase）で値が伏せられると指紋が変わるので、次に読んだときに相手から外れる。
 *
 * ⚠️ 除外の名簿（inquiry_dup_exclude）: 社員のテストの値など。⚠️ 値はハッシュ（SHA2(正規化した値, 256)）で持つ。
 *   kind = 'mail' / 'mobile' / 'domain'（メールの @ の後ろ）。
 *   ⚠️ 名簿のメールを持つ行の携帯も除外する（逆も）。⚠️ 社員がテストに使った携帯を1件ずつ登録しなくて済むように。
 * ─────────────────────────────────────────────
 */

interface SourceRow extends RowDataPacket {
  id: number;
  mail: string | null;
  mobile: string | null;
}

interface KeyRow extends RowDataPacket {
  brand: DupBrand;
  src_id: number;
  mail_key: string | null;
  mobile_key: string | null;
  dup_count: number;
}

interface ExcludeRow extends RowDataPacket {
  kind: string;
  key_hash: string;
}

interface FingerprintRow extends RowDataPacket {
  t: string;
  n: number;
  max_id: number | null;
  x: string | number | null;
}

/** 表に入れる1行（作り直した結果） */
interface Computed {
  brand: DupBrand;
  srcId: number;
  mail: string | null;
  mobile: string | null;
  count: number;
}

/** ⚠️ 1回の INSERT / DELETE に入れる行の数 */
const BATCH = 500;
/** 安全網の間隔 */
const INTERVAL_MS = 10 * 60_000;

const fingerprintSql = (): string => [
  ...DUP_BRANDS.map((brand) =>
    `SELECT '${brand}' AS t, COUNT(*) AS n, MAX(id) AS max_id, BIT_XOR(CRC32(CONCAT_WS(0x1f, id, first_name, mail, mobile))) AS x FROM ${DUP_TABLES[brand]}`),
  `SELECT 'exclude', COUNT(*), MAX(id), BIT_XOR(CRC32(CONCAT_WS(0x1f, id, kind, key_hash))) FROM inquiry_dup_exclude`,
].join(' UNION ALL ');

const fingerprint = async (): Promise<string> => {
  const rows = await query<FingerprintRow>(fingerprintSql());
  return rows.map((r) => `${r.t}:${r.n}:${r.max_id ?? ''}:${r.x ?? ''}`).join('|');
};

/** 全件の鍵と重複件数（⚠️ 自分を除いた相手の数。メールと携帯の両方で同じ相手は1件） */
const computeAll = async (): Promise<Computed[]> => {
  const [excludeRows, ...sources] = await Promise.all([
    query<ExcludeRow>('SELECT kind, key_hash FROM inquiry_dup_exclude'),
    // ⚠️ 反響一覧と同じく氏名の無い行は対象外
    ...DUP_BRANDS.map((brand) => query<SourceRow>(`SELECT id, mail, mobile FROM ${DUP_TABLES[brand]} WHERE first_name <> ''`)),
  ]);
  const excluded = new Set(excludeRows.map((r) => `${r.kind}:${r.key_hash.toLowerCase()}`));

  const rows: Computed[] = [];
  DUP_BRANDS.forEach((brand, i) => {
    for (const r of sources[i]) {
      rows.push({ brand, srcId: Number(r.id), mail: mailKey(r.mail), mobile: mobileKey(r.mobile), count: 0 });
    }
  });

  // ⚠️ 名簿に載ったメール・携帯と、⚠️ それと同じ行にある相方（メール ↔ 携帯）を外す
  const mailListed = (m: string) => excluded.has(`mail:${keyHash(m)}`) || excluded.has(`domain:${keyHash(mailDomain(m))}`);
  const mobileListed = (m: string) => excluded.has(`mobile:${keyHash(m)}`);
  const dropMails = new Set<string>();
  const dropMobiles = new Set<string>();
  for (const r of rows) {
    const mailOut = r.mail !== null && mailListed(r.mail);
    const mobileOut = r.mobile !== null && mobileListed(r.mobile);
    if (!mailOut && !mobileOut) continue;
    if (r.mail !== null) dropMails.add(r.mail);
    if (r.mobile !== null) dropMobiles.add(r.mobile);
  }
  for (const r of rows) {
    if (r.mail !== null && dropMails.has(r.mail)) r.mail = null;
    if (r.mobile !== null && dropMobiles.has(r.mobile)) r.mobile = null;
  }

  // 鍵 → 行の番号
  const byMail = new Map<string, number[]>();
  const byMobile = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (r.mail !== null) (byMail.get(r.mail) ?? byMail.set(r.mail, []).get(r.mail)!).push(i);
    if (r.mobile !== null) (byMobile.get(r.mobile) ?? byMobile.set(r.mobile, []).get(r.mobile)!).push(i);
  });
  rows.forEach((r, i) => {
    const partners = new Set<number>([
      ...(r.mail !== null ? byMail.get(r.mail) ?? [] : []),
      ...(r.mobile !== null ? byMobile.get(r.mobile) ?? [] : []),
    ]);
    partners.delete(i);
    r.count = partners.size;
  });
  return rows;
};

/** 表を計算結果に合わせる（⚠️ 変わった行だけ書く）。戻り値は書いた行と消した行の数 */
const applyDiff = async (rows: Computed[]): Promise<{ upserted: number; deleted: number }> =>
  withTransaction(async (tx) => {
    const current = await tx.query<KeyRow>('SELECT brand, src_id, mail_key, mobile_key, dup_count FROM inquiry_dup_key');
    const now = new Map(current.map((r) => [`${r.brand}:${r.src_id}`, r]));

    const changed = rows.filter((r) => {
      const old = now.get(`${r.brand}:${r.srcId}`);
      return old === undefined || old.mail_key !== r.mail || old.mobile_key !== r.mobile || Number(old.dup_count) !== r.count;
    });
    const alive = new Set(rows.map((r) => `${r.brand}:${r.srcId}`));
    const gone = current.filter((r) => !alive.has(`${r.brand}:${r.src_id}`));

    for (let i = 0; i < changed.length; i += BATCH) {
      const part = changed.slice(i, i + BATCH);
      await tx.execute(
        `INSERT INTO inquiry_dup_key (brand, src_id, mail_key, mobile_key, dup_count) VALUES ${part.map(() => '(?, ?, ?, ?, ?)').join(', ')}
         ON DUPLICATE KEY UPDATE mail_key = VALUES(mail_key), mobile_key = VALUES(mobile_key), dup_count = VALUES(dup_count)`,
        part.flatMap((r) => [r.brand, r.srcId, r.mail, r.mobile, r.count])
      );
    }
    for (let i = 0; i < gone.length; i += BATCH) {
      const part = gone.slice(i, i + BATCH);
      await tx.execute(
        `DELETE FROM inquiry_dup_key WHERE (brand, src_id) IN (${part.map(() => '(?, ?)').join(', ')})`,
        part.flatMap((r) => [r.brand, r.src_id])
      );
    }
    return { upserted: changed.length, deleted: gone.length };
  });

let lastFingerprint: string | null = null;
let running: Promise<void> | null = null;

const run = async (force: boolean): Promise<void> => {
  const fp = await fingerprint();
  if (!force && fp === lastFingerprint) return;
  const started = Date.now();
  const result = await applyDiff(await computeAll());
  // ⚠️ 計算の前に取った指紋を残す（⚠️ 計算中に変わった分は、次に呼ばれたとき指紋が違うので作り直される）
  lastFingerprint = fp;
  if (result.upserted > 0 || result.deleted > 0) {
    logger.info(`inquiryDup: 重複判定の表を更新しました（書いた ${result.upserted} 行・消した ${result.deleted} 行・${Date.now() - started}ms）`);
  }
};

/**
 * 重複判定の表を最新にする。⚠️ 同時に呼ばれたら、走っている1回を待つ（二重に作り直さない）。
 * @param force 指紋が同じでも計算し直す（安全網）
 */
export const refreshDupKeys = (force = false): Promise<void> => {
  if (running === null) {
    running = run(force).finally(() => { running = null; });
  }
  return running;
};

/**
 * 呼び出し側（一覧・詳細）用。⚠️ 作り直しに失敗しても例外を外に出さない（表に残っている件数で返す）。
 */
export const refreshDupKeysSafely = async (): Promise<void> => {
  try {
    await refreshDupKeys();
  } catch (error) {
    logger.error('inquiryDup: 重複判定の表の更新に失敗しました（前の件数のまま返します）', error);
  }
};

/** 10分ごとの安全網（⚠️ 指紋に関係なく計算し直す。⚠️ 変わっていなければ何も書かない） */
export const startInquiryDupScheduler = (): void => {
  const tick = (force: boolean): void => {
    refreshDupKeys(force).catch((error: unknown) => logger.error('inquiryDup: 定期の更新に失敗しました', error));
  };
  // ⚠️ 起動の直後に1回（⚠️ 表が空のときに最初の画面を待たせない）
  tick(false);
  setInterval(() => tick(true), INTERVAL_MS).unref();
  logger.info('inquiryDup: 重複判定の表の定期更新を始めます（10分ごと）');
};
