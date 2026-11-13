# 作業記録 2026-11-10-05　v2.2.262　集客サマリーの総予算の明細を見やすく

## 依頼
- 総予算の明細のモーダル（v2.2.261）で、媒体（budget.medium）の「イベント」が全行に出る。このモーダルはほぼイベントの広告費だけなので、媒体の表示は不要。
- かわりに、remarks（詳細）と company（請求先）を分かりやすく出す。

## 変えたもの
| 区分 | ファイル | 内容 |
|---|---|---|
| 画面 | `frontend/src/components/header/event/EventSummary.tsx` | 明細の列を「期間・店舗・**請求先**・**詳細**・金額」にした（媒体の列をやめ、請求先と詳細をそれぞれの列に）。空は「-」。上に**請求先ごとの合計**の札（金額の多い順・件数つき。`companyTotals`・`styles.companyChip`）。合計の行の colSpan を 4 に。注記の文を広告費入力の呼び名にそろえた |
| 画面 | `frontend/src/utils/version.ts` | 2.2.262 |
| ① DB | `backend/scripts/sql/2026-11-10_update_log_2.2.262.sql`（**新規**） | 更新履歴＋業務ガイド1本。⚠️ 表の変更なし |
| 記事 | `common/screen-199.md` | 下の「業務ガイド」 |

- ② は変えていない（`event_summary:budget` は medium も返すが、画面で使わないだけ）。① の PHP も変えていない。

### 用語の訂正（v2.2.261 の誤り）
- 広告費入力（`EventBudget.tsx`）の画面では、`budget.note` が「**イベント名**」、`budget.remarks` が「**詳細**」と呼ばれている。
- v2.2.261 のモーダルの注記と業務ガイドで、突き合わせに使う note を「詳細（備考）」と書いていた。これを「広告費入力の『イベント名』」に直した。「詳細」の列は remarks。

## 業務ガイド
記事「集客サマリー」（common/screen-199）
- 明細：上に請求先ごとの合計、表は期間・店舗・請求先・詳細・金額、と書いた。
- 突き合わせの説明と注意を「広告費入力の『イベント名』が完全に一致」に直した。

## テスト（`scratchpad/pw_262.cjs`。Playwright・3100）：**5項目 OK**
- 「おうちづくりフェスタ2026」の明細で確かめた。
  - 列は「期間・店舗・請求先・詳細・金額」。「イベント」（媒体）の文字は表に出ない。
  - 請求先ごとの合計の和（11社）が総予算（¥5,678,860）と同じ。合計の行（119件）も同じ。
  - 画面のエラーなし。
- 型チェック：フロントの `npx tsc --noEmit` が通過。
- 後片付け：仮スタッフ 999999 を削除。開発サーバー 3100 を停止。

