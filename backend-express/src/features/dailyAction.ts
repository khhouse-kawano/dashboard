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
 * ⚠️⚠️ **氏名（`first_name`）が入っている行だけを出す**（2026-09-28 の追記）。
 *   ⚠️ 実測47件のうち ⚠️ **17件は氏名が空**だった（反響フォーム側の取りこぼし）。
 *   ⚠️ ⚠️ **誰のことか分からない行を晒しても動きようがない。**
 *   ⚠️ そのぶん ⚠️ **メニューのバッジより少なく出る。**
 *
 * ⚠️ 店舗・媒体は埋められるものは埋める。
 *   ⚠️ 店舗 … 空なら `ブランド + 店舗未設定`（⚠️ `shopFormate()` の言い方に合わせた）
 *   ⚠️ 媒体 … 空なら `medium`（⚠️ **こちらは全件埋まっている**）
 *
 * ⚠️ `shopFormate()`（フロント）はそのままは使えない。店舗マスタの配列が要るため。
 *
 * ⚠️⚠️ **当日の反響は出さない**（`DATEDIFF > 0`）。⚠️ まだ「放置」ではないため。
 *   ⚠️ 2026-09-28 に一度「Menu.tsx のバッジに揃える」と言われたが、
 *     ⚠️ ⚠️ **同日中に「該当日を含まないを優先してよい」と訂正があった。**
 *   ⚠️ ⚠️ **そのぶんバッジより少なく出る。これは不具合ではない。**
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
     AND TRIM(COALESCE(first_name, '')) <> ''
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

/**
 * 1つの表。
 *
 * ⚠️⚠️ **2026-09-28 に「全て別のテーブルで表示する」へ変わった。**
 *   ⚠️ 以前は未同期と来場未入力を1つに混ぜ、本日の予定も1表にしていた。
 *   ⚠️ ⚠️ **混ぜると何をすればよいかが読み取れない**というのが変更の理由。
 */
export interface DailySection {
  /** ⚠️ 画面の見出しにそのまま出す */
  label: string;
  /** ⚠️ 放置日数の列を出すかどうか。⚠️ **本日の予定には無い** */
  hasDays: boolean;
  rows: (AttentionRow | TodayRow)[];
}

export interface DailyActionResponse {
  /** ⚠️ 表示する順に並べてある。⚠️ **0件の表も含む**（画面側で落とす） */
  sections: DailySection[];
  /** ⚠️ 全部の合計。⚠️⚠️ **0 ならモーダルを出さない** */
  total: number;
  /** ⚠️ 上限で切り捨てたかどうか。⚠️ 画面に断りを出すために返す */
  truncated: boolean;
  /**
   * ⚠️⚠️ **モーダルを出してよいか。**
   *   ⚠️ `staff.check_daily_action` が**本日**なら false。
   *   ⚠️ ⚠️ **誰か分からない（Token が無い）ときは true。**
   *     ⚠️ 出しすぎるほうが、出ないより安全という判断。
   */
  show: boolean;
}

/**
 * その人が今日もう確認したか。
 *
 * ⚠️ `staff` はログインに使うテーブル（⚠️ **`staff_list` ではない**）。
 * ⚠️ 列は backend/scripts/sql/2026-09-28_staff_check_daily_action.sql で追加した。
 */
const CHECKED_SQL = `
  SELECT COUNT(*) AS c
    FROM staff
   WHERE id = ?
     AND check_daily_action = CURDATE()
`;

/** ⚠️ 「確認しました」を押したときに入れる。⚠️ **押した日だけを持つ**（履歴ではない） */
const CHECK_SQL = `
  UPDATE staff
     SET check_daily_action = CURDATE()
   WHERE id = ?
`;

interface CountRow extends RowDataPacket {
  c: number;
}

export const runDailyAction = async (staffId: number | null): Promise<DailyActionResponse> => {
  // ⚠️ クエリは互いに独立しているので並列で投げる
  const [unsync, cancel, today, checked] = await Promise.all([
    query<AttentionRow>(UNSYNC_SQL, [SYNC_START_MONTH, ROW_LIMIT]),
    query<AttentionRow>(CANCEL_SQL, [ROW_LIMIT]),
    query<TodayRow>(TODAY_SQL, [...TODAY_STEPS.map((s) => s.label), ROW_LIMIT]),
    staffId === null
      ? Promise.resolve([] as CountRow[])
      : query<CountRow>(CHECKED_SQL, [staffId]),
  ]);

  /**
   * ⚠️ 本日の予定は工程ごとの表に割る。
   *   ⚠️ `TODAY_SQL` は工程名を `step` に入れて返しているので、それで振り分ける。
   *   ⚠️ ⚠️ **並びは `TODAY_STEPS` のとおり**（商談が進む順）。入れ替えないこと。
   */
  const sections: DailySection[] = [
    { label: '未同期', hasDays: true, rows: unsync },
    { label: '来場日未入力', hasDays: true, rows: cancel },
    ...TODAY_STEPS.map((step) => ({
      label: `本日の${step.label}`,
      hasDays: false,
      rows: today.filter((row) => row.step === step.label),
    })),
  ];

  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);

  return {
    sections,
    total,
    truncated: unsync.length >= ROW_LIMIT || cancel.length >= ROW_LIMIT,
    show: Number(checked[0]?.c ?? 0) === 0,
  };
};

/**
 * 「確認しました」を記録する。
 *
 * ⚠️⚠️ **誰か分からないときは何もしない**（⚠️ `false` を返す）。
 *   ⚠️ 全員の行を更新してしまう事故を避けるため、⚠️ **`id` が無い UPDATE は投げない。**
 */
export const runDailyActionCheck = async (staffId: number | null): Promise<{ status: string }> => {
  if (staffId === null) return { status: 'error' };
  await query(CHECK_SQL, [staffId]);
  return { status: 'success' };
};

export const dailyAction = defineFeature({
  name: '本日のアクション',
  basePath: '/daily-action',
  routes: {
    'GET /': route({
      summary: '要確認の顧客（未同期・来場日未入力）と本日の予定',
      auth: true,
      query: z.object({}).optional(),
      handler: async ({ ctx }) => runDailyAction(ctx.staff?.id ?? null),
    }),
  },
});
