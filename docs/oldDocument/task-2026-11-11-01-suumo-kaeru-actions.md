# 作業記録 v2.2.263　SUUMO（建売）の反響を、顧客ごとではなく反響ごとに取り込む

## 依頼（2026-11-11）
- 「action_list_20261111094905.csv / customer_list_20261111094807.csv は suumo 建売部門の反響一覧。action_list が物件ごとの反響、customer_list が顧客ごとの反響。現在は customer_list を取り込んでいるが、運用側からの要望ですべての反響を取り込みたい。inquiry_customer_kaeru・suumo_db_kaeru を見て、バックエンドの取り込みの状態とテーブル構造を csv と比較する。runSuumoKaeru.ts も確認する」
- 決定：「1. 別の行で出す　2.（キャンセルは）取り込まない　3. 顧客ID が action_list にないのなら（顧客 CSV も）取り込む必要がある　4. 任せる」
- 追加：「現在の runSuumoKaeru.ts は全反響を取り込んでいたが、**取り込み日から遡って過去3日までの分**とするのでそのロジックを ts 側につくってほしい」
- 訂正：「PG CLOUD ではなく現在は Dashboard である」（建売の反響一覧の連携先は Dashboard の顧客データ `master_data_kaeru`）
- 条件：「action_list の重複判定ロジックがしっかり確立できるなら着手してよい。https://kr-hometour.suumo.jp/actions の『検索結果をダウンロード』でダウンロードできる。処理関数を追加して runSuumoKaeru.ts も修正すること」

## 調べたこと
### 今までの流れ
1. sync の `runSuumoKaeru.ts` が「お客様」画面の CSV（顧客ごと）を落とし、**毎回すべての行**を ① の `request: 'suumo_db_kaeru'` へ送る。
2. ① の `suumo_db_kaeru.php` が `suumo_db_kaeru` に入れる（キーは顧客ID。全列を上書き）。
3. 続けて `portal/suumo_kaeru.php` が `inquiry_customer_kaeru` に `INSERT IGNORE`（`inquiry_id = suumo_<顧客ID>`。反響日・物件は**初回の反響**）。
→ 反響一覧には1人1行。2回目以降の反響、あとから入った来場予約は反映されない。

### 2つの CSV（2026-11-11）
| | customer_list | action_list |
|---|---|---|
| 行数・列数 | 574行・65列 | 731行・35列 |
| キー | 顧客ID | 予約ID（英数8桁・369件）か 反響ID（数字10桁・362件）の**どちらか一方** |
| 顧客ID | あり | なし |
| 日時の形 | `YYYY/MM/DD HH:MM:SS`。⚠️「追客状況の最終更新日時」だけ `YYYY/M/D`（ゼロ埋め無し・時刻無し） | `YYYY/MM/DD HH:MM:SS` |

- 顧客の「反響回数」の合計 = 731 = action の行数。顧客の初回・最新の反響ID は 574件すべて action にある。
- 今は入っていない反響 = 157件（2回以上反響した 100人の2回目以降。最多は1人で7回）。
- action にしか無い：予約ステータス（確定 343・キャンセル 26）・案内日時・集合場所・キャンセル日時/経路・連絡事項（391件）・プロジェクトコード・貴社物件コード・間取り・面積・交通。
- action に無い：顧客ID・追客状況・来場の実績・成約。
- 同じ人・同じ受付日時の行が 55組・132行（複数の物件にまとめて資料請求）。同じ人・同じ時刻・同じ物件の行は無い。

## 重複の判定（実データ 731件で確かめた）
| # | 何を防ぐか | 決め方 | 確かめた結果 |
|---|---|---|---|
| 1 | 同じ反響の送り直し | `action_id`（予約ID か 反響ID）が一意。表は UNIQUE、反響一覧は `suumo_act_<ID>` | 731件すべて一意。同じ ID が別の顧客に付く件数 0。送り直しても 0件追加 |
| 2 | 以前の行（`suumo_<顧客ID>`＝初回の反響）との二重 | `suumo_db_kaeru` の初回の予約ID・反響ID と `action_id` が**完全一致**し、`suumo_<顧客ID>` の行があれば足さない | 「以前の行」と「反響ごとの行」の両方にある反響 0件 |
| 3 | 同じ人の別の反響 | 別の行として足す（決定 1）。備考の先頭に印。**重複のフラグは立てない**（立てると一覧で連携済みの側に入り、見落とす） | 印は、その顧客の2行目以降だけに付いた |
| 4 | どの顧客の反響か | id（初回・最新の ID）→ name（氏名＋電話 か 氏名＋メール）→ mail → phone。**候補が1人のときだけ**結ぶ | id 674・name 56・mail 1 = 731件すべて。ID と氏名の結果が食い違う行 0。顧客ごとの件数が「反響回数」と全員一致 |

- 氏名は NFKC にして空白を除く、電話は数字だけ、メールは小文字にして比べる。
- SUUMO 側に「氏名と電話が同じ別の顧客」が3組ある → 候補が2人以上なら結ばない（結べない行も反響一覧には足す。印が付かないだけ）。
- キャンセル（決定 2）：反響一覧に足さない。すでにある行（以前の行を含む）は消さず、備考の先頭に `【予約キャンセル 日時】` を1回だけ付ける。
  - ⚠️ キャンセル 26件のうち 24件は、顧客の初回の反響（＝以前の行がある）。ローカルでは 24行の備考に印が付いた。

## 作ったもの
### DB（① SQL `backend/scripts/sql/2026-11-11_suumo_action_kaeru.sql`）
- 新しい表 `suumo_action_kaeru`（反響ごとに1行。`action_id` UNIQUE、`customer_id`・`customer_match`、CSV の35項目、`remarks`）
- update_log（2.2.263）、業務ガイドの記事

### ②（backend-express）
| ファイル | 内容 |
|---|---|
| **features/suumoKaeru.ts**（新規） | `importSuumoKaeruActions`（`suumo_kaeru:actions`）。部品：`cleanAction`・`loadCustomers`（顧客に結ぶ `resolve` を返す）・`upsertActions` |
| features/syncLog.ts | 合い言葉の確認 `keyMatches` を `syncKeyMatches` として export（suumoKaeru.ts でも使う） |
| gateway/registry.ts | `suumo_kaeru` / `actions` を登録（auth: none。合い言葉 `SYNC_LOG_SECRET`） |
| middlewares/publicFormRateLimit.ts | `suumo_kaeru` も `syncLogLimiter`（失敗だけを数える）に |

- ⚠️ sync から ② へ直接送る（`sync_log:write` と同じ）。① の `express_proxy.php` には入れていない（① を通すと 404 になるのが正しい）。
- 応答：`{ status, received, saved, added, alreadyListed, legacyRow, canceled, cancelMarked, unmatched, invalid }`

### ①（PHP）
- `backend/src/handlers/suumo_db_kaeru.php`：`require_once portal/suumo_kaeru.php`（反響一覧への追加）をやめた。`suumo_db_kaeru` への取り込みはそのまま。
  - ⚠️ `portal/suumo_kaeru.php` のファイルは残した（呼ばれないだけ）。

### sync（`C:\Users\shinji-kawano\projects\sync`。ブランチ `suumo-actions`。⚠️ ビルドと dist のコミットは利用者）
| ファイル | 内容 |
|---|---|
| **src/utils/suumoKaeruCsv.ts**（新規） | `readSuumoCsv`・`recentDays`・`recentCutoff`・`comparableDate`・`filterRecentActions`・`filterRecentCustomers`・`ACTION_HEADER_MAP`・`CUSTOMER_HEADER_MAP`・`mapAction`・`mapCustomer`・`importSuumoKaeruActions`・`importSuumoKaeruCustomers` |
| src/services/runSuumoKaeru.ts | ログイン → `downloadCsv`（顧客）→ `importSuumoKaeruCustomers` → `downloadCsv`（反響。`/actions`）→ `importSuumoKaeruActions`。見出しの対応表と送信は util へ移した |

- **過去3日の絞り込み**：日本時間で「今日の0時 − 3日」以降。
  - 反響：「受付日時」か「キャンセル日時」が範囲内。
  - 顧客：「登録日時」「最新反響_受付日時」「追客状況の最終更新日時」のどれかが範囲内。
  - `SUUMO_KAERU_DAYS`（数字。`all` ですべて。未設定・数字以外は 3）。
- `/actions` のダウンロードは、`/customers` と同じ手順（「検索結果をダウンロード」→ 確認のボタン）を1つの関数 `downloadCsv` にまとめて使う。⚠️ `/actions` の画面は見ていない（利用者の説明「同じボタン」に基づく）。確認のボタンの XPath が `/customers` と違う場合は、ここを直す。
- 顧客の送信が失敗した塊も、実行結果（sync_run_log）に残るようにした（以前はコンソールと /tmp のファイルだけで、「成功」に隠れていた）。`/tmp/import_result_summary.json` は書かなくなった。
- 顧客の取り込みが失敗しても、反響の取り込みは動かす。

### 業務ガイド
- 「**反響一覧（建売営業）**」（spec/screen-010.md）：節「SUUMO の反響は、反響ごとに1行」を追加（同じお客様の印・まとめて資料請求・キャンセルは出ない・二重に取り込まない注意）。

