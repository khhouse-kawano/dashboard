# v2.2.175 次回アクション日（KPI）／ 要確認に「本日要連絡」・全事業表示・カードから表へ移動

## 依頼（ReadMeClaude.md）
- InformationEdit / InformationEditKaeru / InformationEditResale の actionMap に **次回アクション日**。
  master_data / master_data_kaeru / master_data_resale に英名の列（TEXT DEFAULT NULL）。'2回目以降面談' の前。必要なら TableInterview.tsx も。
- DailyAction.tsx
  - カードを全部アンカーにして押せる → 各テーブルへ移動
  - **本日要連絡**（interview_sheet の次回アクション日が今日 ＋ call_sheet の次回架電日が今日）。一番左・他より目立つ。表は未同期の上
  - 全 category で表示。表示は 本日要連絡・未同期・設定した KPI の順。未同期の定義は注文と同じ

## 決めたこと（2026-10-08 合意）
| 項目 | 決定 |
|---|---|
| 列名 | `next_action_date`（3テーブル。TEXT DEFAULT NULL） |
| KPI の日付 | ⚠️ **この列だけ「一番新しい日付」**（他の KPI 列は従来どおり一番古い日付）。`LATEST_COLUMNS` |
| 売り:ポータル | 先頭に追加（2回目以降面談が無いため） |
| 建売・中古の「設定した KPI」 | actionMap の全工程（次回アクション日は除く）。中古は行の取引区分で工程名を決める |
| 来場日未入力 | 注文だけ残す |
| 本日要連絡の数え方 | ⚠️ **ログから**（interview_log の「次回アクション日」・call_log の「次回架電日」の day が今日）。1人1行、両方なら「次回アクション・次回架電」 |
| カードの移動 | モーダル内の表へスクロール（URL は変えない＝要確認が開き直さない） |
| 本日要連絡の色 | 深緑の塗りつぶし＋白文字（放置の赤・ボタンの青と別） |

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend/scripts/sql/` | **2026-10-08_master_next_action_date.sql**（新規） | ALTER ×3（ローカル投入済み） |
| `backend/scripts/sql/` | **2026-10-08_update_log_2.2.175.sql**（新規） | 更新履歴（ローカル no=271） |
| `frontend/src/components/information/` | **InformationEdit.tsx / InformationEditKaeru.tsx / InformationEditResale.tsx** | actionMap に `'次回アクション日': 'next_action_date'` |
| `frontend/src/components/information/` | **TableInterview.tsx** | コメントのみ（選択肢は actionMap から出るので処理の変更なし） |
| `frontend/src/utils/` | **interviewKpi.ts** | 追加 **`LATEST_COLUMNS`**、`deriveKpiColumns` で最新を採る分岐 |
| `backend-express/src/features/` | **interviewKpi.ts** | ORDER/SPEC/RESALE_MAP に次回アクション日、**`LATEST_COLUMNS`**、`deriveKpiColumns` |
| `backend-express/src/features/information/` | **masterDataColumns.ts** | `next_action_date` |
| `backend/src/core/` | **allowed_columns.php** | `next_action_date` |
| `backend-express/src/features/` | **dailyAction.ts** | 追加: `DailyCategory` / `toDailyCategory` / `DailySource` / `fixedLabels` / `RESALE_STEPS` / `DAILY_SOURCES` / `unsyncSql` / `todaySql` / **`fetchContacts`** / `idsWithToday` / `todayLogRegexp` / `contactSql`。変更: **`runDailyAction(staffId, category)`**、`DailySection` に `hasContact` / `highlight`、`TodayRow` に `col` / `deal` |
| `backend-express/src/gateway/` | **registry.ts** | `daily_action:list` を spec / used にも登録 |
| `backend/src/handlers/` | **daily_action.php** | ② と同じ（事業別・本日要連絡・工程名・並び） |
| `frontend/src/components/` | **DailyAction.tsx** | 対象を order/spec/used に、`DAILY_CATEGORIES` / `sectionId` / **`jumpTo`**、カードを `<a>` に、本日要連絡の強調・「連絡」列、キャッシュを category ごとに |
| `frontend/src/utils/` | **version.ts** | 2.2.175 |

⚠️ express_proxy.php は変更なし（`daily_action:list` は category を問わず ② へ転送している）。

## 確認（ローカル）
- ② `tsc --noEmit` OK ／ PHP `php -l` OK ／ フロント `npm run build` OK（main.d519edfd.js。出ている警告は既存のもの）
- KPI 規則: 次回アクション日 10/10・10/25・10/05 → **10/25**。一番新しい記録を消す → **10/10**。最後の1件を消す → 列を空に（現在値と一致するとき）。初回面談は従来どおり最古。中古「売り:ポータル」の選択肢の先頭に次回アクション日。
- 要確認: テスト記録（day の書き方 `2026/10/08` ・ `"day": "2026-10-08"` ・ `2026\/10\/08`、明日の予定のおとり）を一時的に入れて **① PHP と ② の応答を order / spec / used で比較 → 3つとも完全一致**
  - order: 本日要連絡 1件（次回アクション・次回架電）→ 未同期 → 来場日未入力 → 本日の予定
  - spec: 本日要連絡 1件（次回架電。エスケープされた日付）
  - used: 本日要連絡 1件、売り:ポータルの顧客の 01J95TGV が「本日の**査定アポ**」と出る
  - テスト記録は削除・値は元に戻した（⚠️ interview_sheet / call_sheet の AUTO_INCREMENT はローカルで 90004 まで進んだ）
- ⚠️ ブラウザでの見た目は未確認。

## ⚠️ 注意（要判断）
- ⚠️ 未同期を注文と同じ定義にすると、ローカルの件数は **建売 881件・中古 669件**（注文 11件）。⚠️ 建売・中古は反響を全部は同期しない運用のようで、⚠️ **表は上限200件で切れ、要確認が毎回開く**。期間を絞る等が必要なら次の版で。

---

## コード（差分）
差分は `git show` の該当コミットを参照（下に全文の差分を貼る）。

```diff
diff --git a/backend-express/src/features/dailyAction.ts b/backend-express/src/features/dailyAction.ts
index 622a44f2..6288d603 100644
--- a/backend-express/src/features/dailyAction.ts
+++ b/backend-express/src/features/dailyAction.ts
@@ -100,13 +100,114 @@ const shopLabel = (shopColumn: string, brandColumn: string): string => {
  */
 const VISIBLE_SHOPS = `(SELECT shop FROM shop_list WHERE show_flag = 1 AND TRIM(COALESCE(shop, '')) <> '' GROUP BY shop)`;
 
-/** 本日の予定に出す4つの工程。⚠️ 表示名は画面（TableInterview）の言い方に揃える */
-const TODAY_STEPS: { column: string; label: string }[] = [
-  { column: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', label: '初回面談' },
-  { column: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', label: '事前審査' },
-  { column: 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', label: '2回目以降面談' },
-  { column: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', label: '契約' },
-];
+/**
+ * 事業（v2.2.175 で建売・中古にも広げた）。⚠️ フロントの AuthContext の category と同じ語。
+ * ⚠️ それ以外（planner など）は注文として扱う（⚠️ 画面は order / spec / used でしか開かない）。
+ */
+export type DailyCategory = 'order' | 'spec' | 'used';
+export const toDailyCategory = (value: unknown): DailyCategory =>
+  value === 'spec' || value === 'used' ? value : 'order';
+
+/**
+ * 事業ごとのテーブルと「本日の予定」に出す工程。
+ *
+ * ⚠️⚠️ **工程は各事業の actionMap（顧客詳細の商談ステップ）から取る**（v2.2.175 合意: 全工程）。
+ *   ⚠️ 注文は従来どおり4つ（初回面談・事前審査・2回目以降面談・契約）。
+ *   ⚠️ ⚠️ **次回アクション日は入れない**（⚠️ 本日要連絡で出すため）。
+ * ⚠️ 中古は ⚠️ **同じ列に区分ごとに別の名前**がある（例: 01J95TGV は 買い=2回目以降物件案内 / 売り=査定アポ）。
+ *   ⚠️ ⚠️ **名前は行の in_charge_store（取引区分）で決める**（labelOf）。⚠️ features/interviewKpi.ts の RESALE_MAP と同じ。
+ *   ⚠️ 表の並びは STEP_ORDER のとおり。
+ */
+interface DailySource {
+  master: string;
+  inquiry: string;
+  /** ⚠️ 本日の予定で見る列（⚠️ 重複なし） */
+  columns: string[];
+  /** ⚠️ 列と取引区分 → 表示名 */
+  labelOf: (column: string, deal: string) => string;
+  /** ⚠️ 表の並び（⚠️ ここに無い名前は最後） */
+  stepOrder: string[];
+  /** ⚠️ 来場日未入力を出すか（⚠️ 注文だけ。v2.2.175 合意） */
+  hasCancel: boolean;
+}
+
+const fixedLabels = (steps: [string, string][]) => {
+  const byColumn = new Map(steps.map(([column, label]) => [column, label]));
+  return {
+    columns: steps.map(([column]) => column),
+    labelOf: (column: string) => byColumn.get(column) ?? column,
+    stepOrder: steps.map(([, label]) => label),
+  };
+};
+
+/** 中古の区分ごとの工程（⚠️ features/interviewKpi.ts の RESALE_MAP から次回アクション日を除いたもの） */
+const RESALE_STEPS: Record<string, [string, string][]> = {
+  '買い:中古リノベ': [
+    ['初回来場', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
+    ['物件案内', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG'],
+    ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
+    ['2回目以降物件案内', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
+    ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
+    ['リフォーム契約', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'],
+    ['売買契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
+  ],
+  '買い:ポータル': [
+    ['初回来場', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
+    ['物件案内', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG'],
+    ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
+    ['2回目以降物件案内', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
+    ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
+    ['売買契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
+  ],
+  '売り:ポータル': [
+    ['査定アポ', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
+    ['査定書提出', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22'],
+    ['訪問査定', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN'],
+    ['媒介取得', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0'],
+  ],
+};
+
+const DAILY_SOURCES: Record<DailyCategory, DailySource> = {
+  order: {
+    master: 'master_data',
+    inquiry: 'inquiry_customer',
+    hasCancel: true,
+    ...fixedLabels([
+      ['step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', '初回面談'],
+      ['step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', '事前審査'],
+      ['step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', '2回目以降面談'],
+      ['step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', '契約'],
+    ]),
+  },
+  spec: {
+    master: 'master_data_kaeru',
+    inquiry: 'inquiry_customer_kaeru',
+    hasCancel: false,
+    // ⚠️ InformationEditKaeru.tsx の actionMap（⚠️ コメントアウトされている工程は出さない）
+    ...fixedLabels([
+      ['step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', '接触（通話・返信）'],
+      ['step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', '初回面談'],
+      ['step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', '2回目以降面談'],
+      ['step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', '申し込み'],
+      ['step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', '自社契約'],
+      ['step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', '仲介契約'],
+    ]),
+  },
+  used: {
+    master: 'master_data_resale',
+    inquiry: 'inquiry_customer_resale',
+    hasCancel: false,
+    columns: [...new Set(Object.values(RESALE_STEPS).flat().map(([, column]) => column))],
+    // ⚠️ 区分が空・未知の行は「買い:中古リノベ」の名前で出す（⚠️ 一番多い区分）
+    labelOf: (column, deal) => {
+      const steps = RESALE_STEPS[deal] ?? RESALE_STEPS['買い:中古リノベ'];
+      const hit = steps.find(([, c]) => c === column)
+        ?? Object.values(RESALE_STEPS).flat().find(([, c]) => c === column);
+      return hit ? hit[0] : column;
+    },
+    stepOrder: [...new Set(Object.values(RESALE_STEPS).flat().map(([label]) => label))],
+  },
+};
 
 /**
  * 未同期の反響（まだ顧客になっていない）。
@@ -130,7 +231,7 @@ const TODAY_STEPS: { column: string; label: string }[] = [
  *     ⚠️ ⚠️ **同日中に「該当日を含まないを優先してよい」と訂正があった。**
  *   ⚠️ ⚠️ **そのぶんバッジより少なく出る。これは不具合ではない。**
  */
-const UNSYNC_SQL = `
+const unsyncSql = (inquiry: string): string => `
   SELECT 'unsync' AS kind,
          DATEDIFF(CURDATE(), ${INQUIRY_DATE}) AS days,
          ${shopLabel('i.shop', 'i.brand')} AS shop,
@@ -146,7 +247,7 @@ const UNSYNC_SQL = `
            ⚠️⚠️ **ここはテンプレートリテラルの中なのでバッククォートを書かないこと**（文字列が終わる）。
          */
          COALESCE(NULLIF(TRIM(i.hp_campaign), ''), '') AS campaign
-    FROM inquiry_customer i
+    FROM ${inquiry} i
     LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(i.shop)
    WHERE COALESCE(i.sync, 0) = 0
      AND COALESCE(i.duplicate_flag, 0) <> 1
@@ -204,14 +305,16 @@ const CANCEL_SQL = `
 /**
  * 本日の予定。
  *
- * ⚠️ 4つの工程のどれかが**本日**の顧客。
+ * ⚠️ 事業の工程（DailySource.columns）のどれかが**本日**の顧客。
  * ⚠️ 1人が同じ日に複数の工程を持つことがあるので `UNION ALL` で**工程ごとに1行**出す
  *   （⚠️ **まとめると「何の予定か」が分からなくなる**）。
+ * ⚠️ v2.2.175: 列名（col）と取引区分（deal）を返し、⚠️ **表示名はサーバーの JS で付ける**（labelOf）。
  */
-const TODAY_SQL = `
-  ${TODAY_STEPS.map(
-    (step) => `
-  SELECT ? AS step,
+const todaySql = (source: DailySource): string => `
+  ${source.columns.map(
+    (column) => `
+  SELECT ? AS col,
+         COALESCE(m.in_charge_store, '') AS deal,
          ${shopLabel('m.in_charge_store', 'm.brand')} AS shop,
          COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y-%m-%d'), '') AS register,
          COALESCE(m.customer_contacts_name, '') AS customer,
@@ -226,16 +329,124 @@ const TODAY_SQL = `
          */
          COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
          COALESCE(m.sales_promotion_name, '') AS medium
-    FROM master_data m
+    FROM ${source.master} m
     LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(m.in_charge_store)
    WHERE m.show_dashboard = 1
      AND COALESCE(m.status, '') <> '重複'
-     AND ${asDate(`m.${step.column}`)} = CURDATE()`
+     AND ${asDate(`m.${column}`)} = CURDATE()`
   ).join('\n   UNION ALL\n')}
    ORDER BY shop, customer
    LIMIT ?
 `;
 
+/**
+ * 本日要連絡（v2.2.175）。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️ 次のどちらかが ⚠️ **今日**のお客様:
+ *   ・商談ステップ（interview_sheet.interview_log）の「次回アクション日」
+ *   ・架電（call_sheet.call_log）の「次回架電日」
+ * ⚠️⚠️ **記録（ログ）から数える**（⚠️ master の next_action_date 列ではない）。
+ *   ⚠️ 予定が複数あっても今日のものを取りこぼさないため（2026-10-08 合意）。
+ *
+ * ⚠️ 流れ:
+ *   1. ログに今日の day を含む行だけを SQL で拾う（⚠️ REGEXP。daily_report と同じ書き方の揺れに対応）
+ *   2. JS でログを読み、⚠️ 今日の「次回アクション日」「次回架電日」がある id を集める
+ *   3. ⚠️ その事業の master から id で引く（⚠️ id は3テーブルで重複しない）
+ * ⚠️ 1人1行。⚠️ 両方あれば contact に「次回アクション・次回架電」。
+ * ⚠️ 他の表と同じく show_dashboard = 1・重複でない顧客だけ。
+ * ⚠️ ① の daily_action.php にも同じものがある（⚠️ 片方だけ直さないこと）。
+ * ─────────────────────────────────────────────
+ */
+const NEXT_ACTION = '次回アクション日';
+const NEXT_CALL = '次回架電日';
+
+interface LogSheetRow extends RowDataPacket {
+  id: string;
+  log: string | null;
+}
+
+/** ログ（JSON）の day に今日の日付を含むかの正規表現（⚠️ "2026-10-08" / "2026/10/08" / "2026\/10\/08"） */
+const todayLogRegexp = (today: string): string => {
+  const [y, m, d] = today.split('-');
+  return `"day"[[:space:]]*:[[:space:]]*"${y}(-|\\\\?/)${m}(-|\\\\?/)${d}`;
+};
+
+/** ログを読み、今日の指定アクションがある id を返す（⚠️ 日付は / と - を揃えて比べる） */
+const idsWithToday = (rows: LogSheetRow[], action: string, today: string): Set<string> => {
+  const ids = new Set<string>();
+  for (const row of rows) {
+    let logs: unknown;
+    try {
+      logs = JSON.parse(String(row.log ?? ''));
+    } catch {
+      continue;
+    }
+    if (logs === null || typeof logs !== 'object') continue;
+    const list: unknown[] = Array.isArray(logs) ? logs : Object.values(logs);
+    const hit = list.some((log) => {
+      if (log === null || typeof log !== 'object') return false;
+      const entry = log as Record<string, unknown>;
+      const name = String(entry.action ?? '').split(',')[0];
+      const day = String(entry.day ?? '').trim().replace(/\//g, '-').slice(0, 10);
+      return name === action && day === today;
+    });
+    if (hit) ids.add(String(row.id));
+  }
+  return ids;
+};
+
+const contactSql = (master: string, count: number): string => `
+  SELECT m.id AS id,
+         ${shopLabel('m.in_charge_store', 'm.brand')} AS shop,
+         COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y-%m-%d'), '') AS register,
+         COALESCE(m.customer_contacts_name, '') AS customer,
+         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
+         COALESCE(m.sales_promotion_name, '') AS medium
+    FROM ${master} m
+    LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(m.in_charge_store)
+   WHERE m.show_dashboard = 1
+     AND COALESCE(m.status, '') <> '重複'
+     AND m.id IN (${Array.from({ length: count }, () => '?').join(',')})
+   ORDER BY shop, customer
+   LIMIT ?
+`;
+
+interface TodayDateRow extends RowDataPacket {
+  today: string;
+}
+
+export interface ContactRow extends RowDataPacket {
+  id?: string;
+  shop: string;
+  register: string;
+  customer: string;
+  staff: string;
+  medium: string;
+  /** ⚠️ 何の連絡か（次回アクション ／ 次回架電 ／ 次回アクション・次回架電） */
+  contact: string;
+}
+
+const fetchContacts = async (master: string): Promise<ContactRow[]> => {
+  // ⚠️ 今日は DB の CURDATE()（⚠️ 他の表と同じ基準。⚠️ Node の時計を使わない）
+  const [{ today }] = await query<TodayDateRow>("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
+  const pattern = todayLogRegexp(today);
+  const [interviewRows, callRows] = await Promise.all([
+    query<LogSheetRow>('SELECT id, interview_log AS log FROM interview_sheet WHERE interview_log REGEXP ?', [pattern]),
+    query<LogSheetRow>('SELECT id, call_log AS log FROM call_sheet WHERE call_log REGEXP ?', [pattern]),
+  ]);
+  const actionIds = idsWithToday(interviewRows, NEXT_ACTION, today);
+  const callIds = idsWithToday(callRows, NEXT_CALL, today);
+  const ids = [...new Set([...actionIds, ...callIds])];
+  if (ids.length === 0) return [];
+
+  const rows = await query<ContactRow>(contactSql(master, ids.length), [...ids, ROW_LIMIT]);
+  return rows.map(({ id, ...row }) => {
+    const kinds = [actionIds.has(String(id)) ? '次回アクション' : '', callIds.has(String(id)) ? '次回架電' : ''].filter((v) => v !== '');
+    return { ...row, contact: kinds.join('・') } as ContactRow;
+  });
+};
+
 /**
  * 未同期を数え始める月。
  * ⚠️ menu.ts の `SYNC_START_MONTH` と同じ。⚠️ **片方だけ変えると件数がずれる。**
@@ -264,7 +475,10 @@ export interface AttentionRow extends RowDataPacket {
 }
 
 export interface TodayRow extends RowDataPacket {
-  step: string;
+  /** ⚠️ 工程の列名（⚠️ 表示名は labelOf で付ける） */
+  col: string;
+  /** ⚠️ 取引区分（in_charge_store）。⚠️ 中古の表示名を決めるのに使う */
+  deal: string;
   shop: string;
   register: string;
   customer: string;
@@ -297,7 +511,16 @@ export interface DailySection {
    *   ⚠️ 未同期は `inquiry_customer` 由来で、⚠️ **まだ担当が決まっていない。**
    */
   hasStaff: boolean;
-  rows: (AttentionRow | TodayRow)[];
+  /**
+   * ⚠️ 連絡の種類の列（次回アクション ／ 次回架電）を出すかどうか。
+   *   ⚠️⚠️ **本日要連絡だけ true**（v2.2.175）。
+   */
+  hasContact: boolean;
+  /**
+   * ⚠️ 目立たせる表か（v2.2.175）。⚠️ **本日要連絡だけ true**。⚠️ カードの色を変える
+   */
+  highlight: boolean;
+  rows: (AttentionRow | TodayRow | ContactRow)[];
 }
 
 export interface DailyActionResponse {
@@ -340,31 +563,55 @@ interface CountRow extends RowDataPacket {
   c: number;
 }
 
-export const runDailyAction = async (staffId: number | null): Promise<DailyActionResponse> => {
+export const runDailyAction = async (
+  staffId: number | null,
+  categoryValue: unknown = 'order'
+): Promise<DailyActionResponse> => {
+  const category = toDailyCategory(categoryValue);
+  const source = DAILY_SOURCES[category];
+
   // ⚠️ クエリは互いに独立しているので並列で投げる
-  const [unsync, cancel, today, checked] = await Promise.all([
-    query<AttentionRow>(UNSYNC_SQL, [SYNC_START_MONTH, ROW_LIMIT]),
-    query<AttentionRow>(CANCEL_SQL, [ROW_LIMIT]),
-    query<TodayRow>(TODAY_SQL, [...TODAY_STEPS.map((s) => s.label), ROW_LIMIT]),
+  const [contact, unsync, cancel, todayRaw, checked] = await Promise.all([
+    fetchContacts(source.master),
+    query<AttentionRow>(unsyncSql(source.inquiry), [SYNC_START_MONTH, ROW_LIMIT]),
+    // ⚠️ 来場日未入力は注文だけ（v2.2.175 合意）。⚠️ reserved_interview は注文の運用
+    source.hasCancel ? query<AttentionRow>(CANCEL_SQL, [ROW_LIMIT]) : Promise.resolve([] as AttentionRow[]),
+    query<TodayRow>(todaySql(source), [...source.columns, ROW_LIMIT]),
     staffId === null
       ? Promise.resolve([] as CountRow[])
       : query<CountRow>(CHECKED_SQL, [staffId]),
   ]);
 
+  // ⚠️ 本日の予定の表示名（⚠️ 中古は取引区分で変わる）
+  const today = todayRaw.map((row) => ({ ...row, step: source.labelOf(row.col, row.deal) }));
+  const order = (label: string) => {
+    const index = source.stepOrder.indexOf(label);
+    return index === -1 ? source.stepOrder.length : index;
+  };
+  const steps = [...new Set(today.map((row) => row.step))].sort((a, b) => order(a) - order(b));
+
   /**
-   * ⚠️ 本日の予定は工程ごとの表に割る。
-   *   ⚠️ `TODAY_SQL` は工程名を `step` に入れて返しているので、それで振り分ける。
-   *   ⚠️ ⚠️ **並びは `TODAY_STEPS` のとおり**（商談が進む順）。入れ替えないこと。
+   * ⚠️⚠️ **並びは 本日要連絡 → 未同期 → 来場日未入力（注文だけ） → 本日の予定（工程順）**（v2.2.175 合意）。
+   * ⚠️ 本日の予定は ⚠️ **行がある工程だけ**表を作る（⚠️ 中古は工程が多いため）。
+   *   ⚠️ 0件の表は画面側でも落としている。
+   * ⚠️ col / deal / step は画面に要らないので外して返す。
    */
   const sections: DailySection[] = [
-    { label: '未同期', hasDays: true, hasCampaign: true, hasStaff: false, rows: unsync },
-    { label: '来場日未入力', hasDays: true, hasCampaign: false, hasStaff: true, rows: cancel },
-    ...TODAY_STEPS.map((step) => ({
-      label: `本日の${step.label}`,
+    { label: '本日要連絡', hasDays: false, hasCampaign: false, hasStaff: true, hasContact: true, highlight: true, rows: contact },
+    { label: '未同期', hasDays: true, hasCampaign: true, hasStaff: false, hasContact: false, highlight: false, rows: unsync },
+    ...(source.hasCancel
+      ? [{ label: '来場日未入力', hasDays: true, hasCampaign: false, hasStaff: true, hasContact: false, highlight: false, rows: cancel }]
+      : []),
+    ...steps.map((step) => ({
+      label: `本日の${step}`,
       hasDays: false,
       hasCampaign: false,
       hasStaff: true,
-      rows: today.filter((row) => row.step === step.label),
+      hasContact: false,
+      highlight: false,
+      rows: today
+        .filter((row) => row.step === step)
+        .map(({ col: _col, deal: _deal, step: _step, ...row }) => row as TodayRow),
     })),
   ];
 
@@ -373,7 +620,7 @@ export const runDailyAction = async (staffId: number | null): Promise<DailyActio
   return {
     sections,
     total,
-    truncated: unsync.length >= ROW_LIMIT || cancel.length >= ROW_LIMIT,
+    truncated: unsync.length >= ROW_LIMIT || cancel.length >= ROW_LIMIT || contact.length >= ROW_LIMIT,
     show: Number(checked[0]?.c ?? 0) === 0,
   };
 };
@@ -398,7 +645,7 @@ export const dailyAction = defineFeature({
       summary: '要確認の顧客（未同期・来場日未入力）と本日の予定',
       auth: true,
       query: z.object({}).optional(),
-      handler: async ({ ctx }) => runDailyAction(ctx.staff?.id ?? null),
+      handler: async ({ ctx }) => runDailyAction(ctx.staff?.id ?? null, 'order'),
     }),
   },
 });
diff --git a/backend-express/src/features/information/masterDataColumns.ts b/backend-express/src/features/information/masterDataColumns.ts
index 07d5ed9a..899e96c9 100644
--- a/backend-express/src/features/information/masterDataColumns.ts
+++ b/backend-express/src/features/information/masterDataColumns.ts
@@ -12,7 +12,7 @@
  * ⚠️ 元の PHP には contract_building_application_date が2回書かれている
  *   （PDO では最後が勝つだけで無害）。ここでは一意にしてある。
  *
- * 生成元: backend/src/core/allowed_columns.php（188件 → 一意 187件）
+ * 生成元: backend/src/core/allowed_columns.php（188件 → 一意 187件。⚠️ v2.2.175 で next_action_date を両方に手で足した）
  *
  * ⚠️⚠️ **2026-09-17 に勝因・敗因の5列を追加した。**
  *   `competitor_campaign` / `competitor_countermeasure` / `competitor_price_gap`
@@ -79,6 +79,8 @@ export const MASTER_DATA_COLUMNS: readonly string[] = [
   'last_action_step_migration_item_date', 'last_action_step_migration_item_name', 'lat_lng',
   'memo_developer_application_company', 'memo_fire_insurance', 'memo_ground_survey',
   'memo_lawyer', 'memo_marketing', 'memo_other_related_person', 'memo_site_survey', 'monthly_repayment_amount',
+  // ⚠️ v2.2.175 追加（次回アクション日。⚠️ 3テーブルとも 2026-10-08_master_next_action_date.sql で追加）
+  'next_action_date',
   'no', 'planned_construction_site', 'planned_construction_site_2',
   'planned_construction_site_3', 'postal_code', 'property_contract_name', 'property_name',
   'property_tour_name', 'rank_period', 'rank_steps', 'reaction_date', 'remarks',
diff --git a/backend-express/src/features/interviewKpi.ts b/backend-express/src/features/interviewKpi.ts
index 517ed2ac..765596fa 100644
--- a/backend-express/src/features/interviewKpi.ts
+++ b/backend-express/src/features/interviewKpi.ts
@@ -66,6 +66,8 @@ const ORDER_MAP: Record<string, string> = {
   資料送付: 'step_migration_item_catalog',
   '0次接客': 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
   初回面談: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
+  // ⚠️ v2.2.175 追加。⚠️ この列だけ「一番新しい日付」（LATEST_COLUMNS）
+  次回アクション日: 'next_action_date',
   '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
   事前審査: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
   LINEグループ作成: 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
@@ -76,6 +78,8 @@ const ORDER_MAP: Record<string, string> = {
 const SPEC_MAP: Record<string, string> = {
   '接触（通話・返信）': 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z',
   初回面談: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
+  // ⚠️ v2.2.175 追加
+  次回アクション日: 'next_action_date',
   '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
   申し込み: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
   自社契約: 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
@@ -102,6 +106,8 @@ const RESALE_MAP: Record<string, Record<string, string>> = {
   '買い:中古リノベ': {
     初回来場: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
     物件案内: 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
+    // ⚠️ v2.2.175 追加
+    次回アクション日: 'next_action_date',
     '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
     '2回目以降物件案内': 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
     事前審査: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
@@ -111,12 +117,16 @@ const RESALE_MAP: Record<string, Record<string, string>> = {
   '買い:ポータル': {
     初回来場: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
     物件案内: 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
+    // ⚠️ v2.2.175 追加
+    次回アクション日: 'next_action_date',
     '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
     '2回目以降物件案内': 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
     事前審査: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
     売買契約: 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
   },
   '売り:ポータル': {
+    // ⚠️ v2.2.175 追加。⚠️ 2回目以降面談が無いので先頭（2026-10-08 合意）
+    次回アクション日: 'next_action_date',
     査定アポ: 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
     査定書提出: 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
     訪問査定: 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
@@ -176,6 +186,12 @@ export const normalizeDay = (value: unknown): string => {
  */
 export const baseAction = (value: unknown): string => asString(value).split(',')[0] ?? '';
 
+/**
+ * ⚠️⚠️ **「最も新しい日付」を採る列**（v2.2.175）。⚠️ それ以外は最も古い日付。
+ * ⚠️ フロントの utils/interviewKpi.ts の LATEST_COLUMNS と同じにすること。
+ */
+export const LATEST_COLUMNS = new Set<string>(['next_action_date']);
+
 /**
  * interview_log から KPI 列の値を導出する。
  *
@@ -187,6 +203,9 @@ export const baseAction = (value: unknown): string => asString(value).split(',')
  *   列単位でも最古を採る。
  *
  * ⚠️ 日付が空の行は無視する。空を入れると既存の日付を消してしまう。
+ *
+ * ⚠️⚠️ **例外: LATEST_COLUMNS の列は「最も新しい日付」を採る**（v2.2.175）。
+ *   ⚠️ 次回アクション日は「到達日」ではなく ⚠️ **次の予定**なので、古い予定で止まると意味が無い。
  */
 export const deriveKpiColumns = (
   logs: InterviewLogEntry[],
@@ -204,7 +223,8 @@ export const deriveKpiColumns = (
     if (day === '') continue;
 
     const current = derived.get(column);
-    if (current === undefined || day < current) derived.set(column, day);
+    const latest = LATEST_COLUMNS.has(column);
+    if (current === undefined || (latest ? day > current : day < current)) derived.set(column, day);
   }
 
   return derived;
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 3a7fcff6..e0c9bb80 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -252,15 +252,19 @@ register({
  *   ⚠️ 出るのは注文（order）だけだが、⚠️ **`category` 無しも残す**
  *     （⚠️ 比較ツールなど `category` を送らない呼び出しのため）。
  */
-['', 'order'].forEach((category) => {
+/*
+ * ⚠️ v2.2.175: 建売（spec）・中古（used）でも出すようになったので登録を足した。
+ *   ⚠️ 事業は body.category で決まる（⚠️ category 無しは注文）。
+ */
+['', 'order', 'spec', 'used'].forEach((category) => {
   register({
     request: 'daily_action',
     roll: 'list',
     category,
-    summary: '要確認の顧客（未同期・来場日未入力）と本日の予定',
+    summary: '要確認の顧客（本日要連絡・未同期・来場日未入力）と本日の予定',
     phpSource: 'backend/src/handlers/daily_action.php',
     auth: 'staff',
-    handler: async (ctx) => runDailyAction(ctx.staff?.id ?? null),
+    handler: async (ctx) => runDailyAction(ctx.staff?.id ?? null, category || 'order'),
   });
 });
 
diff --git a/backend/src/core/allowed_columns.php b/backend/src/core/allowed_columns.php
index 94c32d85..d0f82b6c 100644
--- a/backend/src/core/allowed_columns.php
+++ b/backend/src/core/allowed_columns.php
@@ -155,6 +155,8 @@ return [
 'memo_other_related_person',
 'memo_site_survey',
 'monthly_repayment_amount',
+// v2.2.175 追加（次回アクション日。3テーブルとも 2026-10-08_master_next_action_date.sql で追加）
+'next_action_date',
 'no',
 'planned_construction_site',
 'planned_construction_site_2',
diff --git a/backend/src/handlers/daily_action.php b/backend/src/handlers/daily_action.php
index 1f32c7a4..d74435e5 100644
--- a/backend/src/handlers/daily_action.php
+++ b/backend/src/handlers/daily_action.php
@@ -106,14 +106,81 @@ function dailyActionShop(string $shopColumn, string $brandColumn): string
  */
 $visible_shops = "(SELECT shop FROM shop_list WHERE show_flag = 1 AND TRIM(COALESCE(shop, '')) <> '' GROUP BY shop)";
 
-/** 本日の予定に出す4つの工程。⚠️ 表示名は Express 側と揃えること */
-$today_steps = [
-    ['column' => 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', 'label' => '初回面談'],
-    ['column' => 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', 'label' => '事前審査'],
-    ['column' => 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', 'label' => '2回目以降面談'],
-    ['column' => 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', 'label' => '契約'],
+/**
+ * 事業ごとのテーブルと「本日の予定」に出す工程（v2.2.175 で建売・中古にも広げた）。
+ *
+ * ⚠️⚠️ **Express の dailyAction.ts の DAILY_SOURCES と同じにすること。**
+ * ⚠️ 工程は各事業の actionMap（⚠️ 次回アクション日は除く。本日要連絡で出すため）。
+ * ⚠️ 中古は同じ列に区分ごとに別の名前がある → 行の in_charge_store（取引区分）で名前を決める。
+ * ⚠️ 来場日未入力は注文だけ。
+ */
+$daily_category = in_array($data['category'] ?? '', ['spec', 'used'], true) ? $data['category'] : 'order';
+
+$resale_steps = [
+    '買い:中古リノベ' => [
+        ['初回来場', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
+        ['物件案内', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG'],
+        ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
+        ['2回目以降物件案内', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
+        ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
+        ['リフォーム契約', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'],
+        ['売買契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
+    ],
+    '買い:ポータル' => [
+        ['初回来場', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
+        ['物件案内', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG'],
+        ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
+        ['2回目以降物件案内', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
+        ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
+        ['売買契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
+    ],
+    '売り:ポータル' => [
+        ['査定アポ', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
+        ['査定書提出', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22'],
+        ['訪問査定', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN'],
+        ['媒介取得', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0'],
+    ],
 ];
 
+$fixed_steps = [
+    'order' => [
+        ['初回面談', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
+        ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
+        ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
+        ['契約', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'],
+    ],
+    'spec' => [
+        ['接触（通話・返信）', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z'],
+        ['初回面談', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
+        ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
+        ['申し込み', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'],
+        ['自社契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
+        ['仲介契約', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0'],
+    ],
+];
+
+$daily_master  = ['order' => 'master_data', 'spec' => 'master_data_kaeru', 'used' => 'master_data_resale'][$daily_category];
+$daily_inquiry = ['order' => 'inquiry_customer', 'spec' => 'inquiry_customer_kaeru', 'used' => 'inquiry_customer_resale'][$daily_category];
+$daily_has_cancel = $daily_category === 'order';
+
+// 工程の列（重複なし）・表の並び
+$all_steps = $daily_category === 'used' ? array_merge(...array_values($resale_steps)) : $fixed_steps[$daily_category];
+$today_columns = array_values(array_unique(array_map(fn ($step) => $step[1], $all_steps)));
+$step_order    = array_values(array_unique(array_map(fn ($step) => $step[0], $all_steps)));
+
+/** 列と取引区分 → 表示名（⚠️ Express の labelOf と同じ） */
+$step_label_of = function (string $column, string $deal) use ($daily_category, $resale_steps, $fixed_steps, $all_steps): string {
+    $steps = $daily_category === 'used'
+        ? ($resale_steps[$deal] ?? $resale_steps['買い:中古リノベ'])
+        : $fixed_steps[$daily_category];
+    foreach ([$steps, $all_steps] as $list) {
+        foreach ($list as $step) {
+            if ($step[1] === $column) return $step[0];
+        }
+    }
+    return $column;
+};
+
 /**
  * 未同期を数え始める月。
  * ⚠️ menu.php の $sync_start_month と同じ。⚠️ **片方だけ変えると件数がずれる。**
@@ -143,7 +210,7 @@ $sql_unsync = "SELECT 'unsync' AS kind,
          /* ⚠️ キャンペーン名（2026-09-28）。⚠️ **未同期の表にだけ出す。**
             ⚠️ 実測では9割以上が空。⚠️ **空文字で返し、画面が `-` と出す。** */
          COALESCE(NULLIF(TRIM(i.hp_campaign), ''), '') AS campaign
-    FROM inquiry_customer i
+    FROM $daily_inquiry i
     LEFT JOIN $visible_shops s ON s.shop = TRIM(i.shop)
    WHERE COALESCE(i.sync, 0) = 0
      AND COALESCE(i.duplicate_flag, 0) <> 1
@@ -184,18 +251,23 @@ $sql_cancel = "SELECT 'cancel' AS kind,
      AND DATEDIFF(CURDATE(), $reserved_date) > 0
    ORDER BY days DESC
    LIMIT $row_limit";
-$stmt_cancel = $pdo->prepare($sql_cancel);
-$stmt_cancel->execute();
-$response_cancel = $stmt_cancel->fetchAll(PDO::FETCH_ASSOC);
+// ⚠️ 来場日未入力は注文だけ（v2.2.175 合意）
+$response_cancel = [];
+if ($daily_has_cancel) {
+    $stmt_cancel = $pdo->prepare($sql_cancel);
+    $stmt_cancel->execute();
+    $response_cancel = $stmt_cancel->fetchAll(PDO::FETCH_ASSOC);
+}
 
 // 本日の予定。
 // ⚠️ 1人が同じ日に複数の工程を持つことがあるので、工程ごとに1行出す。
 //   ⚠️ まとめると「何の予定か」が分からなくなる。
 $today_parts = [];
 $today_params = [];
-foreach ($today_steps as $index => $step) {
-    $step_date = dailyActionDate('m.' . $step['column']);
-    $today_parts[] = "SELECT :label$index AS step,
+foreach ($today_columns as $index => $column) {
+    $step_date = dailyActionDate('m.' . $column);
+    $today_parts[] = "SELECT :col$index AS col,
+         COALESCE(m.in_charge_store, '') AS deal,
          " . dailyActionShop('m.in_charge_store', 'm.brand') . " AS shop,
          COALESCE(DATE_FORMAT($register_date, '%Y-%m-%d'), '') AS register,
          COALESCE(m.customer_contacts_name, '') AS customer,
@@ -206,17 +278,85 @@ foreach ($today_steps as $index => $step) {
               ⚠️ 旧担当（first_interviewed_user）には**寄せていない**。 */
          COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
          COALESCE(m.sales_promotion_name, '') AS medium
-    FROM master_data m
+    FROM $daily_master m
     LEFT JOIN $visible_shops s ON s.shop = TRIM(m.in_charge_store)
    WHERE m.show_dashboard = 1
      AND COALESCE(m.status, '') <> '重複'
      AND $step_date = CURDATE()";
-    $today_params[":label$index"] = $step['label'];
+    $today_params[":col$index"] = $column;
 }
 $sql_today = implode("\n   UNION ALL\n", $today_parts) . "\n   ORDER BY shop, customer\n   LIMIT $row_limit";
 $stmt_today = $pdo->prepare($sql_today);
 $stmt_today->execute($today_params);
 $response_today = $stmt_today->fetchAll(PDO::FETCH_ASSOC);
+foreach ($response_today as &$today_row) {
+    $today_row['step'] = $step_label_of((string)$today_row['col'], (string)$today_row['deal']);
+}
+unset($today_row);
+
+/**
+ * 本日要連絡（v2.2.175）。⚠️ Express の fetchContacts と同じ。
+ *   商談ステップの「次回アクション日」か、架電の「次回架電日」が ⚠️ 今日のお客様。
+ *   ⚠️ 記録（ログ）から数える。⚠️ 1人1行。⚠️ 両方あれば「次回アクション・次回架電」。
+ * ⚠️ 正規表現は daily_report.php と同じ書き方（⚠️ day の書き方の揺れに対応）。
+ *   ⚠️ `\\\\` は正規表現の `\\`（= バックスラッシュ1文字）。
+ */
+$stmt_today_date = $pdo->query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
+$today_date = (string)$stmt_today_date->fetchColumn();
+[$today_y, $today_m, $today_d] = explode('-', $today_date);
+$today_regexp = '"day"[[:space:]]*:[[:space:]]*"' . $today_y . '(-|\\\\?/)' . $today_m . '(-|\\\\?/)' . $today_d;
+
+$ids_with_today = function (string $table, string $column, string $action) use ($pdo, $today_regexp, $today_date): array {
+    $stmt = $pdo->prepare("SELECT id, {$column} AS log FROM {$table} WHERE {$column} REGEXP ?");
+    $stmt->execute([$today_regexp]);
+    $ids = [];
+    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
+        $logs = json_decode($row['log'] ?? '', true);
+        if (!is_array($logs)) continue;
+        foreach ($logs as $log) {
+            if (!is_array($log)) continue;
+            $name = explode(',', (string)($log['action'] ?? ''))[0];
+            $day = substr(str_replace('/', '-', trim((string)($log['day'] ?? ''))), 0, 10);
+            if ($name === $action && $day === $today_date) {
+                $ids[(string)$row['id']] = true;
+                break;
+            }
+        }
+    }
+    return $ids;
+};
+$action_ids  = $ids_with_today('interview_sheet', 'interview_log', '次回アクション日');
+$call_ids    = $ids_with_today('call_sheet', 'call_log', '次回架電日');
+$contact_ids = array_map('strval', array_keys($action_ids + $call_ids));
+
+$response_contact = [];
+if (count($contact_ids) > 0) {
+    $contact_holders = implode(',', array_fill(0, count($contact_ids), '?'));
+    $sql_contact = "SELECT m.id AS id,
+         " . dailyActionShop('m.in_charge_store', 'm.brand') . " AS shop,
+         COALESCE(DATE_FORMAT($register_date, '%Y-%m-%d'), '') AS register,
+         COALESCE(m.customer_contacts_name, '') AS customer,
+         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
+         COALESCE(m.sales_promotion_name, '') AS medium
+    FROM $daily_master m
+    LEFT JOIN $visible_shops s ON s.shop = TRIM(m.in_charge_store)
+   WHERE m.show_dashboard = 1
+     AND COALESCE(m.status, '') <> '重複'
+     AND m.id IN ($contact_holders)
+   ORDER BY shop, customer
+   LIMIT $row_limit";
+    $stmt_contact = $pdo->prepare($sql_contact);
+    $stmt_contact->execute($contact_ids);
+    foreach ($stmt_contact->fetchAll(PDO::FETCH_ASSOC) as $row) {
+        $contact_id = (string)$row['id'];
+        unset($row['id']);
+        $kinds = [];
+        if (isset($action_ids[$contact_id])) $kinds[] = '次回アクション';
+        if (isset($call_ids[$contact_id])) $kinds[] = '次回架電';
+        $row['contact'] = implode('・', $kinds);
+        $response_contact[] = $row;
+    }
+}
 
 // ⚠️ days は PDO が文字列で返すため、Express と同じ数値に揃える
 $to_int_days = function (array $rows): array {
@@ -235,23 +375,40 @@ $response_cancel = $to_int_days($response_cancel);
  *   ⚠️ ⚠️ **混ぜると何をすればよいかが読み取れない**というのが変更の理由。
  * ⚠️ 並びは Express の runDailyAction() と**同じ順**にすること。
  */
+// ⚠️ 並びは 本日要連絡 → 未同期 → 来場日未入力（注文だけ） → 本日の予定（工程順。行がある工程だけ）
 $sections = [
     // ⚠️ hasCampaign は**未同期だけ true**（2026-09-28 の指示）。
     //   ⚠️ 来場日未入力・本日の予定は master_data 由来で、この列を返していない。
     // ⚠️ hasStaff は**未同期以外 true**（2026-09-28）。⚠️ 未同期はまだ担当が決まっていない
-    ["label" => "未同期", "hasDays" => true, "hasCampaign" => true, "hasStaff" => false, "rows" => $response_unsync],
-    ["label" => "来場日未入力", "hasDays" => true, "hasCampaign" => false, "hasStaff" => true, "rows" => $response_cancel],
+    // ⚠️ hasContact / highlight は**本日要連絡だけ true**（v2.2.175）
+    ["label" => "本日要連絡", "hasDays" => false, "hasCampaign" => false, "hasStaff" => true, "hasContact" => true, "highlight" => true, "rows" => $response_contact],
+    ["label" => "未同期", "hasDays" => true, "hasCampaign" => true, "hasStaff" => false, "hasContact" => false, "highlight" => false, "rows" => $response_unsync],
 ];
-foreach ($today_steps as $step) {
+if ($daily_has_cancel) {
+    $sections[] = ["label" => "来場日未入力", "hasDays" => true, "hasCampaign" => false, "hasStaff" => true, "hasContact" => false, "highlight" => false, "rows" => $response_cancel];
+}
+$present_steps = array_values(array_unique(array_map(fn ($row) => $row['step'], $response_today)));
+usort($present_steps, function ($a, $b) use ($step_order) {
+    $ia = array_search($a, $step_order, true);
+    $ib = array_search($b, $step_order, true);
+    return ($ia === false ? count($step_order) : $ia) <=> ($ib === false ? count($step_order) : $ib);
+});
+foreach ($present_steps as $step_name) {
+    $step_rows = [];
+    foreach ($response_today as $row) {
+        if ($row['step'] !== $step_name) continue;
+        // ⚠️ col / deal / step は画面に要らないので外す（⚠️ Express と同じ形）
+        unset($row['col'], $row['deal'], $row['step']);
+        $step_rows[] = $row;
+    }
     $sections[] = [
-        "label" => "本日の" . $step['label'],
+        "label" => "本日の" . $step_name,
         "hasDays" => false,
         "hasCampaign" => false,
         "hasStaff" => true,
-        // ⚠️ array_values で添字を詰める。詰めないと json_encode がオブジェクトにする
-        "rows" => array_values(array_filter($response_today, function ($row) use ($step) {
-            return $row['step'] === $step['label'];
-        })),
+        "hasContact" => false,
+        "highlight" => false,
+        "rows" => $step_rows,
     ];
 }
 
@@ -274,7 +431,7 @@ if ($daily_action_user && !empty($daily_action_user['check_daily_action'])) {
 $result = [
     "sections" => $sections,
     "total" => $total,
-    "truncated" => count($response_unsync) >= $row_limit || count($response_cancel) >= $row_limit,
+    "truncated" => count($response_unsync) >= $row_limit || count($response_cancel) >= $row_limit || count($response_contact) >= $row_limit,
     "show" => $show,
 ];
 
diff --git a/frontend/src/components/DailyAction.tsx b/frontend/src/components/DailyAction.tsx
index 87894697..b05c1df7 100644
--- a/frontend/src/components/DailyAction.tsx
+++ b/frontend/src/components/DailyAction.tsx
@@ -20,7 +20,8 @@ import ClaudeIcon, { CLAUDE_ORANGE } from './header/ClaudeIcon';
  *
  * ⚠️ 出す条件
  *   ⚠️ `!isSp` … スマートフォンでは出さない（表が5列あり読めない）
- *   ⚠️ `category === 'order'` … 注文営業のみ
+ *   ⚠️ `category` が order / spec / used … ⚠️ v2.2.175 で建売・中古にも広げた（以前は注文営業のみ）
+ *     ⚠️ 表は 本日要連絡 → 未同期 → 来場日未入力（注文だけ） → 本日の予定（事業の工程）
  *   ⚠️⚠️ **`staff.check_daily_action` が本日でないこと**（サーバーが `show` で返す）
  *   ⚠️⚠️ **件数が0件のときは出さない**（見せるものが無い）
  *
@@ -51,6 +52,8 @@ type Row = {
     campaign?: string;
     /** ⚠️ 担当営業。⚠️ **未同期以外が持つ**（未同期はまだ担当が決まっていない） */
     staff?: string;
+    /** ⚠️ 連絡の種類（次回アクション ／ 次回架電）。⚠️ **本日要連絡だけが持つ**（v2.2.175） */
+    contact?: string;
 };
 
 type Section = {
@@ -60,6 +63,10 @@ type Section = {
     hasCampaign: boolean;
     /** ⚠️⚠️ **未同期以外 true**（2026-09-28）。⚠️ 未同期はまだ担当が決まっていない */
     hasStaff: boolean;
+    /** ⚠️ 連絡の種類の列（v2.2.175）。⚠️ **本日要連絡だけ true** */
+    hasContact?: boolean;
+    /** ⚠️ 目立たせる表（v2.2.175）。⚠️ **本日要連絡だけ true**（⚠️ カードの色を変える） */
+    highlight?: boolean;
     rows: Row[];
 };
 
@@ -77,7 +84,8 @@ type ListResponse = {
  *     ⚠️ 同期や入力を済ませた直後は、⚠️ **最大5分は古い件数が出る。**
  */
 const CACHE_MS = 5 * 60 * 1000;
-let cached: { at: number; promise: Promise<ListResponse> } | null = null;
+/** ⚠️ v2.2.175: 事業（category）ごとに中身が違うので ⚠️ **category も持つ**（⚠️ 違えば取り直す） */
+let cached: { at: number; category: string; promise: Promise<ListResponse> } | null = null;
 
 /**
  * ⚠️⚠️ **「確認しました」を押したらこのタブでは二度と出さない。**
@@ -140,6 +148,26 @@ const orDash = (value?: string): string => (value ?? '').trim() === '' ? '-' : (
  */
 const UNSYNC_LABEL = '未同期';
 
+/** ⚠️ 要確認を出す事業（v2.2.175）。⚠️ サーバー（features/dailyAction.ts の DailyCategory）と同じ */
+const DAILY_CATEGORIES: string[] = ['order', 'spec', 'used'];
+
+/**
+ * 表の見出しの id（v2.2.175）。⚠️ 上のカードを押すとここへ移る。
+ * ⚠️ 見出しの名前は日本語なので ⚠️ **並び順の番号**で作る（⚠️ 同じ表を2つ出すことは無い）。
+ */
+const sectionId = (index: number): string => `da-section-${index}`;
+
+/**
+ * カードを押したとき（v2.2.175）。⚠️ **モーダルの中の表まで移る**（⚠️ 画面は移らない）。
+ * ⚠️ Modal.Body だけがスクロールするので、⚠️ scrollIntoView でその中を動かす。
+ * ⚠️ href の `#…` は ⚠️ **URL を変えない**よう preventDefault する
+ *   （⚠️ URL が変わると「画面が変わった」と見なされ、要確認を開き直してしまう）。
+ */
+const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, index: number): void => {
+    event.preventDefault();
+    document.getElementById(sectionId(index))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
+};
+
 /**
  * 店舗名からブランドの色を引く（2026-09-30 追加）。
  *
@@ -221,8 +249,12 @@ const DailyAction = () => {
         setShowReports(true);
     };
 
-    /** ⚠️ そもそも出す対象か。⚠️ **通信の前に判定する**（無駄な通信を避ける） */
-    const isTarget = !isSp && category === 'order';
+    /**
+     * ⚠️ そもそも出す対象か。⚠️ **通信の前に判定する**（無駄な通信を避ける）
+     * ⚠️ v2.2.175: 注文だけ → ⚠️ **注文・建売・中古**（指示書「全category表示」）。
+     *   ⚠️ planner などは対象外（⚠️ サーバーの DAILY_SOURCES に無い）。
+     */
+    const isTarget = !isSp && DAILY_CATEGORIES.includes(category);
 
     /**
      * 件数を取ってくる。
@@ -232,9 +264,10 @@ const DailyAction = () => {
      */
     const load = (force: boolean): Promise<ListResponse> => {
         const now = Date.now();
-        if (force || cached === null || now - cached.at > CACHE_MS) {
+        if (force || cached === null || cached.category !== category || now - cached.at > CACHE_MS) {
             cached = {
                 at: now,
+                category,
                 promise: apiClient
                     .post('', { request: 'daily_action', roll: 'list', category })
                     .then((response) => (response.data ?? {}) as ListResponse),
@@ -456,6 +489,28 @@ const DailyAction = () => {
                 .da_kpi_card.is_alert .da_kpi_value { color: #b91c1c; }
                 .da_kpi_card.is_alert { background: #fef2f2; border-color: #fecaca; }
                 /* ⚠️ 最新の他社分析（v2.2.165）。⚠️ 押せるカード。⚠️ 新しいものがあるときだけ Claude の色にする */
+                /*
+                 * ⚠️ v2.2.175: カードは押せる（アンカー）。⚠️ 下線・青文字を消し、押せることは枠の色と矢印で示す。
+                 */
+                .da_kpi_link { display: block; text-decoration: none; color: inherit; cursor: pointer; }
+                .da_kpi_link:hover { border-color: #93c5fd; text-decoration: none; color: inherit; }
+                .da_kpi_link:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
+                .da_kpi_link .da_kpi_label i { font-size: 8px; margin-left: 2px; }
+                /*
+                 * ⚠️ 本日要連絡（v2.2.175）。⚠️ **他のカードより目立たせる**（指示書）。
+                 *   ⚠️ 塗りつぶし＋白文字。⚠️ 色は放置の赤・ボタンの青と別の深緑（⚠️ 意味が混ざらないように）。
+                 */
+                .da_kpi_card.is_highlight { background: #0f766e; border-color: #0f766e;
+                                            box-shadow: 0 0 0 3px #ccfbf1; }
+                .da_kpi_card.is_highlight .da_kpi_label,
+                .da_kpi_card.is_highlight .da_kpi_value,
+                .da_kpi_card.is_highlight .da_kpi_value small { color: #fff; }
+                .da_kpi_card.is_highlight .da_kpi_label { font-weight: 700; }
+                .da_kpi_card.is_highlight:hover { border-color: #115e59; background: #115e59; }
+                .da_section_title.is_highlight { color: #0f766e; }
+                .da_contact { display: inline-block; border-radius: 999px; padding: 2px 8px;
+                              font-size: 11px; font-weight: 700; background: #ccfbf1; color: #115e59;
+                              white-space: nowrap; }
                 .da_report_card { text-align: left; cursor: pointer; background: #fff; }
                 .da_report_card:hover { border-color: ${CLAUDE_ORANGE}; }
                 .da_report_card:focus-visible { outline: 2px solid ${CLAUDE_ORANGE}; outline-offset: 2px; }
@@ -531,7 +586,7 @@ const DailyAction = () => {
                 {/* ⚠️ 但し書きが増えたので折り返す。⚠️ **狭い画面ではみ出さないように** */}
                 <div className='d-flex align-items-baseline flex-wrap' style={{ gap: '10px' }}>
                     <span className='da_title'>要確認</span>
-                    <span className='da_note'>対応が必要な顧客と、本日の予定です</span>
+                    <span className='da_note'>対応が必要な顧客と、本日の予定です（カードを押すと表へ移ります）</span>
                     {/* ⚠️⚠️ **本日ぶんを数えていないことを明示する**（2026-09-30 の指示） */}
                     <span className='da_note_strong'>本日の反響については未同期数に含みません</span>
                 </div>
@@ -544,16 +599,23 @@ const DailyAction = () => {
                 <div className='da_summary'>
                     <div className='da_kpi'>
                         {/* ⚠️ 0件のときはカードが1枚も出ない。⚠️ **ボタンだけが残る** */}
-                        {visible.map((section) => (
-                            <div
+                        {/*
+                          ⚠️ v2.2.175: カードは ⚠️ **押せる（アンカー）**。⚠️ 押すとモーダルの中の表へ移る（jumpTo）。
+                          ⚠️ 本日要連絡は ⚠️ **一番左・塗りつぶしで目立たせる**（highlight）。⚠️ 並びはサーバーが決めている。
+                        */}
+                        {visible.map((section, index) => (
+                            <a
                                 key={section.label}
-                                className={`da_kpi_card${section.hasDays ? ' is_alert' : ''}`}
+                                href={`#${sectionId(index)}`}
+                                onClick={(event) => jumpTo(event, index)}
+                                className={`da_kpi_card da_kpi_link${section.hasDays ? ' is_alert' : ''}${section.highlight ? ' is_highlight' : ''}`}
+                                title={`${section.label}の表へ移動`}
                             >
-                                <div className='da_kpi_label'>{section.label}</div>
+                                <div className='da_kpi_label'>{section.label} <i className='fa-solid fa-chevron-down' aria-hidden='true' /></div>
                                 <div className='da_kpi_value'>
                                     {section.rows.length.toLocaleString()}<small>件</small>
                                 </div>
-                            </div>
+                            </a>
                         ))}
                         {/*
                           ⚠️ 最新の他社分析（v2.2.165）。⚠️ **0件でも出す**（2026-10-06 の確認。⚠️ 他社分析への入口を兼ねる）。
@@ -593,10 +655,11 @@ const DailyAction = () => {
                     <div className='da_none'>対応が必要な顧客はありません。本日の予定もありません。</div>
                 )}
 
-                {visible.map((section) => (
-                    <div key={section.label} className='da_section'>
+                {visible.map((section, index) => (
+                    /* ⚠️ id は上のカードの移動先（v2.2.175）。⚠️ scroll-margin で少し余白を残して止める */
+                    <div key={section.label} id={sectionId(index)} className='da_section' style={{ scrollMarginTop: '8px' }}>
                         <div className='da_section_head'>
-                            <span className='da_section_title'>{section.label}</span>
+                            <span className={`da_section_title${section.highlight ? ' is_highlight' : ''}`}>{section.label}</span>
                             <span className='da_section_count'>{section.rows.length.toLocaleString()}件</span>
                         </div>
 
@@ -632,6 +695,8 @@ const DailyAction = () => {
                                         <th className='da_th'>顧客名</th>
                                         {/* ⚠️ 担当営業は**顧客名のすぐ右**（指示）。⚠️ 未同期には出さない */}
                                         {section.hasStaff && <th className='da_th' style={{ width: '120px' }}>担当営業</th>}
+                                        {/* ⚠️ 連絡の種類は**本日要連絡だけ**（v2.2.175） */}
+                                        {section.hasContact && <th className='da_th' style={{ width: '170px' }}>連絡</th>}
                                         <th className='da_th' style={{ width: '130px' }}>反響媒体</th>
                                         {/* ⚠️ キャンペーンは**未同期の表だけ**。⚠️ 右端に置く（指示） */}
                                         {section.hasCampaign && <th className='da_th' style={{ width: '170px' }}>キャンペーン</th>}
@@ -656,6 +721,9 @@ const DailyAction = () => {
                                                     {orUnset(row.staff ?? '')}
                                                 </td>
                                             )}
+                                            {section.hasContact && (
+                                                <td className='da_td'><span className='da_contact'>{orUnset(row.contact ?? '')}</span></td>
+                                            )}
                                             <td className='da_td da_muted'>{orUnset(row.medium)}</td>
                                             {section.hasCampaign && (
                                                 /* ⚠️ 長い名前が多いので省略表示。⚠️ **全文は hover で出す** */
diff --git a/frontend/src/components/information/InformationEdit.tsx b/frontend/src/components/information/InformationEdit.tsx
index 149e2030..cf5fa82e 100644
--- a/frontend/src/components/information/InformationEdit.tsx
+++ b/frontend/src/components/information/InformationEdit.tsx
@@ -105,6 +105,8 @@ const actionMap = {
     '資料送付': 'step_migration_item_catalog',
     '0次接客': 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
     '初回面談': 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
+    // ⚠️ v2.2.175 追加。⚠️ この列だけ「一番新しい日付」が入る（utils/interviewKpi.ts の LATEST_COLUMNS）
+    '次回アクション日': 'next_action_date',
     '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
     '事前審査': 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
     'LINEグループ作成': 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
diff --git a/frontend/src/components/information/InformationEditKaeru.tsx b/frontend/src/components/information/InformationEditKaeru.tsx
index d5b847e8..e4642d25 100644
--- a/frontend/src/components/information/InformationEditKaeru.tsx
+++ b/frontend/src/components/information/InformationEditKaeru.tsx
@@ -98,6 +98,8 @@ const actionMap = {
     '接触（通話・返信）': 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z',
     '初回面談': 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
     // '物件案内': 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
+    // ⚠️ v2.2.175 追加。⚠️ この列だけ「一番新しい日付」が入る（utils/interviewKpi.ts の LATEST_COLUMNS）
+    '次回アクション日': 'next_action_date',
     '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
     // '次回アクション': 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
     // '事前取得（現金確認含む）': 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
diff --git a/frontend/src/components/information/InformationEditResale.tsx b/frontend/src/components/information/InformationEditResale.tsx
index 52593ffa..c3f7df3d 100644
--- a/frontend/src/components/information/InformationEditResale.tsx
+++ b/frontend/src/components/information/InformationEditResale.tsx
@@ -86,6 +86,8 @@ const actionMap = {
     '買い:中古リノベ': {
         '初回来場': 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
         '物件案内': 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
+        // ⚠️ v2.2.175 追加。⚠️ この列だけ「一番新しい日付」が入る（utils/interviewKpi.ts の LATEST_COLUMNS）
+        '次回アクション日': 'next_action_date',
         '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
         '2回目以降物件案内': 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
         '事前審査': 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
@@ -95,12 +97,16 @@ const actionMap = {
     '買い:ポータル': {
         '初回来場': 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
         '物件案内': 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
+        // ⚠️ v2.2.175 追加。⚠️ この列だけ「一番新しい日付」が入る（utils/interviewKpi.ts の LATEST_COLUMNS）
+        '次回アクション日': 'next_action_date',
         '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
         '2回目以降物件案内': 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
         '事前審査': 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
         '売買契約': 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
     },
     '売り:ポータル': {
+        // ⚠️ v2.2.175 追加。⚠️ 2回目以降面談が無いので先頭（2026-10-08 合意）
+        '次回アクション日': 'next_action_date',
         '査定アポ': 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
         '査定書提出': 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
         '訪問査定': 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
diff --git a/frontend/src/components/information/TableInterview.tsx b/frontend/src/components/information/TableInterview.tsx
index 29838b6e..a5cc0e5b 100644
--- a/frontend/src/components/information/TableInterview.tsx
+++ b/frontend/src/components/information/TableInterview.tsx
@@ -354,7 +354,8 @@ const TableInterview = ({ information, setInformation, interviewLog, setIntervie
                                                     interview_log: prev.interview_log.map((log, i) => i === index ?
                                                         { ...log, day: e.target.value } : log)
                                                 }));
-                                                // ⚠️ setInformation はしない。derivedKpi が最古を選んで反映する。
+                                                // ⚠️ setInformation はしない。derivedKpi が最古を選んで反映する
+                                                //   （⚠️ 次回アクション日だけは最新。v2.2.175 / utils/interviewKpi.ts の LATEST_COLUMNS）。
                                                 //   ここで直接書くと、同じアクションが2件あるとき
                                                 //   触った側の日付で上書きされてしまう
                                             }} />
diff --git a/frontend/src/utils/interviewKpi.ts b/frontend/src/utils/interviewKpi.ts
index 09f9eaeb..a121b629 100644
--- a/frontend/src/utils/interviewKpi.ts
+++ b/frontend/src/utils/interviewKpi.ts
@@ -54,6 +54,13 @@ export const normalizeDay = (value: unknown): string => {
  */
 export const baseAction = (value: unknown): string => String(value ?? '').split(',')[0] ?? '';
 
+/**
+ * ⚠️⚠️ **「最も新しい日付」を採る列**（v2.2.175）。⚠️ それ以外は最も古い日付。
+ *   ⚠️ 次回アクション日は「到達日」ではなく ⚠️ **次の予定**なので、古い予定で止まると意味が無い。
+ * ⚠️ backend-express/src/features/interviewKpi.ts の LATEST_COLUMNS と同じにすること。
+ */
+export const LATEST_COLUMNS = new Set<string>(['next_action_date']);
+
 /**
  * interview_log から KPI 列の値を導出する。
  *
@@ -65,6 +72,7 @@ export const baseAction = (value: unknown): string => String(value ?? '').split(
  *   列単位でも最古を採る。
  *
  * ⚠️ 日付が空の行は無視する。空を入れると既存の日付を消してしまう。
+ * ⚠️⚠️ **例外: LATEST_COLUMNS の列（次回アクション日）は最も新しい日付**（v2.2.175）。
  */
 export const deriveKpiColumns = (
     logs: InterviewLogEntry[],
@@ -82,7 +90,8 @@ export const deriveKpiColumns = (
         if (day === '') continue;
 
         const current = derived.get(column);
-        if (current === undefined || day < current) derived.set(column, day);
+        const latest = LATEST_COLUMNS.has(column);
+        if (current === undefined || (latest ? day > current : day < current)) derived.set(column, day);
     }
 
     return derived;
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index a5d2598d..75213df8 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.174';
+export const newVersion = '2.2.175';
```

### 新規 SQL
```sql
-- =====================================================================
-- v2.2.175: 顧客マスタ3表に「次回アクション日」（next_action_date）を追加する
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ ⚠️ **② と ① PHP を出す前に流すこと**（保存の許可リストに入るため、列が無いと保存が落ちる）
-- ⚠️ 値は 'YYYY-MM-DD'（他の KPI 列と同じ TEXT）。⚠️ 商談ステップの「次回アクション日」から入る。
--   ⚠️ ⚠️ **他の KPI 列と違い「一番新しい日付」を入れる**（次の予定なので）。
-- =====================================================================

ALTER TABLE master_data        ADD COLUMN next_action_date TEXT DEFAULT NULL COMMENT '次回アクション日（商談ステップの最新の予定日）';
ALTER TABLE master_data_kaeru  ADD COLUMN next_action_date TEXT DEFAULT NULL COMMENT '次回アクション日（商談ステップの最新の予定日）';
ALTER TABLE master_data_resale ADD COLUMN next_action_date TEXT DEFAULT NULL COMMENT '次回アクション日（商談ステップの最新の予定日）';
```
