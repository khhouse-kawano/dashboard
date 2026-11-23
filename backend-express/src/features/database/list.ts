import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { giftApplyToCustomers } from './gift';
import { toColumnar } from './index';
import { databaseSql, usedSql, type DatabaseCategory } from './queries';

/**
 * 顧客DB を1ページずつ返す（v2.2.289。request database_list。画面は database/DatabaseKaeru.tsx）。
 * ⚠️ v2.2.291 で注文（database/DatabaseOrder.tsx）も受ける。注文の絞り込みは下の runOrderList（このコメントの説明は建売のもの）。
 * ⚠️ v2.2.292 で中古（database/DatabaseResale.tsx）も受ける。中古の絞り込みは下の runUsedList。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ 画面は GET で絞り込みの条件・ページ・表示件数を送る（① の core/db.php の GET_ALLOWED_REQUESTS）。
 *   ⚠️ 以前（request database）は顧客を全件（建売で約1万2千件）ブラウザに送り、画面の中で絞り込んでいた。
 * ⚠️⚠️ 絞り込みは DatabaseKaeru.tsx の filteredDatabase（① にフォールバックしたときの予備として画面に残っている）と**同じ**。
 *   ⚠️ 片方だけ直すと、② が落ちたときだけ件数が変わる。⚠️ 直すときは両方。
 *   ⚠️ 既存の挙動も写してある（例：建売の顧客には reserved_interview が無いので「未来場・来場キャンセル」は0件）。
 * ⚠️ 顧客は DB から毎回全件読んで ② の中で絞る（ふりがなの平仮名化など SQL で同じに書けない条件があるため）。
 * ⚠️ 重複顧客の印（duplicate）は、非表示を含む全顧客で、メール・電話（空白を除く）が同じ別の顧客がいるか（画面の duplicateDictionary と同じ）。
 * ⚠️ 名寄せの候補（dupOf）は、画面の integrationCustomer と同じ（空白を除かない完全一致）。
 * ⚠️ ギフトの印は、返すページの行だけに付ける（gift.ts）。
 * ⚠️ master=1 のときだけ、選択肢（担当・店舗・媒体）も返す（最初の1回だけ）。
 * ─────────────────────────────────────────────
 */

type Row = Record<string, unknown>;
interface DynamicRow extends RowDataPacket { [key: string]: unknown }
interface IdRow extends RowDataPacket { id: string }

/** 画面の表示件数の選択肢（⚠️ これ以外は 20） */
const PER_PAGES = [20, 50, 100, 500];
const FOLLOWING = ['Aランク', 'Bランク', 'Cランク', 'Dランク'];
const FOLLOW_ENDED = ['Eランク', 'Fランク', 'Gランク', 'Hランク'];

