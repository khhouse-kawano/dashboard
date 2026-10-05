# 2026-10-05-08　4半期サマリーに達成率・反響PH・来場PHを追加（v2.2.164）

## 依頼（ReadMeClaude.md）

- `QuarterSummary.tsx` の修正（⚠️ 新しい版 v2.2.164 で着手）
  - tab === 'contract'：**差異** → **差異(達成率)**。⚠️ 差異の行に「達成率%」（実績÷予算）も出す
  - tab === 'lead'：契約の下に「営業 {staffLength}名（row=2）｜反響PH｜各列の総反響 ÷ staffLength」「来場PH｜各列の来場 ÷ staffLength」
    - staffLength = 各範囲（section, shop）に所属する staff_list の report = 1 の数
  - 縦に広がりすぎるため、⚠️ 文字の上下の余白は最低限でよい

## 確認したこと（ユーザーの回答）

| 質問 | 回答 |
|---|---|
| 営業人数に退職者を含めるか | ⚠️ **含めない（在籍のみ）** |
| 計画どおり着手してよいか | 着手してよい |

## 版の準備

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/utils/` | **version.ts** | `'2.2.164'` |
| `backend/scripts/sql/` | **2026-10-05_update_log_2.2.164.sql**（新規） | update_log に1行。⚠️ ローカルDBにも投入済み（no=260） |
| — | ブランチ | ⚠️ `v2.2.163` から `v2.2.164` を作成（⚠️ v2.2.163 は main に未マージのため、その上に積む） |

## 変更したファイル

| ディレクトリ | ファイル | 追加・変更 |
|---|---|---|
| `frontend/src/components/company/` | **QuarterSummary.tsx** | 型 `Staff`、props `staffList`、関数 `perHead`（新規）、`staffCount`（新規 useMemo）、`contractRows` の差異の行、`leadRows`（2行追加）、CSS、注記 |
| `frontend/src/components/company/` | **Company.tsx** | `<QuarterSummary staffList={staffList} />` を渡すだけ |
| `docs/` | **deploy-v2.2.164.md**（新規） | デプロイ手順（⚠️ ① フロント＋SQL だけ） |

## 判断したこと

- ⚠️ **営業人数は Company が持つ `staffList` を使う**（⚠️ `company` API の staff を「〇〇年5月期」の period で絞ったもの）。API は増やしていない。
- ⚠️ **課・全店舗は氏名で重複を除く。** ⚠️ 併売スタッフは staff_list に店舗ごとの行がある（⚠️ 2027年5月期の注文事業で23名）。店舗の行ではその店舗の1人として数える。
- ⚠️ 「営業 n名（row=2）」は、⚠️ 契約実績の「今期実績」と同じく **項目の列の小さな見出し**にした。⚠️ 列を足すと、左に固定している2列（sticky）の位置がずれるため。
- 達成率は ⚠️ **切り捨て**（歩留まりと同じ）。⚠️ 予算0は「—」。⚠️ 差異と同じ月の実績・予算で計算する。
- PH は ⚠️ **小数第1位**。⚠️ 合計列は「期間の件数 ÷ 人数」（⚠️ 月ごとの PH の和ではない）。⚠️ 営業0名は「-」。

## 動作確認

| 確認 | 結果 |
|---|---|
| `npm run build` | ⚠️ 成功（`main.0ef48dc1.js`）。⚠️ 今回の変更箇所に警告なし（⚠️ Company.tsx の既存警告のみ） |
| 営業人数（2027年5月期・在籍・report=1）を SQL で数えた値 | 全店舗 97 / 佐賀・久留米 9 / 大分 6 / 宮崎 20 / 熊本 18 / 鹿児島1課 12 / 鹿児島2課 18 / 鹿児島3課 18 |
| ⚠️ 画面での表示 | ⚠️ **未確認**（⚠️ ブラウザでの目視はしていない） |

⚠️ 課の合計（101）が全店舗（97）より多いのは、⚠️ 課をまたぐ併売スタッフがいるため（⚠️ 全店舗では1人にまとめる）。

## 追加・変更した関数（全文）

### 型・props
```tsx
/** 営業（staff_list）。⚠️ 使う列だけ。⚠️ Company で期（period）を絞ってから渡される */
type Staff = { name: string; shop: string; report: number; status: string };

    /**
     * ⚠️ Company の staffList（⚠️ 選んでいる「〇〇年5月期」の period で絞り済み）。
     * ⚠️ 反響PH・来場PH の分母（営業人数）に使う（v2.2.164）。
     */
    staffList: Staff[];

