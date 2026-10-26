# 作業記録 2026-10-26-02　v2.2.218 紹介キャンペーンサマリーの担当別・Claudeによる分析を1日1回・権限の表示を自動で更新

## 指示
1. 今の analysis（Claudeによる分析）を1人1日2回まで → **途中で「消費額が大きかったので1日1回」に変更**
2. 紹介キャンペーンサマリーの店舗別の下に「担当別」を置く
   - 担当の定義: master_data(_kaeru) の sales_promotion_name が「紹介」で、in_charge_user と interview_sheet の interview_log に該当の名前があるもの
   - スタッフ名はこれまでどおり staff_list から
   - 歩留まりが0のスタッフは非表示 → **2.（反響が0の担当だけを隠す）で確定**
3. （途中で追加）staff の brand（画面では authority）を、再ログインしなくてもログイン中の人に反映する

## 追加・変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/introductory | summary.ts | 担当別（`byStaff`）。関数 `norm`・`staffInLog` を追加。`staff_list`（最新年度・report=1）と、紹介の顧客（注文・建売）の商談シートを読む。顧客ごとに担当の集合（`Customer.staff`）を作り、担当ごとに `funnelOf` で集計。反響0の担当は除く |
| backend-express/src/features/aiAnalysis | index.ts | `DAILY_LIMIT` 5 → 1 |
| 同 | runner.ts | コメントの回数 |
| backend-express/src/gateway | registry.ts | コメントの回数 |
| frontend/src/components/header | IntroductorySummary.tsx | `Summary.byStaff`。`FunnelTable` に `note` を追加。店舗別の下に担当別の表と注記 |
| 同 | ClaudeAnalysis.tsx | 上限の既定値 1・コメント |
| frontend/src/context | AuthProvider.tsx | `get_token` の `brand` が保存中の authority と違えば `setAuthority` |
| frontend/src/utils | version.ts | 2.2.218 |
| backend/scripts/sql | **2026-10-26_update_log_2.2.218.sql**（新規。ガイド記事2本を含む） | |
| backend/scripts/guide/articles/common | screen-120.md（紹介キャンペーンサマリー）・screen-150.md（Claudeによる分析） | 下を参照 |

## 担当別の数え方
- 対象: `master_data`（注文）・`master_data_kaeru`（建売）で `sales_promotion_name` が「紹介」（前後の空白・改行を落として比べる。ほかの表と同じ）。ステータス「重複」は除く。期間・店舗・エリアの絞り込みはほかの表と同じ
- 担当: 顧客の `in_charge_user`、または `interview_sheet.interview_log` の各記録の `staff`。名前は空白（全角含む）を除いて突き合わせる
- 表に出す名前: `staff_list` の report = 1、年度は「今年以下で最新」。表記は staff_list のまま
- 1人の顧客が複数の担当に入る（画面に注記）。⚠️ 中古は担当別に入れない（指示が master_data(_kaeru) のため）
- ⚠️ 顧客の id は ULID の文字列（数値ではない）。注文・建売・中古の台帳で重ならないことをローカルで確かめた

## 権限の表示
- 以前: 画面の authority はログイン時の値のまま。権限編集で変えても再ログインまで画面が変わらなかった（① ② の判定は毎回 DB なので、権限そのものは即時）
- 今回: 画面を移るたびに呼ばれる `get_token` の `brand` を取り込む。次に画面を移った時点で反映される

## 業務ガイドの記事
- **紹介キャンペーンサマリー**: 「担当別（いちばん下の表）」の節を追加（対象・数え方・合計が合わない理由・出ない担当・名前の表記の注意）
- **Claudeによる分析**: 回数の上限を「1人1日1回」に

## テスト
- ① 経由・トークン無しで `introductory_summary` → 401
- 担当別: 103名・反響0の行なし。中脇 優介さんを SQL（JSON_TABLE で商談ログを展開）で数え直し、反響32・契約9 で一致
- Playwright（マスター）: 店舗別の下に「担当別」・注記・103行・見出しで並べ替え・反響10件未満は灰色・ブラウザのエラーなし
- 権限の表示: 保存中の authority を「一般」にして開く（DB は Manager）→ Manager に変わり「Claudeによる分析」のボタンが出る。ログインしたまま権限編集で一般に変える → 画面を移ると一般に戻りボタンが消える
- 1日1回: 模擬サーバーで1回目は完了、2回目は 429「本日の実行上限（1回）に達しました」。一覧の上限表示 1/1
- ② の型チェック・フロントのビルドが通る（変えたファイルに警告なし）
- テストのスタッフと分析の行は消した。② は通常の設定に戻した

