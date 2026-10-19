# 2026-10-16 重複反響サマリー：他ブランドの行ごとに反響媒体の内訳（v2.2.195）

## 依頼（ReadMeClaude.md）
- `DuplicateInquirySummary.tsx` のカード内「他ブランド」の、反響媒体ごとの重複も見たい
- 案A（カードを広げて行の下に表示）／案B（ブランド名クリックで媒体ごとのサマリー）

## 決めたこと（利用者に確認済み）
- **案B**：パネル②（他ブランドの表）のブランド名を押すと、その行の下に媒体ごとの内訳を開く。もう一度押すと閉じる。開けるのは1行だけ
- **媒体はカードのブランド側**（例：KH のカードで DJH を押す →「KH にどの媒体で来た人が、DJH にもいたか」）
  - 重複率＝重複 ÷ その媒体で来たカードのブランドの反響（期間・エリアで絞ったもの）
  - 来場・次アポ・契約は、これまでのパネル②と同じく**相手ブランド側での到達段階**。下の％は重複に対する率
- 媒体は各顧客の販促媒体（`sales_promotion_name`）。空は「（媒体なし）」にまとめる
- 案Aにしなかった理由：注文の媒体は約78種類あり、行の下に並べると読めない

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features | **duplicateSummary.ts** | `MediumRow` 型・`NO_MEDIUM` を追加。`OtherBrandRow` に `media` を追加。`otherRows()` に引数 `mediumTotals` を追加し、`add()` に媒体を渡す。SELECT に `sales_promotion_name AS medium` を追加 |
| frontend/src/components/header | **DuplicateInquirySummary.tsx** | 型 `MediumRow` を追加。`MEDIUM_COLUMNS`・`mediumSortValue`・**`MediumBreakdown`**（新しいコンポーネント・見出しで並べ替え）を追加。`OthersTable` を開閉できる形に変更。CSS（`ds_media` など）と注意書き1行を追加 |
| frontend/src/utils | version.ts | `2.2.195` |
| backend/scripts/sql | **2026-10-16_update_log_2.2.195.sql**（新規） | update_log 1行 ＋ 記事1本 |
| backend/scripts/guide/articles/common | screen-110.md | 記事「重複反響サマリー」を更新 |

- ⚠️ 新しい request は無い（`duplicate_summary` の返す中身が増えただけ）。`express_proxy.php` の変更も無い。
- 返す量：全期間で約80KB（以前より増える）。

## 業務ガイドの記事
- **重複反響サマリー**（common/screen-110.md）：要約に「どの反響媒体で重なっているか」を追加。「## 反響媒体ごとに見る」を追加（押し方、反響・重複・重複率・来場/次アポ/契約の意味、媒体はカードのブランド側であることの例）

## 確かめたこと
- ① `localhost:8080/` にトークン無しで `duplicate_summary` → 401（② まで届く）
- ② の関数を実データで実行（全期間／2025-06〜2026-05＋鹿児島県）
  - 全70行・56行で「媒体の内訳の合計＝その行の総反響・来場・契約」、「重複 ≦ 反響」の食い違い 0 件
  - 例：KH × DJH の HOME'S … 反響 3,346・重複 1,087（32.5%）
- Playwright（実データをモック）
  - KH カードのブランド名ボタン 8 個、押すと内訳 30 行。並べ替え（重複率▼・媒体名▲）
  - 別のブランドを押すと切り替わる（開くのは1つ）、もう一度押すと閉じる、他のカードには開かない
  - エリアを変えても開いたまま、数字が変わる
  - 3列表示（1440px）で親の表 408/408・内訳 386/386（はみ出さない）、600px でも横スクロールなし
  - 業務ガイドで記事が崩れず表示（生の `**`・`[[` なし、行き先のないリンクなし）
- リファクタリング後（`media: []` の仮置きを `Omit` に、媒体名の整え方を簡単に、使っていないクラスを削除）も ② の出力が前とバイト単位で同じ。画面テストも再実行して同じ結果
- フロントの型チェック：既存の5件のみ。② `tsc --noEmit` OK
- ローカルDB：update_log no=295、記事を更新（直前の内容は guide_history へ）

## コードの差分（全文）