## テスト（ローカル）
### 取り込み（`scratchpad/t263.ts`。39項目すべて OK。出力は件数だけ）
- 絞り込みの計算：日数（未設定 3・5・all・abc・0・-1）、範囲（11/11 00:30 → 11/08、11/10 23:59 → 11/07、月またぎ、0日、all）、境界（11/08 00:00:00 は入り 11/07 23:59:59 は入らない）、キャンセル日時だけが範囲内の行も送る、`2026/9/7` を `2026/09/07 00:00:00` にそろえる。
- 実データ：過去3日（11/08 以降）は 反響 4件・顧客 2件。
- 取り込み前：SUUMO の行 570・顧客の表 562・反響の表 0。
- 既定（3日）：顧客 2件を ① へ → **反響一覧の行数は変わらない**（① が足さなくなった）。反響 4件を ② へ → 4行追加。
- all：顧客 574件。反響 731件 → `added 163・alreadyListed 4・legacyRow 538・canceled 26・cancelMarked 24・unmatched 0・invalid 0`。
- 取り込み後：SUUMO の行 737（うち反響ごとの行 167）。
- 送り直し：追加 0・行数そのまま・キャンセルの印は増えない。もう1回最初から流しても同じ。
- DB での確認：inquiry_id の重複 0／以前の行と反響ごとの行の両方にある反響 0／キャンセルの反響ごとの行 0／顧客ごとの行数 = キャンセルでない反響の数（合わない顧客 0）／顧客ごとの反響の数 = SUUMO の「反響回数」／「同じお客様」の印は2行目以降だけ（155行）／予約の反響だけ来場予約の日時が入る。
- 合い言葉が違う：例外にならず、塊ごとに理由が残る（401 は送り直さない）。未設定：送らず、理由が残る。

### 認証
- ② へ直接：合い言葉が違う → 401、正しい → 200。
- ① 経由：`suumo_kaeru` は 404（① を通さない口）。`{"request":"list","category":"spec"}` はトークン無しで 401（② まで届く）。

### 画面（Playwright・3100。`scratchpad/t263_ui.cjs`）
- ① 経由の一覧（`list`・spec）に、反響ごとの行 167件がすべて入っている（note・物件あり）。
- 建売の反響一覧に SUUMO の行が出る。備考（虫めがね）を開くと反響の項目が読め、先頭に「【同じお客様の反響あり】」が出る行がある。エラー無し。

### 途中で見つけて直したこと
- 最初の集計で「過去3日の顧客は 286件」としたのは誤り。「追客状況の最終更新日時」が `2026/9/7` の形で、文字のまま比べていた（`2026/9/7` > `2026/11/08` になる）。正しくは 2件。ts に `comparableDate` を入れ、ゼロ埋めの無い日付もそろえてから比べる。
- 備考の印の言葉を、画面・記事に合わせて「顧客DBに取込済み／未取込（この行が届いた時点）」にした。

### 後片づけ
- 仮スタッフ 999999 は消した（0件）。控えの表 `zz_bak263_*` は消した。3100 は netstat → taskkill で止めた。
- ⚠️ ローカルの DB には、2026-11-11 の CSV を取り込んだ状態（SUUMO の行 737）が残っている（本番で手順5 を行ったあとと同じ形）。

## 残っていること・知っておくこと
- sync のビルド・dist のコミット・Heroku への push（利用者）。
- `/actions` の画面の実物での確認（Heroku で1回動かして、ログの `[SUUMO 反響] CSV n件 → 送る m件` を見る）。
- 過去3日の絞り込みのため、古いお客様の来場・成約の変化は、「登録日時」「最新反響」「追客状況の最終更新日時」が動かない限り `suumo_db_kaeru` に反映されない。
- ① の `suumo_db_kaeru`（顧客 CSV の口）はログインの確認が無いまま（将来の課題。今回は変えない）。

## git diff（Dashboard：syncLog.ts・registry.ts・publicFormRateLimit.ts・suumo_db_kaeru.php・記事・version.ts）
```diff
diff --git a/backend-express/src/features/syncLog.ts b/backend-express/src/features/syncLog.ts
index 9bc8edd8a..812780fe4 100644
--- a/backend-express/src/features/syncLog.ts
+++ b/backend-express/src/features/syncLog.ts
@@ -40,8 +40,8 @@ const fail = (httpStatus: number, message: string): SyncLogResult => ({ httpStat
 const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
 const cut = (v: unknown, max: number): string => str(v).slice(0, max);
 
-/** 合い言葉。⚠️ 未設定なら必ず false。⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる（meta_scrape と同じ） */
-const keyMatches = (input: string): boolean => {
+/** sync からの書き込みの合い言葉（⚠️ v2.2.263 から suumoKaeru.ts も使う）。⚠️ 未設定なら必ず false。⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる（meta_scrape と同じ） */
+export const syncKeyMatches = (input: string): boolean => {
   const expected = env.syncLogSecret;
   if (expected === '') return false;
   const a = Buffer.from(input);
@@ -80,7 +80,7 @@ const cleanRow = (raw: unknown): CleanRow | null => {
  * 応答: { status: 'success', saved, skipped }。合い言葉が違えば 401（流量の上限は失敗だけを数える。publicFormRateLimit.ts）
  */
 export const writeSyncLog = async (body: Record<string, unknown>): Promise<SyncLogResult> => {
-  if (!keyMatches(str(body.key))) {
+  if (!syncKeyMatches(str(body.key))) {
     if (env.syncLogSecret === '') logger.warn('sync_log: SYNC_LOG_SECRET が未設定のため、sync の実行結果を断りました。');
     return fail(401, '合い言葉が正しくありません');
   }
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 6fc593772..a56317f5a 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -146,6 +146,7 @@ import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
 import { listLoanPlanRates, uploadLoanPlanRates } from '../features/loanPlanRate';
 import { listSecurityLog } from '../features/securityLog';
 import { listSyncLog, writeSyncLog } from '../features/syncLog';
+import { importSuumoKaeruActions } from '../features/suumoKaeru';
 import { BUDGET_TABLE_AUTHORITY, listBudgetTable, uploadBudgetTable } from '../features/budgetTable';
 import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
 import { runSurveyCustomers, runSurveyLink, runSurveyStaff } from '../features/survey/staff';
@@ -3169,6 +3170,26 @@ register({
   handler: async (ctx) => (await listSyncLog(ctx.body)).body,
 });
 
+/**
+ * SUUMO（建売）の反響を、反響ごとに取り込む（v2.2.263）。features/suumoKaeru.ts 参照。
+ *
+ * ⚠️ sync が ② へ直接送る（① を通さない。① の express_proxy.php にも入れない）。ログイン無し・合い言葉（SYNC_LOG_SECRET。sync_log:write と同じ）。
+ *   ⚠️ 合い言葉の総当たりは publicFormRateLimit.ts の syncLogLimiter（失敗だけを数える）。
+ * ⚠️ 顧客ごとの CSV は今までどおり ① の suumo_db_kaeru.php が受ける（反響一覧に足すのはここだけ）。
+ */
+register({
+  request: 'suumo_kaeru',
+  roll: 'actions',
+  summary: '【書き込み】SUUMO（建売）の反響ごとの取り込み（合い言葉で確かめる）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'none',
+  handler: async (ctx) => {
+    const result = await importSuumoKaeruActions(ctx.body);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 /**
  * 予算テーブル（v2.2.243）。features/budgetTable.ts 参照。
  *
diff --git a/backend-express/src/middlewares/publicFormRateLimit.ts b/backend-express/src/middlewares/publicFormRateLimit.ts
index 15d0608ef..e47ff7d7a 100644
--- a/backend-express/src/middlewares/publicFormRateLimit.ts
+++ b/backend-express/src/middlewares/publicFormRateLimit.ts
@@ -162,7 +162,8 @@ export const publicFormRateLimit = (
   }
 
   // ⚠️ v2.2.259 sync の実行結果（認証なしの書き込み口。合い言葉の総当たりだけを止める）
-  if (request === 'sync_log') {
+  // ⚠️ v2.2.263 SUUMO（建売）の反響の取り込み（suumo_kaeru）も、同じ合い言葉・同じ制限
+  if (request === 'sync_log' || request === 'suumo_kaeru') {
     void syncLogLimiter(req, res, next);
     return;
   }
diff --git a/backend/scripts/guide/articles/spec/screen-010.md b/backend/scripts/guide/articles/spec/screen-010.md
index 0a63bb38b..c4e8d9787 100644
--- a/backend/scripts/guide/articles/spec/screen-010.md
+++ b/backend/scripts/guide/articles/spec/screen-010.md
@@ -18,6 +18,17 @@ summary: 届いた反響の確認・割り振り・取込。
 - **物件名**：問い合わせのあった物件
 - **希望エリア**
 
+## SUUMO の反響は、反響ごとに1行
+SUUMO の反響は、**お問い合わせ1回につき1行**で届きます。同じお客様が別の物件に問い合わせたり、資料請求のあとで見学を予約したりすると、その分だけ行が増えます（以前は、お客様1人につき最初の1行だけでした）。
+- 同じお客様の2回目以降の行は、備考（虫めがね）の先頭に「**【同じお客様の反響あり】**」と、最初の反響の日付・これまでの件数・顧客DBに取り込み済みかどうかが出ます
+- 複数の物件にまとめて資料請求があったときは、同じ日時の行が物件の数だけ並びます
+- **キャンセルされた見学予約は出ません**。すでに届いている行があとからキャンセルになったときは、行は消えず、備考の先頭に「**【予約キャンセル 日時】**」が付きます
+- 「物件名」「希望エリア」「来場予約」は、その行の反響のものです
+
+> 注意：「同じお客様の反響あり」の行を顧客DBに取り込むと、同じお客様が2人分になります。すでに取り込み済みなら、顧客タグの「重複」を付けて、取り込まないでください。
+
+> 要確認：備考の「取り込み済みかどうか」は、その行が届いた時点のものです。あとから取り込んだ場合は変わらないので、顧客DBでも確かめてください。
+
 ## 再読み込み
 上の「🔄 再読み込み」を押すと、絞り込み（期間・店舗・氏名など）はそのままで、新しく届いた反響を読み直します。
 
diff --git a/backend/src/handlers/suumo_db_kaeru.php b/backend/src/handlers/suumo_db_kaeru.php
index 52a188db6..11bff6345 100644
--- a/backend/src/handlers/suumo_db_kaeru.php
+++ b/backend/src/handlers/suumo_db_kaeru.php
@@ -224,8 +224,11 @@ try {
     exit;
 }
 
-// Dashboard連携
-require_once __DIR__ . '/portal/suumo_kaeru.php';
+// ⚠️ v2.2.263: 反響一覧（inquiry_customer_kaeru）へは、ここからは足さない。
+//   以前は portal/suumo_kaeru.php で「1人1行（初回の反響）」を足していたが、
+//   反響ごとの取り込み（② の suumo_kaeru:actions。features/suumoKaeru.ts）が1反響1行で足すようになった。
+//   ⚠️ ここで足すのを戻すと、同じ反響が `suumo_<顧客ID>` と `suumo_act_<反響ID>` の2行になる。
+//   ⚠️ この表（suumo_db_kaeru）は、② が反響を顧客に結ぶのに使う（顧客ID・初回の反響ID）。取り込みは続ける。
 
 // 成功レスポンス
 header('Content-Type: application/json; charset=utf-8');
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 926e182a6..1c8024ab6 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.262';
+export const newVersion = '2.2.263';
```

