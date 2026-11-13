# 作業記録 v2.2.262　媒介・いえらぶ手順書を Dashboard の画面に（不動産企画係）

## 依頼（2026-11-10）
- 「realtyディレクトリのコンテンツにできないか /frontend/src/components/Menu.tsxの 点検・管理 の項目に追加して適切な英名のコンポネントとメニュー名を追加してほしい 同じ262のブランチで」
- 計画（JSX の画面にする・ログインした人だけ・画像は import・React.lazy）を出し、「すすめてよい」。

## 決めたこと
- 「点検・管理」の見出しは Menu.tsx ではなく、Menu.tsx が不動産企画係のときに出す `realty/RealtyMenu.tsx` にある → ここに1行足した（Menu.tsx は変えていない）。
- コンポーネント：`realty/manual/RealtyManual.tsx`、URL：`/realtyManual`（1段）、メニュー名：**「媒介・いえらぶ手順書」**、アイコン `fa-book-open`。並びは「コンプライアンス」と「設定・データ管理」の間。
  - ⚠️ 計画では「営業手順書（媒介・いえらぶ）」としたが、選ばれたとき（太字）にメニューの幅で2行に折り返して崩れたので、ほかの項目と同じくらいの長さに縮めた。
- HTML を public に置いて iframe で読む方式はやめた（ログインしなくても開けてしまい、画面の写真が外から見える）。本文を JSX に書き直し、画像は import（webpack が `static/media/` に出す）。
- `React.lazy` で、開いたときだけ読む（手順書の js と画像は、ほかの画面を開いても読まれない）。
- 目次・本文の「6章」などは `scrollIntoView`（URL の `#` を使うとルーターの URL が変わるため）。
- 印刷は、`@media print` で手順書以外を `visibility: hidden` にし、手順書だけを出す。
- 業務ガイドの「画面を開く」ボタン（`GUIDE_SCREENS`）には登録しなかった。⚠️ 計画では登録すると書いたが、事業の型（`GuideDivision`）に realty が無く、ほかの不動産企画係の画面も1つも登録されていないため、それにそろえた。
- 配る用の1ファイル版（`docs/manual/realty-media-ielove-manual.html`）は残す。画面と中身をそろえるため、FAQ の担当者の例に出していた社員名を両方から外した。

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/realty/manual/ | **RealtyManual.tsx**（新規） | 手順書の画面。部品 `Jump`・`Chapter`・`Fig`・`Ui`、章の一覧 `CHAPTERS`、専用の `<style>`（接頭辞 `rm_`） |
| frontend/src/components/realty/manual/img/ | **01_leadsell.png 〜 08_buy_picker.png**（新規・13枚） | 見本データで撮った画面の写真（前の作業 task-06 と同じもの） |
| frontend/src/components/realty/ | RealtyMenu.tsx | 「点検・管理」に `{ id: 'manual', path: '/realtyManual', … }` |
| frontend/src/ | App.tsx | `lazy` の `RealtyManual`、`/realtyManual` のルート（`RealtyRoute` と `Suspense` で包む） |
| backend/scripts/guide/articles/common/ | **screen-265.md**（新規） | 記事「媒介・いえらぶ手順書（不動産企画係）」 |
| backend/scripts/sql/ | 2026-11-10_update_log_2.2.262.sql | 更新履歴の文に手順書を追加、記事の SQL を末尾に（ローカルにも流した。update_log は no=361 の文を UPDATE） |
| docs/manual/ | realty-media-ielove-manual.html | FAQ の社員名を外した |
| docs/ | deploy-v2.2.262.md・realty-handoff.md | 手順書の追加を反映 |

## 業務ガイドの記事
- 新規「**媒介・いえらぶ手順書（不動産企画係）**」（common/screen-265.md、並び 265）：メニューの場所、書いてあること（8章）、目次・印刷の使い方、写真は見本データであること、CSV の取り込みの担当を係で決めること。
  - ⚠️ ローカルでは最初「営業手順書（不動産企画係）」で入れたので、`UPDATE guide_article SET title = …` で直してから流し直した（本番は新しい題名で1回だけ入る）。

## テスト（ローカル。Playwright・3100）
`scratchpad/man/t_page.cjs`（仮スタッフ 999999 を作り、最後に消す）
- OK メニューの位置（点検・管理 → コンプライアンス → 手順書 → 設定）
- OK メニューから /realtyManual へ移る・選ばれた色（スクリーンショットで確認。メニュー名は1行に収まる）
- OK 1400px・390px とも：章が8つ、画像13枚がすべて読み込める、目次で6章へ移る、本文の「6章」で移る、URL は変わらない、横にはみ出さない
- OK 印刷：メニューは隠れ、本文は出る、目次は出ない
- OK 不動産企画係でない人（order）は手順書に入れない
- OK 仮スタッフ 999999 を消した（0件）
- ⚠️ コンソールに出る警告は `Menu.tsx:66` の `({ key, onReload })`（key を props で受けている）の既存のものだけ。今回の変更とは関係ない（/broker でも出る）。
- 初回は 390px で 188px 横にはみ出した → 親が flex で `min-width: auto` のため、中の表（min-width 520px）に合わせて広がっていた。`.rm_root` に `flex: 1 1 auto; min-width: 0;` を付けて直した。
- 本文の「台帳」が青く見えた → 2倍に拡大して撮ると黒。縮小したスクリーンショットのにじみだった。
- ① 経由でトークン無し：`{"request":"broker","roll":"ielove_candidates"}`・`{"request":"planner","roll":"state"}` とも 401（② まで届く）。手順書の画面は新しい request を使わない。
- 型チェック（tsc）は通った。ESLint はエラー0（警告3件は App.tsx の既存の `Hab`・`Dev`・useEffect）。
- 3100 は netstat → taskkill で止めた。