const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sectionList, achievement, staffList }: Props) => {
```

### perHead（新規）
```tsx
/**
 * 1人あたり（PH = per head）。⚠️ 小数第1位まで（⚠️ 四捨五入）。⚠️ 営業0名は「-」
 * ⚠️ 合計列も「その期間の件数 ÷ 人数」（⚠️ 月ごとの PH を足したものではない）。
 */
const perHead = (count: number, staff: number): string => (staff === 0 ? '-' : (count / staff).toFixed(1));
```

### staffCount（新規）
```tsx
    /**
     * 範囲ごとの営業人数（v2.2.164）。
     *
     * ⚠️ 数えるのは `report = 1`（全社報告に出す人）かつ ⚠️ **在籍**（2026-10-05 の確認で退職は除く）。
     * ⚠️⚠️ **課・全店舗は氏名で重複を除く。**
     *   ⚠️ 併売スタッフ（例: DJH鹿屋店 と KH鹿屋店）は staff_list に店舗ごとに1行ずつある。
     *   ⚠️ 店舗の行ではその店舗の1人として数え、⚠️ 課・全店舗では1人にまとめる。
     */
    const staffCount = useMemo(() => {
        const active = staffList.filter(st => st.report === 1 && st.status !== '退職');
        const divisionShops = new Set(shopList.filter(s => s.division === DIVISION).map(s => s.shop));
        return new Map(scopes.map(scope => {
            const shops = scope.shops ?? divisionShops;
            return [scope.id, new Set(active.filter(st => shops.has(st.shop)).map(st => st.name)).size];
        }));
    }, [staffList, shopList, scopes]);
```

### contractRows（変更：差異の行）
```tsx
    const contractRows = (scope: Scope) => {
        const s = contractStats.get(scope.id);
        if (!s) return null;

        /** ⚠️ 契約予定: 来月以降は Sランクの数、今月以前は契約数 */
        const planOf = (months: string[]) =>
            months.reduce((acc, m) => acc + (m > THIS_MONTH ? (s.plan[m] ?? 0) : (s.actual[m] ?? 0)), 0);

        const rows: { key: string; label: string; group?: boolean; tone: string; value: (col: Column) => React.ReactNode }[] = [
            { key: 'budget', label: '今期予算', tone: 'budget', value: col => num(sum(s.budget, col.months)) },
            { key: 'actual', label: '実績', group: true, tone: 'actual', value: col => num(sum(s.actual, col.months)) },
            {
                key: 'diff', label: '差異(達成率)', group: true, tone: 'plain',
                value: col => {
                    // ⚠️ 期間がすべて未来の月なら「-」（⚠️ 2026-10-05 の指示）
                    if (elapsedOf(col.months).length === 0) return '-';
                    const actual = sum(s.actual, col.months);
                    const budget = sum(s.budget, col.months);
                    const diff = actual - budget;
                    /**
                     * ⚠️ 達成率 = 実績 ÷ 予算（v2.2.164）。⚠️ 歩留まりと同じく**切り捨て**。⚠️ 予算0は「—」
                     * ⚠️ 分母・分子は差異と**同じ月**で取る（⚠️ 差異と達成率の向きが食い違わないように）。
                     */
                    const rate = yieldRate(actual, budget);
                    return <>
                        <span className={diff > 0 ? 'qs_pos' : diff < 0 ? 'qs_neg' : ''}>{diff > 0 ? `+${diff}` : diff}</span>
                        <div className={`qs_rate${rate === null ? '' : rate >= 100 ? ' qs_pos' : ' qs_neg'}`}>
                            {rate === null ? '—' : `${rate}%`}
                        </div>
                    </>;
                },
            },
            { key: 'last', label: '前期実績', group: true, tone: 'plain', value: col => num(sum(s.lastYear, col.months.map(lastYearOf))) },
            {
                key: 'yoy', label: '昨対比', group: true, tone: 'plain',
                value: col => {
                    /**
                     * ⚠️⚠️ **過ぎた月だけで比べる。**
                     *   ⚠️ 途中の四半期を前期の3か月分と比べると、⚠️ **実際より低く見える。**
                     */
                    const elapsed = elapsedOf(col.months);
                    if (elapsed.length === 0) return '-';
                    const now = sum(s.actual, elapsed);
                    const before = sum(s.lastYear, elapsed.map(lastYearOf));
                    if (before === 0) return '-';
                    const pct = Math.round((now / before) * 100);
                    return <span className={pct >= 100 ? 'qs_pos' : 'qs_neg'}>{pct}%</span>;
                },
            },
            { key: 'plan', label: '契約予定', tone: 'plan', value: col => num(planOf(col.months)) },
        ];

        return rows.map((row, index) => (
            <tr key={`${scope.id}-${row.key}`} className={`qs_row qs_tone_${row.tone}${index === 0 ? ' qs_block_top' : ''}`}>
                {index === 0 && scopeCell(scope, rows.length, 'contract')}
                <td className={`qs_td qs_item${row.group ? ' qs_item_group' : ''}`}>
                    {/* ⚠️ 実績〜昨対比の4行が「今期実績」のまとまり（⚠️ 指示書の rowSpan=4） */}
                    {row.key === 'actual' && <span className="qs_group_tag">今期実績</span>}
                    {row.label}
                </td>
                {columns.map(col => <td key={col.key} className={cellClass(col)}>{row.value(col)}</td>)}
            </tr>
        ));
    };
```

### leadRows（変更：反響PH・来場PH）
```tsx
    const leadRows = (scope: Scope) => {
        const byCol = leadStats?.get(scope.id);
        if (!byCol) return null;
        const staff = staffCount.get(scope.id) ?? 0;

        const rate = (value: number | null) =>
            <div className="qs_rate">{value === null ? '—' : `${value}%`}</div>;

        const rows: { key: string; label: string; note?: string; group?: string; value: (col: Column) => React.ReactNode }[] = [
            { key: 'register', label: '総反響', value: col => num(byCol.get(col.key)?.register ?? 0) },
            {
                key: 'interview', label: '来場', note: '実来場 ÷ 総反響',
                value: col => {
                    const k = byCol.get(col.key);
                    return <>{num(k?.interview ?? 0)}{rate(yieldRate(k?.interview ?? 0, k?.register ?? 0))}</>;
                },
            },
            {
                key: 'appointment', label: '次アポ', note: '次アポ ÷ 実来場',
                value: col => {
                    const k = byCol.get(col.key);
                    return <>{num(k?.appointment ?? 0)}{rate(yieldRate(k?.appointment ?? 0, k?.interview ?? 0))}</>;
                },
            },
            {
                key: 'contract', label: '契約', note: '契約 ÷ 実来場',
                value: col => {
                    const k = byCol.get(col.key);
                    return <>{num(k?.contract ?? 0)}{rate(yieldRate(k?.contract ?? 0, k?.interview ?? 0))}</>;
                },
            },
            /**
             * ⚠️ 1人あたり（v2.2.164）。⚠️ 指示書の「営業 {staffLength}名 row={2}」は、
             *   ⚠️ 契約実績の「今期実績」と同じく ⚠️ **項目の列の小さな見出し**にした
             *   （⚠️ 列を足すと、左に固定している2列の位置がずれるため）。
             */
            {
                key: 'register_ph', label: '反響PH', note: '総反響 ÷ 営業人数', group: `営業 ${staff}名`,
                value: col => perHead(byCol.get(col.key)?.register ?? 0, staff),
            },
            {
                key: 'interview_ph', label: '来場PH', note: '来場 ÷ 営業人数', group: '',
                value: col => perHead(byCol.get(col.key)?.interview ?? 0, staff),
            },
        ];

        return rows.map((row, index) => (
            <tr key={`${scope.id}-${row.key}`}
                className={`qs_row${index === 0 ? ' qs_block_top' : ''}${row.group !== undefined ? ' qs_tone_ph' : ''}${row.group ? ' qs_ph_top' : ''}`}>
                {index === 0 && scopeCell(scope, rows.length, 'lead')}
                <td className={`qs_td qs_item${row.group !== undefined ? ' qs_item_group' : ''}`} title={row.note}>
                    {row.group && <span className="qs_group_tag">{row.group}</span>}
                    {row.label}
                    {row.note && <div className="qs_item_note">{row.note}</div>}
                </td>
                {columns.map(col => <td key={col.key} className={cellClass(col)}>{row.value(col)}</td>)}
            </tr>
        ));
    };
```

### CSS（変更・追加した行）
```css
                className={`qs_row${index === 0 ? ' qs_block_top' : ''}${row.group !== undefined ? ' qs_tone_ph' : ''}${row.group ? ' qs_ph_top' : ''}`}>
                    /* ⚠️ v2.2.164: 縦に伸びすぎるため ⚠️ 上下の余白は最小限（6px → 2px、行間 1.25） */
                    .qs_td { padding: 2px 8px; line-height: 1.25; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9;
                    .qs_group_tag { display: block; font-size: 9px; font-weight: 700; color: #1d4ed8; letter-spacing: .04em;
                                    margin-left: -10px; line-height: 1.1; }
                    .qs_item_note { font-size: 9px; font-weight: 500; color: #9ca3af; line-height: 1.1; }
                    .qs_rate { font-size: 10px; color: #6b7280; line-height: 1.1; }
                    .qs_rate.qs_pos, .qs_rate.qs_neg { font-weight: 600; }
                    /* ⚠️ 反響PH・来場PH（v2.2.164）。⚠️ 件数の行と見分けるため地色を変え、上に区切り線 */
                    .qs_tone_ph > .qs_td:not(.qs_scope) { background: #fbfaf5; }
                    .qs_tone_ph .qs_num { color: #92400e; }
                    .qs_ph_top > .qs_td:not(.qs_scope) { border-top: 1px dashed #e5e7eb; }
```

### Company.tsx（変更）
```tsx
                        </tbody>
                    </Table>
                </div>
            </div>
            <CustomerDetail show={show} setShow={setShow} contract={contract} setEditId={setEditId} />
            <InformationEdit id={editId.order} token={token} onClose={informationEditClose} authority={authority} />
            <InformationEditKaeru id={editId.kaeru} token={token} onClose={informationEditClose} authority={authority} />
            <InformationEditResale id={editId.resale} token={token} onClose={informationEditClose} authority={authority} />
            <Ranking showRanking={showRanking} setShowRanking={setShowRanking} customerList={customerList} monthArray={monthArray} staffList={staffList} achievement={achievement}/>
            {category === 'order' &&
                <QuarterSummary
                    show={showQuarterSummary}
                    setShow={setShowQuarterSummary}
                    targetYear={targetYear}
                    customerList={customerList}
                    shopList={shopList}
                    sectionList={sectionList}
                    achievement={achievement}
                    staffList={staffList}
                />}
```

## 差分（QuarterSummary.tsx）
```diff
diff --git a/frontend/src/components/company/QuarterSummary.tsx b/frontend/src/components/company/QuarterSummary.tsx
index 79b16555..2d6e858f 100644
--- a/frontend/src/components/company/QuarterSummary.tsx
+++ b/frontend/src/components/company/QuarterSummary.tsx
@@ -34,6 +34,8 @@ type Customer = Record<string, string>;
 type Shop = { brand: string; shop: string; section: string; division: string };
 type Section = { name: string; division: string };
 type Achievement = { category: string; name: string; period: string; value: string };
+/** 営業（staff_list）。⚠️ 使う列だけ。⚠️ Company で期（period）を絞ってから渡される */
+type Staff = { name: string; shop: string; report: number; status: string };
 
 /** 反響（customerTrend の customer）。⚠️ 使う列だけ */
 type Lead = {
@@ -56,6 +58,11 @@ type Props = {
     shopList: Shop[];
     sectionList: Section[];
     achievement: Achievement[];
+    /**
+     * ⚠️ Company の staffList（⚠️ 選んでいる「〇〇年5月期」の period で絞り済み）。
+     * ⚠️ 反響PH・来場PH の分母（営業人数）に使う（v2.2.164）。
+     */
+    staffList: Staff[];
 };
 
 const DIVISION = '注文事業';
@@ -170,7 +177,13 @@ const countKpi = (leads: Lead[], months: Set<string>) => {
 /** 歩留まり（%）。⚠️ CustomerTrendOrder と同じく**切り捨て**。⚠️ 分母0は null */
 const yieldRate = (count: number, base: number): number | null => (base === 0 ? null : Math.floor((count / base) * 100));
 
-const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sectionList, achievement }: Props) => {
+/**
+ * 1人あたり（PH = per head）。⚠️ 小数第1位まで（⚠️ 四捨五入）。⚠️ 営業0名は「-」
+ * ⚠️ 合計列も「その期間の件数 ÷ 人数」（⚠️ 月ごとの PH を足したものではない）。
+ */
+const perHead = (count: number, staff: number): string => (staff === 0 ? '-' : (count / staff).toFixed(1));
+
+const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sectionList, achievement, staffList }: Props) => {
     const [tab, setTab] = useState<'contract' | 'lead'>('contract');
     const [leads, setLeads] = useState<Lead[] | null>(null);
     const [leadError, setLeadError] = useState('');
@@ -235,6 +248,23 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
         return list;
     }, [shopList, sectionList]);
 
+    /**
+     * 範囲ごとの営業人数（v2.2.164）。
+     *
+     * ⚠️ 数えるのは `report = 1`（全社報告に出す人）かつ ⚠️ **在籍**（2026-10-05 の確認で退職は除く）。
+     * ⚠️⚠️ **課・全店舗は氏名で重複を除く。**
+     *   ⚠️ 併売スタッフ（例: DJH鹿屋店 と KH鹿屋店）は staff_list に店舗ごとに1行ずつある。
+     *   ⚠️ 店舗の行ではその店舗の1人として数え、⚠️ 課・全店舗では1人にまとめる。
+     */
+    const staffCount = useMemo(() => {
+        const active = staffList.filter(st => st.report === 1 && st.status !== '退職');
+        const divisionShops = new Set(shopList.filter(s => s.division === DIVISION).map(s => s.shop));
+        return new Map(scopes.map(scope => {
+            const shops = scope.shops ?? divisionShops;
+            return [scope.id, new Set(active.filter(st => shops.has(st.shop)).map(st => st.name)).size];
+        }));
+    }, [staffList, shopList, scopes]);
+
     /** ⚠️ 注文の顧客だけ */
     const orderCustomers = useMemo(
         () => customerList.filter(c => c.category === CUSTOMER_CATEGORY),
@@ -377,12 +407,24 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
             { key: 'budget', label: '今期予算', tone: 'budget', value: col => num(sum(s.budget, col.months)) },
             { key: 'actual', label: '実績', group: true, tone: 'actual', value: col => num(sum(s.actual, col.months)) },
             {
-                key: 'diff', label: '差異', group: true, tone: 'plain',
+                key: 'diff', label: '差異(達成率)', group: true, tone: 'plain',
                 value: col => {
                     // ⚠️ 期間がすべて未来の月なら「-」（⚠️ 2026-10-05 の指示）
                     if (elapsedOf(col.months).length === 0) return '-';
-                    const diff = sum(s.actual, col.months) - sum(s.budget, col.months);
-                    return <span className={diff > 0 ? 'qs_pos' : diff < 0 ? 'qs_neg' : ''}>{diff > 0 ? `+${diff}` : diff}</span>;
+                    const actual = sum(s.actual, col.months);
+                    const budget = sum(s.budget, col.months);
+                    const diff = actual - budget;
+                    /**
+                     * ⚠️ 達成率 = 実績 ÷ 予算（v2.2.164）。⚠️ 歩留まりと同じく**切り捨て**。⚠️ 予算0は「—」
+                     * ⚠️ 分母・分子は差異と**同じ月**で取る（⚠️ 差異と達成率の向きが食い違わないように）。
+                     */
+                    const rate = yieldRate(actual, budget);
+                    return <>
+                        <span className={diff > 0 ? 'qs_pos' : diff < 0 ? 'qs_neg' : ''}>{diff > 0 ? `+${diff}` : diff}</span>
+                        <div className={`qs_rate${rate === null ? '' : rate >= 100 ? ' qs_pos' : ' qs_neg'}`}>
+                            {rate === null ? '—' : `${rate}%`}
+                        </div>
+                    </>;
                 },
             },
             { key: 'last', label: '前期実績', group: true, tone: 'plain', value: col => num(sum(s.lastYear, col.months.map(lastYearOf))) },
@@ -424,11 +466,12 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
     const leadRows = (scope: Scope) => {
         const byCol = leadStats?.get(scope.id);
         if (!byCol) return null;
+        const staff = staffCount.get(scope.id) ?? 0;
 
         const rate = (value: number | null) =>
             <div className="qs_rate">{value === null ? '—' : `${value}%`}</div>;
 
-        const rows: { key: string; label: string; note?: string; value: (col: Column) => React.ReactNode }[] = [
+        const rows: { key: string; label: string; note?: string; group?: string; value: (col: Column) => React.ReactNode }[] = [
             { key: 'register', label: '総反響', value: col => num(byCol.get(col.key)?.register ?? 0) },
             {
                 key: 'interview', label: '来場', note: '実来場 ÷ 総反響',
@@ -451,12 +494,27 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
                     return <>{num(k?.contract ?? 0)}{rate(yieldRate(k?.contract ?? 0, k?.interview ?? 0))}</>;
                 },
             },
+            /**
+             * ⚠️ 1人あたり（v2.2.164）。⚠️ 指示書の「営業 {staffLength}名 row={2}」は、
+             *   ⚠️ 契約実績の「今期実績」と同じく ⚠️ **項目の列の小さな見出し**にした
+             *   （⚠️ 列を足すと、左に固定している2列の位置がずれるため）。
+             */
+            {
+                key: 'register_ph', label: '反響PH', note: '総反響 ÷ 営業人数', group: `営業 ${staff}名`,
+                value: col => perHead(byCol.get(col.key)?.register ?? 0, staff),
+            },
+            {
+                key: 'interview_ph', label: '来場PH', note: '来場 ÷ 営業人数', group: '',
+                value: col => perHead(byCol.get(col.key)?.interview ?? 0, staff),
+            },
         ];
 
         return rows.map((row, index) => (
-            <tr key={`${scope.id}-${row.key}`} className={`qs_row${index === 0 ? ' qs_block_top' : ''}`}>
+            <tr key={`${scope.id}-${row.key}`}
+                className={`qs_row${index === 0 ? ' qs_block_top' : ''}${row.group !== undefined ? ' qs_tone_ph' : ''}${row.group ? ' qs_ph_top' : ''}`}>
                 {index === 0 && scopeCell(scope, rows.length, 'lead')}
-                <td className="qs_td qs_item" title={row.note}>
+                <td className={`qs_td qs_item${row.group !== undefined ? ' qs_item_group' : ''}`} title={row.note}>
+                    {row.group && <span className="qs_group_tag">{row.group}</span>}
                     {row.label}
                     {row.note && <div className="qs_item_note">{row.note}</div>}
                 </td>
@@ -549,7 +607,8 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
                     .qs_th_year { background: #1e3a8a; color: #fff; }
                     .qs_th_month.is_now { color: #1d4ed8; box-shadow: inset 0 -2px 0 #2563eb; }
 
-                    .qs_td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9;
+                    /* ⚠️ v2.2.164: 縦に伸びすぎるため ⚠️ 上下の余白は最小限（6px → 2px、行間 1.25） */
+                    .qs_td { padding: 2px 8px; line-height: 1.25; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9;
                              white-space: nowrap; vertical-align: middle; background: #fff; }
                     .qs_num { text-align: right; font-variant-numeric: tabular-nums; min-width: 58px; }
                     .qs_col_quarter { background: #f5f7ff; font-weight: 700; }
@@ -562,8 +621,8 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
                                border-right: 1px solid #e5e7eb; }
                     .qs_item_group { padding-left: 18px; color: #4b5563; font-weight: 500; }
                     .qs_group_tag { display: block; font-size: 9px; font-weight: 700; color: #1d4ed8; letter-spacing: .04em;
-                                    margin-left: -10px; margin-bottom: 1px; }
-                    .qs_item_note { font-size: 9px; font-weight: 500; color: #9ca3af; }
+                                    margin-left: -10px; line-height: 1.1; }
+                    .qs_item_note { font-size: 9px; font-weight: 500; color: #9ca3af; line-height: 1.1; }
                     .qs_scope_name { font-weight: 700; font-size: 12px; white-space: normal; line-height: 1.3; }
                     .qs_scope_sub { font-size: 10px; color: #6b7280; margin-top: 2px; white-space: normal; }
                     .qs_scope_division { background: #1f2937; color: #f9fafb; }
@@ -585,7 +644,12 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
                     .qs_tone_plan .qs_num { color: #047857; }
                     .qs_pos { color: #047857; font-weight: 700; }
                     .qs_neg { color: #b91c1c; font-weight: 700; }
-                    .qs_rate { font-size: 10px; color: #6b7280; }
+                    .qs_rate { font-size: 10px; color: #6b7280; line-height: 1.1; }
+                    .qs_rate.qs_pos, .qs_rate.qs_neg { font-weight: 600; }
+                    /* ⚠️ 反響PH・来場PH（v2.2.164）。⚠️ 件数の行と見分けるため地色を変え、上に区切り線 */
+                    .qs_tone_ph > .qs_td:not(.qs_scope) { background: #fbfaf5; }
+                    .qs_tone_ph .qs_num { color: #92400e; }
+                    .qs_ph_top > .qs_td:not(.qs_scope) { border-top: 1px dashed #e5e7eb; }
                     .qs_row:hover > .qs_td:not(.qs_scope) { background: #f8fafc; }
 
                     .qs_note { font-size: 11px; color: #6b7280; line-height: 1.8; margin-top: 10px; }
@@ -659,13 +723,14 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
 
                 <div className="qs_note">
                     {tab === 'contract' ? <>
-                        ※ 差異は「実績 − 予算」。まだ来ていない月は「-」です。合計列は期間の実績合計 − 予算合計です。<br />
+                        ※ 差異は「実績 − 予算」、下段の％は達成率（実績 ÷ 予算、切り捨て）です。まだ来ていない月は「-」です。合計列は期間の実績合計と予算合計から計算しています。<br />
                         ※ 昨対比は、合計列では<b>すでに過ぎた月だけ</b>で今期と前期を比べています（途中の四半期が低く見えないように）。<br />
                         ※ 契約予定は、来月以降は「Sランク × ランク予定月」の人数、今月以前は契約数です。<br />
                         ※ 店舗の行に FH は出していませんが、課・全店舗の数には含まれます（会社実績と同じ）。
                     </> : <>
                         ※ 来場は実来場（初回面談、初回面談が空なら2回目以降の面談・事前審査・契約）で数えています。<br />
-                        ※ 合計列は期間でまとめて数えています（同じお客様を二重に数えません）。歩留まりは合計した件数から計算しています。
+                        ※ 合計列は期間でまとめて数えています（同じお客様を二重に数えません）。歩留まりは合計した件数から計算しています。<br />
+                        ※ 反響PH・来場PH は、総反響・来場を営業人数で割った1人あたりの数です。営業人数は {targetYear}年5月期のスタッフ一覧で全社報告に出している在籍者です（課・全店舗は併売スタッフを1人として数えます）。
                     </>}
                 </div>
             </Modal.Body>
```