---
# 差分
```diff
diff --git a/backend-express/src/features/aiAnalysis/index.ts b/backend-express/src/features/aiAnalysis/index.ts
index 32ce46d6..6ebf11ba 100644
--- a/backend-express/src/features/aiAnalysis/index.ts
+++ b/backend-express/src/features/aiAnalysis/index.ts
@@ -17,8 +17,8 @@ import { runAnalysisJob } from './runner';
 
 export const AI_ANALYSIS_AUTHORITY = ['Master', 'BrandAdmin', 'Manager'];
 
-/** 1人1日の実行上限（2026-10-26 の決定）。⚠️ 失敗も数える */
-export const DAILY_LIMIT = 5;
+/** 1人1日の実行上限（v2.2.218 で 5 → 1。費用が大きかったため。2026-10-26 の指示）。⚠️ 失敗も数える */
+export const DAILY_LIMIT = 1;
 /** 同時に動かす分析の上限（全体）。② の負荷と費用の暴走を防ぐ */
 const MAX_ACTIVE_ALL = 3;
 /** 期間の最大の長さ（月） */
diff --git a/backend-express/src/features/aiAnalysis/runner.ts b/backend-express/src/features/aiAnalysis/runner.ts
index 0af280e2..0cc8712b 100644
--- a/backend-express/src/features/aiAnalysis/runner.ts
+++ b/backend-express/src/features/aiAnalysis/runner.ts
@@ -14,7 +14,7 @@ import { executeTool, progressLabel, reportInput, SUBMIT_TOOL, TOOLS } from './t
  * 画面からの要求とは切り離して ② のプロセス内で動き、進み具合は ai_analysis_job に書く。
  *
  * ⚠️ 1回で数分〜十数分かかる。ゲートウェイの要求（120秒で切れる）の中で待たないこと。
- * ⚠️ 実行のたびに課金される。上限は registry 側（1人1日5回・同時実行数）でも掛けている。
+ * ⚠️ 実行のたびに課金される。上限は registry 側（1人1日1回・同時実行数）でも掛けている。
  */
 
 export const MODEL = 'claude-opus-5-5';
diff --git a/backend-express/src/features/introductory/summary.ts b/backend-express/src/features/introductory/summary.ts
index 7337a7f9..87bd943b 100644
--- a/backend-express/src/features/introductory/summary.ts
+++ b/backend-express/src/features/introductory/summary.ts
@@ -44,6 +44,11 @@ export const UNSET_LABEL = '（未入力）';
 export const UNKNOWN_AREA = '（不明）';
 
 interface ReferralRow extends RowDataPacket {
+  /** 顧客の id（ULID の文字列）。⚠️ 商談シート（interview_sheet.id）と同じ値 */
+  id: string;
+  /** どの台帳から来たか（担当別を注文・建売に絞るため） */
+  tbl: string;
+  in_charge_user: string | null;
   division: string;
   status: string | null;
   source: string | null;
@@ -56,6 +61,15 @@ interface ReferralRow extends RowDataPacket {
   col_contract: string | null;
 }
 
+interface SheetRow extends RowDataPacket {
+  id: string;
+  interview_log: unknown;
+}
+
+interface StaffRow extends RowDataPacket {
+  name: string;
+}
+
 interface ShopRow extends RowDataPacket {
   shop: string;
   area: string | null;
@@ -129,8 +143,36 @@ const inRange = (month: string, filter: SummaryFilter): boolean => {
   return true;
 };
 
+/**
+ * 名前の突き合わせ用。⚠️ 空白（全角を含む）を落とす（staffContract.ts の norm と同じ）。
+ *   ⚠️ 台帳・商談ログ・staff_list で「姓 名」と「姓名」が混ざっている。
+ */
+const norm = (value: unknown): string => String(value ?? '').replace(/[\s　]/g, '');
+
+/**
+ * 商談ログの担当者名を取り出す。
+ * ⚠️ mysql2 はパース済みのオブジェクトで返すことがある（staffContract.ts の toLog と同じ扱い）。
+ */
+const staffInLog = (value: unknown): string[] => {
+  let entries: unknown = value;
+  if (typeof value === 'string') {
+    try {
+      entries = JSON.parse(value);
+    } catch {
+      return [];
+    }
+  }
+  const list = Array.isArray(entries) ? entries : entries !== null && typeof entries === 'object' ? [entries] : [];
+  return list.map((e) => norm((e as { staff?: unknown }).staff)).filter((name) => name !== '');
+};
+
 /** 1人分（集計用に整えたもの） */
 interface Customer {
+  /**
+   * この顧客を数える担当（空白を除いた名前）。⚠️ 注文・建売だけ（中古は空）。
+   *   in_charge_user と、商談ログに名前がある人。⚠️ 1人の顧客が複数の担当に入る。
+   */
+  staff: Set<string>;
   division: string;
   source: string;
   brand: string;
@@ -188,11 +230,35 @@ const crossFunnel = (list: Customer[], rowOf: (c: Customer) => string): { rows:
  *   ⚠️ 絞り込んだ結果から作ると、選んだ瞬間に他の選択肢が消えて戻れなくなる。
  */
 export const runIntroductorySummary = async (filter: SummaryFilter): Promise<SummaryResult> => {
-  const [shops, ...perTable] = await Promise.all([
+  const [shops, staffList, sheets, ...perTable] = await Promise.all([
     query<ShopRow>('SELECT shop, area, parent_shop, report_flag, division FROM shop_list ORDER BY id'),
+    /**
+     * 担当別に出す人（v2.2.218）。⚠️ 営業別契約率と同じく staff_list の report = 1。
+     *   ⚠️ 年度は「今年以下で最新」（kpi/master.ts と同じ選び方）。⚠️ 並びは sort 順
+     */
+    query<StaffRow>(
+      `SELECT name FROM staff_list
+        WHERE report = 1 AND name <> ''
+          AND period = (SELECT MAX(period) FROM staff_list
+                         WHERE period <> '' AND period <= CAST(YEAR(CURDATE()) AS CHAR))
+        GROUP BY name
+        ORDER BY MIN(sort), MIN(id)`
+    ),
+    /**
+     * 商談ログ（v2.2.218）。⚠️ 紹介の顧客（注文・建売）の分だけ引く。
+     *   ⚠️ 商談シートは注文・建売・中古で同じ表で、id が顧客の id。
+     */
+    query<SheetRow>(
+      `SELECT id, interview_log FROM interview_sheet
+        WHERE id IN (SELECT id FROM master_data
+                      WHERE TRIM(REPLACE(REPLACE(sales_promotion_name, '\\r', ''), '\\n', '')) = '紹介'
+                     UNION
+                     SELECT id FROM master_data_kaeru
+                      WHERE TRIM(REPLACE(REPLACE(sales_promotion_name, '\\r', ''), '\\n', '')) = '紹介')`
+    ),
     ...TABLES.map(({ table, division }) =>
       query<ReferralRow>(
-        `SELECT ? AS division, status,
+        `SELECT id, ? AS tbl, in_charge_user, ? AS division, status,
                 introduction_person_category AS source,
                 brand, in_charge_store AS store,
                 ${COL_INQUIRY} AS col_inquiry,
@@ -202,11 +268,18 @@ export const runIntroductorySummary = async (filter: SummaryFilter): Promise<Sum
                 ${COL_CONTRACT} AS col_contract
            FROM ${table}
           WHERE TRIM(REPLACE(REPLACE(sales_promotion_name, '\\r', ''), '\\n', '')) = '紹介'`,
