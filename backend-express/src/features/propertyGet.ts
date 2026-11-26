import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 物件DB（database/DatabaseProperty.tsx）・詳細（PropertySummary.tsx）・SUUMO物件サマリー（SuumoPropertySummary.tsx）を GET で読む（v2.2.301）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ ① の property（property_list.php・property_detail.php・property_suumo.php）は全件を返していて、① のメモリが足りなくなった。
 *   ここでは画面が使う分だけに絞って返す。⚠️ 返す形（キー・列）は ① と同じにして、画面は今までと同じ計算をする。
 * ⚠️ 絞り込みの比べ方は画面と同じにすること（変えると GET と予備の POST で表が変わる）。
 *   ・事業の店舗：store_name の半角・全角の空白を消して完全一致（databaseUtils.ts の removeAllSpaces）
 *   ・SUUMO：management_no の前後の空白を落として物件番号と一致／HOME'S：company_management_number も同じ
 *   ・at home：management_no の下6桁か全体が物件番号と一致（⚠️ 355050000＋6桁）
 *   ・顧客：問い合わせ物件の名前（property_name）が入っている人だけ（画面の filteredCustomer）
 * ⚠️ ① の GET は roll 付きを受けないので、request の名前に roll を入れない（property_list・property_detail・property_suumo_latest）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 事業 → 物件DB の店舗名・顧客の表（⚠️ 画面の categoryMapping と同じ。order・used は物件DB の対象外で空を返す） */
const STORE_OF: Record<string, { store: string; table: string; label: string }> = {
  spec: { store: '株式会社 国分ハウジング不動産 本店', table: 'master_data_kaeru', label: '株式会社　国分ハウジング不動産　本店' },
  realty: { store: '国分ハウジンググループ中古住宅専門店', table: 'master_data_resale', label: '国分ハウジンググループ中古住宅専門店' },
};

const removeAllSpaces = (value: unknown): string => (typeof value === 'string' ? value.replace(/[ 　]+/g, '') : '');
const trimmed = (value: unknown): string => String(value ?? '').trim();

/** 顧客の列（⚠️ ① の property_list.php の SELECT と同じ。category は ① が付けていた店舗名の文字） */
const customerSql = (table: string, label: string, where: string): string => `
  SELECT
    id,
    COALESCE(customer_contacts_name, '') AS customer,
    COALESCE(in_charge_store, '') AS shop,
    COALESCE(in_charge_user, '') AS staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS \`rank\`,
    COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
    COALESCE(REPLACE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '/', '-'), '') AS screening,
    COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
    COALESCE(REPLACE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '/', '-'), '') AS appointment,
    COALESCE(
      DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
      DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
      ''
    ) AS register,
    COALESCE(sales_promotion_name, '') AS medium,
    COALESCE(status, '') AS status,
    COALESCE(rank_period, '') AS rank_period,
    COALESCE(call_status, '') AS call_status,
    COALESCE(cancel_status, '') AS cancel_status,
    COALESCE(show_dashboard, 0) AS trash,
    COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
    COALESCE(full_address, '') AS full_address,
    COALESCE(hp_campaign, '') AS hp_campaign,
    COALESCE(property_name, '') AS property_name,
    COALESCE(property_tour_name, '') AS property_tour_name,
    COALESCE(property_contract_name, '') AS property_contract_name,
    COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
    '${label}' as category
  FROM ${table}
  ${where}`;

export interface PropertyResult {
  httpStatus: number;
  body: unknown;
}

/**
 * 物件DB の一覧（property_list）。⚠️ 返すキーは ① の property:list と同じ（shop・staff・property・customer・suumo・athome・homes）。
 * ⚠️ 架電記録（call）・家族情報（family）・媒体（medium）は画面が使っていないので返さない（① のメモリ不足の主な原因だった）。
 */
