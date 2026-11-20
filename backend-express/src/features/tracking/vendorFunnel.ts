import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { attributeConversions, loadCvPages, type Conversion } from './conversions';
import { UUID_PATTERN } from './params';
import { periodBody, type Period } from './period';
import { canManageTracking, type TrackingResult } from './sites';
import { findVendor, GOOGLE_LISTING_SQL, isGoogleListing, VENDOR_CASE_SQL, VENDOR_START, vendorOf, type TrackingVendor } from './vendors';

/**
 * 業者別の歩留まり（v2.2.232）。画面は header/TrackingVendorFunnel.tsx（アクセス解析 → サイトのサマリー → 流入元 → 業者別 → 社名）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 対象 ＝ 顧客台帳（注文 master_data・建売 master_data_kaeru）の landing_params の khg_vid が、
 *   問い合わせの日（反響取得日）までに、そのサイトへその業者の広告から一度でも来ていた顧客（2026-10-30 の指示）。
 *   ⚠️ v2.2.238 業者の広告 ＝ 2026-10-22 以降の Google リスティング広告で、業者の判定は vendors.ts（2026-11-02 の指示）。
 *   ⚠️ 最後の訪問ではない（サマリーの CV はラストクリック。数えている顧客も反響の表も違うので、数は一致しない）。
 * ⚠️⚠️ v2.2.287 画面が選んだ期間（period.ts）で数える（2026-11-20 の指示。以前は 2026-10-22 以降のすべて）。⚠️ 2026-10-22（VENDOR_START）より前は切る。
 *   ⚠️ 顧客台帳で数えるサイト（mode: 'customer'）は、反響取得日が期間に入る顧客だけ（⚠️ 日付が読めない顧客は数えない）。
 * ⚠️ 歩留まりの列は紹介キャンペーンサマリー（introductory/summary.ts）と同じ。⚠️ status＝重複は数えない。
 * ⚠️ 店舗は in_charge_store。⚠️ 併売店（shop_list.parent_shop がある店舗）は親店舗にまとめる。
 * ⚠️ KPI単価（広告費 ÷ 件数）は、広告費が入力できるようになってから総計の行にだけ付ける（2026-10-30 の指示）。
 * ⚠️⚠️ v2.2.287（2026-11-20 の指示）：完了ページを登録したサイトは、CV（完了ページ。conversions.ts）を起点に数える（mode: 'cv'）。
 *   ⚠️ 対象 ＝ 2026-10-22 以降の CV のうち、CV の時刻までにそのサイトへその業者の広告から一度でも来ていたもの。
 *   ⚠️ 来場・次アポ・契約は、CV が結びついた反響の顧客台帳で数える。⚠️ 結びつかない CV（会員登録など）は「反響と結びつかない CV」の行。
 *   ⚠️ CV の種類別（kinds）も返す。⚠️ 完了ページを登録していないサイトは、今までどおり顧客台帳を起点に数える（mode: 'customer'）。
 * ─────────────────────────────────────────────
 */

const COL_INQUIRY = 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99';     // 反響取得日
const COL_INTERVIEW = 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7';   // 初回面談
const COL_SCREENING = 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR';   // 事前審査
const COL_APPOINTMENT = 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'; // 第二面談
const COL_CONTRACT = 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG';    // 契約

/** 顧客台帳。⚠️ SQL に直接埋め込むので、この定数以外の値を入れないこと */
const TABLES = ['master_data', 'master_data_kaeru'] as const;
/** visitor_id を IN で渡す件数（conversions.ts と同じ） */
const CHUNK = 500;
const UNSET_SHOP = '（未入力）';
const UNLINKED_SHOP = '（反響と結びつかない CV）';

interface CustomerRow extends RowDataPacket {
  vid: string;
  status: string | null;
  store: string | null;
  col_inquiry: string | null;
  col_interview: string | null;
  col_screening: string | null;
  col_appointment: string | null;
  col_contract: string | null;
}

interface FirstTouchRow extends RowDataPacket {
  visitor_id: string;
  first_at: string;
}

interface ShopRow extends RowDataPacket {
  shop: string;
  parent_shop: string | null;
}

interface VendorFunnelRow {
  shop: string;
  inquiry: number;
  meeting: number;
  next: number;
  contract: number;
}

