# 2026-10-12 v2.2.188 LINE ID の文言・placeholder ／ 来場希望日の placeholder とカレンダー

## 依頼
- 「LINE_IDをご入力いただいた場合」→ **「ご入力いただいた場合」**に変更。テーブルも変更
- LINE ID の placeholder を消す
- 来場希望日の placeholder を消す
- 入力欄の中をクリックしたらカレンダーが出る UI に

## 変更
| 場所 | ファイル | 内容 |
|---|---|---|
| ① DB | backend/scripts/sql/**2026-10-12_line_id_columns.sql** | form_database / form_table の既定値と全行の text を「ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。」に。⚠️ 列が既にある環境でも既定値がそろうよう `ALTER COLUMN line_id SET DEFAULT` を追加（ADD COLUMN IF NOT EXISTS は既定値を変えない） |
| フロント | frontend/src/components/campaign/**NewCampaign.tsx** | `LINE_ID_DEFAULT.text`（line_id 列が無い・壊れているときの既定）を同じ文言に |
| フロント | frontend/src/components/campaign/**formPreview.tsx** | プレビューの LINE ID の placeholder を削除。来場希望日の placeholder「年 / 月 / 日」を削除し `pf-date`（カレンダーの絵）に。`Input` に `className` を足した |
| フロント | frontend/src/components/campaign/**formPreview.css** | `.pf-date`（公開フォームの写し。右にカレンダーの絵） |
| 公開フォーム | form_get/src/components/**Form.tsx** | LINE ID の `placeholder="LINE ID"` を削除。来場希望日に `pf-date`・`data-empty`・`onClick` で `showPicker()` |
| 公開フォーム | form_get/src/components/**publicForm.css** | `.pf-date`: 右にカレンダーの絵、押せる見た目（cursor）。空のときはブラウザが描く「yyyy/mm/dd」を透明に（Chrome/Edge/Safari は `::-webkit-datetime-edit`、Firefox は `@-moz-document`） |

### 補足
- 「yyyy/mm/dd」は placeholder 属性ではなく、⚠️ **ブラウザが日付の欄に描く文字**。そのため属性を消すのではなく、空の間だけ CSS で透明にしている。日付を選ぶと見える。
- 欄のどこを押しても開くのは `showPicker()`（Chrome 99+ / Safari 16+ / Firefox 101+）。⚠️ 古いブラウザや別ドメインの iframe 内では例外になるので握り、元からある仕組み（App.css で透明な indicator を欄いっぱいに広げている）に任せる。
- iPhone の Safari はもともと空欄表示・タップでホイールが出る（変わらない）。

## 確認（ローカル）
- SQL をローカル DB に流した → form_table 289 行・form_database 8 行すべて新しい文言
- form_get: `tsc -p tsconfig.app.json --noEmit` OK
- Playwright（⚠️ 設定の取得は横取りしてローカル DB の djh の行を返す。本番に届かない）PC・スマホ幅で
  - 空の来場希望日に「yyyy/mm/dd」が出ず、右にカレンダーの絵
  - 欄の左寄り（絵でない所）を押すと `showPicker` が1回呼ばれる
  - 日付を入れると `data-empty="0"` になり「2026/10/25」が見える
  - LINE ID の見出しが「ご入力いただいた場合、…」、欄に placeholder なし
- ダッシュボード `npm run build` 成功 → **`main.6e2b267e.js` ／ `main.e19d8b71.css`**

## 差分: dashboard
```diff
--- a/backend/scripts/sql/2026-10-12_line_id_columns.sql
+++ b/backend/scripts/sql/2026-10-12_line_id_columns.sql
@@ -16,21 +16,28 @@
 ALTER TABLE form_database
     ADD COLUMN IF NOT EXISTS line_id LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
-        DEFAULT '{"bool":true,"required":false,"text":"LINE_IDをご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}'
+        DEFAULT '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}'
         CHECK (json_valid(line_id))
         AFTER mail;
 
+-- ⚠️ 列が既にある環境（ローカルなど）でも既定値を新しい文言にそろえる（ADD COLUMN IF NOT EXISTS は既定値を変えないため）
+ALTER TABLE form_database
+    ALTER COLUMN line_id SET DEFAULT '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';
+
 UPDATE form_database
-   SET line_id = '{"bool":true,"required":false,"text":"LINE_IDをご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';
+   SET line_id = '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';
 
 ALTER TABLE form_table
     ADD COLUMN IF NOT EXISTS line_id LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
-        DEFAULT '{"bool":true,"required":false,"text":"LINE_IDをご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}'
+        DEFAULT '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}'
         CHECK (json_valid(line_id))
         AFTER mail;
 
+ALTER TABLE form_table
+    ALTER COLUMN line_id SET DEFAULT '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';
+
 UPDATE form_table
-   SET line_id = '{"bool":true,"required":false,"text":"LINE_IDをご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';
+   SET line_id = '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';

--- a/frontend/src/components/campaign/NewCampaign.tsx
+++ b/frontend/src/components/campaign/NewCampaign.tsx
@@ -130,7 +130,7 @@
 const LINE_ID_DEFAULT: FormState['line_id'] = {
     bool: true,
     required: false,
-    text: 'LINE_IDをご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。',
+    text: 'ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。',
 };

--- a/frontend/src/components/campaign/formPreview.css
+++ b/frontend/src/components/campaign/formPreview.css
@@ -234,6 +234,15 @@
 .pf input[type=date] {
     position: relative;
 }
+/* ⚠️ 2026-10-12: 来場希望日（公開フォームの .pf-date の写し）。右にカレンダーの絵 */
+.pf-date {
+    padding-right: 44px;
+    cursor: pointer;
+    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M3 10h18M8 3v4M16 3v4'/%3E%3C/svg%3E");
+    background-position: calc(100% - 14px) 50%;
+    background-size: 20px 20px;
+    background-repeat: no-repeat;
+}

