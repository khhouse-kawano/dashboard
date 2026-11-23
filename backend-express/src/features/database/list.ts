import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { giftApplyToCustomers } from './gift';
import { toColumnar } from './index';
import { databaseSql, type DatabaseCategory } from './queries';

/**
 * 顧客DB を1ページずつ返す（v2.2.289。request database_list。画面は database/DatabaseKaeru.tsx）。
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

export const runDatabaseList = async (category: DatabaseCategory, p: DatabaseListParams): Promise<DatabaseListResult> => {
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

  const perPageValue = Number(str(p.perPage));
  const perPage = PER_PAGES.includes(perPageValue) ? perPageValue : PER_PAGES[0];
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageValue = Math.floor(Number(str(p.page)) || 1);
  const page = Math.min(Math.max(1, pageValue), pages);
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

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
