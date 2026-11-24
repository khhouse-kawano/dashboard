import { query } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * 架電状況一覧（CallStatusList.tsx）の初期データ。
 *
 * 移植元: backend/src/handlers/callStatusList.php
 *
 * ─────────────────────────────────────────────
 * category で参照する顧客テーブルが変わる
 *
 *   order → master_data          （注文）
 *   spec  → master_data_kaeru    （建売）
 *   used  → master_data_resale   （中古）
 *
 *   それ以外・未指定は master_data（PHP の既定値）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * ⚠️ SELECT * のものは列を書き出さない。
 *   ① でテーブルに列が追加されたとき、Express だけが古い形を返してしまう。
 */
const STAFF_SQL = 'SELECT * FROM staff_list WHERE rank = 1 or inside = 1';

const SHOP_SQL = 'SELECT shop, section, division, show_flag FROM shop_list';

const MEDIUM_SQL = 'SELECT medium, list_medium FROM medium_list WHERE response_medium = 0';

const CALL_SQL = 'SELECT * FROM call_sheet';

const INTRODUCTORY_SQL = 'SELECT * FROM introductory';

const FAMILY_SQL = 'SELECT * FROM family_info';

const EVENT_SQL = "SELECT * FROM event_calendar WHERE shop = 'khg' AND flag = 1";

/**
 * category → 顧客テーブル名。
 *
 * ⚠️ この対応表以外の値を受け付けないこと。
 *   テーブル名は SQL に直接埋め込むため、外部からの値をそのまま通すと
 *   SQL インジェクションになる。
 */
const CUSTOMER_TABLES = {
  order: 'master_data',
  spec: 'master_data_kaeru',
  used: 'master_data_resale',
} as const;

export type CallStatusCategory = keyof typeof CUSTOMER_TABLES;

/** PHP の既定値。category 未指定のときはこれを見る */
const DEFAULT_CUSTOMER_TABLE = CUSTOMER_TABLES.order;

/**
 * 顧客一覧。
 *
 * ⚠️⚠️ menu.php の同名クエリとほぼ同じだが **WHERE 句が無い**。
 *   menu.php は `WHERE show_dashboard = 1` で絞っているが、
 *   callStatusList.php は全件を返す。
 *   見た目が似ているので揃えたくなるが、揃えると件数が変わる。
 *
 * ⚠️ k_snap 列も menu.php にはあるが、こちらには無い。足さない。
 *
 * ⚠️ COALESCE / REPLACE / STR_TO_DATE の並びを PHP から1文字も変えていない。
 *   register は 'YYYY/MM/DD' と 'YYYY-MM-DD' の両方を試している。
 *   本番データに両形式が混在しているため、片方だけにすると NULL になる行が出る。
 */
const customerSql = (tableName: string): string => `
  SELECT
    id,
    COALESCE(customer_contacts_name, '') AS customer,
    COALESCE(in_charge_store, '') AS shop,
    COALESCE(in_charge_user, '') AS staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
    COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
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
    COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
    COALESCE(introduction_person_category, '') AS introduction_person_category,
    COALESCE(competitor_lost_contract_reason, '') AS competitor_lost_contract_reason,
    COALESCE(competitors_text, '') AS competitors_text,
    COALESCE(competitor_name, '') AS competitor_name,
    COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') AS event,
    COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') AS customized_input_01JRF9CZSW65A151WR30NA4PB3,
    COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH
  FROM ${tableName}
`;

export interface CallStatusListResponse {
  staff: Record<string, unknown>[];
  shop: Record<string, unknown>[];
  medium: Record<string, unknown>[];
  customer: Record<string, unknown>[];
  callLog: Record<string, unknown>[];
  family: Record<string, unknown>[];
  introductory: Record<string, unknown>[];
  event: Record<string, unknown>[];
}

/**
 * @param category 'order' | 'spec' | 'used' | undefined。
 *   ⚠️ ゲートウェイのレジストリで既知の値のみ登録しているため、
 *     未知の値がここへ来ることはない（① の PHP へ転送される）。
 */
export const runCallStatusList = async (
  category?: CallStatusCategory
): Promise<CallStatusListResponse> => {
  const tableName =
    category === undefined ? DEFAULT_CUSTOMER_TABLE : CUSTOMER_TABLES[category];

  // ⚠️ PHP は8つのクエリを逐次実行しているが、結果は互いに独立しているため
  //   並列でも同じレスポンスになる。コネクションプール上限（10）の範囲内。
  const [staff, shop, medium, customer, callLog, family, introductory, event] =
    await Promise.all([
      query<DynamicRow>(STAFF_SQL),
      query<DynamicRow>(SHOP_SQL),
      query<DynamicRow>(MEDIUM_SQL),
      query<DynamicRow>(customerSql(tableName)),
      query<DynamicRow>(CALL_SQL),
      query<DynamicRow>(FAMILY_SQL),
      query<DynamicRow>(INTRODUCTORY_SQL),
      query<DynamicRow>(EVENT_SQL),
    ]);

  // ⚠️ キーの順序も PHP の $result と同じにする。
  //   JSON のキー順が変わるとバイト単位の比較で差分になる。
  return {
    staff,
    shop,
    medium,
    customer,
    callLog,
    family,
    introductory,
    event,
  };
};