## 追加した SQL（表と更新履歴。記事の SQL はファイルの末尾を参照）：backend/scripts/sql/2026-11-11_suumo_action_kaeru.sql
```sql
-- =====================================================================
-- v2.2.263 SUUMO（建売）の反響を、顧客ごとではなく反響ごとに取り込む ＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- ⚠️ 表の作成は IF NOT EXISTS なので、2回流しても表は壊れない（更新履歴だけ増える）
-- =====================================================================

-- 1. 反響ごとの表（SUUMO の「反響」画面の CSV。1行 = 1つの反響）
--    ⚠️ action_id は CSV の「予約ID」か「反響ID」（どちらか一方だけが入る。形が違うので重ならない）
--    ⚠️ customer_id は ② が結ぶ（suumo_db_kaeru の顧客ID。結べなければ NULL）
CREATE TABLE IF NOT EXISTS suumo_action_kaeru (
  no INT NOT NULL AUTO_INCREMENT,
  action_id VARCHAR(64) NOT NULL COMMENT '予約ID または 反響ID',
  action_kind VARCHAR(16) NOT NULL COMMENT 'reserve（予約ID）/ inquiry（反響ID）',
  received_at VARCHAR(32) DEFAULT NULL COMMENT '受付日時',
  reaction_type VARCHAR(64) DEFAULT NULL COMMENT '反響種別',
  name VARCHAR(128) DEFAULT NULL,
  name_kana VARCHAR(128) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  email VARCHAR(128) DEFAULT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  fax VARCHAR(32) DEFAULT NULL,
  staff VARCHAR(128) DEFAULT NULL COMMENT 'お客様担当',
  reserve_status VARCHAR(64) DEFAULT NULL COMMENT '予約ステータス（確定・キャンセル）',
  guide_at VARCHAR(32) DEFAULT NULL COMMENT '案内日時',
  other_wish VARCHAR(255) DEFAULT NULL COMMENT 'その他のご希望日時',
  meeting_place VARCHAR(255) DEFAULT NULL COMMENT '集合場所',
  message TEXT DEFAULT NULL COMMENT '連絡事項',
  canceled_at VARCHAR(32) DEFAULT NULL COMMENT 'キャンセル日時',
  cancel_route VARCHAR(64) DEFAULT NULL COMMENT 'キャンセル経路',
  cancel_reason VARCHAR(255) DEFAULT NULL COMMENT 'キャンセル理由',
  property_type VARCHAR(64) DEFAULT NULL,
  property_code VARCHAR(64) DEFAULT NULL,
  project_code VARCHAR(64) DEFAULT NULL,
  property_name VARCHAR(255) DEFAULT NULL,
  property_price VARCHAR(64) DEFAULT NULL,
  property_address VARCHAR(255) DEFAULT NULL,
  listing_plan VARCHAR(128) DEFAULT NULL COMMENT '掲載企画',
  company_property_code VARCHAR(64) DEFAULT NULL COMMENT '貴社物件コード',
  transaction_type VARCHAR(64) DEFAULT NULL COMMENT '取引態様',
  origin_company VARCHAR(128) DEFAULT NULL COMMENT '元付会社',
  company_staff VARCHAR(128) DEFAULT NULL COMMENT '貴社ご担当',
  traffic VARCHAR(255) DEFAULT NULL COMMENT '交通',
  layout VARCHAR(64) DEFAULT NULL COMMENT '間取り',
  exclusive_area VARCHAR(32) DEFAULT NULL COMMENT '専有面積',
  building_area VARCHAR(32) DEFAULT NULL COMMENT '建物面積',
  land_area VARCHAR(32) DEFAULT NULL COMMENT '土地面積',
  customer_id VARCHAR(64) DEFAULT NULL COMMENT 'suumo_db_kaeru の顧客ID（② が結ぶ）',
  customer_match VARCHAR(16) DEFAULT NULL COMMENT '結び方: id / name / mail / phone',
  remarks TEXT DEFAULT NULL COMMENT 'CSV の全項目',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (no),
  UNIQUE KEY uq_suumo_action (action_id),
  KEY idx_suumo_action_customer (customer_id),
  KEY idx_suumo_action_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.263', '2026-11-11', '建売の反響一覧で、SUUMO の反響をお客様ごとではなく反響ごとに取り込むようにしました。同じお客様の2回目以降の反響も1行ずつ出ます（備考の先頭に印が付きます）。キャンセルされた予約は出ません。');
```

## 追加したファイルの全文：backend-express/src/features/suumoKaeru.ts
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../db/pool';
import type { Tx } from '../db/pool';
import { logger } from '../utils/logger';
import { syncKeyMatches } from './syncLog';

/**
 * SUUMO（建売。かえるホーム）の反響を、反響ごとに取り込む（v2.2.263）。表は suumo_action_kaeru。
 *
 * ─────────────────────────────────────────────
 *   以前 … sync が「お客様」画面の CSV（顧客ごと）を ① の suumo_db_kaeru.php へ送り、
 *          反響一覧（inquiry_customer_kaeru）に `suumo_<顧客ID>` で **1人1行（初回の反響）** だけ入れていた。
 *          → 同じ人の2回目以降の反響が出ない（2026-11-11 の CSV で 731件中 157件）
 *   今   … sync が「反響」画面の CSV（反響ごと）を、ここ（suumo_kaeru:actions）へ送る。
 *          反響一覧には `suumo_act_<予約ID か 反響ID>` で **1反響1行**。
 *          顧客ごとの CSV は今までどおり ① が suumo_db_kaeru に入れる（顧客ID・追客状況・成約はそちらにしか無い）。
 *          ⚠️ ① は反響一覧に足すのをやめた（portal/suumo_kaeru.php を呼ばない）。反響一覧の行はここだけが作る。
 *
 *   ⚠️⚠️ 二重にしない決まり（2026-11-11 の CSV 731件で確かめた）
 *     1. 同じ反響の送り直し … action_id（予約ID は英数8桁・反響ID は数字10桁。どちらか一方だけ）が一意。表も反響一覧も ID で1行
 *     2. 以前の行との二重 … `suumo_<顧客ID>` の行は、その顧客の「初回の反響」。suumo_db_kaeru の初回の予約ID・反響ID と
 *        action_id が同じで、`suumo_<顧客ID>` の行があれば、新しい行は足さない（ID の完全一致だけで決める）
 *     3. 同じ人の別の反響 … 別の行として足す（運用の決定）。備考の先頭に「同じお客様の反響あり」（初回の日付・件数・顧客DBに取込済みか）を付ける。
 *        ⚠️ 重複のフラグ（duplicate_flag）は立てない（立てると一覧で連携済みの側に入り、見落とす）
 *   ⚠️ どの顧客の反響か（customer_id）は、次の順で **候補が1人のときだけ** 結ぶ（2人以上なら結ばない）
 *     id（初回・最新の予約ID/反響ID）→ name（氏名＋電話 か 氏名＋メール）→ mail（メールだけ）→ phone（電話だけ）
 *   ⚠️ キャンセルの予約は反響一覧に足さない（運用の決定）。すでにある行は消さず、備考の先頭に「予約キャンセル」を付ける。
 *
 *   ⚠️ sync が ② へ直接送る（① を通さない。① の express_proxy.php にも入れない）。ログイン無し・合い言葉（SYNC_LOG_SECRET）。
 *     合い言葉の総当たりは publicFormRateLimit.ts の syncLogLimiter（失敗だけを数える）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface SuumoKaeruResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

/** 1回に受ける行の上限（sync は 500件ずつ送る） */
const MAX_ROWS = 500;
const UPSERT_CHUNK = 100;
const DATETIME_RE = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/;
const CANCELED = 'キャンセル';
const SAME_CUSTOMER_MARK = '【同じお客様の反響あり】';
const CANCEL_MARK = '【予約キャンセル';

/** sync が送る項目（suumoKaeruCsv.ts の ACTION_HEADER_MAP と同じ並び）と、表の列・長さの上限 */
const COLUMNS: ReadonlyArray<readonly [string, number]> = [
  ['received_at', 32], ['reaction_type', 64], ['name', 128], ['name_kana', 128], ['address', 255], ['email', 128], ['phone', 32], ['fax', 32],
  ['staff', 128], ['reserve_status', 64], ['guide_at', 32], ['other_wish', 255], ['meeting_place', 255], ['message', 5000],
  ['canceled_at', 32], ['cancel_route', 64], ['cancel_reason', 255], ['property_type', 64], ['property_code', 64], ['project_code', 64],
  ['property_name', 255], ['property_price', 64], ['property_address', 255], ['listing_plan', 128], ['company_property_code', 64],
  ['transaction_type', 64], ['origin_company', 128], ['company_staff', 128], ['traffic', 255], ['layout', 64],
  ['exclusive_area', 32], ['building_area', 32], ['land_area', 32], ['remarks', 20000],
];

type MatchKind = 'id' | 'name' | 'mail' | 'phone';
interface Action {
  actionId: string;
  kind: 'reserve' | 'inquiry';
  values: Record<string, string>;
  customerId: string | null;
  match: MatchKind | null;
}
interface Customer {
  id: string;
  firstIds: string[];
  name: string;
  phone: string;
  mail: string;
}
/** 同じ顧客の、反響一覧にすでにある行のまとめ（備考の印に使う） */
interface Known {
  count: number;
  firstDate: string;
  synced: boolean;
}

