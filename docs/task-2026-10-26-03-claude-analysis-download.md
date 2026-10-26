# 作業記録 2026-10-26-03　v2.2.219 Claudeによる分析のレポートを HTML でダウンロード

## 指示
- ClaudeAnalysis.tsx で html のダウンロードボタンと機能を追加

## 追加・変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/header | ClaudeAnalysis.tsx | 関数 `safeFileName`・`downloadHtml` を追加。完了したレポートの見出しの並びに「HTMLをダウンロード」ボタン（`.cla_download`） |
| frontend/src/utils | version.ts | 2.2.219 |
| backend/scripts/sql | **2026-10-26_update_log_2.2.219.sql**（新規。ガイド記事1本を含む） | |
| backend/scripts/guide/articles/common | screen-150.md（Claudeによる分析） | 「結果を見る」に、ダウンロードの1行を追加 |

## 作り
- 本文は画面がすでに取得している HTML（`ai_analysis_get` の結果）をそのまま Blob にして保存させる。② への新しい通信は無い
- ファイル名は「題_実行日.html」。題が無いときは依頼文の頭。Windows で使えない文字（`\ / : * ? " < > |` と改行）は `_` に置き換え、80字まで
- ボタンは完了し、本文を読み込み終えた分析だけに出す
- ⚠️ 右上はアクティブユーザーの枠に隠れるため、ボタンは見出しの並び（期間のタグの右）に置いた
- ダウンロードした HTML は Claude が書いたものそのまま（1ファイルで完結。スクリプトを含むことがある）。画面では sandbox の iframe で表示しているが、ダウンロードしたファイルは利用者のブラウザで普通に開かれる（社内で作ったレポートなので、ここは制限していない）

## テスト（Playwright）
- 一覧で分析を選ぶ前はボタンが出ない。完了した分析を選ぶと、見出しの並びに出る（右上の枠に隠れない）
- 押すと保存される。題に `/` `:` `?` を入れた分析で、ファイル名が `テスト：契約の動き_鹿児島_半年__2026-10-26.html` になり、中身（日本語）が画面と同じ
- フロントのビルドが通る（変えたファイルに警告なし）。テストのスタッフと分析の行は消した

---
# 差分
```diff
diff --git a/backend/scripts/guide/articles/common/screen-150.md b/backend/scripts/guide/articles/common/screen-150.md
index 1f8f0ec0..166d1c40 100644
--- a/backend/scripts/guide/articles/common/screen-150.md
+++ b/backend/scripts/guide/articles/common/screen-150.md
@@ -39,6 +39,7 @@ summary: 知りたいことを文章で頼むと、Claude がダッシュボー
 ## 結果を見る（左の「分析の一覧」）
 - 実行中の分析には「実行中」、終わったものには「完了」、失敗したものには「失敗」の印が付きます
 - 押すと右に出ます。実行中なら進み具合（何をしているか、何分たったか）が出ます
+- 完了したレポートは、題の右の「HTMLをダウンロード」で1つのファイルとして保存できます。保存したファイルはブラウザで開け、メールで送ったり会議で配ったりできます
 - 一覧には、この画面を使える人全員の分析が並びます。ほかの人の分析も開けます（開くだけなら費用はかかりません）
 - 削除できるのは、実行した本人と管理者だけです
 - 失敗したときは理由が出ます。「この依頼文を左の欄に入れる」を押すと、同じ依頼文でやり直せます
diff --git a/frontend/src/components/header/ClaudeAnalysis.tsx b/frontend/src/components/header/ClaudeAnalysis.tsx
index dbff77ef..98deb9df 100644
--- a/frontend/src/components/header/ClaudeAnalysis.tsx
+++ b/frontend/src/components/header/ClaudeAnalysis.tsx
@@ -116,6 +116,29 @@ const elapsedText = (elapsedSec: number | null, fetchedAt: number, now: number):
     return `${Math.floor(sec / 60)}分${String(sec % 60).padStart(2, '0')}秒`;
 };
 
+/** ファイル名に使えない文字を落とす（Windows で保存できない文字と改行） */
+const safeFileName = (value: string): string =>
+    value.replace(/[\\/:*?"<>|\r\n\t]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
+
+/**
+ * レポートの HTML を1つのファイルとして保存させる（v2.2.219）。
+ * ⚠️ ファイル名は「題_実行日.html」。題が無いときは依頼文の頭を使う。
+ * ⚠️ 中身は Claude が書いた HTML そのまま（1ファイルで完結しているので、そのままブラウザで開ける）。
+ */
+const downloadHtml = (job: Pick<Job, 'title' | 'prompt' | 'createdAt'>, body: string): void => {
+    const name = safeFileName(job.title !== '' ? job.title : job.prompt) || 'Claudeによる分析';
+    const date = job.createdAt.slice(0, 10);
+    const url = URL.createObjectURL(new Blob([body], { type: 'text/html;charset=utf-8' }));
+    const a = document.createElement('a');
+    a.href = url;
+    a.download = `${name}_${date}.html`;
+    document.body.appendChild(a);
+    a.click();
+    a.remove();
+    // ⚠️ すぐ消すと保存が始まらないブラウザがあるため、少し待ってから解放する
+    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
+};
+
 const errorMessageOf = (e: unknown, fallback: string): string =>
     (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
 
@@ -373,6 +396,11 @@ const ClaudeAnalysis: React.FC<Props> = ({ onClose }) => {
                                  gap: 8px; flex-wrap: wrap; }
                 .cla_view_scroll { flex: 1 1 auto; overflow: auto; padding: 14px 18px; }
                 .cla_frame { flex: 1 1 auto; width: 100%; border: 0; }
+                .cla_download { display: inline-flex; align-items: center; gap: 5px; border: 1px solid ${CLAUDE_ORANGE};
+                                background: #fff; color: ${CLAUDE_ORANGE}; border-radius: 6px; font-size: 11.5px;
+                                font-weight: 700; padding: 3px 10px; cursor: pointer; }
+                .cla_download:hover { background: #fdf8f6; }
+                .cla_download:focus-visible { outline: 2px solid ${CLAUDE_ORANGE}; outline-offset: 2px; }
                 .cla_empty { padding: 48px 24px; color: #6b7280; font-size: 12.5px; line-height: 1.9; max-width: 640px; margin: 0 auto; }
                 .cla_empty h3 { font-size: 15px; color: #1f2937; margin: 0 0 8px; font-weight: 700; }
                 .cla_running { padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px;
@@ -550,6 +578,14 @@ const ClaudeAnalysis: React.FC<Props> = ({ onClose }) => {
                                     </span>
                                     <span className="cla_tag">{scopeText(selectedJob)}</span>
                                     <span className="cla_tag">{selectedJob.from}〜{selectedJob.to}</span>
+                                    {/* ⚠️ v2.2.219: 右上はアクティブユーザーの枠に隠れるため、見出しの並びに置く */}
+                                    {selectedJob.status === 'done' && html?.id === selectedJob.id && (
+                                        <button type="button" className="cla_download"
+                                            onClick={() => downloadHtml(selectedJob, html.html)}>
+                                            <i className="fa-solid fa-download" aria-hidden="true" />
+                                            HTMLをダウンロード
+                                        </button>
+                                    )}
                                     <span className="cla_note ms-auto">
                                         {selectedJob.staffName}・{shortTime(selectedJob.createdAt)}
                                         {selectedJob.status === 'done' && selectedJob.costUsd !== null && `・約 $${selectedJob.costUsd.toFixed(2)}`}
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index d6b97500..62394927 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.218';
+export const newVersion = '2.2.219';
```