const hasValue = (value: unknown): boolean => String(value ?? '').trim() !== '';

/** 反響取得日 → `YYYY-MM-DD`（読めなければ null）。⚠️ `2026-02-28` と `2026/06/01` の両方がある */
const toDay = (value: unknown): string | null => {
  const matched = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(value ?? '').trim());
  return matched === null ? null : `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`;
};

const emptyRow = (shop: string): VendorFunnelRow => ({ shop, inquiry: 0, meeting: 0, next: 0, contract: 0 });

/** 顧客台帳1件 → 来場・次アポ・契約（⚠️ 今までの数え方と同じ） */
const stagesOf = (c: CustomerRow): { meeting: boolean; next: boolean; contract: boolean } => {
  const contract = c.status === '契約済み';
  const next = contract || hasValue(c.col_screening) || hasValue(c.col_appointment) || hasValue(c.col_contract);
  return { meeting: next || hasValue(c.col_interview), next, contract };
};

const addTo = (rows: VendorFunnelRow[], s: { meeting: boolean; next: boolean; contract: boolean } | null): void => {
  for (const r of rows) {
    r.inquiry += 1;
    if (s?.meeting) r.meeting += 1;
    if (s?.next) r.next += 1;
    if (s?.contract) r.contract += 1;
  }
};

/** v2.2.287 完了ページを登録したサイト：CV を起点に数える */
const cvFunnel = async (siteId: number, vendor: TrackingVendor, parentOf: Map<string, string>, period: Period): Promise<Record<string, unknown>> => {
  const range = { since: period.since > VENDOR_START ? period.since : VENDOR_START, until: period.until };
  const conversions = ((await attributeConversions(siteId, range)).get(siteId) ?? []).filter((c: Conversion) =>
    c.touches.some((t) => isGoogleListing(t.utmSource, t.utmMedium, t.at) && vendorOf(t.campaign, t.utmMedium) === vendor.key));

  // 結びついた反響の顧客台帳（⚠️ 注文の反響は master_data、かえるホームの反響は master_data_kaeru）
  const customers = new Map<string, CustomerRow>();
  for (const [inquiryTable, table] of [['inquiry_customer', 'master_data'], ['inquiry_customer_kaeru', 'master_data_kaeru']] as const) {
    const ids = [...new Set(conversions.filter((c) => c.inquiryTable === inquiryTable && c.pgId !== '').map((c) => c.pgId))];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      const rows = await query<CustomerRow & { id: string }>(
        `SELECT id, '' AS vid, status, in_charge_store AS store, ${COL_INQUIRY} AS col_inquiry, ${COL_INTERVIEW} AS col_interview, ${COL_SCREENING} AS col_screening,
                ${COL_APPOINTMENT} AS col_appointment, ${COL_CONTRACT} AS col_contract
           FROM ${table} WHERE id IN (${part.map(() => '?').join(', ')})`,
        part
      );
      for (const r of rows) customers.set(`${inquiryTable}:${r.id}`, r);
    }
  }

  const total = emptyRow('');
  const byShop = new Map<string, VendorFunnelRow>();
  const byKind = new Map<string, VendorFunnelRow>();
  for (const c of conversions) {
    const customer = c.inquiryTable === null ? undefined : customers.get(`${c.inquiryTable}:${c.pgId}`);
    // ⚠️ 重複の顧客は、CV には数えるが来場以降は数えない
    const stages = customer === undefined || customer.status === '重複' ? null : stagesOf(customer);
    const store = String(customer?.store ?? '').trim();
    const shop = customer === undefined ? UNLINKED_SHOP : store === '' ? UNSET_SHOP : parentOf.get(store) ?? store;
    const row = byShop.get(shop) ?? emptyRow(shop);
    const kindRow = byKind.get(c.kind) ?? emptyRow(c.kind);
    addTo([row, kindRow, total], stages);
    byShop.set(shop, row);
    byKind.set(c.kind, kindRow);
  }
  const lastly = (s: string): number => Number(s === UNSET_SHOP || s === UNLINKED_SHOP);
  return {
    mode: 'cv',
    total,
    rows: [...byShop.values()].sort((a, b) => lastly(a.shop) - lastly(b.shop) || b.inquiry - a.inquiry),
    kinds: [...byKind.values()].sort((a, b) => b.inquiry - a.inquiry),
  };
};