// ---------------------------------------------------------------------------
// 期間を選んで読む（v2.2.294。request call_status_summary。GET。画面は header/callStatus/CallStatusList.tsx）
//
// ⚠️⚠️ 上の callStatusList（POST）は全顧客・全架電シート（45〜60MB）を返し、画面が月ごとに数えていた。
//   ⚠️ こちらは、選んだ期間の数字を出すのに要る分だけを返す。⚠️ callStatusList は ② に届かないときの予備として残す。
// ⚠️⚠️ 絞り方は CallStatusList.tsx の filterForPeriod（予備で全件を読んだときに画面で同じことをする）と**同じ**。⚠️ 直すときは両方。
//   顧客      … 表示中（show_dashboard = 1。列名は trash）で、反響日（register）が期間の月に入る人
//   架電シート … この事業の表示中の顧客のもので、次のどれか
//               ・架電記録（call_log）に期間の月の日付がある
//               ・来場予定日（reserved_status）が期間の月
//               ・上の顧客のもの
//               ⚠️ 架電記録は丸ごと返す（画面は「最後の記録の日付」や「その担当の記録があるか」を見るため）
// ⚠️ 月の比べ方は画面と同じ（'-' を '/' にして 'YYYY/MM' を含むか）。
// ---------------------------------------------------------------------------

/** 期間の上限（月）。⚠️ 画面の CallStatusList.tsx の MAX_MONTHS と同じ */
const MAX_MONTHS = 12;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

const toYm = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** from〜to の月（'YYYY/MM'）。⚠️ 逆さま・上限を超える・形が違うときは null */
export const monthsBetween = (from: string, to: string): string[] | null => {
  const a = MONTH.exec(from), b = MONTH.exec(to);
  if (!a || !b) return null;
  const start = Number(a[1]) * 12 + Number(a[2]) - 1;
  const end = Number(b[1]) * 12 + Number(b[2]) - 1;
  if (end < start || end - start + 1 > MAX_MONTHS) return null;
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const n = start + i;
    return `${Math.floor(n / 12)}/${String((n % 12) + 1).padStart(2, '0')}`;
  });
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const monthHit = (value: unknown, months: string[]): boolean => {
  const d = String(value ?? '').replace(/-/g, '/');
  return months.some((m) => d.includes(m));
};

/** 架電記録（JSON）を読む（画面の parseLogs と同じ。⚠️ 1件だけのオブジェクトは配列にする） */
const parseLogs = (raw: unknown): { day?: unknown }[] => {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as { day?: unknown }[];
    if (parsed !== null && typeof parsed === 'object') return [parsed as { day?: unknown }];
    return [];
  } catch {
    return [];
  }
};

export interface CallStatusSummaryResult { httpStatus: number; body: Record<string, unknown> }

export const runCallStatusSummary = async (
  category: CallStatusCategory,
  p: Record<string, unknown>
): Promise<CallStatusSummaryResult> => {
  // ⚠️ 既定は今月までの6か月（⚠️ 本番の ② は Asia/Tokyo）
  const now = new Date();
  const from = str(p.from) || toYm(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const to = str(p.to) || toYm(now);
  const months = monthsBetween(from, to);
  if (months === null) {
    return { httpStatus: 400, body: { status: 'error', message: `期間は ${MAX_MONTHS}か月までで、開始月を終了月より前にしてください。` } };
  }

  const [staff, shop, customers, callSheets] = await Promise.all([
    query<DynamicRow>(STAFF_SQL),
    query<DynamicRow>(SHOP_SQL),
    query<DynamicRow>(customerSql(CUSTOMER_TABLES[category])),
    query<DynamicRow>(CALL_SQL),
  ]);

  // ⚠️ CallStatusList.tsx の filterForPeriod と同じ
  const visible = customers.filter((o) => Number(o.trash) === 1);
  const visibleIds = new Set(visible.map((o) => String(o.id)));
  const periodCustomers = visible.filter((o) => monthHit(o.register, months));
  const periodIds = new Set(periodCustomers.map((o) => String(o.id)));
  const callLog = callSheets.filter((c) => visibleIds.has(String(c.id)) && (
    periodIds.has(String(c.id))
    || monthHit(c.reserved_status, months)
    || parseLogs(c.call_log).some((a) => monthHit(a?.day, months))
  ));

  return { httpStatus: 200, body: { status: 'ok', from, to, staff, shop, customer: periodCustomers, callLog } };
};