export interface DatabaseListParams {
  page?: unknown; perPage?: unknown; trash?: unknown; master?: unknown; dupOf?: unknown;
  shop?: unknown; staff?: unknown; register?: unknown; reserve?: unknown; rank?: unknown; medium?: unknown; status?: unknown;
  follow?: unknown; callStatus?: unknown; family?: unknown;
  name?: unknown; kana?: unknown; staffText?: unknown; pastStaff?: unknown; phone?: unknown; mail?: unknown; address?: unknown; area?: unknown;
  /** v2.2.291 注文だけ */
  introductory?: unknown; event?: unknown; snap?: unknown; hotlead?: unknown; familyName?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const s = (v: unknown): string => String(v ?? '');
/** 空白（半角・全角）を消す */
const clean = (v: unknown): string => s(v).replace(/[\s　]+/g, '');
/** 片仮名 → 平仮名（databaseUtils.ts の kataToHira と同じ） */
const kataToHira = (v: string): string => v.replace(/[ァ-ヶ]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));
/** 画面の strIncludes / arrIncludes（⚠️ 行の値は文字列なので arrIncludes も部分一致） */
const includes = (value: unknown, sub: string): boolean => (sub ? s(value).includes(sub) : true);
/** 'YYYY/MM' → 'YYYY-MM'（画面の dateFormate） */
const dateFormate = (v: string): string => v.replace(/\//g, '-');
/** 重複の判定に使う形（画面の normalize） */
const normalize = (v: unknown): string => s(v).replace(/[\s　]+/g, '');

/** 入居希望地（v2.2.288。画面の plannedSites と同じ） */
const plannedSites = (r: Row): string[] =>
  [r.planned_construction_site, r.planned_construction_site_2, r.planned_construction_site_3].map((v) => s(v).trim()).filter((v) => v !== '');

/** 過去に担当した営業名 → 顧客ID（① の past_staff_search.php と同じ SQL） */
const pastStaffIds = async (staff: string): Promise<Set<string>> => {
  const pattern = `%${staff.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await query<IdRow>(
    `SELECT DISTINCT cs.id AS id FROM call_sheet cs WHERE cs.id <> '' AND JSON_SEARCH(cs.call_log, 'one', ?, NULL, '$[*].staff') IS NOT NULL
     UNION
     SELECT DISTINCT iv.id AS id FROM interview_sheet iv WHERE iv.id <> '' AND JSON_SEARCH(iv.interview_log, 'one', ?, NULL, '$[*].staff') IS NOT NULL`,
    [pattern, pattern]
  );
  return new Set(rows.map((r) => String(r.id)));
};

export interface DatabaseListResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

/** 表示件数・ページを決めて、そのページの行を切り出す（⚠️ ページが多すぎれば最後のページ、表示件数が不正なら 20） */
const paginate = (filtered: Row[], p: DatabaseListParams): { page: number; perPage: number; pageRows: Row[] } => {
  const perPageValue = Number(str(p.perPage));
  const perPage = PER_PAGES.includes(perPageValue) ? perPageValue : PER_PAGES[0];
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageValue = Math.floor(Number(str(p.page)) || 1);
  const page = Math.min(Math.max(1, pageValue), pages);
  return { page, perPage, pageRows: filtered.slice((page - 1) * perPage, page * perPage) };
};

export const runDatabaseList = async (category: DatabaseCategory | 'used', p: DatabaseListParams): Promise<DatabaseListResult> => {
  if (category === 'order') return runOrderList(p);
  if (category === 'used') return runUsedList(p);
  const sql = databaseSql(category);
  const customers = (await query<DynamicRow>(sql.customer)) as unknown as Row[];

  // 名寄せの候補（画面の integrationCustomer と同じ）
  const dupOf = str(p.dupOf);
  if (dupOf !== '') {
    const base = customers.find((c) => s(c.id) === dupOf);
    if (base === undefined) return { httpStatus: 404, body: { status: 'error', message: '顧客が見つかりません。開き直してください。' } };
    const mails = [base.mail, base.mail_2].map(s).filter(Boolean);
    const phones = [base.phone_number, base.phone_number_2].map(s).filter(Boolean);
    const list = customers.filter((c) => s(c.id) !== dupOf
      && (mails.some((m) => [c.mail, c.mail_2].map(s).filter(Boolean).includes(m)) || phones.some((t) => [c.phone_number, c.phone_number_2].map(s).filter(Boolean).includes(t))));
    return { httpStatus: 200, body: { status: 'ok', customer: toColumnar(list) } };
  }

  const trash = str(p.trash) === '0' ? 0 : 1;
  const shop = str(p.shop), staff = str(p.staff), register = str(p.register), reserve = str(p.reserve), rank = str(p.rank);
  const medium = str(p.medium), status = str(p.status), follow = str(p.follow), callStatus = str(p.callStatus);
  const nameKey = clean(p.name), kanaKey = kataToHira(clean(p.kana)), staffText = str(p.staffText).split(' ')[0];
  const phone = str(p.phone), mail = str(p.mail), address = str(p.address), areaKey = clean(p.area);
  const pastStaff = str(p.pastStaff);
  const [familyIds, pastIds] = await Promise.all([
    str(p.family) === '1' ? query<IdRow>(sql.family).then((r) => new Set(r.map((x) => String(x.id)))) : Promise.resolve(null),
    pastStaff !== '' ? pastStaffIds(pastStaff) : Promise.resolve(null),
  ]);

  // ⚠️ DatabaseKaeru.tsx の filteredDatabase と同じ順・同じ条件
  const filtered = customers.filter((c) =>
    (trash === 1 ? Number(c.trash) !== 0 : Number(c.trash) !== 1)
    && includes(c.shop, shop)
    && (staff ? s(c.staff) === staff : true)
    && (register ? includes(c.register, dateFormate(register)) : true)
    && (reserve === 'notVisited'
      ? (s(c.reserved_interview) !== '' && s(c.interview) === '')
      : (reserve ? includes(c.interview, dateFormate(reserve)) : true))
    && includes(c.rank, rank)
    && (medium === 'SUUMO(ポータル反響)' ? c.portal_site === 'SUUMO' : includes(c.medium, medium))
    && includes(c.status, status)
    && (nameKey ? (clean(c.customer).includes(nameKey) || clean(c.customer_2).includes(nameKey)) : true)
    && (kanaKey ? kataToHira(clean(c.customer_contacts_name_kana)).includes(kanaKey) : true)
    && (staffText ? includes(c.staff, staffText) : true)
    && (phone ? (includes(c.phone_number, phone) || includes(c.phone_number_2, phone)) : true)
    && (mail ? (includes(c.mail, mail) || includes(c.mail_2, mail)) : true)
    && (address ? normalize(c.full_address).includes(address) : true)
    && (areaKey ? plannedSites(c).some((site) => clean(site).includes(areaKey)) : true)
    && (callStatus ? s(c.call_status) === callStatus : true)
    && (familyIds !== null ? familyIds.has(s(c.id)) : true)
    && (pastIds !== null ? pastIds.has(s(c.id)) : true)
    // ⚠️ ランクが空の顧客は、追客中・追客終了のどちらにも入る（画面の arrIncludes が空の値を「当てはまる」と扱うため。今の動きのまま）
    && (follow === '追客中' ? (s(c.rank) === '' || FOLLOWING.includes(s(c.rank))) : follow === '追客終了' ? (s(c.rank) === '' || FOLLOW_ENDED.includes(s(c.rank))) : true));
  filtered.sort((a, b) => s(b.register).localeCompare(s(a.register)));
  const { page, perPage, pageRows } = paginate(filtered, p);

  // 重複顧客の印（⚠️ 非表示を含む全顧客で数える。画面の duplicateDictionary と同じ）
  const owners = new Map<string, Set<string>>();
  for (const c of customers) {
    for (const key of [c.mail, c.mail_2, c.phone_number, c.phone_number_2].map(normalize).filter(Boolean)) {
      const set = owners.get(key) ?? new Set<string>();
      set.add(s(c.id));
      owners.set(key, set);
    }
  }
  const rows = pageRows.map((c) => ({
    ...c,
    duplicate: [c.mail, c.mail_2, c.phone_number, c.phone_number_2].map(normalize).filter(Boolean)
      .some((key) => [...(owners.get(key) ?? [])].some((id) => id !== s(c.id))) ? 1 : 0,
  }));
  await giftApplyToCustomers(rows, true);

  const body: Record<string, unknown> = { status: 'ok', total: filtered.length, page, perPage, customer: toColumnar(rows) };
  if (str(p.master) === '1') {
    const [staffRows, shopRows, mediumRows] = await Promise.all([query<DynamicRow>(sql.staff), query<DynamicRow>(sql.shop), query<DynamicRow>(sql.medium)]);
    Object.assign(body, { staff: staffRows, shop: shopRows, medium: mediumRows });
  }
  return { httpStatus: 200, body };
};

// ---------------------------------------------------------------------------
// 注文（v2.2.291。画面は database/DatabaseOrder.tsx）
// ⚠️⚠️ 絞り込みは DatabaseOrder.tsx の filteredDatabase（② に届かないときの予備として画面に残っている）と**同じ**。⚠️ 直すときは両方。
// ⚠️ 建売と違うところ：重複顧客・名寄せ・ふりがな・過去の担当・追客状況・入居希望地は無い。
//   紹介者・イベント・K-Snap・Hotlead・家族名がある。顧客名の欄は「名前&電話」「名前+住所」も受ける。
//   電話は phone_number だけ、メールは mail だけを見て、⚠️ メールだけ大文字小文字を区別しない。
// ---------------------------------------------------------------------------

/** 失注の要回答（frontend/src/utils/informationUtils.ts の missingLostFields と同じ。⚠️ 直すときは両方） */
const LOST_REASON_KEY = 'competitor_lost_contract_reason';
const LOST_FIELD_KEYS = ['competitor_name', 'customized_input_01JRF9CZSW65A151WR30NA4PB3', 'customized_input_01JSE7H4MQES619NBWX6PQDFRH'];
const isBlank = (v: unknown): boolean => { const t = s(v).trim(); return t === '' || t === 'null'; };
const hasMissingLostFields = (c: Row): boolean =>
  isBlank(c[LOST_REASON_KEY]) || (c[LOST_REASON_KEY] === '競合負け' && LOST_FIELD_KEYS.some((k) => isBlank(c[k])));

/**
 * キャンセル・失注の「要回答」の件数（画面の cancelLength / loseLength と同じ。⚠️ 全顧客で数える）。
 * ⚠️ 日付は画面と同じく new Date で読む（時刻の無い日付は UTC、時刻付きはサーバーの時刻帯。本番の ② は Asia/Tokyo）。
 */
const answerCounts = (customers: Row[]): { cancel: number; lose: number } => {
  const now = Date.now();
  const cancelBase = new Date('2026-01-01').getTime();
  const loseBase = new Date('2026-06-01').getTime();
  let cancel = 0, lose = 0;
  for (const c of customers) {
    if (Number(c.trash) !== 1) continue;
    const cTarget = new Date(dateFormate(s(c.reserved_interview))).getTime();
    if (cTarget < now && cancelBase < cTarget && !c.interview && !c.cancel_status && c.status !== '重複') cancel++;
    const lTarget = new Date(dateFormate(s(c.register))).getTime();
    if (lTarget < now && loseBase < lTarget && c.status === '失注' && hasMissingLostFields(c)) lose++;
  }
  return { cancel, lose };
};

/** 家族の名前（index.ts の familyNamesOnly と同じ読み方）→ その家族の顧客ID */
const familyIdsByName = (rows: Row[], key: string): Set<string> => {
  const ids = new Set<string>();
  for (const r of rows) {
    let list: unknown = [];
    try { list = typeof r.family_info === 'string' ? JSON.parse(r.family_info) : []; } catch { list = []; }
    if (Array.isArray(list) && list.some((f) => s((f as { name?: unknown } | null)?.name).includes(key))) ids.add(s(r.id));
  }
  return ids;
};

const runOrderList = async (p: DatabaseListParams): Promise<DatabaseListResult> => {
  const sql = databaseSql('order');
  const familyName = str(p.familyName);
  const hotleadStatus = str(p.hotlead);
  const needFamily = str(p.family) === '1' || familyName !== '';
  const [customers, familyRows, hotleadRows] = await Promise.all([
    query<DynamicRow>(sql.customer) as unknown as Promise<Row[]>,
    needFamily ? (query<DynamicRow>(sql.family) as unknown as Promise<Row[]>) : Promise.resolve([] as Row[]),
    query<DynamicRow>(sql.hotlead as string) as unknown as Promise<Row[]>,
  ]);

  const trash = str(p.trash) === '0' ? 0 : 1;
  const shop = str(p.shop), staff = str(p.staff), register = str(p.register), reserve = str(p.reserve), rank = str(p.rank);
  const medium = str(p.medium), introductory = str(p.introductory), status = str(p.status), callStatus = str(p.callStatus);
  const staffText = str(p.staffText).split(' ')[0], address = str(p.address), mailKey = str(p.mail).toLowerCase();
  const event = str(p.event), snap = str(p.snap) === '1';
  // ⚠️ 顧客名の欄：「名前&電話番号」「名前+住所」（画面の formattedName / formattedNumber / formattedAddress と同じ）
  const name = str(p.name), phone = str(p.phone);
  const namePart = name.includes('&') ? name.split('&')[0] : name.includes('+') ? name.split('+')[0] : name;
  const numberPart = name.includes('&') ? (name.split('&')[1] ?? '') : phone;
  const addressPart = name.includes('+') ? (name.split('+')[1] ?? '') : '';
  const nameKey = clean(namePart);
  const familyAll = str(p.family) === '1' ? new Set(familyRows.map((r) => s(r.id))) : null;
  const familyHit = familyName !== '' ? familyIdsByName(familyRows, familyName) : null;
  const hotleadIds = hotleadStatus !== '' ? new Set(hotleadRows.filter((h) => h.status === hotleadStatus).map((h) => s(h.id))) : null;

  // ⚠️ DatabaseOrder.tsx の filteredDatabase と同じ順・同じ条件
  const filtered = customers.filter((c) =>
    (trash === 1 ? Number(c.trash) !== 0 : Number(c.trash) !== 1)
    && includes(c.shop, shop)
    && (staff ? s(c.staff) === staff : true)
    && (register ? includes(c.register, dateFormate(register)) : true)
    && (reserve === 'notVisited'
      ? (s(c.reserved_interview) !== '' && s(c.interview) === '')
      : (reserve ? includes(c.interview, dateFormate(reserve)) : true))
    && includes(c.rank, rank)
    && (medium === 'SUUMO(ポータル反響)' ? c.portal_site === 'SUUMO' : includes(c.medium, medium))
    && includes(c.introduction_person_category, introductory)
    && includes(c.status, status)
    && (name ? (clean(c.customer).includes(nameKey) || clean(c.customer_2).includes(nameKey)) : true)
    && (staffText ? includes(c.staff, staffText) : true)
    && ((phone || name) ? includes(c.phone_number, numberPart) : true)
    && includes(c.full_address, addressPart)
    && (address ? s(c.full_address).replace(/[\s ]+/g, '').includes(address) : true)
    && (mailKey ? s(c.mail).toLowerCase().includes(mailKey) : true)
    && (familyHit !== null ? familyHit.has(s(c.id)) : true)
    && (callStatus ? s(c.call_status) === callStatus : true)
    && (familyAll !== null ? familyAll.has(s(c.id)) : true)
    && (event ? (c.event === event && c.medium === 'イベント') : true)
    // ⚠️ 画面は item.k_snap の真偽で見ている（文字列の '0' も「登録済み」に入る。今の動きのまま）
    && (snap ? Boolean(c.k_snap) : true)
    && (hotleadIds !== null ? hotleadIds.has(s(c.hotlead_id)) : true));
  filtered.sort((a, b) => s(b.register).localeCompare(s(a.register)));
  const { page, perPage, pageRows } = paginate(filtered, p);
  const rows = pageRows.map((c) => ({ ...c }));
  await giftApplyToCustomers(rows, true);

  // ⚠️ Hotlead は返すページの顧客の分だけ（画面の hotleadMap は id で引く。⚠️ 同じ id が2行あれば画面は最初の行を使う）
  const pageHotleadIds = new Set(rows.map((r) => s(r.hotlead_id)).filter(Boolean));
  const body: Record<string, unknown> = {
    status: 'ok', total: filtered.length, page, perPage, customer: toColumnar(rows),
    hotlead: hotleadRows.filter((h) => pageHotleadIds.has(s(h.id))),
  };
  if (str(p.master) === '1') {
    const [staffRows, shopRows, mediumRows, introductoryRows, eventRows] = await Promise.all([
      query<DynamicRow>(sql.staff), query<DynamicRow>(sql.shop), query<DynamicRow>(sql.medium),
      query<DynamicRow>(sql.introductory as string), query<DynamicRow>(sql.event as string),
    ]);
    const counts = answerCounts(customers);
    Object.assign(body, {
      staff: staffRows, shop: shopRows, medium: mediumRows,
      // ⚠️ 紹介者は名前だけ（画面は .name しか使わない）
      introductory: introductoryRows.map((r) => ({ name: r.name })), event: eventRows,
      cancelCount: counts.cancel, loseCount: counts.lose,
    });
  }
  return { httpStatus: 200, body };
};

// ---------------------------------------------------------------------------
// 中古（v2.2.292。画面は database/DatabaseResale.tsx）
// ⚠️⚠️ 絞り込みは DatabaseResale.tsx の filteredDatabase（② に届かないときの予備として画面に残っている）と**同じ**。⚠️ 直すときは両方。
// ⚠️ 注文・建売と違うところ：
//   ・顧客名は空白を消さずに比べる。メールは mail だけを見て、大文字小文字を区別する。電話は phone_number だけ。
//   ・「SUUMO(ポータル反響)」は媒体が SUUMO で hp_campaign が空の顧客（portal_site ではない）。
//   ・担当営業のセレクト・紹介者・イベント・Hotlead・ギフトは無い。
//   ・重複の印は「メール（そのまま）」と「電話（数字だけにした phone_number）」で見る（画面の duplicateDictionary と同じ）。
//   ・名寄せの候補は「メール」か「電話（そのまま）」が同じ顧客（画面の integrationCustomer と同じ）。
//   ・初回通電日・次回架電日（call_sheet）と媒介（brokerage_listings）は、返すページの顧客の分だけ読む。
// ---------------------------------------------------------------------------

interface CallSheetRow extends RowDataPacket { id: string; call_log: string | null }

/** 全角の数字も半角にして、数字以外を消す（画面の databaseUtils.ts の toHalfWidth と同じ） */
const toHalfWidth = (v: unknown): string => s(v).normalize('NFKC').replace(/\D/g, '');

/** 画面の並び（Date.parse で新しい順。空や読めない日付は最後） */
const registerTime = (r: Row): number => {
  const t = r.register ? Date.parse(s(r.register)) : Number.NEGATIVE_INFINITY;
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
};

type CallEntry = { day?: unknown; action?: unknown };

/** 架電記録のうち action の日を、画面と同じ並べ方で1つ選ぶ（asc: 古い順の先頭 / desc: 新しい順の先頭） */
const pickCallDay = (log: CallEntry[], action: string, order: 'asc' | 'desc'): string => {
  const sorted = log.filter((c) => c.action === action).sort((a, b) => {
    const diff = new Date(s(a.day)).getTime() - new Date(s(b.day)).getTime();
    return order === 'asc' ? diff : -diff;
  });
  return sorted[0] ? s(sorted[0].day) : '';
};

const parseCallLog = (v: unknown): CallEntry[] => {
  try {
    const parsed: unknown = typeof v === 'string' && v !== '' ? JSON.parse(v) : [];
    return Array.isArray(parsed) ? (parsed as CallEntry[]) : [];
  } catch {
    return [];
  }
};

const runUsedList = async (p: DatabaseListParams): Promise<DatabaseListResult> => {
  const customers = (await query<DynamicRow>(usedSql.customer)) as unknown as Row[];

  // 名寄せの候補（画面の integrationCustomer と同じ。⚠️ 非表示の顧客も含む）
  const dupOf = str(p.dupOf);
  if (dupOf !== '') {
    const base = customers.find((c) => c.id === dupOf);
    if (base === undefined) return { httpStatus: 404, body: { status: 'error', message: '顧客が見つかりません。開き直してください。' } };
    const list = customers.filter((o) => o.id !== dupOf
      && ((s(o.mail) !== '' && o.mail === base.mail) || (s(o.phone_number) !== '' && o.phone_number === base.phone_number)));
    return { httpStatus: 200, body: { status: 'ok', customer: toColumnar(list) } };
  }

  const trash = str(p.trash) === '0' ? 0 : 1;
  const shop = str(p.shop), register = str(p.register), reserve = str(p.reserve), rank = str(p.rank);
  const medium = str(p.medium), status = str(p.status), callStatus = str(p.callStatus);
  const staffText = str(p.staffText).split(' ')[0], mail = str(p.mail), address = str(p.address);
  // ⚠️ 顧客名の欄：「名前&電話番号」「名前+住所」（画面の formattedName / formattedNumber / formattedAddress と同じ）
  const name = str(p.name), phone = str(p.phone);
  const namePart = name.includes('&') ? name.split('&')[0] : name.includes('+') ? name.split('+')[0] : name;
  const numberPart = name.includes('&') ? (name.split('&')[1] ?? '') : phone;
  const addressPart = name.includes('+') ? (name.split('+')[1] ?? '') : '';
  // ⚠️ id は文字列にせずそのまま比べる（画面の includes / find と同じ。⚠️ id が NULL の顧客を、id が空の家族・架電記録と結びつけない）
  const familyIds = str(p.family) === '1'
    ? new Set<unknown>((await query<IdRow>(usedSql.family)).map((r) => r.id))
    : null;

  // ⚠️ DatabaseResale.tsx の filteredDatabase と同じ順・同じ条件
  const filtered = customers.filter((c) =>
    (trash === 1 ? Number(c.trash) !== 0 : Number(c.trash) !== 1)
    && includes(c.shop, shop)
    && (register ? includes(c.register, dateFormate(register)) : true)
    && (reserve === 'notVisited'
      ? (s(c.reserved_interview) !== '' && s(c.interview) === '')
      : (reserve ? includes(c.interview, dateFormate(reserve)) : true))
    && includes(c.rank, rank)
    && (medium === 'SUUMO(ポータル反響)' ? (c.medium === 'SUUMO' && !c.hp_campaign) : includes(c.medium, medium))
    && includes(c.status, status)
    && (name ? (includes(c.customer, namePart) || includes(c.customer_2, namePart)) : true)
    && (staffText ? includes(c.staff, staffText) : true)
    && ((phone || name) ? includes(c.phone_number, numberPart) : true)
    && includes(c.full_address, addressPart)
    && (mail ? includes(c.mail, mail) : true)
    && (address ? clean(c.full_address).includes(address) : true)
    && (callStatus ? s(c.call_status) === callStatus : true)
    && (familyIds !== null ? familyIds.has(c.id) : true));
  filtered.sort((a, b) => registerTime(b) - registerTime(a));
  const { page, perPage, pageRows } = paginate(filtered, p);

  // 重複顧客の印（⚠️ 非表示を含む全顧客で数える。画面の duplicateDictionary と同じ）
  const dupKeys = (c: Row): string[] => [s(c.mail), toHalfWidth(c.phone_number)].filter(Boolean);
  const owners = new Map<string, Set<unknown>>();
  for (const c of customers) {
    for (const key of dupKeys(c)) {
      const set = owners.get(key) ?? new Set<unknown>();
      set.add(c.id);
      owners.set(key, set);
    }
  }

  // 初回通電日・次回架電日・媒介（返すページの顧客の分だけ）
  const ids = pageRows.map((c) => c.id).filter((id): id is string => typeof id === 'string' && id !== '');
  const marks = ids.map(() => '?').join(',');
  const [callRows, brokerRows] = ids.length === 0 ? [[], []] : await Promise.all([
    query<CallSheetRow>(`SELECT id, call_log FROM call_sheet WHERE id IN (${marks})`, ids),
    query<DynamicRow>(`SELECT * FROM brokerage_listings
      WHERE kind = 'ledger' AND show_dashboard = 1 AND COALESCE(master_data_id, '') <> '' AND master_data_id IN (${marks})`, ids),
  ]);
  // ⚠️ 同じ id が2行あれば、画面の find と同じく最初の行を使う
  const callById = new Map<unknown, CallEntry[]>();
  for (const r of callRows) if (!callById.has(r.id)) callById.set(r.id, parseCallLog(r.call_log));
  const rows = pageRows.map((c) => {
    const log = callById.get(c.id) ?? [];
    return {
      ...c,
      duplicate: dupKeys(c).some((key) => [...(owners.get(key) ?? [])].some((id) => id !== c.id)) ? 1 : 0,
      first_call: pickCallDay(log, '通電', 'asc'),
      next_call: pickCallDay(log, '次回架電日', 'desc'),
    };
  });

  const body: Record<string, unknown> = {
    status: 'ok', total: filtered.length, page, perPage, customer: toColumnar(rows), broker: brokerRows,
  };
  if (str(p.master) === '1') {
    const [staffRows, mediumRows] = await Promise.all([query<DynamicRow>(usedSql.staff), query<DynamicRow>(usedSql.medium)]);
    Object.assign(body, { staff: staffRows, medium: mediumRows });
  }
  return { httpStatus: 200, body };
};
