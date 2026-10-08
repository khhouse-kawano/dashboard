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

/**
 * ⚠️⚠️ **別名（`i.` / `m.`）を必ず付けること。**
 *   ⚠️ 2026-09-28 に `shop_list` を LEFT JOIN したため、
 *     ⚠️ **列名だけだと将来あいまいになる。**
 */
const INQUIRY_DATE = asDate('i.inquiry_date');
const RESERVED_DATE = asDate('m.reserved_interview');
const REGISTER_DATE = asDate('m.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99');

/**
 * 店舗名の表示。
 *
 * ⚠️⚠️ **`shop_list` の `show_flag = 1` に無い店舗名は `{ブランド}未設定` と出す**
 *   （2026-09-28 の指示）。
 *   ⚠️ 実データに `KH国分ハウジング` `PGH` `なごみ姶良霧島店` のような、
 *     ⚠️ **店舗マスタに無い値**が入っている（反響フォーム側の自由入力）。
 *   ⚠️ ⚠️ **そのまま出すと実在しない店舗名が並び、誰の担当か分からない。**
 *
 * ⚠️ ブランドの言い換えは ⚠️ **`frontend/src/utils/shopFormate.ts` と同じ**にすること。
 *   ⚠️ `Nagomi` → `なごみ` ／ `PG HOUSE` → `PGH`
 *   ⚠️ ⚠️ **片方だけ直すと画面ごとに違う店舗名が出る。**
 *
 * ⚠️⚠️ **出す文字列は `{ブランド}店舗未設定`。** ⚠️ `{ブランド}未設定` ではない。
 *   ⚠️ `shop_list` に ⚠️ **`KH店舗未設定` `DJH店舗未設定` などが実在する**
 *     （⚠️ `show_flag = 1`。⚠️ ListOrder が同期時に入れた値がそのまま店舗になっている）。
 *   ⚠️ ⚠️ **別の文字列にすると、同じ意味の行が2種類並ぶ**（`KH未設定` と `KH店舗未設定`）。
 *   ⚠️ `shopFormate()` の言い方とも一致する。
 *
 * ⚠️ ブランドも空のときは空文字。⚠️ 画面側が `(未設定)` と出す。
 */
const BRAND_LABEL = `
  CASE TRIM(COALESCE(%BRAND%, ''))
    WHEN 'Nagomi' THEN 'なごみ'
    WHEN 'PG HOUSE' THEN 'PGH'
    ELSE TRIM(COALESCE(%BRAND%, ''))
  END`;

/**
 * 店舗名を出す式。
 *
 * ⚠️ `%SHOP%` … 元の店舗名の列 ／ `%BRAND%` … ブランドの列
 * ⚠️ ⚠️ **`shop_list` は `s.shop` で LEFT JOIN 済みであること。**
 *   ⚠️ 一致しなければ `s.shop IS NULL` になる。
 */
const shopLabel = (shopColumn: string, brandColumn: string): string => {
  const brand = BRAND_LABEL.replace(/%BRAND%/gu, brandColumn);
  return `
    CASE
      WHEN s.shop IS NOT NULL THEN TRIM(${shopColumn})
      WHEN ${brand} <> '' THEN CONCAT(${brand}, '店舗未設定')
      ELSE ''
    END`;
};

/**
 * 表示対象の店舗。
 *
 * ⚠️ ⚠️ **`show_flag = 1` だけで絞る**（指示）。⚠️ 事業では絞らない。
 *   ⚠️ 未同期の反響には建売・中古の店舗も混ざりうるため。
 * ⚠️ `GROUP BY` で重複を潰す。⚠️ **潰さないと JOIN で行が増える。**
 */
const VISIBLE_SHOPS = `(SELECT shop FROM shop_list WHERE show_flag = 1 AND TRIM(COALESCE(shop, '')) <> '' GROUP BY shop)`;

/**
 * 事業（v2.2.175 で建売・中古にも広げた）。⚠️ フロントの AuthContext の category と同じ語。
 * ⚠️ それ以外（planner など）は注文として扱う（⚠️ 画面は order / spec / used でしか開かない）。
 */
