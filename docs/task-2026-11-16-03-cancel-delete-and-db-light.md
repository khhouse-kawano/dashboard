# 作業記録 2026-11-16 v2.2.271

## 依頼
1. ReadMeClaude.md：「新たブランチで作業開始」「DatabaseOrder.tsx の cancelLength の数え方を修正。master_data の delete_dashboard が 1 の顧客は含まないようにする（顧客情報削除依頼のあった顧客のため）」
   - 範囲は利用者の選択で「キャンセル関係すべて」。
2. 途中の追加依頼：「DatabaseOrder.tsx・DatabaseKaeru.tsx も重くなっているので DatabaseResale.tsx 同様に返すファイルを軽くしてレンダリング速度を速めたい。テスト＆評価もこのブランチで」
   - 範囲は利用者の選択で「画面＋返すデータ両方（① PHP は予備として旧形のまま）」。
3. （別のエージェントに依頼）新春キャンペーン分析 HTML へ広告展開の提案を追加。リポジトリの外の作業なので、この記録には含めない。

## ブランチ・版
- ブランチ `v2.2.271`（v2.2.270 から）
- `frontend/src/utils/version.ts` → `2.2.271`
- `backend/scripts/sql/2026-11-16_update_log_2.2.271.sql`（update_log 1行＋業務ガイド2本）。ローカル投入済み（no=370）

## 1. キャンセル集計から削除依頼の顧客を除く
調べてわかったこと：DatabaseOrder の「要回答○件」は画面が受け取る顧客一覧から数えており、その一覧は ①（database_order.php）②（database/queries.ts）とも既に `delete_dashboard = 1` を除いている。除いていなかったのは次のとおり。

| ディレクトリ | ファイル | 変更 |
|---|---|---|
| backend/src/handlers | cancelList.php | 来場キャンセルリストの一覧の SQL に `AND COALESCE(delete_dashboard, 0) = 0` |
| backend/src/handlers | cancelList_edit_reason.php | 理由を登録した後に返す一覧に同じ条件 |
| backend/src/handlers | menu.php | `$sql_cancel`（メニューのキャンセル件数）に同じ条件 |
| backend-express/src/features | menu.ts | `CANCEL_SQL` に同じ条件 |
| backend/src/handlers | daily_action.php | `$sql_cancel`（毎日の確認「来場日未入力」）に `m.delete_dashboard` の条件（menu と同じ母集団のため） |
| backend-express/src/features | dailyAction.ts | `CANCEL_SQL` に同じ条件 |
| frontend/src/components/database | DatabaseOrder.tsx | 件数のループで `isDelete(item)` を除く（念のため。データは既に除外済み） |

## 2. 顧客DB（注文・建売）を軽くする
| ディレクトリ | ファイル | 追加・変更した関数など |
|---|---|---|
| backend-express/src/features/database | queries.ts | 注文から `rank_period`・`competitors_text`・`competitor_price_gap`・`competitor_countermeasure`、建売から `rank_period`・`property_name`・`property_tour_name`・`introduction_person_category` を外した。建売の家族は `SELECT id`。`countWord()` を追加し、HOTLEAD_SQL は行動履歴の全文ではなく `has_action`・`action_calls`・`action_mails`・`action_sms` を返す |
| backend-express/src/features/database | index.ts | `toColumnar()`（列名1回＋値の並び）・`familyNamesOnly()`（注文の家族を名前だけに）を追加。`runDatabase` の customer・family に使う |
| frontend/src/components/database | databaseUtils.ts | `decodeRows()`（②の形・①の配列のどちらも行の配列にする）・`hotleadActions()`（件数でも全文でも数える）・型 `HotleadActions` を追加 |
| frontend/src/components/database | DatabaseOrder.tsx | `prepareCustomers()`・型 `HotleadInfo`・`EMPTY_HOTLEAD` を追加。`familyIdSet`・`familyNames`・`hotleadMap` を useMemo で1回だけ作る。絞り込みの `find`／`includes` の総当たりと、全行への JSX 付与をやめ、`hotlead()` が表に出す行だけ引く。非表示・元に戻すの後も `prepareCustomers` を通す（以前は通しておらず、その後の名前・住所検索が効かなかった） |
| frontend/src/components/database | DatabaseKaeru.tsx | `kanaKey()`・`prepareCustomers()`（`_kana` を読み込み時に作る）を追加。`familyIdSet` を追加。名寄せ（IntegrateModal）の後で `_kana` が無い行はその場で作る |

## 業務ガイド
- 「顧客DB」（order/screen-020.md）：上のボタンの下に「個人情報を削除したお客様は、キャンセル集計の件数・来場キャンセルリスト・メニューのキャンセルの件数・毎日の確認の来場日未入力には入らない」注意を追加。個人情報削除の節に「キャンセル集計・来場キャンセルリスト・来場日未入力にも出なくなる」を追加。
- 「毎日の確認（要確認）」（order/flow-060.md）：来場日未入力に「（個人情報を削除したお客様は出ません）」を追加。

## テスト（ローカル・① 経由・仮スタッフ 999999。終了後に削除済み）
### キャンセル集計
- キャンセル待ちの顧客を1人だけ一時的に delete_dashboard=1 にして比較（終了後に 0 に戻した）。
  - ② 経由：メニュー 40→39、来場キャンセルリスト 26,590→26,589（対象が消える）、画面の要回答 40→39、毎日の確認の来場日未入力 38→37。
  - ② を止めて ① の PHP が答える経路：メニュー 40→39、来場日未入力 38→37。
- PHP 4ファイルの構文確認 OK。型チェック（frontend・backend-express）エラー 0。