export const trackingVendorFunnel = async (staff: AuthenticatedStaff | null, siteIdValue: unknown, vendorKey: unknown, period: Period): Promise<TrackingResult> => {
  if (!canManageTracking(staff)) return { httpStatus: 403, body: { status: 'error', message: 'この画面は管理者だけが使えます。' } };
  const siteId = Number(siteIdValue);
  if (!Number.isInteger(siteId) || siteId <= 0) return { httpStatus: 400, body: { status: 'error', message: 'サイトが指定されていません。' } };
  const vendor = findVendor(vendorKey);
  if (vendor === undefined) return { httpStatus: 400, body: { status: 'error', message: '業者が指定されていません。' } };

  const [shops, cvPages] = await Promise.all([query<ShopRow>('SELECT shop, parent_shop FROM shop_list'), loadCvPages(siteId)]);
  const parentOf = new Map<string, string>();
  for (const s of shops) parentOf.set(s.shop, hasValue(s.parent_shop) ? String(s.parent_shop).trim() : s.shop);
  if (cvPages.has(siteId)) {
    return { httpStatus: 200, body: { status: 'ok', siteId, vendor: vendor.key, period: periodBody(period), ...(await cvFunnel(siteId, vendor, parentOf, period)) } };
  }

  const perTable = await Promise.all([
    ...TABLES.map((table) => query<CustomerRow>(
      `SELECT CONVERT(LOWER(SUBSTRING(landing_params, LOCATE('khg_vid=', landing_params) + 8, 36)) USING utf8mb4) AS vid,
              status, in_charge_store AS store,
              ${COL_INQUIRY} AS col_inquiry, ${COL_INTERVIEW} AS col_interview, ${COL_SCREENING} AS col_screening,
              ${COL_APPOINTMENT} AS col_appointment, ${COL_CONTRACT} AS col_contract
         FROM ${table}
        WHERE landing_params LIKE '%khg_vid=%'`
    )),
  ]);
  const customers = perTable.flat().filter((c) => c.status !== '重複' && UUID_PATTERN.test(c.vid));

  // 顧客の訪問者ID → そのサイトにその業者の広告から最初に来た日時
  const firstTouch = new Map<string, string>();
  const vids = [...new Set(customers.map((c) => c.vid))];
  for (let i = 0; i < vids.length; i += CHUNK) {
    const part = vids.slice(i, i + CHUNK);
    const rows = await query<FirstTouchRow>(
      `SELECT t.visitor_id, DATE_FORMAT(MIN(t.created_at), '%Y-%m-%d %H:%i:%s') AS first_at
         FROM tracking_touches t
        WHERE t.site_id = ? AND ${GOOGLE_LISTING_SQL} AND (${VENDOR_CASE_SQL}) = ? AND t.visitor_id IN (${part.map(() => '?').join(', ')})
        GROUP BY t.visitor_id`,
      [siteId, vendor.key, ...part]
    );
    for (const row of rows) firstTouch.set(row.visitor_id, row.first_at);
  }

  const total = emptyRow('');
  const byShop = new Map<string, VendorFunnelRow>();
  for (const c of customers) {
    const first = firstTouch.get(c.vid);
    if (first === undefined) continue;
    const day = toDay(c.col_inquiry);
    // ⚠️ v2.2.287 反響取得日が期間に入る顧客だけ（⚠️ 日付が読めなければ数えない）
    if (day === null || day < period.start || day > period.end) continue;
    // ⚠️ 問い合わせの日より後に初めて来た顧客は数えない
    if (first > `${day} 23:59:59`) continue;

    const store = String(c.store ?? '').trim();
    const shop = store === '' ? UNSET_SHOP : parentOf.get(store) ?? store;
    const row = byShop.get(shop) ?? emptyRow(shop);
    addTo([row, total], stagesOf(c));
    byShop.set(shop, row);
  }

  // ⚠️ 反響の多い順（⚠️ 未入力は最後）
  const rows = [...byShop.values()].sort((a, b) => Number(a.shop === UNSET_SHOP) - Number(b.shop === UNSET_SHOP) || b.inquiry - a.inquiry);
  return {
    httpStatus: 200,
    body: { status: 'ok', siteId, vendor: vendor.key, period: periodBody(period), mode: 'customer', total, rows, kinds: [] },
  };
};