## リファクタリング
- import の途中に置いた `const RealtyManual = lazy(…)` を、import の後ろへ移した（CRA の import/first）。
- そのほか重複・使っていない変数は無し。

## git diff（App.tsx・RealtyMenu.tsx・記事・配る用の HTML）
```diff
diff --git a/backend/scripts/guide/articles/common/screen-265.md b/backend/scripts/guide/articles/common/screen-265.md
new file mode 100644
index 000000000..f7a0063b8
--- /dev/null
+++ b/backend/scripts/guide/articles/common/screen-265.md
@@ -0,0 +1,29 @@
+---
+title: 媒介・いえらぶ手順書（不動産企画係）
+section: 画面の使い方
+sort: 265
+summary: 媒介を取ってから、いえらぶに登録し、ポータルの買い反響が媒介獲得台帳につながるまでの手順と気をつけることを、画面の写真付きで読む。
+---
+不動産企画係の左のメニュー「媒介・いえらぶ手順書」で開きます。媒介を取ったときに営業がすることを、画面の写真付きで、順番にまとめた手順書です。新しく係に入った人への説明や、手順を忘れたときの確認に使ってください。
+
+## 書いてあること
+1. 全体の流れ（営業がすることと、自動で行われること）
+2. 媒介紐付（売り反響から媒介獲得台帳を作る）
+3. 媒介獲得台帳で、いえらぶとのつながりの札を確かめる
+4. いえらぶに登録するときの決まり（所在地・建物名は台帳からコピーして貼り付ける、担当店舗、種別の合わせ方）
+5. いえらぶの物件一覧（CSV）を取り込む
+6. 「要確認」のときの選び方と、違う物件につながったときの直し方
+7. 買い反響と台帳のつながり
+8. よくある質問
+
+## 使い方
+- 上の目次を押すと、その章へ移ります
+- 「印刷する」を押すと、手順書だけを印刷できます（左のメニューなどは出ません）
+
+> 注意：手順書の写真は、説明用の見本データ（「見本 一郎」など）で撮っています。実際のお客様の情報ではありません。
+
+> 要確認：CSV をだれが・いつ取り込むかは、係の中で決めてください。取り込まないと、台帳は「いえらぶ未採番」のまま、買い反響も台帳につながりません。
+
+## 関係する記事
+- [[設定（不動産企画係）]]
+- [[反響から商談案件へのつながり（不動産企画係）]]
diff --git a/docs/manual/realty-media-ielove-manual.html b/docs/manual/realty-media-ielove-manual.html
index 40b439105..ab66539a9 100644
--- a/docs/manual/realty-media-ielove-manual.html
+++ b/docs/manual/realty-media-ielove-manual.html
@@ -365,7 +365,7 @@ footer { color: var(--sub); font-size: 12px; text-align: center; margin-top: 28p
     <dt>台帳の所在地を直したら、いえらぶも直す必要がありますか</dt>
     <dd>はい。台帳の所在地を直したら、いえらぶの所在地も、台帳からコピーして貼り付け直してください。ずれたままだと、次の物件の突き合わせで迷う原因になります。</dd>
     <dt>担当者の欄の書き方は</dt>
-    <dd>反響・台帳・商談案件とも、空白なしの氏名（例：時任聡一朗）にそろえています。選択肢から選べば、そのまま入ります。</dd>
+    <dd>反響・台帳・商談案件とも、空白なしの氏名にそろえています。選択肢から選べば、そのまま入ります。</dd>
   </dl>
   <div class="note">
     <span class="tag">困ったとき</span>
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index 11b3ca762..0dd7b29d9 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -1,4 +1,4 @@
-import React, { useEffect, useState } from "react";
+import React, { Suspense, lazy, useEffect, useState } from "react";
 import { GoogleOAuthProvider } from '@react-oauth/google';
 import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
 import Calendar from "./components/calendar/Calendar";
@@ -56,6 +56,9 @@ import CallNavi from "./components/realty/navi/CallNavi";
 import UsedCallQueue from "./components/callq/UsedCallQueue";
 import Guide from "./components/guide/Guide";
 
+// ⚠️ v2.2.262: 不動産企画係の営業手順書は画像が多いので、開いたときだけ読み込む
+const RealtyManual = lazy(() => import("./components/realty/manual/RealtyManual"));
+
 const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ['marker'];
 
 export default function App() {
@@ -209,6 +212,7 @@ function AppInner() {
             {/* ⚠️ v2.2.223: 週次行動計画・コンプライアンス・設定（本番アプリから移植） */}
             <Route path="/realtyWeekly" element={<RealtyRoute><WeeklyPlan /></RealtyRoute>} />
             <Route path="/realtyCompliance" element={<RealtyRoute><Compliance /></RealtyRoute>} />
+            <Route path="/realtyManual" element={<RealtyRoute><Suspense fallback={<div className="p-3 text-secondary small">読み込み中…</div>}><RealtyManual /></Suspense></RealtyRoute>} />
             <Route path="/realtySettings" element={<RealtyRoute><RealtySettings /></RealtyRoute>} />
             {/* ⚠️ v2.2.225: 以前のアプリのメニューから移した画面・まだ移していない画面の案内（realty/RealtyMenu.tsx） */}
             <Route path="/realtySales" element={<RealtyRoute><MonthlySales /></RealtyRoute>} />
diff --git a/frontend/src/components/realty/RealtyMenu.tsx b/frontend/src/components/realty/RealtyMenu.tsx
index 9ed03106f..8db2ade34 100644
--- a/frontend/src/components/realty/RealtyMenu.tsx
+++ b/frontend/src/components/realty/RealtyMenu.tsx
@@ -44,6 +44,8 @@ export const REALTY_MENU: Group[] = [
         label: '点検・管理', items: [
             { id: 'quality', path: '/realtyPending?view=quality', icon: 'fa-magnifying-glass', label: 'データ品質チェック', pending: true },
             { id: 'comp', path: '/realtyCompliance', icon: 'fa-triangle-exclamation', label: 'コンプライアンス' },
+            // ⚠️ v2.2.262: 営業向けの手順書（媒介紐付 → いえらぶ連携）。中身は manual/RealtyManual.tsx
+            { id: 'manual', path: '/realtyManual', icon: 'fa-book-open', label: '媒介・いえらぶ手順書' },
             { id: 'settings', path: '/realtySettings', icon: 'fa-gear', label: '設定・データ管理' },
         ],
     },
```

