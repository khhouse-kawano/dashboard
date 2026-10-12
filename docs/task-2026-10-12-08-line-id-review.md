# 2026-10-12 v2.2.188 LINE ID 改修の見直し（漏れの追加・不要コードの削除・まとめ・コメント整理）

## 依頼
- LINE ID の案内文を **「LINE IDをご入力ください」** に（途中「LINE ID」を経て確定）
- 大幅な改修だったので、修正箇所をすべて見直してリファクタリングする
  - 余計なコード・コメント、allowed_columns 等への追加忘れ、通知メール・サンクスメール・inquiry_customer 等への追加処理、handleSync、TableInput と依存関係
- 判断事項（「提案通り」で回答）
  - ① の退避経路（本体はリポジトリに無い）→ 下書き（snippet）だけ直す
  - プレビュー用 CSS は写しのまま持つ（このファイルの下を丸ごと置き換える運用）
  - 電話番号の形が違っても確認画面へ進めた既存の不具合 → 直した（`return` を1行足しただけ）

## 点検の結果（直さなくてよかったところ）
- 公開フォーム → ② entry.ts → inquiry_customer.line_id に保存（空は NULL）。設定の取得（public）も line_id を返す
- ② のメール: 「お問い合わせ内容」（detailBlock）に LINE ID → **社内通知・サンクスメールの両方**に入る。`{{LINE ID}}` は件名・本文の両方で使える
- 反響一覧: ② queries.ts と ① list_order/spec/used.php は3テーブルとも line_id を返す
- 同期: 注文・建売は `list:insert`（② MASTER_DATA_COLUMNS に line_id あり。① allowed_columns.php にもあり）、中古は ① list_resale_sync.php（:line_id を入れている）
- 顧客の編集: TableInput は画面の state を変えるだけ。保存は `information:customer_info` で、② MASTER_DATA_COLUMNS ／ ① allowed_columns.php の両方に line_id あり。詳細取得は SELECT * なので line_id が来る。変更履歴（master_data_log）は丸ごと JSON なので line_id も残る
- かえる・中古の反響テーブル（inquiry_customer_kaeru / _resale）は外部から入るもので、公開フォームは書かない（今回の対象外）

## 変更

### 1. 抜けていた処理
| 場所 | ファイル | 内容 |
|---|---|---|
| フロント | campaign/**formBuilderUtils.ts** | フォームの HTML を作る機能（FormBuilder）に LINE ID の項目（`BUILDER_FIELDS`・`SETTING_TO_FIELDS`） |
| ① | handlers/integrateAction/**integrate_spec.php**・**integrate_used.php** | 顧客の統合で「C. LINE ID の処理」を追加。統合先が空なら統合元の最初の LINE ID を入れる（今までは消えていた） |
| ① DB | scripts/sql/**2026-10-12_line_id_columns.sql** | 全行を上書きする UPDATE と `ALTER COLUMN … SET DEFAULT` を削除。⚠️ 列を足すときに既存の行は既定値で埋まる（ローカルの一時テーブルで確認）。⚠️ 残すと、スタッフが設定を変えたあとにもう一度流すと消える |
| 開発用 | scripts/sql/dev/**mask_personal_info.sql** | 反響3・顧客3テーブルの line_id もマスクする（スクリプト自体は流していない） |
| ① | handlers/**list_resale_sync.php** | 同期後に取り直す一覧にも line_id |
| ① 下書き | forms/**khg-api-form-register.snippet.php** | ① の退避経路の下書きのメールに LINE ID（`khgDetailBlock` と差し込み語の表）。⚠️ 本体（khg-marketing.info/api/）は別管理なので、そちらには未反映 |

### 2. 不要なコードの削除
- **NewCampaign.tsx**: `changeForm` の呼ばれない分岐2つ（真偽値の反転・shop/date/medium の表示反転）、`BooleanKeys`（`thanks: boolean` を型に直接）、`setFlag`（`patch` と同じ）、使っていない `token`・`category` と `AuthContext` の import、`Boolean()` の重ね掛け
- **Form.tsx（form_get）**: 出ることのない欄ごとのエラー表示 10 か所（time / sei / mei / seiKana / meiKana / zip / pref / city / town / street。confirmData は name / kana / address などまとまりの名前しか立てない）
- **publicForm.css / formPreview.css**: 使っていない `.pf-btn-sub`
- **App.css（form_get）**: 使わなくなった `--main`・`.hover`
- **formPreview.tsx**: `previewAccent` の export、プレビューでは来ない `'なごみ'` キー
- **LineWorksButton.tsx**: 削除（LineIdRow.tsx に統合）

### 3. 重なっていたもののまとめ
- **list/listUtils.ts** に `lineIdField(value)` を追加。ListOrder / ListKaeru / ListResale の handleSync はこれを使う
- **information/LineIdRow.tsx**（新規）: LINE ID の TableInput ＋ LINE アイコン。InformationEdit / Kaeru / Resale の連絡先はこれ1行
- **formPreview.css**: publicForm.css から作り直し（注記の下は publicForm.css と同一。diff で確認）
- **brands.ts（form_get）**: `brandAccentStyle(brand)` を追加し、Form.tsx・Confirm.tsx の `['--pf-accent' as string] … as CSSProperties` を置き換え
- **NewCampaign.tsx**: 「一覧へ戻る」「キャンセル」を `backToList` に。インライン style を `.nc-card-head-actions`・`.nc-template`・`.nc-template-head`・`.nc-btn-xs`・`.nc-placeholders` に

### 4. コメント
- 「v2.2.188」「2026-10-12」「以前は…」など経緯だけのコメントを削除・短縮（今回の改修で足したもの。⚠️ 以前からあるコメントは触っていない）
- LINE WORKS の調査の経緯は作業記録（task-04）に任せ、LineIdRow.tsx には結論だけ
- キャンペーン設定の LINE ID の説明文を「通知メールとサンクスメールの「お問い合わせ内容」にも載ります」に（実際の動きに合わせた）

### 5. 型
- `parseLineId`: JSON の中身を型ごとに確かめて、違う値は既定で埋める
- Confirm.tsx の `line_id` を必須に（Form.tsx と同じ）。初期値に `line_id: ''`
- CSS 変数の二重キャストをやめた（`AccentStyle` ／ `brandAccentStyle`）
- LINE ID の空白除去 `/[\s　]+/g` → `/\s+/g`（`\s` は全角スペースも含む。eslint の no-irregular-whitespace も解消）。② entry.ts も同じ

### 6. 既存の不具合（ついで）
- **Form.tsx**: 電話番号が 10 桁未満のとき、エラーを出しながら確認画面へ進んでいた → `return` を足して止める

## 確認（ローカル）
- ②: tsc OK ／ ①: 変更した PHP すべて `php -l` OK
- フロント: `npm run build` 成功 → **`main.12d99c58.js` ／ `main.b8a7c60b.css`**。触ったファイルの eslint 警告はすべて以前からのもの
- form_get: `tsc -p tsconfig.app.json --noEmit` OK
- 顧客の統合: ローカル DB に試験用の顧客（かえる・中古）を入れて実行
  - かえる: 統合先が空 → 統合元の `line_abc` が入る ／ 中古: 統合先 `keep_me` → そのまま
  - 試験用の行（master_data_kaeru / _resale・interview_sheet・call_sheet）は削除済み
- 画面（Playwright。⚠️ 通信はすべて横取り）
  - 公開フォーム: LINE ID の見出し「LINE IDをご入力ください」、来場希望日のカレンダー（showPicker が呼ばれる・選ぶと表示）
  - キャンペーン設定: 項目の表示・必須の切り替え（patch に置き換え後も見出しが残る）、プレビューが変わる
- ローカル DB: form_table 289 行・form_database 8 行の line_id が新しい文言

## 公開フォーム（form_get、⚠️ git 管理外）の変更箇所
### src/api/brands.ts
```ts
import type { CSSProperties } from 'react';
// …
/**
 * ブランドキー → 差し色（ボタン・入力欄の枠の色）。
 *
 * ⚠️ 基本は Dashboard の `frontend/src/utils/setStyleClass.ts` のブランド色。
 *   ⚠️ ただし djh・2l はそのまま（#28aeba / #0d9f6d）だとボタンの白い文字が読みにくいので、同じ色相で少し暗くしている。
 * ⚠️⚠️ Dashboard のプレビュー（`Campaign/formPreview.tsx`）にも同じ表がある。**片方だけ直さないこと。**
 * ⚠️ khg（グループ共通）と知らないブランドは国分ハウジングの紺。
 */
// （ACCENT・brandAccent は同じ）

/** 差し色を CSS 変数で渡す style（publicForm.css が var(--pf-accent) で使う） */
export const brandAccentStyle = (brand: string | null | undefined): CSSProperties & { '--pf-accent': string } =>
    ({ '--pf-accent': brandAccent(brand) });
```
### src/components/Form.tsx
```diff
-import type { ChangeEvent, CSSProperties, ReactNode } from "react";
+import type { ChangeEvent, ReactNode } from "react";
-import { brandLogo, brandAccent } from "../api/brands";
+import { brandLogo, brandAccentStyle } from "../api/brands";
-// ⚠️ 2026-10-12: 見た目（Dashboard 風の SaaS デザイン）。⚠️ 確認画面（Confirm.tsx）と共通
```
```diff
                 await setValidation('phone_wrong');
                 await document.getElementById('phone')?.scrollIntoView({ behavior: 'smooth' });
+                return;
             }