### 顧客DB の軽量化（中身の一致）
- 直す前の応答を保存して、新しい応答（① 経由）と比べた：19項目すべて一致。
  - 顧客の件数・外した列以外の全行の値（注文 27,167行・建売 11,714行）・staff/shop/medium/introductory/event・家族の名前（3,701件）・Hotlead の状態と件数（2,820件）。
- 応答の大きさ：注文 28.45MB → 9.79MB（gzip 後 3.6MB → 2.6MB）、建売 9.71MB → 3.59MB（gzip 後 1.4MB → 0.98MB）。
  - 注文の内訳：顧客 23.7MB → 8.7MB、家族 1.8MB → 0.4MB、Hotlead 2.8MB → 0.6MB。
  - 建売の内訳：顧客 7.5MB → 3.3MB、家族 2.0MB → 0.13MB。

### 画面の速さ（Playwright・3100 の開発サーバー・各2回）
| | 直す前 | 直した後 |
|---|---|---|
| 注文：顧客名「田」 | 0.68〜0.97秒 | 0.59〜0.67秒 |
| 注文：顧客名を消す | 1.69〜2.51秒 | 0.63〜0.79秒 |
| 注文：家族名を消す | 1.65〜2.46秒 | 0.61〜0.81秒 |
| 注文：Hotlead の切り替え | 1.08〜2.21秒 | 0.17〜0.62秒 |
| 建売：顧客名・ふりがな | 0.50〜0.55秒 | 0.40〜0.46秒 |
| 注文：表が出るまで | 28〜37秒 | 28〜30秒 |
| 建売：表が出るまで | 28秒 | 20〜29秒 |
- 時間には入力の待ち（0.3秒）を含む。件数は直す前と全項目で同じ（注文 26,590／4,134／347／1,850、建売 8,881／1,321／1,965）。画面のエラー 0。
- 直した後の測定は、Playwright の入っていたフォルダ（projects/sync）が無くなっていたため、別のフォルダ（projects/portal）の Playwright を使った。
- 表が出るまでの時間が縮まない理由を調べた：
  - JSON を読む時間は新旧ほぼ同じ（注文 0.33秒・建売 0.12秒）。
  - ② の中では、ギフト判定（面談記録の全件読み）が注文 7.9秒・建売 6.1秒で大半。顧客一覧の SQL は 0.8秒。
  - 測定と同時に別のエージェントが DB を読んでいたため、時間はふだんより遅めの可能性がある。
- ① の形（従来の配列）でも画面が動くか：
  - 建売は ② を止めて ① の PHP から読ませ、8,881件・検索結果とも同じ。
  - 注文は ① の PHP が今回と関係なくメモリ不足で落ちる（下記）ため、保存した直す前の応答をブラウザに差し込んで確認。26,590件・検索 4,134件・Hotlead の件数の印の行数が同じで、画面も同じ。
- トークン無しで ① に送ると、database（order・spec）・daily_action は 401（② まで届いている）。

## 見つかったこと（今回は直していない）
- ⚠️ ① の `database_order.php` は、② が落ちたときの予備として**もともと動いていない**（ローカルで PHP のメモリ 128MB を超えて落ちる）。
- ⚠️ ① の `cancelList`（PHP のみ）と `menu` は、トークン無し（画面に書かれた固定のヘッダーだけ）で応答する。
  - cancelList は全顧客の氏名・電話・メール等（約14MB）を返す。PHP の handlers 全般に、スタッフのトークンを確かめるしくみが無い。
  - PHP→② 移行計画（docs/plan-2026-10-21-php-to-express.md）の範囲。早めの対応を勧める。
- 読み込みの時間の大半は ② のギフト判定。判定結果の一時保存（数分）などで短くできる見込み。

## 変更したコード（差分）
（以下は `git diff` の出力をそのまま載せる）

```diff
diff --git a/backend-express/src/features/dailyAction.ts b/backend-express/src/features/dailyAction.ts
index 22e0c33e1..e84ca3e3d 100644
--- a/backend-express/src/features/dailyAction.ts
+++ b/backend-express/src/features/dailyAction.ts
@@ -306,6 +306,7 @@ const CANCEL_SQL = `
     FROM master_data m
     LEFT JOIN ${VISIBLE_SHOPS} s ON s.shop = TRIM(m.in_charge_store)
    WHERE m.show_dashboard = 1
+     AND COALESCE(m.delete_dashboard, 0) = 0 /* v2.2.271: 個人情報の削除依頼があった顧客は出さない（menu.ts と同じ） */
      AND COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
      AND COALESCE(m.cancel_status, '') = ''
      AND COALESCE(m.status, '') <> '重複'
diff --git a/backend-express/src/features/database/index.ts b/backend-express/src/features/database/index.ts
index 592ee3781..f92a41731 100644
--- a/backend-express/src/features/database/index.ts
+++ b/backend-express/src/features/database/index.ts
@@ -29,6 +29,37 @@ export interface DatabaseResult {
   body: unknown;
 }
 
