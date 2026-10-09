# 2026-10-09 v2.2.179 フェスタ画面：歩留まりの右に注意書き

## 依頼（ReadMeClaude.md）
- v2.2.179 で作業開始
- `frontend/src/components/header/FestaDashboard.tsx`：ブランド別の歩留まりの右の空き（右半分）をグリッドにして注意書きを追加
  - ストラップの色：黄 or 赤 … 住宅・不動産を検討しているお客様 ／ 青 … マルシェやキッチンカーのみ希望のお客様
  - 営業の皆様へ：面談 → 「面談」にチェック ／ アポ → 「次アポ」にチェック ／ 次アポ・追客は必ず「同期」 ／ 他店舗が同期済みでも追客するなら同期

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/header | **FestaDashboard.tsx** | 歩留まりと注意書きを `.fe_yield_grid`（2列グリッド）で並べる |
| frontend/src/utils | version.ts | 2.2.179 |
| backend/scripts/sql | **2026-10-09_update_log_2.2.179.sql**（新規） | update_log（ローカル投入済み no=275） |

### 追加したもの（FestaDashboard.tsx）
- 注意書きのブロック（`.fe_notice`）。ストラップの色は表と同じ `STRAP_COLOR` の四角で示す
- CSS: `.fe_yield_grid`（2列。幅 991px 以下は1列）／ `.fe_notice` ／ `.fe_notice_title` ／ `.fe_notice_list` ／ `.fe_notice_steps`
- 歩留まりのカードの `mb-2` はグリッド側へ移した
- ⚠️ 注意書きは予約0件でも表示（歩留まりは従来どおり予約があるときだけ）
- 追加した関数: なし

## 確認
- eslint 警告なし、`npm run build` 成功 → **`main.81ed8d69.js`**
- 画面での見た目は未確認

## 差分（全文）
```diff
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index 31426283..45f5d614 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -736,6 +736,13 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         .fe_sum .fe_sep, .fe_tbl .fe_sep { border-left: 2px solid #ced4da; }
                         .fe_tbl { font-size: 11px; }
                         .fe_tbl td { border: 1px solid #eef0f3; padding: 3px 4px; vertical-align: middle; }
+                        .fe_yield_grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: start; }
+                        @media (max-width: 991px) { .fe_yield_grid { grid-template-columns: minmax(0, 1fr); } }
+                        .fe_notice { font-size: 12px; color: #32325d; border-left: 4px solid #fb6340 !important; }
+                        .fe_notice_title { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
+                        .fe_notice_list { margin: 0; padding-left: 18px; line-height: 1.7; }
+                        .fe_notice_list li .fe_strap { width: 12px; height: 12px; }
+                        .fe_notice_steps li::marker { color: #fb6340; }
                         .fe_strap_ticket { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
                         .fe_slash { color: #adb5bd; }
                         .fe_strap { display: inline-block; width: 18px; height: 18px; border-radius: 3px; border: 1px solid rgba(0,0,0,.15); margin-right: 3px; vertical-align: middle; }
@@ -847,9 +854,14 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         </div>
                     )}
 
+                    {/*
+                      ⚠️ v2.2.179: 歩留まりの右の空きに注意書き（⚠️ グリッドで左右2列。⚠️ 画面が狭いと縦に並ぶ）。
+                        ⚠️ 注意書きは予約が0件でも出す（⚠️ 当日の朝、開いた人がまず読むため）。
+                    */}
+                    <div className="fe_yield_grid mb-2">
                     {/* ブランド別の歩留まり（v2.2.174）。⚠️ 集計表の下 */}
                     {data.length > 0 && (
-                        <div className="bg-white rounded shadow-sm border mb-2 p-2">
+                        <div className="bg-white rounded shadow-sm border p-2">
                             <div style={{ fontSize: '12px', fontWeight: 700, color: '#32325d', marginBottom: '4px' }}>
                                 ブランド別の歩留まり
                                 <small style={{ fontSize: '10px', fontWeight: 400, color: '#8898aa', marginLeft: '8px' }}>
@@ -897,6 +909,30 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         </div>
                     )}
 
+                    {/* 注意書き（v2.2.179）。⚠️ 文言は指示書どおり */}
+                    <div className="bg-white rounded shadow-sm border p-2 fe_notice">
+                        <div className="fe_notice_title">ストラップの色</div>
+                        <ul className="fe_notice_list">
+                            <li>
+                                <span className="fe_strap" style={{ backgroundColor: STRAP_COLOR.yellow }} aria-hidden="true" />
+                                <span className="fe_strap" style={{ backgroundColor: STRAP_COLOR.red }} aria-hidden="true" />
+                                ：住宅・不動産を検討しているお客様
+                            </li>
+                            <li>
+                                <span className="fe_strap" style={{ backgroundColor: STRAP_COLOR.blue }} aria-hidden="true" />
+                                ：マルシェやキッチンカーのみ希望のお客様
+                            </li>
+                        </ul>
+                        <div className="fe_notice_title mt-2">営業の皆様へ</div>
+                        <ul className="fe_notice_list fe_notice_steps">
+                            <li>お客様を面談した場合、ご自身の所属するブランドの<strong>「面談」</strong>にチェックを入れる</li>
+                            <li>面談したお客様とアポイントが取れた場合、ご自身の所属するブランドの<strong>「次アポ」</strong>にチェックを入れる</li>
+                            <li>次アポが取れたお客様、今後追客するお客様は<strong>必ず「同期」処理</strong>をおこなう</li>
+                            <li>店舗をまたいで同期処理は可能なので、<strong>他店舗が同期済みでも追客する場合</strong>は忘れないように処理をする</li>
+                        </ul>
+                    </div>
+                    </div>
+
                     {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}
 
                     <div className="bg-white rounded shadow-sm border table-responsive">
```
