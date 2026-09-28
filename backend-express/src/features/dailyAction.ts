import { z } from 'zod';
import { defineFeature } from '../core/feature';
import { route } from '../core/route';
import { query } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * 注文営業のダッシュボードを開いたときに出す「要確認」と「本日の予定」。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **なぜ menu の応答を使い回さないのか**
 *
 *   ⚠️ `features/menu.ts` は **件数（COUNT）しか返さない。**
 *     ⚠️ 2026-09-14 に全件返しをやめた（**18.2MB → 数十バイト**）経緯がある。
 *     ⚠️⚠️ **あの形に戻してはならない。** Menu は全ページで走る。
 *
 *   ⚠️ ここは**モーダルを開くときだけ**呼ぶ別経路で、
 *     ⚠️ **表に出す5列しか取らない**（実測で 100行前後）。
 *
 * ⚠️⚠️ **判定条件は menu.ts と同じものを使うこと。**
 *   ⚠️ 片方だけ直すと **バッジの件数と一覧の行数が食い違う。**
 *   ⚠️ 未同期の条件は frontend の `listTags.ts` の `isPendingSync()` とも同じ。
 *
 * ⚠️ ① の backend/src/handlers/daily_action.php にも同じものを置いてある。
 *   ⚠️ ② が落ちたときのフォールバックなので、**形が違うと落ちた瞬間に壊れる。**
 * ─────────────────────────────────────────────
 */

/**
 * 日付の列を DATE に揃える式。
 *
 * ⚠️⚠️ **本番データは 'YYYY/MM/DD' と 'YYYY-MM-DD' が混在している。**
 *   ⚠️ 片方しか見ないと `STR_TO_DATE` が NULL を返し、**その行が黙って落ちる。**
 * ⚠️ 末尾に時刻や空白が付いた値があるため `SUBSTRING(...,1,10)` で切る
 *   （⚠️ 実測で `inquiry_date` に空白付きの値が1件あった）。
 */
const asDate = (column: string): string =>
  `STR_TO_DATE(REPLACE(SUBSTRING(${column}, 1, 10), '/', '-'), '%Y-%m-%d')`;

const INQUIRY_DATE = asDate('inquiry_date');
const RESERVED_DATE = asDate('reserved_interview');
const REGISTER_DATE = asDate('step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99');