export type DailyCategory = 'order' | 'spec' | 'used';
export const toDailyCategory = (value: unknown): DailyCategory =>
  value === 'spec' || value === 'used' ? value : 'order';

/**
 * 事業ごとのテーブルと「本日の予定」に出す工程。
 *
 * ⚠️⚠️ **工程は各事業の actionMap（顧客詳細の商談ステップ）から取る**（v2.2.175 合意: 全工程）。
 *   ⚠️ 注文は従来どおり4つ（初回面談・事前審査・2回目以降面談・契約）。
 *   ⚠️ ⚠️ **次回アクション日は入れない**（⚠️ 本日要連絡で出すため）。
 * ⚠️ 中古は ⚠️ **同じ列に区分ごとに別の名前**がある（例: 01J95TGV は 買い=2回目以降物件案内 / 売り=査定アポ）。
 *   ⚠️ ⚠️ **名前は行の in_charge_store（取引区分）で決める**（labelOf）。⚠️ features/interviewKpi.ts の RESALE_MAP と同じ。
 *   ⚠️ 表の並びは STEP_ORDER のとおり。
 */
interface DailySource {
  master: string;
  inquiry: string;
  /** ⚠️ 本日の予定で見る列（⚠️ 重複なし） */
  columns: string[];
  /** ⚠️ 列と取引区分 → 表示名 */
  labelOf: (column: string, deal: string) => string;
  /** ⚠️ 表の並び（⚠️ ここに無い名前は最後） */
  stepOrder: string[];
  /** ⚠️ 来場日未入力を出すか（⚠️ 注文だけ。v2.2.175 合意） */
  hasCancel: boolean;
}

const fixedLabels = (steps: [string, string][]) => {
  const byColumn = new Map(steps.map(([column, label]) => [column, label]));
  return {
    columns: steps.map(([column]) => column),
    labelOf: (column: string) => byColumn.get(column) ?? column,
    stepOrder: steps.map(([, label]) => label),
  };
};

