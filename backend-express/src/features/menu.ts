import { z } from 'zod';
import { defineFeature } from '../core/feature';
import { route } from '../core/route';
import { query } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * メニューの通知バッジ（Menu.tsx）。
 *
 * 移植元: backend/src/handlers/menu.php
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-14 に COUNT へ作り替えた。以前とは返す形が全く違う。**
 *
 *   旧版は3つのクエリを全件返し、フロント（Menu.tsx）が JavaScript で
 *   filter して件数を数えていた。実測で
 *
 *     inquiry_customer  18,098 件
 *     master_data       24,219 件
 *     → 応答 **18.2MB**。これを**数字3つのために**転送していた。
 *
 *   ⚠️⚠️ しかも Menu は**全ページで走る**。顧客一覧（21.8MB）より重く、
 *     2026-09-14 の実測では1回のページ表示で **18.2MB を2回**取得し、
 *     それぞれ 3.25 秒 / 2.88 秒かかっていた。
 *
 *   ⚠️ COUNT にしたことで応答は**数十バイト**になった。
 *     判定条件は変えていない。実データで新旧の件数が一致することを
 *     確認済み（未同期 94 / キャンセル 36 / 失注 39）。
 *
 * ⚠️⚠️ **判定条件の置き場所がフロントからここへ移った。**
 *   ⚠️ `sync` の条件は frontend/src/components/list/listTags.ts の
 *     `isPendingSync()` と**同じもの**である。あちらは反響一覧
 *     （ListOrder / ListKaeru / ListResale）が今も使っている。
 *     ⚠️ **片方だけ直すとメニューのバッジと一覧の件数が食い違う。**
 *
 * ⚠️⚠️ **① の backend/src/handlers/menu.php も同じ形にしてある。**
 *   転送が失敗したときのフォールバックなので、形が違うと
 *   その瞬間にバッジが壊れる（しかも普段は動くので気づくのが遅れる）。
 * ─────────────────────────────────────────────
 */

interface CountRow extends RowDataPacket {
  c: number;
}

/**
 * 未同期の反響。
 *
 * ⚠️ `isPendingSync()`（listTags.ts）の写し。
 *     sync が 0 で、かつ 重複・業者・ブラックのいずれでもないもの。
 * ⚠️ フラグは TINYINT だが、PDO が文字列で返すことがあるため
 *   フロントは Number() を通していた。SQL 側では型の心配が要らない。
 *
 * ⚠️⚠️ **期間は「2025/06 〜 当月」。** Menu.tsx の
 *   `getYearMonthArray(2025, 1).slice(5)` と同じ範囲である。
 *   ⚠️ 開始月は引数で渡す（フロントの定数と揃えるため）。
 *
 * ⚠️ `inquiry_date` は 'YYYY/MM/DD' の文字列。実測で末尾に空白が付いた
 *   値が1件あったが、`SUBSTRING(...,1,7)` なので影響しない。
 */
const SYNC_SQL = `
  SELECT COUNT(*) AS c
    FROM inquiry_customer
   WHERE COALESCE(sync, 0) = 0
     AND COALESCE(duplicate_flag, 0) <> 1
     AND COALESCE(support_flag, 0) <> 1
     AND COALESCE(black_flag, 0) <> 1
     AND SUBSTRING(inquiry_date, 1, 7) BETWEEN ? AND DATE_FORMAT(NOW(), '%Y/%m')
`;

/**
 * 来場予定日を過ぎたのに結果が入っていない顧客（キャンセル確認待ち）。
 *
 * ⚠️ `reserved_interview` は 'YYYY/MM/DD' と 'YYYY-MM-DD' が混在するため
 *   REPLACE してから STR_TO_DATE する。⚠️ 解釈できない値は NULL になり、
 *   比較が偽になる（フロントの `new Date('')` → NaN と同じ挙動）。
 *
 * ⚠️ 基準日 '2026-01-01' はフロントに直書きされていたものをそのまま移した。
 *   ⚠️ この日より前の予約は数えない、という運用上の区切りである。
 */
const CANCEL_SQL = `
  SELECT COUNT(*) AS c
    FROM master_data
   WHERE show_dashboard = 1
     AND COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
     AND COALESCE(cancel_status, '') = ''
     AND COALESCE(status, '') <> '重複'
     AND STR_TO_DATE(REPLACE(reserved_interview, '/', '-'), '%Y-%m-%d') > '2026-01-01'
     AND STR_TO_DATE(REPLACE(reserved_interview, '/', '-'), '%Y-%m-%d') < NOW()
`;

/**
 * 反響取得日を 'YYYY-MM-DD' に揃える式。
 *
 * ⚠️⚠️ **本番データに '/' 区切りと '-' 区切りが混在している。**
 *   ⚠️ 片方だけだと `STR_TO_DATE` が NULL を返し、**その行が黙って落ちる。**
 * ⚠️ ① の menu.php と**同じ2段構え**にしてある。
 */
const REGISTER_DATE = `
  COALESCE(
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d')
  )`;