## git diff（update_log の SQL。先頭だけ。記事の SQL の全文はファイルを参照）
```diff
diff --git a/backend/scripts/sql/2026-11-10_update_log_2.2.262.sql b/backend/scripts/sql/2026-11-10_update_log_2.2.262.sql
index c66d77016..782494a72 100644
--- a/backend/scripts/sql/2026-11-10_update_log_2.2.262.sql
+++ b/backend/scripts/sql/2026-11-10_update_log_2.2.262.sql
@@ -5,7 +5,7 @@
 -- =====================================================================
 -- 1. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
 INSERT INTO update_log (version, date, note) VALUES
-('2.2.262', '2026-11-10', '集客サマリーの総予算の明細で、媒体の表示をやめ、請求先と詳細をそれぞれの列に分けました。上に請求先ごとの合計も出します。');
+('2.2.262', '2026-11-10', '集客サマリーの総予算の明細で、媒体の表示をやめ、請求先と詳細をそれぞれの列に分けました。上に請求先ごとの合計も出します。不動産企画係のメニューの「点検・管理」に「媒介・いえらぶ手順書」を追加しました。');
 
 -- 2. 業務ガイドの記事
 -- ---------------------------------------------------------------
@@ -45,3 +45,39 @@ INSERT INTO guide_article (title, division, section, summary, body, sort, publis
 ', 199, 1, '開発（業務ガイド更新）')
   ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
     body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
+
+-- ---------------------------------------------------------------
+-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
```

