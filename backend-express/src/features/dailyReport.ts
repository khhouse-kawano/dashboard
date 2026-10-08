import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 月次日報（frontend/src/components/header/DailyReports.tsx）。v2.2.174 で ② へ移植。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/daily_report.php（⚠️ ① に**実在する**。消していない）
 *   ⚠️ express_proxy.php の許可リスト（expressProxyRequests）から外せば即座に ① へ戻る。
 *   ⚠️ 参照のみなので expressProxyExclusive には入れない（⚠️ ② が落ちたら ① が答える）。
 *
 * ⚠️⚠️ **1つの事業 × 1か月分だけを返す**（v2.2.167 と同じ）。⚠️ **全件を返す形に戻してはならない。**
 *   受け取るもの: { request: 'daily_report', division: '注文事業', month: '2026-10' }
 *
 * ⚠️⚠️ **返す形（キー名・call_log / interview_log が JSON 文字列であること）は PHP と同じ。**
 *   ⚠️ 画面（DailyReports.tsx）は変えていない。⚠️ 片方だけ直すと、どちらが答えたかで数字が変わる。
 *   ⚠️ 直すときは ① の daily_report.php も同じように直すこと。
 *
 * ⚠️ PHP との違い（⚠️ 応答は同じ）:
 *   ・PHP は memory_limit の都合で call_sheet / interview_sheet を1行ずつ読んでいた。
 *     ⚠️ ② は SQL で絞った行（その事業の店舗 × その月の day を含む行）を ⚠️ まとめて読む。
 *     ⚠️ ⚠️ 返すのはその月のログだけ（⚠️ ここは PHP と同じ）。
 *   ・数値の列（shop_list.id など）は ⚠️ 数値で返る（PHP は文字列）。⚠️ 画面は Number() で読んでいる。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface DailyReportResult {
  httpStatus: number;
  body: unknown;
}

/**
 * 事業 → 反響を取るマスタと列。⚠️ PHP の $DIVISION_SOURCES と同じ。
 * ⚠️ テーブル名・列名を SQL に埋めるので、⚠️ **ここにある事業以外は受けない**。
 */
const DIVISION_SOURCES: Record<string, { authority: string; table: string; appointment: string; contract: string }> = {
  注文事業: {
    authority: 'order',
    table: 'master_data',
    appointment: 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
    contract: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
  },
  建売分譲事業: {
    authority: 'spec',
    table: 'master_data_kaeru',
    appointment: 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
    contract: 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
  },
  中古リノベ: {
    authority: 'used',
    table: 'master_data_resale',
    appointment: 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
    contract: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
  },
};

/**
 * 元の店舗名 → shop_list の店舗名。⚠️ PHP の $SHOP_NAME_OF_RAW と同じ。
 * ⚠️⚠️ **読み替えはサーバーだけ**（⚠️ 画面は読み替えない）。
 */
const SHOP_NAME_OF_RAW: Record<string, string> = {
  '買い:中古リノベ': '中古住宅専門店',
  '買い:ポータル': '不動産企画係',
  '売り:ポータル': '不動産企画係',
};

/** 元の店舗名を shop_list の店舗名にする（⚠️ 対応表に無ければそのまま） */
const toShopName = (raw: unknown): unknown =>
  typeof raw === 'string' && Object.prototype.hasOwnProperty.call(SHOP_NAME_OF_RAW, raw)
    ? SHOP_NAME_OF_RAW[raw]
    : raw;

