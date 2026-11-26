import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../db/pool';
import { logger } from '../utils/logger';
import { syncKeyMatches } from './syncLog';

/**
 * 物件DB（property_db）をポータルのデータで補う（v2.2.301。request property_db_portal）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送り元は sync の summary の処理（SUUMO・HOME'S・at home の管理画面の書き出し）。① へ送る今までの送信のあとに、ここへも送る。
 *   ⚠️ sync が ② へ直接送る（① を通さない。① の express_proxy.php にも入れない）。ログイン無し・合い言葉（SYNC_LOG_SECRET）。
 *   ⚠️ 合い言葉の総当たりは publicFormRateLimit.ts の syncLogLimiter（失敗だけを数える）。
 * ⚠️ どの物件かは、いえらぶの6桁の物件番号で決める（property_db.property_id。UNIQUE）。
 *   SUUMO … management_no（貴社物件管理NO）がそのまま6桁
 *   HOME'S … company_management_number（自社管理番号）がそのまま6桁
 *   at home … management_no（管理番号）が 355050000＋6桁（⚠️ 6桁だけのときもそのまま使う）
 *   ⚠️ 番号が読めない行は飛ばす（数を返す）。⚠️ 番号の無い行で物件を作らない（作ると重複する。realty-handoff.md の決まり）。
 * ⚠️⚠️ 書き換えの範囲（2026-11-25 の決定：b）
 *   ・物件DB にある物件 … 空の列（NULL か ''）だけを埋める。⚠️ 値の入っている列は上書きしない（いえらぶの値を正とする）
 *   ・物件DB に無い物件 … アカウントの店舗（建売＝本店・中古＝中古住宅専門店）で新しく作る
 *     ⚠️ registered（取得日）は、その店舗の今の最新の取得日にする（物件DB の「契約済み」は「最新の取得日でない物件」なので、
 *       今日の日付にすると、ほかの物件がすべて契約済みに見えてしまう）
 *     ⚠️ price_raw（価格の履歴）は、作るときの1件目だけ入れる
 * ⚠️ 書式はいえらぶにそろえる（価格は「900万円」、面積は「67.99㎡」、交通は「路線「駅」駅 徒歩5分」）。
 *   ⚠️ 築年（HOME'S は「48年」＝築年数、いえらぶは「1978年12月」）と種別（「マンション」と「中古マンション」）は書き方が違うので使わない。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface PortalResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

type Portal = 'suumo' | 'homes' | 'athome';

/** アカウント → 物件DB の店舗名（⚠️ property_db.store_name の今の値と1文字も違わないこと。本店は全角の空白） */
const STORE_OF_ACCOUNT: Record<string, string> = {
  kaeru: '株式会社　国分ハウジング不動産　本店',
  spec: '株式会社　国分ハウジング不動産　本店',
  resale: '国分ハウジンググループ中古住宅専門店',
  used: '国分ハウジンググループ中古住宅専門店',
};

/** 1回に受ける行の上限（sync は 500件ずつ送る） */
const MAX_ROWS = 500;

/** 補う列（⚠️ ここに無い列は書かない） */
const FILL_COLUMNS = ['property_name', 'room_number', 'address', 'layout', 'building_area', 'transportation', 'price'] as const;
type FillColumn = (typeof FILL_COLUMNS)[number];
type Fill = Partial<Record<FillColumn, string>> & { yen?: number };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number | null => {
  const s = str(v).replace(/[,，\s]/g, '');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};
/** 円 → いえらぶの書き方（900万円。⚠️ 万円未満は切り捨て、桁区切りは付けない） */
const manYen = (yen: number): string => `${Math.floor(yen / 10000)}万円`;

/** 行から物件番号（6桁）。⚠️ 読めなければ '' */
export const propertyIdOf = (portal: Portal, row: Record<string, unknown>): string => {
  if (portal === 'suumo') { const v = str(row.management_no); return /^\d{6}$/.test(v) ? v : ''; }
  if (portal === 'homes') { const v = str(row.company_management_number); return /^\d{6}$/.test(v) ? v : ''; }
  const v = str(row.management_no);
  if (/^355050000\d{6}$/.test(v)) return v.slice(9);
  return /^\d{6}$/.test(v) ? v : '';
};

/** 行から補う値（いえらぶの書式にそろえる）。⚠️ 読めない値は入れない */
export const fillOf = (portal: Portal, row: Record<string, unknown>): Fill => {
  const fill: Fill = {};
  const set = (col: FillColumn, value: string) => { if (value !== '') fill[col] = value; };
  set('address', str(row.address));
  if (portal === 'suumo') {
    const yen = num(row.min_price);
    if (yen !== null && yen > 0) { fill.price = manYen(yen); fill.yen = yen; }
  }
  if (portal === 'homes') {
    set('property_name', str(row.property_name));
    set('room_number', str(row.room_section));
    set('layout', str(row.layout));
    const area = num(row.exclusive_area);
    if (area !== null && area > 0) fill.building_area = `${area}㎡`;
    const line = str(row.railway_line);
    const station = str(row.station);
    const walk = num(row.walk_minutes);
    if (line !== '' && station !== '' && walk !== null) fill.transportation = `${line}「${station}」駅 徒歩${walk}分`;
    const m = /^(\d+(?:\.\d+)?)万$/.exec(str(row.price_rent));
    if (m) { fill.price = `${m[1]}万円`; fill.yen = Math.round(Number(m[1]) * 10000); }
  }
  if (portal === 'athome') {
    set('property_name', str(row.building_name));
    set('transportation', str(row.line_station));
    const man = num(row.price_man_yen);
    if (man !== null && man > 0) { fill.price = `${man}万円`; fill.yen = Math.round(man * 10000); }
  }
  return fill;
};