```diff
diff --git a/backend-express/src/features/duplicateSummary.ts b/backend-express/src/features/duplicateSummary.ts
index 00489239..431a5b5b 100644
--- a/backend-express/src/features/duplicateSummary.ts
+++ b/backend-express/src/features/duplicateSummary.ts
@@ -19,24 +19,28 @@ import { query } from '../db/pool';
  *   master_data_resale のうち ⚠️⚠️ **in_charge_store＝「買い:中古リノベ」だけ**（中専。指示）
  *
  * ⚠️ カードの数字（総反響・来場・次アポ・契約）は ⚠️⚠️ **status＝重複 を除く**（ほかの画面と同じ）。
  *   ⚠️ ただし **重複の相手としては含める**（指示で承認済み）。
  *
  * ⚠️ エリア（都道府県）は full_address から決める（下の `prefectureOf`。2026-10-16 の指示）。
  *   ⚠️ 期間と同じく **カードのブランド側の反響だけ** を絞る（相手側は住所に関係なく全件と比べる）。
  *   ⚠️ 都道府県が決まらない顧客は、エリアを選んだときには出ない（⚠️「不明」は選択肢に出さない。指示）。
  *
  * ⚠️⚠️ **横棒の色分けとパネル②は「相手ブランド側での到達段階」**（案A。2026-10-16 の指示）。
  *   例: KH のカードの「DJH」の棒 … KH の反響のうち DJH にも同じ人がいるもの。
  *       色はその人が **DJH で** どこまで進んだか（資料請求のみ／来場／次アポ／契約）。
+ *
+ * ⚠️ v2.2.195: パネル②の行ごとに **反響媒体の内訳**（`media`）を付ける（2026-10-16 の指示・案B）。
+ *   ⚠️⚠️ 媒体は **カードのブランド側**（KH に来たときの sales_promotion_name）。⚠️ 相手側の媒体ではない。
+ *   ⚠️ 重複率の分母は「その媒体で来たカードのブランドの反響（期間・エリアで絞ったもの）」。
  * ─────────────────────────────────────────────
  */
 
 /** 商談フェーズの列。⚠️ staffContract.ts と同じ列ID（⚠️ DBのコメントは当てにならない） */
 const COL_INQUIRY = 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99';     // 反響取得日
 const COL_INTERVIEW = 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7';   // 初回面談（＝来場）
 const COL_SCREENING = 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR';   // 事前審査
 const COL_APPOINTMENT = 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'; // 第二面談
 const COL_CONTRACT = 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG';    // 契約
 
 /** カードのブランド（⚠️ 画面の並び順もこの順。KHG は画面側で先頭に足す） */
 export const CARD_BRANDS = ['KH', 'DJH', 'なごみ', '2L', 'JH', 'PGH', 'かえる', '中専'] as const;
@@ -64,24 +68,25 @@ const RESALE_STORE = '買い:中古リノベ';
 const STAGE = { request: 0, visit: 1, next: 2, contract: 3 } as const;
 type Stage = (typeof STAGE)[keyof typeof STAGE];
 
 interface CustomerRow extends RowDataPacket {
   brand: string | null;
   store: string | null;
   status: string | null;
   phone: string | null;
   mobile: string | null;
   email: string | null;
   extra: string | null;
   address: string | null;
+  medium: string | null;
   col_inquiry: string | null;
   col_interview: string | null;
   col_screening: string | null;
   col_appointment: string | null;
   col_contract: string | null;
 }
 
 interface ShopRow extends RowDataPacket {
   shop: string;
   brand: string | null;
 }
 
@@ -92,31 +97,45 @@ export interface SummaryFilter {
   /** 都道府県（例 鹿児島県）。⚠️ 空なら絞らない */
   area: string;
 }
 
 /** 総反響・来場・次アポ・契約。⚠️ 来場は「来場以降」、次アポは「次アポ以降」（累積） */
 export interface Funnel {
   inquiry: number;
   visit: number;
   next: number;
   contract: number;
 }
 
+/** パネル②の行を開いたときの1行（カードのブランド側の反響媒体ごと） */
+export interface MediumRow {
+  medium: string;
+  /** その媒体で来たカードのブランドの反響（⚠️ 重複していないものも含む。重複率の分母） */
+  total: number;
+  /** そのうち相手ブランドと重複したもの（⚠️ 来場・次アポ・契約は相手ブランド側での到達段階） */
+  dup: Funnel;
+}
+
 /** 横棒1本＋パネル②の1行（相手ブランドごと） */
 export interface OtherBrandRow extends Funnel {
   brand: string;
   /** 積み上げの内訳（⚠️ 最も進んだ段階で1人1つ。合計＝inquiry） */
   stack: { request: number; visit: number; next: number; contract: number };
+  /** 反響媒体ごとの内訳（⚠️ 重複の多い順） */
+  media: MediumRow[];
 }
 
+/** 販促媒体が空の顧客の表記 */
+const NO_MEDIUM = '（媒体なし）';
+
 export interface DuplicateSummaryResult {
   httpStatus: number;
   body: Record<string, unknown>;
 }
 
 const hasValue = (value: unknown): boolean => String(value ?? '').trim() !== '';
 
 /** 日付から `YYYY-MM`。読めなければ空文字（⚠️ staffContract.ts と同じ） */
 const toMonth = (value: unknown): string => {
   const matched = /^(\d{4})[-/](\d{1,2})(?:[-/]|$)/.exec(String(value ?? '').trim());
   if (matched === null) return '';
   return `${matched[1]}-${matched[2].padStart(2, '0')}`;
@@ -208,68 +227,85 @@ const stageOf = (row: CustomerRow): Stage => {
   return STAGE.request;
 };
 
 /** 1件分（集計用に整えたもの） */
 interface Customer {
   brand: string;
   /** カードの数字に数えるか（⚠️ status＝重複 は数えない。相手としては使う） */
   counted: boolean;
   /** 期間に入っているか */
   inPeriod: boolean;
   /** 都道府県（full_address から）。⚠️ 決まらなければ空 */
   pref: string;
+  /** 反響媒体（sales_promotion_name）。⚠️ 空なら NO_MEDIUM */
+  medium: string;
   stage: Stage;
   keys: string[];
 }
 
 const emptyFunnel = (): Funnel => ({ inquiry: 0, visit: 0, next: 0, contract: 0 });
 const addStage = (funnel: Funnel, stage: Stage): void => {
   funnel.inquiry += 1;
   if (stage >= STAGE.visit) funnel.visit += 1;
   if (stage >= STAGE.next) funnel.next += 1;
   if (stage >= STAGE.contract) funnel.contract += 1;
 };
 const STACK_KEY = ['request', 'visit', 'next', 'contract'] as const;
 
-/** 相手ブランドごとの行を作る器 */
-const otherRows = () => {
-  const map = new Map<string, OtherBrandRow>();
+/**
+ * 相手ブランドごとの行を作る器。
+ * @param mediumTotals 媒体 → カードのブランドの反響数（⚠️ 重複率の分母。全部 add し終えてから list を呼ぶ）
+ */
+const otherRows = (mediumTotals: Map<string, number>) => {
+  const map = new Map<string, Omit<OtherBrandRow, 'media'> & { byMedium: Map<string, Funnel> }>();
   return {
-    add(brand: string, stage: Stage) {
-      const row = map.get(brand) ?? { brand, ...emptyFunnel(), stack: { request: 0, visit: 0, next: 0, contract: 0 } };
+    add(brand: string, stage: Stage, medium: string) {
+      const row = map.get(brand)
+        ?? { brand, ...emptyFunnel(), stack: { request: 0, visit: 0, next: 0, contract: 0 }, byMedium: new Map<string, Funnel>() };
       addStage(row, stage);
       row.stack[STACK_KEY[stage]] += 1;
+      const dup = row.byMedium.get(medium) ?? emptyFunnel();
+      addStage(dup, stage);
+      row.byMedium.set(medium, dup);
       map.set(brand, row);
     },
-    /** ⚠️ 多い順（⚠️ 同数ならカードの並び順） */
+    /** ⚠️ 多い順（⚠️ 同数ならカードの並び順）。⚠️ 媒体も重複の多い順（同数なら媒体名順） */
     list(): OtherBrandRow[] {
       const order = (b: string) => { const i = (CARD_BRANDS as readonly string[]).indexOf(b); return i < 0 ? 99 : i; };
-      return [...map.values()].sort((a, b) => b.inquiry - a.inquiry || order(a.brand) - order(b.brand));
+      return [...map.values()]
+        .sort((a, b) => b.inquiry - a.inquiry || order(a.brand) - order(b.brand))
+        .map(({ byMedium, ...row }) => ({
+          ...row,
+          media: [...byMedium.entries()]
+            .map(([medium, dup]) => ({ medium, total: mediumTotals.get(medium) ?? 0, dup }))
+            .sort((a, b) => b.dup.inquiry - a.dup.inquiry || a.medium.localeCompare(b.medium, 'ja')),
+        }));
     },
   };
 };
 
 /**
  * 重複反響サマリーを返す。
  *
  * ⚠️ 期間は **カードのブランド側の反響取得日** で絞る。⚠️ 相手側は期間に関係なく全件と比べる
  *   （⚠️ 先に他ブランドへ問い合わせていた人も「重複」として拾うため）。
  */
 export const runDuplicateSummary = async (range: SummaryFilter): Promise<DuplicateSummaryResult> => {
   const columns = `brand, in_charge_store AS store, status,
                    customer_contacts_phone_number AS phone,
                    customer_contacts_mobile_phone_number AS mobile,
                    customer_contacts_email AS email,
                    extra_address_info AS extra,
                    full_address AS address,