export const runPropertyList = async (body: Record<string, unknown>): Promise<PropertyResult> => {
  // ⚠️ v2.2.304 page が付いていれば、② で絞り込み・並べ替えをして1ページ分だけ返す（付いていなければ今までどおり全件。古い画面のため）
  if (String(body.page ?? '') !== '') return runPropertyPage(body);
  const target = STORE_OF[String(body.category ?? '')];
  const [staff, shop, properties] = await Promise.all([
    query<DynamicRow>('SELECT * FROM staff_list WHERE `rank` = 1'),
    query<DynamicRow>("SELECT shop, section FROM shop_list WHERE division = '建売分譲事業' AND show_flag = 1"),
    target ? query<DynamicRow>('SELECT * FROM property_db') : Promise.resolve([] as DynamicRow[]),
  ]);
  if (!target) {
    return { httpStatus: 200, body: { staff, shop, property: [], customer: [], suumo: [], athome: [], homes: [] } };
  }

  const store = removeAllSpaces(target.store);
  const property = properties.filter((p) => removeAllSpaces(p.store_name) === store);
  const ids = new Set(property.map((p) => trimmed(p.property_id)));

  const [customer, suumo, athome, homes] = await Promise.all([
    // ⚠️ 画面は property_name が入っている顧客しか使わない（filteredCustomer）
    query<DynamicRow>(customerSql(target.table, target.label, "WHERE property_name IS NOT NULL AND property_name <> ''")),
    query<DynamicRow>('SELECT * FROM suumo_resale_summary'),
    query<DynamicRow>('SELECT * FROM athome_summary_db'),
    query<DynamicRow>('SELECT * FROM homes_summary_db'),
  ]);

  return {
    httpStatus: 200,
    body: {
      staff,
      shop,
      property,
      customer,
      // ⚠️ 元の並び順のまま残す（画面は find で最初の1件を使う）
      suumo: suumo.filter((s) => ids.has(trimmed(s.management_no))),
      athome: athome.filter((a) => {
        const no = trimmed(a.management_no);
        return ids.has(no.slice(-6)) || ids.has(no);
      }),
      homes: homes.filter((h) => ids.has(trimmed(h.company_management_number))),
    },
  };
};

const normalizePropertyName = (value: unknown): string =>
  (value ? String(value).replace(/[（(]非?公開[）)]/g, '').replace(/[\s ]+/g, '') : '');

/**
 * v2.2.304 物件DB の1ページ（property_list に page を付けたとき）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ 絞り込み・PV の計算・並べ替えは、画面（DatabaseProperty.tsx の propertyList）と**同じ式**にしてある。
 *   ② に届かないとき画面は全件を読んで同じ計算をするので、片方だけ直すと GET と予備で表が変わる。
 * ⚠️ PV の合計で並べるので SQL の LIMIT では決まらない。事業の物件は全部読んで計算し、送るのだけを1ページ分にする。
 * ⚠️ 返す property は並べ替えたあとの1ページ分の行（property_db のまま）。customer・suumo・athome・homes はその物件にひもづく分だけ。
 *   画面はそれを並べ替え・絞り込みをせずに表に出す（⚠️「契約済み」の判定は全物件の最新の取り込み日で決まるので、画面で絞り直さない）。
 * 引数：page・perPage・shop（店舗。担当の所属）・rank・name（物件名）・address・staff（担当名）・company=1（自社物件）・contract=1（契約済み）・sort・dir
 * ─────────────────────────────────────────────
 */
const PROPERTY_PER_PAGES = [20, 50, 100, 500];
const PROPERTY_SORT_KEYS = new Set(['register', 'pv_total', 'pv_suumo', 'pv_homes', 'pv_athome']);
// ⚠️ 画面の safeClean と同じ
const safeClean = (value: unknown): string => (value ? String(value).replace(/[\s ]+/g, '') : '');
/** 今日の日（⚠️ 画面はブラウザの日本時間の getDate()。② は日本時間で数える） */
const tokyoDay = (): number => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', day: 'numeric' }).format(new Date())) || 1;