+/**
+ * 行の配列を「列名1回＋値の並び」にする（v2.2.271）。
+ * ⚠️ 注文では 21MB のうち 14.6MB が列名の繰り返しだった。画面は databaseUtils.ts の decodeRows で元の形に戻す。
+ * ⚠️ 列は全行の列名を合わせたもの（SQL の行は同じ列だが、gift のように後から足す列があっても落とさない）。
+ */
+export const toColumnar = (rows: Record<string, unknown>[]): { cols: string[]; rows: unknown[][] } => {
+  const set = new Set<string>();
+  for (const r of rows) for (const k of Object.keys(r)) set.add(k);
+  const cols = [...set];
+  return { cols, rows: rows.map((r) => cols.map((c) => r[c])) };
+};
+
+/**
+ * 注文の家族情報を、画面の家族名検索に使う「名前」だけにする（v2.2.271。1.8MB → 数百KB）。
+ * ⚠️ 形は今までと同じ `{ id, family_info: JSON 文字列 }`（画面は safeParse して .name を見る）。
+ * ⚠️ 読めない値は '[]'（画面の safeParse も読めなければ [] にしていた）。
+ */
+export const familyNamesOnly = (rows: Record<string, unknown>[]): Record<string, unknown>[] =>
+  rows.map((r) => {
+    let names: { name: unknown }[] = [];
+    try {
+      const parsed: unknown = typeof r.family_info === 'string' ? JSON.parse(r.family_info) : [];
+      if (Array.isArray(parsed)) {
+        names = parsed.map((p) => ({ name: (p as { name?: unknown } | null)?.name }));
+      }
+    } catch {
+      names = [];
+    }
+    return { id: r.id, family_info: JSON.stringify(names) };
+  });
+
 export const runDatabase = async (category: DatabaseCategory): Promise<DatabaseResult> => {
   const sql = databaseSql(category);
 
@@ -59,8 +90,9 @@ export const runDatabase = async (category: DatabaseCategory): Promise<DatabaseR
     staff,
     shop,
     medium,
-    customer,
-    family,
+    // ⚠️ v2.2.271: ② だけ「列名1回＋値の並び」。① の PHP は従来の配列のまま（画面はどちらでも読む）
+    customer: toColumnar(customer as unknown as Record<string, unknown>[]),
+    family: category === 'order' ? familyNamesOnly(family as unknown as Record<string, unknown>[]) : family,
   };
 
   if (category === 'order') {
diff --git a/backend-express/src/features/database/queries.ts b/backend-express/src/features/database/queries.ts
index 761a5007a..5b21b5d0d 100644
--- a/backend-express/src/features/database/queries.ts
+++ b/backend-express/src/features/database/queries.ts
@@ -85,7 +85,6 @@ const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
   ) AS register,
   COALESCE(sales_promotion_name, '') AS medium,
   COALESCE(status, '') AS status,
-  COALESCE(rank_period, '') AS rank_period,
   COALESCE(call_status, '') AS call_status,
   COALESCE(cancel_status, '') AS cancel_status,
   COALESCE(show_dashboard, 0) AS trash,
@@ -103,20 +102,17 @@ const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
   COALESCE(customer_contacts_email, '') AS mail,
   COALESCE(introduction_person_category, '') AS introduction_person_category,
   COALESCE(competitor_lost_contract_reason, '') AS competitor_lost_contract_reason,
-  COALESCE(competitors_text, '') AS competitors_text,
   COALESCE(competitor_name, '') AS competitor_name,
   COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') AS event,
   COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') AS customized_input_01JRF9CZSW65A151WR30NA4PB3,
   COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH,
   /*
-    ⚠️⚠️ **2026-09-17 に足した2列。** DatabaseOrder.tsx の「要回答」件数で使う。
-      ⚠️ 返さないと画面側で undefined になり、⚠️ **失注が全件「要回答」になる。**
-      ⚠️ ⚠️ **order にだけ足すこと。** 建売・中古のテーブルにはこの列が無い。
-      ⚠️ ① の database_order.php にも同じ2行を足してある。
-      ⚠️⚠️ **ここはSQLの中なのでバッククォートを書かないこと**（文字列が終わる）。
+    ⚠️ v2.2.271 で外した列（画面で使っていない。転送量を減らすため）:
+      rank_period・competitors_text・competitor_price_gap・competitor_countermeasure
+      ⚠️ 価格差・今後の対策は「要回答」の判定（LOST_FIELDS）から 2026-09-18 に外れている。
+      ⚠️ 判定に戻すときは、ここにも戻すこと（返さないと全件「要回答」になる）。
+      ⚠️ ① の database_order.php は予備なので外していない（画面はどちらでも動く）。
   */
-  COALESCE(competitor_price_gap, '') AS competitor_price_gap,
-  COALESCE(competitor_countermeasure, '') AS competitor_countermeasure,
   COALESCE(call_log, '') AS call_log,
   COALESCE(hotlead_id, '') AS hotlead_id,
   COALESCE(k_snap, '') AS k_snap
@@ -141,14 +137,11 @@ const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
   ) AS register,
   COALESCE(sales_promotion_name, '') AS medium,
   COALESCE(status, '') AS status,
-  COALESCE(rank_period, '') AS rank_period,
   COALESCE(call_status, '') AS call_status,
   COALESCE(show_dashboard, 0) AS trash,
   COALESCE(full_address, '') AS full_address,
   COALESCE(hp_campaign, '') AS hp_campaign,
-  COALESCE(property_name, '') AS property_name,
-  COALESCE(property_tour_name, '') AS property_tour_name,
-  COALESCE(introduction_person_category, '') AS introduction_person_category,
+  /* ⚠️ v2.2.271 で外した列（DatabaseKaeru.tsx で使っていない）: rank_period・property_name・property_tour_name・introduction_person_category */
   COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number_2,
   COALESCE(customer_contacts_phone_number, '') AS phone_number,
   COALESCE(customer_contacts_email, '') AS mail,
@@ -164,17 +157,32 @@ const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
  * ⚠️ order は `family_info IS NOT NULL` で絞り、spec は全件（PHP のまま）。
  *   ⚠️ 揃えると件数が変わる。画面側の使い方も違う
  *   （order は中身を検索に使い、spec は id の有無しか見ていない）。
