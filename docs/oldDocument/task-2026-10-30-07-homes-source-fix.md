# 作業記録 2026-10-30-07　売り反響の反響元を「HOME'S」にそろえる・反響元が消える不具合（v2.2.237）

## 依頼
- source カラムに HOME'S が入らない → 「すべて HOME'S にそろえる」（回答）。新しいブランチで修正
- HomesSaleAssessmentToDashboard からの反響は自動的に source が HOME'S になるように。本番で試したら brokerage_listings の source が NULL のままだった

## 原因
- 取り込み（v2.2.236）は source = "HOME's"（設定の書き方）で登録していた
- 売り反響の一覧（LeadSell.tsx）の反響元の欄は `defaultValue` が選択肢（SELL_SOURCES = "HOME'S" など）に無いと空の「反響元」になり、`onBlur` で**値が変わっていなくても**保存していた → 欄を触っただけで source = NULL
  - ⚠️ 選択肢に無い既存の反響元（営業案件・求むチラシ・問合せ・営業紹介・"HOME's"）すべてで起きる状態だった

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/realty | homesAssessment.ts | `HOMES_SOURCE` を "HOME'S" に（コメントも） |
| frontend/src/components/realty/sell | LeadSell.tsx | 反響元の欄：`currentSource` を作り、値が変わったときだけ保存。選択肢に無い値は選択肢に足して出す |
| frontend/src/utils | version.ts | 2.2.237 |
| backend/scripts/sql | **2026-10-30_update_log_2.2.237.sql**（新規） | "HOME's" → "HOME'S"（source 列すべて・settings の JSON）、NULL に上書きされた売り反響の反響元を戻す（homes: は HOME'S、それ以外は raw_data.source）、確認、更新履歴、業務ガイド |
| backend/scripts/guide/articles/common | screen-245.md | 自動登録の節の反響元を「HOME'S」に |

## 確認（ローカル）
- SQL：source の "HOME's" 83件（売り51・台帳18・買い14）→ "HOME'S"。settings の sources・srcCosts のキー → "HOME'S"（JSON は有効）。raw_data・logs はそのまま
- SQL の戻し：テスト行で homes: → HOME'S、raw_data に "HOME's" → HOME'S、raw_data に 営業案件 → 営業案件、手がかり無し → NULL のまま（確認の行に数が出る）
- ② の取り込み（架空のメール）：source = "HOME'S" で登録
- Playwright（売り反響の画面）
  - HOME'S の行の反響元の欄が「HOME'S」、反響元別の表の「HOME'S」に反響単価 ¥11,000
  - 「営業案件」の行の欄が「営業案件」と出て、触って離れても DB は 営業案件 のまま（HOME'S の行も同じ）
  - 値を イエイ に変えて離れると DB が イエイ になる。ページのエラーなし
- 型チェック：LeadSell.tsx に既存のエラーが1件（420行 `getCurrentDateTime` が未定義。main にもある。「📞 架電」ボタンのエラーの原因と思われる。今回は直していない）
- テストの行・その変更履歴（kind = logs）・テスト用の担当は削除済み。⚠️ ローカルで SQL を2回流して更新履歴が2行になったので1行消した（SQL の注記を「1回だけ流す」に直した）

