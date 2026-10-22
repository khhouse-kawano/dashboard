# v2.2.200 トラッキング設定：GTM 用のタグも発行する（2026-10-20）

## 依頼
- GTM（Googleタグマネージャー）でタグを入れたい。フッター用のタグを GTM に入れたら DB に送られなかった。
- 「フロント側のタグ発行スクリプトを変更して。新しいブランチにて」

## 原因（kh-house.jp で確認）
- GTM はカスタム HTML の `<script src=…>` を作り直して読み込むとき、`data-site` を捨てる（Playwright で DOM を見ると `src` だけ残り、`data-site` が空）。
- tracker.js は `document.currentScript.dataset.site` が無いと何もせずに終わる → 送信されない。
- 要素を自分で作って `data-site` を付ける書き方なら動く（kh-house.jp で、送信の中身まで確認。送信は止めて本番 DB には書いていない）。
- ユーザーが GTM を新しい書き方に差し替えたあと、`?utm_source=testkawano&utm_campaign=deploycheck` で開くと、鍵付きで1回だけ読み込まれ、送信の中身も正しいことを確認した。

## 変えたもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/utils | **version.ts** | `2.2.200` |
| frontend/src/components/header | **TrackingSettings.tsx** | 追加した関数 `gtmTag`、型 `TagKind`、定数 `TAG_KINDS`。タグの欄を2種類（GTM 用・フッター用）に。コピーの状態を `サイトID:種類` で持つ |
| backend/scripts/guide/articles/common | **screen-200.md**（記事「トラッキング設定」） | 「タグを貼る」→「タグを入れる」。GTM 用とフッター用の使い分け、GTM にフッター用を入れても動かないこと、二重に入れないこと、LP の注意を追加 |
| backend/scripts/sql | **2026-10-20_update_log_2.2.200.sql**（新規） | update_log 1行 ＋ 記事「トラッキング設定」。ローカル DB に流した（no=299） |
| docs | **deploy-v2.2.200.md**（新規） | 手順書 |

- ⚠️ ② と tracker.js は変えていない（② の再ビルドは不要）。
- ⚠️ サイトの登録（サイトキー）はそのまま使える。登録し直しは不要。