/**
 * その列が未入力か。
 *
 * ⚠️⚠️ **`'null'` という文字列が実データに入っている。** 空文字と同じ扱いにする。
 *   ⚠️ `IS NULL` では拾えない。⚠️ フロントの `isBlank()` と同じ考え方である。
 * ⚠️ 空白だけの入力も未入力として扱うため `TRIM` を通す。
 *
 * ⚠️ 列名は**この関数の呼び出し側で決め打ちしたものしか渡さない。**
 *   ⚠️ 外部からの値を渡さないこと（SQL に直接埋め込むため）。
 */
const isBlankSql = (column: string): string =>
    `TRIM(COALESCE(${column}, '')) IN ('', 'null')`;

/**
 * 失注（競合負け）で埋めてほしい列。
 *
 * ⚠️⚠️ **フロントの `LOST_FIELDS`（informationUtils.ts）と同じ並び・同じ顔ぶれにすること。**
 *   ⚠️ 食い違うと、**メニューのバッジと失注一覧の件数が合わなくなる。**
 * ⚠️ ① の menu.php にも同じ一覧がある（計3か所）。**3つとも直すこと。**
 */
const LOST_REQUIRED_COLUMNS = [
    'competitor_name',
    'customized_input_01JRF9CZSW65A151WR30NA4PB3',
    'customized_input_01JSE7H4MQES619NBWX6PQDFRH',
    /**
     * ⚠️⚠️ **2026-09-17 に価格差・今後の対策を足したが、2026-09-18 に外した**（指示）。
     *   ⚠️ 新しい列なので**既存が全件空**で、⚠️ **要回答がほぼ全件になっていた。**
     *   ⚠️ ローカルの実測で **89件 → 4件**。
     *   ⚠️ ⚠️ **フロントの `LOST_FIELDS` からも外れている。** 片方だけ戻さないこと。
     *
     * 'competitor_price_gap',
     * 'competitor_countermeasure',
     */
];

/**
 * 失注したが理由が埋まっていない顧客。
 *
 * ⚠️ 条件は次のどちらかに当たれば「未記入」。
 *     ① 失注理由そのものが無い
 *     ② 理由が「競合負け」なのに `LOST_REQUIRED_COLUMNS` のどれかが空
 *
 * ⚠️⚠️ **2026-09-17 に価格差・今後の対策を足したため件数が増える。**
 *   ⚠️ ローカルの実測（対象283件）で **39件 → 108件**。
 *   ⚠️ 新しい列なので**既存は全件が空**である。**不具合ではない。**
 *
 * ⚠️ 期間は**反響取得日**が 2026-06-01 より後、かつ今日より前。
 *   ⚠️ **失注した日ではない。** ⚠️ フロントの各画面も同じ起点である。
 */
const LOST_SQL = `
  SELECT COUNT(*) AS c
    FROM master_data
   WHERE show_dashboard = 1
     AND COALESCE(status, '') = '失注'
     AND ${REGISTER_DATE} > '2026-06-01'
     AND ${REGISTER_DATE} < NOW()
     AND (
          ${isBlankSql('competitor_lost_contract_reason')}
       OR (competitor_lost_contract_reason = '競合負け'
           AND (${LOST_REQUIRED_COLUMNS.map(isBlankSql).join('\n             OR ')}))
     )
`;

/**
 * 新着物件。
 * ⚠️ 旧版は行を全部取ってから length を数えていた。COUNT に変えてある。
 * ⚠️ 実は Menu.tsx はこの値を**使っていない**（`estateId` は別物）。
 *   ⚠️ 返すのをやめると ① との応答が食い違うため残してある。
 */
const ESTATE_SQL = `
  SELECT COUNT(*) AS c
    FROM estate_info
   WHERE registered_at >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
`;

/**
 * 未同期を数え始める月。
 * ⚠️ Menu.tsx の `getYearMonthArray(2025, 1).slice(5)` の先頭と同じ。
 *   ⚠️ 片方だけ変えると件数がずれる。
 */
const SYNC_START_MONTH = '2025/06';

export interface MenuResponse {
  sync: number;
  cancel: number;
  lost: number;
  estate: number;
}

export const runMenu = async (): Promise<MenuResponse> => {
  // ⚠️ 4クエリを並列で投げる。互いに独立している
  const [sync, cancel, lost, estate] = await Promise.all([
    query<CountRow>(SYNC_SQL, [SYNC_START_MONTH]),
    query<CountRow>(CANCEL_SQL),
    query<CountRow>(LOST_SQL),
    query<CountRow>(ESTATE_SQL),
  ]);

  return {
    sync: Number(sync[0]?.c ?? 0),
    cancel: Number(cancel[0]?.c ?? 0),
    lost: Number(lost[0]?.c ?? 0),
    estate: Number(estate[0]?.c ?? 0),
  };
};

export const menu = defineFeature({
  name: 'メニュー',
  basePath: '/menu',
  routes: {
    'GET /badges': route({
      summary: 'メニューの通知バッジ用データ（未同期・キャンセル・失注・新着物件）',
      auth: true,
      query: z.object({}).optional(),
      handler: async () => runMenu(),
    }),
  },
});
