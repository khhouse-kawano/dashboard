# v2.2.174 フェスタ：並び替え・ブランド別歩留まり・複数店舗への同期 ／ 月次日報の Express 化

## 依頼（ReadMeClaude.md）
- FestaDashboard.tsx
  - 来場日・来場時間でソート（⚠️ 補足: **昇順・降順ボタン**）
  - 上部にブランドごとの歩留まり（面談数・次アポ数・有効名簿数）。⚠️ 補足: **有効名簿数＝sync されたか**
  - handleSync は同一店舗でなければ何回でもできる（event_db.shop に `,` 区切りで追加 or JSON）
  - 回転アイコンの下に shop を表示
- DailyReports.tsx の Express 化

## 決めたこと（2026-10-08 合意）
- 並び替え: 見出しのボタンで **昇順 → 降順 → 解除**。⚠️ 空欄は常に最後。⚠️ 同値は（来場日なら時間順・来場時間なら日付順）→ 新しい予約が上。絞り込みの select は残す。
- 歩留まり: 面談数・次アポ数（トグルがオンの件数）、次アポ率（次アポ÷面談）、有効名簿数（そのブランドの店舗へ同期した人数）。
  - ⚠️ 合計列: 面談・次アポはブランドの足し算、⚠️ 有効名簿は **sync=1 の人数**（2ブランドへ同期した人も1人）。
  - 店舗 → ブランドは shop_list.brand（KH/DJH/2L/PG(H)/KHF=かえる/KHR=中専）。無ければ店舗名の頭（なご/PG/かえる/DJ/KH/2L/中古住宅専門店）。
- 複数同期: ⚠️ **`,` 区切り**（⚠️ JSON にしない。shop は反響一覧の他イベントで「イベントの店舗」として使っているため）。DB の列変更なし。
  - ⚠️ 足すのは **サーバー**（新しい `function: 'sync_shop'`。1回の UPDATE で FIND_IN_SET により未登録のときだけ足す。sync=1 も同時に）。同時に別店舗へ同期しても消し合わない（ローカルで並列実行を確認）。
  - ⚠️ 冪等なので expressProxyExclusive には入れない。
  - 店舗は shop_list にある名前だけ受ける（`,` 入り・空・未知の名前は「店舗が正しくありません」）。
  - 同期画面: 店舗は毎回選び直し（初期は空）。同期済みの店舗は「（同期済み）」で選べない。
  - insert（顧客取込）のブランドは ⚠️ **選んだ店舗**の頭2文字で決める（以前は予約の shop → フェスタは空だった）。
  - insert 成功・sync_shop 失敗のときは赤字で「もう一度同期しないでください」。
- 回転アイコン: ⚠️ 常に表示（「同期済み」の赤字は外した）。下に同期した店舗を1行ずつ。
- 月次日報: ② に `features/dailyReport.ts`（runDailyReport）。registry `daily_report`（auth staff）。express_proxy.php の **expressProxyRequests() にだけ**追加（① PHP は残す＝フォールバック）。画面は変更なし。

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/header/` | **FestaDashboard.tsx** | 追加: `syncedShopsOf` / `BRAND_OF_SHOP_LIST` / `brandOfShop` / 型 `SortKey`・`SortDir` / state `sort`・`toggleSort` / `brandYield` / `syncedOfTarget` / `sortButton` / `yieldCell` / `rateText`。変更: `createSyncPayload(item, shop)` / `filtered`（並び替え）/ `handleSync` / `syncStart` / 同期セル / 見出し / 同期モーダル / CSS |
| `frontend/src/utils/` | **version.ts** | 2.2.174 |
| `backend-express/src/features/list/` | **event.ts** | 追加: **`runSyncShop`**、dispatch `sync_shop` |
| `backend-express/src/features/` | **dailyReport.ts**（新規） | **`runDailyReport`** / `fetchMonthLogs` / `toShopName` / `dateColumnsOf` |
| `backend-express/src/gateway/` | **registry.ts** | `daily_report` を登録 |
| `backend/src/handlers/listAction/` | **list_event.php** | `sync_shop` ブロック（② と同じ） |
| `backend/src/core/` | **express_proxy.php** | expressProxyRequests() に `daily_report` |
| `backend/scripts/sql/` | **2026-10-08_update_log_2.2.174.sql**（新規） | 更新履歴（ローカル投入済み no=270） |

## 確認（ローカル）
- ② `tsc --noEmit` OK ／ PHP `php -l` OK ／ フロント `npm run build` OK（main.f796d46d.js）
- 月次日報: ① PHP と ② の応答を **キーごとに JSON 文字列で比較 → 全一致**
  - 注文 2026-10 / 2026-09、建売 2026-09、中古 2026-09 / 2026-10（response / call / interview / shop / staff すべて same）
  - 不正な事業・月 → 両方「事業または月の指定が正しくありません」（② は 400）
- sync_shop（② と ① PHP の両方）: 追加 → 同じ店舗2回目は added:false → 別店舗は `,` で追加 → 並列2件とも残る → 未知・`,` 入り・空は拒否 → 無い ID は「予約が見つかりませんでした」。テスト行は元に戻した。
- ⚠️ ブラウザでの見た目は未確認。

## 注意
- ⚠️ v2.2.173 以前にフェスタで同期した行は shop が空 → どのブランドの有効名簿にも入らない（合計には入る）。
- ⚠️ 2人がほぼ同時に同じ人を **同じ店舗** へ同期すると、顧客取込は2件になりうる（shop には1つだけ）。

---

## コード全文

### 新規: backend-express/src/features/dailyReport.ts
```ts
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
```

### 差分（FestaDashboard.tsx / event.ts / registry.ts / list_event.php / express_proxy.php / version.ts）
```diff
diff --git a/backend-express/src/features/list/event.ts b/backend-express/src/features/list/event.ts
index baabe47f..d2813c7e 100644
--- a/backend-express/src/features/list/event.ts
+++ b/backend-express/src/features/list/event.ts
@@ -12,6 +12,7 @@ import type { SqlParam } from '../../db/pool';
  *     function = 'load'   … event_db と staff_list を全件返す（参照）
  *     function = 'update' … event_db の1行を更新（書き込み）
  *     function = 'festa'  … event_db.festa（営業入力の JSON）の1項目を書く（v2.2.172。書き込み）