+ * ⚠️ v2.2.271: spec は id だけ返す。order の family_info は index.ts で家族の名前だけに減らす。
  */
 const FAMILY_SQL: Record<DatabaseCategory, string> = {
   order: `SELECT id, family_info FROM family_info WHERE family_info IS NOT NULL`,
-  spec: `SELECT * FROM family_info`,
+  spec: `SELECT id FROM family_info`,
 };
 
 /** イベント。⚠️ order だけ。spec の PHP には無い */
 const EVENT_SQL = `SELECT * FROM event_calendar WHERE shop = 'khg' AND flag = 1`;
 
-/** HOTLEAD。⚠️ order だけ。spec の PHP には無い */
-const HOTLEAD_SQL = `SELECT id, status, hotlead_url, action_history, ticket_stop_reason_type FROM hotlead_db`;
+/** 文字列 col の中に word が何回出るか（画面の split(word).length - 1 と同じ数え方） */
+const countWord = (col: string, word: string): string =>
+  `(CHAR_LENGTH(COALESCE(${col}, '')) - CHAR_LENGTH(REPLACE(COALESCE(${col}, ''), '${word}', ''))) DIV CHAR_LENGTH('${word}')`;
+
+/**
+ * HOTLEAD。⚠️ order だけ。spec の PHP には無い
+ * ⚠️ v2.2.271: 行動履歴（action_history）の全文は返さず、画面が出す件数だけ返す（ローカル実測 2.8MB → 0.6MB）。
+ *   has_action … 行動履歴が入っているか（画面は入っているときだけ件数を出す）
+ *   ⚠️ ① の database_order.php は全文のまま。画面はどちらの形でも数える（databaseUtils.ts の hotleadActions）。
+ */
+const HOTLEAD_SQL = `SELECT id, status, hotlead_url, ticket_stop_reason_type,
+  CASE WHEN COALESCE(action_history, '') <> '' THEN 1 ELSE 0 END AS has_action,
+  ${countWord('action_history', '架電')} AS action_calls,
+  ${countWord('action_history', 'メール')} AS action_mails,
+  ${countWord('action_history', 'SMS')} AS action_sms
+  FROM hotlead_db`;
 
 /** 紹介。⚠️ order だけ。spec の PHP には無い */
 const INTRODUCTORY_SQL = `SELECT * FROM introductory`;
diff --git a/backend-express/src/features/menu.ts b/backend-express/src/features/menu.ts
index c00a5c4e0..103e4613a 100644
--- a/backend-express/src/features/menu.ts
+++ b/backend-express/src/features/menu.ts
@@ -77,11 +77,13 @@ const SYNC_SQL = `
  *
  * ⚠️ 基準日 '2026-01-01' はフロントに直書きされていたものをそのまま移した。
  *   ⚠️ この日より前の予約は数えない、という運用上の区切りである。
+ * ⚠️ v2.2.271: 個人情報の削除依頼があった顧客（delete_dashboard = 1）は数えない（① の menu.php・cancelList.php と同じ）。
  */
 const CANCEL_SQL = `
   SELECT COUNT(*) AS c
     FROM master_data
    WHERE show_dashboard = 1
+     AND COALESCE(delete_dashboard, 0) = 0
      AND COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
      AND COALESCE(cancel_status, '') = ''
      AND COALESCE(status, '') <> '重複'
diff --git a/backend/src/handlers/cancelList.php b/backend/src/handlers/cancelList.php
index 60a1ebeb6..b1737e51e 100644
--- a/backend/src/handlers/cancelList.php
+++ b/backend/src/handlers/cancelList.php
@@ -17,7 +17,8 @@ $sql_customer = "SELECT
   COALESCE(cancel_status, '') AS cancel_status,
   COALESCE(status, '') AS status,
   COALESCE(sales_promotion_name, '') AS medium
- FROM master_data WHERE show_dashboard = 1;
+ FROM master_data WHERE show_dashboard = 1
+  AND COALESCE(delete_dashboard, 0) = 0; -- v2.2.271: 個人情報の削除依頼があった顧客は出さない
 ";
 $stmt_customer = $pdo->prepare($sql_customer);
 $stmt_customer->execute();
diff --git a/backend/src/handlers/cancelList_edit_reason.php b/backend/src/handlers/cancelList_edit_reason.php
index 7322aebc9..1bc5f55ad 100644
--- a/backend/src/handlers/cancelList_edit_reason.php
+++ b/backend/src/handlers/cancelList_edit_reason.php
@@ -32,7 +32,8 @@ $sql_customer = "SELECT
   COALESCE(hp_campaign, '') AS hp_campaign,
   COALESCE(cancel_status, '') AS cancel_status,
   COALESCE(sales_promotion_name, '') AS medium
- FROM master_data WHERE show_dashboard = 1;
+ FROM master_data WHERE show_dashboard = 1
+  AND COALESCE(delete_dashboard, 0) = 0; -- v2.2.271: 個人情報の削除依頼があった顧客は出さない（cancelList.php と同じ）
 ";
 $stmt_customer = $pdo->prepare($sql_customer);
 $stmt_customer->execute();
diff --git a/backend/src/handlers/daily_action.php b/backend/src/handlers/daily_action.php
index 70db92998..2f2f842ea 100644
--- a/backend/src/handlers/daily_action.php
+++ b/backend/src/handlers/daily_action.php
@@ -253,6 +253,7 @@ $sql_cancel = "SELECT 'cancel' AS kind,
     FROM master_data m
     LEFT JOIN $visible_shops s ON s.shop = TRIM(m.in_charge_store)
    WHERE m.show_dashboard = 1
+     AND COALESCE(m.delete_dashboard, 0) = 0 /* v2.2.271: 個人情報の削除依頼があった顧客は出さない（menu.php と同じ） */
      AND COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
      AND COALESCE(m.cancel_status, '') = ''
      AND COALESCE(m.status, '') <> '重複'