## 差分
```diff
diff --git a/backend-express/src/features/realty/homesAssessment.ts b/backend-express/src/features/realty/homesAssessment.ts
index b2c975f0..e345dd51 100644
--- a/backend-express/src/features/realty/homesAssessment.ts
+++ b/backend-express/src/features/realty/homesAssessment.ts
@@ -16,12 +16,12 @@ import { keyMatches } from '../memberEntry/entry';
  *   1. 外部ID（extId = 'homes:' + 査定ID）が同じ売り反響がある。⚠️ extId は UNIQUE
  *   2. 電話番号（数字だけで比べる）が同じ売り反響が、受信日の前後90日にある
  *      ⚠️ 同じメールがコールセンター（ミカタ）にも届き、あとからミカタの明細でも同じお客様が入るため
- * ⚠️ 反響元は "HOME's"（売り反響の設定の反響元・反響単価のキーと同じ書き方）。⚠️ フェーズは「リード受信」。担当は空（画面で割り当てる）。
+ * ⚠️ 反響元は "HOME'S"（v2.2.237 で一覧の選択肢・設定・既存の行もこの書き方にそろえた）。⚠️ フェーズは「リード受信」。担当は空（画面で割り当てる）。
  * ⚠️ id は画面（realty/common/leadUtiles.ts の newRecordId）と同じ形（'x' ＋ 時刻の36進 ＋ 乱数）。
  * ─────────────────────────────────────────────
  */
 
-const HOMES_SOURCE = "HOME's";
+const HOMES_SOURCE = "HOME'S";
 const PHASE = 'リード受信';
 const EXT_PREFIX = 'homes:';
 /** 電話番号で重複を見る期間（受信日の前後） */
diff --git a/backend/scripts/guide/articles/common/screen-245.md b/backend/scripts/guide/articles/common/screen-245.md
index 8c7367d4..d96ff1fe 100644
--- a/backend/scripts/guide/articles/common/screen-245.md
+++ b/backend/scripts/guide/articles/common/screen-245.md
@@ -43,7 +43,7 @@ summary: 売り反響・買い反響の画面の上に出るタイル・反響
 
 ## HOME'S の査定依頼メールの自動登録
 LIFULL HOME'S の「＜実名＞査定依頼がありました」のメールは、届いてから数分で**売り反響に自動で登録**されます（5分おきに直近1日分のメールを確かめます）。
-- 反響元は「HOME's」、段階は「リード受信」、担当は空です。担当は一覧で割り当ててください
+- 反響元は「HOME'S」、段階は「リード受信」、担当は空です。担当は一覧で割り当ててください
 - 物件の所在地・物件種別（区分）・売却理由・売却希望時期・お名前・電話・メールが入ります
 - 間取り・面積・築年・現況・名義・ご要望・お客様の記入・同時送信社数・査定IDは**備考**に入ります
 - 同じ査定IDのメールや、前後90日に**同じ電話番号の売り反響**がすでにあるときは、登録しません（コールセンターの明細などで先に入っている場合も二重になりません）
diff --git a/frontend/src/components/realty/sell/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
index 7c1d99bd..fa4c71df 100644
--- a/frontend/src/components/realty/sell/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -656,18 +656,25 @@ const LeadSell = () => {
                   const counts = parseCallCounts(lead.callDates);
                   // 💡 ハイライト判定: 担当者が未設定の場合
                   const isUnassigned = !lead.staff || lead.staff.trim() === '';
+                  const currentSource = lead.source || lead.portal || '';
 
                   return (
                     <tr key={lead.id}>
                       <td style={getTdStyle(isUnassigned)}>{formatDate(lead.receivedDate)}</td>
                       <td style={getTdStyle(isUnassigned)}>
+                        {/*
+                          ⚠️ v2.2.237: 値が変わったときだけ保存する。選択肢に無い反響元（営業案件・問合せなど）もその値を選択肢に出す。
+                            以前は選択肢に無い値だと「反響元」（空）と表示され、触っただけで source が NULL で上書きされていた
+                        */}
                         <select
                           style={{ ...compactInputStyle, fontWeight: 'bold' }}
-                          defaultValue={lead.source || lead.portal || ''}
-                          onBlur={(e) => handleApiUpdate(lead.id, 'source', e.target.value)}
+                          defaultValue={currentSource}
+                          onBlur={(e) => {
+                            if (e.target.value !== currentSource) handleApiUpdate(lead.id, 'source', e.target.value);
+                          }}
                         >
                           <option value="">反響元</option>
-                          {SELL_SOURCES.map(p => <option key={p} value={p}>{p}</option>)}
+                          {[...SELL_SOURCES, ...(currentSource && !SELL_SOURCES.includes(currentSource) ? [currentSource] : [])].map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                       </td>
                       <td style={getTdStyle(isUnassigned)} className="fw-bold">
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 6e01c822..d68de8a0 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.236';
+export const newVersion = '2.2.237';
```