/** 本日の予定に出す4つの工程。⚠️ 表示名は画面（TableInterview）の言い方に揃える */
const TODAY_STEPS: { column: string; label: string }[] = [
  { column: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', label: '初回面談' },
  { column: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', label: '事前審査' },
  { column: 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', label: '2回目以降面談' },
  { column: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', label: '契約' },
];

/**
 * 未同期の反響（まだ顧客になっていない）。
 *
 * ⚠️ 条件は menu.ts の `SYNC_SQL` と同じ。⚠️ **期間も同じ（2025/06 〜 当月）。**
 * ⚠️⚠️ **当日の反響は出さない**（指示）。⚠️ `DATEDIFF > 0` がそれである。
 *
 * ⚠️⚠️ **反響一覧に載る前の行なので、空の列が多い。**（実測47件中）
 *   ⚠️ 店舗が空 17件 ／ ⚠️ `response_medium` が空 18件 ／ ⚠️ 氏名が空 17件。
 *   ⚠️ ⚠️ **そのまま返すと表がほぼ空になる**ので、埋められるものは埋める。
 *     ⚠️ 店舗 … 空なら `ブランド + 店舗未設定`（⚠️ `shopFormate()` の言い方に合わせた）
 *     ⚠️ 媒体 … 空なら `medium`（⚠️ **こちらは47件すべて埋まっている**）
 *   ⚠️ 氏名だけは埋めようがない。⚠️ **画面側で「(未設定)」と出す。**
 *
 * ⚠️ `shopFormate()`（フロント）はそのままは使えない。店舗マスタの配列が要るため。
 */
const UNSYNC_SQL = `
  SELECT 'unsync' AS kind,
         DATEDIFF(CURDATE(), ${INQUIRY_DATE}) AS days,
         CASE WHEN TRIM(COALESCE(shop, '')) <> '' THEN TRIM(shop)
              WHEN TRIM(COALESCE(brand, '')) <> '' THEN CONCAT(TRIM(brand), '店舗未設定')
              ELSE '' END AS shop,
         DATE_FORMAT(${INQUIRY_DATE}, '%Y-%m-%d') AS register,
         TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS customer,
         COALESCE(NULLIF(TRIM(response_medium), ''), NULLIF(TRIM(medium), ''), '') AS medium
    FROM inquiry_customer
   WHERE COALESCE(sync, 0) = 0
     AND COALESCE(duplicate_flag, 0) <> 1
     AND COALESCE(support_flag, 0) <> 1
     AND COALESCE(black_flag, 0) <> 1
     AND SUBSTRING(inquiry_date, 1, 7) BETWEEN ? AND DATE_FORMAT(NOW(), '%Y/%m')
     AND DATEDIFF(CURDATE(), ${INQUIRY_DATE}) > 0
   ORDER BY days DESC
   LIMIT ?
`;

/**
 * 来場予定日を過ぎたのに結果が入っていない顧客。
 *
 * ⚠️ 条件は menu.ts の `CANCEL_SQL` と同じ。
 *   ⚠️ 基準日 '2026-01-01' も同じ（⚠️ **それより前の予約は数えない**運用）。
 *
 * ⚠️⚠️ **当日の予約は出さない**（指示）。⚠️ まだ「放置」ではないため。
 *   ⚠️ menu.ts の `< NOW()` は当日分も数えるので、⚠️ **バッジの件数より少し少なく出る。**
 *
 * ⚠️ 指示書には「初回面談日が該当日の顧客は表示せず」とあるが、
 *   ⚠️ **この条件では初回面談日は必ず空**である（上の `= ''`）。
 *   ⚠️ そのため予約日で当日を除く形にした。
 */
const CANCEL_SQL = `
  SELECT 'cancel' AS kind,
         DATEDIFF(CURDATE(), ${RESERVED_DATE}) AS days,
         COALESCE(NULLIF(TRIM(in_charge_store), ''), '') AS shop,
         COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y-%m-%d'), '') AS register,
         COALESCE(customer_contacts_name, '') AS customer,
         COALESCE(sales_promotion_name, '') AS medium
    FROM master_data
   WHERE show_dashboard = 1
     AND COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
     AND COALESCE(cancel_status, '') = ''
     AND COALESCE(status, '') <> '重複'
     AND ${RESERVED_DATE} > '2026-01-01'
     AND DATEDIFF(CURDATE(), ${RESERVED_DATE}) > 0
   ORDER BY days DESC
   LIMIT ?
`;

/**
 * 本日の予定。
 *
 * ⚠️ 4つの工程のどれかが**本日**の顧客。
 * ⚠️ 1人が同じ日に複数の工程を持つことがあるので `UNION ALL` で**工程ごとに1行**出す
 *   （⚠️ **まとめると「何の予定か」が分からなくなる**）。
 */
const TODAY_SQL = `
  ${TODAY_STEPS.map(
    (step) => `
  SELECT ? AS step,
         COALESCE(NULLIF(TRIM(in_charge_store), ''), '') AS shop,
         COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y-%m-%d'), '') AS register,
         COALESCE(customer_contacts_name, '') AS customer,
         COALESCE(sales_promotion_name, '') AS medium
    FROM master_data
   WHERE show_dashboard = 1
     AND COALESCE(status, '') <> '重複'
     AND ${asDate(step.column)} = CURDATE()`
  ).join('\n   UNION ALL\n')}
   ORDER BY shop, customer
   LIMIT ?
`;

/**
 * 未同期を数え始める月。
 * ⚠️ menu.ts の `SYNC_START_MONTH` と同じ。⚠️ **片方だけ変えると件数がずれる。**
 */
const SYNC_START_MONTH = '2025/06';

/**
 * 1つの表に出す上限。
 * ⚠️ 実測は未同期47件・来場未入力50件だが、⚠️ **放置されれば増える。**
 *   ⚠️ 上限が無いと**モーダルが開かなくなる**ので必ず付ける。
 * ⚠️ 放置日数の長い順なので、⚠️ **切り捨てられるのは新しいものから**である。
 */
const ROW_LIMIT = 200;

export interface AttentionRow extends RowDataPacket {
  kind: 'unsync' | 'cancel';
  days: number;
  shop: string;
  register: string;
  customer: string;
  medium: string;
}

export interface TodayRow extends RowDataPacket {
  step: string;
  shop: string;
  register: string;
  customer: string;
  medium: string;
}

export interface DailyActionResponse {
  attention: AttentionRow[];
  today: TodayRow[];
  /** ⚠️ 上限で切り捨てたかどうか。⚠️ 画面に「他◯件」と出すために返す */
  truncated: boolean;
}

export const runDailyAction = async (): Promise<DailyActionResponse> => {
  // ⚠️ 3クエリは互いに独立しているので並列で投げる
  const [unsync, cancel, today] = await Promise.all([
    query<AttentionRow>(UNSYNC_SQL, [SYNC_START_MONTH, ROW_LIMIT]),
    query<AttentionRow>(CANCEL_SQL, [ROW_LIMIT]),
    query<TodayRow>(TODAY_SQL, [...TODAY_STEPS.map((s) => s.label), ROW_LIMIT]),
  ]);

  /**
   * ⚠️ 2つの表を1つに混ぜ、⚠️ **放置日数の長い順**に並べ直す。
   *   ⚠️ 種類ごとに分けると「どちらがより放置されているか」が見えない。
   */
  const attention = [...unsync, ...cancel].sort((a, b) => Number(b.days) - Number(a.days));

  return {
    attention,
    today,
    truncated: unsync.length >= ROW_LIMIT || cancel.length >= ROW_LIMIT,
  };
};

export const dailyAction = defineFeature({
  name: '本日のアクション',
  basePath: '/daily-action',
  routes: {
    'GET /': route({
      summary: '要確認の顧客（未同期・来場未入力）と本日の予定',
      auth: true,
      query: z.object({}).optional(),
      handler: async () => runDailyAction(),
    }),
  },
});
