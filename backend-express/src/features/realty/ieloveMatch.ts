import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { uid } from './calls';
import { fullAddress, normPlace } from './propertyKey';
import type { Result } from './index';

/**
 * 媒介獲得台帳 ⇔ いえらぶの物件（property_db）⇔ 買い反響 のつながり（v2.2.258）。
 *
 * ─────────────────────────────────────────────
 *   ① 台帳 → いえらぶ（台帳の property_db_id が空のもの）
 *      中古住宅専門店のいえらぶの物件と、所在地（propertyKeyRules.json でそろえる）・種別・マンションは建物名と部屋で比べる。
 *      ・当てはまるのが1件だけで、ほかの台帳につながっていない → 自動でつなぐ（property_db_match = 'auto'）
 *      ・2件以上・番地の細かさが違う・種別が違う → 「要確認」（画面で選ぶ。broker:ielove_candidates）
 *      ・スタッフが選んだ（'staff'）・「該当なし」（'none'）の台帳は変えない
 *   ② 買い反響 → 台帳（買い反響の ledgerId が空のもの）
 *      extId → 取り込み元の行（suumo・homes・athome の *_db_resale）の自社の物件番号＝いえらぶの番号 → その番号の台帳
 *        SUUMO   suumo:{sequence_no}            … suumo_db_resale.company_property_code（6桁）
 *        HOME'S  homes:{userId}                 … homes_db_resale.companyId（6桁）
 *        athome  athome:{athome_property_id}:…  … athome_db_resale.company_property_id（355050000＋6桁）
 *
 * いつ動くか: ② の起動の1分後と30分ごと（startIeloveMatch）、台帳の保存の直後（index.ts の runBrokerUpdate）、
 *   画面の「今すぐ突き合わせ」（broker:ielove_match）。
 *
 * ⚠️ いえらぶの番号を空けたまま property_db に行を作らない（利用者と決めた。property_db はいえらぶの写しで、
 *   取り込み（property_db_update.php）が property_id で上書きするため、先に作った行と二重になる）。
 *   台帳が先に登録されても、いえらぶに載った次の突き合わせでつながる。
 * ⚠️ projects/sync・① の取り込み（handlers/portal/*_resale.php・property_db_update.php）は変えない。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 不動産企画係の物件の店舗名（いえらぶの担当店舗。利用者の決定） */
const IELOVE_STORE = '国分ハウジンググループ中古住宅専門店';
const FIRST_DELAY_MS = 60_000;
const INTERVAL_MS = 30 * 60 * 1000;
/** 自動でつないだときの記録の「誰が」 */
const AUTO_BY = '自動（いえらぶ突き合わせ）';
/** 画面に出す候補の最大 */
const MAX_CANDIDATES = 8;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const isActive = (r: DynamicRow): boolean => r.show_dashboard === null || Number(r.show_dashboard) !== 0;

/** 台帳の種別 → いえらぶの物件種別。⚠️ 無い種別（空・その他）は、種別で絞らない */
const CATEGORY_TYPES: Record<string, string[]> = {
  戸建: ['中古一戸建て', '新築一戸建て'],
  マンション: ['中古マンション'],
  住宅用地: ['売地'],
  賃収マンション: ['マンション（建物全部）', 'アパート'],
  '賃収・事業用': ['アパート', 'ビル（建物全部）', 'マンション（建物全部）', '売地'],
};
const isMansion = (ledgerCategory: string, propertyType: string): boolean =>
  ledgerCategory === 'マンション' || propertyType === '中古マンション';

/** URL（地図のリンク）を除いてそろえる */
const placeOf = (v: unknown): string => normPlace(str(v).replace(/https?:\/\/\S+/g, ''));
/** 物件名・部屋番号の「(公開)」「（非公開）」を除いてそろえる */
const nameOf = (v: unknown): string => normPlace(str(v).replace(/[(（][^)）]*公開[)）]/g, ''));
/** 部屋番号（「号室」を除く） */
const roomOf = (v: unknown): string => nameOf(v).replace(/室$/, '');

/**
 * 所在地の近さ。L＝台帳、A＝いえらぶ（どちらもそろえたもの）
 *   exact … 同じ。または台帳のほうが後ろに建物名などを足しただけ（続きが数字・「-」でない）
 *   near  … 片方が番地の途中までしか無い（1-33 と 1-33-30）。自動ではつながない
 */
type Closeness = 'exact' | 'near' | 'none';
const closeness = (l: string, a: string): Closeness => {
  if (!l || !a || !/[0-9]/.test(a) || !/[0-9]/.test(l)) return 'none';
  if (l === a) return 'exact';
  if (l.startsWith(a)) return /^[0-9-]/.test(l.slice(a.length)) ? (l[a.length] === '-' ? 'near' : 'none') : 'exact';
  if (a.startsWith(l) && a[l.length] === '-') return 'near';
  return 'none';
};