const runPropertyPage = async (body: Record<string, unknown>): Promise<PropertyResult> => {
  const target = STORE_OF[String(body.category ?? '')];
  const perPageAsked = Number(body.perPage);
  const perPage = PROPERTY_PER_PAGES.includes(perPageAsked) ? perPageAsked : PROPERTY_PER_PAGES[0];
  const text = (key: string): string => String(body[key] ?? '');
  const sortKey = PROPERTY_SORT_KEYS.has(text('sort')) ? text('sort') : 'pv_total';
  const sortDir = text('dir') === 'asc' ? 'asc' : 'desc';

  const [staff, shop, properties] = await Promise.all([
    query<DynamicRow>('SELECT * FROM staff_list WHERE `rank` = 1'),
    query<DynamicRow>("SELECT shop, section FROM shop_list WHERE division = '建売分譲事業' AND show_flag = 1"),
    target ? query<DynamicRow>('SELECT * FROM property_db') : Promise.resolve([] as DynamicRow[]),
  ]);
  const empty = { status: 'ok', staff, shop, property: [], customer: [], suumo: [], athome: [], homes: [], total: 0, page: 1, perPage };
  if (!target) return { httpStatus: 200, body: empty };

  const store = removeAllSpaces(target.store);
  const all = properties.filter((p) => removeAllSpaces(p.store_name) === store);
  const [customers, suumo, athome, homes] = await Promise.all([
    query<DynamicRow>(customerSql(target.table, target.label, "WHERE property_name IS NOT NULL AND property_name <> ''")),
    query<DynamicRow>('SELECT * FROM suumo_resale_summary'),
    query<DynamicRow>('SELECT * FROM athome_summary_db'),
    query<DynamicRow>('SELECT * FROM homes_summary_db'),
  ]);

  // ---- 絞り込み（⚠️ 画面の targetList と同じ）
  const shopName = text('shop'), rank = text('rank'), name = text('name'), address = text('address'), staffText = text('staff');
  const company = text('company') === '1', contract = text('contract') === '1';
  const targetStaffs = staff.filter((s) => s.shop === shopName).map((s) => safeClean(s.name));
  const formate = (value: string) => new Date((value ?? '').replace(/\//g, '-')).getTime();
  // ⚠️ 契約済み＝最新の取り込み日（registered）に無い物件。画面と同じく、並べ替えた先頭の registered と比べる
  const recentDate = [...all].sort((a, b) => formate(String(b.registered)) - formate(String(a.registered)))[0]?.registered;
  const isContract = (value: string) => recentDate !== value;
  const customersOf = (p: DynamicRow) => {
    const safePropName = normalizePropertyName(p.property_name);
    return customers.filter((c) => {
      const customerPropName = normalizePropertyName(c.property_name);
      if (!safePropName || !customerPropName) return false;
      return customerPropName.includes(safePropName);
    });
  };
  const targetList = all.filter((o) => {
    const base = customersOf(o);
    return (
      (company ? safeClean(String(o.agency)) === '株式会社国分ハウジング' : true)
      && (shopName ? targetStaffs.includes(safeClean(String(o.property_staff))) : true)
      && (name ? (String(o.property_name) || '').includes(name) : true)
      && (address ? (String(o.address) || '').includes(address) : true)
      && (staffText ? safeClean(String(o.property_staff)).includes(safeClean(staffText)) : true)
      && (rank ? base.some((f) => f.rank === rank) : true)
      && (contract ? isContract(String(o.registered)) : !isContract(String(o.registered)))
    );
  });

  // ---- PV（⚠️ 画面の mappedResult と同じ）と並べ替え
  const today = tokyoDay();
  const suumoOf = (id: string) => suumo.find((s) => String(s.management_no).trim() === id);
  const homesOf = (id: string) => homes.find((s) => String(s.company_management_number).trim() === id);
  const athomeOf = (id: string) => athome.find((a) => { const no = String(a.management_no ?? '').trim(); return no.slice(-6) === id || no === id; });
  const scored = targetList.map((t) => {
    const id = String(t.property_id ?? '').trim();
    const rawAthome = athomeOf(id);
    const pvSuumo = Number(suumoOf(String(t.property_id).trim())?.pv_total ?? 0);
    const pvHomes = Math.ceil((Number(homesOf(String(t.property_id).trim())?.detail_page_views ?? 0) / today) * 10) / 10;
    let pvAthome = 0;
    if (rawAthome?.start_date && rawAthome?.end_date) {
      const startDate = new Date(String(rawAthome.start_date).replace(/\//g, '-'));
      const endDate = new Date(String(rawAthome.end_date).replace(/\//g, '-'));
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const elapsedDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        pvAthome = Math.ceil((Number(rawAthome.pv_total ?? 0) / elapsedDays) * 10) / 10;
      }
    }
    const values: Record<string, number> = {
      register: customersOf(t).filter((b) => b.register).length,
      pv_total: Number(pvSuumo ?? 0) + Number(pvHomes ?? 0) + Number(pvAthome ?? 0),
      pv_suumo: Number(pvSuumo ?? 0), pv_homes: pvHomes, pv_athome: pvAthome,
    };
    return { row: t, value: Number(values[sortKey] ?? 0) };
  });
  scored.sort((a, b) => {
    if (a.value < b.value) return sortDir === 'asc' ? -1 : 1;
    if (a.value > b.value) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // ---- 1ページ分（⚠️ ページが件数より後ろなら最後のページに寄せる）
  const total = scored.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Math.floor(Number(body.page)) || 1), lastPage);
  const property = scored.slice((page - 1) * perPage, page * perPage).map((s) => s.row);
  const ids = new Set(property.map((p) => trimmed(p.property_id)));
  const names = property.map((p) => normalizePropertyName(p.property_name)).filter((n) => n !== '');
  return {
    httpStatus: 200,
    body: {
      status: 'ok', staff, shop, property, total, page, perPage,
      customer: customers.filter((c) => { const n = normalizePropertyName(c.property_name); return n !== '' && names.some((p) => n.includes(p)); }),
      // ⚠️ 元の並び順のまま残す（画面は find で最初の1件を使う）
      suumo: suumo.filter((s) => ids.has(trimmed(s.management_no))),
      athome: athome.filter((a) => { const no = trimmed(a.management_no); return ids.has(no.slice(-6)) || ids.has(no); }),
      homes: homes.filter((h) => ids.has(trimmed(h.company_management_number))),
    },
  };
};

/**
 * 物件の詳細（property_detail）。⚠️ 返すキーは ① の property:detail と同じ（status・property・suumo・homes・athome・customers）。
 * ⚠️ 顧客は、問い合わせ物件の名前がこの物件の名前を含む人だけ（画面の filteredCustomer と同じ比べ方）。① は建売・中古の全員を返していた。
 */
export const runPropertyDetail = async (body: Record<string, unknown>): Promise<PropertyResult> => {
  const id = trimmed(body.id);
  if (id === '') return { httpStatus: 400, body: { status: 'error', message: 'IDが指定されていません' } };

  const [[property], [suumo], [homes], [athome]] = await Promise.all([
    query<DynamicRow>('SELECT * FROM `property_db` WHERE `property_id` = ? LIMIT 1', [id]),
    query<DynamicRow>('SELECT * FROM `suumo_resale_summary` WHERE `management_no` = ? LIMIT 1', [id]),
    query<DynamicRow>('SELECT * FROM `homes_summary_db` WHERE `company_management_number` = ? LIMIT 1', [id]),
    query<DynamicRow>('SELECT * FROM `athome_summary_db` WHERE `management_no` = ? OR `management_no` LIKE ? LIMIT 1', [id, `%${id}`]),
  ]);

  const target = normalizePropertyName(property?.property_name);
  let customers: DynamicRow[] = [];
  if (target !== '') {
    const where = "WHERE property_name IS NOT NULL AND property_name <> ''";
    const [kaeru, resale] = await Promise.all([
      query<DynamicRow>(customerSql(STORE_OF.spec.table, STORE_OF.spec.label, where)),
      query<DynamicRow>(customerSql(STORE_OF.realty.table, STORE_OF.realty.label, where)),
    ]);
    customers = [...kaeru, ...resale].filter((c) => normalizePropertyName(c.property_name).includes(target));
  }

  return {
    httpStatus: 200,
    body: { status: 'success', property: property ?? null, suumo: suumo ?? null, homes: homes ?? null, athome: athome ?? null, customers },
  };
};

/**
 * SUUMO物件サマリー（property_suumo_latest）。
 * ⚠️ 取得日（date＝'YYYY-MM-DD'）の行だけを返す。⚠️ 省略・無い日付のときは最新の取得日（2026-11-25 の指示）。
 * ⚠️ 画面の「前回の順位」のため、その日の物件（url）ごとに、それより前の取得日のうち最新の1行もあわせて返す
 *   （画面は url ごとの履歴から「選んだ日より前の最初の1件」を前回にしている）。
 * ⚠️ dates は取得日の一覧（新しい順）。画面の取得日の選択肢に使う。
 */
export const runPropertySuumoLatest = async (body: Record<string, unknown>): Promise<PropertyResult> => {
  const dateRows = await query<DynamicRow>(
    'SELECT DISTINCT LEFT(registered_at, 10) AS d FROM suumo_property WHERE registered_at IS NOT NULL AND registered_at <> \'\' ORDER BY d DESC'
  );
  const dates = dateRows.map((r) => String(r.d)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const asked = String(body.date ?? '');
  const date = dates.includes(asked) ? asked : (dates[0] ?? '');
  if (date === '') return { httpStatus: 200, body: { suumo: [], dates, date } };

  const rows = await query<DynamicRow>('SELECT * FROM suumo_property WHERE registered_at LIKE ?', [`${date}%`]);
  const urls = [...new Set(rows.map((r) => String(r.url ?? '')).filter((u) => u !== ''))];
  let previous: DynamicRow[] = [];
  if (urls.length > 0) {
    const marks = urls.map(() => '?').join(', ');
    // ⚠️ url ごとに、選んだ日より前で最新の取得日時の行（同じ時刻が2行あれば両方。画面は新しい順の最初を使う）
    previous = await query<DynamicRow>(
      `SELECT s.* FROM suumo_property s
         JOIN (SELECT url, MAX(registered_at) AS at FROM suumo_property
                WHERE registered_at < ? AND url IN (${marks}) GROUP BY url) p
           ON p.url = s.url AND p.at = s.registered_at`,
      [date, ...urls]
    );
  }
  return { httpStatus: 200, body: { suumo: [...rows, ...previous], dates, date } };
};
