# 2026-10-12 v2.2.188 キャンペーン設定（NewCampaign.tsx）の右の余白を直す

## 依頼
- 「NewCampaign.tsx の見た目を要確認。右の余白が大きいの不格好」（画面幅 約1890px のスクリーンショット）

## 原因
- `.nc`（NewCampaign の一番外の枠）は App.tsx の `<div className="d-flex">`（左メニューと横並び）の**子**。
- ⚠️ `flex: 1` が無いので**中身の幅までしか広がらず**（約935px）、右側 約750px が空いていた。
- ほかの画面は `.content`（SearchBox.css）で幅を取っているが、新しい画面はそれを使っていない。

## 変更（frontend/src/components/campaign）
| ファイル | 内容 |
|---|---|
| **newCampaign.css** | `.nc` に `flex: 1 1 0; min-width: 0;`（親の横並びの中で残りの幅いっぱいに広げる） |
| | 見出し・2列・お知らせ・保存バーの最大幅 1280px → **1480px** |
| | 見出し・2列・お知らせを中央寄せ（`margin: 0 auto`）→ **左寄せ**（`margin: 0`）。左メニューの横に空きができないように |
| | プレビューの列 420px 固定 → **`clamp(420px, 36%, 560px)`**（広い画面ではプレビューも広く） |
| | 「一覧へ戻る」を右端（`margin-left: auto`）→ **見出しの隣**（`margin-left: 12px`）。⚠️ 右端には ActiveUser（`position: fixed` の利用者パネル）が浮いていて、右端に置くとボタンが隠れるため |

⚠️ NewCampaign.tsx（描画）は変えていない。CSS だけ。

## 確認（ローカル）
- `npm run build` 成功 → **`main.d3804e4d.js`（変わらず）／ CSS は `main.ec223763.css`**（⚠️ 前の `main.8804e4b8.css` から変わった）
- ビルド済みを手元で /dashboard/ として配り、Playwright で幅 1890px の画面を撮影（⚠️ API への POST はすべて偽物の応答。① ② には送っていない）
  - 設定のカードが左メニューのすぐ右から始まり、プレビューの右端が利用者パネルの手前で終わる。戻るボタンが隠れない
- deploy-v2.2.188.md の CSS のファイル名を `main.ec223763.css` に直した

## 差分
```diff
--- a/frontend/src/components/campaign/newCampaign.css
+++ b/frontend/src/components/campaign/newCampaign.css
@@ -20,6 +20,9 @@
     --nc-warn: #b45309;
     --nc-warn-bg: #fff7ed;
 
+    /* ⚠️ App.tsx の d-flex（左メニューと横並び）の子なので、⚠️ flex: 1 が無いと中身の幅までしか広がらず右が大きく空く */
+    flex: 1 1 0;
+    min-width: 0;
     min-height: 100%;
     background: var(--nc-bg);
     color: var(--nc-ink);
@@ -35,8 +38,8 @@
     display: flex;
     align-items: center;
     gap: 14px;
-    max-width: 1280px;
-    margin: 0 auto 18px;
+    max-width: 1480px;
+    margin: 0 0 18px;
 }
 .nc-header-logo {
     height: 34px;
@@ -54,8 +57,9 @@
     font-size: 12px;
     color: var(--nc-muted);
 }
+/* ⚠️ 右端には ActiveUser（position: fixed の利用者パネル）が浮いて重なるので、⚠️ 戻るボタンは見出しの隣に置く */
 .nc-header-actions {
-    margin-left: auto;
+    margin-left: 12px;
 }
 
 /* ---- 2列（設定 ／ プレビュー） ---- */
@@ -63,13 +67,13 @@
     display: grid;
     grid-template-columns: minmax(0, 1fr);
     gap: 20px;
-    max-width: 1280px;
-    margin: 0 auto;
+    max-width: 1480px;
+    margin: 0;
     align-items: start;
 }
 @media (min-width: 1200px) {
     .nc-layout {
-        grid-template-columns: minmax(0, 1fr) 420px;
+        grid-template-columns: minmax(0, 1fr) clamp(420px, 36%, 560px);
     }
 }
 .nc-main {
@@ -416,7 +420,7 @@
     display: flex;
     align-items: center;
     gap: 10px;
-    max-width: 1280px;
+    max-width: 1480px;
     margin: 0 auto;
     padding: 12px 20px;
 }
@@ -433,8 +437,8 @@
 
 /* ---- お知らせ ---- */
 .nc-alert {
-    max-width: 1280px;
-    margin: 0 auto 16px;
+    max-width: 1480px;
+    margin: 0 0 16px;
     padding: 12px 16px;
     border-radius: 10px;
     border: 1px solid #f5c2c7;
```