const fail = (httpStatus: number, message: string): SuumoKaeruResult => ({ httpStatus, body: { status: 'error', message } });
const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const nfkc = (v: unknown): string => str(v).normalize('NFKC');
const normName = (v: unknown): string => nfkc(v).replace(/\s+/g, '');
const normPhone = (v: unknown): string => nfkc(v).replace(/\D/g, '');
const normMail = (v: unknown): string => nfkc(v).trim().toLowerCase();
const legacyId = (customerId: string): string => `suumo_${customerId}`;
const actionInquiryId = (actionId: string): string => `suumo_act_${actionId}`;

/** 1行を確かめる。⚠️ ID・氏名・受付日時が無い／形が違う行は null（その行だけ捨てる） */
const cleanAction = (raw: unknown): Action | null => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const reserveId = str(r.reserve_id).trim();
  const inquiryId = str(r.inquiry_id).trim();
  const actionId = reserveId || inquiryId;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(actionId)) return null;
  const values: Record<string, string> = {};
  for (const [col, max] of COLUMNS) values[col] = str(r[col]).trim().slice(0, max);
  if (values.name === '' || !DATETIME_RE.test(values.received_at)) return null;
  return { actionId, kind: reserveId ? 'reserve' : 'inquiry', values, customerId: null, match: null };
};

/** 候補が1人だけなら、その顧客ID */
const only = (set: Set<string> | undefined): string | null => (set && set.size === 1 ? [...set][0] : null);
const addTo = (map: Map<string, Set<string>>, key: string, id: string): void => {
  const set = map.get(key);
  if (set) set.add(id);
  else map.set(key, new Set([id]));
};

/** 顧客（suumo_db_kaeru）を読み、反響を顧客に結ぶ関数を返す */
const loadCustomers = async (tx: Tx): Promise<{ customers: Map<string, Customer>; resolve: (a: Action) => void }> => {
  // ⚠️ 全件を読む（顧客は年に数千件。反響の送信は1日に数回・500件ずつ）
  const rows = await tx.query<DynamicRow>(
    `SELECT customer_id, name, phone, email, first_reaction_id, first_reaction_reserve_id, latest_reaction_id, latest_reaction_reserve_id
     FROM suumo_db_kaeru WHERE customer_id IS NOT NULL AND customer_id <> ''`
  );
  const customers = new Map<string, Customer>();
  const byActionId = new Map<string, Set<string>>();
  const byNamePhone = new Map<string, Set<string>>();
  const byNameMail = new Map<string, Set<string>>();
  const byPhone = new Map<string, Set<string>>();
  const byMail = new Map<string, Set<string>>();
  for (const r of rows) {
    const id = str(r.customer_id);
    const firstIds = [str(r.first_reaction_id), str(r.first_reaction_reserve_id)].map((s) => s.trim()).filter((s) => s !== '');
    const c: Customer = { id, firstIds, name: normName(r.name), phone: normPhone(r.phone), mail: normMail(r.email) };
    customers.set(id, c);
    for (const a of [...firstIds, str(r.latest_reaction_id).trim(), str(r.latest_reaction_reserve_id).trim()]) if (a !== '') addTo(byActionId, a, id);
    if (c.phone !== '') {
      addTo(byPhone, c.phone, id);
      if (c.name !== '') addTo(byNamePhone, `${c.name}\t${c.phone}`, id);
    }
    if (c.mail !== '') {
      addTo(byMail, c.mail, id);
      if (c.name !== '') addTo(byNameMail, `${c.name}\t${c.mail}`, id);
    }
  }
  const resolve = (a: Action): void => {
    const name = normName(a.values.name);
    const phone = normPhone(a.values.phone);
    const mail = normMail(a.values.email);
    const named = new Set<string>([
      ...(phone !== '' ? byNamePhone.get(`${name}\t${phone}`) ?? [] : []),
      ...(mail !== '' ? byNameMail.get(`${name}\t${mail}`) ?? [] : []),
    ]);
    const steps: Array<[MatchKind, string | null]> = [
      ['id', only(byActionId.get(a.actionId))],
      ['name', only(named)],
      ['mail', mail !== '' ? only(byMail.get(mail)) : null],
      ['phone', phone !== '' ? only(byPhone.get(phone)) : null],
    ];
    const hit = steps.find(([, id]) => id !== null);
    a.customerId = hit ? hit[1] : null;
    a.match = hit ? hit[0] : null;
  };
  return { customers, resolve };
};

