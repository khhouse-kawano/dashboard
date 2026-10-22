# 2026-10-22 4半期サマリーを建売分譲事業でも（v2.2.210）

## 指示
- 新たなブランチで、`frontend/src/components/company/QuarterSummary.tsx` で建売部門も表示したい
- `frontend/src/components/company/Company.tsx` で category=spec の場合もボタンを設置したい
- 確認で決めたこと：建売の実績に仲介の契約を含め「うち仲介」の行を足す／契約予定は Aランク × 予定月／反響実績の行は注文と同じ（総反響・来場・次アポ・契約＋PH）で定義は建売の画面に合わせる

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/company/ | QuarterSummary.tsx | `DIVISIONS`（事業ごとの設定）・`isBrokerContracted`・`countKpiSpec` を追加。props に `category`。範囲・顧客・契約予定のランク・仲介の行・注記を事業で切り替え |
| frontend/src/components/company/ | Company.tsx | 4半期サマリーのボタンと QuarterSummary を spec でも出す（`key={category}`・`category` を渡す） |
| frontend/src/utils/ | version.ts | 2.2.210 |
| backend/scripts/sql/ | 2026-10-22_update_log_2.2.210.sql（新規） | 更新履歴（ローカル no=310）＋業務ガイドの記事 |
| backend/scripts/guide/articles/spec/ | screen-060.md | 記事「全社報告用フォーマット（建売営業）」に「4半期サマリー」の節を追加 |
| docs/ | deploy-v2.2.210.md（新規） | デプロイ手順 |

## 業務ガイドの記事
- 「全社報告用フォーマット（建売営業）」：「4半期サマリーは注文営業だけ」を消し、「## 4半期サマリー」の節（契約実績・うち仲介・契約予定は Aランク・反響実績・店舗の開閉・予定月を入れる注意）を足した。ローカル DB に投入済み

## 建売の数え方
- 範囲：建売分譲事業 → 課（不動産営業1課・2課）→ 係（鹿児島1〜3係・熊本係・外販／宮崎係・大分係）。全店舗の予算は建売分譲事業の店舗すべて（かえる○○店を含む）
- 契約実績：自社（契約日）＋仲介（仲介契約日）。どちらも 契約済み・解約（Company の calculateContractList / calculateContractListBroker と同じ）。「うち仲介」は仲介の数
- 契約予定：当月より前は契約数、当月以降は Aランク × rank_period
- 反響実績：customerTrend（category: spec）を show_dashboard = 1 に絞り、CustomerTrendKaeru.tsx の getValue と同じ定義（段の日付が空なら先の段のいちばん古い月）
- ⚠️ ローカルのデータでは Aランクの顧客 8人・予定月の入力 0人 → 当月以降の契約予定は0（利用者に報告）

## 確認
- `npm run build` 通過（main.dc29262b.js）。QuarterSummary.tsx の警告（useMemo の依存に DIVISION が無い）2件を直した。Company.tsx の警告は main と同じ（既存）
- 画面（Playwright・ローカルの ① ② ・本番への通信は遮断）：
  - 建売：緑の「4半期サマリー」→ 見出し「建売分譲事業 / 2027年5月期」・「うち仲介」の行・課 → 係の行・反響実績（上半期の総反響 1,469 は期ごとのレポートの今期の反響数と一致）
  - 注文：**main と今回とで、契約実績報告・反響実績報告の表の文字が完全に一致**（innerText を比較）
  - テストのため、ローカル DB の Master の担当者1人に一時トークンを入れ、終わったら元に戻した
- コードの再読・リファクタリング（依存の追加）のあと、上の確認をもう一度通した

