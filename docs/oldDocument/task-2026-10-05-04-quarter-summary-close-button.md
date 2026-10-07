# 2026-10-05-04　4半期サマリーの見出しの右に「閉じる」を追加（v2.2.163 の続き）

## 依頼

> 同じブランチでいいので左上 4半期サマリーのタイトルヘッダーの右隣にも**閉じる**ボタンを追加

## 変更

| ディレクトリ | ファイル | |
|---|---|---|
| `frontend/src/components/company/` | **QuarterSummary.tsx** | ⚠️ 見出しの右に「閉じる」ボタン（`setShow(false)`）と CSS `.qs_close` |
| `docs/` | **deploy-v2.2.163.md** | ⚠️ 成果物名・確認項目26 |

⚠️ 右上の × は ⚠️ **残してある**（⚠️ どちらで閉じても同じ）。
⚠️ 追加した関数はない。⚠️ バックエンドの変更もない。

## 動作確認

```bash
cd frontend && npx react-scripts build   # -> Compiled with warnings（⚠️ QuarterSummary.tsx は0件）
```

| 成果物 | |
|---|---|
| ⚠️⚠️ **`static/js/main.e32a3dc0.js`** | ⚠️ v2.2.163 の本体（⚠️ これまでの分も含む） |
| `static/css/main.7c10f266.css` | 変更なし |

⚠️ ブラウザでの表示は ⚠️ **未確認**。

## 差分

```diff
diff --git a/frontend/src/components/company/QuarterSummary.tsx b/frontend/src/components/company/QuarterSummary.tsx
index d0c3e916..79b16555 100644
--- a/frontend/src/components/company/QuarterSummary.tsx
+++ b/frontend/src/components/company/QuarterSummary.tsx
@@ -490,6 +490,14 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
                 <Modal.Title className="qs_modal_title">
                     <i className="fa-solid fa-chart-column me-2" aria-hidden="true" />
                     4半期サマリー
+                    {/*
+                        ⚠️ 2026-10-05 の指示で、見出しのすぐ右にも「閉じる」を置いた。
+                          ⚠️ 全画面だと右上の × が遠く、気づかれにくいため。
+                          ⚠️ 右上の × も残してある（⚠️ どちらで閉じても同じ）。
+                    */}
+                    <button type="button" className="qs_close" onClick={() => setShow(false)}>
+                        <i className="fa-solid fa-xmark me-1" aria-hidden="true" />閉じる
+                    </button>
                     <span className="qs_modal_sub">{DIVISION} / {targetYear}年5月期（{targetYear - 1}/06〜{targetYear}/05）</span>
                 </Modal.Title>
             </Modal.Header>
@@ -501,6 +509,12 @@ const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sec
                     .qs_modal_head { background: #fff; border-bottom: 1px solid #e5e7eb; }
                     .qs_modal_title { font-size: 16px; font-weight: 700; display: flex; align-items: baseline; gap: 4px; }
                     .qs_modal_sub { font-size: 11px; font-weight: 500; color: #6b7280; margin-left: 10px; }
+                    /* ⚠️ 見出しの右の「閉じる」。⚠️ タブと同じ角丸・同じ文字の大きさ */
+                    .qs_close { margin-left: 12px; align-self: center; border: 1px solid #d1d5db; background: #fff;
+                                color: #374151; font-size: 12px; font-weight: 700; border-radius: 8px;
+                                padding: 3px 12px; cursor: pointer; }
+                    .qs_close:hover { background: #f3f4f6; }
+                    .qs_close:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
 
                     .qs_bar { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
                               background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
```
