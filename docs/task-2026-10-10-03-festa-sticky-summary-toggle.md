# 2026-10-10 v2.2.183 フェスタ画面：上部サマリーの固定と開閉

## 依頼
- 新しいブランチ（v2.2.183。⚠️ v2.2.182 が main 未マージのため v2.2.182 から切った）
- `frontend/src/components/header/FestaDashboard.tsx`
  - 上部サマリー（おうちづくりフェスタ2026 の集計表・ブランド別の歩留まり）をコンポーネント上部に固定
  - 開閉ボタンを追加。既定は開く（open = true）

## 変更（frontend/src/components/header/FestaDashboard.tsx）
- 上部の操作の行（リロード・閉じる・検索・来場日・来場時間・件数）と、サマリー（集計表・ブランド別の歩留まり・注意書き）を **1つの固定ブロック `.fe_top`**（position: sticky）にまとめた
  - それまでは操作の行だけが固定だった
- 操作の行の右端に **「サマリーを閉じる／サマリーを開く」** ボタン（`aria-expanded` / `aria-controls`）
- state `summaryOpen`（既定 true）
- サマリー部分 `.fe_summary_panel` は **高さの上限 45vh**、超えたら中でスクロール（下の表が見えなくならないように）
- 固定ブロックの下に薄い影（`.fe_top`）
- 注意書きも歩留まりと同じグリッドにあるため、一緒に固定・開閉される
- 追加した関数: なし

## その他
- version.ts 2.2.183、`backend/scripts/sql/2026-10-10_update_log_2.2.183.sql`
- ⚠️ ローカル DB へは未投入（181・182 も）。Docker が応答しないため。復旧後に 181 → 182 → 183 の順で投入すること

## 確認
- eslint 警告なし、`npm run build` 成功 → **`main.3e872c46.js`**
- 画面での見た目は未確認

## 差分（全文）
```diff
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index ca617440..5cea0647 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -364,6 +364,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
     });
     /** ⚠️ 保存中のトグル（`id:key`）。⚠️ 連打で二重に送らない */
     const [savingKey, setSavingKey] = useState('');
+    /** 上部のサマリー（集計表・ブランド別の歩留まり・注意書き）の開閉（v2.2.183）。⚠️ 既定は開く */
+    const [summaryOpen, setSummaryOpen] = useState(true);
 
     // 同期（担当者選択）モーダル。⚠️ EventList.tsx と同じ
     const [staffArray, setStaffArray] = useState<Staff[]>([]);
@@ -805,11 +807,19 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         .fe_tbl .fe_stick { position: sticky; z-index: 2; background-color: var(--bs-table-bg, #fff); }
                         .fe_tbl thead .fe_stick { z-index: 3; background-color: #f6f9fc; }
                         .fe_tbl .fe_stick_last { box-shadow: inset -2px 0 0 #ced4da; }
+                        .fe_top { box-shadow: 0 6px 6px -6px rgba(50, 50, 93, .25); }
+                        .fe_summary_panel { max-height: 45vh; overflow-y: auto; padding-bottom: 2px; }
                     `}</style>
 
-                    {/* 上部の操作。⚠️ EventList.tsx と同じく上に固定する */}
-                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2"
-                        style={{ position: 'sticky', top: '-8px', zIndex: 5, backgroundColor: '#f8f9fe', padding: '8px 0', margin: '-8px 0 8px' }}>
+                    {/*
+                      ⚠️ v2.2.183: 上部の操作 ＋ サマリー（集計表・ブランド別の歩留まり・注意書き）を ⚠️ **まとめて上に固定**する。
+                        ⚠️ それまでは操作の行だけ固定していた。
+                        ⚠️ サマリーは「サマリーを閉じる／開く」で畳める（⚠️ 既定は開く）。
+                        ⚠️ サマリーが高いと下の表が見えなくなるので、⚠️ サマリー部分は高さの上限（画面の45%）を超えたら中でスクロールする。
+                    */}
+                    <div className="fe_top" style={{ position: 'sticky', top: '-8px', zIndex: 5, backgroundColor: '#f8f9fe', padding: '8px 0 0', margin: '-8px 0 8px' }}>
+                    {/* 上部の操作 */}
+                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                         <button style={{ ...styles.buttonPrimary, padding: '4px 10px', fontSize: '11px' }} onClick={() => void fetchData()} disabled={loading}>
                             {loading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="fa-solid fa-rotate-right me-1"></i>}
                             リロード
@@ -835,8 +845,16 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         <span style={{ fontSize: '11px', color: '#8898aa' }}>
                             予約 {data.length.toLocaleString()}件 ／ チェックイン {checkedIn.toLocaleString()}件
                         </span>
+                        {/* ⚠️ v2.2.183: サマリーの開閉 */}
+                        <button type="button" className="ms-auto" style={{ ...styles.buttonPrimary, padding: '4px 10px', fontSize: '11px' }}
+                            onClick={() => setSummaryOpen(v => !v)} aria-expanded={summaryOpen} aria-controls="fe_summary_panel">
+                            <i className={`fa-solid ${summaryOpen ? 'fa-chevron-up' : 'fa-chevron-down'} me-1`} aria-hidden="true"></i>
+                            {summaryOpen ? 'サマリーを閉じる' : 'サマリーを開く'}
+                        </button>
                     </div>
 
+                    {summaryOpen && (
+                    <div id="fe_summary_panel" className="fe_summary_panel">
                     {/* 集計表（⚠️ EventList.tsx と同じ配置） */}
                     {data.length > 0 && (
                         <div className="bg-white rounded shadow-sm border mb-2 p-2">
@@ -995,6 +1013,9 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         </ul>
                     </div>
                     </div>
+                    </div>
+                    )}
+                    </div>
 
                     {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}
 
```