/** マスタの日付の列（⚠️ PHP の $dateColumns と同じ並び） */
const dateColumnsOf = (source: { appointment: string; contract: string }): [string, string][] => [
  ['register', 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99'],
  ['interview', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
  ['appointment', source.appointment],
  ['contract', source.contract],
];

/**
 * call_sheet / interview_sheet から、その事業の店舗・その月のログだけを取る。
 *
 * ⚠️ PHP の $fetchMonthLogs と同じ結果を返す:
 *   ・ログは day / action / staff だけ（⚠️ note は長いので返さない）
 *   ・day は `/` を `-` にそろえ、⚠️ `YYYY-MM-` で始まるものだけ残す
 *   ・その月のログが1つも無い行は返さない
 *   ・返す形は { shop: 読み替え済み, <ログ列>: JSON 文字列 }
 */
const fetchMonthLogs = async (
  table: 'call_sheet' | 'interview_sheet',
  logColumn: 'call_log' | 'interview_log',
  divisionShops: string[],
  logRegexp: string,
  month: string
): Promise<Record<string, unknown>[]> => {
  if (divisionShops.length === 0) return [];

  const holders = divisionShops.map(() => '?').join(',');
  const rows = await query<DynamicRow>(
    `SELECT shop, ${logColumn} FROM ${table} WHERE shop IN (${holders}) AND ${logColumn} REGEXP ?`,
    [...divisionShops, logRegexp]
  );

  const prefix = `${month}-`;
  const result: Record<string, unknown>[] = [];
  for (const row of rows) {
    let logs: unknown;
    try {
      logs = JSON.parse(String(row[logColumn] ?? ''));
    } catch {
      continue;
    }
    // ⚠️ PHP の is_array は連想配列（オブジェクト）も通すので、値を順に見る
    if (logs === null || typeof logs !== 'object') continue;
    const list: unknown[] = Array.isArray(logs) ? logs : Object.values(logs);

    const kept: { day: string; action: unknown; staff: unknown }[] = [];
    for (const log of list) {
      if (log === null || typeof log !== 'object') continue;
      const entry = log as Record<string, unknown>;
      const day = String(entry.day ?? '').replace(/\//g, '-');
      if (!day.startsWith(prefix)) continue;
      kept.push({ day, action: entry.action ?? null, staff: entry.staff ?? null });
    }
    if (kept.length === 0) continue;

    result.push({ shop: toShopName(row.shop), [logColumn]: JSON.stringify(kept) });
  }
  return result;
};

export const runDailyReport = async (body: Record<string, unknown>): Promise<DailyReportResult> => {
  const division = typeof body.division === 'string' ? body.division : '';
  const month = typeof body.month === 'string' ? body.month : '';

  // ⚠️ 事業はテーブル名・列名に使うため、一覧にある値以外は受けない（PHP と同じ 400）
  const source = Object.prototype.hasOwnProperty.call(DIVISION_SOURCES, division)
    ? DIVISION_SOURCES[division]
    : null;
  if (!source || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return { httpStatus: 400, body: { status: 'error', message: '事業または月の指定が正しくありません' } };
  }

  const [year, mon] = month.split('-');
  // マスタの日付は 2026/10/01 と 2026-10-01 が混在する
  const dateLikeDash = `${year}-${mon}-%`;
  const dateLikeSlash = `${year}/${mon}/%`;

  /**
   * ログ（JSON）の day をその月で拾う正規表現（⚠️ PHP と同じ文字列）。
   * ⚠️ 書き方が揃っていない: "day":"2026-10-01" ／ "day": "2026/10/01" ／ "day":"2026\/10\/01"
   * ⚠️ `\\\\` は JS の文字列で `\\`（= 正規表現でバックスラッシュ1文字）。
   */
  const logRegexp = `"day"[[:space:]]*:[[:space:]]*"${year}(-|\\\\?/)${mon}(-|\\\\?/)`;

  // --- 反響（その事業のマスタ1表。⚠️ その月の日付を1つでも持つ行だけ） ---
  const dateColumns = dateColumnsOf(source);
  const monthConditions = dateColumns.map(([, column]) => `${column} LIKE ? OR ${column} LIKE ?`);
  const monthParams = dateColumns.flatMap(() => [dateLikeDash, dateLikeSlash]);
  const selectDates = dateColumns.map(([alias, column]) => `${column} AS ${alias}`);

  const [responseRows, shopRows, staffRows] = await Promise.all([
    query<DynamicRow>(
      `SELECT
          ? AS authority,
          in_charge_store AS shop,
          in_charge_user AS staff,
          sales_promotion_name AS medium,
          ${selectDates.join(',\n          ')}
        FROM ${source.table}
       WHERE ${monthConditions.join(' OR ')}`,
      [source.authority, ...monthParams]
    ),
    // ⚠️ 画面の事業の選択肢は shop_list から作るので全店舗を返す
    query<DynamicRow>('SELECT id, brand, shop, division, section, area, report_flag FROM shop_list'),
    // ⚠️ 画面が使う列だけ（⚠️ メールアドレスなどは返さない）
    query<DynamicRow>(
      'SELECT id, name, shop, section, period, status, report, position FROM staff_list WHERE report = 1'
    ),
  ]);

  const response = responseRows.map((row) => ({ ...row, shop: toShopName(row.shop) }));

  // その事業の店舗を、call_sheet / interview_sheet の元の名前で（⚠️ 読み替え前の名前も含める）
  const divisionShopSet = new Set<string>();
  for (const shop of shopRows) {
    if (shop.division === division && Number(shop.report_flag) === 1 && typeof shop.shop === 'string') {
      divisionShopSet.add(shop.shop);
    }
  }
  const divisionShops = [...divisionShopSet];
  for (const [raw, shopName] of Object.entries(SHOP_NAME_OF_RAW)) {
    if (divisionShopSet.has(shopName)) divisionShops.push(raw);
  }

  const [call, interview] = await Promise.all([
    fetchMonthLogs('call_sheet', 'call_log', divisionShops, logRegexp, month),
    fetchMonthLogs('interview_sheet', 'interview_log', divisionShops, logRegexp, month),
  ]);

  return {
    httpStatus: 200,
    body: { response, call, interview, shop: shopRows, staff: staffRows },
  };
};