-        [division]
+        [table, division]
       )
     ),
   ]);
 
+  /**
+   * 顧客 id → 商談ログの担当者。
+   * ⚠️ id は ULID の文字列で、注文・建売・中古の台帳をまたいで重ならない（実測 2026-10-26）。
+   */
+  const logStaffById = new Map<string, string[]>();
+  for (const sheet of sheets) logStaffById.set(String(sheet.id), staffInLog(sheet.interview_log));
+
   /** 店舗 → 親店舗。⚠️ 併売店は親店舗として数える */
   const parentOf = new Map<string, string>();
   /** 店舗 → エリア。⚠️ 併売店は親店舗のエリアを使う（⚠️ 実測では親と同じ県） */
@@ -232,7 +305,16 @@ export const runIntroductorySummary = async (filter: SummaryFilter): Promise<Sum
     const contract = row.status === '契約済み';
     const inquiryDate = toDate(row.col_inquiry);
     const contractDate = toDate(row.col_contract);
+    // ⚠️ 担当別は注文・建売だけ（v2.2.218 の指示: master_data(_kaeru)）
+    const staff = new Set<string>();
+    if (row.tbl === 'master_data' || row.tbl === 'master_data_kaeru') {
+      const owner = norm(row.in_charge_user);
+      if (owner !== '') staff.add(owner);
+      for (const name of logStaffById.get(String(row.id)) ?? []) staff.add(name);
+    }
+
     customers.push({
+      staff,
       division: row.division,
       source: hasValue(row.source) ? String(row.source).trim() : UNSET_LABEL,
       brand: hasValue(row.brand) ? String(row.brand).trim() : UNSET_LABEL,
@@ -257,6 +339,16 @@ export const runIntroductorySummary = async (filter: SummaryFilter): Promise<Sum
     .map((s) => ({ name: s.shop, area: areaOf.get(s.shop) ?? '', division: s.division ?? '' }));
   const areaOptions = [...new Set(shopOptions.map((s) => s.area).filter((a) => a !== ''))];
 
+  /**
+   * 担当別（v2.2.218）。⚠️ 名前は staff_list の表記で出し、突き合わせは空白を除いて行う。
+   *   ⚠️ 反響が0の担当は出さない（2026-10-26 の指示）。⚠️ 反響の多い順。
+   *   ⚠️ 1人の顧客が複数の担当に入るため、足しても全体と合わない（画面に注記する）。
+   */
+  const byStaff = staffList
+    .map((s) => funnelOf(s.name, customers.filter((c) => c.staff.has(norm(s.name)))))
+    .filter((row) => row.inquiry > 0)
+    .sort((a, b) => b.inquiry - a.inquiry);
+
   return {
     httpStatus: 200,
     body: {
@@ -268,6 +360,7 @@ export const runIntroductorySummary = async (filter: SummaryFilter): Promise<Sum
       byBrand: groupFunnel(customers, (c) => c.brand),
       byArea: groupFunnel(customers, (c) => c.area),
       byShop: groupFunnel(customers, (c) => c.shop),
+      byStaff,
       brandSource: crossFunnel(customers, (c) => c.brand),
       areaSource: crossFunnel(customers, (c) => c.area),
       shops: shopOptions,
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index fcf79359..fed435cf 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -1166,7 +1166,7 @@ register({
 //
 // ⚠️ ai_analysis_start は受け付けて番号を返すだけ。分析は ② の中で数分〜十数分かけて続き、
 //   画面は ai_analysis_list を数秒ごとに呼んで進み具合を見る（実行中の分析があるあいだだけ）。
-// ⚠️ 実行のたびに課金される。1人1日5回・同時3件まで（features/aiAnalysis/index.ts）。
+// ⚠️ 実行のたびに課金される。1人1日1回・同時3件まで（features/aiAnalysis/index.ts）。
 // ⚠️ express_proxy.php の expressProxyRequests() と expressProxyExclusive() の両方に入れてある。
 // ---------------------------------------------------------------------------
 
diff --git a/backend/scripts/guide/articles/common/screen-120.md b/backend/scripts/guide/articles/common/screen-120.md
index 468a594a..c2f730f4 100644
--- a/backend/scripts/guide/articles/common/screen-120.md
+++ b/backend/scripts/guide/articles/common/screen-120.md
@@ -8,7 +8,16 @@ summary: 紹介で来たお客様の歩留まり。
 
 [[画面:紹介キャンペーンサマリー]]
 
-- 紹介者の種類・事業・ブランド・エリア・店舗ごとに見られます
+- 紹介者の種類・事業・ブランド・エリア・店舗・担当ごとに見られます
 - 期間・店舗・エリアで絞れます
 
+## 担当別（いちばん下の表）
+店舗別の下に、担当ごとの歩留まりが出ます。
+- 対象は注文・建売の紹介のお客様です（中古は入りません）
+- お客様の**担当営業**と、**商談シートに記録した人**の両方で数えます。担当が変わったお客様や、ほかの人が面談したお客様も、その人の行に入ります
+- そのため1人のお客様が複数の担当に入ることがあり、**足しても全体の数とは合いません**
+- 紹介のお客様がいない担当は出ていません
+
+> 注意：担当の名前は、人事マスタ（スタッフ編集）の最新の年度に載っている人です。名前の表記が違うと数えられないことがあります。
+
 > 紹介の反響は、紹介された人がお客様として登録されます（紹介した人ではありません）。
diff --git a/backend/scripts/guide/articles/common/screen-150.md b/backend/scripts/guide/articles/common/screen-150.md
index f436d273..1f8f0ec0 100644
--- a/backend/scripts/guide/articles/common/screen-150.md
+++ b/backend/scripts/guide/articles/common/screen-150.md
@@ -46,7 +46,7 @@ summary: 知りたいことを文章で頼むと、Claude がダッシュボー
 「過去の定型分析」を開くと、以前のメニュー（反響推移・店舗別・媒体別）で保存した結果を読めます。
 
 ## 回数の上限
-- 1人1日 **5回**まで（失敗も数えます。実行のたびに費用がかかるため）
+- 1人1日 **1回**まで（失敗も数えます。実行のたびに費用がかかるため）
 - 自分の分析が実行中のあいだは、次の分析を始められません
 - ほかの人の分析が混み合っているときは、少し待ってから実行してください
 
diff --git a/frontend/src/components/header/ClaudeAnalysis.tsx b/frontend/src/components/header/ClaudeAnalysis.tsx
index 5335efd4..dbff77ef 100644
--- a/frontend/src/components/header/ClaudeAnalysis.tsx
+++ b/frontend/src/components/header/ClaudeAnalysis.tsx
@@ -17,7 +17,7 @@ import type { AnalysisKind, AnySnapshot, StructuredAnalysis } from './ClaudeAnal
  * ⚠️ 使えるのは Master・BrandAdmin・Manager だけ（Header.tsx がボタンを出し分け、② も確かめる）。
  * ⚠️ 1回で数分〜十数分かかる。分析は ② の中で続くので、画面を閉じても止まらない。
  *   実行中の分析があるあいだ、一覧を数秒ごとに読み直して進み具合を出す。
- * ⚠️ 実行のたびに課金される。1人1日5回まで（② が数える）。
+ * ⚠️ 実行のたびに課金される。1人1日1回まで（② が数える。v2.2.218 で 5 → 1）。
  * ⚠️ レポートは Claude が書いた HTML。必ず iframe（sandbox="allow-scripts" だけ）の中で表示する。
  *   allow-same-origin を足すと、レポートの中からダッシュボードのログイン情報を読めてしまう。
  */
@@ -142,7 +142,7 @@ const ClaudeAnalysis: React.FC<Props> = ({ onClose }) => {
     // 一覧
     const [jobs, setJobs] = useState<Job[]>([]);
     const [usedToday, setUsedToday] = useState(0);
-    const [dailyLimit, setDailyLimit] = useState(5);
+    const [dailyLimit, setDailyLimit] = useState(1);
     /** 自分の staff.id（② が一覧と一緒に返す）。自分の分析かどうかの判定に使う */
     const [myStaffId, setMyStaffId] = useState(0);
     const [legacy, setLegacy] = useState<LegacyItem[]>([]);
diff --git a/frontend/src/components/header/IntroductorySummary.tsx b/frontend/src/components/header/IntroductorySummary.tsx
index 423a3320..e35f29f6 100644
--- a/frontend/src/components/header/IntroductorySummary.tsx
+++ b/frontend/src/components/header/IntroductorySummary.tsx
@@ -42,6 +42,8 @@ type Summary = {
     byBrand: FunnelRow[];
     byArea: FunnelRow[];
     byShop: FunnelRow[];
+    /** 担当別（v2.2.218）。⚠️ 注文・建売だけ。反響0の担当は ② が除いて返す */
+    byStaff: FunnelRow[];
     brandSource: Cross;
     areaSource: Cross;
 };
@@ -92,7 +94,7 @@ const valueOf = (row: FunnelRow, key: SortKey): number | string => {
  * 歩留まりの表（紹介元・事業部・ブランド・エリア・店舗で共用）。
  * ⚠️ 並べ替えは見出しクリック（GoogleReview.tsx と同じ作法）。⚠️ 表ごとに独立して並べ替える。
  */
-const FunnelTable = ({ title, rows, label }: { title: string; rows: FunnelRow[]; label: string }) => {
+const FunnelTable = ({ title, rows, label, note }: { title: string; rows: FunnelRow[]; label: string; note?: React.ReactNode }) => {
     /** ⚠️ 既定は反響の多い順。⚠️ **率を既定にすると分母1件で100%の行が先頭に来る** */
     const [sortKey, setSortKey] = useState<SortKey>('inquiry');
     const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
@@ -131,6 +133,8 @@ const FunnelTable = ({ title, rows, label }: { title: string; rows: FunnelRow[];
     return (
         <section className="ics_section">
             <div className="ics_section_title">{title}</div>
+            {/* ⚠️ v2.2.218: 表ごとの注記（担当別で使う） */}
+            {note !== undefined && <div className="ics_note mb-1">{note}</div>}
             <div className="ics_table_wrap">
                 <table className="ics_table">
                     <thead>
@@ -503,6 +507,17 @@ const IntroductorySummary = () => {
                         <CrossTable title="エリア × 紹介元（契約率・契約/反響）" label="エリア" cross={summary.areaSource} sources={sourceColumns} />
 
                         <FunnelTable title="店舗別" label="店舗" rows={summary.byShop} />
+
+                        {/* ⚠️ v2.2.218: 担当別。⚠️ 1人の顧客が複数の担当に入るので、足しても全体とは合わない */}
+                        <FunnelTable
+                            title="担当別"
+                            label="担当"
+                            rows={summary.byStaff ?? []}
+                            note={<>
+                                注文・建売の紹介の顧客を、<b>担当営業</b>と<b>商談シートに記録した人</b>の両方で数えています（中古は含みません）。
+                                1人のお客様が複数の担当に入ることがあるため、<b>足しても全体の数とは合いません。</b>紹介の反響が無い担当は出していません。
+                            </>}
+                        />
                     </>
                 )}
             </div>
diff --git a/frontend/src/context/AuthProvider.tsx b/frontend/src/context/AuthProvider.tsx
index 130bcaa9..3772095e 100644
--- a/frontend/src/context/AuthProvider.tsx
+++ b/frontend/src/context/AuthProvider.tsx
@@ -55,6 +55,17 @@ const AuthProvider = ({ children }: Props) => {
                     return;
                 }
 
+                /**
+                 * ⚠️ v2.2.218: 権限（staff.brand）を毎回の確認で取り込む。
+                 *   ⚠️ 以前はログインした時の値をずっと使っていたため、権限編集で変えても再ログインまで画面が変わらなかった。
+                 *   ⚠️ 画面を移るたびに get_token が呼ばれるので、次に画面を移った時点で反映される。
+                 *   ⚠️ 権限の判定そのものは ① ② が毎回 DB で行っている（ここは表示を合わせるだけ）。
+                 */
+                const latestAuthority = response.data[0].brand;
+                if (typeof latestAuthority === 'string' && latestAuthority !== localStorage.getItem('authority')) {
+                    setAuthority(latestAuthority);
+                }
+
                 const today = new Date();
                 const responseDate = response.data[0].timestamp ?? '';
                 const diff = today.getTime() - new Date(responseDate).getTime();
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 477afe74..d6b97500 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.217';
+export const newVersion = '2.2.218';
```

# 変更後の summary.ts（全文）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';

/**
 * 紹介キャンペーンサマリー（ヘッダー → 紹介キャンペーン → 紹介キャンペーンサマリー）。v2.2.192 新規。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面: frontend/src/components/header/IntroductorySummary.tsx
 *
 * ⚠️⚠️ **対象は3つの顧客台帳の「紹介」だけ**（注文 master_data／建売 master_data_kaeru／中古 master_data_resale）。
 *   ⚠️ `sales_promotion_name` の**前後の空白・改行を落として「紹介」と一致するもの**（2026-10-15 の指示）。
 *     ⚠️ 実測: 末尾に CR / CRLF が付いた「紹介」が4件ある（`紹介\r`・`紹介\r\n`）。完全一致だと落ちる。
 *   ⚠️ お友達紹介キャンペーンの受付表（inquiry_introductory）**ではない。**
 *
 * ⚠️ 歩留まりの定義は営業別契約率（staffContract.ts）と同じ列を使う。
 *   面談＝初回面談以降の日付あり／次アポ＝事前審査・第二面談・契約の日付あり／契約＝status 契約済み。
 *   ⚠️⚠️ **status＝重複は数えない。**
 *
 * ⚠️⚠️ **併売店（shop_list.parent_shop がある店舗）の担当は、親店舗として数える**（2026-10-15 の指示）。
 *   ⚠️ 店舗の選択肢に併売店は出さない（report_flag=1 かつ parent_shop IS NULL）。
 *     ⚠️ 親店舗にまとめないと、どの店舗を選んでも出てこない顧客ができる。
 *
 * ⚠️ 集計はここで行う（⚠️ 紹介は全事業で千件に届かないので、毎回全件読んで絞る）。
 * ─────────────────────────────────────────────
 */

/** 商談フェーズの列。⚠️ staffContract.ts と同じ列ID（⚠️ DBのコメントは当てにならない） */
const COL_INQUIRY = 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99';     // 反響取得日
const COL_INTERVIEW = 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7';   // 初回面談
const COL_SCREENING = 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR';   // 事前審査
const COL_APPOINTMENT = 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'; // 第二面談
const COL_CONTRACT = 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG';    // 契約

/** 顧客台帳。⚠️ SQL に直接埋め込むので、**この定数以外の値を入れないこと** */
const TABLES = [
  { table: 'master_data', division: '注文' },
  { table: 'master_data_kaeru', division: '建売' },
  { table: 'master_data_resale', division: '中古' },
] as const;

/** 紹介元・ブランド・店舗が空のときの表示。⚠️ 紹介元は実測で約4割が空（2026-10-15） */
export const UNSET_LABEL = '（未入力）';
/** エリアが分からないときの表示（⚠️ 店舗が shop_list に無い、または名前に県名が無い） */
export const UNKNOWN_AREA = '（不明）';

interface ReferralRow extends RowDataPacket {
  /** 顧客の id（ULID の文字列）。⚠️ 商談シート（interview_sheet.id）と同じ値 */
  id: string;
  /** どの台帳から来たか（担当別を注文・建売に絞るため） */
  tbl: string;
  in_charge_user: string | null;
  division: string;
  status: string | null;
  source: string | null;
  brand: string | null;
  store: string | null;
  col_inquiry: string | null;
  col_interview: string | null;
  col_screening: string | null;
  col_appointment: string | null;
  col_contract: string | null;
}

interface SheetRow extends RowDataPacket {
  id: string;
  interview_log: unknown;
}

interface StaffRow extends RowDataPacket {
  name: string;
}

interface ShopRow extends RowDataPacket {
  shop: string;
  area: string | null;
  parent_shop: string | null;
  report_flag: number;
  division: string | null;
}

export interface SummaryFilter {
  /** `YYYY-MM`。⚠️ 空なら絞らない */
  startMonth: string;
  endMonth: string;
  /** 店舗（親店舗）。⚠️ 空なら絞らない */
  shop: string;
  /** エリア（shop_list.area。⚠️ 空の店舗は店舗名の県名で補ったもの）。⚠️ 空なら絞らない */
  area: string;
}

/** 歩留まり1行。⚠️ 率は画面で出す（分母0の見せ方は画面の判断） */
export interface FunnelRow {
  key: string;
  inquiry: number;
  meeting: number;
  next: number;
  contract: number;
  /** 反響取得日 → 契約日の日数（中央値）。⚠️ 両方の日付が読める契約だけで出す */
  lagMedian: number | null;
}

export interface SummaryResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const hasValue = (value: unknown): boolean => String(value ?? '').trim() !== '';

/**
 * 日付から `YYYY-MM` を取り出す。読めなければ空文字。
 * ⚠️ staffContract.ts の toMonth と同じ（`2026-02-28` / `2026/06/01` の両方がある）。
 */
const toMonth = (value: unknown): string => {
  const matched = /^(\d{4})[-/](\d{1,2})(?:[-/]|$)/.exec(String(value ?? '').trim());
  if (matched === null) return '';
  return `${matched[1]}-${matched[2].padStart(2, '0')}`;
};

const toDate = (value: unknown): Date | null => {
  const matched = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(value ?? '').trim());
  return matched === null ? null : new Date(+matched[1], +matched[2] - 1, +matched[3]);
};

/**
 * shop_list.area が空の店舗のエリアを、店舗名に含まれる県名から補う。
 *
 * ⚠️⚠️ **建売・中古・不動産企画室の店舗は area が空**（実測 2026-10-15。例: 宮崎係・鹿児島1係・熊本係）。
 *   ⚠️ 補わないと、建売の紹介がすべて「（不明）」に入り、⚠️ **エリアで絞ると消える。**
 *   ⚠️ 県名が無い店舗（外販・中古住宅専門店など）は空のまま（＝「（不明）」）。
 */
const PREFECTURES = ['鹿児島', '宮崎', '熊本', '大分', '佐賀', '福岡', '長崎'];
const areaFromName = (shop: string): string => {
  const found = PREFECTURES.find((p) => shop.includes(p));
  return found === undefined ? '' : `${found}県`;
};

/** ⚠️ 期間が空なら日付が読めない顧客も通す（⚠️ 何も選んでいないのに件数が減らないように） */
const inRange = (month: string, filter: SummaryFilter): boolean => {
  if (filter.startMonth === '' && filter.endMonth === '') return true;
  if (month === '') return false;
  if (filter.startMonth !== '' && month < filter.startMonth) return false;
  if (filter.endMonth !== '' && month > filter.endMonth) return false;
  return true;
};

/**
 * 名前の突き合わせ用。⚠️ 空白（全角を含む）を落とす（staffContract.ts の norm と同じ）。
 *   ⚠️ 台帳・商談ログ・staff_list で「姓 名」と「姓名」が混ざっている。
 */
const norm = (value: unknown): string => String(value ?? '').replace(/[\s　]/g, '');

/**
 * 商談ログの担当者名を取り出す。
 * ⚠️ mysql2 はパース済みのオブジェクトで返すことがある（staffContract.ts の toLog と同じ扱い）。
 */
const staffInLog = (value: unknown): string[] => {
  let entries: unknown = value;
  if (typeof value === 'string') {
    try {
      entries = JSON.parse(value);
    } catch {
      return [];
    }
  }
  const list = Array.isArray(entries) ? entries : entries !== null && typeof entries === 'object' ? [entries] : [];
  return list.map((e) => norm((e as { staff?: unknown }).staff)).filter((name) => name !== '');
};

/** 1人分（集計用に整えたもの） */
interface Customer {
  /**
   * この顧客を数える担当（空白を除いた名前）。⚠️ 注文・建売だけ（中古は空）。
   *   in_charge_user と、商談ログに名前がある人。⚠️ 1人の顧客が複数の担当に入る。
   */
  staff: Set<string>;
  division: string;
  source: string;
  brand: string;
  shop: string;
  area: string;
  meeting: boolean;
  next: boolean;
  contract: boolean;
  lag: number | null;
}

const isUnset = (key: string): boolean => key === UNSET_LABEL || key === UNKNOWN_AREA;

const funnelOf = (key: string, list: Customer[]): FunnelRow => {
  const lags = list.map((c) => c.lag).filter((v): v is number => v !== null && v >= 0).sort((a, b) => a - b);
  return {
    key,
    inquiry: list.length,
    meeting: list.filter((c) => c.meeting).length,
    next: list.filter((c) => c.next).length,
    contract: list.filter((c) => c.contract).length,
    lagMedian: lags.length === 0 ? null : lags[Math.floor(lags.length / 2)],
  };
};

/** キーごとの歩留まり。⚠️ 反響の多い順（⚠️ 未入力・不明は最後） */
const groupFunnel = (list: Customer[], keyOf: (c: Customer) => string): FunnelRow[] => {
  const groups = new Map<string, Customer[]>();
  for (const c of list) {
    const key = keyOf(c);
    const found = groups.get(key);
    if (found === undefined) groups.set(key, [c]);
    else found.push(c);
  }
  return [...groups.entries()]
    .map(([key, rows]) => funnelOf(key, rows))
    .sort((a, b) => Number(isUnset(a.key)) - Number(isUnset(b.key)) || b.inquiry - a.inquiry);
};

/** 行 × 紹介元。⚠️ 画面で表にする（セルは歩留まり） */
const crossFunnel = (list: Customer[], rowOf: (c: Customer) => string): { rows: string[]; cells: Record<string, Record<string, FunnelRow>> } => {
  const rows = groupFunnel(list, rowOf).map((r) => r.key);
  const cells: Record<string, Record<string, FunnelRow>> = {};
  for (const row of rows) {
    cells[row] = {};
    for (const f of groupFunnel(list.filter((c) => rowOf(c) === row), (c) => c.source)) cells[row][f.key] = f;
  }
  return { rows, cells };
};

/**
 * 紹介キャンペーンのサマリーを返す。
 *
 * ⚠️⚠️ **選択肢（店舗・エリア）は絞り込みに関係なく全部返す。**
 *   ⚠️ 絞り込んだ結果から作ると、選んだ瞬間に他の選択肢が消えて戻れなくなる。
 */
export const runIntroductorySummary = async (filter: SummaryFilter): Promise<SummaryResult> => {
  const [shops, staffList, sheets, ...perTable] = await Promise.all([
    query<ShopRow>('SELECT shop, area, parent_shop, report_flag, division FROM shop_list ORDER BY id'),
    /**
     * 担当別に出す人（v2.2.218）。⚠️ 営業別契約率と同じく staff_list の report = 1。
     *   ⚠️ 年度は「今年以下で最新」（kpi/master.ts と同じ選び方）。⚠️ 並びは sort 順
     */
    query<StaffRow>(
      `SELECT name FROM staff_list
        WHERE report = 1 AND name <> ''
          AND period = (SELECT MAX(period) FROM staff_list
                         WHERE period <> '' AND period <= CAST(YEAR(CURDATE()) AS CHAR))
        GROUP BY name
        ORDER BY MIN(sort), MIN(id)`
    ),
    /**
     * 商談ログ（v2.2.218）。⚠️ 紹介の顧客（注文・建売）の分だけ引く。
     *   ⚠️ 商談シートは注文・建売・中古で同じ表で、id が顧客の id。
     */
    query<SheetRow>(
      `SELECT id, interview_log FROM interview_sheet
        WHERE id IN (SELECT id FROM master_data
                      WHERE TRIM(REPLACE(REPLACE(sales_promotion_name, '\\r', ''), '\\n', '')) = '紹介'
                     UNION
                     SELECT id FROM master_data_kaeru
                      WHERE TRIM(REPLACE(REPLACE(sales_promotion_name, '\\r', ''), '\\n', '')) = '紹介')`
    ),
    ...TABLES.map(({ table, division }) =>
      query<ReferralRow>(
        `SELECT id, ? AS tbl, in_charge_user, ? AS division, status,
                introduction_person_category AS source,
                brand, in_charge_store AS store,
                ${COL_INQUIRY} AS col_inquiry,
                ${COL_INTERVIEW} AS col_interview,
                ${COL_SCREENING} AS col_screening,
                ${COL_APPOINTMENT} AS col_appointment,
                ${COL_CONTRACT} AS col_contract
           FROM ${table}
          WHERE TRIM(REPLACE(REPLACE(sales_promotion_name, '\\r', ''), '\\n', '')) = '紹介'`,
        [table, division]
      )
    ),
  ]);

  /**
   * 顧客 id → 商談ログの担当者。
   * ⚠️ id は ULID の文字列で、注文・建売・中古の台帳をまたいで重ならない（実測 2026-10-26）。
   */
  const logStaffById = new Map<string, string[]>();
  for (const sheet of sheets) logStaffById.set(String(sheet.id), staffInLog(sheet.interview_log));

  /** 店舗 → 親店舗。⚠️ 併売店は親店舗として数える */
  const parentOf = new Map<string, string>();
  /** 店舗 → エリア。⚠️ 併売店は親店舗のエリアを使う（⚠️ 実測では親と同じ県） */
  const areaOf = new Map<string, string>();
  for (const s of shops) areaOf.set(s.shop, hasValue(s.area) ? String(s.area).trim() : areaFromName(s.shop));
  for (const s of shops) {
    const parent = hasValue(s.parent_shop) ? String(s.parent_shop).trim() : s.shop;
    parentOf.set(s.shop, parent);
    if (parent !== s.shop && hasValue(areaOf.get(parent))) areaOf.set(s.shop, areaOf.get(parent) ?? '');
  }

  const customers: Customer[] = [];
  for (const row of perTable.flat()) {
    if (row.status === '重複') continue;
    if (!inRange(toMonth(row.col_inquiry), filter)) continue;

    const store = String(row.store ?? '').trim();
    const shop = parentOf.get(store) ?? store;
    const area = areaOf.get(store) ?? '';
    if (filter.shop !== '' && shop !== filter.shop) continue;
    if (filter.area !== '' && area !== filter.area) continue;

    const contract = row.status === '契約済み';
    const inquiryDate = toDate(row.col_inquiry);
    const contractDate = toDate(row.col_contract);
    // ⚠️ 担当別は注文・建売だけ（v2.2.218 の指示: master_data(_kaeru)）
    const staff = new Set<string>();
    if (row.tbl === 'master_data' || row.tbl === 'master_data_kaeru') {
      const owner = norm(row.in_charge_user);
      if (owner !== '') staff.add(owner);
      for (const name of logStaffById.get(String(row.id)) ?? []) staff.add(name);
    }

    customers.push({
      staff,
      division: row.division,
      source: hasValue(row.source) ? String(row.source).trim() : UNSET_LABEL,
      brand: hasValue(row.brand) ? String(row.brand).trim() : UNSET_LABEL,
      shop: shop === '' ? UNSET_LABEL : shop,
      area: area === '' ? UNKNOWN_AREA : area,
      contract,
      meeting: contract || hasValue(row.col_interview) || hasValue(row.col_screening)
        || hasValue(row.col_appointment) || hasValue(row.col_contract),
      next: contract || hasValue(row.col_screening) || hasValue(row.col_appointment) || hasValue(row.col_contract),
      lag: contract && inquiryDate !== null && contractDate !== null
        ? Math.round((contractDate.getTime() - inquiryDate.getTime()) / 86_400_000)
        : null,
    });
  }

  /**
   * 店舗の選択肢。⚠️⚠️ **report_flag=1 かつ parent_shop IS NULL**（2026-10-15 の指示）。
   *   ⚠️ 全事業部（注文・建売・中古・不動産企画室）。⚠️ shop_list の id 順。
   */
  const shopOptions = shops
    .filter((s) => Number(s.report_flag) === 1 && !hasValue(s.parent_shop))
    .map((s) => ({ name: s.shop, area: areaOf.get(s.shop) ?? '', division: s.division ?? '' }));
  const areaOptions = [...new Set(shopOptions.map((s) => s.area).filter((a) => a !== ''))];

  /**
   * 担当別（v2.2.218）。⚠️ 名前は staff_list の表記で出し、突き合わせは空白を除いて行う。
   *   ⚠️ 反響が0の担当は出さない（2026-10-26 の指示）。⚠️ 反響の多い順。
   *   ⚠️ 1人の顧客が複数の担当に入るため、足しても全体と合わない（画面に注記する）。
   */
  const byStaff = staffList
    .map((s) => funnelOf(s.name, customers.filter((c) => c.staff.has(norm(s.name)))))
    .filter((row) => row.inquiry > 0)
    .sort((a, b) => b.inquiry - a.inquiry);

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      filter,
      total: funnelOf('全体', customers),
      bySource: groupFunnel(customers, (c) => c.source),
      byDivision: groupFunnel(customers, (c) => c.division),
      byBrand: groupFunnel(customers, (c) => c.brand),
      byArea: groupFunnel(customers, (c) => c.area),
      byShop: groupFunnel(customers, (c) => c.shop),
      byStaff,
      brandSource: crossFunnel(customers, (c) => c.brand),
      areaSource: crossFunnel(customers, (c) => c.area),
      shops: shopOptions,
      areas: areaOptions,
    },
  };
};
```