## 追加したコンポーネントの全文：frontend/src/components/realty/manual/RealtyManual.tsx
```tsx
import React from 'react';
import imgLeadSell from './img/01_leadsell.png';
import imgLinkOpen from './img/02_ledgerlink_open.png';
import imgLinkDone from './img/03_ledgerlink_done.png';
import imgBrokerUnmatched from './img/04_broker_unmatched.png';
import imgBrokerFilter from './img/04b_broker_filter.png';
import imgRegisterUnmatched from './img/05_register_unmatched.png';
import imgCopyDone from './img/05b_copy_done.png';
import imgImportPreview from './img/06_import_preview.png';
import imgImportDone from './img/06b_import_done.png';
import imgBrokerLinked from './img/07_broker_linked.png';
import imgReviewCandidates from './img/07b_review_candidates.png';
import imgRegisterLinked from './img/07c_register_linked.png';
import imgBuyPicker from './img/08_buy_picker.png';

/**
 * 媒介・いえらぶ手順書（不動産企画係。v2.2.262）。
 *
 * ⚠️ 中身は docs/manual/realty-media-ielove-manual.html（メールなどで配る1ファイルの版）と同じ。どちらかを直したら、もう一方も直す。
 * ⚠️ 画像は説明用の見本データ（「見本 一郎」など）で撮ったもの。撮り直すときも本物のお客様の情報を写さない。
 * ⚠️ 画面の中の移動（目次・「6章」など）は scrollIntoView で行う（URL の # を使うとルーターの URL が変わるため）。
 * ⚠️ 印刷のときは、この画面だけを出す（左のメニュー・ヘッダーは visibility で隠す）。
 */

const STYLE = `
.rm_root {
  --rm-ink: #1d2733; --rm-sub: #5b6876; --rm-line: #dde3e8; --rm-paper: #ffffff; --rm-ground: #f3f5f2;
  --rm-accent: #1f6b5c; --rm-accent-soft: #e4f1ec; --rm-warn: #9a5b00; --rm-warn-soft: #fff4dc; --rm-stop: #b42318; --rm-stop-soft: #fdecea;
  background: var(--rm-ground); color: var(--rm-ink); font-size: 14px; line-height: 1.85; padding: 0 0 40px; border-radius: 8px;
  /* ⚠️ 親が flex なので、min-width: 0 が無いと中の表（min-width 520px）に合わせて広がり、スマホで横にはみ出す */
  flex: 1 1 auto; min-width: 0;
}
.rm_wrap { max-width: 980px; margin: 0 auto; padding: 0 20px; }
.rm_cover { background: var(--rm-accent); color: #fff; padding: 32px 0 28px; margin-bottom: 24px; border-radius: 8px 8px 0 0; }
.rm_eyebrow { font-size: 12px; letter-spacing: .14em; opacity: .85; margin: 0 0 6px; }
.rm_cover h1 { font-weight: 900; font-size: clamp(22px, 3.6vw, 32px); line-height: 1.35; margin: 0 0 12px; text-wrap: balance; color: #fff; }
.rm_cover p { margin: 0; max-width: 46em; opacity: .95; }
.rm_meta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 12px; margin-top: 14px; }
.rm_meta span { opacity: .8; }
.rm_print { background: #fff; color: var(--rm-accent); border: 0; border-radius: 6px; padding: 3px 12px; font-size: 12px; font-weight: 700; }
.rm_print:hover { background: var(--rm-accent-soft); }
.rm_print:focus-visible, .rm_jump:focus-visible { outline: 2px solid #f5c242; outline-offset: 2px; }

.rm_toc { background: var(--rm-paper); border: 1px solid var(--rm-line); border-radius: 10px; padding: 16px 22px; margin-bottom: 24px; }
.rm_toc h2 { font-size: 13px; letter-spacing: .1em; color: var(--rm-sub); margin: 0 0 6px; border: 0; padding: 0; display: block; }
.rm_toc ol { margin: 0; padding-left: 1.4em; columns: 2; column-gap: 32px; }
.rm_jump { background: none; border: 0; padding: 0; color: var(--rm-ink); text-align: left; font: inherit; cursor: pointer; }
.rm_jump:hover { color: var(--rm-accent); text-decoration: underline; }
.rm_root p .rm_jump, .rm_root td .rm_jump, .rm_root dd .rm_jump { color: var(--rm-accent); text-decoration: underline; }

.rm_chapter { background: var(--rm-paper); border: 1px solid var(--rm-line); border-radius: 12px; padding: 28px 32px; margin-bottom: 20px; scroll-margin-top: 12px; }
.rm_chapter h2 {
  font-weight: 700; font-size: 20px; line-height: 1.4; margin: 0 0 16px; padding-bottom: 10px;
  border-bottom: 2px solid var(--rm-accent-soft); text-wrap: balance; display: flex; gap: 12px; align-items: baseline; color: var(--rm-ink);
}
.rm_no { color: var(--rm-accent); font-size: 15px; letter-spacing: .06em; flex-shrink: 0; }
.rm_chapter h3 { font-size: 15px; font-weight: 700; margin: 24px 0 8px; }
.rm_root p { margin: 0 0 12px; }
.rm_lead { color: var(--rm-sub); }
.rm_root ul, .rm_root ol { padding-left: 1.4em; margin: 0 0 12px; }
.rm_root li { margin: 2px 0; }
.rm_ui { font-weight: 700; color: var(--rm-accent); white-space: nowrap; }

.rm_root .rm_flow { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 4px; padding: 0; list-style: none; }
.rm_flow li { flex: 1 1 150px; background: var(--rm-accent-soft); border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.6; margin: 0; }
.rm_flow li b { display: block; font-size: 14px; color: var(--rm-accent); }
.rm_flow li.you { background: #fff; border: 2px solid var(--rm-accent); }
.rm_flow li.auto { background: #f5f7f9; color: var(--rm-sub); }
.rm_flow li.auto b { color: var(--rm-sub); }
.rm_legend { font-size: 12px; color: var(--rm-sub); margin-top: 8px; }
.rm_legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; margin: 0 4px 0 10px; }

.rm_root .rm_steps { counter-reset: rmstep; list-style: none; padding: 0; margin: 14px 0; }
.rm_steps > li { counter-increment: rmstep; position: relative; padding-left: 44px; margin: 0 0 22px; }
.rm_steps > li::before {
  content: counter(rmstep); position: absolute; left: 0; top: 1px; width: 30px; height: 30px; border-radius: 50%;
  background: var(--rm-accent); color: #fff; font-weight: 700; font-size: 14px; display: grid; place-items: center; font-variant-numeric: tabular-nums;
}
.rm_steps > li > p:first-child { font-weight: 500; }

.rm_root figure { margin: 12px 0 6px; }
.rm_root figure img { display: block; max-width: 100%; height: auto; border: 1px solid var(--rm-line); border-radius: 8px; box-shadow: 0 2px 10px rgba(29,39,51,.06); }
.rm_root figcaption { font-size: 12.5px; color: var(--rm-sub); margin-top: 6px; }

.rm_note, .rm_warn, .rm_stop { border-radius: 8px; padding: 12px 16px; margin: 14px 0; font-size: 13.5px; }
.rm_note { background: var(--rm-accent-soft); }
.rm_warn { background: var(--rm-warn-soft); border-left: 4px solid #e7a52c; }
.rm_stop { background: var(--rm-stop-soft); border-left: 4px solid var(--rm-stop); }
.rm_note > :last-child, .rm_warn > :last-child, .rm_stop > :last-child { margin-bottom: 0; }
.rm_tag { font-size: 12px; font-weight: 700; letter-spacing: .06em; display: block; margin-bottom: 2px; }
.rm_note .rm_tag { color: var(--rm-accent); }
.rm_warn .rm_tag { color: var(--rm-warn); }
.rm_stop .rm_tag { color: var(--rm-stop); }

.rm_tblwrap { overflow-x: auto; margin: 10px 0 14px; }
.rm_tbl { border-collapse: collapse; width: 100%; font-size: 13.5px; min-width: 520px; }
.rm_tbl th, .rm_tbl td { border: 1px solid var(--rm-line); padding: 8px 10px; text-align: left; vertical-align: top; }
.rm_tbl th { background: #f6f8f7; font-weight: 700; white-space: nowrap; }
.rm_badge { display: inline-block; font-size: 12px; font-weight: 700; border-radius: 4px; padding: 1px 8px; white-space: nowrap; }
.rm_b-ok { background: #3f9a6a; color: #fff; }
.rm_b-review { background: #f5c242; color: #3a2a00; }
.rm_b-un { background: #f1f3f5; color: #6b7480; border: 1px solid #dfe3e7; }
.rm_b-none { background: #a7b0b9; color: #fff; }

.rm_rule { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
.rm_rule > div { border-radius: 8px; padding: 12px 14px; font-size: 13.5px; }
.rm_rule .ng { background: var(--rm-stop-soft); }
.rm_rule .ok { background: var(--rm-accent-soft); }
.rm_rule .h { font-weight: 700; display: block; margin-bottom: 4px; }
.rm_rule .ng .h { color: var(--rm-stop); }
.rm_rule .ok .h { color: var(--rm-accent); }
.rm_root code { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: .92em; background: #f1f3f2; color: var(--rm-ink); border-radius: 4px; padding: 0 4px; }

.rm_faq dt { font-weight: 700; margin-top: 16px; }
.rm_faq dt::before { content: "Q. "; color: var(--rm-accent); }
.rm_faq dd { margin: 4px 0 0 0; padding-left: 1.6em; }
.rm_faq dd::before { content: "A. "; margin-left: -1.6em; color: var(--rm-sub); font-weight: 700; }

.rm_foot { color: var(--rm-sub); font-size: 12px; text-align: center; margin-top: 24px; }

@media (max-width: 720px) {
  .rm_wrap { padding: 0 12px; }
  .rm_chapter { padding: 20px 16px; }
  .rm_toc ol { columns: 1; }
  .rm_rule { grid-template-columns: 1fr; }
  .rm_steps > li { padding-left: 38px; }
}
@media print {
  body * { visibility: hidden; }
  .rm_root, .rm_root * { visibility: visible; }
  .rm_root { position: absolute; left: 0; top: 0; width: 100%; background: #fff; font-size: 12.5px; padding: 0; }
  .rm_cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 20px 0; }
  .rm_chapter { border: 0; padding: 0; margin: 0 0 18px; }
  .rm_root figure { break-inside: avoid; }
  .rm_toc, .rm_print { display: none; }
}
`;

const CHAPTERS: { id: string; title: string }[] = [
    { id: 'rm-flow', title: '全体の流れ' },
    { id: 'rm-link', title: '媒介紐付（媒介を取ったとき）' },
    { id: 'rm-ledger', title: '媒介獲得台帳で確かめる' },
    { id: 'rm-ielove', title: 'いえらぶに登録するときの決まり' },
    { id: 'rm-import', title: 'いえらぶの物件を Dashboard に取り込む' },
    { id: 'rm-check', title: 'つながり方を確かめる・直す' },
    { id: 'rm-buy', title: '買い反響と台帳のつながり' },
    { id: 'rm-share', title: 'そのほか共有しておくこと' },
];

/** 画面の中の章へ移る（目次・本文の「〇章」） */
const Jump: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
    <button type="button" className="rm_jump" onClick={() => document.getElementById(to)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
        {children}
    </button>
);

/** 章の見出し（番号は CHAPTERS の並び） */
const Chapter: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
    const index = CHAPTERS.findIndex(c => c.id === id);
    return (
        <section className="rm_chapter" id={id}>
            <h2><span className="rm_no">{index + 1}</span>{CHAPTERS[index]?.title}</h2>
            {children}
        </section>
    );
};

const Fig: React.FC<{ src: string; alt: string; caption?: string }> = ({ src, alt, caption }) => (
    <figure>
        <img src={src} alt={alt} loading="lazy" />
        {caption && <figcaption>{caption}</figcaption>}
    </figure>
);

const Ui: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="rm_ui">{children}</span>;

const RealtyManual: React.FC = () => (
    <div className="rm_root">
        <style>{STYLE}</style>
        <header className="rm_cover">
            <div className="rm_wrap">
                <p className="rm_eyebrow">不動産企画係　営業向け手順書</p>
                <h1>媒介を取ったら、いえらぶまで<br />つなぐための手順</h1>
                <p>売り反響から媒介獲得台帳を作り、いえらぶに物件を登録し、ポータルから届く買い反響が台帳へ自動でつながるまでの流れと、気をつけることをまとめました。</p>
                <div className="rm_meta">
                    <span>Dashboard ver2.2.260 以降　／　2026年11月 作成</span>
                    <button type="button" className="rm_print" onClick={() => window.print()}>
                        <i className="fa-solid fa-print me-1"></i>印刷する
                    </button>
                </div>
            </div>
        </header>

        <div className="rm_wrap">
            <nav className="rm_toc" aria-label="目次">
                <h2>目次</h2>
                <ol>
                    {CHAPTERS.map(c => <li key={c.id}><Jump to={c.id}>{c.title}</Jump></li>)}
                </ol>
            </nav>

            <Chapter id="rm-flow">
                <p>媒介を取ってから、ポータルの問い合わせが台帳につながるまでは、次の順に進みます。<b>白い枠</b>が営業の作業で、<b>灰色</b>は Dashboard が自動で行います。</p>
                <ol className="rm_flow">
                    <li className="you"><b>① 媒介紐付</b>売り反響の画面で、媒介獲得台帳を作る</li>
                    <li className="you"><b>② いえらぶに登録</b>台帳の所在地・建物名を<strong>コピーして貼り付ける</strong></li>
                    <li className="you"><b>③ CSV を取り込む</b>いえらぶの物件一覧を Dashboard に上げる</li>
                    <li className="auto"><b>④ 台帳とつながる</b>所在地・種別が同じ物件に自動でつながる</li>
                    <li className="auto"><b>⑤ 買い反響がつながる</b>SUUMO・HOME'S・アットホームの問い合わせが台帳へ</li>
                </ol>
                <p className="rm_legend">
                    <i style={{ background: '#fff', border: '2px solid var(--rm-accent)' }}></i>営業の作業
                    <i style={{ background: '#f5f7f9', border: '1px solid var(--rm-line)' }}></i>自動
                </p>
                <div className="rm_note">
                    <span className="rm_tag">なぜ大事か</span>
                    <p>台帳といえらぶの物件がつながると、ポータルから届いた買い反響が「どの媒介物件への問い合わせか」まで自動で記録されます。物件ごとの反響数や、自社で客付けした割合を正しく数えるための土台です。</p>
                </div>
            </Chapter>

            <Chapter id="rm-link">
                <p className="rm_lead">媒介獲得台帳は、<b>必ず売り反響から</b>作ります。台帳の画面からは新しく作れません。どの反響から来た売主かを、あとで辿れるようにするためです。</p>
                <ol className="rm_steps">
                    <li>
                        <p>左のメニューの<Ui>売り反響（一括査定）</Ui>を開き、該当の反響の行の右の方にある<Ui>🔗 媒介紐付</Ui>を押します。</p>
                        <Fig src={imgLeadSell} alt="売り反響の一覧。行の右端に「媒介紐付」のボタンがある" caption="段階を「媒介受託」に変えたときや、編集画面で媒介受託にして保存したときも、同じ画面が開きます。" />
                    </li>
                    <li>
                        <p>売り反響の内容が入った状態で、登録の画面が開きます。<b>* の付いた項目はすべて必須</b>です。確かめて、足りないところを直します。</p>
                        <Fig src={imgLinkOpen} alt="媒介紐付の画面。媒介の種類・契約日・満了日・売出価格・担当者・売主・所在地・種別などの欄" />
                        <ul>
                            <li><b>媒介の種類</b>：専属専任媒介／専任媒介／一般媒介</li>
                            <li><b>媒介契約日</b>：未来の日付は入れられません</li>
                            <li><b>有効期間の満了日</b>：最初は「契約日の3か月後の前日」が入ります。専属専任・専任は3か月を超えられません（宅建業法）</li>
                            <li><b>売出価格・担当者・売主・物件の所在地・物件の種別</b></li>
                            <li>種別が<b>マンション</b>のときは、<b>建物名</b>と<b>部屋番号</b>も入れてください（建物名は必須）</li>
                        </ul>
                        <div className="rm_warn">
                            <span className="rm_tag">ここで入れる所在地が、いえらぶとつなぐ「鍵」になります</span>
                            <p>所在地は<b>番地まで正確に</b>入れてください（例：<code>鹿児島市テスト町5丁目5-5</code>）。番地が無い・途中までしか無いと、あとでいえらぶの物件と自動でつながりません。地図の URL が付いていても構いません（比べるときは無視します）。</p>
                        </div>
                    </li>
                    <li>
                        <p><Ui>登録</Ui>を押すと、媒介獲得台帳に1行ができ、売り反響の段階が「媒介受託」になります。<Ui>媒介獲得台帳で No.〇 を開く</Ui>で、その台帳へ移れます。</p>
                        <Fig src={imgLinkDone} alt="登録の結果。媒介獲得台帳を作り、売り反響を媒介受託にしました" />
                        <p>以前に同じ物件を媒介・買取していれば、「以前の台帳と同じ物件に紐づけました」と出ます。</p>
                    </li>
                </ol>
            </Chapter>

            <Chapter id="rm-ledger">
                <p>左のメニューの<Ui>媒介獲得台帳</Ui>を開くと、作った台帳が並んでいます。いちばん右の<b>「ポータル連携（いえらぶ）」</b>の列が、いえらぶの物件とのつながりです。</p>
                <Fig src={imgBrokerUnmatched} alt="媒介獲得台帳の一覧。ポータル連携（いえらぶ）の列に「いえらぶ未採番」" caption="登録した直後は、いえらぶにまだ物件が無いので「いえらぶ未採番」です。いえらぶに登録して取り込むと、自動でつながります。" />
                <div className="rm_tblwrap">
                    <table className="rm_tbl">
                        <thead><tr><th>札</th><th>意味</th><th>すること</th></tr></thead>
                        <tbody>
                            <tr><td><span className="rm_badge rm_b-ok">No.274111</span></td><td>いえらぶの物件番号につながっている</td><td>なし</td></tr>
                            <tr><td><span className="rm_badge rm_b-review">要確認 2件</span></td><td>所在地が近い物件が見つかったが、1件に決められない</td><td>札を押して、候補から選んで保存（<Jump to="rm-check">6章</Jump>）</td></tr>
                            <tr><td><span className="rm_badge rm_b-un">いえらぶ未採番</span></td><td>所在地が同じ物件が、いえらぶにまだ無い</td><td>いえらぶに登録して、CSV を取り込む（<Jump to="rm-ielove">4章</Jump>・<Jump to="rm-import">5章</Jump>）</td></tr>
                            <tr><td><span className="rm_badge rm_b-none">該当なし</span></td><td>いえらぶに載せない物件にした</td><td>なし</td></tr>
                        </tbody>
                    </table>
                </div>
                <p>一覧の上の<Ui>⑥ いえらぶ</Ui>で、「要確認」「いえらぶ未採番」の台帳だけに絞れます。件数も出ます。</p>
                <Fig src={imgBrokerFilter} alt="媒介獲得台帳の絞り込み。⑥いえらぶ" />
                <div className="rm_note">
                    <span className="rm_tag">ついでに確かめること</span>
                    <p>同じ一覧の「REINZ」の列に<b>レインズ登録の期限</b>（専属専任は5営業日・専任は7営業日）、「販売報告」の列に<b>次の販売報告の期限</b>（専属専任は7日・専任は14日ごと）が出ます。期限が近いと黄色、過ぎると赤です。</p>
                </div>
            </Chapter>

            <Chapter id="rm-ielove">
                <p className="rm_lead">Dashboard は、台帳といえらぶの物件を<b>所在地と種別</b>（マンションは建物名・部屋番号も）で突き合わせて、自動でつなぎます。表記が1文字でもずれると自動でつながらず、手で直す手間が増えます。</p>
                <div className="rm_stop">
                    <span className="rm_tag">いちばん大事な決まり</span>
                    <p>いえらぶに物件を登録するときは、<b>所在地と建物名を、Dashboard の台帳から「コピー」して「貼り付け」</b>てください（Ctrl+C → Ctrl+V）。手で打ち直さないでください。</p>
                </div>
                <ol className="rm_steps">
                    <li><p>媒介獲得台帳で、その台帳の札（または行の<Ui>編集</Ui>）を押して、編集画面を開きます。</p></li>
                    <li>
                        <p>番地の欄の下にある<Ui>所在地をコピー</Ui>を押します。マンションなら<Ui>建物名をコピー</Ui>も使います。</p>
                        <Fig src={imgRegisterUnmatched} alt="台帳の編集画面。所在地をコピー・建物名をコピーのボタン" />
                        <Fig src={imgCopyDone} alt="所在地をコピーしましたの表示" caption="「所在地をコピーしました」と出れば、コピーできています。地図の URL は自動で外れます。" />
                    </li>
                    <li><p>いえらぶ cloud の物件の登録画面で、所在地の欄に<b>貼り付け</b>ます（Ctrl+V）。建物名も同じように貼り付けます。</p></li>
                </ol>

                <h3>いえらぶの登録で気をつけること</h3>
                <ul>
                    <li><b>担当店舗</b>は「<b>国分ハウジンググループ中古住宅専門店</b>」にしてください。Dashboard は、この店舗の物件だけを台帳と突き合わせます。</li>
                    <li><b>物件種別</b>は、台帳の種別に合うものを選んでください（下の表）。合わないと「要確認」になります。</li>
                    <li><b>所在地には番地まで</b>入れ、建物名・部屋番号は所在地に混ぜず、それぞれの欄に入れてください。</li>
                    <li><b>マンション</b>は部屋番号も入れてください。同じ建物の別の部屋と区別するためです。</li>
                    <li>同じ住所に区画が2つある土地（A区画・B区画など）は、自動では決められず「要確認」になります。台帳の画面で候補から選んでください。</li>
                </ul>
                <div className="rm_tblwrap">
                    <table className="rm_tbl">
                        <thead><tr><th>台帳の種別</th><th>いえらぶの物件種別</th></tr></thead>
                        <tbody>
                            <tr><td>戸建</td><td>中古一戸建て（新築一戸建て）</td></tr>
                            <tr><td>マンション</td><td>中古マンション</td></tr>
                            <tr><td>住宅用地</td><td>売地</td></tr>
                            <tr><td>賃収マンション</td><td>マンション（建物全部）・アパート</td></tr>
                            <tr><td>賃収・事業用</td><td>アパート・ビル（建物全部）・マンション（建物全部）・売地</td></tr>
                        </tbody>
                    </table>
                </div>
                <div className="rm_rule">
                    <div className="ng"><span className="h">つながらない例</span>台帳「鹿児島市テスト町5丁目5-5」／いえらぶ「鹿児島市テスト町5丁目<b>5</b>」（番地が途中まで）<br />台帳「戸建」／いえらぶ「<b>売地</b>」（種別が違う）</div>
                    <div className="ok"><span className="h">そろえなくてよい違い</span>「鹿児島県」の有無、全角・半角、空白、「5丁目5-5」と「５丁目５番５号」と「5-5-5」の違いは、自動でそろえて比べます。</div>
                </div>
            </Chapter>

            <Chapter id="rm-import">
                <div className="rm_warn">
                    <span className="rm_tag">2026年11月から</span>
                    <p>いえらぶのログインに2段階認証（メール）が必要になり、以前のような<b>毎日の自動の取り込みができなくなりました</b>。いえらぶに物件を登録・更新したら、次の手順で取り込んでください。</p>
                </div>
                <ol className="rm_steps">
                    <li><p>いえらぶ cloud の<Ui>売買物件一覧</Ui>を、店舗ごとに開きます。</p></li>
                    <li><p><Ui>一覧をダウンロード</Ui> → <Ui>CSV形式でダウンロード</Ui>で、ファイル（<code>sale_日付.csv</code>）を保存します。</p></li>
                    <li>
                        <p>Dashboard の左のメニューの<Ui>設定・データ管理</Ui>を開き、「いえらぶの物件一覧を取り込む（CSV）」でファイルを選びます。店舗ごとの複数のファイルを、まとめて選べます。</p>
                        <p>件数（新しい物件・更新・価格の変更）が出るので、確かめて<Ui>取り込む</Ui>を押します。</p>
                        <Fig src={imgImportPreview} alt="いえらぶの物件一覧を取り込む（CSV）のカード。件数と取り込むボタン" />
                    </li>
                    <li>
                        <p>「取り込みました」と出れば終わりです。同時に台帳との突き合わせも動き、<b>新しくつながった台帳・買い反響の件数</b>が出ます。</p>
                        <Fig src={imgImportDone} alt="取り込みました。媒介獲得台帳1件が新しくいえらぶの物件につながりました" />
                    </li>
                </ol>
                <ul>
                    <li>ファイルは、いえらぶから<b>ダウンロードしたまま</b>選んでください。Excel で開いて保存し直すと、物件番号の形が崩れることがあります。</li>
                    <li>同じ物件は上書きします。CSV に無い項目は、今の値のまま残ります。価格が変わったときは、価格の履歴に残ります。</li>
                    <li>いえらぶから無くなった物件は消しません。</li>
                    <li>カードの上に「今の件数」と「最後に取り込んだ日」が出ます。日付が古いままなら、取り込みを忘れていないか確かめてください。</li>
                </ul>
                <div className="rm_stop">
                    <span className="rm_tag">係で決めておくこと</span>
                    <p>だれが・いつ取り込むか（物件を登録した日ごと、毎朝など）を、係の中で決めてください。取り込まないと、台帳は「いえらぶ未採番」のまま、買い反響も台帳につながりません。</p>
                </div>
            </Chapter>

            <Chapter id="rm-check">
                <p>取り込んだあと、媒介獲得台帳の「ポータル連携（いえらぶ）」の列を見ます。</p>
                <Fig src={imgBrokerLinked} alt="台帳の一覧。No.999961 につながった台帳と、要確認 2件の台帳" caption="上はいえらぶの物件番号に自動でつながった台帳、下は候補が2件あって決められなかった台帳です。" />
                <h3>「要確認」のとき</h3>
                <ol className="rm_steps">
                    <li>
                        <p>「要確認 N件」の札を押すと、編集画面に<b>所在地が近いいえらぶの物件の候補</b>が出ます。正しい物件を押します。</p>
                        <Fig src={imgReviewCandidates} alt="要確認：所在地が近いいえらぶの物件 2件（押すとつなぎます）" />
                    </li>
                    <li><p>画面の下の<Ui>保存する</Ui>を押します。保存すると、その物件番号の過去の買い反響も台帳につながります。</p></li>
                </ol>
                <h3>自動でつながった台帳</h3>
                <p>編集画面の「掲載物件連携（いえらぶの物件）」に<b>「自動で連携」</b>と物件番号が出ます。違う物件につながっていたら、<Ui>外す</Ui>を押してから正しい物件を探して選び、保存してください。</p>
                <Fig src={imgRegisterLinked} alt="台帳の編集画面。自動で連携 No.999961" />
                <ul>
                    <li>欄には<b>物件番号・物件名・所在地の一部</b>を入れて探せます（例：<code>274111</code>、<code>西伊敷 50-3</code>）。</li>
                    <li><b>いえらぶに載せない物件</b>は<Ui>該当なし（いえらぶに載せない）</Ui>を押して保存します。以後、自動でつながりません。</li>
                    <li>人が選んだ・外した・該当なしにした台帳は、自動の突き合わせで変えられません。</li>
                </ul>
                <div className="rm_note">
                    <span className="rm_tag">すぐにつなぎたいとき</span>
                    <p>突き合わせは30分ごとと、台帳を保存したとき、CSV を取り込んだときに動きます。媒介獲得台帳の一覧の上の<Ui>いえらぶと突き合わせ</Ui>を押すと、その場で動きます。</p>
                </div>
            </Chapter>

            <Chapter id="rm-buy">
                <p><b>SUUMO・HOME'S・アットホーム</b>から届いた買い反響は、問い合わせの物件番号（いえらぶの物件番号と同じ）から、その物件の媒介獲得台帳に<b>自動で</b>紐づきます。台帳がいえらぶの物件とつながっていることが条件です。</p>
                <p>メールで届いた反響や、電話・来店の反響は自動ではつながりません。買い反響の編集画面の「問合せ物件（媒介獲得台帳）」で、<b>台帳No.・売主名・所在地の一部・いえらぶの物件番号</b>を入れて探し、候補を押して保存してください。</p>
                <Fig src={imgBuyPicker} alt="買い反響の編集画面。問合せ物件（媒介獲得台帳）の欄にいえらぶの物件番号を入れると候補が出る" />
                <ul>
                    <li>紐づけると、買い反響の一覧の「問合せ物件」に「📝No.〇」の札が出ます。</li>
                    <li>媒介終了の台帳は候補に出ません。</li>
                </ul>
            </Chapter>

            <Chapter id="rm-share">
                <dl className="rm_faq">
                    <dt>「いえらぶ未採番」がいつまでも消えません</dt>
                    <dd>いえらぶに登録したあと、CSV を取り込んだか確かめてください（<Jump to="rm-import">5章</Jump>）。取り込んでも消えないときは、いえらぶの所在地・種別・担当店舗が台帳と合っているかを見て、合っていなければ台帳の編集画面で物件番号を探して選んでください。</dd>
                    <dt>違う物件につながってしまいました</dt>
                    <dd>台帳の編集画面で<Ui>外す</Ui>を押し、正しい物件を選んで保存します。外した台帳は、自動で別の物件につながりません。</dd>
                    <dt>媒介が終わった物件をもう一度媒介しました</dt>
                    <dd>売り反響から、いつもどおり媒介紐付をしてください。同じ所在地なら「以前の台帳と同じ物件」に紐づき、台帳の一覧に「同じ物件の台帳 N件」と出ます。いえらぶの物件も、新しい台帳につながります。</dd>
                    <dt>出稿前に売れた物件は、いえらぶに登録しなくてよいですか</dt>
                    <dd>いえらぶに載せないなら、台帳の編集画面で<Ui>該当なし</Ui>にして保存してください。「いえらぶ未採番」のまま残らず、一覧で見分けやすくなります。</dd>
                    <dt>台帳の所在地を直したら、いえらぶも直す必要がありますか</dt>
                    <dd>はい。台帳の所在地を直したら、いえらぶの所在地も、台帳からコピーして貼り付け直してください。ずれたままだと、次の物件の突き合わせで迷う原因になります。</dd>
                    <dt>担当者の欄の書き方は</dt>
                    <dd>反響・台帳・商談案件とも、空白なしの氏名にそろえています。選択肢から選べば、そのまま入ります。</dd>
                </dl>
                <div className="rm_note">
                    <span className="rm_tag">困ったとき</span>
                    <p>Dashboard の右上の<Ui>業務ガイド</Ui>で「反響から商談案件へのつながり」「設定（不動産企画係）」を開くと、同じ内容をいつでも確かめられます。画面がおかしいとき・取り込みで止まるときは、システムの担当者に、画面のスクリーンショットを添えて連絡してください。</p>
                </div>
            </Chapter>

            <p className="rm_foot">この手順書の画面は、説明用の見本データ（「見本 一郎」など）で作っています。実際のお客様の情報ではありません。</p>
        </div>
    </div>
);

export default RealtyManual;
```