const isEmpty = (v: unknown): boolean => v === null || v === undefined || String(v).trim() === '';

const today = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
};

const fail = (httpStatus: number, message: string): PortalResult => ({ httpStatus, body: { status: 'error', message } });

/**
 * property_db_portal。body = { key, portal: 'suumo' | 'homes' | 'athome', account: 'kaeru' | 'resale' | 'spec' | 'used', rows: [...] }
 * rows は sync が ① の summary へ送る行と同じ形（列の名前は suumo_resale_summary・homes_summary_db・athome_summary_db と同じ）。
 */
export const importPropertyFromPortal = async (body: Record<string, unknown>): Promise<PortalResult> => {
  if (!syncKeyMatches(str(body.key))) return fail(401, '合い言葉が正しくありません');
  const portal = str(body.portal) as Portal;
  if (!['suumo', 'homes', 'athome'].includes(portal)) return fail(400, 'portal が正しくありません');
  const store = STORE_OF_ACCOUNT[str(body.account)];
  if (!store) return fail(400, 'account が正しくありません');
  if (!Array.isArray(body.rows)) return fail(400, 'rows がありません');
  if (body.rows.length > MAX_ROWS) return fail(400, `rows は ${MAX_ROWS} 件までです`);

  // ⚠️ 同じ番号が2行あれば、あとの行を使う（書き出しの並びで新しい方）
  const byId = new Map<string, Fill>();
  let skipped = 0;
  for (const raw of body.rows) {
    if (typeof raw !== 'object' || raw === null) { skipped++; continue; }
    const id = propertyIdOf(portal, raw as Record<string, unknown>);
    if (id === '') { skipped++; continue; }
    byId.set(id, fillOf(portal, raw as Record<string, unknown>));
  }
  if (byId.size === 0) return { httpStatus: 200, body: { status: 'success', updated: 0, inserted: 0, unchanged: 0, skipped, filled: 0 } };

  const ids = [...byId.keys()];
  const marks = ids.map(() => '?').join(', ');
  const [existing, latest] = await Promise.all([
    query<DynamicRow>(`SELECT property_id, ${FILL_COLUMNS.join(', ')}, price_raw FROM property_db WHERE property_id IN (${marks})`, ids),
    query<DynamicRow>('SELECT MAX(registered) AS r FROM property_db WHERE store_name = ?', [store]),
  ]);
  const registered = str(latest[0]?.r) || today();
  const found = new Map(existing.map((r) => [str(r.property_id), r]));

  let updated = 0;
  let inserted = 0;
  let unchanged = 0;
  let filled = 0;
  await withTransaction(async (tx) => {
    for (const [id, fill] of byId) {
      const row = found.get(id);
      if (row) {
        // ⚠️ 空の列だけ埋める
        const cols = FILL_COLUMNS.filter((c) => fill[c] !== undefined && isEmpty(row[c]));
        const values: string[] = cols.map((c) => fill[c] as string);
        let priceRaw: string | null = null;
        if (isEmpty(row.price_raw) && fill.yen !== undefined) priceRaw = JSON.stringify([{ date: today(), value: String(fill.yen) }]);
        if (cols.length === 0 && priceRaw === null) { unchanged++; continue; }
        const sets = [...cols.map((c) => `${c} = ?`), ...(priceRaw !== null ? ['price_raw = ?'] : [])];
        await tx.execute(`UPDATE property_db SET ${sets.join(', ')} WHERE property_id = ?`, [...values, ...(priceRaw !== null ? [priceRaw] : []), id]);
        updated++;
        filled += cols.length + (priceRaw !== null ? 1 : 0);
      } else {
        const cols = FILL_COLUMNS.filter((c) => fill[c] !== undefined);
        const priceRaw = fill.yen !== undefined ? JSON.stringify([{ date: today(), value: String(fill.yen) }]) : null;
        const names = ['property_id', 'store_name', 'registered', ...cols, ...(priceRaw !== null ? ['price_raw'] : [])];
        const values = [id, store, registered, ...cols.map((c) => fill[c] as string), ...(priceRaw !== null ? [priceRaw] : [])];
        // ⚠️ 同時に別の送信で作られていたら何もしない（UNIQUE の property_id）
        const result = await tx.execute(
          `INSERT INTO property_db (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE property_id = property_id`,
          values
        );
        if (result.affectedRows === 1) inserted++;
        else unchanged++;
      }
    }
  });

  const summary = { status: 'success', portal, account: str(body.account), updated, inserted, unchanged, skipped, filled };
  logger.info(`property_db_portal ${JSON.stringify(summary)}`);
  return { httpStatus: 200, body: summary };
};
