# 作業記録 2026-11-10-04　v2.2.261　セキュリティログの要注意 IP の開閉・集客サマリーの総予算

## 依頼（ReadMeClaude.md）
- **`header/system/SecurityLog.tsx`**：要注意の IP の札で画面の上が埋まる（スクリーンショットでは54個）。はじめは10個ほどに限り、クリックで開閉する。state とレンダリングを直す。
- **`header/event/EventSummary.tsx`**
  - 表の「反響数」の右に「**総予算**」を足す。
  - イベント名と突き合わせて一致した予算の合計を、**クリックできる**形で出す。
  - クリックで md サイズのモーダルを開き、予算の明細を出す。
- 計画を出し、利用者の了承（「着手してよい」）を得てから着手した。

## 変えたもの
| 区分 | ファイル | 内容 |
|---|---|---|
| 画面 | `frontend/src/components/header/system/SecurityLog.tsx` | `FLAG_LIMIT = 10`、`flaggedIps` を大事な順に並べる（useMemo）、`showAllFlags`（state。読み直したら閉じる）、`shownIps`、「残り N件を表示 ▼／閉じる ▲」ボタン（`sl_more`） |
| 画面 | `frontend/src/components/header/event/EventSummary.tsx` | 型 `EventBudget`、並べ替えの `'budget'`、state（`budgetOf`・`budgets`・`budgetError`）、`openBudget`、反響数の右の「総予算」の見出しとセル（`styles.budgetLink`）、明細のモーダル（size の指定なし＝md・centered） |
| ② | `backend-express/src/features/eventSummary.ts` | `EventBudgetRow`・`runEventSummaryBudget`（`TRIM(note) = title` の完全一致。BUDGET_SQL と同じ条件） |
| ② | `backend-express/src/gateway/registry.ts` | `event_summary:budget`（auth staff） |
| 画面 | `frontend/src/utils/version.ts` | 2.2.261 |
| ① DB | `backend/scripts/sql/2026-11-10_update_log_2.2.261.sql`（**新規**） | 更新履歴＋業務ガイド2本。⚠️ 表の変更なし |
| 記事 | `common/screen-199.md`（**新規**）・`common/screen-195.md` | 下の「業務ガイド」 |

- ① の `express_proxy.php` は変えていない。`event_summary` は request の単位で ② へ転送しているので、新しい roll も届く（① 経由でトークン無しなら 401 になることを確かめた）。

### 決めたこと
- **要注意の IP の並び順**
  - 理由に「User-Agent」以外（1分に失敗・5分にログイン失敗・1時間に存在しない処理）を含む IP を先にする。同じなら、理由の多い順、IP の順。
  - スクリーンショットの54個の大半は「ツールの User-Agent」だけなので、先頭の10個に本当に危ないものが来るようにした。
- KPI の「要注意の IP」の数と「要注意の IP だけ」の絞り込みは、今までどおり全件で数える。
- **総予算の値は、今までの広告費の集計（`rows[].budget`）をそのまま出す**。明細も同じ条件（完全一致）なので、表と明細の合計は必ず一致する。
  - 部分一致にしない理由は、`BUDGET_SQL` の注記（2026-09-09 の決定）。
- 0円は「-」で、押せない。マイナスは赤。見出しで並べ替えられる（はじめは多い順）。
- モーダルの列：期間・店舗・媒体（下に請求先／詳細）・金額、最後に合計。明細が多くても、60vh で中だけスクロールする。

## 業務ガイド
- **新規**「集客サマリー」（common/screen-199）
  - 見方、1件あたりの広告費の色、総予算と明細（完全一致・マイナスの意味）、顧客の一覧。
  - 注意：総予算が出ないときは、広告費の「詳細」をイベント名と同じにする。
  - 以前は、この画面の記事が無かった（`GUIDE_SCREENS` には登録済み）。
- 「セキュリティログ」（common/screen-195）：札ははじめ10個・大事な順・「残り N件を表示」で開く、を足した。

## テスト（`scratchpad/pw_261.cjs`）：**13項目 OK**
- API（① 経由）
  - トークン無しの `event_summary:budget` は 401。イベント名が空なら 400。
  - **総予算と明細の合計が、総予算のある全イベント（12件）で一致**した。