const upsertActions = async (tx: Tx, actions: Action[]): Promise<void> => {
  const cols = ['action_id', 'action_kind', ...COLUMNS.map(([c]) => c), 'customer_id', 'customer_match'];
  // ⚠️ 顧客に結べなかったときは、以前に結んだ顧客ID を消さない
  const updates = cols
    .filter((c) => c !== 'action_id')
    .map((c) => (c === 'customer_id' || c === 'customer_match' ? `${c} = COALESCE(VALUES(${c}), ${c})` : `${c} = VALUES(${c})`));
  for (let i = 0; i < actions.length; i += UPSERT_CHUNK) {
    const chunk = actions.slice(i, i + UPSERT_CHUNK);
    await tx.execute(
      `INSERT INTO suumo_action_kaeru (${cols.join(', ')}) VALUES ${chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ')}
       ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
      chunk.flatMap((a) => [a.actionId, a.kind, ...COLUMNS.map(([c]) => (a.values[c] === '' ? null : a.values[c])), a.customerId, a.match])
    );
  }
};

/**
 * suumo_kaeru:actions。body = { key, rows: [{ reserve_id, inquiry_id, received_at, name, … }] }（sync の suumoKaeruCsv.ts が作る）
 * 応答: { status, received, saved, added, alreadyListed, legacyRow, canceled, cancelMarked, unmatched, invalid }
 *   added         … 反響一覧に新しく足した行
 *   alreadyListed … すでに `suumo_act_` の行がある（送り直し）
 *   legacyRow     … 以前の `suumo_<顧客ID>` の行（初回の反響）があるので足さなかった
 *   canceled      … キャンセルなので足さなかった（うち cancelMarked 件は、すでにある行の備考に印を付けた）
 *   unmatched     … 顧客に結べなかった（反響一覧には足す。「同じお客様」の印は付かない）
 */
export const importSuumoKaeruActions = async (body: Record<string, unknown>): Promise<SuumoKaeruResult> => {
  if (!syncKeyMatches(str(body.key))) return fail(401, '合い言葉が正しくありません');
  const list = Array.isArray(body.rows) ? body.rows : [];
  if (list.length > MAX_ROWS) return fail(400, `1回に送れるのは ${MAX_ROWS} 件までです`);
  // ⚠️ 同じ ID が1回の送信に2行あれば後の行を使う。古い反響から順に足す（「同じお客様」の印の初回を正しくするため）
  const byId = new Map<string, Action>();
  for (const raw of list) {
    const a = cleanAction(raw);
    if (a) byId.set(a.actionId, a);
  }
  const actions = [...byId.values()].sort((x, y) => x.values.received_at.localeCompare(y.values.received_at) || x.actionId.localeCompare(y.actionId));
  const result = { received: list.length, saved: actions.length, added: 0, alreadyListed: 0, legacyRow: 0, canceled: 0, cancelMarked: 0, unmatched: 0, invalid: list.length - actions.length };
  if (actions.length === 0) return { httpStatus: 200, body: { status: 'success', ...result } };

  await withTransaction(async (tx) => {
    const { customers, resolve } = await loadCustomers(tx);
    actions.forEach(resolve);
    result.unmatched = actions.filter((a) => a.customerId === null).length;
    await upsertActions(tx, actions);

    // 反響一覧にある SUUMO の行と、その行の顧客（以前の行は ID から、新しい行は suumo_action_kaeru から）
    const actionCustomer = new Map<string, string>();
    for (const r of await tx.query<DynamicRow>(`SELECT action_id, customer_id FROM suumo_action_kaeru WHERE customer_id IS NOT NULL`)) {
      actionCustomer.set(str(r.action_id), str(r.customer_id));
    }
    const listed = new Set<string>();
    const known = new Map<string, Known>();
    const remember = (customerId: string | null | undefined, date: string, synced: boolean): void => {
      if (!customerId) return;
      const k = known.get(customerId);
      if (!k) known.set(customerId, { count: 1, firstDate: date, synced });
      else {
        k.count += 1;
        k.synced = k.synced || synced;
        if (date !== '' && (k.firstDate === '' || date < k.firstDate)) k.firstDate = date;
      }
    };
    for (const r of await tx.query<DynamicRow>(`SELECT inquiry_id, inquiry_date, sync FROM inquiry_customer_kaeru WHERE inquiry_id LIKE 'suumo\\_%'`)) {
      const id = str(r.inquiry_id);
      listed.add(id);
      const customerId = id.startsWith('suumo_act_') ? actionCustomer.get(id.slice('suumo_act_'.length)) : id.slice('suumo_'.length);
      remember(customerId, str(r.inquiry_date), Number(r.sync) === 1);
    }

    for (const a of actions) {
      const v = a.values;
      const customer = a.customerId ? customers.get(a.customerId) : undefined;
      // ⚠️ 決まり 2：この反響が顧客の「初回の反響」で、以前の行（suumo_<顧客ID>）があれば、それがこの反響の行
      const legacy = customer && customer.firstIds.includes(a.actionId) && listed.has(legacyId(customer.id)) ? legacyId(customer.id) : null;
      const own = actionInquiryId(a.actionId);
      const existing = legacy ?? (listed.has(own) ? own : null);

      if (v.reserve_status === CANCELED) {
        result.canceled += 1;
        if (existing) {
          const mark = `${CANCEL_MARK} ${v.canceled_at || '日時不明'}】`;
          const done = await tx.execute(
            `UPDATE inquiry_customer_kaeru SET note = CONCAT(?, '\n', note) WHERE inquiry_id = ? AND INSTR(note, ?) = 0`,
            [mark, existing, CANCEL_MARK]
          );
          result.cancelMarked += done.affectedRows;
        }
        continue;
      }
      if (legacy) {
        result.legacyRow += 1;
        continue;
      }
      if (existing) {
        result.alreadyListed += 1;
        continue;
      }

      const date = v.received_at.slice(0, 10);
      const k = a.customerId ? known.get(a.customerId) : undefined;
      const mark = k
        ? `${SAME_CUSTOMER_MARK}初回 ${k.firstDate || '日付不明'}・これまで ${k.count}件・${k.synced ? '顧客DBに取込済み' : '顧客DBに未取込'}（この行が届いた時点）\n`
        : '';
      const [guideDate = '', guideTime = ''] = v.guide_at.split(' ');
      // ⚠️ INSERT IGNORE：NOT NULL で既定値の無い列（last_name など）を空で入れるため（① の portal/*_kaeru.php と同じ）
      const done = await tx.execute(
        `INSERT IGNORE INTO inquiry_customer_kaeru
           (inquiry_id, inquiry_date, first_name, first_name_kana, medium, response_medium, mobile, mail,
            property, area, reserved_date, reserved_time, building, brand, note)
         VALUES (?, ?, ?, ?, 'SUUMO', 'SUUMO', ?, ?, ?, ?, ?, ?, ?, 'かえる', ?)`,
        [own, date, v.name, v.name_kana, v.phone, v.email, v.property_name, v.property_address, guideDate, guideTime, v.address, mark + v.remarks]
      );
      if (done.affectedRows > 0) {
        result.added += 1;
        listed.add(own);
        remember(a.customerId, date, false);
      } else {
        result.alreadyListed += 1;
      }
    }
  });

  logger.info(`suumo_kaeru:actions ${JSON.stringify(result)}`);
  return { httpStatus: 200, body: { status: 'success', ...result } };
};
```

## 追加したファイルの全文（sync）：src/utils/suumoKaeruCsv.ts
```ts
import { readFile } from 'fs/promises';
import { parse } from 'csv-parse/sync';
import axios from 'axios';

/**
 * SUUMO（建売。かえるホーム）の CSV の扱い（2026-11-11。Dashboard v2.2.263）。
 *
 * ─────────────────────────────────────────────
 *   CSV は2つ（どちらも UTF-8・BOM 付き。日時は `YYYY/MM/DD HH:MM:SS`。⚠️ 顧客の「追客状況の最終更新日時」だけ `YYYY/M/D`）
 *     顧客ごと … https://kr-hometour.suumo.jp/customers の「検索結果をダウンロード」（customer_list_*.csv）
 *                → ① の suumo_db_kaeru（顧客ID・追客状況・成約。反響一覧には足さない）
 *     反響ごと … https://kr-hometour.suumo.jp/actions の「検索結果をダウンロード」（action_list_*.csv）
 *                → ② の suumo_kaeru:actions（反響一覧に1反響1行。二重にしない決まりは Dashboard の features/suumoKaeru.ts）
 *   ⚠️ 送る順番は 顧客 → 反響（② が反響を顧客に結ぶのに、顧客の表を使う）
 *
 *   ⚠️ 送るのは **取り込み日から遡って過去3日までの分** だけ（2026-11-11 の指示。以前は毎回すべて送っていた）
 *     日本時間で「今日の 0時 − 3日」以降。例：11/11 に動かすと 11/08 00:00:00 以降
 *       反響 … 「受付日時」か「キャンセル日時」が範囲内（⚠️ キャンセルは、すでに取り込んだ行に印を付けるために送る）
 *       顧客 … 「登録日時」「最新反響_受付日時」「追客状況の最終更新日時」のどれかが範囲内
 *     日数は環境変数 SUUMO_KAERU_DAYS で変えられる（数字。`all` ですべて）。
 *     ⚠️ 過去の分を入れ直すとき（最初の1回・取り込みが3日より長く止まったあと）だけ、大きい数か all にして動かす。
 * ─────────────────────────────────────────────
 */

export type CsvRecord = Record<string, string>;

const DEFAULT_DAYS = 3;
const JST_MS = 9 * 3600_000;
const DAY_MS = 86400_000;
const CHUNK_SIZE = 500;
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 1000;
/** 反響の送り先（② へ直接。sync の実行結果と同じ） */
const ACTIONS_URL = process.env.SYNC_LOG_URL || 'https://api.khg-marketing.info/api/gateway';
/** 顧客の送り先（① のゲートウェイ。⚠️ 検証のときだけ GATEWAY_URL でローカルへ向ける。runGeocode.ts と同じ） */
const CUSTOMERS_URL = process.env.GATEWAY_URL ?? 'https://khg-marketing.info/dashboard/api/gateway/';

/** 反響ごとの CSV の見出し → ② へ送る名前（Dashboard の suumo_action_kaeru の列。予約ID・反響ID は ② が1つの ID にまとめる） */
export const ACTION_HEADER_MAP: Record<string, string> = {
    '予約ID': 'reserve_id',
    '反響ID': 'inquiry_id',
    '受付日時': 'received_at',
    '反響種別': 'reaction_type',
    '氏名': 'name',
    '氏名カナ': 'name_kana',
    '住所': 'address',
    'メールアドレス': 'email',
    '電話': 'phone',
    'FAX': 'fax',
    'お客様担当': 'staff',
    '予約ステータス': 'reserve_status',
    '案内日時': 'guide_at',
    'その他のご希望日時': 'other_wish',
    '集合場所': 'meeting_place',
    '連絡事項': 'message',
    'キャンセル日時': 'canceled_at',
    'キャンセル経路': 'cancel_route',
    'キャンセル理由': 'cancel_reason',
    '物件種別': 'property_type',
    '物件コード': 'property_code',
    'プロジェクトコード': 'project_code',
    '物件名': 'property_name',
    '物件価格': 'property_price',
    '物件所在地': 'property_address',
    '掲載企画': 'listing_plan',
    '貴社物件コード': 'company_property_code',
    '取引態様': 'transaction_type',
    '元付会社': 'origin_company',
    '貴社ご担当': 'company_staff',
    '交通': 'traffic',
    '間取り': 'layout',
    '専有面積': 'exclusive_area',
    '建物面積': 'building_area',
    '土地面積': 'land_area',
};

/** 顧客ごとの CSV の見出し → ① へ送る名前（Dashboard の suumo_db_kaeru の列。⚠️ 以前は runSuumoKaeru.ts の中にあった） */
export const CUSTOMER_HEADER_MAP: Record<string, string> = {
    '顧客ID': 'customer_id',
    '登録日時': 'registered_at',
    '氏名': 'name',
    '氏名カナ': 'name_kana',
    'メールアドレス': 'email',
    '電話': 'phone',
    'FAX': 'fax',
    '住所': 'address',
    'お客様担当': 'staff',
    '追客状況': 'follow_status',
    '初回反響日': 'first_reaction_date',
    '初回反響方法': 'first_reaction_method',
    '初回反響媒体': 'first_reaction_media',
    'メモ': 'memo',
    '初回反響_予約ID': 'first_reaction_reserve_id',
    '初回反響_反響ID': 'first_reaction_id',
    '初回反響_受付日時': 'first_reaction_received_at',
    '初回反響_反響種別': 'first_reaction_type',
    '初回反響_物件種別': 'first_reaction_property_type',
    '初回反響_物件コード': 'first_reaction_property_code',
    '初回反響_物件名': 'first_reaction_property_name',
    '初回反響_物件価格': 'first_reaction_property_price',
    '初回反響_物件所在地': 'first_reaction_property_address',
    '最新反響_予約ID': 'latest_reaction_reserve_id',
    '最新反響_反響ID': 'latest_reaction_id',
    '最新反響_受付日時': 'latest_reaction_received_at',
    '最新反響_反響種別': 'latest_reaction_type',
    '最新反響_物件種別': 'latest_reaction_property_type',
    '最新反響_物件コード': 'latest_reaction_property_code',
    '最新反響_物件名': 'latest_reaction_property_name',
    '最新反響_物件価格': 'latest_reaction_property_price',
    '最新反響_物件所在地': 'latest_reaction_property_address',
    '初回来場_来場日時': 'first_visit_datetime',
    '初回来場_入力方法': 'first_visit_input_method',
    '初回来場_予定種別': 'first_visit_schedule_type',
    '初回来場_物件種別': 'first_visit_property_type',
    '初回来場_物件コード': 'first_visit_property_code',
    '初回来場_物件名': 'first_visit_property_name',
    '初回来場_物件価格': 'first_visit_property_price',
    '初回来場_物件所在地': 'first_visit_property_address',
    '最新来場_来場日時': 'latest_visit_datetime',
    '最新来場_入力方法': 'latest_visit_input_method',
    '最新来場_予定種別': 'latest_visit_schedule_type',
    '最新来場_物件種別': 'latest_visit_property_type',
    '最新来場_物件コード': 'latest_visit_property_code',
    '最新来場_物件名': 'latest_visit_property_name',
    '最新来場_物件価格': 'latest_visit_property_price',
    '最新来場_物件所在地': 'latest_visit_property_address',
    '成約_成約日': 'contract_date',
    '成約_成約価格': 'contract_price',
    '成約_仲介手数料ステータス': 'contract_fee_status',
    '成約_仲介手数料（万円）': 'contract_fee_amount',
    '成約_付帯工事額・紹介料収入ステータス': 'contract_additional_status',
    '成約_付帯工事額・紹介料収入（万円）': 'contract_additional_amount',
    '成約_物件種別': 'contract_property_type',
    '成約_物件コード': 'contract_property_code',
    '成約_物件名': 'contract_property_name',
    '成約_物件価格': 'contract_property_price',
    '成約_物件所在地': 'contract_property_address',
    '成約_ステータス': 'contract_status',
    '反響回数': 'reaction_count',
    '来場回数': 'visit_count',
    '成約フラグ': 'contract_flag'
};

/** 顧客の項目のうち、数として送るもの */
const CUSTOMER_NUMERIC = new Set(['reaction_count', 'visit_count', 'contract_flag']);

/** 絞り込みに使う日時の見出し（どれか1つでも範囲内なら送る） */
const ACTION_DATE_COLUMNS = ['受付日時', 'キャンセル日時'];
const CUSTOMER_DATE_COLUMNS = ['登録日時', '最新反響_受付日時', '追客状況の最終更新日時'];

/** CSV を読む（見出しの行をキーにした行の配列）。⚠️ 見出し・値の前後の空白は落とす */
export const readSuumoCsv = async (path: string): Promise<CsvRecord[]> => {
    const text = (await readFile(path)).toString('utf8');
    const rows = parse(text, { bom: true, columns: true, skip_empty_lines: true, relax_column_count: true, trim: true }) as Array<Record<string, unknown>>;
    return rows.map((row) => {
        const out: CsvRecord = {};
        for (const [key, value] of Object.entries(row)) {
            const k = String(key).trim().replace(/^"|"$/g, '');
            if (k) out[k] = value === undefined || value === null ? '' : String(value).trim();
        }
        return out;
    });
};

/**
 * 何日前までを送るか。SUUMO_KAERU_DAYS が `all` なら null（すべて）。数字でなければ 3。
 * ⚠️ 0 は「今日の分だけ」。
 */
export const recentDays = (raw: string | undefined = process.env.SUUMO_KAERU_DAYS): number | null => {
    const v = (raw ?? '').trim().toLowerCase();
    if (v === 'all') return null;
    const n = Number(v);
    return v !== '' && Number.isInteger(n) && n >= 0 ? n : DEFAULT_DAYS;
};

/**
 * 送る範囲の始まり（日本時間の `YYYY/MM/DD 00:00:00`）。days が null なら null（絞らない）。
 * ⚠️ CSV の日時は comparableDate で同じ形にそろえてから、文字の大小で比べる。
 */
export const recentCutoff = (days: number | null = recentDays(), now: Date = new Date()): string | null => {
    if (days === null) return null;
    const jst = new Date(now.getTime() + JST_MS - days * DAY_MS);
    return `${jst.toISOString().slice(0, 10).replace(/-/g, '/')} 00:00:00`;
};

/**
 * CSV の日時を、比べられる形（`YYYY/MM/DD HH:MM:SS`）にそろえる。日時でなければ null（空欄・「-」など）。
 * ⚠️ 顧客の「追客状況の最終更新日時」だけ `2026/9/7` のようにゼロ埋めが無く、時刻も無い（2026-11-11 の CSV）。
 *   ⚠️ そのまま文字で比べると `2026/9/7` > `2026/11/08` になってしまう。
 */
export const comparableDate = (v: string): string | null => {
    const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(v.trim());
    if (!m) return null;
    const p = (s: string | undefined): string => (s ?? '0').padStart(2, '0');
    return `${m[1]}/${p(m[2])}/${p(m[3])} ${p(m[4])}:${p(m[5])}:${p(m[6])}`;
};

const filterRecent = (rows: CsvRecord[], columns: string[], cutoff: string | null): CsvRecord[] => {
    if (cutoff === null) return rows;
    return rows.filter((row) => columns.some((c) => {
        const d = comparableDate(row[c] ?? '');
        return d !== null && d >= cutoff;
    }));
};

/** 反響ごとの CSV から、過去3日（既定）の行だけを残す */
export const filterRecentActions = (rows: CsvRecord[], cutoff: string | null = recentCutoff()): CsvRecord[] =>
    filterRecent(rows, ACTION_DATE_COLUMNS, cutoff);

/** 顧客ごとの CSV から、過去3日（既定）に動きのあった行だけを残す */
export const filterRecentCustomers = (rows: CsvRecord[], cutoff: string | null = recentCutoff()): CsvRecord[] =>
    filterRecent(rows, CUSTOMER_DATE_COLUMNS, cutoff);

/** 反響の1行を、② へ送る形にする（remarks は CSV の全項目。反響一覧の備考になる） */
export const mapAction = (row: CsvRecord): Record<string, string> => {
    const out: Record<string, string> = {};
    const remarks: string[] = [];
    for (const [key, value] of Object.entries(row)) {
        remarks.push(`${key}：${value}`);
        const mapped = ACTION_HEADER_MAP[key];
        if (mapped) out[mapped] = value;
    }
    out.remarks = remarks.join('\n');
    return out;
};

/** 顧客の1行を、① へ送る形にする（remarks は CSV の全項目。⚠️ 以前の runSuumoKaeru.ts の mapRecord と同じ） */
export const mapCustomer = (row: CsvRecord): Record<string, string | number> => {
    const out: Record<string, string | number> = {};
    const remarks: string[] = [];
    for (const [key, value] of Object.entries(row)) {
        remarks.push(`${key}：${value}`);
        const mapped = CUSTOMER_HEADER_MAP[key];
        if (!mapped) continue;
        if (CUSTOMER_NUMERIC.has(mapped)) {
            const n = Number(value.replace(/[,，\s]|万円|円/g, ''));
            out[mapped] = Number.isNaN(n) ? 0 : n;
        } else {
            out[mapped] = value;
        }
    }
    out.remarks = remarks.join('\n');
    return out;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const errorText = (err: unknown): string =>
    axios.isAxiosError(err) ? `${err.response?.status ?? ''} ${JSON.stringify(err.response?.data ?? err.message)}`.trim() : err instanceof Error ? err.message : String(err);

export type ActionImportTotals = {
    /** CSV の行数 */
    parsed: number;
    /** 過去3日（既定）に絞ったあとの行数 */
    recent: number;
    /** ② が返した数の合計（added＝反響一覧に足した数 など。Dashboard の features/suumoKaeru.ts） */
    result: Record<string, number>;
};

/**
 * 反響ごとの CSV（action_list_*.csv）を読み、過去3日（既定）の分を ② の suumo_kaeru:actions へ送る。
 *
 * ⚠️ 失敗の理由は errors に足す（呼び出し元が sendErrorMail で実行結果に残す）。例外は投げない。
 * ⚠️ 合い言葉は SYNC_LOG_SECRET（sync の実行結果と同じ）。未設定なら送らずに失敗として残す。
 */
export const importSuumoKaeruActions = async (csvPath: string, errors: string[]): Promise<ActionImportTotals> => {
    const totals: ActionImportTotals = { parsed: 0, recent: 0, result: {} };
    try {
        const all = await readSuumoCsv(csvPath);
        const cutoff = recentCutoff();
        const recent = filterRecentActions(all, cutoff);
        totals.parsed = all.length;
        totals.recent = recent.length;
        console.log(`[SUUMO 反響] CSV ${all.length}件 → 送る ${recent.length}件（${cutoff === null ? 'すべて' : `${cutoff} 以降`}）`);
        if (recent.length === 0) return totals;

        const key = process.env.SYNC_LOG_SECRET ?? '';
        if (key === '') {
            errors.push('SUUMO の反響を送れませんでした: SYNC_LOG_SECRET が未設定です');
            return totals;
        }
        const rows = recent.map(mapAction);
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const label = `${i + 1}〜${i + chunk.length}件目`;
            let lastError = '';
            let done = false;
            for (let attempt = 0; attempt <= RETRY_COUNT && !done; attempt++) {
                try {
                    const res = await axios.post(ACTIONS_URL, { request: 'suumo_kaeru', roll: 'actions', key, rows: chunk }, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 120000,
                    });
                    if (res.data?.status !== 'success') throw new Error(JSON.stringify(res.data));
                    for (const [name, value] of Object.entries(res.data as Record<string, unknown>)) {
                        if (typeof value === 'number') totals.result[name] = (totals.result[name] ?? 0) + value;
                    }
                    done = true;
                } catch (err) {
                    lastError = errorText(err);
                    // ⚠️ 合い言葉の違い（401）・形の違い（400）は、送り直しても同じなのでやめる
                    if (axios.isAxiosError(err) && err.response && err.response.status < 500) break;
                    if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
                }
            }
            if (!done) errors.push(`SUUMO の反響（${label}）を送れませんでした: ${lastError}`);
        }
        console.log(`[SUUMO 反響] 結果 ${JSON.stringify(totals.result)}`);
    } catch (err) {
        errors.push(`SUUMO の反響の CSV を読めませんでした: ${errorText(err)}`);
    }
    return totals;
};

/**
 * 顧客ごとの CSV（customer_list_*.csv）を読み、過去3日（既定）に動きのあった分を ① の suumo_db_kaeru へ送る。
 *
 * ⚠️ 失敗の理由は errors に足す（以前は送れなかった塊がコンソールとファイルにしか残らず、「成功」に隠れていた）。例外は投げない。
 * ⚠️ ① の応答は { ok, inserted, errors }。ok が false のときも失敗として残す。
 */
export const importSuumoKaeruCustomers = async (csvPath: string, errors: string[]): Promise<{ parsed: number; recent: number; sent: number }> => {
    const totals = { parsed: 0, recent: 0, sent: 0 };
    try {
        const all = await readSuumoCsv(csvPath);
        const cutoff = recentCutoff();
        const recent = filterRecentCustomers(all, cutoff);
        totals.parsed = all.length;
        totals.recent = recent.length;
        console.log(`[SUUMO 顧客] CSV ${all.length}件 → 送る ${recent.length}件（${cutoff === null ? 'すべて' : `${cutoff} 以降`}）`);
        const rows = recent.map(mapCustomer);
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const label = `${i + 1}〜${i + chunk.length}件目`;
            let lastError = '';
            let done = false;
            for (let attempt = 0; attempt <= RETRY_COUNT && !done; attempt++) {
                try {
                    const res = await axios.post(CUSTOMERS_URL, { request: 'suumo_db_kaeru', data: chunk }, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 60000,
                    });
                    if (res.data?.ok !== true) throw new Error(JSON.stringify(res.data));
                    totals.sent += chunk.length;
                    done = true;
                } catch (err) {
                    lastError = errorText(err);
                    if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
                }
            }
            if (!done) errors.push(`SUUMO の顧客（${label}）を送れませんでした: ${lastError}`);
        }
        console.log(`[SUUMO 顧客] 送った ${totals.sent}件`);
    } catch (err) {
        errors.push(`SUUMO の顧客の CSV を読めませんでした: ${errorText(err)}`);
    }
    return totals;
};
```

## 変更後の全文（sync）：src/services/runSuumoKaeru.ts
```ts
import { chromium } from 'playwright';
import { closeBrowser } from "../utils/portalPage";
import { sendErrorMail } from "./sendErrorMail";
import { importSuumoKaeruActions, importSuumoKaeruCustomers } from "../utils/suumoKaeruCsv";

export const runSuumoKaeru = async (suumo_kaeru_id: string, suumo_kaeru_pass: string) => {
    // 実行ごとに初期化する。モジュールスコープだと前回のエラーが次回に持ち越される。
    const errors: string[] = [];
    const browser = await chromium.launch({ args: ["--no-sandbox"], headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const login = async () => {
        try {
            await page.goto('https://kr-hometour.suumo.jp/login');
            await page.waitForLoadState("networkidle");
            await page.fill('xpath=/html/body/div/div/div/div/main/div/form/div[1]/div/div/input', suumo_kaeru_id);
            await page.fill('xpath=/html/body/div/div/div/div/main/div/form/div[2]/div/div/input', suumo_kaeru_pass);
            await page.click('xpath=/html/body/div/div/div/div/main/div/form/div[3]/button');
        } catch (err) {
            const msg = `ログイン処理に失敗${err}`;
            console.log(msg);
            errors.push(msg);
        }
    };

    /**
     * 一覧の画面を開き、「検索結果をダウンロード」→ 確認のボタンで CSV を保存する（顧客ごと・反響ごとで同じ手順）。
     * ⚠️ 失敗したら例外を投げる（呼び出し元が理由を残す）。
     */
    const downloadCsv = async (listUrl: string, savePath: string, label: string): Promise<void> => {
        await page.goto(listUrl);
        await page.waitForLoadState("networkidle");

        // ★ 対策1: SUUMOのようなSPAは、ネットワーク通信が終わってから
        // HTML(ボタン)が描画されるまでにタイムラグがあるため、ここで必ず数秒待ちます。
        await page.waitForTimeout(5000);

        // ★ 対策2: ボタンが「確実に見える状態」になるまで待ってからクリックする
        // exact: false を入れることで、前後のスペース等による不一致を防ぎます
        const downloadBtn = page.getByText('検索結果をダウンロード', { exact: false }).first();
        await downloadBtn.waitFor({ state: 'visible', timeout: 30000 });
        await downloadBtn.click();
        console.log(`[${label}]「検索結果をダウンロード」をクリックしました。`);

        await page.waitForTimeout(2000);

        // ★ 対策5: XPathは画面構造が1ミリでも変わると壊れるため、要素の出現をしっかり待機する
        const confirmBtn = page.locator('xpath=/html/body/div[2]/div[2]/div[2]/div/div/div[2]/button[2]');
        await confirmBtn.waitFor({ state: 'visible', timeout: 30000 });
        console.log(`[${label}] ダウンロード確認ボタンをクリックします...`);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 120000 }),
            confirmBtn.click()
        ]);
        await download.saveAs(savePath);
        console.log(`[${label}] ダウンロードしました: ${download.suggestedFilename()}`);
    };

    /** 顧客ごとの CSV → ① の suumo_db_kaeru（⚠️ 反響一覧には足さない。Dashboard v2.2.263 から反響ごとの CSV が足す） */
    const importCustomers = async () => {
        try {
            const savePath = '/tmp/customer.csv';
            await downloadCsv('https://kr-hometour.suumo.jp/customers', savePath, 'SUUMO 顧客');
            await importSuumoKaeruCustomers(savePath, errors);
        } catch (err) {
            const msg = `顧客ごとの CSV のダウンロードに失敗: ${err}`;
            console.error(msg);
            errors.push(msg);
        }
    };

    /**
     * 反響ごとの CSV → ② の suumo_kaeru:actions（反響一覧に1反響1行。2026-11-11・Dashboard v2.2.263）
     * ⚠️ 顧客のあとに動かす（② が反響を顧客に結ぶのに、顧客の表を使う）。顧客の取り込みが失敗していても動かす。
     */
    const importActions = async () => {
        try {
            const savePath = '/tmp/action.csv';
            await downloadCsv('https://kr-hometour.suumo.jp/actions', savePath, 'SUUMO 反響');
            await importSuumoKaeruActions(savePath, errors);
        } catch (err) {
            const msg = `反響ごとの CSV のダウンロードに失敗: ${err}`;
            console.error(msg);
            errors.push(msg);
        }
    };

    try {
        await login();
        await importCustomers();
        await importActions();
    } catch (err) {
        const msg = `処理全体が中断しました: ${err}`;
        console.error(msg);
        errors.push(msg);
    } finally {
        // 例外が起きても Chromium を必ず終了させる。
        // 閉じ残るとメモリを圧迫し、後続タスクや次回以降の実行まで巻き込んで失敗する。
        await closeBrowser(browser);
        await sendErrorMail(errors, 'runSuumoKaeru.ts');
    }
};
```

## git diff（sync：src/services/runSuumoKaeru.ts）
```diff
diff --git a/src/services/runSuumoKaeru.ts b/src/services/runSuumoKaeru.ts
index f28990f..9e33680 100644
--- a/src/services/runSuumoKaeru.ts
+++ b/src/services/runSuumoKaeru.ts
@@ -1,9 +1,7 @@
 import { chromium } from 'playwright';
-import { readFile, writeFile } from 'fs/promises';
-import { parse } from 'csv-parse/sync';
-import axios from 'axios';
 import { closeBrowser } from "../utils/portalPage";
 import { sendErrorMail } from "./sendErrorMail";
+import { importSuumoKaeruActions, importSuumoKaeruCustomers } from "../utils/suumoKaeruCsv";
 
 export const runSuumoKaeru = async (suumo_kaeru_id: string, suumo_kaeru_pass: string) => {
     // 実行ごとに初期化する。モジュールスコープだと前回のエラーが次回に持ち越される。
@@ -12,106 +10,6 @@ export const runSuumoKaeru = async (suumo_kaeru_id: string, suumo_kaeru_pass: st
     const context = await browser.newContext();
     const page = await context.newPage();
 
-    const headerMap: Record<string, string> = {
-        "顧客ID": "customer_id",
-        "登録日時": "registered_at",
-        "氏名": "name",
-        "氏名カナ": "name_kana",
-        "メールアドレス": "email",
-        "電話": "phone",
-        "FAX": "fax",
-        "住所": "address",
-        "お客様担当": "staff",
-        "追客状況": "follow_status",
-        "初回反響日": "first_reaction_date",
-        "初回反響方法": "first_reaction_method",
-        "初回反響媒体": "first_reaction_media",
-        "メモ": "memo",
-        "初回反響_予約ID": "first_reaction_reserve_id",
-        "初回反響_反響ID": "first_reaction_id",
-        "初回反響_受付日時": "first_reaction_received_at",
-        "初回反響_反響種別": "first_reaction_type",
-        "初回反響_物件種別": "first_reaction_property_type",
-        "初回反響_物件コード": "first_reaction_property_code",
-        "初回反響_物件名": "first_reaction_property_name",
-        "初回反響_物件価格": "first_reaction_property_price",
-        "初回反響_物件所在地": "first_reaction_property_address",
-        "最新反響_予約ID": "latest_reaction_reserve_id",
-        "最新反響_反響ID": "latest_reaction_id",
-        "最新反響_受付日時": "latest_reaction_received_at",
-        "最新反響_反響種別": "latest_reaction_type",
-        "最新反響_物件種別": "latest_reaction_property_type",
-        "最新反響_物件コード": "latest_reaction_property_code",
-        "最新反響_物件名": "latest_reaction_property_name",
-        "最新反響_物件価格": "latest_reaction_property_price",
-        "最新反響_物件所在地": "latest_reaction_property_address",
-        "初回来場_来場日時": "first_visit_datetime",
-        "初回来場_入力方法": "first_visit_input_method",
-        "初回来場_予定種別": "first_visit_schedule_type",
-        "初回来場_物件種別": "first_visit_property_type",
-        "初回来場_物件コード": "first_visit_property_code",
-        "初回来場_物件名": "first_visit_property_name",
-        "初回来場_物件価格": "first_visit_property_price",
-        "初回来場_物件所在地": "first_visit_property_address",
-        "最新来場_来場日時": "latest_visit_datetime",
-        "最新来場_入力方法": "latest_visit_input_method",
-        "最新来場_予定種別": "latest_visit_schedule_type",
-        "最新来場_物件種別": "latest_visit_property_type",
-        "最新来場_物件コード": "latest_visit_property_code",
-        "最新来場_物件名": "latest_visit_property_name",
-        "最新来場_物件価格": "latest_visit_property_price",
-        "最新来場_物件所在地": "latest_visit_property_address",
-        "成約_成約日": "contract_date",
-        "成約_成約価格": "contract_price",
-        "成約_仲介手数料ステータス": "contract_fee_status",
-        "成約_仲介手数料（万円）": "contract_fee_amount",
-        "成約_付帯工事額・紹介料収入ステータス": "contract_additional_status",
-        "成約_付帯工事額・紹介料収入（万円）": "contract_additional_amount",
-        "成約_物件種別": "contract_property_type",
-        "成約_物件コード": "contract_property_code",
-        "成約_物件名": "contract_property_name",
-        "成約_物件価格": "contract_property_price",
-        "成約_物件所在地": "contract_property_address",
-        "成約_ステータス": "contract_status",
-        "反響回数": "reaction_count",
-        "来場回数": "visit_count",
-        "成約フラグ": "contract_flag"
-    };
-
-    const numericFields = new Set(['reaction_count', 'visit_count', 'contract_flag']);
-
-    function decodeBuffer(buf: Buffer): string {
-        return buf.toString("utf8");
-    }
-
-    // remarksのvalueをつくる関数
-    function mapRecord(jpRecord: Record<string, unknown>): Record<string, unknown> {
-        const obj: Record<string, unknown> = {};
-        const record = jpRecord as Record<string, unknown>;
-
-        const remarksList: string[] = [];
-
-        for (const [jpKeyRaw, valRaw] of Object.entries(record)) {
-            const jpKey = String(jpKeyRaw).trim().replace(/^"|"$/g, '');
-            const cell = valRaw === undefined || valRaw === null ? "" : String(valRaw).trim();
-            if (jpKey) {
-                remarksList.push(`${jpKey}：${cell}`);
-            }
-            const mapped = headerMap[jpKey];
-            if (!mapped) continue;
-
-            if (numericFields.has(mapped)) {
-                const normalized = cell.replace(/[,，\s]|万円|円/g, '');
-                const n = normalized === "" ? 0 : Number(normalized);
-                obj[mapped] = Number.isNaN(n) ? 0 : n;
-            } else {
-                obj[mapped] = cell;
-            }
-        }
-        obj['remarks'] = remarksList.join('\n');
-        return obj;
-    }
-
     const login = async () => {
         try {
             await page.goto('https://kr-hometour.suumo.jp/login');
@@ -126,124 +24,64 @@ export const runSuumoKaeru = async (suumo_kaeru_id: string, suumo_kaeru_pass: st
         }
     };
 
-    const customerSearch = async () => {
-        try {
-            await page.goto('https://kr-hometour.suumo.jp/customers');
-            await page.waitForLoadState("networkidle");
-
-            // ★ 対策1: SUUMOのようなSPAは、ネットワーク通信が終わってから
-            // HTML(ボタン)が描画されるまでにタイムラグがあるため、ここで必ず数秒待ちます。
-            await page.waitForTimeout(5000);
-
-            // ★ 対策2: ボタンが「確実に見える状態」になるまで待ってからクリックする
-            // exact: false を入れることで、前後のスペース等による不一致を防ぎます
-            const downloadBtn = page.getByText('検索結果をダウンロード', { exact: false }).first();
-            await downloadBtn.waitFor({ state: 'visible', timeout: 30000 });
-            await downloadBtn.click();
-
-            console.log("「検索結果をダウンロード」をクリックしました。");
+    /**
+     * 一覧の画面を開き、「検索結果をダウンロード」→ 確認のボタンで CSV を保存する（顧客ごと・反響ごとで同じ手順）。
+     * ⚠️ 失敗したら例外を投げる（呼び出し元が理由を残す）。
+     */
+    const downloadCsv = async (listUrl: string, savePath: string, label: string): Promise<void> => {
+        await page.goto(listUrl);
+        await page.waitForLoadState("networkidle");
+
+        // ★ 対策1: SUUMOのようなSPAは、ネットワーク通信が終わってから
+        // HTML(ボタン)が描画されるまでにタイムラグがあるため、ここで必ず数秒待ちます。
+        await page.waitForTimeout(5000);
+
+        // ★ 対策2: ボタンが「確実に見える状態」になるまで待ってからクリックする
+        // exact: false を入れることで、前後のスペース等による不一致を防ぎます
+        const downloadBtn = page.getByText('検索結果をダウンロード', { exact: false }).first();
+        await downloadBtn.waitFor({ state: 'visible', timeout: 30000 });
+        await downloadBtn.click();
+        console.log(`[${label}]「検索結果をダウンロード」をクリックしました。`);
+
+        await page.waitForTimeout(2000);
+
+        // ★ 対策5: XPathは画面構造が1ミリでも変わると壊れるため、要素の出現をしっかり待機する
+        const confirmBtn = page.locator('xpath=/html/body/div[2]/div[2]/div[2]/div/div/div[2]/button[2]');
+        await confirmBtn.waitFor({ state: 'visible', timeout: 30000 });
+        console.log(`[${label}] ダウンロード確認ボタンをクリックします...`);
+
+        const [download] = await Promise.all([
+            page.waitForEvent('download', { timeout: 120000 }),
+            confirmBtn.click()
+        ]);
+        await download.saveAs(savePath);
+        console.log(`[${label}] ダウンロードしました: ${download.suggestedFilename()}`);
+    };
 
+    /** 顧客ごとの CSV → ① の suumo_db_kaeru（⚠️ 反響一覧には足さない。Dashboard v2.2.263 から反響ごとの CSV が足す） */
+    const importCustomers = async () => {
+        try {
+            const savePath = '/tmp/customer.csv';
+            await downloadCsv('https://kr-hometour.suumo.jp/customers', savePath, 'SUUMO 顧客');
+            await importSuumoKaeruCustomers(savePath, errors);
         } catch (err) {
-            const msg = `お客様ページへの遷移に失敗: ${err}`;
-            console.log(msg);
+            const msg = `顧客ごとの CSV のダウンロードに失敗: ${err}`;
+            console.error(msg);
             errors.push(msg);
-            throw err; // ★ 対策3: ここで失敗したら、次の customerSave を実行させないために throw する
         }
     };
 
-    const customerSave = async () => {
+    /**
+     * 反響ごとの CSV → ② の suumo_kaeru:actions（反響一覧に1反響1行。2026-11-11・Dashboard v2.2.263）
+     * ⚠️ 顧客のあとに動かす（② が反響を顧客に結ぶのに、顧客の表を使う）。顧客の取り込みが失敗していても動かす。
+     */
+    const importActions = async () => {
         try {
-            await page.waitForTimeout(2000);
-
-            // ★ 対策5: XPathは画面構造が1ミリでも変わると壊れるため、要素の出現をしっかり待機する
-            const confirmBtn = page.locator('xpath=/html/body/div[2]/div[2]/div[2]/div/div/div[2]/button[2]');
-            await confirmBtn.waitFor({ state: 'visible', timeout: 30000 });
-
-            console.log("ダウンロード確認ボタンをクリックします...");
-
-            const [download] = await Promise.all([
-                page.waitForEvent('download', { timeout: 120000 }),
-                confirmBtn.click()
-            ]);
-
-            console.log("ダウンロードが正常に開始されました。");
-
-            const savePath = '/tmp/customer.csv';
-            const summaryPath = '/tmp/import_result_summary.json';
-            await download.saveAs(savePath);
-
-            const POST_URL = 'https://khg-marketing.info/dashboard/api/gateway/';
-            const RETRY_COUNT = 2;
-            const RETRY_DELAY_MS = 1000;
-            const CHUNK_SIZE = 500; // 500件ずつに分割して送信
-
-            const buf: Buffer = await readFile(savePath);
-            const text: string = decodeBuffer(buf);
-
-            const jpRecords = parse(text, {
-                bom: true,
-                columns: true,
-                skip_empty_lines: true,
-                relax_column_count: true,
-                trim: true
-            }) as unknown as Array<Record<string, unknown>>;
-
-            console.log('parsed rows:', jpRecords.length);
-
-            // 1. カラム名をマッピングして正規化（ここで remarks も追加される）
-            const mapped = jpRecords.map(mapRecord);
-
-            // 2. バルク配信用に関数を修正
-            async function postChunkWithRetry(url: string, chunk: any[], retries = 2, delayMs = 1000) {
-                const payload = {
-                    request: 'suumo_db_kaeru',
-                    data: chunk
-                };
-
-                let lastErr: any = null;
-                for (let attempt = 0; attempt <= retries; attempt++) {
-                    try {
-                        const res = await axios.post(url, payload, {
-                            headers: { 'Content-Type': 'application/json' },
-                            timeout: 60000
-                        });
-                        return res.data ?? {};
-                    } catch (err) {
-                        lastErr = err;
-                        if (attempt < retries) await new Promise(r => setTimeout(r, delayMs));
-                    }
-                }
-                throw lastErr;
-            }
-
-            const successes: any[] = [];
-            const failures: any[] = [];
-
-            // 3. データを500件ずつのチャンク（塊）に分割して順次送信
-            console.log(`Starting bulk upload in chunks of ${CHUNK_SIZE}...`);
-
-            for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
-                const chunk = mapped.slice(i, i + CHUNK_SIZE);
-                const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
-
-                try {
-                    console.log(`Posting chunk ${chunkNumber} (${chunk.length} records)...`);
-                    const res = await postChunkWithRetry(POST_URL, chunk, RETRY_COUNT, RETRY_DELAY_MS);
-                    successes.push({ chunkIndex: chunkNumber, response: res });
-                } catch (err) {
-                    const errMsg = err && (err as any).message ? (err as any).message : String(err);
-                    console.error(`Failed chunk ${chunkNumber}:`, errMsg);
-                    failures.push({ chunkIndex: chunkNumber, error: errMsg, sampleRecord: chunk[0] });
-                }
-            }
-
-            console.log('done. success chunks:', successes.length, 'failed chunks:', failures.length);
-
-            await writeFile(summaryPath, JSON.stringify({ success: successes, errors: failures }, null, 2), 'utf8');
-            console.log('summary saved to', summaryPath);
-
+            const savePath = '/tmp/action.csv';
+            await downloadCsv('https://kr-hometour.suumo.jp/actions', savePath, 'SUUMO 反響');
+            await importSuumoKaeruActions(savePath, errors);
         } catch (err) {
-            const msg = `ダウンロード/インポート処理に失敗: ${err}`;
+            const msg = `反響ごとの CSV のダウンロードに失敗: ${err}`;
             console.error(msg);
             errors.push(msg);
         }
@@ -251,8 +89,8 @@ export const runSuumoKaeru = async (suumo_kaeru_id: string, suumo_kaeru_pass: st
 
     try {
         await login();
-        await customerSearch();
-        await customerSave();
+        await importCustomers();
+        await importActions();
     } catch (err) {
         const msg = `処理全体が中断しました: ${err}`;
         console.error(msg);
```