/** 中古の区分ごとの工程（⚠️ features/interviewKpi.ts の RESALE_MAP から次回アクション日を除いたもの） */
const RESALE_STEPS: Record<string, [string, string][]> = {
  '買い:中古リノベ': [
    ['初回来場', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
    ['物件案内', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG'],
    ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
    ['2回目以降物件案内', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
    ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
    ['リフォーム契約', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'],
    ['売買契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
  ],
  '買い:ポータル': [
    ['初回来場', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
    ['物件案内', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG'],
    ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
    ['2回目以降物件案内', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
    ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
    ['売買契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
  ],
  '売り:ポータル': [
    ['査定アポ', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
    ['査定書提出', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22'],
    ['訪問査定', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN'],
    ['媒介取得', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0'],
  ],
};

const DAILY_SOURCES: Record<DailyCategory, DailySource> = {
  order: {
    master: 'master_data',
    inquiry: 'inquiry_customer',
    hasCancel: true,
    ...fixedLabels([
      ['step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', '初回面談'],
      ['step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', '事前審査'],
      ['step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', '2回目以降面談'],
      ['step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', '契約'],
    ]),
  },
  spec: {
    master: 'master_data_kaeru',
    inquiry: 'inquiry_customer_kaeru',
    hasCancel: false,
    // ⚠️ InformationEditKaeru.tsx の actionMap（⚠️ コメントアウトされている工程は出さない）
    ...fixedLabels([
      ['step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', '接触（通話・返信）'],
      ['step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', '初回面談'],
      ['step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', '2回目以降面談'],
      ['step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', '申し込み'],
      ['step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', '自社契約'],
      ['step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', '仲介契約'],
    ]),
  },
  used: {
    master: 'master_data_resale',
    inquiry: 'inquiry_customer_resale',
    hasCancel: false,
    columns: [...new Set(Object.values(RESALE_STEPS).flat().map(([, column]) => column))],
    // ⚠️ 区分が空・未知の行は「買い:中古リノベ」の名前で出す（⚠️ 一番多い区分）
    labelOf: (column, deal) => {
      const steps = RESALE_STEPS[deal] ?? RESALE_STEPS['買い:中古リノベ'];
      const hit = steps.find(([, c]) => c === column)
        ?? Object.values(RESALE_STEPS).flat().find(([, c]) => c === column);
      return hit ? hit[0] : column;
    },
    stepOrder: [...new Set(Object.values(RESALE_STEPS).flat().map(([label]) => label))],
  },
};

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
const unsyncSql = (inquiry: string): string => `
  SELECT 'unsync' AS kind,
         DATEDIFF(CURDATE(), ${INQUIRY_DATE}) AS days,
         ${shopLabel('i.shop', 'i.brand')} AS shop,
         DATE_FORMAT(${INQUIRY_DATE}, '%Y-%m-%d') AS register,
         TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS customer,
         COALESCE(NULLIF(TRIM(i.response_medium), ''), NULLIF(TRIM(i.medium), ''), '') AS medium,
         /*
           ⚠️ キャンペーン名（2026-09-28 の指示）。⚠️ **未同期の表にだけ出す。**
             ⚠️ 実測では ⚠️ **9割以上が空**（1,400件中 1,306件）。
             ⚠️ ⚠️ **空文字で返し、画面がハイフンと出す。**
           ⚠️ 20250426【KH共通】ゴールデンウィークマイホームフェア のように**長い**。
             ⚠️ 画面側で省略表示にしてある。
           ⚠️⚠️ **ここはテンプレートリテラルの中なのでバッククォートを書かないこと**（文字列が終わる）。
         */
         COALESCE(NULLIF(TRIM(i.hp_campaign), ''), '') AS campaign
    FROM ${inquiry} i
    LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(i.shop)
   WHERE COALESCE(i.sync, 0) = 0
     AND COALESCE(i.duplicate_flag, 0) <> 1
     AND COALESCE(i.support_flag, 0) <> 1
     AND COALESCE(i.black_flag, 0) <> 1
     AND TRIM(COALESCE(i.first_name, '')) <> ''
     AND SUBSTRING(i.inquiry_date, 1, 7) BETWEEN ? AND DATE_FORMAT(NOW(), '%Y/%m')
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
         ${shopLabel('m.in_charge_store', 'm.brand')} AS shop,
         COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y-%m-%d'), '') AS register,
         COALESCE(m.customer_contacts_name, '') AS customer,
         /*
           ⚠️ 担当営業（2026-09-28 の指示）。⚠️ **来場日未入力と本日の予定にだけ出す。**
             ⚠️ 未同期は inquiry_customer 由来で、⚠️ **まだ担当が決まっていない。**
           ⚠️⚠️ **in_charge_user をそのまま出す**（指示）。
             ⚠️ 失注や長期化で **「◯◯店 管理」に付け替えられている**ことがあり、
             ⚠️ ⚠️ **そのまま「◯◯店 管理」と表示される。** 誰の担当か分からない行はそれが正しい。
             ⚠️ 旧担当（first_interviewed_user）には**寄せていない**。
           ⚠️⚠️ **ここはテンプレートリテラルの中。バッククォートを書かないこと**（文字列が終わる）。
         */
         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
         COALESCE(m.sales_promotion_name, '') AS medium
    FROM master_data m
    LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(m.in_charge_store)
   WHERE m.show_dashboard = 1
     AND COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
     AND COALESCE(m.cancel_status, '') = ''
     AND COALESCE(m.status, '') <> '重複'
     AND ${RESERVED_DATE} > '2026-01-01'
     AND DATEDIFF(CURDATE(), ${RESERVED_DATE}) > 0
   ORDER BY days DESC
   LIMIT ?
`;

/**
 * 本日の予定。
 *
 * ⚠️ 事業の工程（DailySource.columns）のどれかが**本日**の顧客。
 * ⚠️ 1人が同じ日に複数の工程を持つことがあるので `UNION ALL` で**工程ごとに1行**出す
 *   （⚠️ **まとめると「何の予定か」が分からなくなる**）。
 * ⚠️ v2.2.175: 列名（col）と取引区分（deal）を返し、⚠️ **表示名はサーバーの JS で付ける**（labelOf）。
 */
const todaySql = (source: DailySource): string => `
  ${source.columns.map(
    (column) => `
  SELECT ? AS col,
         COALESCE(m.in_charge_store, '') AS deal,
         ${shopLabel('m.in_charge_store', 'm.brand')} AS shop,
         COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y-%m-%d'), '') AS register,
         COALESCE(m.customer_contacts_name, '') AS customer,
         /*
           ⚠️ 担当営業（2026-09-28 の指示）。⚠️ **来場日未入力と本日の予定にだけ出す。**
             ⚠️ 未同期は inquiry_customer 由来で、⚠️ **まだ担当が決まっていない。**
           ⚠️⚠️ **in_charge_user をそのまま出す**（指示）。
             ⚠️ 失注や長期化で **「◯◯店 管理」に付け替えられている**ことがあり、
             ⚠️ ⚠️ **そのまま「◯◯店 管理」と表示される。** 誰の担当か分からない行はそれが正しい。
             ⚠️ 旧担当（first_interviewed_user）には**寄せていない**。
           ⚠️⚠️ **ここはテンプレートリテラルの中。バッククォートを書かないこと**（文字列が終わる）。
         */
         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
         COALESCE(m.sales_promotion_name, '') AS medium
    FROM ${source.master} m
    LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(m.in_charge_store)
   WHERE m.show_dashboard = 1
     AND COALESCE(m.status, '') <> '重複'
     AND ${asDate(`m.${column}`)} = CURDATE()`
  ).join('\n   UNION ALL\n')}
   ORDER BY shop, customer
   LIMIT ?
`;

/**
 * 本日要連絡（v2.2.175）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 次のどちらかが ⚠️ **今日**のお客様:
 *   ・商談ステップ（interview_sheet.interview_log）の「次回アクション日」
 *   ・架電（call_sheet.call_log）の「次回架電日」
 * ⚠️⚠️ **記録（ログ）から数える**（⚠️ master の next_action_date 列ではない）。
 *   ⚠️ 予定が複数あっても今日のものを取りこぼさないため（2026-10-08 合意）。
 *
 * ⚠️ 流れ:
 *   1. ログに今日の day を含む行だけを SQL で拾う（⚠️ REGEXP。daily_report と同じ書き方の揺れに対応）
 *   2. JS でログを読み、⚠️ 今日の「次回アクション日」「次回架電日」がある id を集める
 *   3. ⚠️ その事業の master から id で引く（⚠️ id は3テーブルで重複しない）
 * ⚠️ 1人1行。⚠️ 両方あれば contact に「次回アクション・次回架電」。
 * ⚠️ 他の表と同じく show_dashboard = 1・重複でない顧客だけ。
 * ⚠️ ① の daily_action.php にも同じものがある（⚠️ 片方だけ直さないこと）。
 * ─────────────────────────────────────────────
 */
const NEXT_ACTION = '次回アクション日';
const NEXT_CALL = '次回架電日';

interface LogSheetRow extends RowDataPacket {
  id: string;
  log: string | null;
}

/** ログ（JSON）の day に今日の日付を含むかの正規表現（⚠️ "2026-10-08" / "2026/10/08" / "2026\/10\/08"） */
const todayLogRegexp = (today: string): string => {
  const [y, m, d] = today.split('-');
  return `"day"[[:space:]]*:[[:space:]]*"${y}(-|\\\\?/)${m}(-|\\\\?/)${d}`;
};

/** ログを読み、今日の指定アクションがある id を返す（⚠️ 日付は / と - を揃えて比べる） */
const idsWithToday = (rows: LogSheetRow[], action: string, today: string): Set<string> => {
  const ids = new Set<string>();
  for (const row of rows) {
    let logs: unknown;
    try {
      logs = JSON.parse(String(row.log ?? ''));
    } catch {
      continue;
    }
    if (logs === null || typeof logs !== 'object') continue;
    const list: unknown[] = Array.isArray(logs) ? logs : Object.values(logs);
    const hit = list.some((log) => {
      if (log === null || typeof log !== 'object') return false;
      const entry = log as Record<string, unknown>;
      const name = String(entry.action ?? '').split(',')[0];
      const day = String(entry.day ?? '').trim().replace(/\//g, '-').slice(0, 10);
      return name === action && day === today;
    });
    if (hit) ids.add(String(row.id));
  }
  return ids;
};

const contactSql = (master: string, count: number): string => `
  SELECT m.id AS id,
         ${shopLabel('m.in_charge_store', 'm.brand')} AS shop,
         COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y-%m-%d'), '') AS register,
         COALESCE(m.customer_contacts_name, '') AS customer,
         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
         COALESCE(m.sales_promotion_name, '') AS medium
    FROM ${master} m
    LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(m.in_charge_store)
   WHERE m.show_dashboard = 1
     AND COALESCE(m.status, '') <> '重複'
     AND m.id IN (${Array.from({ length: count }, () => '?').join(',')})
   ORDER BY shop, customer
   LIMIT ?
`;

interface TodayDateRow extends RowDataPacket {
  today: string;
}

export interface ContactRow extends RowDataPacket {
  id?: string;
  shop: string;
  register: string;
  customer: string;
  staff: string;
  medium: string;
  /** ⚠️ 何の連絡か（次回アクション ／ 次回架電 ／ 次回アクション・次回架電） */
  contact: string;
}

const fetchContacts = async (master: string): Promise<ContactRow[]> => {
  // ⚠️ 今日は DB の CURDATE()（⚠️ 他の表と同じ基準。⚠️ Node の時計を使わない）
  const [{ today }] = await query<TodayDateRow>("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
  const pattern = todayLogRegexp(today);
  const [interviewRows, callRows] = await Promise.all([
    query<LogSheetRow>('SELECT id, interview_log AS log FROM interview_sheet WHERE interview_log REGEXP ?', [pattern]),
    query<LogSheetRow>('SELECT id, call_log AS log FROM call_sheet WHERE call_log REGEXP ?', [pattern]),
  ]);
  const actionIds = idsWithToday(interviewRows, NEXT_ACTION, today);
  const callIds = idsWithToday(callRows, NEXT_CALL, today);
  const ids = [...new Set([...actionIds, ...callIds])];
  if (ids.length === 0) return [];

  const rows = await query<ContactRow>(contactSql(master, ids.length), [...ids, ROW_LIMIT]);
  return rows.map(({ id, ...row }) => {
    const kinds = [actionIds.has(String(id)) ? '次回アクション' : '', callIds.has(String(id)) ? '次回架電' : ''].filter((v) => v !== '');
    return { ...row, contact: kinds.join('・') } as ContactRow;
  });
};

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
  /** ⚠️ キャンペーン名。⚠️ **未同期の行だけが持つ**（来場日未入力には無い） */
  campaign?: string;
  /** ⚠️ 担当営業。⚠️ **来場日未入力の行だけが持つ**（未同期にはまだ担当がいない） */
  staff?: string;
}

export interface TodayRow extends RowDataPacket {
  /** ⚠️ 工程の列名（⚠️ 表示名は labelOf で付ける） */
  col: string;
  /** ⚠️ 取引区分（in_charge_store）。⚠️ 中古の表示名を決めるのに使う */
  deal: string;
  shop: string;
  register: string;
  customer: string;
  /** ⚠️ 担当営業（`master_data.in_charge_user`） */
  staff: string;
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
  /**
   * ⚠️ キャンペーンの列を出すかどうか。
   *   ⚠️⚠️ **未同期だけ true**（2026-09-28 の指示）。
   *   ⚠️ 来場日未入力・本日の予定は `master_data` 由来で、⚠️ **この列を返していない。**
   */
  hasCampaign: boolean;
  /**
   * ⚠️ 担当営業の列を出すかどうか。
   *   ⚠️⚠️ **未同期以外は true**（2026-09-28 の指示）。
   *   ⚠️ 未同期は `inquiry_customer` 由来で、⚠️ **まだ担当が決まっていない。**
   */
  hasStaff: boolean;
  /**
   * ⚠️ 連絡の種類の列（次回アクション ／ 次回架電）を出すかどうか。
   *   ⚠️⚠️ **本日要連絡だけ true**（v2.2.175）。
   */
  hasContact: boolean;
  /**
   * ⚠️ 目立たせる表か（v2.2.175）。⚠️ **本日要連絡だけ true**。⚠️ カードの色を変える
   */
  highlight: boolean;
  rows: (AttentionRow | TodayRow | ContactRow)[];
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

export const runDailyAction = async (
  staffId: number | null,
  categoryValue: unknown = 'order'
): Promise<DailyActionResponse> => {
  const category = toDailyCategory(categoryValue);
  const source = DAILY_SOURCES[category];

  // ⚠️ クエリは互いに独立しているので並列で投げる
  const [contact, unsync, cancel, todayRaw, checked] = await Promise.all([
    fetchContacts(source.master),
    query<AttentionRow>(unsyncSql(source.inquiry), [SYNC_START_MONTH, ROW_LIMIT]),
    // ⚠️ 来場日未入力は注文だけ（v2.2.175 合意）。⚠️ reserved_interview は注文の運用
    source.hasCancel ? query<AttentionRow>(CANCEL_SQL, [ROW_LIMIT]) : Promise.resolve([] as AttentionRow[]),
    query<TodayRow>(todaySql(source), [...source.columns, ROW_LIMIT]),
    staffId === null
      ? Promise.resolve([] as CountRow[])
      : query<CountRow>(CHECKED_SQL, [staffId]),
  ]);

  // ⚠️ 本日の予定の表示名（⚠️ 中古は取引区分で変わる）
  const today = todayRaw.map((row) => ({ ...row, step: source.labelOf(row.col, row.deal) }));
  const order = (label: string) => {
    const index = source.stepOrder.indexOf(label);
    return index === -1 ? source.stepOrder.length : index;
  };
  const steps = [...new Set(today.map((row) => row.step))].sort((a, b) => order(a) - order(b));

  /**
   * ⚠️⚠️ **並びは 本日要連絡 → 未同期 → 来場日未入力（注文だけ） → 本日の予定（工程順）**（v2.2.175 合意）。
   * ⚠️ 本日の予定は ⚠️ **行がある工程だけ**表を作る（⚠️ 中古は工程が多いため）。
   *   ⚠️ 0件の表は画面側でも落としている。
   * ⚠️ col / deal / step は画面に要らないので外して返す。
   */
  const sections: DailySection[] = [
    { label: '本日要連絡', hasDays: false, hasCampaign: false, hasStaff: true, hasContact: true, highlight: true, rows: contact },
    { label: '未同期', hasDays: true, hasCampaign: true, hasStaff: false, hasContact: false, highlight: false, rows: unsync },
    ...(source.hasCancel
      ? [{ label: '来場日未入力', hasDays: true, hasCampaign: false, hasStaff: true, hasContact: false, highlight: false, rows: cancel }]
      : []),
    ...steps.map((step) => ({
      label: `本日の${step}`,
      hasDays: false,
      hasCampaign: false,
      hasStaff: true,
      hasContact: false,
      highlight: false,
      rows: today
        .filter((row) => row.step === step)
        .map(({ col: _col, deal: _deal, step: _step, ...row }) => row as TodayRow),
    })),
  ];

  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);

  return {
    sections,
    total,
    truncated: unsync.length >= ROW_LIMIT || cancel.length >= ROW_LIMIT || contact.length >= ROW_LIMIT,
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
      handler: async ({ ctx }) => runDailyAction(ctx.staff?.id ?? null, 'order'),
    }),
  },
});