## TrackingSettings.tsx の差分（全文）
```diff
diff --git a/frontend/src/components/header/TrackingSettings.tsx b/frontend/src/components/header/TrackingSettings.tsx
index ced3c479..f0073f5c 100644
--- a/frontend/src/components/header/TrackingSettings.tsx
+++ b/frontend/src/components/header/TrackingSettings.tsx
@@ -5,7 +5,10 @@ import apiClient from '../../utils/apiClient';
  * 広告流入トラッキングの設定（v2.2.199 新規）。ヘッダー「反響管理 → トラッキング設定」（Master / BrandAdmin）。
  *
  * ─────────────────────────────────────────────
- * ⚠️ サイトを登録すると site_key が発行され、各サイトのフッターに貼るタグ（tracker.js）を出す。
+ * ⚠️ サイトを登録すると site_key が発行され、各サイトに入れるタグ（tracker.js）を出す。
+ * ⚠️ タグは2種類（v2.2.200〜）：GTM のカスタム HTML 用（gtmTag）と、フッターに直接貼る用（trackingTag）。
+ *   ⚠️⚠️ GTM に trackingTag をそのまま入れると動かない。GTM は <script src> を作り直すときに data-site を捨て、
+ *   tracker.js がサイトを見分けられず何もしない（2026-10-20 kh-house.jp で確認）。GTM 用は要素を自分で作って data-site を付ける。
  * ⚠️ ② は features/tracking/sites.ts（⚠️ 権限は ② でも確かめる。メニューから隠すだけでは閉じない）。
  * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
  * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
@@ -15,6 +18,23 @@ import apiClient from '../../utils/apiClient';
 
 export const TRACKER_URL = 'https://api.khg-marketing.info/t/v1/tracker.js';
 export const trackingTag = (siteKey: string): string => `<script src="${TRACKER_URL}" data-site="${siteKey}" defer></script>`;
+export const gtmTag = (siteKey: string): string => [
+    '<script>',
+    '(function () {',
+    "  var s = document.createElement('script');",
+    `  s.src = '${TRACKER_URL}';`,
+    '  s.defer = true;',
+    `  s.setAttribute('data-site', '${siteKey}');`,
+    '  document.body.appendChild(s);',
+    '})();',
+    '</script>',
+].join('\n');
+
+type TagKind = 'gtm' | 'footer';
+const TAG_KINDS: { kind: TagKind; label: string; make: (siteKey: string) => string }[] = [
+    { kind: 'gtm', label: 'GTM 用：GTM（Googleタグマネージャー）のカスタム HTML に入れるタグ（トリガーは「All Pages」）', make: gtmTag },
+    { kind: 'footer', label: 'フッター用：GTM を使わず、すべてのページのフッターに直接貼るタグ', make: trackingTag },
+];
 
 /** ブランドキー → 表示名（⚠️ ② の TRACKING_BRANDS と同じキー） */
 const BRAND_LABEL: Record<string, string> = {
@@ -66,7 +86,8 @@ const TrackingSettings: React.FC = () => {
     const [saving, setSaving] = useState(false);
     const [formError, setFormError] = useState('');
     const [openTag, setOpenTag] = useState<number | null>(null);
-    const [copied, setCopied] = useState<number | null>(null);
+    /** コピーした（`サイトID:種類`）。⚠️ 先頭が ! ならコピーに失敗した */
+    const [copied, setCopied] = useState<string | null>(null);
 
     const load = useCallback(async () => {
         setLoading(true);
@@ -125,13 +146,13 @@ const TrackingSettings: React.FC = () => {
         }
     };
 
-    const copy = async (site: Site) => {
-        if (await copyText(trackingTag(site.siteKey))) {
-            setCopied(site.id);
-            window.setTimeout(() => setCopied((c) => (c === site.id ? null : c)), 2500);
+    const copy = async (site: Site, kind: TagKind, text: string) => {
+        const key = `${site.id}:${kind}`;
+        if (await copyText(text)) {
+            setCopied(key);
+            window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
         } else {
-            setOpenTag(site.id);
-            setCopied(-site.id);
+            setCopied(`!${key}`);
         }
     };
 
@@ -153,7 +174,7 @@ const TrackingSettings: React.FC = () => {
                 </div>
 
                 <div className="tk_caution">
-                    ※ タグは、サイトの<b>すべてのページ</b>のフッターに1回だけ貼ります。WordPress の場合は WPCode の Footer 欄、またはテーマのフッターに貼ってください。<br />
+                    ※ タグは、サイトの<b>すべてのページ</b>で1回だけ動くように入れます。GTM を使っているサイトは「GTM 用」を、使っていないサイトは「フッター用」を使ってください（GTM にフッター用を入れても動きません）。<br />
                     ※ 「許可するオリジン」は、タグを貼るサイトの <b>https://ドメイン</b> です（例：https://kh-house.jp）。ここに無いドメインからの記録は保存しません。<br />
                     ※ 訪問者ごとのID（顧客ID）はブラウザに保存されます。リリース前に、プライバシーポリシーへ利用目的の記載が必要です。
                 </div>
@@ -230,15 +251,23 @@ const TrackingSettings: React.FC = () => {
                                     {openTag === s.id && (
                                         <tr className="tk_detail">
                                             <td className="tk_td" colSpan={8}>
-                                                <div className="tk_label">このサイトのすべてのページのフッターに貼るタグ</div>
-                                                <div className="tk_code_row">
-                                                    <code className="tk_code" onClick={(e) => window.getSelection()?.selectAllChildren(e.currentTarget)}>{trackingTag(s.siteKey)}</code>
-                                                    <button type="button" className="tk_btn is_primary" onClick={() => copy(s)}>
-                                                        {copied === s.id ? 'コピーしました' : 'コピー'}
-                                                    </button>
-                                                </div>
-                                                {copied === -s.id && <div className="tk_error">コピーできませんでした。タグを押して選び、Ctrl+C でコピーしてください。</div>}
-                                                <div className="tk_sub">サイトキー：{s.siteKey}（公開される識別子です。パスワードではありません）</div>
+                                                {TAG_KINDS.map(({ kind, label, make }) => {
+                                                    const key = `${s.id}:${kind}`;
+                                                    const text = make(s.siteKey);
+                                                    return (
+                                                        <div key={kind} className="tk_tag_block">
+                                                            <div className="tk_label">{label}</div>
+                                                            <div className="tk_code_row">
+                                                                <code className="tk_code" onClick={(e) => window.getSelection()?.selectAllChildren(e.currentTarget)}>{text}</code>
+                                                                <button type="button" className="tk_btn is_primary" onClick={() => copy(s, kind, text)}>
+                                                                    {copied === key ? 'コピーしました' : 'コピー'}
+                                                                </button>
+                                                            </div>
+                                                            {copied === `!${key}` && <div className="tk_error">コピーできませんでした。タグを押して選び、Ctrl+C でコピーしてください。</div>}
+                                                        </div>
+                                                    );
+                                                })}
+                                                <div className="tk_sub">どちらか一方だけ入れてください（両方あると着地が2回記録されます）。サイトキー：{s.siteKey}（公開される識別子です。パスワードではありません）</div>
                                             </td>
                                         </tr>
                                     )}
@@ -299,7 +328,8 @@ const CSS = `
 .tk_link:hover { text-decoration: underline; }
 .tk_detail > .tk_td { background: #fbfdff; padding: 10px 16px 14px; }
 .tk_code_row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0; }
-.tk_code { flex: 1 1 480px; display: block; font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #1f2937; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; word-break: break-all; cursor: text; }
+.tk_code { flex: 1 1 480px; display: block; font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #1f2937; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; white-space: pre-wrap; word-break: break-all; cursor: text; }
+.tk_tag_block + .tk_tag_block { margin-top: 10px; }
 .tk_empty { color: #9ca3af; text-align: center; padding: 24px; }
 `;
 
```

## 確認
- 型チェック：TrackingSettings.tsx にエラー無し（既存のエラーのみ）。ビルド `main.1c40eccc.js`。
- Playwright（ビルド結果を表示。② は模擬）
  - 注意書きの1行目が GTM 用／フッター用の使い分けになっている
  - 「タグ」を押すと2つの欄（GTM 用・フッター用）が出て、鍵が入っている
  - コピー成功：押した欄のボタンだけ「コピーしました」。クリップボードに GTM 用の全文が入る
  - コピー失敗（http）：押した欄の下にだけ「コピーできませんでした…」が出る
  - GTM 用の中身をそのまま実行すると、`data-site` 付き・`defer` の tracker.js の script ができる
- ① 経由：トークン無しで `tracking_site_list` → 401（新しい request は無し）
- 本番 kh-house.jp（GTM を差し替えた後）：tracker.js が1回だけ読み込まれ、`site_key` 付きで送信の中身が作られる