+                   sales_promotion_name AS medium,
                    ${COL_INQUIRY} AS col_inquiry,
                    ${COL_INTERVIEW} AS col_interview,
                    ${COL_SCREENING} AS col_screening,
                    ${COL_APPOINTMENT} AS col_appointment,
                    ${COL_CONTRACT} AS col_contract`;
 
   const [shops, order, kaeru, resale] = await Promise.all([
     query<ShopRow>('SELECT shop, brand FROM shop_list'),
     query<CustomerRow>(`SELECT ${columns} FROM master_data`),
     query<CustomerRow>(`SELECT ${columns} FROM master_data_kaeru`),
     query<CustomerRow>(`SELECT ${columns} FROM master_data_resale WHERE in_charge_store = ?`, [RESALE_STORE]),
   ]);
@@ -281,24 +317,25 @@ export const runDuplicateSummary = async (range: SummaryFilter): Promise<Duplica
   const orderBrandOf = (row: CustomerRow): string => {
     const named = ORDER_BRAND[String(row.brand ?? '').trim()];
     if (named !== undefined) return named;
     if (hasValue(row.brand)) return OTHER_BRAND; // フルコミホームなど
     return SHOP_BRAND[shopBrand.get(String(row.store ?? '').trim()) ?? ''] ?? OTHER_BRAND;
   };
 
   const toCustomer = (row: CustomerRow, brand: string): Customer => ({
     brand,
     counted: row.status !== '重複',
     inPeriod: inRange(toMonth(row.col_inquiry), range),
     pref: prefectureOf(row.address),
+    medium: String(row.medium ?? '').trim() || NO_MEDIUM,
     stage: stageOf(row),
     keys: keysOf(row),
   });
   const customers: Customer[] = [
     ...order.map((r) => toCustomer(r, orderBrandOf(r))),
     ...kaeru.map((r) => toCustomer(r, 'かえる')),
     ...resale.map((r) => toCustomer(r, '中専')),
   ];
 
   /** キー → そのキーを持つ顧客 */
   const byKey = new Map<string, Customer[]>();
   for (const c of customers) {
@@ -324,39 +361,41 @@ export const runDuplicateSummary = async (range: SummaryFilter): Promise<Duplica
     }
     return result;
   };
 
   const brands = [...CARD_BRANDS, OTHER_BRAND];
   const cards: Record<string, { own: Funnel; duplicated: number; others: OtherBrandRow[] }> = {};
   const groupOwn = emptyFunnel();
   /** KHG カードの横棒・パネル②: ブランドごとの「他ブランドと重複した反響」 */
   const groupRows = new Map<string, { brand: string; total: number; dup: Funnel; stack: OtherBrandRow['stack'] }>();
 
   for (const brand of brands) {
     const own = emptyFunnel();
-    const others = otherRows();
+    const mediumTotals = new Map<string, number>();
+    const others = otherRows(mediumTotals);
     let duplicated = 0;
     const groupRow = { brand, total: 0, dup: emptyFunnel(), stack: { request: 0, visit: 0, next: 0, contract: 0 } };
 
     for (const c of customers) {
       if (c.brand !== brand || !c.counted || !c.inPeriod) continue;
       if (range.area !== '' && c.pref !== range.area) continue;
       addStage(own, c.stage);
       addStage(groupOwn, c.stage);
       groupRow.total += 1;
+      mediumTotals.set(c.medium, (mediumTotals.get(c.medium) ?? 0) + 1);
 
       const counterparts = counterpartsOf(c);
       if (counterparts.size === 0) continue;
       duplicated += 1;
-      for (const [otherBrand, stage] of counterparts) others.add(otherBrand, stage);
+      for (const [otherBrand, stage] of counterparts) others.add(otherBrand, stage, c.medium);
 
       // ⚠️ KHG は相手が複数あれば最も進んだ段階で数える
       const best = Math.max(...counterparts.values()) as Stage;
       addStage(groupRow.dup, best);
       groupRow.stack[STACK_KEY[best]] += 1;
     }
     cards[brand] = { own, duplicated, others: others.list() };
     groupRows.set(brand, groupRow);
   }
 
   /**
    * エリアの選択肢。⚠️ カードに数える顧客（status＝重複 以外）の都道府県を件数の多い順に。
diff --git a/frontend/src/components/header/DuplicateInquirySummary.tsx b/frontend/src/components/header/DuplicateInquirySummary.tsx
index 2bbc6b92..8c4eb36f 100644
--- a/frontend/src/components/header/DuplicateInquirySummary.tsx
+++ b/frontend/src/components/header/DuplicateInquirySummary.tsx
@@ -7,33 +7,36 @@ import { setStyleClass } from '../../utils/setStyleClass';
 /**
  * 重複反響サマリー（ヘッダー → 反響管理 → 重複反響サマリー）。v2.2.193 新規。
  *
  * ─────────────────────────────────────────────
  * ⚠️ データは ② の `duplicate_summary`（features/duplicateSummary.ts）。
  *   ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ ① の express_proxy.php の許可リストで ② へ転送している。
  *
  * ⚠️⚠️ **「重複」は status＝重複 ではない。** 電話・携帯・メール・extra_address_info が
  *   ⚠️ **他ブランドの顧客と一致する反響**のこと（判定は ② 側）。
  *
  * ⚠️ カード: KHG（グループ全体）＋ KH / DJH / なごみ / 2L / JH / PGH / かえる / 中専。
  *   ⚠️ 横棒とパネル②は ⚠️⚠️ **相手ブランド側での到達段階**（2026-10-16 の指示・案A）。
+ *   ⚠️ v2.2.195: パネル②のブランド名を押すと反響媒体ごとの内訳（媒体は **カードのブランド側**。案B）。
  *
  * ⚠️ 見た目は GoogleReview.tsx の作法（CLAUDE.md のデザインポリシー）。
  * ⚠️ モーダルは ⚠️⚠️ **全画面**（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンはここに作らない。
  * ─────────────────────────────────────────────
  */
 
 type Funnel = { inquiry: number; visit: number; next: number; contract: number };
 type Stack = { request: number; visit: number; next: number; contract: number };
-type OtherBrandRow = Funnel & { brand: string; stack: Stack };
+/** ⚠️ 媒体は **カードのブランド側**。total＝その媒体の反響（重複率の分母）、dup＝そのうち相手と重複したもの */
+type MediumRow = { medium: string; total: number; dup: Funnel };
+type OtherBrandRow = Funnel & { brand: string; stack: Stack; media: MediumRow[] };
 type Card = { own: Funnel; duplicated: number; others: OtherBrandRow[] };
 type GroupRow = { brand: string; total: number; dup: Funnel; stack: Stack };
 type Summary = {
     brands: string[];
     /** エリアの選択肢（都道府県。件数の多い順）。⚠️ 絞り込みに関係なく全部来る */
     areas: string[];
     cards: Record<string, Card>;
     group: { own: Funnel; byBrand: GroupRow[] };
 };
 
 /**
  * 積み上げの段階。⚠️ 色は資料請求 → 契約で薄 → 濃（⚠️ 進んだほど目立つ）。
@@ -108,52 +111,159 @@ const StackedBars = ({ rows }: { rows: { brand: string; stack: Stack }[] }) => {
                     <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                     <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#9ca3af" width={52} />
                     <Tooltip contentStyle={{ fontSize: '12px' }} cursor={{ fill: '#f8fafc' }} />
                     {STAGES.map(stage => (
                         <Bar key={stage.key} dataKey={stage.key} name={stage.label} stackId="dup" fill={stage.color} />
                     ))}
                 </BarChart>
             </ResponsiveContainer>
         </div>
     );
 };
 
-/** パネル②：相手ブランドごとの総反響・来場・次アポ・契約（⚠️ 相手ブランド側での到達段階） */
-const OthersTable = ({ rows }: { rows: OtherBrandRow[] }) => (
-    <table className="ds_table">
-        <thead>
-            <tr>
-                <th className="ds_th">他ブランド</th>
-                <th className="ds_th text-end">総反響</th>
-                <th className="ds_th text-end">来場</th>
-                <th className="ds_th text-end">次アポ</th>
-                <th className="ds_th text-end">契約</th>
-            </tr>
-        </thead>
-        <tbody>
-            {rows.map(r => (
-                <tr key={r.brand} className="ds_row">
-                    <td className="ds_td"><BrandMark brand={r.brand} /></td>
-                    <td className="ds_td ds_num">{r.inquiry.toLocaleString()}</td>
-                    {(['visit', 'next', 'contract'] as const).map(key => (
-                        <td key={key} className="ds_td ds_num">
-                            {r[key].toLocaleString()}
-                            <small>{percent(rate(r[key], r.inquiry))}</small>
-                        </td>
-                    ))}
+/** 媒体の内訳の並べ替え。⚠️ 既定は重複の多い順（② の並び） */
+type MediumSortKey = 'medium' | 'total' | 'dup' | 'dupRate' | 'visit' | 'next' | 'contract';
+const MEDIUM_COLUMNS: { key: MediumSortKey; label: string; title?: string }[] = [
+    { key: 'medium', label: '反響媒体' },
+    { key: 'total', label: '反響', title: 'カードのブランドにこの媒体で来た反響（重複していないものも含む）' },
+    { key: 'dup', label: '重複', title: 'そのうち相手のブランドにも同じ人がいる反響' },
+    { key: 'dupRate', label: '重複率', title: '重複 ÷ 反響' },
+    { key: 'visit', label: '来場', title: '相手のブランドで来場した人（下の％は重複に対する率）' },
+    { key: 'next', label: '次アポ', title: '相手のブランドで次アポまで進んだ人（下の％は重複に対する率）' },
+    { key: 'contract', label: '契約', title: '相手のブランドで契約した人（下の％は重複に対する率）' },
+];
+const mediumSortValue = (row: MediumRow, key: MediumSortKey): number | string => {
+    switch (key) {
+        case 'medium': return row.medium;
+        case 'total': return row.total;
+        case 'dup': return row.dup.inquiry;
+        case 'dupRate': return rate(row.dup.inquiry, row.total) ?? -1;
+        default: return row.dup[key];
+    }
+};
+
+/**
+ * パネル②の行を開いたときの、反響媒体ごとの内訳（v2.2.195・案B）。
+ * ⚠️ 媒体は **カードのブランド側**。⚠️ 来場・次アポ・契約は相手ブランド側での到達段階（パネル②と同じ）。
+ */
+const MediumBreakdown = ({ media, brand }: { media: MediumRow[]; brand: string }) => {
+    const [sort, setSort] = useState<{ key: MediumSortKey; desc: boolean }>({ key: 'dup', desc: true });
+    const sorted = useMemo(() => {
+        const list = [...media];
+        list.sort((a, b) => {
+            const x = mediumSortValue(a, sort.key);
+            const y = mediumSortValue(b, sort.key);
+            const diff = typeof x === 'string' ? x.localeCompare(String(y), 'ja') : x - Number(y);
+            return sort.desc ? -diff : diff;
+        });
+        return list;
+    }, [media, sort]);
+    const onSort = (key: MediumSortKey) =>
+        setSort(prev => (prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== 'medium' }));
+
+    return (
+        <div className="ds_media">
+            <div className="ds_media_head">
+                <BrandMark brand={brand} /> と重複した反響の、<b>反響媒体</b>ごとの内訳（媒体はこのカードのブランドに来たときのもの）
+            </div>
+            <div className="ds_media_scroll">
+                <table className="ds_table">
+                    <thead>
+                        <tr>
+                            {MEDIUM_COLUMNS.map(col => (
+                                <th key={col.key} title={col.title}
+                                    className={`ds_th ds_sortable ${col.key === 'medium' ? '' : 'text-end'}`}
+                                    aria-sort={sort.key === col.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}
+                                    onClick={() => onSort(col.key)}>
+                                    {col.label}
+                                    <span className="ds_sort_icon">{sort.key === col.key ? (sort.desc ? '▼' : '▲') : ''}</span>
+                                </th>
+                            ))}
+                        </tr>
+                    </thead>
+                    <tbody>
+                        {sorted.map(m => (
+                            <tr key={m.medium} className="ds_row">
+                                <td className="ds_td ds_medium_name" title={m.medium}>{m.medium}</td>
+                                <td className="ds_td ds_num">{m.total.toLocaleString()}</td>
+                                <td className="ds_td ds_num">{m.dup.inquiry.toLocaleString()}</td>
+                                <td className="ds_td ds_num" style={{ fontWeight: 700 }}>{percent(rate(m.dup.inquiry, m.total))}</td>
+                                {(['visit', 'next', 'contract'] as const).map(key => (
+                                    <td key={key} className="ds_td ds_num">
+                                        {m.dup[key].toLocaleString()}
+                                        <small>{percent(rate(m.dup[key], m.dup.inquiry))}</small>
+                                    </td>
+                                ))}
+                            </tr>
+                        ))}
+                    </tbody>
+                </table>
+            </div>
+        </div>
+    );
+};
+
+/**
+ * パネル②：相手ブランドごとの総反響・来場・次アポ・契約（⚠️ 相手ブランド側での到達段階）。
+ * ⚠️ v2.2.195: ブランド名を押すと、その行の下に反響媒体ごとの内訳を開く（⚠️ 開けるのは1行だけ。もう一度押すと閉じる）。
+ */
+const OthersTable = ({ rows }: { rows: OtherBrandRow[] }) => {
+    const [openBrand, setOpenBrand] = useState<string | null>(null);
+    return (
+        <table className="ds_table">
+            <thead>
+                <tr>
+                    <th className="ds_th">他ブランド<span className="ds_th_hint">（押すと媒体別）</span></th>
+                    <th className="ds_th text-end">総反響</th>
+                    <th className="ds_th text-end">来場</th>
+                    <th className="ds_th text-end">次アポ</th>
+                    <th className="ds_th text-end">契約</th>
                 </tr>
-            ))}
-        </tbody>
-    </table>
-);
+            </thead>
+            <tbody>
+                {rows.map(r => {
+                    const isOpen = openBrand === r.brand;
+                    return (
+                        <React.Fragment key={r.brand}>
+                            <tr className={`ds_row${isOpen ? ' is_open' : ''}`}>
+                                <td className="ds_td">
+                                    <button type="button" className="ds_brand_btn" aria-expanded={isOpen}
+                                        title={`${r.brand} と重複した反響を、反響媒体ごとに見る`}
+                                        onClick={() => setOpenBrand(isOpen ? null : r.brand)}>
+                                        <span className="ds_caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
+                                        <BrandMark brand={r.brand} />
+                                    </button>
+                                </td>
+                                <td className="ds_td ds_num">{r.inquiry.toLocaleString()}</td>
+                                {(['visit', 'next', 'contract'] as const).map(key => (
+                                    <td key={key} className="ds_td ds_num">
+                                        {r[key].toLocaleString()}
+                                        <small>{percent(rate(r[key], r.inquiry))}</small>
+                                    </td>
+                                ))}
+                            </tr>
+                            {isOpen && (
+                                <tr>
+                                    <td colSpan={5} className="ds_media_cell">
+                                        <MediumBreakdown media={r.media} brand={r.brand} />
+                                    </td>
+                                </tr>
+                            )}
+                        </React.Fragment>
+                    );
+                })}
+            </tbody>
+        </table>
+    );
+};
 
 /** ブランド名の左に色の印 */
 const BrandMark = ({ brand }: { brand: string }) => (
     <span className="ds_mark"><i style={{ background: brandColorOf(brand) }} />{brand}</span>
 );
 
 const DuplicateInquirySummary = () => {
     const [summary, setSummary] = useState<Summary | null>(null);
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState('');
 
     /** ⚠️ 期間（反響取得日）。⚠️ 既定は空＝全期間 */
@@ -252,24 +362,45 @@ const DuplicateInquirySummary = () => {
                 .ds_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                 .ds_th { background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 6px 8px;
                          font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                 .ds_td { border-bottom: 1px solid #f1f5f9; padding: 5px 8px; vertical-align: middle; white-space: nowrap; }
                 .ds_row:hover > .ds_td { background: #f8fafc; }
                 .ds_row:last-child > .ds_td { border-bottom: none; }
                 .ds_num { text-align: right; font-variant-numeric: tabular-nums; }
                 .ds_num small { display: block; font-size: 10px; color: #6b7280; line-height: 1.2; }
                 .ds_mark { font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
                 .ds_mark i { display: inline-block; width: 4px; height: 14px; border-radius: 2px; }
                 .ds_table_wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: auto; }
                 .ds_empty { color: #9ca3af; font-size: 12px; text-align: center; padding: 14px; }
+
+                /* ⚠️ v2.2.195: パネル②のブランド名 → 反響媒体ごとの内訳 */
+                .ds_th_hint { font-weight: 400; color: #9ca3af; margin-left: 4px; }
+                .ds_brand_btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
+                                padding: 2px 4px 2px 0; border-radius: 6px; cursor: pointer; color: inherit; font: inherit; }
+                .ds_brand_btn:hover .ds_mark { text-decoration: underline; }
+                .ds_brand_btn:focus-visible { outline: 2px solid #0f766e; outline-offset: 1px; }
+                .ds_caret { font-size: 10px; color: #0f766e; width: 10px; }
+                .ds_row.is_open > .ds_td { background: #f0fdfa; }
+                .ds_media_cell { padding: 0 4px 8px; background: #f0fdfa; border-bottom: 1px solid #e5e7eb; }
+                /* ⚠️⚠️ width: 0 ＋ min-width: 100% … 内訳の表が **親の表（パネル②）を押し広げない** ように。はみ出す分は内訳の中で横にスクロール */
+                .ds_media { background: #fff; border: 1px solid #ccebe6; border-radius: 8px; padding: 6px;
+                            display: flex; flex-direction: column; gap: 6px; width: 0; min-width: 100%; box-sizing: border-box; }
+                .ds_media_head { font-size: 11px; color: #4b5563; white-space: normal; line-height: 1.6; }
+                .ds_media_scroll { max-height: 320px; overflow: auto; }
+                .ds_media_scroll .ds_th { position: sticky; top: 0; z-index: 1; padding: 4px 5px; }
+                .ds_media_scroll .ds_td { padding: 4px 5px; font-size: 11px; }
+                .ds_sortable { cursor: pointer; user-select: none; }
+                .ds_sortable:hover { color: #0f766e; }
+                .ds_sort_icon { display: inline-block; width: 10px; font-size: 9px; margin-left: 2px; }
+                .ds_medium_name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
             `}</style>
 
             <div className="ds_inner">
                 <div className="ds_head">
                     <span className="ds_title">
                         <i className="fa-solid fa-people-arrows me-2" style={{ color: '#0f766e' }} aria-hidden="true" />
                         重複反響サマリー
                     </span>
                     <span className="ds_note">連絡先（電話・携帯・メール・住所の補足）が他ブランドの顧客と一致する反響</span>
                 </div>
 
                 <div className="ds_bar">