--- a/frontend/src/components/campaign/formPreview.tsx
+++ b/frontend/src/components/campaign/formPreview.tsx
@@ -53,8 +53,8 @@
-const Input = ({ placeholder }: { placeholder?: string }) =>
-    <input className="pf-input" readOnly tabIndex={-1} placeholder={placeholder} />;
+const Input = ({ placeholder, className = '' }: { placeholder?: string; className?: string }) =>
+    <input className={`pf-input ${className}`.trim()} readOnly tabIndex={-1} placeholder={placeholder} />;
@@ -90,7 +90,7 @@
-                            <PreviewField label={form.date.text_day} required={form.date.required}><Input placeholder="年 / 月 / 日" /></PreviewField>
+                            <PreviewField label={form.date.text_day} required={form.date.required}><Input className="pf-date" /></PreviewField>
@@ -119,7 +119,7 @@
-                    {!form.line_id.bool || <PreviewField label={form.line_id.text} required={form.line_id.required}><Input placeholder="LINE ID" /></PreviewField>}
+                    {!form.line_id.bool || <PreviewField label={form.line_id.text} required={form.line_id.required}><Input /></PreviewField>}
```

## 差分: 公開フォーム（form_get、⚠️ git 管理外）
### src/components/Form.tsx
```diff
-                                        <input id='date' type="date" className="pf-input" value={postData.date} onChange={setValue('date')} />
+                                        {/**
+                                          * ⚠️ 2026-10-12: 空のときの「yyyy/mm/dd」はブラウザが描く文字（placeholder 属性ではない）なので、
+                                          *   ⚠️ data-empty で CSS から消す（publicForm.css の .pf-date）。
+                                          * ⚠️ 欄のどこを押してもカレンダーを開く（showPicker）。
+                                          *   ⚠️ 古いブラウザや別ドメインの iframe 内では使えず例外になるので握って、いつもの動き（右のアイコン）に任せる。
+                                          */}
+                                        <input id='date' type="date" className="pf-input pf-date" data-empty={postData.date ? '0' : '1'}
+                                            value={postData.date} onChange={setValue('date')}
+                                            onClick={(e) => {
+                                                try {
+                                                    e.currentTarget.showPicker();
+                                                } catch {
+                                                    // showPicker が使えない環境。⚠️ 何もしない（右のアイコンから開ける）
+                                                }
+                                            }} />
```
```diff
                                     <input id='line_id' type="text" className="pf-input" autoComplete="off" autoCapitalize="none" spellCheck={false}
-                                        placeholder="LINE ID"
                                         value={postData.line_id}
```
### src/components/publicForm.css
```diff
 .pf input[type=date] {
     position: relative;
 }
+/*
+ * ⚠️ 2026-10-12: 来場希望日（Form.tsx の .pf-date）
+ * - 右にカレンダーの絵（押せると分かるように）。⚠️ 欄のどこを押しても開く（Form.tsx の showPicker と App.css の透明な indicator）
+ * - 空のときの「yyyy/mm/dd」はブラウザが描く文字なので、⚠️ 空（data-empty="1"）の間だけ透明にする
+ */
+.pf-date {
+    padding-right: 44px;
+    cursor: pointer;
+    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M3 10h18M8 3v4M16 3v4'/%3E%3C/svg%3E");
+    background-position: calc(100% - 14px) 50%;
+    background-size: 20px 20px;
+    background-repeat: no-repeat;
+}
+.pf-date[data-empty="1"]::-webkit-datetime-edit {
+    color: transparent;
+}
+@-moz-document url-prefix() {
+    .pf-date[data-empty="1"] {
+        color: transparent;
+    }
+}
```