- セキュリティログ（Playwright・3100）
  - テスト用の IP（203.0.113.x）で、要注意の札を足した（失敗の連打1・ツールの User-Agent 14）。
  - はじめは10個（全部で18）。先頭は失敗の連打の IP。
  - 「残り 8件を表示」で18個に開き、閉じると10個に戻る。
- 集客サマリー（Playwright・3100）
  - 「反響数」の右に「総予算」がある。
  - 金額を押すと、md のモーダルが開く。合計は押した金額と同じ（¥68,121・3件）。
  - 総予算で並べ替えると、先頭が最大（¥5,678,860）。
  - 画面のエラーなし。
- 後片付け：テストの security_log の行・仮スタッフ 999999 を削除。開発サーバー 3100 を停止。
- 型チェック：② とフロントの `npx tsc --noEmit` が通過。

## 新規・変更の全文と git diff
（下に続く）

```diff
diff --git a/backend-express/src/features/eventSummary.ts b/backend-express/src/features/eventSummary.ts
index f3198b6e9..d41722c47 100644
--- a/backend-express/src/features/eventSummary.ts
+++ b/backend-express/src/features/eventSummary.ts
@@ -350,3 +350,47 @@ export const runEventSummaryDetail = async (
 
   return { httpStatus: 200, body: { status: 'ok', customers } };
 };
+
+/**
+ * 総予算の明細（v2.2.261。表の「総予算」をクリックしたときのモーダル）。
+ *
+ * ⚠️ 突き合わせは BUDGET_SQL と同じ **TRIM(note) と event_calendar.title の完全一致**。
+ *   ⚠️ 表の総予算（rows[].budget）と明細の合計が必ず一致するように、条件を変えないこと（部分一致を足さない。BUDGET_SQL の注記）。
+ * ⚠️ title は event_calendar.title（接頭辞なし）で受ける。
+ */
+export interface EventBudgetRow {
+  id: number;
+  period: string;
+  shop: string;
+  medium: string;
+  company: string;
+  remarks: string;
+  category: string;
+  value: number;
+}
+
+export const runEventSummaryBudget = async (body: unknown): Promise<EventSummaryDetailResult> => {
+  const data = (body ?? {}) as Record<string, unknown>;
+  const title = asString(data.title).trim();
+  if (title === '') {
+    return { httpStatus: 400, body: { status: 'error', message: 'イベント名が指定されていません。' } };
+  }
+  const rows = await query<DynamicRow>(
+    `SELECT id, budget_period, shop, medium, company, COALESCE(remarks, '') AS remarks, category, budget_value
+       FROM budget
+      WHERE TRIM(note) = ?
+      ORDER BY budget_period, id`,
+    [title]
+  );
+  const budgets: EventBudgetRow[] = rows.map((r) => ({
+    id: asNumber(r.id),
+    period: asString(r.budget_period),
+    shop: asString(r.shop),
+    medium: asString(r.medium),
+    company: asString(r.company),
+    remarks: asString(r.remarks),
+    category: asString(r.category),
+    value: asNumber(r.budget_value),
+  }));
+  return { httpStatus: 200, body: { status: 'ok', budgets, total: budgets.reduce((s, b) => s + b.value, 0) } };
+};
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index a651eccdd..6fc593772 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -40,7 +40,7 @@ import { runEventCheckin } from '../features/event/checkin';
 import type { CallStatusCategory } from '../features/callStatusList';
 import { runCallStatusList } from '../features/callStatusList';
 import { runFamilyInfoShow, runFamilyInfoUpdate } from '../features/familyInfo';
-import { runEventSummary, runEventSummaryDetail } from '../features/eventSummary';
+import { runEventSummary, runEventSummaryBudget, runEventSummaryDetail } from '../features/eventSummary';
 import {
   runEventBudgetOptions,
   runEventBudgetSave,
@@ -1614,6 +1614,23 @@ register({
   },
 });
 
+/**
+ * 総予算をクリックしたときの予算の明細（v2.2.261）。⚠️ 表の総予算と同じ完全一致（features/eventSummary.ts の runEventSummaryBudget）
+ * ⚠️ ① の express_proxy.php は request 'event_summary' の単位で転送しているので、足さなくてよい
+ */
+register({
+  request: 'event_summary',
+  roll: 'budget',
+  summary: 'イベントの総予算の明細（budget の行）',
+  phpSource: '(Express のみ。PHPハンドラは無い)',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await runEventSummaryBudget(ctx.body);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 // ---------------------------------------------------------------------------
 // ランク管理（rank/RankOrder.tsx / RankKaeru.tsx / RankResale.tsx）
 //
diff --git a/backend/scripts/guide/articles/common/screen-195.md b/backend/scripts/guide/articles/common/screen-195.md
index 80d095b21..db6be874e 100644
--- a/backend/scripts/guide/articles/common/screen-195.md
+++ b/backend/scripts/guide/articles/common/screen-195.md
@@ -25,6 +25,8 @@ summary: ログイン・ログアウトと、失敗・エラーの記録を見
 1. 上の「期間」を選びます（はじめは直近7日）。必要なら「種類」「IP」「キーワード」（人・処理・画面・内容）で絞り、「表示」を押します
 2. 上の数字で、期間の中の件数を見ます。赤い数字（ログイン失敗・サーバーエラー・要注意の IP）が多いときは中身を確かめます
 3. 「要注意の IP」の赤い札を押すと、その接続元の記録だけになります。表の IP を押しても同じです
+   - 札は、はじめは**10個まで**出します。失敗の連打・存在しない処理の連打・ログイン失敗の接続元が先で、User-Agent だけの理由の接続元はあとに並びます
+   - 残りは「**残り N件を表示**」で開き、「閉じる」で戻ります
 4. 「要注意の IP だけ」に印を付けると、目印の付いた接続元の行だけになります
 
 ## 要注意の目印
diff --git a/frontend/src/components/header/event/EventSummary.tsx b/frontend/src/components/header/event/EventSummary.tsx
index a07dab37c..5216fb4de 100644
--- a/frontend/src/components/header/event/EventSummary.tsx
+++ b/frontend/src/components/header/event/EventSummary.tsx
@@ -74,7 +74,19 @@ const KPI_COLUMNS: { key: KpiKey; label: string }[] = [
  * ⚠️ 'id' は画面上の「No」列に対応する。No は表示上の連番だが、
  *   並べ替えの基準は event_calendar.id（イベントの登録順）である。
  */
-type SortKey = 'id' | 'title' | 'startDate' | KpiKey;
+type SortKey = 'id' | 'title' | 'startDate' | KpiKey | 'budget';
+
+/** 総予算の明細の1行（v2.2.261）。⚠️ サーバの EventBudgetRow と揃えること */
+interface EventBudget {
+    id: number;
+    period: string;
+    shop: string;
+    medium: string;
+    company: string;
+    remarks: string;
+    category: string;
+    value: number;
+}
 
 /**
  * KPI 1件あたりの広告費。
@@ -149,6 +161,11 @@ const styles = {
         zIndex: 1,
     },
     td: { fontSize: '12px', color: '#303030', verticalAlign: 'middle' as const },
+    /** v2.2.261: 総予算（押すと明細） */
+    budgetLink: {
+        border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600,
+        textDecoration: 'underline dotted', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' as const,
+    },
 };
 
 /** モーダルの見出しに出すKPI名 */
@@ -181,6 +198,11 @@ const EventSummary: React.FC = () => {
     /** 顧客詳細（一覧のお客様名クリックで開く） */
     const [editId, setEditId] = useState('');
 
+    /** ⚠️ v2.2.261: 総予算の明細のモーダル（金額をクリック） */
+    const [budgetOf, setBudgetOf] = useState<{ title: string } | null>(null);
+    const [budgets, setBudgets] = useState<EventBudget[] | null>(null);
+    const [budgetError, setBudgetError] = useState('');
+
     useEffect(() => {
         const fetchData = async () => {
             try {
@@ -262,6 +284,21 @@ const EventSummary: React.FC = () => {
         }
     };
 
+    /** 総予算の明細を開く。⚠️ 前の明細を消してから取りに行く（別イベントの行が一瞬出ないように） */
+    const openBudget = async (title: string) => {
+        setBudgetOf({ title });
+        setBudgets(null);
+        setBudgetError('');
+        try {
+            const response = await apiClient.post('', { request: 'event_summary', roll: 'budget', title });
+            setBudgets(Array.isArray(response.data?.budgets) ? response.data.budgets : []);
+        } catch (e) {
+            console.error('総予算の明細の取得に失敗しました', e);
+            setBudgetError('総予算の明細の取得に失敗しました。');
+            setBudgets([]);
+        }
+    };
+
     const closeDrill = () => {
         setDrill(null);
         setCustomers(null);
@@ -312,9 +349,17 @@ const EventSummary: React.FC = () => {
                             <th style={styles.th} onClick={() => toggleSort('title')}>イベント名{arrow('title')}</th>
                             <th style={styles.th} onClick={() => toggleSort('startDate')}>開催期間{arrow('startDate')}</th>
                             {KPI_COLUMNS.map(({ key, label }) => (
-                                <th key={key} style={{ ...styles.th, textAlign: 'right' }} onClick={() => toggleSort(key)}>
-                                    {label}{arrow(key)}
-                                </th>
+                                <React.Fragment key={key}>
+                                    <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => toggleSort(key)}>
+                                        {label}{arrow(key)}
+                                    </th>
+                                    {/* ⚠️ v2.2.261: 反響数の右に総予算（要件） */}
+                                    {key === 'inquiry' && (
+                                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => toggleSort('budget')}>
+                                            総予算{arrow('budget')}
+                                        </th>
+                                    )}
+                                </React.Fragment>
                             ))}
                         </tr>
                     </thead>
@@ -338,7 +383,8 @@ const EventSummary: React.FC = () => {
                                     // ⚠️ 0件のときはクリックできない。空の一覧を開くだけになる
                                     const canDrill = isDrillable(key) && kpi >= 1;
                                     return (
-                                        <td key={key} style={{ ...styles.td, textAlign: 'right', padding: '4px 6px' }}>
+                                        <React.Fragment key={key}>
+                                        <td style={{ ...styles.td, textAlign: 'right', padding: '4px 6px' }}>
                                             {canDrill ? (
                                                 <div
                                                     style={{
@@ -370,6 +416,24 @@ const EventSummary: React.FC = () => {
                                                 {cost === null ? '-' : yen(cost)}
                                             </div>
                                         </td>
+                                        {key === 'inquiry' && (
+                                            <td style={{ ...styles.td, textAlign: 'right', padding: '4px 6px', whiteSpace: 'nowrap' }}>
+                                                {/* ⚠️ 0円（未登録）は「-」。押せない（明細が無い）。負（返金の伝票）は赤 */}
+                                                {row.budget === 0 ? (
+                                                    <span style={{ color: '#6c757d' }}>-</span>
+                                                ) : (
+                                                    <button
+                                                        type="button"
+                                                        style={{ ...styles.budgetLink, color: row.budget < 0 ? '#dc3545' : '#0d6efd' }}
+                                                        onClick={() => openBudget(row.title)}
+                                                        title={`${row.title} の予算の明細を表示`}
+                                                    >
+                                                        {yen(row.budget)}
+                                                    </button>
+                                                )}
+                                            </td>
+                                        )}
+                                        </React.Fragment>
                                     );
                                 })}
                             </tr>
@@ -465,6 +529,70 @@ const EventSummary: React.FC = () => {
                 </Modal.Body>
             </Modal>
 
+            {/* ⚠️ v2.2.261: 総予算の明細（md。予算の表で、詳細がイベント名と完全に一致する行） */}
+            <Modal show={budgetOf !== null} onHide={() => { setBudgetOf(null); setBudgets(null); setBudgetError(''); }} centered>
+                <Modal.Header closeButton>
+                    <Modal.Title style={{ fontSize: '15px' }}>
+                        {budgetOf?.title}
+                        <span className="text-muted ms-2" style={{ fontSize: '12px' }}>総予算の明細</span>
+                    </Modal.Title>
+                </Modal.Header>
+                <Modal.Body>
+                    {budgets === null ? (
+                        <div className="text-muted text-center py-3" style={{ fontSize: '13px' }}>読み込み中…</div>
+                    ) : budgetError !== '' ? (
+                        <div className="text-danger text-center py-3" style={{ fontSize: '13px' }}>{budgetError}</div>
+                    ) : budgets.length === 0 ? (
+                        <div className="text-muted text-center py-3" style={{ fontSize: '13px' }}>明細がありません。</div>
+                    ) : (
+                        <>
+                            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
+                                <Table bordered hover size="sm" className="mb-2">
+                                    <thead>
+                                        <tr>
+                                            <th style={{ ...styles.th, cursor: 'default' }}>期間</th>
+                                            <th style={{ ...styles.th, cursor: 'default' }}>店舗</th>
+                                            <th style={{ ...styles.th, cursor: 'default' }}>媒体・請求先</th>
+                                            <th style={{ ...styles.th, cursor: 'default', textAlign: 'right' }}>金額</th>
+                                        </tr>
+                                    </thead>
+                                    <tbody>
+                                        {budgets.map((b) => (
+                                            <tr key={b.id}>
+                                                <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{b.period}</td>
+                                                <td style={styles.td}>{b.shop}</td>
+                                                <td style={styles.td}>
+                                                    {b.medium}
+                                                    {(b.company || b.remarks) && (
+                                                        <div className="text-muted" style={{ fontSize: '11px' }}>
+                                                            {[b.company, b.remarks].filter(Boolean).join('／')}
+                                                        </div>
+                                                    )}
+                                                </td>
+                                                <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: b.value < 0 ? '#dc3545' : undefined }}>
+                                                    {yen(b.value)}
+                                                </td>
+                                            </tr>
+                                        ))}
+                                    </tbody>
+                                    <tfoot>
+                                        <tr>
+                                            <td colSpan={3} style={{ ...styles.td, fontWeight: 700 }}>合計（{budgets.length}件）</td>
+                                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
+                                                {yen(budgets.reduce((s, b) => s + b.value, 0))}
+                                            </td>
+                                        </tr>
+                                    </tfoot>
+                                </Table>
+                            </div>
+                            <div className="text-muted" style={{ fontSize: '11px' }}>
+                                予算の表で、詳細（備考）がイベント名と完全に一致する行の合計です。マイナスは返金・修正の伝票です。
+                            </div>
+                        </>
+                    )}
+                </Modal.Body>
+            </Modal>
+
             {/* ⚠️ 顧客詳細。閉じたら id を空にするだけで、一覧は開いたままにする
                 （続けて別の顧客を見たいため） */}
             <InformationEdit id={editId} token={token} onClose={() => setEditId('')} authority={authority} />
diff --git a/frontend/src/components/header/system/SecurityLog.tsx b/frontend/src/components/header/system/SecurityLog.tsx
index 93a38eb19..3a19e1f15 100644
--- a/frontend/src/components/header/system/SecurityLog.tsx
+++ b/frontend/src/components/header/system/SecurityLog.tsx
@@ -67,6 +67,9 @@ const EVENT_KEYS = Object.keys(EVENTS) as EventKey[];
 
 type SortKey = 'occurredAt' | 'event' | 'count' | 'staffName' | 'ip' | 'request';
 
+/** 要注意の IP の札を、はじめに出す数（v2.2.261。残りは「残り N件を表示」で開く） */
+const FLAG_LIMIT = 10;
+
 const sum = (totals: ListResponse['totals'], keys: EventKey[]): number => keys.reduce((n, k) => n + (totals[k] ?? 0), 0);
 
 const SecurityLog = () => {
@@ -121,7 +124,18 @@ const SecurityLog = () => {
     }, [data, flaggedOnly, flags, sortKey, sortOrder]);
 
     const totals = data?.totals ?? {};
-    const flaggedIps = Object.keys(flags);
+    /**
+     * ⚠️ v2.2.261: 要注意の IP は大事なものから並べる（失敗・探り・ログイン失敗の連打 → User-Agent だけの順。同じなら理由の多い順）。
+     *   はじめは FLAG_LIMIT 件だけ出し、残りはボタンで開く（クローラーの User-Agent だけで 50件を超え、画面の上が埋まっていた）
+     */
+    const flaggedIps = useMemo(() => {
+        const weight = (k: string) => (flags[k].some((r) => !r.includes('User-Agent')) ? 100 : 0) + flags[k].length;
+        return Object.keys(flags).sort((a, b) => weight(b) - weight(a) || a.localeCompare(b));
+    }, [flags]);
+    const [showAllFlags, setShowAllFlags] = useState(false);
+    // 期間などを変えて読み直したら閉じる
+    useEffect(() => { setShowAllFlags(false); }, [data]);
+    const shownIps = showAllFlags ? flaggedIps : flaggedIps.slice(0, FLAG_LIMIT);
 
     const th = (label: string, key: SortKey, width?: number) => {
         const active = sortKey === key;
@@ -169,6 +183,9 @@ const SecurityLog = () => {
                 .sl_alert { border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; border-radius: 999px; font-size: 11px;
                             padding: 2px 10px; cursor: pointer; }
                 .sl_alert:hover { background: #fee2e2; }
+                .sl_more { border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 999px; font-size: 11px;
+                           font-weight: 700; padding: 2px 12px; cursor: pointer; }
+                .sl_more:hover { background: #f3f4f6; }
                 .sl_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                  flex: 1 1 auto; min-height: 240px; }
                 .sl_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
@@ -261,12 +278,18 @@ const SecurityLog = () => {
                         {flaggedIps.length > 0 && (
                             <div className="sl_alerts">
                                 <span className="sl_note">要注意の IP（押すとその IP だけ）:</span>
-                                {flaggedIps.map((k) => (
+                                {shownIps.map((k) => (
                                     <button type="button" key={k} className="sl_alert" title={flags[k].join(' / ')}
                                         onClick={() => { setIp(k); apply({ ip: k }); }}>
                                         {k}（{flags[k].join('・')}）
                                     </button>
                                 ))}
+                                {flaggedIps.length > FLAG_LIMIT && (
+                                    <button type="button" className="sl_more" aria-expanded={showAllFlags}
+                                        onClick={() => setShowAllFlags((v) => !v)}>
+                                        {showAllFlags ? '閉じる ▲' : `残り ${flaggedIps.length - FLAG_LIMIT}件を表示 ▼`}
+                                    </button>
+                                )}
                             </div>
                         )}
 
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 8e7cd2322..6778c3023 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.260';
+export const newVersion = '2.2.261';
```