diff --git a/backend/src/handlers/menu.php b/backend/src/handlers/menu.php
index 067cd8316..ba68e6977 100644
--- a/backend/src/handlers/menu.php
+++ b/backend/src/handlers/menu.php
@@ -50,9 +50,11 @@ $response_sync = $stmt_sync->fetch(PDO::FETCH_ASSOC);
 // ⚠️ reserved_interview は 'YYYY/MM/DD' と 'YYYY-MM-DD' が混在するため
 //   REPLACE してから STR_TO_DATE する。解釈できない値は NULL になり比較が偽になる。
 // ⚠️ 基準日 '2026-01-01' はフロントに直書きされていたものをそのまま移した。
+// ⚠️ v2.2.271: 個人情報の削除依頼があった顧客（delete_dashboard = 1）は数えない（② の menu.ts と同じ）。
 $sql_cancel = "SELECT COUNT(*) AS c
         FROM master_data
        WHERE show_dashboard = 1
+         AND COALESCE(delete_dashboard, 0) = 0
          AND COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
          AND COALESCE(cancel_status, '') = ''
          AND COALESCE(status, '') <> '重複'
diff --git a/frontend/src/components/database/DatabaseKaeru.tsx b/frontend/src/components/database/DatabaseKaeru.tsx
index 64d93e050..54c416f36 100644
--- a/frontend/src/components/database/DatabaseKaeru.tsx
+++ b/frontend/src/components/database/DatabaseKaeru.tsx
@@ -11,7 +11,7 @@ import IntegrateModal from './IntegrateModal';
 import { useIsSp } from '../../utils/isSp';
 import { PastCustomer } from './PastCustomer';
 import { useDebounce } from './useDebounce';
-import { kataToHira, staffOptionsOf } from './databaseUtils';
+import { kataToHira, staffOptionsOf, decodeRows } from './databaseUtils';
 import { thisYear } from '../../utils/thisYear';
 // ⚠️ 役職→社員番号の並びを借りている。同じ並びを2箇所に書くと片方だけ腐る
 import { sortStaff } from '../header/ambassador/useAmbassadorMaster';
@@ -29,6 +29,22 @@ type Props = {
     key: number
 };
 