type Candidate = {
  property_id: string;
  property_name: string;
  property_type: string;
  address: string;
  room_number: string;
  price: string;
  /** strong＝自動でつなげる一致、weak＝要確認（番地の細かさ・種別・建物名の違い） */
  level: 'strong' | 'weak';
  /** なぜ候補か（画面の表示用） */
  reason: string;
  /** ほかの台帳につながっていれば、その台帳 No. */
  takenNo: string;
};

type LedgerPlace = { id: string; no: string; category: string; addr: string; building: string; room: string };
type Ielove = DynamicRow & { property_id: string };

/** 台帳と、その媒介物件（realty_properties。v2.2.250）から、比べる場所を作る */
const ledgerPlaceOf = (l: DynamicRow, props: Map<string, DynamicRow>): LedgerPlace => {
  const p = props.get(str(l.propertyId));
  return {
    id: str(l.id),
    no: str(l.no),
    category: str(l.category).trim(),
    addr: placeOf(p?.addr ?? fullAddress(l.addr1, l.addr2)),
    building: nameOf(p?.building_name ?? l.addr),
    room: roomOf(p?.room_no),
  };
};

/** 台帳1件の候補（強い順・同じ強さなら番号の新しい順） */
const candidatesOf = (lp: LedgerPlace, ieloves: Ielove[], takenBy: Map<string, DynamicRow>): Candidate[] => {
  const types = CATEGORY_TYPES[lp.category];
  const out: Candidate[] = [];
  for (const p of ieloves) {
    const c = closeness(lp.addr, placeOf(p.address));
    if (c === 'none') continue;
    const type = str(p.property_type);
    const reasons: string[] = [];
    let strong = c === 'exact';
    if (c === 'near') reasons.push('番地の細かさが違う');
    if (types && !types.includes(type)) { strong = false; reasons.push(`種別が違う（台帳 ${lp.category}）`); }
    if (isMansion(lp.category, type)) {
      const pr = roomOf(p.room_number);
      if (lp.room && pr && /[0-9]/.test(pr) && lp.room !== pr) continue; // ⚠️ 同じ建物の別の部屋
      const pb = nameOf(p.property_name);
      if (lp.building && pb && !lp.building.includes(pb) && !pb.includes(lp.building) && !lp.addr.includes(pb)) {
        strong = false;
        reasons.push('建物名が違う');
      }
    }
    const taken = takenBy.get(p.property_id);
    const takenNo = taken && str(taken.id) !== lp.id ? str(taken.no) || '―' : '';
    out.push({
      property_id: p.property_id,
      property_name: str(p.property_name),
      property_type: type,
      address: str(p.address),
      room_number: str(p.room_number),
      price: str(p.price),
      level: strong ? 'strong' : 'weak',
      reason: reasons.length ? reasons.join('・') : '所在地・種別が一致',
      takenNo,
    });
  }
  return out.sort((a, b) => (a.level === b.level ? b.property_id.localeCompare(a.property_id) : a.level === 'strong' ? -1 : 1));
};

/** 突き合わせに使う行を読む */
const loadAll = async () => {
  const [ledgers, ieloveRows, props] = await Promise.all([
    query<DynamicRow>(
      `SELECT \`id\`, \`no\`, category, addr1, addr2, addr, seller, propStatus, propertyId,
              property_db_id, property_db_name, property_db_match, show_dashboard
         FROM brokerage_listings WHERE kind = 'ledger'`
    ),
    query<DynamicRow>(
      `SELECT property_id, property_name, property_type, address, room_number, price
         FROM property_db
        WHERE REPLACE(REPLACE(store_name, ' ', ''), '　', '') = ? AND property_id IS NOT NULL AND property_id <> ''`,
      [IELOVE_STORE]
    ),
    query<DynamicRow>('SELECT id, addr, building_name, room_no FROM realty_properties'),
  ]);
  const active = ledgers.filter(isActive);
  /** いえらぶの番号 → つながっている台帳（媒介終了は、ほかの台帳が同じ物件につなげるように数えない） */
  const takenBy = new Map<string, DynamicRow>();
  for (const l of active) {
    const pid = str(l.property_db_id);
    if (pid && str(l.propStatus) !== '媒介終了') takenBy.set(pid, l);
  }
  return {
    ledgers: active,
    ieloves: ieloveRows.map((r) => ({ ...r, property_id: str(r.property_id) }) as Ielove),
    props: new Map(props.map((p) => [str(p.id), p])),
    takenBy,
  };
};