```
```diff
-        <div className="pf" style={{ ['--pf-accent' as string]: brandAccent(getParam.brand) } as CSSProperties}>
+        <div className="pf" style={brandAccentStyle(getParam.brand)}>
```
```diff
-    /**
-     * ⚠️ 2026-10-12: 見た目だけ作り直した（…）
-     *   …（5行）
-     */
+    /**
+     * ⚠️⚠️ 入力欄の id（shop / date / phone …）と、まとまりの id（name / kana / address）は
+     *   **confirmData のスクロール先**。消さないこと（validation もこの名前になる）。
+     */
```
```diff
-                                    <Field htmlFor="time" label={form.date.text_time} required={form.date.required}
-                                        error={validation === 'time' ? '来場希望時間が未入力です' : ''}>
+                                    <Field htmlFor="time" label={form.date.text_time} required={form.date.required}>
-                                            error={validation === 'sei' ? 'お名前(姓)が未入力です' : ''} invalid={validation === 'name' && !postData.sei.trim()}>
+                                            invalid={validation === 'name' && !postData.sei.trim()}>
   （mei / seiKana / meiKana / pref / city / town / street も同じ）
-                                error={validation === 'zip' ? '郵便番号が未入力です' : validation === 'zip_wrong' ? '正しく入力してください'
+                                error={validation === 'zip_wrong' ? '正しく入力してください'
```
```diff
-                                            const value = e.target.value.replace(/[\s　]+/g, '');
+                                            const value = e.target.value.replace(/\s+/g, '');
```
- そのほか、経緯だけのコメント（型の LINE ID・postData の LINE ID・特典条件の state・設定読み込みの LINE ID・来場希望日・LINE ID 欄・Field の「2026-10-12 新規」）を削除・短縮
### src/components/Confirm.tsx
```diff
-import type { CSSProperties } from "react";
-import { brandLogo, brandAccent, KHG_BRAND, KHG_THANKS } from "../api/brands";
-// ⚠️ 2026-10-12: 見た目（Dashboard 風の SaaS デザイン）。⚠️ 入力画面（Form.tsx）と共通
+import { brandLogo, brandAccentStyle, KHG_BRAND, KHG_THANKS } from "../api/brands";
-    /** LINE ID（2026-10-12 追加） */
-    line_id?: string;
+    line_id: string;
+        line_id: '',            （初期値）
-    /** ⚠️ 2026-10-12: 見た目だけ作り直した（…） */
+    // 値が空の項目は出さない
-        // ⚠️ 2026-10-12: LINE ID（入力があるときだけ）
-        { label: 'LINE ID', value: postData.line_id ?? '' },
+        { label: 'LINE ID', value: postData.line_id },
-        <div className="pf" style={{ ['--pf-accent' as string]: brandAccent(postData.brand || location.state?.brand) } as CSSProperties}>
+        <div className="pf" style={brandAccentStyle(postData.brand || location.state?.brand)}>
```
### src/components/publicForm.css
```diff
-/*
- * 公開フォーム（入力 Form.tsx ／ 確認 Confirm.tsx）の見た目（2026-10-12 新規）。
- * …（12行）
- */
+/*
+ * 公開フォーム（入力 Form.tsx ／ 確認 Confirm.tsx）の見た目。
+ * ⚠️ 色は .pf の変数で決める。差し色（--pf-accent）だけブランドごとに画面側が style で渡す（src/api/brands.ts の brandAccent）。
+ * ⚠️ 埋め込み先は白地なので明るい配色だけ（ダークモードは作らない）。埋め込み先の CSS に引きずられないよう色はすべてここで明示する。
+ * ⚠️ 入力欄の文字は 16px。16px 未満だと iPhone で入力時に画面が拡大される。
+ * ⚠️⚠️ Dashboard の Campaign/formPreview.css がこのファイルの写し。**ここを変えたら写しも置き換えること。**
+ */
-/* ⚠️ 日付の入力欄は全体を押して暦を出す（既存の挙動） */
-.pf input[type=date] { position: relative; }
-/* ⚠️ 2026-10-12: 来場希望日（…）3行 */
+/*
+ * 来場希望日（Form.tsx の .pf-date）。右にカレンダーの絵。欄のどこを押しても開く（Form.tsx の showPicker と App.css の透明な indicator）。
+ * ⚠️ 空のときの「yyyy/mm/dd」はブラウザが描く文字なので、空（data-empty="1"）の間だけ透明にする。
+ */
+.pf input[type=date] { position: relative; }
-.pf-btn-sub {
-    font-size: 12px;
-    color: var(--pf-sub);
-}
```
### src/App.css
```diff
-:root {
-  --main: #956134;
-}
-
-.hover:hover {
-  transform: scale(1.03);
-  opacity: .8;
-}
```

## 差分: dashboard（git diff）
```diff
diff --git a/backend-express/src/features/campaignForm/entry.ts b/backend-express/src/features/campaignForm/entry.ts
index 489c6721..8d4bfe5b 100644
--- a/backend-express/src/features/campaignForm/entry.ts
+++ b/backend-express/src/features/campaignForm/entry.ts
@@ -107,7 +107,6 @@ interface Answers {
     sei: string; mei: string; seiKana: string; meiKana: string;
     zip: string; pref: string; city: string; town: string; street: string;
     phone: string; mail: string; age: string;
-    /** LINE ID（v2.2.188）。⚠️ 形は確かめない（空白だけ取り除く。2026-10-12 決定） */
     lineId: string;
     shop: string; date: string; time: string;
     medium: string; question: string;
@@ -116,12 +115,11 @@ interface Answers {
 }
 
 /**
- * LINE ID（v2.2.188）。⚠️ **空白（半角・全角）を取り除くだけ**。形（英数字・記号・文字数）は確かめない。
- *   ⚠️ LINE ID の決まりが変わっても受け付けられるようにするため（2026-10-12 決定）。
- *   ⚠️ 長さは 100 文字で切る（⚠️ 列は TEXT。⚠️ 異常に長い入力を入れない）。
+ * LINE ID。⚠️ **空白（半角・全角）を取り除くだけ**で、形（英数字・記号・文字数）は確かめない（LINE の決まりが変わっても受け付けるため）。
+ *   ⚠️ 異常に長い入力を入れないよう 100 文字で切る。
  */
 const cleanLineId = (value: unknown): string =>
-    clean(value, 200).replace(/[\s　]+/g, '').slice(0, 100);
+    clean(value, 200).replace(/\s+/g, '').slice(0, 100);
 
 const readAnswers = (body: Record<string, unknown>): Answers => ({
     sei: clean(body.sei, 60),
@@ -287,9 +285,8 @@ export const runCampaignFormEntry = async (
     // ⚠️ 自由記述は remarks へ。note は社内の申し送りに使われているので触らない
     values.remarks = a.question;
     /**
-     * ⚠️ v2.2.188: LINE ID。⚠️ 列は NULL 可（NOT_NULL_COLUMNS には入れない）。⚠️ 未入力は NULL。
-     * ⚠️ 2026-10-12_line_id_columns.sql を流す前の DB だと Unknown column で ⚠️ **反響ごと保存できない**。
-     *   ⚠️ 必ず SQL を先に流すこと（deploy-v2.2.188.md）。
+     * LINE ID。⚠️ 列は NULL 可なので NOT_NULL_COLUMNS には入れない。未入力は NULL。
+     * ⚠️⚠️ 列が無い DB だと Unknown column で **反響ごと保存できない**（2026-10-12_line_id_columns.sql を先に流す）。
      */
     values.line_id = a.lineId === '' ? null : a.lineId;
 
@@ -394,7 +391,6 @@ export const runCampaignFormPublic = async (
     const campaignId = clean(body.campaign_id, 120);
 
     const rows = await query<RowDataPacket>(
-        // ⚠️ v2.2.188: line_id（LINE ID の項目設定）を追加
         'SELECT campaign, campaign_id, brand, url, tag, redirect, thanks, notice,'
         + ' name, kana, age, phone, mail, line_id, address, question, shop, date, medium, attention'
         + ' FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1',
diff --git a/backend-express/src/features/campaignForm/index.ts b/backend-express/src/features/campaignForm/index.ts
index 50d8d07f..15040e44 100644
--- a/backend-express/src/features/campaignForm/index.ts
+++ b/backend-express/src/features/campaignForm/index.ts
@@ -50,7 +50,7 @@ const JSON_COLUMNS = [
 ] as const;
 
 /**
- * ⚠️ v2.2.188 追加の JSON 列（LINE ID）。⚠️ **送られてきたときだけ書く。**
+ * 後から足した JSON 列（LINE ID）。⚠️ **送られてきたときだけ書く。**
  *   ⚠️ 列は `CHECK (json_valid(...))` 付き。⚠️ 送られてこない（古い画面）ときに JSON_COLUMNS と同じく
  *     `jsonText(undefined)` = '' を書くと ⚠️ **制約で保存ごと失敗する**。
  *   ⚠️ 送られてこなければ、登録は DB の既定値（表示する・任意・既定の文言）、更新は今の値のまま。
diff --git a/backend-express/src/features/campaignForm/mail.ts b/backend-express/src/features/campaignForm/mail.ts
index 44e4f634..1c278415 100644
--- a/backend-express/src/features/campaignForm/mail.ts
+++ b/backend-express/src/features/campaignForm/mail.ts
@@ -35,7 +35,6 @@ export interface FormAnswers {
     sei: string; mei: string; seiKana: string; meiKana: string;
     zip: string; pref: string; city: string; town: string; street: string;
     phone: string; mail: string; age: string;
-    /** LINE ID（v2.2.188） */
     lineId: string;
     shop: string; date: string; time: string;
     medium: string; question: string;
diff --git a/backend-express/src/features/campaignForm/mailTemplate.ts b/backend-express/src/features/campaignForm/mailTemplate.ts
index 5fc36ea6..8acc7b1b 100644
--- a/backend-express/src/features/campaignForm/mailTemplate.ts
+++ b/backend-express/src/features/campaignForm/mailTemplate.ts
@@ -26,7 +26,7 @@ export interface TemplateValues {
     meiKana: string;
     zip: string; pref: string; city: string; town: string; street: string;
     phone: string; mail: string; age: string;
-    /** LINE ID（v2.2.188）。⚠️ 未入力は '' */
+    /** ⚠️ 未入力は '' */
     lineId: string;
     shop: string; date: string; time: string;
     medium: string; question: string;
@@ -59,7 +59,7 @@ export const detailBlock = (v: TemplateValues): string => {
         + line('来場希望時間', v.time)
         + line('携帯番号', v.phone)
         + line('メールアドレス', v.mail)
-        // ⚠️ v2.2.188: LINE ID（⚠️ 未入力なら行ごと出ない）。⚠️ 社内通知・お客様宛の両方の「お問い合わせ内容」に入る
+        // ⚠️ LINE ID は未入力なら行ごと出ない
         + line('LINE ID', v.lineId)
         + line('年齢', v.age)
         + address
diff --git a/backend-express/src/features/information/masterDataColumns.ts b/backend-express/src/features/information/masterDataColumns.ts
index edebfd62..5c3e5b02 100644
--- a/backend-express/src/features/information/masterDataColumns.ts
+++ b/backend-express/src/features/information/masterDataColumns.ts
@@ -77,7 +77,7 @@ export const MASTER_DATA_COLUMNS: readonly string[] = [
   'integration', 'introduction_date', 'introduction_person_category',
   'introduction_person_name', 'junior_high_school_id', 'k_snap', 'khg_id', 'land_budget',
   'last_action_step_migration_item_date', 'last_action_step_migration_item_name', 'lat_lng',
-  // ⚠️ v2.2.188: LINE ID（⚠️ 3テーブルとも列あり: 2026-10-12_line_id_columns.sql）
+  // LINE ID（3テーブルとも列あり）
   'line_id',
   'memo_developer_application_company', 'memo_fire_insurance', 'memo_ground_survey',
   'memo_lawyer', 'memo_marketing', 'memo_other_related_person', 'memo_site_survey', 'monthly_repayment_amount',
diff --git a/backend/forms/khg-api-form-register.snippet.php b/backend/forms/khg-api-form-register.snippet.php
index 0209395a..d9cd9e57 100644
--- a/backend/forms/khg-api-form-register.snippet.php
+++ b/backend/forms/khg-api-form-register.snippet.php
@@ -123,6 +123,7 @@ function khgDetailBlock($d, $html)
         . $line('来場希望時間', $d['time'] ?? '')
         . $line('携帯番号', $d['phone'] ?? '')
         . $line('メールアドレス', $d['mail'] ?? '')
+        . $line('LINE ID', $d['line_id'] ?? '')
         . $line('年齢', $d['age'] ?? '')
         . $address
         . $line('お問い合わせのきっかけ', $d['medium'] ?? '')
@@ -171,6 +172,7 @@ function khgRender($template, $d, $brandName, $receivedAt, $questionnaire, $html
         '来場希望時間'     => $e($d['time'] ?? ''),
         '携帯番号'         => $e($d['phone'] ?? ''),
         'メールアドレス'   => $e($d['mail'] ?? ''),
+        'LINE ID'          => $e($d['line_id'] ?? ''),
         '年齢'             => $e($d['age'] ?? ''),
         '事前アンケート'   => khgQuestionnaireBlock($d, $questionnaire, $html),
         '事前アンケートURL' => $e($questionnaire),
diff --git a/backend/scripts/sql/2026-10-12_line_id_columns.sql b/backend/scripts/sql/2026-10-12_line_id_columns.sql
index c9c5028b..f7bb0feb 100644
--- a/backend/scripts/sql/2026-10-12_line_id_columns.sql
+++ b/backend/scripts/sql/2026-10-12_line_id_columns.sql
@@ -4,10 +4,10 @@
 -- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ローカルも同じSQL。
 -- ⚠️ ② VPS・① PHP・フロントより **先に** 流すこと。
 --   （⚠️ ② が line_id を保存・取得しに行ったとき、列が無いと Unknown column で保存ごと失敗する）
--- ⚠️ 何度流しても壊れない（ADD COLUMN IF NOT EXISTS ／ UPDATE は同じ値で上書き）。
+-- ⚠️ 何度流しても壊れない（ADD COLUMN IF NOT EXISTS）。⚠️ 既存の行は列を足したときに既定値で埋まる。
 --
 -- 1. form_database / form_table … フォームの項目設定（JSON）。⚠️ mail と同じ形の列を mail の次に。
---    ⚠️ 既定値も同じ JSON にしてある（⚠️ line_id を送らない古い保存処理でも INSERT が落ちないように）。
+--    ⚠️ 既定値の JSON で既存の全フォームが「表示・任意」になる。line_id を送らない古い保存処理でも INSERT は落ちない。
 -- 2. 反響3テーブル・顧客3テーブル … 値（文字列）。⚠️ 空でよい（NULL）。
 -- =====================================================================
 
@@ -16,29 +16,16 @@
 -- ---------------------------------------------------------------------
 ALTER TABLE form_database
     ADD COLUMN IF NOT EXISTS line_id LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
-        DEFAULT '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}'
+        DEFAULT '{"bool":true,"required":false,"text":"LINE IDをご入力ください"}'
         CHECK (json_valid(line_id))
         AFTER mail;
 
--- ⚠️ 列が既にある環境（ローカルなど）でも既定値を新しい文言にそろえる（ADD COLUMN IF NOT EXISTS は既定値を変えないため）
-ALTER TABLE form_database
-    ALTER COLUMN line_id SET DEFAULT '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';
-
-UPDATE form_database
-   SET line_id = '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';
-
 ALTER TABLE form_table
     ADD COLUMN IF NOT EXISTS line_id LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
-        DEFAULT '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}'
+        DEFAULT '{"bool":true,"required":false,"text":"LINE IDをご入力ください"}'
         CHECK (json_valid(line_id))
         AFTER mail;
 
-ALTER TABLE form_table
-    ALTER COLUMN line_id SET DEFAULT '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';
-
-UPDATE form_table
-   SET line_id = '{"bool":true,"required":false,"text":"ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。"}';
-
 -- ---------------------------------------------------------------------
 -- 2. 反響（inquiry_customer*）・顧客（master_data*）
 -- ---------------------------------------------------------------------
diff --git a/backend/scripts/sql/dev/mask_personal_info.sql b/backend/scripts/sql/dev/mask_personal_info.sql
index 3935a235..1ed8211a 100644
--- a/backend/scripts/sql/dev/mask_personal_info.sql
+++ b/backend/scripts/sql/dev/mask_personal_info.sql
@@ -215,6 +215,7 @@ BEGIN NOT ATOMIC
     `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
     `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
     `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
+    `line_id` = CASE WHEN `line_id` IS NULL OR `line_id` = '' THEN `line_id` ELSE REPEAT('*', CHAR_LENGTH(`line_id`)) END,
     `mhl_mail` = REGEXP_REPLACE(`mhl_mail`, '[^@.]', '*'),
     `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
     `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*');
@@ -225,6 +226,7 @@ BEGIN NOT ATOMIC
     `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
     `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
     `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
+    `line_id` = CASE WHEN `line_id` IS NULL OR `line_id` = '' THEN `line_id` ELSE REPEAT('*', CHAR_LENGTH(`line_id`)) END,
     `mhl_mail` = REGEXP_REPLACE(`mhl_mail`, '[^@.]', '*'),
     `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
     `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*');
@@ -235,6 +237,7 @@ BEGIN NOT ATOMIC
     `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
     `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
     `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
+    `line_id` = CASE WHEN `line_id` IS NULL OR `line_id` = '' THEN `line_id` ELSE REPEAT('*', CHAR_LENGTH(`line_id`)) END,
     `mhl_mail` = REGEXP_REPLACE(`mhl_mail`, '[^@.]', '*'),
     `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
     `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*');
@@ -274,6 +277,7 @@ BEGIN NOT ATOMIC
     `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
     `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
     `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
+    `line_id` = CASE WHEN `line_id` IS NULL OR `line_id` = '' THEN `line_id` ELSE REPEAT('*', CHAR_LENGTH(`line_id`)) END,
     `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
     `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
   
@@ -284,6 +288,7 @@ BEGIN NOT ATOMIC
     `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
     `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
     `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
+    `line_id` = CASE WHEN `line_id` IS NULL OR `line_id` = '' THEN `line_id` ELSE REPEAT('*', CHAR_LENGTH(`line_id`)) END,
     `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
     `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
   
@@ -308,6 +313,7 @@ BEGIN NOT ATOMIC
     `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
     `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
     `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
+    `line_id` = CASE WHEN `line_id` IS NULL OR `line_id` = '' THEN `line_id` ELSE REPEAT('*', CHAR_LENGTH(`line_id`)) END,
     `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
     `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
   
diff --git a/backend/src/core/allowed_columns.php b/backend/src/core/allowed_columns.php
index 9018a48c..e6feffbe 100644
--- a/backend/src/core/allowed_columns.php
+++ b/backend/src/core/allowed_columns.php
@@ -147,7 +147,7 @@ return [
 'last_action_step_migration_item_date',
 'last_action_step_migration_item_name',
 'lat_lng',
-// v2.2.188: LINE ID（3テーブルとも列あり: 2026-10-12_line_id_columns.sql）
+// LINE ID（3テーブルとも列あり）
 'line_id',
 'memo_developer_application_company',
 'memo_fire_insurance',
diff --git a/backend/src/handlers/integrateAction/integrate_spec.php b/backend/src/handlers/integrateAction/integrate_spec.php
index 26272612..da4f4f09 100644
--- a/backend/src/handlers/integrateAction/integrate_spec.php
+++ b/backend/src/handlers/integrateAction/integrate_spec.php
@@ -157,6 +157,20 @@ if (isset($data['request']) && $data['request'] === 'integrate') {
             }
         }
 
+        // ==========================================
+        // C. LINE ID の処理（列は1つだけ。統合先が空なら統合元の最初の値を入れる）
+        // ==========================================
+        if ($normalize($baseRecord['line_id'] ?? '') === '') {
+            foreach ($integrateRecords as $rec) {
+                $intLineId = trim((string)($rec['line_id'] ?? ''));
+                if ($intLineId !== '') {
+                    $updateQueryParts[] = "line_id = :line_id";
+                    $updateValues[':line_id'] = $intLineId;
+                    break;
+                }
+            }
+        }
+
         // 統合先(ベース)のUPDATE実行
         $setClause = implode(', ', $updateQueryParts);
         $stmt = $pdo->prepare("UPDATE master_data_kaeru SET $setClause WHERE id = :id");
diff --git a/backend/src/handlers/integrateAction/integrate_used.php b/backend/src/handlers/integrateAction/integrate_used.php
index 84012403..b42fb0d0 100644
--- a/backend/src/handlers/integrateAction/integrate_used.php
+++ b/backend/src/handlers/integrateAction/integrate_used.php
@@ -157,6 +157,20 @@ if (isset($data['request']) && $data['request'] === 'integrate') {
             }
         }
 
+        // ==========================================
+        // C. LINE ID の処理（列は1つだけ。統合先が空なら統合元の最初の値を入れる）
+        // ==========================================
+        if ($normalize($baseRecord['line_id'] ?? '') === '') {
+            foreach ($integrateRecords as $rec) {
+                $intLineId = trim((string)($rec['line_id'] ?? ''));
+                if ($intLineId !== '') {
+                    $updateQueryParts[] = "line_id = :line_id";
+                    $updateValues[':line_id'] = $intLineId;
+                    break;
+                }
+            }
+        }
+
         // 統合先(ベース)のUPDATE実行
         $setClause = implode(', ', $updateQueryParts);
         $stmt = $pdo->prepare("UPDATE master_data_resale SET $setClause WHERE id = :id");
diff --git a/backend/src/handlers/list_resale_sync.php b/backend/src/handlers/list_resale_sync.php
index ac472dea..278c8011 100644
--- a/backend/src/handlers/list_resale_sync.php
+++ b/backend/src/handlers/list_resale_sync.php
@@ -13,7 +13,7 @@ try {
         ':customer_contacts_mobile_phone_number'  => $data['customer_contacts_mobile_phone_number'] ?? null,
         ':customer_contacts_phone_number'         => $data['customer_contacts_phone_number'] ?? null,
         ':customer_contacts_email'                => $data['customer_contacts_email'] ?? null,
-        // v2.2.188: LINE ID（⚠️ 画面は値があるときだけ送る。無ければ NULL）
+        // ⚠️ LINE ID は画面が値のあるときだけ送る。無ければ NULL
         ':line_id'                                => $data['line_id'] ?? null,
         ':postal_code'                            => $data['postal_code'] ?? null,
         ':full_address'                           => $data['full_address'] ?? null,
@@ -43,7 +43,7 @@ try {
 
     // 反響一覧の取得
     $sql_inquiry = "SELECT id, inquiry_id, pg_id, inquiry_date, medium, response_medium, first_name, last_name, category,
-        first_name_kana, last_name_kana, mobile, landline, mail, zip, pref, city, town, street, building, brand, shop, sync, staff, area, 
+        first_name_kana, last_name_kana, mobile, landline, mail, line_id, zip, pref, city, town, street, building, brand, shop, sync, staff, area, 
         reserved_date, black_list, hp_campaign, duplicate, property, note 
         FROM inquiry_customer_resale
         WHERE first_name <> '' 
diff --git a/frontend/src/components/campaign/NewCampaign.tsx b/frontend/src/components/campaign/NewCampaign.tsx
index 66f93827..68da8e2d 100644
--- a/frontend/src/components/campaign/NewCampaign.tsx
+++ b/frontend/src/components/campaign/NewCampaign.tsx
@@ -1,16 +1,11 @@
-import React, { useEffect, useState, useContext } from 'react';
+import React, { useEffect, useState } from 'react';
 import { useNavigate, useLocation } from "react-router-dom";
 import { fetchDetail, fetchMaster, insertCampaign, updateCampaign } from './campaignApi';
-import AuthContext from '../../context/AuthContext';
 import { PLACEHOLDERS, unknownPlaceholders } from './mailTemplateFields';
-// ⚠️ v2.2.188: 画面の作り直し（Dashboard 風の SaaS デザイン）と、右側の公開フォームのプレビュー
 import FormPreview from './formPreview';
 import './newCampaign.css';
 
-type BooleanKeys =
-    'thanks';
-
-/** ⚠️ v2.2.188: プレビュー（formPreview.tsx）が型だけ使うので export する */
+/** プレビュー（formPreview.tsx）も使う */
 export type FormState = {
     brand: string;
     campaign: string;
@@ -18,6 +13,7 @@ export type FormState = {
     mail_to: string;
     mail_cc: string;
     redirect: string;
+    thanks: boolean;
     img_code: string,
     /**
      * ⚠️⚠️ **メール本文のひな型。空なら既定の文面が使われる。**
@@ -83,11 +79,7 @@ export type FormState = {
         required: boolean,
         text: string
     }
-    /**
-     * LINE ID（v2.2.188 追加）。⚠️ form_table / form_database の `line_id` 列（JSON）。
-     * ⚠️ 列が無い古い応答・壊れた値は LINE_ID_DEFAULT で受ける。
-     * ⚠️ 公開フォーム（react/form_get）がこの設定で入力欄を出す。
-     */
+    /** ⚠️ 列が無い古い応答・壊れた値は LINE_ID_DEFAULT で受ける（parseLineId） */
     line_id: {
         bool: boolean,
         required: boolean,
@@ -119,27 +111,29 @@ export type FormState = {
         text: string,
         mediumName: string[]
     }
-} & Record<BooleanKeys, boolean>;
+};
 
 type Response = { status: string; message: string }
 
-/**
- * LINE ID の既定（v2.2.188）。⚠️ DB の列の既定値（2026-10-12_line_id_columns.sql）と同じ。
- * ⚠️ 列が無い（SQL を流す前・② が古い）応答のときに使う。
- */
+/** ⚠️ DB の列の既定値（2026-10-12_line_id_columns.sql）と同じにすること */
 const LINE_ID_DEFAULT: FormState['line_id'] = {
     bool: true,
     required: false,
-    text: 'ご入力いただいた場合、お客様のLINEへご連絡することもございますので予めご了承ください。',
+    text: 'LINE IDをご入力ください',
 };
 
-/** line_id 列の値を読む。⚠️ 無い・壊れている・形が違うときは既定 */
+/** line_id 列の値を読む。⚠️ 無い・壊れている・型が違う値は既定で埋める */
 const parseLineId = (value: unknown): FormState['line_id'] => {
     if (typeof value !== 'string' || value === '') return LINE_ID_DEFAULT;
     try {
-        const parsed = JSON.parse(value);
-        if (parsed && typeof parsed === 'object' && 'bool' in parsed) {
-            return { ...LINE_ID_DEFAULT, ...parsed };
+        const parsed: unknown = JSON.parse(value);
+        if (parsed && typeof parsed === 'object') {
+            const { bool, required, text } = parsed as Record<string, unknown>;
+            return {
+                bool: typeof bool === 'boolean' ? bool : LINE_ID_DEFAULT.bool,
+                required: typeof required === 'boolean' ? required : LINE_ID_DEFAULT.required,
+                text: typeof text === 'string' ? text : LINE_ID_DEFAULT.text,
+            };
         }
     } catch {
         console.error(`LINE ID の設定を読めませんでした: ${String(value).slice(0, 80)}`);
@@ -240,7 +234,6 @@ const NewCampaign = () => {
         },
     });
     const [response, setResponse] = useState<Response>();
-    // ⚠️ v2.2.188: 選択肢の追加欄（newShop / newTime / newMedium）は OptionList が持つようにした
     const [validation, setValidation] = useState<string[]>([]);
     /**
      * ⚠️ 設定を読めなかったことを画面に出すため。
@@ -248,8 +241,6 @@ const NewCampaign = () => {
      *     利用者には「修正を押したのに反映されない」としか見えなかった。
      */
     const [loadError, setLoadError] = useState<string>('');
-    const { token } = useContext(AuthContext);
-    const { category } = useContext(AuthContext);
 
     useEffect(() => {
         const fetchData = async () => {
@@ -312,7 +303,6 @@ const NewCampaign = () => {
                         age: parse(row.age, prev.age),
                         phone: parse(row.phone, prev.phone),
                         mail: parse(row.mail, prev.mail),
-                        // ⚠️ v2.2.188: 列が無い・壊れていても既定で受ける（parseLineId）
                         line_id: parseLineId(row.line_id),
                         address: parse(row.address, prev.address),
                         medium: parse(row.medium, prev.medium),
@@ -349,7 +339,6 @@ const NewCampaign = () => {
                         age: JSON.parse(response.data.age),
                         phone: JSON.parse(response.data.phone),
                         mail: JSON.parse(response.data.mail),
-                        // ⚠️ v2.2.188: 列が無い（SQL を流す前）ときも既定で受ける
                         line_id: parseLineId(response.data.line_id),
                         address: JSON.parse(response.data.address),
                         medium: JSON.parse(response.data.medium),
@@ -369,13 +358,6 @@ const NewCampaign = () => {
         setForm(prev => {
             if (!prev) return prev;
 
-            if ((category as BooleanKeys) in prev && typeof prev[category] === 'boolean') {
-                return {
-                    ...prev,
-                    [category]: !prev[category as BooleanKeys]
-                };
-            }
-
             if (category === 'campaign_id') {
                 let urlValue: string = '';
                 let tagValue: string = '';
@@ -412,16 +394,6 @@ const NewCampaign = () => {
                 };
             }
 
-            if (category === 'shop' || category === 'date' || category === 'medium') {
-                return {
-                    ...prev,
-                    [category]: {
-                        ...prev[category],
-                        bool: !prev[category].bool
-                    }
-                };
-            }
-
             return {
                 ...prev,
                 [category]: value ?? ''
@@ -454,16 +426,15 @@ const NewCampaign = () => {
         const unknown = [...unknownPlaceholders(subject), ...unknownPlaceholders(body)];
         const isDefault = subject.trim() === '' && body.trim() === '';
 
-        // ⚠️ v2.2.188: 見た目だけ newCampaign.css に合わせた（⚠️ 中身・「空欄＝既定」の決まりは同じ）
         return (
-            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
-                <div className="d-flex align-items-center" style={{ gap: '10px', flexWrap: 'wrap' }}>
-                    <span className="nc-hint" style={{ fontSize: '12px' }}>{note}</span>
+            <div className="nc-template">
+                <div className="nc-template-head">
+                    <span className="nc-hint">{note}</span>
                     <span className={`nc-tag ${isDefault ? 'nc-tag-default' : 'nc-tag-custom'}`}>
                         {isDefault ? '既定の文面' : 'このキャンペーン専用'}
                     </span>
                     {isDefault ||
-                        <button type="button" className="nc-btn nc-btn-ghost" style={{ minHeight: '26px', padding: '2px 10px', fontSize: '11px' }}
+                        <button type="button" className="nc-btn nc-btn-ghost nc-btn-xs"
                             onClick={() => { changeTemplate(subjectKey, ''); changeTemplate(bodyKey, ''); }}>
                             既定に戻す
                         </button>}
@@ -485,7 +456,7 @@ const NewCampaign = () => {
 
                 <details className="nc-details">
                     <summary>使える差し込み語</summary>
-                    <div style={{ fontSize: '11px', color: '#525f7f', lineHeight: 1.9, marginTop: '4px' }}>
+                    <div className="nc-placeholders">
                         {PLACEHOLDERS.map(item => (
                             <div key={item.key}>
                                 <code>{`{{${item.key}}}`}</code>
@@ -541,35 +512,20 @@ const NewCampaign = () => {
         }
     }, [response])
 
-    /**
-     * ─────────────────────────────────────────────
-     * ⚠️ v2.2.188: 画面を作り直した（Dashboard 風の SaaS デザイン。newCampaign.css）。
-     *   左: 設定のカード ／ 右: 公開フォームのプレビュー（formPreview.tsx。⚠️ 入力するとその場で反映）／ 下: 保存バー
-     * ⚠️ 保存（postForm）・読み込み・入力チェックは ⚠️ **変えていない**。⚠️ 送る中身（form）の形も同じ。
-     * ⚠️ 項目の「表示する」「必須／任意」は ⚠️ **patch で bool / required だけを書き換える**。
-     *   ⚠️ 以前は changeForm(項目名) を使っており、shop / date / medium 以外は ⚠️ **項目の設定ごと '' で上書き**していた
-     *     （チェックを外すと文言・必須が消え、もう一度付けても戻らなかった）。
-     *   ⚠️ 販促媒体の選択肢の編集・追加は ⚠️ `...prev.shop` を広げていたため、来場希望場所の設定が販促媒体へ混ざっていた。
-     *     → OptionList に置き換え、⚠️ 販促媒体は販促媒体だけを書き換える。
-     * ─────────────────────────────────────────────
-     */
+    /** 項目の設定の一部だけを書き換える。⚠️ 表示・必須を切り替えても見出しなど他の設定は残す */
     type ItemKey = 'shop' | 'date' | 'name' | 'kana' | 'age' | 'phone' | 'mail' | 'line_id' | 'address' | 'medium' | 'question';
     const patch = <K extends ItemKey | 'notice' | 'attention'>(key: K, value: Partial<FormState[K]>) =>
         setForm(prev => ({ ...prev, [key]: { ...prev[key], ...value } }));
 
-    /** 表示する／必須・任意 の切り替え。⚠️ bool・required だけを書き換える（他の設定は残す） */
-    const setFlag = (key: ItemKey, flag: 'bool' | 'required', value: boolean) =>
-        setForm(prev => ({ ...prev, [key]: { ...prev[key], [flag]: value } }));
-
     /** 項目の行（表示する ／ 必須・任意）。⚠️ 中身は children */
     const item = (key: ItemKey, title: string, children: React.ReactNode, hiddenChildren?: React.ReactNode) => (
         <FieldItem
             key={key}
             title={title}
-            shown={Boolean(form[key].bool)}
-            onShown={(v) => setFlag(key, 'bool', v)}
-            required={Boolean(form[key].required)}
-            onRequired={(v) => setFlag(key, 'required', v)}
+            shown={form[key].bool}
+            onShown={(v) => patch(key, { bool: v })}
+            required={form[key].required}
+            onRequired={(v) => patch(key, { required: v })}
             hiddenChildren={hiddenChildren}
         >
             {children}
@@ -577,6 +533,7 @@ const NewCampaign = () => {
     );
 
     const isEdit = Boolean(idValue);
+    const backToList = () => navigate(`/campaign/?brand=${brandValue ?? ''}`);
 
     return (
         <div className="nc">
@@ -587,7 +544,7 @@ const NewCampaign = () => {
                     <h1 className="nc-title">{isEdit ? 'キャンペーン修正' : 'キャンペーン作成'}</h1>
                 </div>
                 <div className="nc-header-actions">
-                    <button type="button" className="nc-btn" onClick={() => navigate(`/campaign/?brand=${brandValue ?? ''}`)}>
+                    <button type="button" className="nc-btn" onClick={backToList}>
                         <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>一覧へ戻る
                     </button>
                 </div>
@@ -665,8 +622,8 @@ const NewCampaign = () => {
                         <div className="nc-card-head">
                             <h2 className="nc-card-title" id="nc-notice">フォーム冒頭の案内文</h2>
                             <p className="nc-card-desc">入力欄の上に表示されます</p>
-                            <div style={{ marginLeft: 'auto' }}>
-                                <Switch checked={Boolean(form.notice.bool)} label="表示する" onChange={(v) => patch('notice', { bool: v })} />
+                            <div className="nc-card-head-actions">
+                                <Switch checked={form.notice.bool} label="表示する" onChange={(v) => patch('notice', { bool: v })} />
                             </div>
                         </div>
                         {!form.notice.bool ||
@@ -726,10 +683,9 @@ const NewCampaign = () => {
                             {item('age', '年齢', <TextField label="見出し" value={form.age.text} onChange={(v) => patch('age', { text: v })} />)}
                             {item('phone', '携帯電話', <TextField label="見出し" value={form.phone.text} onChange={(v) => patch('phone', { text: v })} />)}
                             {item('mail', 'メールアドレス', <TextField label="見出し" value={form.mail.text} onChange={(v) => patch('mail', { text: v })} />)}
-                            {/* ⚠️ v2.2.188: LINE ID（メールアドレスの下） */}
                             {item('line_id', 'LINE ID', <>
                                 <TextField label="見出し" value={form.line_id.text} onChange={(v) => patch('line_id', { text: v })} />
-                                <p className="nc-hint">入力された LINE ID は反響・顧客に保存され、通知メールにも載ります。</p>
+                                <p className="nc-hint">入力された LINE ID は反響・顧客に保存され、通知メールとサンクスメールの「お問い合わせ内容」にも載ります。</p>
                             </>)}
                             {item('address', '住所', <>
                                 <div className="nc-grid-2">
@@ -757,8 +713,8 @@ const NewCampaign = () => {
                         <div className="nc-card-head">
                             <h2 className="nc-card-title" id="nc-attention">注意事項と特典条件</h2>
                             <p className="nc-card-desc">送信ボタンの上に表示されます</p>
-                            <div style={{ marginLeft: 'auto' }}>
-                                <Switch checked={Boolean(form.attention.bool)} label="表示する" onChange={(v) => patch('attention', { bool: v })} />
+                            <div className="nc-card-head-actions">
+                                <Switch checked={form.attention.bool} label="表示する" onChange={(v) => patch('attention', { bool: v })} />
                             </div>
                         </div>
                         {!form.attention.bool ||
@@ -770,7 +726,7 @@ const NewCampaign = () => {
                                 </div>
                                 <div className="nc-field">
                                     <span className="nc-label">特典進呈条件</span>
-                                    <Segmented value={Boolean(form.attention.bool_red)} trueLabel="表示する" falseLabel="表示しない"
+                                    <Segmented value={form.attention.bool_red} trueLabel="表示する" falseLabel="表示しない"
                                         onChange={(v) => patch('attention', { bool_red: v })} />
                                 </div>
                                 {!form.attention.bool_red ||
@@ -802,7 +758,7 @@ const NewCampaign = () => {
                             ? <span style={{ color: '#d93a4a', fontWeight: 600 }}>{validation.length}個の未入力項目があります</span>
                             : '保存すると公開中のフォームにすぐ反映されます'}
                     </p>
-                    <button type="button" className="nc-btn" onClick={() => navigate(`/campaign/?brand=${brandValue ?? ''}`)}>キャンセル</button>
+                    <button type="button" className="nc-btn" onClick={backToList}>キャンセル</button>
                     <button type="button" className="nc-btn nc-btn-primary" onClick={() => postForm()}>
                         {isEdit ? '修正を保存する' : 'キャンペーンを登録する'}
                     </button>
@@ -868,10 +824,7 @@ const FieldItem = ({ title, shown, onShown, required, onRequired, children, hidd
     </div>
 );
 
-/**
- * 選択肢の一覧（来場希望場所・時間・販促媒体）。編集・削除・追加。
- * ⚠️ 追加欄の文字はこの部品が持つ（⚠️ 以前は newShop / newTime / newMedium を NewCampaign が持っていた）。
- */
+/** 選択肢の一覧（来場希望場所・時間・販促媒体）。編集・削除・追加。追加欄の文字はこの部品が持つ */
 const OptionList = ({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) => {
     const [draft, setDraft] = useState('');
     const add = () => {
diff --git a/frontend/src/components/campaign/formBuilderUtils.ts b/frontend/src/components/campaign/formBuilderUtils.ts
index 47c6c954..e41a943d 100644
--- a/frontend/src/components/campaign/formBuilderUtils.ts
+++ b/frontend/src/components/campaign/formBuilderUtils.ts
@@ -44,6 +44,7 @@ export const BUILDER_FIELDS: BuilderField[] = [
     { key: 'meiKana', label: 'めい', type: 'text', required: false },
     { key: 'phone', label: '電話番号', type: 'tel', required: true },
     { key: 'mail', label: 'メールアドレス', type: 'email', required: true },
+    { key: 'line_id', label: 'LINE ID', type: 'text', required: false },
     { key: 'age', label: '年齢', type: 'select', required: false, options: ['20代', '30代', '40代', '50代', '60代以上'] },
     { key: 'zip', label: '郵便番号', type: 'text', required: false },
     { key: 'pref', label: '都道府県', type: 'text', required: false },
@@ -76,6 +77,7 @@ export const SETTING_TO_FIELDS: Record<string, string[]> = {
     kana: ['seiKana', 'meiKana'],
     phone: ['phone'],
     mail: ['mail'],
+    line_id: ['line_id'],
     age: ['age'],
     address: ['zip', 'pref', 'city', 'town', 'street'],
     date: ['date', 'time'],
diff --git a/frontend/src/components/campaign/formPreview.css b/frontend/src/components/campaign/formPreview.css
index c4f77c38..d0ebe56a 100644
--- a/frontend/src/components/campaign/formPreview.css
+++ b/frontend/src/components/campaign/formPreview.css
@@ -1,20 +1,13 @@
 /*
- * ⚠️⚠️ これは公開フォーム（C:\Users\shinji-kawano\react\form_get\src\components\publicForm.css）の **写し**。
- *   ⚠️ 「キャンペーン作成」のプレビュー（formPreview.tsx）で、実際の公開フォームと同じ見た目を出すために使う。
- *   ⚠️ 公開フォーム側を変えたら、ここも同じ内容に置き換えること（この注記より下は元のファイルそのまま）。
+ * ⚠️⚠️ 公開フォーム（react/form_get/src/components/publicForm.css）の **写し**。プレビュー（formPreview.tsx）を実物と同じ見た目にするため。
+ *   ⚠️ 公開フォーム側を変えたら、この注記より下を丸ごと置き換えること（手で直さない）。
  */
 /*
- * 公開フォーム（入力 Form.tsx ／ 確認 Confirm.tsx）の見た目（2026-10-12 新規）。
- *
- * ─────────────────────────────────────────────
- * ⚠️ 色は1か所（下の .pf の変数）で決める。⚠️ 差し色（--pf-accent）だけブランドごとに
- *   画面側が style で渡す（src/api/brands.ts の brandAccent）。
- * ⚠️ 埋め込み先（各ブランドのサイト）は白地なので ⚠️ **明るい配色だけ**にしている（ダークモードは作らない）。
- *   ⚠️ 色はすべてここで明示する（⚠️ 埋め込み先の CSS に引きずられないため）。
- * ⚠️ 入力欄の文字は 16px。⚠️ 16px 未満だと iPhone で入力時に画面が拡大される。
- * ⚠️ Dashboard の「キャンペーン作成」のプレビュー（Campaign/formPreview.css）が ⚠️ **同じ見た目を写している**。
- *   ⚠️ ここを変えたらプレビューも揃えること。
- * ─────────────────────────────────────────────
+ * 公開フォーム（入力 Form.tsx ／ 確認 Confirm.tsx）の見た目。
+ * ⚠️ 色は .pf の変数で決める。差し色（--pf-accent）だけブランドごとに画面側が style で渡す（src/api/brands.ts の brandAccent）。
+ * ⚠️ 埋め込み先は白地なので明るい配色だけ（ダークモードは作らない）。埋め込み先の CSS に引きずられないよう色はすべてここで明示する。
+ * ⚠️ 入力欄の文字は 16px。16px 未満だと iPhone で入力時に画面が拡大される。
+ * ⚠️⚠️ Dashboard の Campaign/formPreview.css がこのファイルの写し。**ここを変えたら写しも置き換えること。**
  */
 
 .pf {
@@ -230,11 +223,13 @@
 .pf-field[data-invalid="1"] .pf-textarea {
     border-color: var(--pf-danger);
 }
-/* ⚠️ 日付の入力欄は全体を押して暦を出す（既存の挙動） */
+/*
+ * 来場希望日（Form.tsx の .pf-date）。右にカレンダーの絵。欄のどこを押しても開く（Form.tsx の showPicker と App.css の透明な indicator）。
+ * ⚠️ 空のときの「yyyy/mm/dd」はブラウザが描く文字なので、空（data-empty="1"）の間だけ透明にする。
+ */
 .pf input[type=date] {
     position: relative;
 }
-/* ⚠️ 2026-10-12: 来場希望日（公開フォームの .pf-date の写し）。右にカレンダーの絵 */
 .pf-date {
     padding-right: 44px;
     cursor: pointer;
@@ -243,6 +238,14 @@
     background-size: 20px 20px;
     background-repeat: no-repeat;
 }
+.pf-date[data-empty="1"]::-webkit-datetime-edit {
+    color: transparent;
+}
+@-moz-document url-prefix() {
+    .pf-date[data-empty="1"] {
+        color: transparent;
+    }
+}
 
 .pf-error {
     display: flex;
@@ -331,11 +334,6 @@
     filter: grayscale(.4) brightness(1.05);
     cursor: progress;
 }
-.pf-btn-sub {
-    font-size: 12px;
-    color: var(--pf-sub);
-}
-
 /* ---- 注意事項・特典条件 ---- */
 .pf-note {
     margin: 0;
diff --git a/frontend/src/components/campaign/formPreview.tsx b/frontend/src/components/campaign/formPreview.tsx
index 2411b6fb..18e54f73 100644
--- a/frontend/src/components/campaign/formPreview.tsx
+++ b/frontend/src/components/campaign/formPreview.tsx
@@ -3,15 +3,9 @@ import type { FormState } from './NewCampaign';
 import './formPreview.css';
 
 /**
- * 「キャンペーン作成」の右側のプレビュー（v2.2.188 新規）。
- *
- * ─────────────────────────────────────────────
- * ⚠️⚠️ **公開フォーム（react/form_get の Form.tsx）の見た目を写したもの。** 入力はできない（見るだけ）。
- *   ⚠️ 見た目は formPreview.css（公開フォームの publicForm.css の写し）。
- *   ⚠️ 項目のまとまり・並び・文言の出し方は Form.tsx と同じにしている。
- *     ⚠️ **公開フォームの並びを変えたら、ここも揃えること**（揃えないとプレビューと実物が食い違う）。
- * ⚠️ ロゴと差し色の表は form_get の src/api/brands.ts（LOGO / ACCENT）と同じ。
- * ─────────────────────────────────────────────
+ * 「キャンペーン作成」の右側のプレビュー。公開フォーム（react/form_get の Form.tsx）の写しで、入力はできない。
+ * ⚠️⚠️ **公開フォームの項目のまとまり・並びを変えたら、ここも揃えること**（揃えないとプレビューと実物が食い違う）。
+ * ⚠️ 見た目は formPreview.css（publicForm.css の写し）。ロゴと差し色は form_get の src/api/brands.ts と同じ。
  */
 
 const LOGO: Record<string, string> = {
@@ -29,7 +23,6 @@ const ACCENT: Record<string, string> = {
     kh: '#0f3675',
     djh: '#1d8a94',
     nagomi: '#956134',
-    'なごみ': '#956134',
     '2l': '#0b8659',
     jh: '#dc4235',
     fh: '#cd3c33',
@@ -38,8 +31,10 @@ const ACCENT: Record<string, string> = {
     khg: '#0f3675',
 };
 
-/** ブランドの差し色（⚠️ form_get の brandAccent と同じ） */
-export const previewAccent = (brand: string): string => ACCENT[brand.trim()] ?? '#0f3675';
+const previewAccent = (brand: string): string => ACCENT[brand.trim()] ?? '#0f3675';
+
+/** ⚠️ 差し色は CSS 変数で渡す（formPreview.css が var(--pf-accent) で使う） */
+type AccentStyle = React.CSSProperties & { '--pf-accent': string };
 
 const Badge = ({ required }: { required: boolean }) => required
     ? <span className="pf-badge pf-badge-req">必須</span>
@@ -70,10 +65,11 @@ const FormPreview = ({ form, brand }: Props) => {
     const personShown = form.name.bool || form.kana.bool || form.age.bool;
     const contactShown = form.phone.bool || form.mail.bool || form.line_id.bool;
     const otherShown = form.medium.bool || form.question.bool;
-    const logo = LOGO[brand] ?? '';
+    const logo = LOGO[brand.trim()] ?? '';
+    const style: AccentStyle = { '--pf-accent': previewAccent(brand), padding: '20px 14px 28px' };
 
     return (
-        <div className="pf" style={{ ['--pf-accent' as string]: previewAccent(brand), padding: '20px 14px 28px' } as React.CSSProperties}
+        <div className="pf" style={style}
             aria-label="公開フォームのプレビュー">
             {!logo || <div className="pf-logo"><img src={logo} alt="" /></div>}
             <ol className="pf-steps" aria-hidden="true">
diff --git a/frontend/src/components/campaign/mailTemplateFields.ts b/frontend/src/components/campaign/mailTemplateFields.ts
index 0f6b69da..2db81203 100644
--- a/frontend/src/components/campaign/mailTemplateFields.ts
+++ b/frontend/src/components/campaign/mailTemplateFields.ts
@@ -35,7 +35,6 @@ export const PLACEHOLDERS: Placeholder[] = [
     { key: '来場希望時間', note: '' },
     { key: '携帯番号', note: '' },
     { key: 'メールアドレス', note: '' },
-    // ⚠️ v2.2.188 追加（② mailTemplate.ts の PLACEHOLDERS と揃える）
     { key: 'LINE ID', note: '未入力なら空。「お問い合わせ内容」にも入る' },
     { key: '年齢', note: '' },
     { key: '事前アンケート', note: '案内文ごと。URLが無いブランドでは何も出ません' },
diff --git a/frontend/src/components/campaign/newCampaign.css b/frontend/src/components/campaign/newCampaign.css
index 6e6cbff4..64719f29 100644
--- a/frontend/src/components/campaign/newCampaign.css
+++ b/frontend/src/components/campaign/newCampaign.css
@@ -1,5 +1,5 @@
 /*
- * キャンペーン作成・修正（NewCampaign.tsx）の見た目（v2.2.188 新規。Dashboard 風の SaaS デザイン）。
+ * キャンペーン作成・修正（NewCampaign.tsx）の見た目。
  *
  * ⚠️ 色は Dashboard の既存の配色（listUtils の styles・FestaDashboard など）に合わせた:
  *   アクセント #5e72e4 ／ 文字 #32325d ／ 補足 #8898aa・#525f7f ／ 地 #f8f9fe ／ 罫線 #e9ecef
@@ -127,6 +127,9 @@
     font-weight: 700;
     color: var(--nc-ink);
 }
+.nc-card-head-actions {
+    margin-left: auto;
+}
 .nc-card-desc {
     margin: 0;
     font-size: 12px;
@@ -453,6 +456,31 @@
 }
 
 /* ---- メール文面 ---- */
+.nc-template {
+    display: flex;
+    flex-direction: column;
+    gap: 8px;
+}
+.nc-template-head {
+    display: flex;
+    align-items: center;
+    flex-wrap: wrap;
+    gap: 10px;
+}
+.nc-template-head .nc-hint {
+    font-size: 12px;
+}
+.nc-btn-xs {
+    min-height: 26px;
+    padding: 2px 10px;
+    font-size: 11px;
+}
+.nc-placeholders {
+    margin-top: 4px;
+    font-size: 11px;
+    line-height: 1.9;
+    color: var(--nc-sub);
+}
 .nc-tag {
     display: inline-block;
     padding: 2px 10px;
diff --git a/frontend/src/components/information/InformationEdit.tsx b/frontend/src/components/information/InformationEdit.tsx
index 732ad086..9ad0a8ce 100644
--- a/frontend/src/components/information/InformationEdit.tsx
+++ b/frontend/src/components/information/InformationEdit.tsx
@@ -14,7 +14,7 @@ import IceWorld from '../calendar/IceWorld';
 import { labelStyle, buttonStyle, valueStyle, inputStyle, requiredStyle, safeFormate, expandButton, safeParse, dateFormate, statusRequiredError } from '../../utils/informationUtils';
 import { kpiColumnFor } from '../../utils/interviewKpi';
 import TableInput from './TableInput';
-import LineWorksButton from './LineWorksButton';
+import LineIdRow from './LineIdRow';
 import TableSelect from './TableSelect';
 import TableInterview from './TableInterview';
 import TableCall from './TableCall';
@@ -878,11 +878,7 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                                                 <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_email' defaultValue='メールアドレス①' />
                                                 <TableInput information={information} setInformation={setInformation} itemKey='extra_address_info' defaultValue='メールアドレス②' />
                                             </div>
-                                            {/* ⚠️ v2.2.188: LINE ID（メールアドレスの下）。⚠️ アイコンは LINE ID をコピーして LINE WORKS を開く（LineWorksButton.tsx） */}
-                                            <div className='d-flex align-items-center'>
-                                                <TableInput information={information} setInformation={setInformation} itemKey='line_id' defaultValue='LINE ID' />
-                                                <LineWorksButton lineId={information.line_id} />
-                                            </div>
+                                            <LineIdRow information={information} setInformation={setInformation} />
                                         </td>
                                     </tr>
                                     <tr>
diff --git a/frontend/src/components/information/InformationEditKaeru.tsx b/frontend/src/components/information/InformationEditKaeru.tsx
index f6354fa0..c6dd1b6b 100644
--- a/frontend/src/components/information/InformationEditKaeru.tsx
+++ b/frontend/src/components/information/InformationEditKaeru.tsx
@@ -17,7 +17,7 @@ import { requiredStyle } from '../../utils/informationUtils';
 import { safeFormate } from '../../utils/informationUtils';
 import { competitorsStyle } from '../../utils/informationUtils';
 import TableInput from './TableInput';
-import LineWorksButton from './LineWorksButton';
+import LineIdRow from './LineIdRow';
 import TableSelect from './TableSelect';
 import TableInterview from './TableInterview';
 import TableCall from './TableCall';
@@ -796,11 +796,7 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
                                                     <TableInput information={information} setInformation={setInformation} itemKey='extra_address_info' defaultValue='メールアドレス②' disabled={!information.customer_contacts_name_2} />
                                                 </div>
                                             </div>
-                                            {/* ⚠️ v2.2.188: LINE ID（メールアドレスの下）。⚠️ アイコンは LINE ID をコピーして LINE WORKS を開く（LineWorksButton.tsx） */}
-                                            <div className='d-flex align-items-center'>
-                                                <TableInput information={information} setInformation={setInformation} itemKey='line_id' defaultValue='LINE ID' />
-                                                <LineWorksButton lineId={information.line_id} />
-                                            </div>
+                                            <LineIdRow information={information} setInformation={setInformation} />
                                         </td>
                                     </tr>
                                     <tr>
diff --git a/frontend/src/components/information/InformationEditResale.tsx b/frontend/src/components/information/InformationEditResale.tsx
index 8f59aaa2..17b182b5 100644
--- a/frontend/src/components/information/InformationEditResale.tsx
+++ b/frontend/src/components/information/InformationEditResale.tsx
@@ -8,7 +8,7 @@ import AuthContext from '../../context/AuthContext';
 import { labelStyle, buttonStyle, valueStyle, inputStyle, selectStyle, requiredStyle, safeFormate, competitorsStyle } from '../../utils/informationUtils';
 import { kpiColumnFor } from '../../utils/interviewKpi';
 import TableInput from './TableInput';
-import LineWorksButton from './LineWorksButton';
+import LineIdRow from './LineIdRow';
 import TableSelect from './TableSelect';
 import TableInterview from './TableInterview';
 import TableCall from './TableCall';
@@ -834,11 +834,7 @@ const InformationEditResale = ({ id, token, onClose, authority }: Props) => {
                                                 <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_email' defaultValue='メールアドレス①' />
                                                 <TableInput information={information} setInformation={setInformation} itemKey='extra_address_info' defaultValue='メールアドレス②' />
                                             </div>
-                                            {/* ⚠️ v2.2.188: LINE ID（メールアドレスの下）。⚠️ アイコンは LINE ID をコピーして LINE WORKS を開く（LineWorksButton.tsx） */}
-                                            <div className='d-flex align-items-center'>
-                                                <TableInput information={information} setInformation={setInformation} itemKey='line_id' defaultValue='LINE ID' />
-                                                <LineWorksButton lineId={information.line_id} />
-                                            </div>
+                                            <LineIdRow information={information} setInformation={setInformation} />
                                         </td>
                                     </tr>
                                     <tr>
diff --git a/frontend/src/components/information/LineIdRow.tsx b/frontend/src/components/information/LineIdRow.tsx
new file mode 100644
index 00000000..afcbab73
--- /dev/null
+++ b/frontend/src/components/information/LineIdRow.tsx
@@ -0,0 +1,73 @@
+import React, { useEffect, useState } from 'react';
+import TableInput from './TableInput';
+
+/**
+ * 顧客の編集画面（InformationEdit / Kaeru / Resale）の連絡先の LINE ID 欄と LINE アイコン。
+ *
+ * ⚠️⚠️ アイコンは「LINE ID をコピー」して「LINE WORKS のトークを新しいタブで開く」。
+ *   ⚠️ お客様の個人 LINE ID を渡してトークを開く方法は無い（調査: docs/task-2026-10-12-04-line-id.md）。
+ *   ⚠️ 開き先を変えるときは LINE_WORKS_TALK_URL だけ直す。
+ */
+const LINE_WORKS_TALK_URL = 'https://talk.worksmobile.com/';
+const LINE_GREEN = '#06C755';
+
+type Props = {
+    information: Record<string, string>;
+    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
+};
+
+const LineIdRow = ({ information, setInformation }: Props) => (
+    <div className='d-flex align-items-center'>
+        <TableInput information={information} setInformation={setInformation} itemKey='line_id' defaultValue='LINE ID' />
+        <LineWorksButton lineId={information.line_id} />
+    </div>
+);
+
+/** ⚠️ LINE ID が空なら薄く表示して押せない */
+const LineWorksButton = ({ lineId }: { lineId: string | null | undefined }) => {
+    const value = String(lineId ?? '').trim();
+    const enabled = value !== '';
+    const [copied, setCopied] = useState(false);
+
+    useEffect(() => {
+        if (!copied) return;
+        const timer = window.setTimeout(() => setCopied(false), 2000);
+        return () => window.clearTimeout(timer);
+    }, [copied]);
+
+    const handleClick = async () => {
+        if (!enabled) return;
+        try {
+            await navigator.clipboard.writeText(value);
+            setCopied(true);
+        } catch (error) {
+            // ⚠️ コピーできなくてもトークは開く（ID は画面に出ているので手で入力できる）
+            console.error('LINE ID をコピーできませんでした', error);
+        }
+        window.open(LINE_WORKS_TALK_URL, '_blank', 'noopener,noreferrer');
+    };
+
+    const label = enabled ? `LINE ID（${value}）をコピーして LINE WORKS を開く` : 'LINE ID が未入力です';
+
+    return (
+        <span className="d-inline-flex align-items-center" style={{ verticalAlign: 'middle' }}>
+            <button
+                type="button"
+                onClick={() => void handleClick()}
+                disabled={!enabled}
+                aria-label={label}
+                title={label}
+                style={{
+                    border: 'none', background: 'transparent', padding: '0 4px', lineHeight: 1,
+                    color: LINE_GREEN, opacity: enabled ? 1 : 0.35,
+                    cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '20px',
+                }}
+            >
+                <i className="fa-brands fa-line" aria-hidden="true"></i>
+            </button>
+            {copied && <span style={{ fontSize: '10px', color: LINE_GREEN, fontWeight: 700 }}>コピーしました</span>}
+        </span>
+    );
+};
+
+export default LineIdRow;
diff --git a/frontend/src/components/information/LineWorksButton.tsx b/frontend/src/components/information/LineWorksButton.tsx
deleted file mode 100644
index 8e65de76..00000000
--- a/frontend/src/components/information/LineWorksButton.tsx
+++ /dev/null
@@ -1,66 +0,0 @@
-import React, { useState } from 'react';
-
-/**
- * LINE ID の横の LINE アイコン（v2.2.188 新規）。顧客の編集画面（InformationEdit / Kaeru / Resale）の連絡先で使う。
- *
- * ─────────────────────────────────────────────
- * ⚠️⚠️ **押すと「LINE ID をコピー」して「LINE WORKS のトークを新しいタブで開く」。**
- *   ⚠️ 指示書は `https://line.worksmobile.com/message/send?emailList={LINE ID}` を開く案だったが、
- *     2026-10-12 の調査で ⚠️ **お客様の個人 LINE ID ではトークが開けない**ことが分かった。
- *     ・`emailList` は ⚠️ LINE WORKS のアカウント（ログインID）用。⚠️ 公式文書にも無い（予告なく変わりうる）
- *     ・LINE WORKS から ⚠️ **個人 LINE ID でお客様を検索・追加する手段は無い**
- *       （お客様に社員の QR・招待リンクから友だち追加してもらう流れのみ）
- *     → 調査の推奨どおり「コピー ＋ トークを開く」にした（詳細: docs/task-2026-10-12-04-line-id.md）。
- *   ⚠️ 開き先を変えるときは LINE_WORKS_TALK_URL だけ直す。
- * ─────────────────────────────────────────────
- *
- * ⚠️ LINE ID が空なら薄く表示して押せない。
- * ⚠️ 色は LINE のブランドカラー（#06C755）。
- */
-const LINE_WORKS_TALK_URL = 'https://talk.worksmobile.com/';
-const LINE_GREEN = '#06C755';
-
-type Props = {
-    lineId: string | null | undefined;
-};
-
-const LineWorksButton = ({ lineId }: Props) => {
-    const value = String(lineId ?? '').trim();
-    const enabled = value !== '';
-    const [copied, setCopied] = useState(false);
-
-    const handleClick = async () => {
-        if (!enabled) return;
-        try {
-            await navigator.clipboard.writeText(value);
-            setCopied(true);
-            window.setTimeout(() => setCopied(false), 2000);
-        } catch (error) {
-            // ⚠️ コピーできなくてもトークは開く（⚠️ 手で入力できるよう ID は画面に出ている）
-            console.error('LINE ID をコピーできませんでした', error);
-        }
-        window.open(LINE_WORKS_TALK_URL, '_blank', 'noopener,noreferrer');
-    };
-
-    return (
-        <span className="d-inline-flex align-items-center" style={{ verticalAlign: 'middle' }}>
-            <button
-                type="button"
-                onClick={() => void handleClick()}
-                disabled={!enabled}
-                aria-label={enabled ? `LINE ID（${value}）をコピーして LINE WORKS を開く` : 'LINE ID が未入力です'}
-                title={enabled ? `LINE ID（${value}）をコピーして LINE WORKS を開く` : 'LINE ID が未入力です'}
-                style={{
-                    border: 'none', background: 'transparent', padding: '0 4px', lineHeight: 1,
-                    color: LINE_GREEN, opacity: enabled ? 1 : 0.35,
-                    cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '20px',
-                }}
-            >
-                <i className="fa-brands fa-line" aria-hidden="true"></i>
-            </button>
-            {copied && <span style={{ fontSize: '10px', color: LINE_GREEN, fontWeight: 700 }}>コピーしました</span>}
-        </span>
-    );
-};
-
-export default LineWorksButton;
diff --git a/frontend/src/components/list/ListKaeru.tsx b/frontend/src/components/list/ListKaeru.tsx
index 57ef2f9c..a58c6a83 100644
--- a/frontend/src/components/list/ListKaeru.tsx
+++ b/frontend/src/components/list/ListKaeru.tsx
@@ -9,7 +9,7 @@ import { generateULID } from '../../utils/createULID';
 import Modal from 'react-bootstrap/Modal';
 import { setStyleClassSpec } from '../../utils/setStyleClassSpec';
 import { thisYear } from '../../utils/thisYear';
-import { dateFormate, monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH } from './listUtils';
+import { dateFormate, monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField } from './listUtils';
 import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './listTags';
 import type { TagKey } from './listTags';
 import { kataToHira } from '../../utils/kataToHira';
@@ -342,8 +342,7 @@ const ListKaeru = ({ onReload }: Props) => {
                 customer_contacts_phone_number: phone_number_1,
                 customer_contacts_mobile_phone_number: phone_number_2,
                 customer_contacts_email: filteredCustomer.mail || '',
-                // ⚠️ v2.2.188: LINE ID は ⚠️ **値があるときだけ**送る（⚠️ 空なら列ごと送らない＝顧客側は NULL のまま）
-                ...(String(filteredCustomer.line_id ?? '').trim() !== '' ? { line_id: String(filteredCustomer.line_id).trim() } : {}),
+                ...lineIdField(filteredCustomer.line_id),
                 postal_code: filteredCustomer.zip || '',
                 full_address: `${filteredCustomer.pref || ''} ${filteredCustomer.city || ''} ${filteredCustomer.town || ''} ${filteredCustomer.street || ''} ${filteredCustomer.building || ''}`,
                 sales_promotion_name: filteredCustomer.response_medium || '',
diff --git a/frontend/src/components/list/ListOrder.tsx b/frontend/src/components/list/ListOrder.tsx
index 9e904c9e..8b85a044 100644
--- a/frontend/src/components/list/ListOrder.tsx
+++ b/frontend/src/components/list/ListOrder.tsx
@@ -9,7 +9,7 @@ import { mediumFormate } from '../../utils/mediumFormate';
 import InformationEdit from '../information/InformationEdit';
 import { generateULID } from '../../utils/createULID';
 import { positions } from './listUtils';
-import { monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH } from './listUtils';
+import { monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField } from './listUtils';
 import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './listTags';
 import type { TagKey } from './listTags';
 import { useIsSp } from '../../utils/isSp';
@@ -436,8 +436,7 @@ const ListOrder = ({ onReload }: Props) => {
                 customer_contacts_mobile_phone_number: phone_number_1,
                 customer_contacts_phone_number: phone_number_2,
                 customer_contacts_email: mailValue,
-                // ⚠️ v2.2.188: LINE ID は ⚠️ **値があるときだけ**送る（⚠️ 空なら列ごと送らない＝顧客側は NULL のまま）
-                ...(String(filteredCustomer.line_id ?? '').trim() !== '' ? { line_id: String(filteredCustomer.line_id).trim() } : {}),
+                ...lineIdField(filteredCustomer.line_id),
                 postal_code: filteredCustomer.zip || '',
                 full_address: `${filteredCustomer.pref || ''} ${filteredCustomer.city || ''} ${filteredCustomer.town || ''} ${filteredCustomer.street || ''} ${filteredCustomer.building || ''}`,
                 sales_promotion_name: filteredCustomer.response_medium || '',
diff --git a/frontend/src/components/list/ListResale.tsx b/frontend/src/components/list/ListResale.tsx
index db6bfce5..c6f95684 100644
--- a/frontend/src/components/list/ListResale.tsx
+++ b/frontend/src/components/list/ListResale.tsx
@@ -10,7 +10,7 @@ import Modal from 'react-bootstrap/Modal';
 import { setStyleClassUsed } from '../../utils/setStyleClassUsed';
 import { thisYear } from '../../utils/thisYear';
 import { useIsSp } from '../../utils/isSp';
-import { dateFormate, monthFormate, handleBlack, toHalfWidth, matchesBlackList, positions, previousMonthValue, currentMonthValue, summaryTableWidth, SUMMARY_COLUMN_WIDTH } from './listUtils';
+import { dateFormate, monthFormate, handleBlack, toHalfWidth, matchesBlackList, positions, previousMonthValue, currentMonthValue, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField } from './listUtils';
 import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './listTags';
 import type { TagKey } from './listTags';
 import { hiraToKata } from '../../utils/nexusUtils';
@@ -250,8 +250,7 @@ const ListResale = ({ onReload }: Props) => {
                 customer_contacts_phone_number: phone_number_1,
                 customer_contacts_mobile_phone_number: phone_number_2,
                 customer_contacts_email: filteredCustomer.mail || '',
-                // ⚠️ v2.2.188: LINE ID は ⚠️ **値があるときだけ**送る（⚠️ ① list_resale_sync.php が受ける。空なら NULL）
-                ...(String(filteredCustomer.line_id ?? '').trim() !== '' ? { line_id: String(filteredCustomer.line_id).trim() } : {}),
+                ...lineIdField(filteredCustomer.line_id),
                 postal_code: filteredCustomer.zip || '',
                 full_address: `${filteredCustomer.pref || ''} ${filteredCustomer.city || ''} ${filteredCustomer.town || ''} ${filteredCustomer.street || ''} ${filteredCustomer.building || ''}`,
                 sales_promotion_name: filteredCustomer.response_medium || '',
diff --git a/frontend/src/components/list/listUtils.ts b/frontend/src/components/list/listUtils.ts
index 4680b359..ffa094a9 100644
--- a/frontend/src/components/list/listUtils.ts
+++ b/frontend/src/components/list/listUtils.ts
@@ -194,3 +194,9 @@ export const summaryTableWidth = (columns: number, labelWidth: number): number =
 
 /** 1列の幅。⚠️ ここを変えるときは各テーブルの td の width も合わせること */
 export const SUMMARY_COLUMN_WIDTH = 100;
+
+/** 同期で顧客へ送る LINE ID。⚠️ 値があるときだけ返す（空なら列ごと送らない＝顧客側は NULL のまま） */
+export const lineIdField = (value: unknown): { line_id?: string } => {
+    const lineId = String(value ?? '').trim();
+    return lineId === '' ? {} : { line_id: lineId };
+};
```