+ *     function = 'sync_shop' … event_db.shop に同期した店舗を足す（v2.2.174。書き込み）
  *   `rank` と同じ構造である。request 名や roll だけでは書き込みか判断できない。
  *
  * ⚠️ ① に PHP ハンドラが**実在する**（消していない）。
@@ -253,6 +254,62 @@ const runFesta = async (body: Record<string, unknown>): Promise<ListEventResult>
   }
 };
 
+/**
+ * 同期した店舗を足す（function = 'sync_shop'）。v2.2.174。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️ フェスタ（FestaDashboard.tsx）は ⚠️ **店舗が違えば何度でも同期できる**（指示書）。
+ *   ⚠️ 同期した店舗を ⚠️ **event_db.shop に `,` 区切りで足していく**（⚠️ 列の形は変えない）。
+ *   ⚠️ shop は反響一覧（他のイベント）では「イベントの店舗」として使っているので、JSON にはしない。
+ *
+ * ⚠️⚠️ **足すのはサーバー**（⚠️ 1回の UPDATE）。⚠️ 画面が持っている shop に足して送ると、
+ *   ⚠️ 2人が同時に別の店舗へ同期したとき、⚠️ **後の人が先の人の店舗を消してしまう。**
+ * ⚠️ もう入っている店舗は足さない（FIND_IN_SET）。⚠️ 同じ要求が2回届いても結果は同じ（冪等）なので
+ *   ⚠️ ① へのフォールバックで再実行されても壊れない（⚠️ expressProxyExclusive には入れない）。
+ * ⚠️ sync も 1 にする（⚠️ 行の色・反響一覧の「同期済み」はこれを見ている）。
+ * ⚠️ 店舗は ⚠️ **shop_list にある名前だけ**受ける（⚠️ `,` を含む名前・空・でたらめな値を入れない）。
+ *
+ * 返す: { status: 'success', shop: 足したあとの shop, added: 足したか（⚠️ 既にあれば false） }
+ * ─────────────────────────────────────────────
+ */
+const runSyncShop = async (body: Record<string, unknown>): Promise<ListEventResult> => {
+  const id = typeof body.id === 'string' ? body.id.trim() : '';
+  const shop = typeof body.shop === 'string' ? body.shop.trim() : '';
+
+  if (id === '') {
+    return { httpStatus: 200, body: { status: 'error', message: 'IDが指定されていません' } };
+  }
+  if (shop === '' || shop.includes(',')) {
+    return { httpStatus: 200, body: { status: 'error', message: '店舗が正しくありません' } };
+  }
+
+  try {
+    const known = await query<DynamicRow>('SELECT 1 FROM shop_list WHERE shop = ? LIMIT 1', [shop]);
+    if (known.length === 0) {
+      return { httpStatus: 200, body: { status: 'error', message: '店舗が正しくありません' } };
+    }
+
+    const result = await execute(
+      `UPDATE event_db
+          SET shop = IF(shop IS NULL OR shop = '', ?, CONCAT(shop, ',', ?)), sync = 1
+        WHERE id = ? AND FIND_IN_SET(?, IFNULL(shop, '')) = 0`,
+      [shop, shop, id, shop]
+    );
+    const rows = await query<DynamicRow>('SELECT shop FROM event_db WHERE id = ?', [id]);
+    if (rows.length === 0) {
+      return { httpStatus: 200, body: { status: 'error', message: '予約が見つかりませんでした' } };
+    }
+    return {
+      httpStatus: 200,
+      body: { status: 'success', shop: rows[0].shop ?? '', added: result.affectedRows > 0 },
+    };
+  } catch (error) {
+    // ⚠️ DB のエラー本文は返さない（runUpdate と同じ）
+    console.error('list:event sync_shop failed', { id, shop, error });
+    return { httpStatus: 200, body: { status: 'error', message: '更新に失敗しました' } };
+  }
+};
+
 export const runListEvent = async (
   body: Record<string, unknown>
 ): Promise<ListEventResult> => {
@@ -261,6 +318,7 @@ export const runListEvent = async (
   if (fn === 'load') return runLoad();
   if (fn === 'update') return runUpdate(body);
   if (fn === 'festa') return runFesta(body);
+  if (fn === 'sync_shop') return runSyncShop(body);
 
   /**
    * ⚠️ PHP はここで**何も出力せず**終わる（空レスポンス・HTTP 200）。
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index d0af9a22..3a7fcff6 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -103,6 +103,7 @@ import {
 } from '../features/campaignForm';
 import { runCampaignFormEntry, runCampaignFormPublic } from '../features/campaignForm/entry';
 import { runCampaignSummary } from '../features/campaignSummary';
+import { runDailyReport } from '../features/dailyReport';
 import { runLostList } from '../features/lostList';
 import { runCompetitor } from '../features/competitor';
 import {
@@ -2091,6 +2092,27 @@ register({
   handler: async () => runCampaignSummary(),
 });
 
+// ---------------------------------------------------------------------------
+// 月次日報（header/DailyReports.tsx）。v2.2.174 で移植。
+//
+// ⚠️ 参照のみ。⚠️ ① に PHP ハンドラが実在する（daily_report.php）ので、
+//   転送に失敗しても ① へ自動フォールバックして動く（⚠️ expressProxyExclusive には入れない）。
+// ⚠️⚠️ 1つの事業 × 1か月分だけを返す（⚠️ 全件を返す形に戻さない）。
+// ⚠️ 事業・月が正しくなければ 400（PHP と同じ）。
+// ---------------------------------------------------------------------------
+
+register({
+  request: 'daily_report',
+  summary: '月次日報（1事業 × 1か月の反響・架電・面談ログ）',
+  phpSource: 'backend/src/handlers/daily_report.php',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await runDailyReport(ctx.body);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 // ---------------------------------------------------------------------------
 // ブラックリスト名簿の編集（header/EditBlackList.tsx）
 //
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index fe6088f0..a25d50fb 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -338,6 +338,15 @@ function expressProxyRequests(): array
         // -----------------------------------------------------------------
         'campaignSummary',
 
+        // -----------------------------------------------------------------
+        // 2026-10-08 移植（v2.2.174）。月次日報（DailyReports.tsx。参照のみ）。
+        //
+        // ⚠️ ① に PHP ハンドラが実在する（daily_report.php）。
+        //   この行を消せば即座に ① へ戻る。
+        // ⚠️ 書き込みは無いので expressProxyExclusive() へは入れない。
+        // -----------------------------------------------------------------
+        'daily_report',
+
         // -----------------------------------------------------------------
         // 2026-09-07 移植。顧客詳細モーダルの初期データ（参照のみ）。
         //
diff --git a/backend/src/handlers/listAction/list_event.php b/backend/src/handlers/listAction/list_event.php
index c72c2735..66e9cb3f 100644
--- a/backend/src/handlers/listAction/list_event.php
+++ b/backend/src/handlers/listAction/list_event.php
@@ -157,3 +157,58 @@ if ($function && $function === 'festa') {
 
     exit;
 }
+
+// ---------------------------------------------------------------------------
+// 同期した店舗を event_db.shop に `,` 区切りで足す。v2.2.174。
+//
+// ⚠️ ② の features/list/event.ts の runSyncShop と同じ処理（⚠️ ② が落ちたときのフォールバック）。
+// ⚠️⚠️ 足すのはサーバー（1回の UPDATE）。画面の shop に足して送ると、同時に同期したとき片方が消える。
+// ⚠️ もう入っている店舗は足さない（FIND_IN_SET。⚠️ 2回届いても結果は同じ）。sync も 1 にする。
+// ⚠️ 店舗は shop_list にある名前だけ（⚠️ `,` を含む名前は受けない）。
+// ---------------------------------------------------------------------------
+if ($function && $function === 'sync_shop') {
+
+    $id   = isset($data['id']) && is_string($data['id']) ? trim($data['id']) : '';
+    $shop = isset($data['shop']) && is_string($data['shop']) ? trim($data['shop']) : '';
+
+    if ($id === '') {
+        echo json_encode(['status' => 'error', 'message' => 'IDが指定されていません'], JSON_UNESCAPED_UNICODE);
+        exit;
+    }
+    if ($shop === '' || strpos($shop, ',') !== false) {
+        echo json_encode(['status' => 'error', 'message' => '店舗が正しくありません'], JSON_UNESCAPED_UNICODE);
+        exit;
+    }
+
+    try {
+        $stmt = $pdo->prepare("SELECT 1 FROM shop_list WHERE shop = :shop LIMIT 1");
+        $stmt->execute([':shop' => $shop]);
+        if (!$stmt->fetchColumn()) {
+            echo json_encode(['status' => 'error', 'message' => '店舗が正しくありません'], JSON_UNESCAPED_UNICODE);
+            exit;
+        }
+
+        $stmt = $pdo->prepare(
+            "UPDATE event_db SET shop = IF(shop IS NULL OR shop = '', :shop1, CONCAT(shop, ',', :shop2)), sync = 1
+              WHERE id = :id AND FIND_IN_SET(:shop3, IFNULL(shop, '')) = 0"
+        );
+        $stmt->execute([':shop1' => $shop, ':shop2' => $shop, ':id' => $id, ':shop3' => $shop]);
+        $added = $stmt->rowCount() > 0;
+
+        $stmt = $pdo->prepare("SELECT shop FROM event_db WHERE id = :id");
+        $stmt->execute([':id' => $id]);
+        $row = $stmt->fetch(PDO::FETCH_ASSOC);
+        if (!$row) {
+            echo json_encode(['status' => 'error', 'message' => '予約が見つかりませんでした'], JSON_UNESCAPED_UNICODE);
+            exit;
+        }
+
+        echo json_encode(['status' => 'success', 'shop' => $row['shop'] ?? '', 'added' => $added], JSON_UNESCAPED_UNICODE);
+    } catch (PDOException $e) {
+        // ⚠️ DB のエラー本文は返さない（② と同じ）
+        error_log('list_event sync_shop failed: ' . $e->getMessage());
+        echo json_encode(['status' => 'error', 'message' => '更新に失敗しました'], JSON_UNESCAPED_UNICODE);
+    }
+
+    exit;
+}
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index 2e6ca807..d4249649 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -20,6 +20,7 @@ import { setStyleClass } from '../../utils/setStyleClass';
  *     ・load   … 全予約（⚠️ ここで FESTA_TITLE に絞る）
  *     ・update … 1列ずつ保存（name / kana / check_in_time / check_out_time / staff / sync）
  *     ・festa  … ⚠️ 営業入力の **1項目だけ**を保存（② が JSON_SET で書く。⚠️ 同時に押しても消し合わない）
+ *     ・sync_shop … ⚠️ 同期した店舗を shop に `,` 区切りで足す（v2.2.174。⚠️ 足すのはサーバー）
  *
  *   ⚠️⚠️ チケット・ストラップの判定は ⚠️ **受付画面（LP の festa/reservation/index.html）と同じ規則**。
  *     ⚠️ 片方だけ直すと、受付と本部で言うことが食い違う。⚠️ 直すときは両方直すこと。
@@ -201,8 +202,8 @@ const brands: Record<string, string> = {
     'PG': 'PG HOUSE'
 };
 
-/** 顧客取込（insert）用のペイロード。⚠️ EventList.tsx の createSyncPayload と同じ */
-const createSyncPayload = (item: FestaRow): Record<string, string> => ({
+/** 顧客取込（insert）用のペイロード。⚠️ EventList.tsx の createSyncPayload と同じ（⚠️ brand だけ違う） */
+const createSyncPayload = (item: FestaRow, shop: string): Record<string, string> => ({
     id: generateULID(),
     customer_contacts_name: item.name || '',
     full_address: `${item.address || ''}${item.street || ''}`,
@@ -216,9 +217,42 @@ const createSyncPayload = (item: FestaRow): Record<string, string> => ({
     customized_input_01JRCT12N9X24PCQ5QZPAYKB93: item.title || '',
     status: '見込み',
     planned_construction_site: item.area || '',
-    brand: brands[(item.shop || '').slice(0, 2)] || ''
+    // ⚠️ v2.2.174: ブランドは ⚠️ **同期先に選んだ店舗**で決める（⚠️ フェスタの予約は shop が空・複数店舗になるため）
+    brand: brands[shop.slice(0, 2)] || ''
 });
 
+/**
+ * 同期した店舗（v2.2.174）。⚠️ event_db.shop に `,` 区切りで入っている（② の sync_shop が足す）。
+ * ⚠️ 店舗が違えば何度でも同期できる。⚠️ 同じ店舗には2回同期できない。
+ */
+const syncedShopsOf = (item: FestaRow): string[] => splitValues(item.shop);
+
+/**
+ * 店舗 → 営業入力のブランド（v2.2.174：有効名簿数を数えるため）。
+ * ⚠️ shop_list.brand で見分ける。⚠️ 無ければ店舗名の頭で見分ける（⚠️ なごみ・PG は shop_list に無いことがある）。
+ * ⚠️ どれにも当たらない店舗（JH・FH など）は '' （⚠️ どのブランドにも数えない）。
+ */
+const BRAND_OF_SHOP_LIST: Record<string, string> = {
+    KH: 'KH', DJH: 'DJH', '2L': '2L', PG: 'PGH', PGH: 'PGH', KHF: 'かえる', KHR: '中専',
+};
+const brandOfShop = (shop: string, shopList: MasterShop[]): string => {
+    const master = shopList.find(s => (s.shop ?? '').trim() === shop);
+    const byMaster = BRAND_OF_SHOP_LIST[(master?.brand ?? '').trim()];
+    if (byMaster) return byMaster;
+    if (shop.startsWith('なご')) return 'なごみ';
+    if (shop.startsWith('PG')) return 'PGH';
+    if (shop.startsWith('かえる')) return 'かえる';
+    if (shop.startsWith('DJ')) return 'DJH';
+    if (shop.startsWith('KH')) return 'KH';
+    if (shop.startsWith('2L')) return '2L';
+    if (shop === '中古住宅専門店') return '中専';
+    return '';
+};
+
+/** 並び替え（v2.2.174）。⚠️ 見出しのボタンで 昇順 → 降順 → 解除 */
+type SortKey = 'date' | 'time';
+type SortDir = 'asc' | 'desc';
+
 /** 「10:00」と「10:00~」をそろえる（⚠️ 集計表の見出し用） */
 const normalizeTime = (value: string | null | undefined): string =>
     String(value ?? '').trim().replace(/[~〜～]+$/, '').trim();
@@ -297,6 +331,13 @@ const FestaDashboard = ({ show, setShow }: Props) => {
      */
     const [targetDate, setTargetDate] = useState('');
     const [targetTime, setTargetTime] = useState('');
+    /** 並び替え（v2.2.174）。⚠️ null は既定（新しい予約が上） */
+    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
+    /** 見出しのボタン: 昇順 → 降順 → 解除（⚠️ 別の列を押したらその列の昇順から） */
+    const toggleSort = (key: SortKey) => setSort(prev => {
+        if (!prev || prev.key !== key) return { key, dir: 'asc' };
+        return prev.dir === 'asc' ? { key, dir: 'desc' } : null;
+    });
     /** ⚠️ 保存中のトグル（`id:key`）。⚠️ 連打で二重に送らない */
     const [savingKey, setSavingKey] = useState('');
 
@@ -395,6 +436,32 @@ const FestaDashboard = ({ show, setShow }: Props) => {
         return { dates, times, interviews, requests, lines, sum };
     }, [data]);
 
+    /**
+     * ブランド別の歩留まり（v2.2.174）。⚠️ フェスタの全予約で数える（⚠️ 検索・絞り込みは効かない）。
+     *   面談数 ／ 次アポ数 … 営業入力のトグルがオンの件数
+     *   次アポ率          … 次アポ数 ÷ 面談数（⚠️ 面談 0 なら「－」）
+     *   有効名簿数        … ⚠️ **そのブランドの店舗へ同期した人数**（⚠️ 1人を2ブランドへ同期したら両方で1件ずつ）
+     * ⚠️ 合計: 面談・次アポは各ブランドの足し算。⚠️ 有効名簿は ⚠️ **同期した人数**（⚠️ 重複を数えない）。
+     * ⚠️ v2.2.173 までに同期した行は shop が空なので、⚠️ どのブランドにも入らない（⚠️ 合計には入る）。
+     */
+    const brandYield = useMemo(() => {
+        const empty = () => ({ interview: 0, next: 0, list: 0 });
+        const byBrand = new Map<string, { interview: number; next: number; list: number }>(FESTA_BRANDS.map(b => [b, empty()]));
+        const total = empty();
+        data.forEach(item => {
+            const festa = parseFesta(item.festa);
+            FESTA_BRANDS.forEach(brand => {
+                const line = byBrand.get(brand)!;
+                if (festa[`${brand}_interview`] === true) { line.interview += 1; total.interview += 1; }
+                if (festa[`${brand}_next`] === true) { line.next += 1; total.next += 1; }
+            });
+            const listed = new Set(syncedShopsOf(item).map(shop => brandOfShop(shop, shopList)).filter(b => b !== ''));
+            listed.forEach(brand => { const line = byBrand.get(brand); if (line) line.list += 1; });
+            if (Number(item.sync) === 1) total.list += 1;
+        });
+        return { byBrand, total };
+    }, [data, shopList]);
+
     /** 来場日・来場時間の選択肢（⚠️ 空の値は出さない。⚠️ 時間は早い順） */
     const dateOptions = useMemo(
         () => Array.from(new Set(data.map(item => (item.date || '').trim()).filter(v => v !== ''))).sort(),
@@ -414,8 +481,33 @@ const FestaDashboard = ({ show, setShow }: Props) => {
             // ⚠️ 選択肢と同じく normalizeTime を通して比べる
             (targetTime === '' || normalizeTime(item.time) === targetTime)
         );
-        return [...rows].sort((a, b) => Number(b.no) - Number(a.no));
-    }, [data, keyword, targetDate, targetTime]);
+        const byNo = (a: FestaRow, b: FestaRow) => Number(b.no) - Number(a.no);
+        if (!sort) return [...rows].sort(byNo);
+
+        /**
+         * 並び替え（v2.2.174）。
+         *   ⚠️ 来場日は文字のまま比べる（`2026/10/10(土)` の形なので順に並ぶ）。
+         *   ⚠️ 来場時間は timeOrder（⚠️「10:00」と「10:00~」は同じ時刻）。
+         *   ⚠️ 空欄は ⚠️ **昇順でも降順でも最後**。
+         *   ⚠️ 同じ値どうしは、来場日なら時間の早い順・来場時間なら日の早い順・最後は新しい予約が上。
+         */
+        const dateOf = (item: FestaRow) => (item.date || '').trim();
+        const timeOf = (item: FestaRow) => normalizeTime(item.time);
+        const compareDate = (a: FestaRow, b: FestaRow) => dateOf(a).localeCompare(dateOf(b));
+        const compareTime = (a: FestaRow, b: FestaRow) =>
+            timeOrder(timeOf(a)) - timeOrder(timeOf(b)) || timeOf(a).localeCompare(timeOf(b));
+        const primaryValue = sort.key === 'date' ? dateOf : timeOf;
+        const primary = sort.key === 'date' ? compareDate : compareTime;
+        const secondary = sort.key === 'date' ? compareTime : compareDate;
+        const sign = sort.dir === 'asc' ? 1 : -1;
+
+        return [...rows].sort((a, b) => {
+            const emptyA = primaryValue(a) === '';
+            const emptyB = primaryValue(b) === '';
+            if (emptyA !== emptyB) return emptyA ? 1 : -1;
+            return sign * primary(a, b) || secondary(a, b) || byNo(a, b);
+        });
+    }, [data, keyword, targetDate, targetTime, sort]);
 
     // --- スクロールに合わせて描く行を増やす（EventList.tsx と同じ） ---
     const [displayLength, setDisplayLength] = useState(PAGE_SIZE);
@@ -423,7 +515,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
 
     useEffect(() => {
         setDisplayLength(PAGE_SIZE);
-    }, [keyword, targetDate, targetTime]);
+    }, [keyword, targetDate, targetTime, sort]);
 
     useEffect(() => {
         const total = filtered.length;
@@ -518,50 +610,102 @@ const FestaDashboard = ({ show, setShow }: Props) => {
         return [...staffArray.filter(s => s.shop === syncShop).map(s => s.name), `${syncShop} 管理`];
     }, [staffArray, syncShop]);
 
+    /**
+     * 同期（v2.2.174 で変更）。⚠️ **店舗が違えば何度でも同期できる**（指示書）。
+     *   ⚠️ 店舗は毎回選び直す（⚠️ 最初は空。⚠️ 同期済みの店舗は選択肢で選べない）。
+     */
     const handleSync = (item: FestaRow) => {
         setSyncTarget(item);
         setTargetStaff('');
-        setSyncShop((item.shop ?? '').trim());
+        setSyncShop('');
         setSyncShow(true);
     };
 
+    /** 同期の画面で、⚠️ その人がもう同期した店舗（⚠️ 選択肢で選べなくする） */
+    const syncedOfTarget = useMemo(() => (syncTarget ? syncedShopsOf(syncTarget) : []), [syncTarget]);
+
+    /**
+     * 同期の実行。
+     *   1. 顧客へ取り込む（roll: 'insert'。⚠️ EventList.tsx と同じ）
+     *   2. ⚠️ **同期した店舗を event_db.shop に足す**（function: 'sync_shop'。⚠️ 足すのはサーバー。sync も 1 になる）
+     * ⚠️ 1 が成功して 2 が失敗すると、⚠️ 取り込みは済んだのに画面では未同期の店舗に見える
+     *   （⚠️ もう一度押すと二重に取り込まれる）。⚠️ そのときは赤字で知らせる。
+     * ⚠️ 2人がほぼ同時に同じ人を同じ店舗へ同期すると、取り込みは2件になりうる（⚠️ 店舗は1つしか足されない）。
+     */
     const syncStart = async () => {
         if (!syncTarget || syncShop === '') {
             alert('担当店舗を選択してください');
             return;
         }
+        if (syncedOfTarget.includes(syncShop)) {
+            alert('この店舗にはもう同期しています');
+            return;
+        }
         if (targetStaff === '') {
             alert('スタッフを選択してください');
             return;
         }
+        const target = syncTarget;
+        const shop = syncShop;
         try {
             const response = await apiClient.post('', {
-                ...createSyncPayload(syncTarget),
+                ...createSyncPayload(target, shop),
                 in_charge_user: targetStaff,
-                in_charge_store: syncShop,
+                in_charge_store: shop,
                 request: 'list',
                 roll: 'insert',
                 category,
             });
-            if (response.data.status === 'success') {
-                const id = syncTarget.id;
-                setData(prev => prev.map(item => item.id === id ? { ...item, sync: 1 } : item));
-                void updateField(id, 'sync', 1);
-                setSyncShow(false);
-                setSyncTarget(null);
-                setTargetStaff('');
-                setSyncShop('');
-            } else {
+            if (response.data.status !== 'success') {
                 alert('同期に失敗しました。');
+                return;
             }
         } catch (e) {
             console.error(e);
             alert('同期に失敗しました。');
+            return;
+        }
+
+        setSyncShow(false);
+        setSyncTarget(null);
+        setTargetStaff('');
+        setSyncShop('');
+
+        try {
+            const res = await apiClient.post('', {
+                request: 'list', roll: 'event', function: 'sync_shop', category, id: target.id, shop,
+            });
+            if (res.data?.status !== 'success') throw new Error(res.data?.message ?? '保存できませんでした');
+            const nextShop = String(res.data.shop ?? '');
+            setData(prev => prev.map(item => item.id === target.id ? { ...item, shop: nextShop, sync: 1 } : item));
+            setError(null);
+        } catch (e) {
+            console.error(e);
+            setError(`${target.name} 様の取り込み（${shop}）は済みましたが、同期した店舗を記録できませんでした。もう一度同期しないでください。`);
         }
     };
 
     const checkedIn = data.filter(item => (item.check_in_time ?? '') !== '').length;
 
+    /** 見出しの並び替えボタン（v2.2.174）。⚠️ 今の向きを矢印で示す（⚠️ 解除中は上下の矢印） */
+    const sortButton = (key: SortKey, label: string) => {
+        const dir = sort?.key === key ? sort.dir : null;
+        const icon = dir === 'asc' ? 'fa-sort-up' : dir === 'desc' ? 'fa-sort-down' : 'fa-sort';
+        const state = dir === 'asc' ? '昇順' : dir === 'desc' ? '降順' : '並び替えなし';
+        return (
+            <button type="button" className="fe_sortbtn" data-active={dir ? '1' : '0'} onClick={() => toggleSort(key)}
+                aria-label={`${label}で並び替え（いま: ${state}）`} title={`${label}：${state}（押すと 昇順 → 降順 → 解除）`}>
+                <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
+            </button>
+        );
+    };
+
+    /** 歩留まり表の1マス（⚠️ 0 は薄く） */
+    const yieldCell = (n: number, key: string, first = false) =>
+        <td key={key} className={`${n === 0 ? 'fe_zero' : ''}${first ? ' fe_sep' : ''}`}>{n}</td>;
+    const rateText = (next: number, interview: number) =>
+        interview === 0 ? '－' : `${Math.round((next / interview) * 1000) / 10}%`;
+
     return (
         <>
             <Modal show={show} onHide={() => setShow(false)} fullscreen>
@@ -594,6 +738,11 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         .fe_consult_cell { white-space: normal; min-width: 200px; max-width: 240px; }
                         .fe_consult { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; margin: 1px 3px 1px 0; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 1.5; white-space: nowrap; }
                         .fe_consult i { font-size: 10px; }
+                        .fe_sortbtn { border: none; background: transparent; padding: 0 0 0 4px; color: #adb5bd; cursor: pointer; line-height: 1; }
+                        .fe_sortbtn[data-active="1"] { color: #5e72e4; }
+                        .fe_sortbtn:focus-visible { outline: 2px solid #5e72e4; outline-offset: 1px; border-radius: 2px; }
+                        .fe_sum th.fe_brandhead { background: var(--fe-brand); color: #fff; }
+                        .fe_sum .fe_label { text-align: left; font-weight: 700; color: #32325d; background: #fff; }
                         .fe_ticket { display: inline-block; min-width: 64px; padding: 2px 8px; border-radius: 999px; color: #fff; font-weight: 700; text-align: center; }
                         /*
                           ⚠️ 固定列（v2.2.172 追加指示）: 同期・顧客名・ふりがな の3列を左に固定する。
@@ -685,6 +834,56 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         </div>
                     )}
 
+                    {/* ブランド別の歩留まり（v2.2.174）。⚠️ 集計表の下 */}
+                    {data.length > 0 && (
+                        <div className="bg-white rounded shadow-sm border mb-2 p-2">
+                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#32325d', marginBottom: '4px' }}>
+                                ブランド別の歩留まり
+                                <small style={{ fontSize: '10px', fontWeight: 400, color: '#8898aa', marginLeft: '8px' }}>
+                                    有効名簿数＝そのブランドの店舗へ同期した人数（合計は同期した人数。2ブランドへ同期した人も1人）
+                                </small>
+                            </div>
+                            <div className="fe_sum_wrap">
+                                <table className="fe_sum">
+                                    <thead>
+                                        <tr>
+                                            <th></th>
+                                            {FESTA_BRANDS.map((brand, i) => (
+                                                <th key={brand} className={`fe_brandhead${i === 0 ? ' fe_sep' : ''}`} style={{ ['--fe-brand' as string]: brandColorOf(brand), minWidth: '52px' } as React.CSSProperties}>{brand}</th>
+                                            ))}
+                                            <th className="fe_group fe_sep" style={{ minWidth: '52px' }}>合計</th>
+                                        </tr>
+                                    </thead>
+                                    <tbody>
+                                        <tr>
+                                            <td className="fe_label">面談数</td>
+                                            {FESTA_BRANDS.map((brand, i) => yieldCell(brandYield.byBrand.get(brand)?.interview ?? 0, brand, i === 0))}
+                                            {yieldCell(brandYield.total.interview, 'total', true)}
+                                        </tr>
+                                        <tr>
+                                            <td className="fe_label">次アポ数</td>
+                                            {FESTA_BRANDS.map((brand, i) => yieldCell(brandYield.byBrand.get(brand)?.next ?? 0, brand, i === 0))}
+                                            {yieldCell(brandYield.total.next, 'total', true)}
+                                        </tr>
+                                        <tr>
+                                            <td className="fe_label">次アポ率</td>
+                                            {FESTA_BRANDS.map((brand, i) => {
+                                                const line = brandYield.byBrand.get(brand);
+                                                return <td key={brand} className={i === 0 ? 'fe_sep' : ''}>{rateText(line?.next ?? 0, line?.interview ?? 0)}</td>;
+                                            })}
+                                            <td className="fe_sep">{rateText(brandYield.total.next, brandYield.total.interview)}</td>
+                                        </tr>
+                                        <tr className="fe_sumrow">
+                                            <td className="fe_label">有効名簿数</td>
+                                            {FESTA_BRANDS.map((brand, i) => yieldCell(brandYield.byBrand.get(brand)?.list ?? 0, brand, i === 0))}
+                                            {yieldCell(brandYield.total.list, 'total', true)}
+                                        </tr>
+                                    </tbody>
+                                </table>
+                            </div>
+                        </div>
+                    )}
+
                     {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}
 
                     <div className="bg-white rounded shadow-sm border table-responsive">
@@ -702,8 +901,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                     <th rowSpan={3} className="fe_stick fe_stick_last" style={{ ...thStyle, ...stickyStyle(2) }}>ふりがな</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '70px' }}>ストラップ</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '220px' }}>相談内容</th>
-                                    <th rowSpan={3} style={{ ...thStyle, width: '110px' }}>来場日</th>
-                                    <th rowSpan={3} style={{ ...thStyle, width: '70px' }}>来場時間</th>
+                                    <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>来場日{sortButton('date', '来場日')}</th>
+                                    <th rowSpan={3} style={{ ...thStyle, width: '90px' }}>来場時間{sortButton('time', '来場時間')}</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '80px' }}>チケット</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '140px' }}>チェックイン</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '140px' }}>チェックアウト</th>
@@ -732,15 +931,21 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                 {visible.map((item, index) => {
                                     const festa = parseFesta(item.festa);
                                     return (
-                                        <tr key={item.id} className={item.sync === 1 ? 'table-primary' : ''}>
+                                        <tr key={item.id} className={Number(item.sync) === 1 ? 'table-primary' : ''}>
+                                            {/*
+                                              ⚠️ v2.2.174: 店舗が違えば何度でも同期できるので ⚠️ 回転アイコンは常に出す（⚠️「同期済み」の文字は外した）。
+                                                ⚠️ 同期済みかは行の色（table-primary）と、⚠️ アイコンの下の店舗名でわかる。
+                                            */}
                                             <td className="text-center fw-bold fe_stick" style={{ fontSize: '10px', ...stickyStyle(0) }}>
                                                 <div className="d-flex align-items-center gap-1">
                                                     <span>{index + 1}</span>
-                                                    {item.sync === 1
-                                                        ? <span style={{ fontSize: '9px', color: 'red' }}>同期済み</span>
-                                                        : <i className="fa-solid fa-arrows-rotate pointer" role="button" aria-label={`${item.name} を同期`} onClick={() => handleSync(item)}></i>}
+                                                    <i className="fa-solid fa-arrows-rotate pointer" role="button" tabIndex={0} aria-label={`${item.name} を同期`} title="同期"
+                                                        onClick={() => handleSync(item)}
+                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSync(item); } }}></i>
                                                 </div>
-                                                {item.shop && <div className="text-start fw-normal mt-1" style={{ fontSize: '9px', color: '#525f7f', whiteSpace: 'normal', lineHeight: 1.2 }}>{item.shop}</div>}
+                                                {syncedShopsOf(item).map(shop => (
+                                                    <div key={shop} className="text-start fw-normal mt-1" style={{ fontSize: '9px', color: '#525f7f', whiteSpace: 'normal', lineHeight: 1.2 }}>{shop}</div>
+                                                ))}
                                             </td>
                                             <td className="fe_stick" style={stickyStyle(1)}><input type="text" style={inputStyle} ref={setRef(item.id, 'name')} defaultValue={item.name ?? ''} onBlur={() => handleBlur(item.id, 'name')} /></td>
                                             <td className="fe_stick fe_stick_last" style={stickyStyle(2)}><input type="text" style={inputStyle} ref={setRef(item.id, 'kana')} defaultValue={item.kana ?? ''} onBlur={() => handleBlur(item.id, 'kana')} /></td>
@@ -821,11 +1026,16 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                 <Modal.Body className="p-3">
                     <div className="mb-2" style={{ fontSize: '11px', color: '#8898aa' }}>
                         {syncTarget ? `${syncTarget.name} 様` : ''}
+                        {/* ⚠️ v2.2.174: もう同期した店舗（⚠️ 下の選択肢では選べない） */}
+                        {syncedOfTarget.length > 0 && <div className="mt-1">同期済み：{syncedOfTarget.join('、')}</div>}
                     </div>
                     <select className="mb-2" style={{ ...inputStyle, height: '28px', fontSize: '12px' }}
                         value={syncShop} onChange={(e) => { setSyncShop(e.target.value); setTargetStaff(''); }}>
                         <option value="">担当店舗を選択</option>
-                        {shopOptions.map(name => <option key={name} value={name}>{name}</option>)}
+                        {shopOptions.map(name => {
+                            const done = syncedOfTarget.includes(name);
+                            return <option key={name} value={name} disabled={done}>{done ? `${name}（同期済み）` : name}</option>;
+                        })}
                     </select>
                     <select style={{ ...inputStyle, height: '28px', fontSize: '12px' }} value={targetStaff} onChange={(e) => setTargetStaff(e.target.value)}>
                         <option value="">担当営業を選択</option>
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index b630ffbe..a5d2598d 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.173';
+export const newVersion = '2.2.174';
```