## git diff
```diff
diff --git a/backend/scripts/guide/articles/common/screen-199.md b/backend/scripts/guide/articles/common/screen-199.md
index 79df37ee3..11aa70ca8 100644
--- a/backend/scripts/guide/articles/common/screen-199.md
+++ b/backend/scripts/guide/articles/common/screen-199.md
@@ -16,11 +16,13 @@ summary: 全社の集客イベントごとに、反響から契約までの数
 
 ## 総予算
 「反響数」の右の「**総予算**」は、そのイベントにかかった広告費の合計です。
-- 金額を押すと、予算の明細（期間・店舗・媒体・請求先・金額と合計）が開きます
-- 明細と合計は、予算の表で「詳細（備考）」が**イベント名と完全に一致する**行です。1文字でも違う行は入りません
+- 金額を押すと、予算の明細が開きます
+  - 上に**請求先ごとの合計**（金額の多い順）が出ます。どこにいくら払ったかが一目で分かります
+  - 表は、期間・店舗・請求先・詳細・金額と、最後に合計です。「詳細」は、広告費入力の「詳細」の欄に入れた内容です
+- 明細と合計は、広告費入力の「**イベント名**」が、このイベント名と**完全に一致する**行です。1文字でも違う行は入りません
 - マイナスの行は、返金・修正の伝票です（赤で出ます）
 
-> 注意：総予算が「-」や少なすぎるときは、広告費の登録の「詳細」がイベント名と同じかを確かめてください。[[イベントの広告費入力]] から登録すると、イベント名で入ります。
+> 注意：総予算が「-」や少なすぎるときは、広告費入力の「イベント名」が、このイベント名と同じかを確かめてください。[[イベントの広告費入力]] から登録すると、イベント名で入ります。
 
 ## 顧客を見る
 有効名簿数・店舗来場者数・次アポ数・契約者数は、1以上の数字を押すと、該当の顧客の一覧が開きます。一覧のお客様名を押すと、顧客詳細が開きます。
diff --git a/frontend/src/components/header/event/EventSummary.tsx b/frontend/src/components/header/event/EventSummary.tsx
index 5216fb4de..7aec40e4b 100644
--- a/frontend/src/components/header/event/EventSummary.tsx
+++ b/frontend/src/components/header/event/EventSummary.tsx
@@ -143,6 +143,17 @@ const costStyle = (ratio: number | null): React.CSSProperties => {
 
 const yen = (value: number): string => `¥${value.toLocaleString('ja-JP')}`;
 
+/** 総予算の明細の、請求先ごとの合計と件数（v2.2.262。金額の多い順。請求先が空は「（請求先なし）」） */
+const companyTotals = (rows: { company: string; value: number }[]): [string, number, number][] => {
+    const m = new Map<string, [number, number]>();
+    for (const r of rows) {
+        const k = r.company.trim() || '（請求先なし）';
+        const cur = m.get(k) ?? [0, 0];
+        m.set(k, [cur[0] + r.value, cur[1] + 1]);
+    }
+    return [...m.entries()].map(([k, [t, c]]): [string, number, number] => [k, t, c]).sort((a, b) => b[1] - a[1]);
+};
+
 /** 'YYYY-MM-DD' → 'YYYY/MM/DD'。⚠️ 空文字はそのまま返す（'-' は呼び出し側で） */
 const dateFormate = (date: string): string => (date ? date.replace(/-/g, '/') : '');
 
@@ -161,6 +172,10 @@ const styles = {
         zIndex: 1,
     },
     td: { fontSize: '12px', color: '#303030', verticalAlign: 'middle' as const },
+    /** v2.2.262: 明細の上の請求先ごとの合計 */
+    companyChip: {
+        fontSize: '11px', border: '1px solid #dee2e6', background: '#f8f9fa', borderRadius: '999px', padding: '2px 10px', whiteSpace: 'nowrap' as const,
+    },
     /** v2.2.261: 総予算（押すと明細） */
     budgetLink: {
         border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600,
@@ -546,13 +561,25 @@ const EventSummary: React.FC = () => {
                         <div className="text-muted text-center py-3" style={{ fontSize: '13px' }}>明細がありません。</div>
                     ) : (
                         <>
+                            {/* ⚠️ v2.2.262: 請求先ごとの合計（どこにいくら払ったかを先に見せる。金額の多い順） */}
+                            <div className="mb-2" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
+                                {companyTotals(budgets).map(([company, total, count]) => (
+                                    <span key={company} style={styles.companyChip}>
+                                        {company}
+                                        <b style={{ marginLeft: '6px', fontVariantNumeric: 'tabular-nums', color: total < 0 ? '#dc3545' : undefined }}>{yen(total)}</b>
+                                        <span className="text-muted" style={{ marginLeft: '4px' }}>（{count}件）</span>
+                                    </span>
+                                ))}
+                            </div>
                             <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                                 <Table bordered hover size="sm" className="mb-2">
                                     <thead>
                                         <tr>
+                                            {/* ⚠️ v2.2.262: 媒体（medium）は出さない。このモーダルはほぼイベントの広告費だけで、全行「イベント」になるため（利用者の指示） */}
                                             <th style={{ ...styles.th, cursor: 'default' }}>期間</th>
                                             <th style={{ ...styles.th, cursor: 'default' }}>店舗</th>
-                                            <th style={{ ...styles.th, cursor: 'default' }}>媒体・請求先</th>
+                                            <th style={{ ...styles.th, cursor: 'default' }}>請求先</th>
+                                            <th style={{ ...styles.th, cursor: 'default' }}>詳細</th>
                                             <th style={{ ...styles.th, cursor: 'default', textAlign: 'right' }}>金額</th>
                                         </tr>
                                     </thead>
@@ -560,15 +587,9 @@ const EventSummary: React.FC = () => {
                                         {budgets.map((b) => (
                                             <tr key={b.id}>
                                                 <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{b.period}</td>
-                                                <td style={styles.td}>{b.shop}</td>
-                                                <td style={styles.td}>
-                                                    {b.medium}
-                                                    {(b.company || b.remarks) && (
-                                                        <div className="text-muted" style={{ fontSize: '11px' }}>
-                                                            {[b.company, b.remarks].filter(Boolean).join('／')}
-                                                        </div>
-                                                    )}
-                                                </td>
+                                                <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{b.shop}</td>
+                                                <td style={styles.td}>{b.company || <span className="text-muted">-</span>}</td>
+                                                <td style={{ ...styles.td, fontSize: '11px' }}>{b.remarks || <span className="text-muted">-</span>}</td>
                                                 <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: b.value < 0 ? '#dc3545' : undefined }}>
                                                     {yen(b.value)}
                                                 </td>
@@ -577,7 +598,7 @@ const EventSummary: React.FC = () => {
                                     </tbody>
                                     <tfoot>
                                         <tr>
-                                            <td colSpan={3} style={{ ...styles.td, fontWeight: 700 }}>合計（{budgets.length}件）</td>
+                                            <td colSpan={4} style={{ ...styles.td, fontWeight: 700 }}>合計（{budgets.length}件）</td>
                                             <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                                 {yen(budgets.reduce((s, b) => s + b.value, 0))}
                                             </td>
@@ -586,7 +607,7 @@ const EventSummary: React.FC = () => {
                                 </Table>
                             </div>
                             <div className="text-muted" style={{ fontSize: '11px' }}>
-                                予算の表で、詳細（備考）がイベント名と完全に一致する行の合計です。マイナスは返金・修正の伝票です。
+                                広告費入力の「イベント名」が、このイベント名と完全に一致する行の合計です。「詳細」は広告費入力の詳細の欄です。マイナスは返金・修正の伝票です。
                             </div>
                         </>
                     )}
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 6778c3023..926e182a6 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.261';
+export const newVersion = '2.2.262';
```