## 2026-10-30_update_log_2.2.237.sql（業務ガイドの部分を除く）
```sql
-- =====================================================================
-- v2.2.237 売り反響などの反響元「HOME's」（s が小文字）を「HOME'S」にそろえる ＋ update_log
--   （末尾に業務ガイド「売り反響・買い反響の歩留まり（不動産企画係）」の上書き）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（データの修正は何度流しても同じだが、4 の更新履歴は流すたびに1行増える）
-- ⚠️ 一覧の反響元の選択肢（画面）は "HOME'S"。設定の反響元・反響単価と既存の行が "HOME's" だったため、選択欄が空に見えていた。
-- ⚠️ 照合順序が大文字・小文字を区別しないため、比較は BINARY で "HOME's" だけを選ぶ。
-- ⚠️ 取り込み時の元データの写し（raw_data）と変更履歴（kind = logs）は記録なので直さない。
-- =====================================================================

-- 1. 反響元（売り反響・媒介獲得台帳・買い反響など、source 列のすべて）
UPDATE brokerage_listings SET source = 'HOME''S' WHERE BINARY source = 'HOME''s';

-- 1-2. 一覧の選択欄で空（NULL）に上書きされた反響元を戻す（⚠️ 反響元が空の行だけ）
--   ⚠️ v2.2.236 までは、選択肢に無い反響元の行で選択欄を触っただけで source が NULL になっていた（LeadSell.tsx を v2.2.237 で修正）
--   a) HOME'S の査定依頼メールの自動登録（extId = homes:…）は "HOME'S"
UPDATE brokerage_listings SET source = 'HOME''S'
 WHERE kind = 'leads' AND extId LIKE 'homes:%' AND (source IS NULL OR source = '');
--   b) 以前のアプリから取り込んだ行は、取り込み時の元データの写し（raw_data.source）に戻す（"HOME's" は "HOME'S" に）
UPDATE brokerage_listings
   SET source = REPLACE(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.source')), 'HOME''s', 'HOME''S')
 WHERE kind = 'leads' AND (source IS NULL OR source = '')
   AND JSON_VALID(raw_data) AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.source')), '') NOT IN ('', 'null');

-- 2. 設定（反響元の一覧と、反響単価のキー）。⚠️ JSON の中の "HOME's" をそのまま "HOME'S" に置き換える
UPDATE app_state SET data = REPLACE(data, '"HOME''s"', '"HOME''S"') WHERE `key` = 'settings' AND BINARY data LIKE '%"HOME''s"%';

-- 3. 確認（1・2列目は 0、3列目は 1 ならよい。4列目は戻せなかった売り反響の数（画面で手で選び直す））
SELECT
  (SELECT COUNT(*) FROM brokerage_listings WHERE BINARY source = 'HOME''s') AS source_lower_left,
  (SELECT COUNT(*) FROM app_state WHERE `key` = 'settings' AND BINARY data LIKE '%"HOME''s"%') AS settings_lower_left,
  (SELECT JSON_VALID(data) FROM app_state WHERE `key` = 'settings') AS settings_json_ok,
  (SELECT COUNT(*) FROM brokerage_listings WHERE kind = 'leads' AND (source IS NULL OR source = '')) AS leads_source_empty_left;

-- 4. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.237', '2026-10-30', '売り反響の反響元「HOME''s」を、一覧の選択肢と同じ「HOME''S」にそろえた（既存の反響・媒介獲得台帳・買い反響・設定の反響元と反響単価、HOME''S の査定依頼メールの自動登録）。売り反響の一覧で、反響元の欄を触っただけで反響元が消える不具合を直した。');

```