+/** ふりがな検索用の値（空白を消して平仮名にする） */
+const kanaKey = (kana: string | undefined): string => kataToHira((kana || '').replace(/[\s\u3000]+/g, ''));
+
+/**
+ * 応答の顧客一覧を画面用にする（検索用の列を先に作っておく）。
+ * ⚠️ v2.2.271: ② は「列名1回＋値の並び」、① は配列で返す。decodeRows がどちらも配列にする。
+ * ⚠️ _kana（ふりがなの空白を消して平仮名にしたもの）も読み込み時に1回だけ作る（以前は絞り込みのたびに全行で作っていた）。
+ */
+const prepareCustomers = (data: unknown): CustomerList[] =>
+    decodeRows<CustomerList>(data).map(c => ({
+        ...c,
+        search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
+        _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, ''),
+        _kana: kanaKey(c.customer_contacts_name_kana)
+    }));
+
 const DatabaseKaeru = ({ }: Props) => {
     const { authority, category } = useContext(AuthContext);
     const [shopArray, setShopArray] = useState<shopList[]>([]);
@@ -103,16 +119,12 @@ const DatabaseKaeru = ({ }: Props) => {
             try {
                 const response = await apiClient.post("", { request: 'database', category });
 
-                const customers = response.data.customer.map((c: any) => ({
-                    ...c,
-                    search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
-                    _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, '') // ★あらかじめスペースを消しておく
-                }));
+                const customers = prepareCustomers(response.data.customer);
                 setOriginalDatabase(customers);
 
                 await setShopArray(response.data.shop.filter((item: shopList) => !item.shop.includes('店舗未設定')));
                 await setMediumArray(response.data.medium.map(item => item.medium));
-                await setDisplayLength(response.data.customer.length);
+                await setDisplayLength(customers.length);
                 await setStaffArray(response.data.staff);
 
                 const familyId = response.data.family.map(f => f.id);
@@ -153,6 +165,9 @@ const DatabaseKaeru = ({ }: Props) => {
         return () => { ignore = true; };
     }, [pastStaffSearch.debouncedValue]);
 
+    // ⚠️ v2.2.271: 家族の有無も集合で引く（以前は familyList.includes で総当たり）
+    const familyIdSet = useMemo(() => new Set(familyList), [familyList]);
+
     // includes() だと顧客数×ID数の総当たりになるため、集合にしてから引く
     const pastCustomerIdSet = useMemo(() => new Set(pastCustomerIds), [pastCustomerIds]);
 
@@ -165,9 +180,6 @@ const DatabaseKaeru = ({ }: Props) => {
         const normalizedKanaSearch = kataToHira(kanaSearch.debouncedValue.replace(/[\s\u3000]+/g, ''));
 
         const result = originalDatabase.filter(item => {
-            // 💡 対象データの正規化: Null回避しつつ、スペース除去＆平仮名変換
-            const targetKana = kataToHira((item.customer_contacts_name_kana || '').replace(/[\s\u3000]+/g, ''));
-
             return (trash === 1 ? (Number(item.trash) ?? 0) !== 0 : true)
                 && (trash === 0 ? (Number(item.trash) ?? 0) !== 1 : true)
                 && (selectedShop ? arrIncludes(item.shop, selectedShop) : true)
@@ -184,13 +196,14 @@ const DatabaseKaeru = ({ }: Props) => {
                 // ⚠️ v2.2.187: 氏名②（customer_2）も名前検索の対象
                 && (nameSearch.debouncedValue ? (strIncludes(item._cleanCustomer, cleanFormattedName) || strIncludes(cleanCustomerName(item.customer_2), cleanFormattedName)) : true)
                 // 💡 修正: 正規化されたデータ同士で比較する
-                && (kanaSearch.debouncedValue ? strIncludes(targetKana, normalizedKanaSearch) : true)
+                // ⚠️ v2.2.271: _kana は prepareCustomers が読み込み時に作る。⚠️ 名寄せ（IntegrateModal）のあとの行には無いので、その場で作る
+                && (kanaSearch.debouncedValue ? strIncludes(item._kana ?? kanaKey(item.customer_contacts_name_kana), normalizedKanaSearch) : true)
                 && (staffSearch.debouncedValue ? strIncludes(item.staff, staffSearch.debouncedValue.split(' ')[0]) : true)
                 && (phoneSearch.debouncedValue ? (strIncludes(item.phone_number, phoneSearch.debouncedValue) || strIncludes(item.phone_number_2, phoneSearch.debouncedValue)) : true)
                 && (mailSearch.debouncedValue ? (strIncludes(item.mail, mailSearch.debouncedValue) || strIncludes(item.mail_2, mailSearch.debouncedValue)) : true)
                 && (addressSearch.debouncedValue ? String((item.full_address ?? '').replace(/[\s ]+/g, "")).includes(addressSearch.debouncedValue) : true)
                 && (callStatus ? (item.call_status ?? '') === callStatus : true)
-                && (familyStatus ? familyList.includes(item.id) : true)
+                && (familyStatus ? familyIdSet.has(item.id) : true)
                 && (pastStaffSearch.debouncedValue ? pastCustomerIdSet.has(item.id) : true)
                 && (selectedFollow === '追客中' ? arrIncludes(['Aランク', 'Bランク', 'Cランク', 'Dランク'], item.rank) : selectedFollow === '追客終了' ? arrIncludes(['Eランク', 'Fランク', 'Gランク', 'Hランク'], item.rank) : true)
                 && (pastStaffSearch.debouncedValue ? pastCustomerIdSet.has(item.id) : true); // ※既存コードにあった重複の記述をそのまま残しています
@@ -352,12 +365,7 @@ const DatabaseKaeru = ({ }: Props) => {
                         roll: 'trash'
                     };
                     const response = await apiClient.post("", postData);
-                    const customers = response.data.customer.map((c: any) => ({
-                        ...c,
-                        search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
-                        _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, '') // ★あらかじめスペースを消しておく
-                    }));
-                    setOriginalDatabase(customers);
+                    setOriginalDatabase(prepareCustomers(response.data.customer));
                 } catch (error) {
                     console.error("Error fetching data:", error);
                 }
@@ -376,14 +384,7 @@ const DatabaseKaeru = ({ }: Props) => {
 
         const fetchData = async () => {
             const response = await apiClient.post("", { request: 'database', category });
-
-            const customers = response.data.customer.map((c: any) => ({
-                ...c,
-                search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
-                _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, '')
-            }));
-
-            setOriginalDatabase(customers);
+            setOriginalDatabase(prepareCustomers(response.data.customer));
         }
 
         await fetchData();
diff --git a/frontend/src/components/database/DatabaseOrder.tsx b/frontend/src/components/database/DatabaseOrder.tsx
index 2a5033f7e..1e3aa028e 100644
--- a/frontend/src/components/database/DatabaseOrder.tsx
+++ b/frontend/src/components/database/DatabaseOrder.tsx
@@ -11,10 +11,12 @@ import InformationEdit from '../information/InformationEdit';
 import { useIsSp } from '../../utils/isSp';
 import { useDebounce } from './useDebounce';
 import apiClient from '../../utils/apiClient';
-import { safeParse, hotleadStyle, staffOptionsOf } from './databaseUtils';
+import { safeParse, hotleadStyle, staffOptionsOf, decodeRows, hotleadActions } from './databaseUtils';
+import type { HotleadActions } from './databaseUtils';
 import { GiftDot, GiftLegend } from './GiftMark';
 import { thisYear } from '../../utils/thisYear';
 import { missingLostFields } from '../../utils/informationUtils';
+import { isDelete } from '../../utils/deletedCustomer';
 // ⚠️ 役職→社員番号の並びを借りている。同じ並びを2箇所に書くと片方だけ腐る
 import { sortStaff } from '../header/ambassador/useAmbassadorMaster';
 import NexusBadge from '../NexusBadge';
@@ -89,6 +91,22 @@ const strIncludesCI = (val: any, sub: string) =>
     sub ? String(val ?? '').toLowerCase().includes(sub.toLowerCase()) : true;
 const arrIncludes = (arr: any, v: any) => v ? (Array.isArray(arr) ? arr.includes(v) : String(arr ?? '').includes(v)) : true;
 
+/**
+ * 応答の顧客一覧を画面用にする（検索用の列を先に作っておく）。
+ * ⚠️ v2.2.271: ② は「列名1回＋値の並び」、① は配列で返す。decodeRows がどちらも配列にする。
+ * ⚠️ 非表示・元に戻す（handleGarbage）のあとも必ずここを通す（以前は通しておらず、その後の名前・住所の検索が効かなかった）。
+ */
+const prepareCustomers = (data: unknown): CustomerItem[] =>
+    decodeRows<CustomerItem>(data).map(c => ({
+        ...c,
+        search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
+        _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, '')
+    }));
+
+/** 表の Hotlead 欄に出すもの（v2.2.271: 読み込み時に1回だけ作り、id で引く） */
+type HotleadInfo = { status: string; url: string; reason: string; actions: HotleadActions | null };
+const EMPTY_HOTLEAD: HotleadInfo = { status: '', url: '', reason: '', actions: null };
+
 
 const DatabaseOrder = ({ onReload }: Props) => {
     const { authority, category, token } = useContext(AuthContext);
@@ -180,11 +198,7 @@ const DatabaseOrder = ({ onReload }: Props) => {
         try {
             const response = await apiClient.post("", { request: 'database', category });
 
-            const customers: CustomerItem[] = response.data.customer.map((c: any) => ({
-                ...c,
-                search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
-                _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, '')
-            }));
+            const customers = prepareCustomers(response.data.customer);
 
             setOriginalDatabase(customers);
 
@@ -208,6 +222,8 @@ const DatabaseOrder = ({ onReload }: Props) => {
 
                 customers.forEach((item) => {
                     if (Number(item.trash) !== 1) return;
+                    // ⚠️ v2.2.271: 個人情報の削除依頼があった顧客は数えない。① ② とも一覧から除いて返すが、念のため画面でも除く
+                    if (isDelete(item)) return;
 
                     const cTarget = new Date(dateFormate(item.reserved_interview)).getTime();
                     if (cTarget < nowTime && cancelBase < cTarget && !item.interview && !item.cancel_status && item.status !== '重複') {
@@ -238,6 +254,31 @@ const DatabaseOrder = ({ onReload }: Props) => {
         fetchDatabase(true);
     }, [fetchDatabase]);
 
+    /**
+     * 家族・Hotlead の索引（v2.2.271）。⚠️ 読み込み時に1回だけ作る。
+     *   以前は絞り込みのたびに全顧客 × Hotlead（約2,800件）を find で総当たりし、
+     *   家族は includes で引いていた（解除のたびに 1.7〜2.5秒止まっていた）。
+     */
+    const familyIdSet = useMemo(() => new Set(familyList.map(f => f.id)), [familyList]);
+    const familyNames = useMemo(() => familyList.flatMap(f => {
+        const parsedList = safeParse(f.family_info) || [];
+        return parsedList.map((info: any) => ({ name: info.name, id: f.id }));
+    }), [familyList]);
+    const hotleadMap = useMemo(() => {
+        const map = new Map<string, HotleadInfo>();
+        hotleadList.forEach(h => {
+            // ⚠️ 同じ id が2行あったら、以前の find と同じく最初の行を使う
+            if (map.has(h.id)) return;
+            map.set(h.id, {
+                status: h.status ?? '',
+                url: h.hotlead_url ?? '',
+                reason: h.ticket_stop_reason_type ?? '',
+                actions: hotleadActions(h)
+            });
+        });
+        return map;
+    }, [hotleadList]);
+
     // フィルタリング・ソート処理
     const filteredDatabase = useMemo(() => {
         const sName = nameSearch.debouncedValue ?? '';
@@ -246,13 +287,13 @@ const DatabaseOrder = ({ onReload }: Props) => {
         const formattedAddress = sName.includes('+') ? sName.split('+')[1] : '';
         const cleanFormattedName = formattedName.replace(/[\s\u3000]+/g, '');
 
-        const familyIds = familyList.map(f => f.id);
-        const filteredFamilyID = familyList.flatMap(f => {
-            const parsedList = safeParse(f.family_info) || [];
-            return parsedList.map(info => ({ name: info.name, id: f.id }));
-        }).filter(f => f.name.includes(familySearch.debouncedValue)).map(f => f.id);
+        const filteredFamilyID = familySearch.debouncedValue
+            ? new Set(familyNames.filter(f => f.name.includes(familySearch.debouncedValue)).map(f => f.id))
+            : null;
 
-        const hotleadIds = hotleadList.filter(h => hotleadStatus ? h.status === hotleadStatus : true).map(h => h.id);
+        const hotleadIds = hotleadStatus
+            ? new Set(hotleadList.filter(h => h.status === hotleadStatus).map(h => h.id))
+            : null;
 
         // 型安全なmapとsort
         const result = originalDatabase.filter(item => {
@@ -278,28 +319,14 @@ const DatabaseOrder = ({ onReload }: Props) => {
                 && (addressSearch.debouncedValue ? strIncludes(item.search_address, addressSearch.debouncedValue) : true)
                 // ⚠️ メールだけ大文字小文字を区別しない（strIncludesCI）
                 && (mailSearch.debouncedValue ? strIncludesCI(item.mail, mailSearch.debouncedValue) : true)
-                && (familySearch.debouncedValue ? filteredFamilyID.includes(item.id) : true)
+                && (filteredFamilyID ? filteredFamilyID.has(item.id) : true)
                 && (callStatus ? (item.call_status ?? '') === callStatus : true)
-                && (familyStatus ? familyIds.includes(item.id) : true)
+                && (familyStatus ? familyIdSet.has(item.id) : true)
                 && (searchedEvent ? (item.event === searchedEvent && item.medium === 'イベント') : true)
                 && (snapStatus ? item.k_snap : true)
-                && (hotleadStatus ? hotleadIds.includes(item.hotlead_id) : true);
-        }).map(r => {
-            const targetStatus = hotleadList.find(h => h.id === r.hotlead_id) ?? {};
-            const targetAction = targetStatus?.action_history ?
-                (<div className='d-flex align-items-center text-secondary'>
-                    <i className="fa-solid fa-phone me-1"></i>{targetStatus?.action_history.split('架電').length - 1}
-                    <i className="fa-solid fa-envelope mx-1"></i>{targetStatus?.action_history.split('メール').length - 1}
-                    <i className="fa-solid fa-comment-sms mx-1"></i>{targetStatus?.action_history.split('SMS').length - 1}</div>) : '';
-            return {
-                ...r, hotlead: {
-                    status: targetStatus?.status ?? '',
-                    url: targetStatus?.hotlead_url ?? '',
-                    action: targetAction,
-                    reason: targetStatus?.ticket_stop_reason_type ?? ''
-                }
-            };
+                && (hotleadIds ? hotleadIds.has(item.hotlead_id) : true);
         });
+        // ⚠️ v2.2.271: Hotlead 欄の中身は全行には付けない。表に出す行だけ hotlead() が hotleadMap から引く
 
         // registerの型エラー解消部分（文字列化して安全に比較）
         return result.sort((a, b) => {
@@ -313,7 +340,7 @@ const DatabaseOrder = ({ onReload }: Props) => {
         staffSearch.debouncedValue, phoneSearch.debouncedValue, callStatus, addressSearch.debouncedValue,
         // ⚠️⚠️ **入れ忘れると、入力しても一覧が絞り込まれない**
         mailSearch.debouncedValue,
-        familySearch.debouncedValue, selectedIntroductory, trash, familyList, familyStatus,
+        familySearch.debouncedValue, selectedIntroductory, trash, familyIdSet, familyNames, familyStatus,
         snapStatus, searchedEvent, hotleadStatus, hotleadList
     ]);
 
@@ -355,7 +382,7 @@ const DatabaseOrder = ({ onReload }: Props) => {
                 show_dashboard: trash === 1 ? 0 : 1,
                 id, category, roll: 'trash'
             });
-            setOriginalDatabase(response.data.customer);
+            setOriginalDatabase(prepareCustomers(response.data.customer));
         } catch (error) {
             console.error("Error fetching data:", error);
         }
@@ -398,13 +425,18 @@ const DatabaseOrder = ({ onReload }: Props) => {
         }
     })
 
-    const hotlead = (item: any) => {
-        if (!item.hotlead) return;
-        return <div onClick={() => window.open(item.hotlead.url, '_blank', 'noopener,noreferrer')}>
-            <div style={hotleadStyle(item.hotlead.status)}
-            >{item.hotlead.status}</div>
-            {item.hotlead.status && <div className="text-secondary" style={{ fontSize: '8px' }}>{item.hotlead.reason}</div>}
-            <div style={{ cursor: 'pointer' }}>{item.hotlead.action}</div>
+    /** ⚠️ v2.2.271: 表に出す行の分だけ hotleadMap から引いて作る（以前は絞り込みのたびに全行分を作っていた） */
+    const hotlead = (item: CustomerItem) => {
+        const h = hotleadMap.get(item.hotlead_id ?? '') ?? EMPTY_HOTLEAD;
+        return <div onClick={() => window.open(h.url, '_blank', 'noopener,noreferrer')}>
+            <div style={hotleadStyle(h.status)}
+            >{h.status}</div>
+            {h.status && <div className="text-secondary" style={{ fontSize: '8px' }}>{h.reason}</div>}
+            <div style={{ cursor: 'pointer' }}>{h.actions && (
+                <div className='d-flex align-items-center text-secondary'>
+                    <i className="fa-solid fa-phone me-1"></i>{h.actions.calls}
+                    <i className="fa-solid fa-envelope mx-1"></i>{h.actions.mails}
+                    <i className="fa-solid fa-comment-sms mx-1"></i>{h.actions.sms}</div>)}</div>
         </div>
     }
 
diff --git a/frontend/src/components/database/databaseUtils.ts b/frontend/src/components/database/databaseUtils.ts
index ac5b2a06b..176360267 100644
--- a/frontend/src/components/database/databaseUtils.ts
+++ b/frontend/src/components/database/databaseUtils.ts
@@ -96,6 +96,38 @@ export const safeParse = (data: any) => {
     }
 };
 
+/**
+ * 顧客一覧の応答を行の配列にする（v2.2.271）。
+ * ⚠️ ② は「列名1回＋値の並び」（{ cols, rows }）、① の PHP は従来の配列で返す。どちらでも同じ配列になる。
+ */
+export const decodeRows = <T = Record<string, any>>(data: unknown): T[] => {
+    if (Array.isArray(data)) return data as T[];
+    const c = data as { cols?: unknown; rows?: unknown } | null | undefined;
+    if (!c || !Array.isArray(c.cols) || !Array.isArray(c.rows)) return [];
+    const cols = c.cols as string[];
+    return (c.rows as unknown[][]).map(r => {
+        const o: Record<string, unknown> = {};
+        for (let i = 0; i < cols.length; i++) o[cols[i]] = r[i];
+        return o as T;
+    });
+};
+
+export type HotleadActions = { calls: number; mails: number; sms: number };
+
+/**
+ * ホットリードの行動の件数（架電・メール・SMS）。行動履歴が空なら null。
+ * ⚠️ v2.2.271: ② は件数（has_action・action_calls・action_mails・action_sms）だけ返す。① の PHP は全文（action_history）。
+ */
+export const hotleadActions = (h: Record<string, any>): HotleadActions | null => {
+    if (typeof h.action_history === 'string' || h.action_history === null) {
+        const a: string = h.action_history ?? '';
+        if (!a) return null;
+        return { calls: a.split('架電').length - 1, mails: a.split('メール').length - 1, sms: a.split('SMS').length - 1 };
+    }
+    if (!Number(h.has_action)) return null;
+    return { calls: Number(h.action_calls) || 0, mails: Number(h.action_mails) || 0, sms: Number(h.action_sms) || 0 };
+};
+
 export const hotleadStyle = (status: string | null) => {
   if (!status) return;
 
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 8a1a33e4e..521773047 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.270';
+export const newVersion = '2.2.271';
```