### backend/scripts/guide/articles/common/screen-199.md（新規）
```md
---
title: 集客サマリー
section: 画面の使い方
sort: 199
summary: 全社の集客イベントごとに、反響から契約までの数と総予算、1件あたりの広告費を並べて比べる画面。
---
ヘッダーの「集客イベント → 集客サマリー」。全社の集客イベントごとに、反響数・有効名簿数・店舗来場者数・次アポ数・契約者数と、総予算を1行に並べます。イベントの費用対効果を比べるときに使います。

[[画面:集客サマリー]]

## 見方
- 1行が1つのイベントです。イベントカレンダーで「全社」かつ公開中のイベントが出ます
- 見出しを押すと並べ替えられます（もう一度押すと逆の順）
- 各数字の下の小さな金額は、**その数字1件あたりの広告費**（総予算 ÷ 件数。切り上げ）です。同じ列の中で安いほど緑、高いほど赤になります
- 総予算が未登録・件数が0件のときは「-」です

## 総予算
「反響数」の右の「**総予算**」は、そのイベントにかかった広告費の合計です。
- 金額を押すと、予算の明細（期間・店舗・媒体・請求先・金額と合計）が開きます
- 明細と合計は、予算の表で「詳細（備考）」が**イベント名と完全に一致する**行です。1文字でも違う行は入りません
- マイナスの行は、返金・修正の伝票です（赤で出ます）

> 注意：総予算が「-」や少なすぎるときは、広告費の登録の「詳細」がイベント名と同じかを確かめてください。[[イベントの広告費入力]] から登録すると、イベント名で入ります。

## 顧客を見る
有効名簿数・店舗来場者数・次アポ数・契約者数は、1以上の数字を押すと、該当の顧客の一覧が開きます。一覧のお客様名を押すと、顧客詳細が開きます。

## 関係する記事
- [[イベントの広告費入力]]
```