## コード（差分）
```diff
diff --git a/frontend/src/components/company/Company.tsx b/frontend/src/components/company/Company.tsx
index e76b9d36..2c2bdb33 100644
--- a/frontend/src/components/company/Company.tsx
+++ b/frontend/src/components/company/Company.tsx
@@ -66,7 +66,7 @@ const Company = () => {
     const [showMulti, setShowMulti] = useState<boolean>(false);
     const [showRanking, setShowRanking] = useState(false);
     /**
-     * 4半期サマリー（2026-10-05 / v2.2.163）。⚠️ 注文（category === 'order'）だけ。
+     * 4半期サマリー（2026-10-05 / v2.2.163）。注文（category === 'order'）と、v2.2.210 から建売（'spec'）。
      * ⚠️ 中身は QuarterSummary.tsx。⚠️ 契約・予算は**この画面のデータをそのまま渡す**。
      */
     const [showQuarterSummary, setShowQuarterSummary] = useState(false);
@@ -1033,9 +1033,9 @@ const Company = () => {
                         {(category === 'order' || category === 'spec') &&
                             <div className={`text-white bg-${category === 'order' ? 'primary' : 'success'} rounded-pill px-2 py-1 mx-1 shadow-sm`} style={{ fontSize: '10px', cursor: 'pointer' }}
                                 onClick={() => setShowRanking(true)}>契約棟数ランキング</div>}
-                        {/* ⚠️ 注文だけ。⚠️ 見た目は左の「契約棟数ランキング」と同じにしてある */}
-                        {category === 'order' &&
-                            <div className="text-white bg-primary rounded-pill px-2 py-1 mx-1 shadow-sm" style={{ fontSize: '10px', cursor: 'pointer' }}
+                        {/* ⚠️ 注文・建売（建売は v2.2.210）。⚠️ 見た目は左の「契約棟数ランキング」と同じにしてある */}
+                        {(category === 'order' || category === 'spec') &&
+                            <div className={`text-white bg-${category === 'order' ? 'primary' : 'success'} rounded-pill px-2 py-1 mx-1 shadow-sm`} style={{ fontSize: '10px', cursor: 'pointer' }}
                                 onClick={() => setShowQuarterSummary(true)}>4半期サマリー</div>}
                         <div className="bg-white m-1">
                             <label style={{ fontSize: '12px', cursor: 'pointer' }} className='d-flex align-items-center'><input type='checkbox' className='me-1'
@@ -1229,10 +1229,13 @@ const Company = () => {
             <InformationEditKaeru id={editId.kaeru} token={token} onClose={informationEditClose} authority={authority} />
             <InformationEditResale id={editId.resale} token={token} onClose={informationEditClose} authority={authority} />
             <Ranking showRanking={showRanking} setShowRanking={setShowRanking} customerList={customerList} monthArray={monthArray} staffList={staffList} achievement={achievement}/>
-            {category === 'order' &&
+            {(category === 'order' || category === 'spec') &&
                 <QuarterSummary
+                    // ⚠️ 事業が変わったら作り直す（⚠️ 中で反響を1回だけ取って持っているため）
+                    key={category}
                     show={showQuarterSummary}
                     setShow={setShowQuarterSummary}
+                    category={category}
                     targetYear={targetYear}
                     customerList={customerList}
                     shopList={shopList}
diff --git a/frontend/src/components/company/QuarterSummary.tsx b/frontend/src/components/company/QuarterSummary.tsx
index 84a5fb93..58c4c302 100644
--- a/frontend/src/components/company/QuarterSummary.tsx
+++ b/frontend/src/components/company/QuarterSummary.tsx
@@ -8,7 +8,11 @@ import { formattedThisMonth, monthFormate } from './companyUtils';
  * 4半期サマリー（会社実績 → 「4半期サマリー」ボタン）。
  *
  * ─────────────────────────────────────────────
- * ⚠️ 2026-10-05（v2.2.163）新規。⚠️ 注文事業（category === 'order'）だけ。
+ * ⚠️ 2026-10-05（v2.2.163）新規。注文事業（category === 'order'）。
+ * ⚠️ v2.2.210 から建売分譲事業（category === 'spec'）も。⚠️ 事業ごとの違いは下の DIVISIONS に集めた。
+ *   建売 … 実績に仲介の契約（contract_broker）を含め「うち仲介」の行を足す／契約予定は Aランク
+ *          （⚠️ 建売の Sランクは契約済みの意味。Company.tsx の matchesRank の注記）／
+ *          反響は customerTrend（spec）を CustomerTrendKaeru.tsx の getValue と同じ定義で数える
  *
  * ⚠️ 表は2つ。⚠️ どちらも 全店舗 → 課 → 店舗 の順に並べる。
  *   契約実績報告 … 予算・実績・差異・前期実績・昨対比・契約予定
@@ -17,8 +21,8 @@ import { formattedThisMonth, monthFormate } from './companyUtils';
  * ⚠️⚠️ **データの出どころが2つある。**
  *   契約・予算・店舗・課 … ⚠️ **Company.tsx から props で受け取る**（ランキングと同じ）。
  *     ⚠️ 会社実績の画面と**同じ数字**になるよう、契約の判定も Company と揃えてある。
- *   反響 … ⚠️ 既存の `customerTrend`（注文）を**開いたときに1回だけ**取る。
- *     ⚠️ KPI の定義は customerTrend/CustomerTrendOrder.tsx の `getValue` と同じ。
+ *   反響 … ⚠️ 既存の `customerTrend`（注文／建売）を**開いたときに1回だけ**取る。
+ *     ⚠️ KPI の定義は customerTrend/CustomerTrendOrder.tsx（建売は CustomerTrendKaeru.tsx）の `getValue` と同じ。
  *     ⚠️⚠️ **あちらの定義を変えたら、ここ（countKpi）も直すこと。**
  *
  * ⚠️⚠️ **期は Company で選んでいる「〇〇年5月期」に合わせる。**
@@ -37,7 +41,10 @@ type Achievement = { category: string; name: string; period: string; value: stri
 /** 営業（staff_list）。⚠️ 使う列だけ。⚠️ Company で期（period）を絞ってから渡される */
 type Staff = { name: string; shop: string; report: number; status: string };
 
-/** 反響（customerTrend の customer）。⚠️ 使う列だけ */
+/**
+ * 反響（customerTrend の customer）。⚠️ 使う列だけ。
+ * ⚠️ tour〜show_dashboard は建売（spec）にだけある列（注文では undefined）。
+ */
 type Lead = {
     shop: string;
     status: string;
@@ -46,14 +53,44 @@ type Lead = {
     appointment: string;
     screening: string;
     contract: string;
+    tour?: string;
+    obtain?: string;
+    application?: string;
+    contract_broker?: string;
+    show_dashboard?: string | number;
+};
+
+type QuarterCategory = 'order' | 'spec';
+
+/**
+ * 事業ごとの違い（v2.2.210）。
+ * ⚠️ 反響の取り方・数え方（customerTrend の category・countKpi / countKpiSpec）だけは本体で category を見て選ぶ。
+ */
+type DivisionConfig = {
+    /** ⚠️ shop_list / section_list の division */
+    division: string;
+    /** ⚠️ Company の divisionMapping と同じ。⚠️ 顧客の category */
+    customerCategory: string;
+    /** ⚠️ 契約予定に数えるランク（× ランクの予定月 rank_period） */
+    planRank: string;
+    /** ⚠️ 仲介の契約（contract_broker）も実績に数え、「うち仲介」の行を出す */
+    withBroker: boolean;
+};
+
+const DIVISIONS: Record<QuarterCategory, DivisionConfig> = {
+    order: { division: '注文事業', customerCategory: '注文', planRank: 'Sランク', withBroker: false },
+    // ⚠️ 建売の Sランクは「契約済み」の意味（Company.tsx の matchesRank）。⚠️ 予定は Aランクで見る
+    spec: { division: '建売分譲事業', customerCategory: '建売', planRank: 'Aランク', withBroker: true },
 };
 
 type Props = {
     show: boolean;
     setShow: (value: boolean) => void;
+    /** ⚠️ 事業（v2.2.210）。⚠️ Company の category（order / spec）をそのまま渡す */
+    category: QuarterCategory;
     /** ⚠️ 期（〇〇年5月期）。⚠️ Company の targetYear をそのまま渡す */
     targetYear: number | null;
-    /** ⚠️ Company の customerList（注文・建売・中古が混ざっている）。⚠️ ここで注文だけに絞る */
+    /** ⚠️ Company の customerList（注文・建売・中古が混ざっている）。⚠️ ここでその事業だけに絞る */
     customerList: Customer[];
     shopList: Shop[];
     sectionList: Section[];
@@ -65,10 +102,6 @@ type Props = {
     staffList: Staff[];
 };
 
-const DIVISION = '注文事業';
-/** ⚠️ Company の divisionMapping と同じ。⚠️ 顧客の category は「注文」 */
-const CUSTOMER_CATEGORY = '注文';
-
 /** ⚠️ `YYYY-MM`。⚠️ 区切りが `/` でも `-` でも、日付が付いていても揃える */
 const ym = (value: string | undefined | null): string => monthFormate(String(value ?? ''));
 
@@ -139,6 +172,9 @@ type Scope = {
  */
 const isContracted = (c: Customer): boolean => !!c.contract && (c.status === '契約済み' || c.status === '解約');
 
+/** 仲介の契約（建売。v2.2.210）。⚠️ Company.tsx の calculateContractListBroker と同じ判定 */
+const isBrokerContracted = (c: Customer): boolean => !!c.contract_broker && (c.status === '契約済み' || c.status === '解約');
+
 /**
  * 反響の KPI を期間でまとめて数える。
  *
@@ -174,6 +210,41 @@ const countKpi = (leads: Lead[], months: Set<string>) => {
     return { register, interview, appointment, contract };
 };
 
+/**
+ * 反響の KPI（建売。v2.2.210）。
+ *
+ * ⚠️⚠️ **CustomerTrendKaeru.tsx の `getValue` と同じ定義。** ⚠️ あちらを変えたら、ここも直すこと。
+ *   ⚠️ 段の日付が複数あるときは**いちばん古い月**。⚠️ 空なら**先の段のいちばん古い月**で数える。
+ *
+ *   総反響 … 反響日（register）が期間内
+ *   来場   … 初回面談・物件案内（interview・tour）。空なら 2回目面談〜契約・仲介契約
+ *   次アポ … 2回目以降面談（appointment）。空なら 事前審査・事前取得・申込・契約・仲介契約
+ *   契約   … 契約済み かつ 契約・仲介契約のいちばん古い月が期間内（⚠️ 解約は数えない。建売の画面と同じ）
+ */
+const countKpiSpec = (leads: Lead[], months: Set<string>) => {
+    const oldest = (b: Lead, keys: (keyof Lead)[]): string =>
+        keys.map(k => ym(String(b[k] ?? ''))).filter(v => v !== '').sort()[0] ?? '';
+    const reached = (b: Lead, keys: (keyof Lead)[], higher: (keyof Lead)[] = []): boolean => {
+        const own = oldest(b, keys);
+        if (own) return months.has(own);
+        const next = higher.length ? oldest(b, higher) : '';
+        return next !== '' && months.has(next);
+    };
+    const contractKeys: (keyof Lead)[] = ['contract', 'contract_broker'];
+    const afterAppointment: (keyof Lead)[] = ['screening', 'obtain', 'application', ...contractKeys];
+    let register = 0;
+    let interview = 0;
+    let appointment = 0;
+    let contract = 0;
+    for (const b of leads) {
+        if (reached(b, ['register'])) register += 1;
+        if (reached(b, ['interview', 'tour'], ['appointment', ...afterAppointment])) interview += 1;
+        if (reached(b, ['appointment'], afterAppointment)) appointment += 1;
+        if (b.status === '契約済み' && reached(b, contractKeys)) contract += 1;
+    }
+    return { register, interview, appointment, contract };
+};
+
 /** 歩留まり（%）。⚠️ CustomerTrendOrder と同じく**切り捨て**。⚠️ 分母0は null */
 const yieldRate = (count: number, base: number): number | null => (base === 0 ? null : Math.floor((count / base) * 100));
 
@@ -183,7 +254,9 @@ const yieldRate = (count: number, base: number): number | null => (base === 0 ?
  */
 const perHead = (count: number, staff: number): string => (staff === 0 ? '-' : (count / staff).toFixed(1));
 
-const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sectionList, achievement, staffList }: Props) => {
+const QuarterSummary = ({ show, setShow, category, targetYear, customerList, shopList, sectionList, achievement, staffList }: Props) => {
+    const config = DIVISIONS[category];
+    const DIVISION = config.division;
     const [tab, setTab] = useState<'contract' | 'lead'>('contract');
     const [leads, setLeads] = useState<Lead[] | null>(null);
     const [leadError, setLeadError] = useState('');
@@ -206,15 +279,21 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
         if (!show || leads !== null) return;
         const fetchData = async () => {
             try {
-                const res = await apiClient.post('', { request: 'customerTrend', category: 'order' });
-                setLeads((res.data?.customer ?? []) as Lead[]);
+                const res = await apiClient.post('', { request: 'customerTrend', category });
+                const rows = (res.data?.customer ?? []) as Lead[];
+                /**
+                 * ⚠️ 建売の customerTrend は show_dashboard で絞らずに返す（列として返す）。
+                 *   ⚠️ 建売の画面（CustomerTrendKaeru）の既定と同じく、表示対象（1）だけにする。
+                 *   ⚠️ 注文は SQL で絞り済み（列が無い）。
+                 */
+                setLeads(category === 'spec' ? rows.filter(o => Number(o.show_dashboard) === 1) : rows);
             } catch {
                 setLeadError('反響を取得できませんでした。時間をおいて再度お試しください。');
                 setLeads([]);
             }
         };
         void fetchData();
-    }, [show, leads]);
+    }, [show, leads, category]);
 
     const year = targetYear ?? 0;
     const { columns, quarters } = useMemo(() => buildColumns(year), [year]);
@@ -246,7 +325,7 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
             });
         });
         return list;
-    }, [shopList, sectionList]);
+    }, [shopList, sectionList, DIVISION]);
 
     /**
      * 範囲ごとの営業人数（v2.2.164）。
@@ -263,12 +342,12 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
             const shops = scope.shops ?? divisionShops;
             return [scope.id, new Set(active.filter(st => shops.has(st.shop)).map(st => st.name)).size];
         }));
-    }, [staffList, shopList, scopes]);
+    }, [staffList, shopList, scopes, DIVISION]);
 
-    /** ⚠️ 注文の顧客だけ */
-    const orderCustomers = useMemo(
-        () => customerList.filter(c => c.category === CUSTOMER_CATEGORY),
-        [customerList]
+    /** ⚠️ その事業の顧客だけ */
+    const divisionCustomers = useMemo(
+        () => customerList.filter(c => c.category === config.customerCategory),
+        [customerList, config.customerCategory]
     );
 
     /**
@@ -282,22 +361,34 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
             const inScope = (shop: string) => scope.shops === null || scope.shops.has(shop);
             const actual: Record<string, number> = {};
             const lastYear: Record<string, number> = {};
+            /** ⚠️ 仲介の契約（建売だけ）。⚠️ actual・lastYear にも足してある（「うち仲介」の行に使う） */
+            const broker: Record<string, number> = {};
             const plan: Record<string, number> = {};
             const budget: Record<string, number> = {};
+            const add = (record: Record<string, number>, m: string) => { record[m] = (record[m] ?? 0) + 1; };
 
-            for (const c of orderCustomers) {
+            for (const c of divisionCustomers) {
                 if (!inScope(c.shop)) continue;
                 if (isContracted(c)) {
                     const m = ym(c.contract);
-                    if (monthSet.has(m)) actual[m] = (actual[m] ?? 0) + 1;
-                    if (lastYearSet.has(m)) lastYear[m] = (lastYear[m] ?? 0) + 1;
+                    if (monthSet.has(m)) add(actual, m);
+                    if (lastYearSet.has(m)) add(lastYear, m);
+                }
+                /**
+                 * ⚠️ 仲介の契約（v2.2.210・建売）。⚠️ Company の calculateContractListBroker と同じ判定
+                 *   （仲介契約日がある かつ 契約済み／解約）。⚠️ 自社の契約とは**別に**数える（Company と同じ）。
+                 */
+                if (config.withBroker && isBrokerContracted(c)) {
+                    const m = ym(c.contract_broker);
+                    if (monthSet.has(m)) { add(actual, m); add(broker, m); }
+                    if (lastYearSet.has(m)) add(lastYear, m);
                 }
                 /**
-                 * 契約予定。⚠️ Sランク × ランクの予定月（rank_period）。
+                 * 契約予定。⚠️ 注文は Sランク、建売は Aランク × ランクの予定月（rank_period）。
                  * ⚠️ rank は `customized_input_01J82Z5F366ZQ897PXWF6H5ZAM`（company の SQL で別名）。
                  * ⚠️ ⚠️ **使うのは当月以降の月だけ**（当月より前は契約数を出す。下の planOf）。
                  */
-                if (c.rank === 'Sランク') {
+                if (c.rank === config.planRank) {
                     const m = ym(c.rank_period);
                     if (monthSet.has(m)) plan[m] = (plan[m] ?? 0) + 1;
                 }
@@ -307,22 +398,24 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
                 const m = ym(a.period);
                 if (monthSet.has(m)) budget[m] = (budget[m] ?? 0) + Number(a.value || 0);
             }
-            return [scope.id, { actual, lastYear, plan, budget }];
+            return [scope.id, { actual, lastYear, broker, plan, budget }];
         }));
-    }, [scopes, orderCustomers, achievement, allMonths]);
+    }, [scopes, divisionCustomers, achievement, allMonths, config.withBroker, config.planRank]);
 
     /** 反響の KPI（範囲 × 列）。⚠️ 列ごとに期間でまとめて数える（countKpi の注記参照） */
     const leadStats = useMemo(() => {
         if (leads === null) return null;
         const monthSet = new Set(allMonths);
-        // ⚠️ 期のどの日付にも掛からない顧客は先に落とす（⚠️ 全件を列の数だけ舐めないため）
+        const count = category === 'spec' ? countKpiSpec : countKpi;
+        // ⚠️ 期のどの日付にも掛からない顧客は先に落とす（⚠️ 全件を列の数だけ舐めないため）。⚠️ 建売だけの列も見る
         const relevant = leads.filter(b =>
-            [b.register, b.interview, b.appointment, b.screening, b.contract].some(v => monthSet.has(ym(v))));
+            [b.register, b.interview, b.tour, b.appointment, b.screening, b.obtain, b.application, b.contract, b.contract_broker]
+                .some(v => monthSet.has(ym(v))));
         return new Map(scopes.map(scope => {
             const own = relevant.filter(b => scope.shops === null || scope.shops.has(b.shop));
-            return [scope.id, new Map(columns.map(col => [col.key, countKpi(own, new Set(col.months))]))];
+            return [scope.id, new Map(columns.map(col => [col.key, count(own, new Set(col.months))]))];
         }));
-    }, [leads, scopes, columns, allMonths]);
+    }, [leads, scopes, columns, allMonths, category]);
 
     const sum = (record: Record<string, number>, months: string[]) =>
         months.reduce((acc, m) => acc + (record[m] ?? 0), 0);
@@ -400,7 +493,7 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
         if (!s) return null;
 
         /**
-         * ⚠️ 契約予定: ⚠️ **当月より前は契約数をそのまま**、当月以降は Sランクの数（v2.2.164）。
+         * ⚠️ 契約予定: ⚠️ **当月より前は契約数をそのまま**、当月以降は Sランク（建売は Aランク）の数（v2.2.164）。
          * ⚠️ v2.2.163 までは当月も契約数だった（`m > THIS_MONTH`）。⚠️ 当月は月の途中なので予定（Sランク）で見る。
          */
         const planOf = (months: string[]) =>
@@ -409,6 +502,10 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
         const rows: { key: string; label: string; group?: boolean; tone: string; value: (col: Column) => React.ReactNode }[] = [
             { key: 'budget', label: '今期予算', tone: 'budget', value: col => num(sum(s.budget, col.months)) },
             { key: 'actual', label: '実績', group: true, tone: 'actual', value: col => num(sum(s.actual, col.months)) },
+            // ⚠️ 建売だけ（v2.2.210）。⚠️ 実績には含めてある。⚠️ 会社実績の「(1)」と同じ数
+            ...(config.withBroker
+                ? [{ key: 'broker', label: 'うち仲介', group: true, tone: 'broker', value: (col: Column) => num(sum(s.broker, col.months)) }]
+                : []),
             {
                 key: 'diff', label: '差異(達成率)', group: true, tone: 'plain',
                 value: col => {
@@ -645,6 +742,8 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
                     .qs_tone_budget .qs_num { color: #b91c1c; }
                     .qs_tone_actual .qs_num { color: #1d4ed8; font-weight: 700; }
                     .qs_tone_plan .qs_num { color: #047857; }
+                    /* ⚠️ 建売の「うち仲介」（v2.2.210）。⚠️ 実績の内訳なので小さく薄く */
+                    .qs_tone_broker .qs_num { color: #6b7280; font-size: 11px; }
                     .qs_pos { color: #047857; font-weight: 700; }
                     .qs_neg { color: #b91c1c; font-weight: 700; }
                     .qs_rate { font-size: 10px; color: #6b7280; line-height: 1.1; }
@@ -728,10 +827,13 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
                     {tab === 'contract' ? <>
                         ※ 差異は「実績 − 予算」、下段の％は達成率（実績 ÷ 予算、切り捨て）です。まだ来ていない月は「-」です。合計列は期間の実績合計と予算合計から計算しています。<br />
                         ※ 昨対比は、合計列では<b>すでに過ぎた月だけ</b>で今期と前期を比べています（途中の四半期が低く見えないように）。<br />
-                        ※ 契約予定は、当月より前の月は契約数をそのまま、当月以降は「Sランク × ランク予定月」の人数です。<br />
+                        ※ 契約予定は、当月より前の月は契約数をそのまま、当月以降は「{config.planRank} × ランク予定月」の人数です。<br />
+                        {config.withBroker && <>※ 実績には仲介の契約（仲介契約日）を含みます。「うち仲介」はその数です（会社実績のかっこ内と同じ）。<br /></>}
                         ※ 店舗の行に FH は出していませんが、課・全店舗の数には含まれます（会社実績と同じ）。
                     </> : <>
-                        ※ 来場は実来場（初回面談、初回面談が空なら2回目以降の面談・事前審査・契約）で数えています。<br />
+                        {category === 'spec'
+                            ? <>※ 来場は初回面談・物件案内、次アポは2回目以降面談、契約は契約・仲介契約（契約済み）で数えています。日付が空のときは先の段の日付で数えます（販促媒体別反響推移（建売）と同じ）。<br /></>
+                            : <>※ 来場は実来場（初回面談、初回面談が空なら2回目以降の面談・事前審査・契約）で数えています。<br /></>}
                         ※ 合計列は期間でまとめて数えています（同じお客様を二重に数えません）。歩留まりは合計した件数から計算しています。<br />
                         ※ 反響PH・来場PH は、総反響・来場を営業人数で割った1人あたりの数です。営業人数は {targetYear}年5月期のスタッフ一覧で全社報告に出している在籍者です（課・全店舗は併売スタッフを1人として数えます）。
                     </>}
```
