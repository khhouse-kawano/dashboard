# 2026-10-12 v2.2.188 LINE アイコンの開き先を LINE WORKS の連絡先に

## 依頼
- アイコンを押してもユーザー追加などをしないとトークルームに行けないので、今の開き先（トーク）では意味が無い
- 開き先を **`https://contact.worksmobile.com/p/web/shared/contact`** にして、登録画面へ移れるようにする

## 変更
| ファイル | 内容 |
|---|---|
| frontend/src/components/information/**LineIdRow.tsx** | 定数 `LINE_WORKS_TALK_URL`（`https://talk.worksmobile.com/`）→ **`LINE_WORKS_CONTACT_URL`**（`https://contact.worksmobile.com/p/web/shared/contact`）。押したときの動き（LINE ID をコピー → 新しいタブで開く）は同じ。ボタンの説明（aria-label / title）とコメントを「連絡先を開く」に |
| docs/**deploy-v2.2.188.md** | 本体を `main.67fc2dd5.js` に。出したあとの確認 6 の開き先 |

## 確認（ローカル）
- `npm run build` 成功 → **`main.67fc2dd5.js` ／ `main.b8a7c60b.css`**（CSS は変わらず）
- 開いた先の画面（LINE WORKS の連絡先）はログインが要るため確認していない

## 差分
```diff
diff --git a/frontend/src/components/information/LineIdRow.tsx b/frontend/src/components/information/LineIdRow.tsx
index afcbab73..765217cc 100644
--- a/frontend/src/components/information/LineIdRow.tsx
+++ b/frontend/src/components/information/LineIdRow.tsx
@@ -4,11 +4,11 @@ import TableInput from './TableInput';
 /**
  * 顧客の編集画面（InformationEdit / Kaeru / Resale）の連絡先の LINE ID 欄と LINE アイコン。
  *
- * ⚠️⚠️ アイコンは「LINE ID をコピー」して「LINE WORKS のトークを新しいタブで開く」。
- *   ⚠️ お客様の個人 LINE ID を渡してトークを開く方法は無い（調査: docs/task-2026-10-12-04-line-id.md）。
- *   ⚠️ 開き先を変えるときは LINE_WORKS_TALK_URL だけ直す。
+ * ⚠️⚠️ アイコンは「LINE ID をコピー」して「LINE WORKS の連絡先（登録画面）を新しいタブで開く」。
+ *   ⚠️ お客様の個人 LINE ID からトークルームを直接開く方法は無く、先に連絡先へ登録する必要があるため。
+ *   ⚠️ 開き先を変えるときは LINE_WORKS_CONTACT_URL だけ直す。
  */
-const LINE_WORKS_TALK_URL = 'https://talk.worksmobile.com/';
+const LINE_WORKS_CONTACT_URL = 'https://contact.worksmobile.com/p/web/shared/contact';
 const LINE_GREEN = '#06C755';
 
 type Props = {
@@ -41,13 +41,13 @@ const LineWorksButton = ({ lineId }: { lineId: string | null | undefined }) => {
             await navigator.clipboard.writeText(value);
             setCopied(true);
         } catch (error) {
-            // ⚠️ コピーできなくてもトークは開く（ID は画面に出ているので手で入力できる）
+            // ⚠️ コピーできなくても連絡先は開く（ID は画面に出ているので手で入力できる）
             console.error('LINE ID をコピーできませんでした', error);
         }
-        window.open(LINE_WORKS_TALK_URL, '_blank', 'noopener,noreferrer');
+        window.open(LINE_WORKS_CONTACT_URL, '_blank', 'noopener,noreferrer');
     };
 
-    const label = enabled ? `LINE ID（${value}）をコピーして LINE WORKS を開く` : 'LINE ID が未入力です';
+    const label = enabled ? `LINE ID（${value}）をコピーして LINE WORKS の連絡先を開く` : 'LINE ID が未入力です';
 
     return (
         <span className="d-inline-flex align-items-center" style={{ verticalAlign: 'middle' }}>
```