@@ -310,24 +441,27 @@ const DuplicateInquirySummary = () => {
 
                 {error !== '' && <div className="alert alert-danger mb-0" style={{ fontSize: '13px' }}>{error}</div>}
 
                 {/* ⚠️⚠️ **この注記を外さないこと。** 「重複」の意味が status の「重複」と取り違えられやすい */}
                 <div className="ds_caution">
                     ※ <b>重複</b>＝電話・携帯・メール・住所の補足（extra_address_info）のどれかが、<b>他ブランドの顧客と一致</b>する反響です
                     （空白とハイフンは除いて比べます。短すぎる値は比べません）。状況「重複」の顧客はカードの数字から除いています。
                     <br />
                     ※ 横棒とパネル②の来場・次アポ・契約は、<b>相手のブランドで</b>どこまで進んだかです。
                     期間は<b>カードのブランドの反響取得日</b>、エリアは<b>カードのブランドの顧客の住所</b>で絞ります（相手のブランドは期間・住所に関係なく比べます）。
                     住所から都道府県が分からない顧客は、エリアを選ぶと数字に入りません。
                     <br />
+                    ※ パネル②のブランド名を押すと、<b>反響媒体ごとの内訳</b>が開きます。媒体は<b>カードのブランドに来たとき</b>のもので、
+                    重複率は「その媒体で来た反響のうち、相手のブランドにも同じ人がいる割合」です。
+                    <br />
                     ※ 来場＝初回面談以降の日付あり、次アポ＝事前審査・第二面談・契約の日付あり、契約＝状況が「契約済み」です。
                     中専は担当店舗が「買い:中古リノベ」の顧客だけです。
                 </div>
 
                 <div className="ds_legend">
                     {STAGES.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
                     <span>（横棒の長さ＝重複した反響数）</span>
                 </div>
 
                 {summary === null ? (
                     loading && (
                         <div className="text-center py-5">
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 1d7dd3b5..c1235355 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.194';
+export const newVersion = '2.2.195';
```