const insertLog = (entity: string, entityId: string, entityNo: number | null, label: string, field: string, to: string, note: string) =>
  execute(
    `INSERT INTO brokerage_listings (kind, \`id\`, entity, entityId, entityNo, label, field, \`from\`, \`to\`, \`by\`, \`at\`, note, show_dashboard)
     VALUES ('logs', ?, ?, ?, ?, ?, ?, '（未設定）', ?, ?, ?, ?, 1)`,
    [uid(), entity, entityId, entityNo, label, field, to, AUTO_BY, new Date().toISOString(), note]
  );

const numOrNull = (v: unknown): number | null => (str(v) !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** ① 台帳 → いえらぶ。ledgerIds を渡すとその台帳だけ。つないだ件数を返す */
const matchLedgers = async (ledgerIds?: string[]): Promise<number> => {
  const { ledgers, ieloves, props, takenBy } = await loadAll();
  let linked = 0;
  for (const l of ledgers) {
    if (ledgerIds && !ledgerIds.includes(str(l.id))) continue;
    if (str(l.property_db_id) !== '' || str(l.property_db_match) !== '') continue; // ⚠️ 人が決めたもの・つながっているものは触らない
    const strong = candidatesOf(ledgerPlaceOf(l, props), ieloves, takenBy).filter((c) => c.level === 'strong');
    if (strong.length !== 1 || strong[0].takenNo !== '') continue;
    const c = strong[0];
    const r = await execute(
      `UPDATE brokerage_listings SET property_db_id = ?, property_db_name = ?, property_db_match = 'auto'
        WHERE \`id\` = ? AND kind = 'ledger' AND (property_db_id IS NULL OR property_db_id = '') AND property_db_match IS NULL`,
      [c.property_id, c.property_name || null, str(l.id)]
    );
    if (r.affectedRows === 0) continue;
    takenBy.set(c.property_id, l);
    linked += 1;
    await insertLog('ledger', str(l.id), numOrNull(l.no), str(l.seller), 'いえらぶの物件', `No.${c.property_id}`,
      `所在地・種別が一致する物件が1件だけだったので自動でつないだ（${c.property_name}／${c.address}）`);
  }
  return linked;
};

/** 6桁のいえらぶの番号にする（athome は 355050000＋6桁）。それ以外の形は '' */
const ieloveNoOf = (v: unknown): string => {
  const d = str(v).trim();
  if (/^\d{6}$/.test(d)) return d;
  if (/^355050000\d{6}$/.test(d)) return d.slice(9);
  return '';
};

/** ② 買い反響 → 台帳。つないだ件数を返す */
const linkBuyLeads = async (): Promise<number> => {
  const leads = await query<DynamicRow>(
    `SELECT \`id\`, extId, \`name\` FROM brokerage_listings
      WHERE kind = 'buyLeads' AND (show_dashboard IS NULL OR show_dashboard <> 0)
        AND (ledgerId IS NULL OR ledgerId = '')
        AND (extId LIKE 'suumo:%' OR extId LIKE 'homes:%' OR extId LIKE 'athome:%')`
  );
  if (leads.length === 0) return 0;
  const keyOf = (extId: string): [string, string] => {
    const [src, key] = extId.split(':');
    return [src, key ?? ''];
  };
  const keys = { suumo: new Set<string>(), homes: new Set<string>(), athome: new Set<string>() };
  for (const l of leads) {
    const [src, key] = keyOf(str(l.extId));
    if (key && (src === 'suumo' || src === 'homes' || src === 'athome')) keys[src].add(key);
  }
  const lookup = async (sql: string, list: Set<string>): Promise<Map<string, string>> => {
    if (list.size === 0) return new Map();
    const rows = await query<DynamicRow>(sql.replace('?', [...list].map(() => '?').join(', ')), [...list]);
    return new Map(rows.map((r) => [str(r.k), ieloveNoOf(r.v)]));
  };
  const [suumo, homes, athome] = await Promise.all([
    lookup('SELECT sequence_no AS k, company_property_code AS v FROM suumo_db_resale WHERE sequence_no IN (?)', keys.suumo),
    lookup('SELECT userId AS k, companyId AS v FROM homes_db_resale WHERE userId IN (?)', keys.homes),
    lookup('SELECT athome_property_id AS k, MAX(company_property_id) AS v FROM athome_db_resale WHERE athome_property_id IN (?) GROUP BY athome_property_id', keys.athome),
  ]);
  const bySrc: Record<string, Map<string, string>> = { suumo, homes, athome };

  /** いえらぶの番号 → 台帳（媒介中を先に、同じなら No. の大きい＝新しい台帳） */
  const ledgers = (await query<DynamicRow>(
    `SELECT \`id\`, \`no\`, propertyId, propStatus, property_db_id FROM brokerage_listings
      WHERE kind = 'ledger' AND (show_dashboard IS NULL OR show_dashboard <> 0) AND property_db_id IS NOT NULL AND property_db_id <> ''`
  )).sort((a, b) => (str(a.propStatus) === '媒介終了' ? 1 : 0) - (str(b.propStatus) === '媒介終了' ? 1 : 0) || Number(b.no) - Number(a.no));
  const ledgerOf = new Map<string, DynamicRow>();
  for (const l of ledgers) if (!ledgerOf.has(str(l.property_db_id))) ledgerOf.set(str(l.property_db_id), l);

  let linked = 0;
  for (const lead of leads) {
    const [src, key] = keyOf(str(lead.extId));
    const no = bySrc[src]?.get(key) ?? '';
    const ledger = no ? ledgerOf.get(no) : undefined;
    if (!ledger) continue;
    const r = await execute(
      `UPDATE brokerage_listings SET ledgerId = ?, ledgerNo = ?, propertyId = ?
        WHERE \`id\` = ? AND kind = 'buyLeads' AND (ledgerId IS NULL OR ledgerId = '')`,
      [str(ledger.id), str(ledger.no) || null, str(ledger.propertyId) || null, str(lead.id)]
    );
    if (r.affectedRows === 0) continue;
    linked += 1;
    await insertLog('buy', str(lead.id), null, str(lead.name), '問合せ物件', `台帳 No.${str(ledger.no)}`,
      `問い合わせの物件番号（いえらぶ No.${no}）から自動でつないだ`);
  }
  return linked;
};

let running: Promise<{ ledgers: number; buyLeads: number }> | null = null;

/**
 * 突き合わせ（① → ② の順。① でつないだ台帳に、② の買い反響がすぐつながる）。
 * ⚠️ 同時に2つ走らせない（30分ごとと保存の直後が重なったときは、走っているものを待つ）
 */
export const runIeloveMatch = async (ledgerIds?: string[]): Promise<{ ledgers: number; buyLeads: number }> => {
  while (running) await running.catch(() => undefined);
  running = (async () => ({ ledgers: await matchLedgers(ledgerIds), buyLeads: await linkBuyLeads() }))();
  try {
    const result = await running;
    if (result.ledgers > 0 || result.buyLeads > 0) {
      logger.info(`realty: いえらぶの突き合わせ（台帳 ${result.ledgers} 件・買い反響 ${result.buyLeads} 件をつないだ）`);
    }
    return result;
  } finally {
    running = null;
  }
};

export const startIeloveMatch = (): void => {
  const run = (): void => {
    runIeloveMatch().catch((error: unknown) => logger.error('realty: いえらぶの突き合わせに失敗しました', error));
  };
  setTimeout(run, FIRST_DELAY_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
};

// ---------------------------------------------------------------------------
// 画面から
// ---------------------------------------------------------------------------

/** 台帳ごとの状態（一覧の札） */
export type IeloveState = 'linked' | 'none' | 'review' | 'unmatched';

/**
 * broker:ielove_candidates。body.ledgerId があればその台帳だけ（候補つき）、無ければつながっていない台帳すべて（状態と件数）。
 * 応答: { status, ledgers: { [ledgerId]: { state, count, candidates? } } }
 *   linked＝つながっている、none＝「該当なし」にした、review＝候補あり（要確認）、unmatched＝候補なし（いえらぶ未採番）
 */
export const runIeloveCandidates = async (body: Record<string, unknown>): Promise<Result> => {
  const only = str(body.ledgerId).trim();
  const { ledgers, ieloves, props, takenBy } = await loadAll();
  const out: Record<string, { state: IeloveState; count: number; candidates?: Candidate[] }> = {};
  for (const l of ledgers) {
    const id = str(l.id);
    if (only && id !== only) continue;
    const linked = str(l.property_db_id) !== '';
    // ⚠️ 一覧ではつながっている台帳の候補は数えない（台帳を1件指定したときは、選び直せるように候補も返す）
    if (linked && !only) { out[id] = { state: 'linked', count: 0 }; continue; }
    const list = candidatesOf(ledgerPlaceOf(l, props), ieloves, takenBy);
    const state: IeloveState = linked ? 'linked'
      : str(l.property_db_match) === 'none' ? 'none'
      : list.length > 0 ? 'review' : 'unmatched';
    out[id] = { state, count: list.length, ...(only ? { candidates: list.slice(0, MAX_CANDIDATES) } : {}) };
  }
  return { httpStatus: 200, body: { status: 'success', ledgers: out } };
};

/** broker:ielove_match。今すぐ突き合わせる（全部の台帳と買い反響） */
export const runIeloveMatchNow = async (): Promise<Result> => {
  const result = await runIeloveMatch();
  return { httpStatus: 200, body: { status: 'success', ...result } };
};
