# 作業記録 2026-11-16-04　v2.2.272　① PHP の入口にログインの確認／顧客DB（注文）の予備を軽くする

## 依頼
v2.2.271 の作業中に見つけた、次の2つの問題を直す（次のブランチで修正）。
- ① の cancelList が、トークン無し（画面に書かれた固定ヘッダーだけ）で全顧客の氏名・電話・メール（約14MB）を返す。PHP の処理全般に、ログインを確かめるしくみが無い
- ① の database_order.php（② が落ちたときの予備）がメモリ不足で落ちる

利用者の選択（AskUserQuestion）
- 認証の範囲：**2段階で入れる**。個人情報を返す処理は今回すぐトークン必須、それ以外はトークン無しを記録するだけ。本番の記録で外部の利用元を1〜2週間洗い出してから、次の版で全体を必須にする
- 予備の軽量化：**一緒に進める**

## 調べたこと
- ① PHP の handlers は 172本。そのうちトークンを確かめているのは 24本だけ
- トークン無しで ① を呼ぶ正規の利用元
  - GAS 10本：housing_bazar_entry・kagosuma_entry・member_entry・myhomes_entry・tochishinchaku_entry・homes_sale_assessment_entry・owners_house_application_import・catalog_resale_update・homes_db_kaeru・pgh_order
  - 公開フォーム：campaign_form、estimate_entry、owners_house_application、owners_house_reservation
  - ② からのサーバー間の呼び出し：hotlead（features/hotlead/importer.ts）、meta_scrape_image（features/metaAds/scrape.ts）
  - ログイン：login、k-snap_login
- ② の phpFallback（② に無い request を ① へ回す処理）はヘッダーをそのまま渡すので、Token も ① に届く
- フロントはほぼすべて apiClient（トークン付き）を使っている。例外は K-Snap の写真登録（photo/Form.tsx・multipart）だけ

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/src/core | **request_auth.php（新規）** | 定数 `REQUEST_AUTH_PUBLIC`・`REQUEST_AUTH_REQUIRED`、関数 `requestAuthGate()` |
| backend/src | index.php | 入口で `requestAuthGate()` を呼ぶ（② への転送より前） |
| backend/src/core | security_log.php | `SECURITY_LOG_AGGREGATE` に auth_missing |
| backend/src/handlers/databaseAction | database_order.php | ② の v2.2.271 と同じ中身・形（列を外す・列名1回＋値の並び・家族は名前だけ・Hotlead は件数だけ） |
| backend-express/src/features | securityLog.ts | 型 `SecurityEvent`・`AGGREGATE_EVENTS`・一覧の `EVENTS` に auth_missing |
| backend-express/src/features/database | queries.ts | 注記だけ（① の予備も同じ形にした） |
| frontend/src/components/header/system | SecurityLog.tsx | 種類「トークン無し（通した）」 |
| frontend/src/components/photo | Form.tsx | K-Snap の写真登録に Token ヘッダー |
| frontend/src/utils | version.ts | 2.2.272 |
| backend/scripts/sql | 2026-11-16_update_log_2.2.272.sql（新規） | 更新履歴1行＋業務ガイド1本 |
| backend/scripts/guide/articles/common | screen-195.md | セキュリティログの記事 |

## 新規ファイル：backend/src/core/request_auth.php（全文）
```php
<?php

require_once __DIR__ . '/authz.php';

/**
 * ─────────────────────────────────────────────
 * ① の入口でのログインの確認（v2.2.272）。index.php が ② への転送より前に1回だけ呼ぶ。
 *
 * ⚠️ 以前は handlers の大半（172本中148本）がトークンを確かめておらず、
 *   画面に書かれた固定の Authorization だけで全顧客の氏名・電話・メールを取り出せた。
 *
 * ⚠️ 2段階で入れる（利用者の了承 2026-11-16）。
 *   段階1（この版）… REQUEST_AUTH_REQUIRED の処理だけトークン必須（無い・無効なら 401）。
 *                    それ以外でトークンが無いものは、通したうえで security_log に auth_missing として残す。
 *   段階2（次の版）… 本番の auth_missing を見て、外部連携の request を REQUEST_AUTH_PUBLIC に足してから、
 *                    REQUEST_AUTH_PUBLIC 以外をすべてトークン必須にする。
 *
 * ⚠️ トークンの付いた要求が無効だったときも、段階1では必須の処理以外は通す（記録はする）。
 * ─────────────────────────────────────────────
 */

/**
 * トークン無しで使ってよい処理（ログインと外部からの取り込み）。記録もしない。
 * ⚠️ 外部（GAS・フォーム・② のサーバー間の呼び出し）が送っている request を足すときはここへ。
 */
const REQUEST_AUTH_PUBLIC = [
    // ログイン
    'login',
    'k-snap_login',
    // 公開フォーム（backend/scripts/brand_form_api・estimate_2l・owners_house_form）
    'campaign_form',
    'estimate_entry',
    'owners_house_application',
    'owners_house_reservation',
    // GAS（backend/scripts/gas）
    'housing_bazar_entry',
    'kagosuma_entry',
    'member_entry',
    'myhomes_entry',
    'tochishinchaku_entry',
    'homes_sale_assessment_entry',
    'owners_house_application_import',
    'catalog_resale_update',
    'homes_db_kaeru',
    'pgh_order',
    // ② からのサーバー間の呼び出し（features/hotlead/importer.ts・features/metaAds/scrape.ts）
    'hotlead',
    'meta_scrape_image',
];

/**
 * 段階1でトークン必須にする処理（顧客の個人情報を返す・直す画面の処理）。
 * ⚠️ どれも画面から apiClient（トークン付き）でだけ呼ばれていることを確認済み（2026-11-16）。
 */
const REQUEST_AUTH_REQUIRED = [
    'cancelList',
    'cancelList_edit_reason',
    'callStatusList',
    'company',
    'customer',
    'customerTrend',
    'database',
    'header_staff_edit',
    'ice_world',
    'information',
    'inside',
    'integrate',
    'interviewLog',
    'interviewLog_update_interview',
    'list',
    'list_resale_sync',
    'lostList',
    'map',
    'past_customer',
    'rank',
    'shopTrend',
];

/**
 * 入口での確認。必須の処理でトークンが無い・無効なら 401 を返して終了する（requireStaff）。
 */
function requestAuthGate(PDO $pdo, array $headers, string $request): void
{
    if (in_array($request, REQUEST_AUTH_PUBLIC, true)) return;

    if (in_array($request, REQUEST_AUTH_REQUIRED, true)) {
        requireStaff($pdo, $headers);
        return;
    }

    // ⚠️ 段階1：通すが、トークンが無い・無効なものは記録する（段階2で外部連携を洗い出すため）
    $token = $headers['Token'] ?? $headers['token'] ?? '';
    if ($token !== '' && getUserByToken($pdo, $token)) return;
    securityLog([
        'event' => 'auth_missing',
        'status' => 200,
        'message' => $token === '' ? 'トークンなし（通した）' : 'トークンが無効（通した）',
    ], $pdo);
}
```

## 差分（全文）
```diff
diff --git a/backend-express/src/features/database/queries.ts b/backend-express/src/features/database/queries.ts
index 5b21b5d0d..588ea2a0b 100644
--- a/backend-express/src/features/database/queries.ts
+++ b/backend-express/src/features/database/queries.ts
@@ -111,7 +111,7 @@ const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
       rank_period・competitors_text・competitor_price_gap・competitor_countermeasure
       ⚠️ 価格差・今後の対策は「要回答」の判定（LOST_FIELDS）から 2026-09-18 に外れている。
       ⚠️ 判定に戻すときは、ここにも戻すこと（返さないと全件「要回答」になる）。
-      ⚠️ ① の database_order.php は予備なので外していない（画面はどちらでも動く）。
+      ⚠️ ① の database_order.php（予備）も v2.2.272 で同じ列を外した。
   */
   COALESCE(call_log, '') AS call_log,
   COALESCE(hotlead_id, '') AS hotlead_id,
@@ -175,7 +175,7 @@ const countWord = (col: string, word: string): string =>
  * HOTLEAD。⚠️ order だけ。spec の PHP には無い
  * ⚠️ v2.2.271: 行動履歴（action_history）の全文は返さず、画面が出す件数だけ返す（ローカル実測 2.8MB → 0.6MB）。
  *   has_action … 行動履歴が入っているか（画面は入っているときだけ件数を出す）
- *   ⚠️ ① の database_order.php は全文のまま。画面はどちらの形でも数える（databaseUtils.ts の hotleadActions）。
+ *   ⚠️ ① の database_order.php（予備）も v2.2.272 で同じ件数の形にした。
  */
 const HOTLEAD_SQL = `SELECT id, status, hotlead_url, ticket_stop_reason_type,
   CASE WHEN COALESCE(action_history, '') <> '' THEN 1 ELSE 0 END AS has_action,
diff --git a/backend-express/src/features/securityLog.ts b/backend-express/src/features/securityLog.ts
index c8f9d3c63..105c21a32 100644
--- a/backend-express/src/features/securityLog.ts
+++ b/backend-express/src/features/securityLog.ts
@@ -26,10 +26,12 @@ import { logger } from '../utils/logger';
 export type SecurityEvent =
   | 'login' | 'login_failed' | 'logout'
   | 'auth_failed' | 'forbidden' | 'bad_request' | 'unknown_request'
-  | 'server_error' | 'proxy_error';
+  | 'server_error' | 'proxy_error'
+  // ⚠️ v2.2.272: ① だけが書く（トークン無しで通した。backend/src/core/request_auth.php）
+  | 'auth_missing';
 
 /** まとめる種類（⚠️ ① の SECURITY_LOG_AGGREGATE と同じ） */
-const AGGREGATE_EVENTS: ReadonlySet<SecurityEvent> = new Set(['auth_failed', 'forbidden', 'bad_request', 'unknown_request']);
+const AGGREGATE_EVENTS: ReadonlySet<SecurityEvent> = new Set(['auth_failed', 'forbidden', 'bad_request', 'unknown_request', 'auth_missing']);
 
 /** 古い行を消す日数と、書くときに掃除する確率（⚠️ ① と同じ） */
 const KEEP_DAYS = 180;
@@ -140,6 +142,7 @@ const MAX_ROWS = 2000;
 const DAY = /^\d{4}-\d{2}-\d{2}$/;
 const EVENTS: ReadonlySet<string> = new Set([
   'login', 'login_failed', 'logout', 'auth_failed', 'forbidden', 'bad_request', 'unknown_request', 'server_error', 'proxy_error',
+  'auth_missing',
 ]);
 
 interface LogRow extends RowDataPacket {
diff --git a/backend/src/core/security_log.php b/backend/src/core/security_log.php
index 53b7182e7..c19dea192 100644
--- a/backend/src/core/security_log.php
+++ b/backend/src/core/security_log.php
@@ -15,7 +15,8 @@
  */
 
 /** まとめる種類（⚠️ ② の AGGREGATE_EVENTS と同じ） */
-const SECURITY_LOG_AGGREGATE = ['auth_failed', 'forbidden', 'bad_request', 'unknown_request'];
+// ⚠️ v2.2.272: auth_missing（トークン無しで通した。core/request_auth.php）も同じ分ごとにまとめる
+const SECURITY_LOG_AGGREGATE = ['auth_failed', 'forbidden', 'bad_request', 'unknown_request', 'auth_missing'];
 
 /** 古い行を消す日数と、書くときに掃除する確率（⚠️ ② と同じ） */
 const SECURITY_LOG_KEEP_DAYS = 180;
diff --git a/backend/src/handlers/databaseAction/database_order.php b/backend/src/handlers/databaseAction/database_order.php
index 86c90370b..9427f5f4e 100644
--- a/backend/src/handlers/databaseAction/database_order.php
+++ b/backend/src/handlers/databaseAction/database_order.php
@@ -59,7 +59,6 @@ $sql_customer = "SELECT
   ) AS register,
   COALESCE(sales_promotion_name, '') AS medium,
   COALESCE(status, '') AS status,
-  COALESCE(rank_period, '') AS rank_period,
   COALESCE(call_status, '') AS call_status,
   COALESCE(cancel_status, '') AS cancel_status,
   COALESCE(show_dashboard, 0) AS trash,
@@ -75,15 +74,13 @@ $sql_customer = "SELECT
   COALESCE(customer_contacts_email, '') AS mail,
   COALESCE(introduction_person_category, '') AS introduction_person_category,
   COALESCE(competitor_lost_contract_reason, '') AS competitor_lost_contract_reason,
-  COALESCE(competitors_text, '') AS competitors_text,
   COALESCE(competitor_name, '') AS competitor_name,
   COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') AS event,
   COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') AS customized_input_01JRF9CZSW65A151WR30NA4PB3,
   COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH,
-  -- ⚠️ 2026-09-17 に追加。DatabaseOrder.tsx の「要回答」件数で使う。
-  -- ⚠️ ② の backend-express/src/features/database/queries.ts と**必ず揃えること**。
-  COALESCE(competitor_price_gap, '') AS competitor_price_gap,
-  COALESCE(competitor_countermeasure, '') AS competitor_countermeasure,
+  -- ⚠️ v2.2.272: ② の v2.2.271 と同じく、画面で使わない列を外した
+  --   （rank_period・competitors_text・competitor_price_gap・competitor_countermeasure）。
+  --   ⚠️ ② の backend-express/src/features/database/queries.ts と**必ず揃えること**。
   COALESCE(call_log, '') AS call_log,
   COALESCE(hotlead_id, '') AS hotlead_id,
   COALESCE(k_snap, '') AS k_snap
@@ -97,12 +94,39 @@ $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);
 // ギフト進呈可否を確定させる（条件③④の突き合わせ）
 giftApplyToCustomers($pdo, $response_customer);
 
+// ⚠️ v2.2.272: ② と同じく「列名1回＋値の並び」で返す（画面は databaseUtils.ts の decodeRows で戻す）。
+//   ⚠️ 以前は行ごとに列名を繰り返した約28MB の文字列を作り、memory_limit（ローカル 128M）を超えて落ちていた。
+//   ⚠️ 1行ずつ値の並びに移し、元の行はすぐ捨てる（同じ内容を2つ持たない）。
+$customerCols = [];
+foreach ($response_customer as $row) {
+    foreach (array_keys($row) as $col) $customerCols[$col] = true;
+}
+$customerCols = array_keys($customerCols);
+$customerRows = [];
+foreach (array_keys($response_customer) as $i) {
+    $row = $response_customer[$i];
+    unset($response_customer[$i]);
+    $values = [];
+    foreach ($customerCols as $col) $values[] = $row[$col] ?? null;
+    $customerRows[] = $values;
+}
+unset($response_customer);
+
 
 // 家族情報
+// ⚠️ v2.2.272: 画面は家族名の検索にしか使わないので、名前だけにする（② の features/database/index.ts の familyNamesOnly と同じ）
 $sql_family = "SELECT id, family_info FROM family_info WHERE family_info IS NOT NULL";
 $stmt_family = $pdo->prepare($sql_family);
 $stmt_family->execute();
-$response_family = $stmt_family->fetchAll(PDO::FETCH_ASSOC);
+$response_family = [];
+while ($row = $stmt_family->fetch(PDO::FETCH_ASSOC)) {
+    $parsed = json_decode((string)$row['family_info'], true);
+    $names = [];
+    if (is_array($parsed) && array_values($parsed) === $parsed) {
+        foreach ($parsed as $p) $names[] = ['name' => is_array($p) ? ($p['name'] ?? null) : null];
+    }
+    $response_family[] = ['id' => $row['id'], 'family_info' => json_encode($names, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)];
+}
 
 
 // イベント情報
@@ -112,8 +136,16 @@ $stmt_event->execute();
 $response_event = $stmt_event->fetchAll(PDO::FETCH_ASSOC);
 
 
-// イベント情報
-$sql_hotlead = "SELECT id, status, hotlead_url, action_history, ticket_stop_reason_type FROM hotlead_db";
+// HOTLEAD
+// ⚠️ v2.2.272: 行動履歴の全文は返さず、画面が出す件数だけ返す（② の features/database/queries.ts の HOTLEAD_SQL と同じ）
+$countWord = fn(string $word): string =>
+    "(CHAR_LENGTH(COALESCE(action_history, '')) - CHAR_LENGTH(REPLACE(COALESCE(action_history, ''), '{$word}', ''))) DIV CHAR_LENGTH('{$word}')";
+$sql_hotlead = "SELECT id, status, hotlead_url, ticket_stop_reason_type,
+  CASE WHEN COALESCE(action_history, '') <> '' THEN 1 ELSE 0 END AS has_action,
+  {$countWord('架電')} AS action_calls,
+  {$countWord('メール')} AS action_mails,
+  {$countWord('SMS')} AS action_sms
+  FROM hotlead_db";
 $stmt_hotlead = $pdo->prepare($sql_hotlead);
 $stmt_hotlead->execute();
 $response_hotlead = $stmt_hotlead->fetchAll(PDO::FETCH_ASSOC);
@@ -122,7 +154,7 @@ $result = [
         "staff" => $response_staff,
         "shop" => $response_shop,
         "medium" => $response_medium,
-        "customer" => $response_customer,
+        "customer" => ['cols' => $customerCols, 'rows' => $customerRows],
         "family" => $response_family,
         "introductory" => $response_introductory,
         "event" => $response_event,
diff --git a/backend/src/index.php b/backend/src/index.php
index 1607ec1a9..5a33652c8 100644
--- a/backend/src/index.php
+++ b/backend/src/index.php
@@ -28,6 +28,10 @@ if ($request === '' || !preg_match('#^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*$#', $requ
     exit;
 }
 
+// ⚠️ v2.2.272: ログインの確認（core/request_auth.php）。⚠️ ② への転送より前（② が落ちて ① で処理するときも同じ確認を通す）
+require_once __DIR__ . '/core/request_auth.php';
+requestAuthGate($pdo, is_array($headers) ? $headers : [], $request);
+
 // ---------------------------------------------------------------------------
 // Express へ移植済みのリクエストは ② VPS へ転送する。
 //
diff --git a/frontend/src/components/header/system/SecurityLog.tsx b/frontend/src/components/header/system/SecurityLog.tsx
index 26f67d8aa..e8220ac80 100644
--- a/frontend/src/components/header/system/SecurityLog.tsx
+++ b/frontend/src/components/header/system/SecurityLog.tsx
@@ -16,7 +16,7 @@ import apiClient from '../../../utils/apiClient';
  * ─────────────────────────────────────────────
  */
 
-type EventKey = 'login' | 'login_failed' | 'logout' | 'auth_failed' | 'forbidden' | 'bad_request' | 'unknown_request' | 'server_error' | 'proxy_error';
+type EventKey = 'login' | 'login_failed' | 'logout' | 'auth_failed' | 'forbidden' | 'bad_request' | 'unknown_request' | 'server_error' | 'proxy_error' | 'auth_missing';
 
 interface LogRow {
     id: number;
@@ -63,6 +63,8 @@ const EVENTS: Record<EventKey, { label: string; tone: 'ok' | 'muted' | 'warn' |
     unknown_request: { label: '存在しない処理', tone: 'probe' },
     server_error: { label: 'サーバーエラー', tone: 'bad' },
     proxy_error: { label: '② に届かない', tone: 'bad' },
+    // ⚠️ v2.2.272: ① がトークン無しの要求を通して記録したもの（次の版でトークン必須にする前の洗い出し用）
+    auth_missing: { label: 'トークン無し（通した）', tone: 'muted' },
 };
 const EVENT_KEYS = Object.keys(EVENTS) as EventKey[];
 
diff --git a/frontend/src/components/photo/Form.tsx b/frontend/src/components/photo/Form.tsx
index 6864f11d6..02ff3f044 100644
--- a/frontend/src/components/photo/Form.tsx
+++ b/frontend/src/components/photo/Form.tsx
@@ -354,7 +354,8 @@ const Form = ({ editId, setEditId, setCategory, category }: Props) => {
                 // ⚠️ multipart は apiClient を通さない。既定ヘッダの
                 //   Content-Type: application/json が boundary を壊すため。
                 //   URL は k-snap/api/ から dashboard の API へ移した。
-                const response = await axios.post(KSNAP_API, fd);
+                // ⚠️ v2.2.272: トークンを付ける（① の入口でログインを確かめるため。Content-Type は付けない）
+                const response = await axios.post(KSNAP_API, fd, { headers: { Token: localStorage.getItem('token') ?? '' } });
 
                 if (response.data.status !== 'success') {
                     throw new Error(response.data.message ?? 'サーバーがエラーを返しました');
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 521773047..dbda84f51 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.271';
+export const newVersion = '2.2.272';
```

## 業務ガイド
- 記事「セキュリティログ」（common/screen-195.md）
  - 「記録される種類」に「**トークン無し（通した）**」を足した
  - 注意書きを足した：お客様の情報を返す処理は 2026年11月からログインが必須であること、ほかの処理もあとの版で必須にすること、その前にこの記録で止めてはいけない呼び出しを洗い出すこと

## テスト（ローカル。すべて ① localhost:8080 経由）
- トークン無し → cancelList・database（order・spec）・list・rank は 401、セキュリティログに auth_failed が残る
- 無効なトークン → cancelList は 401
- 有効なトークン（一時スタッフ 999999・Master）→ 上の処理はすべて 200（cancelList は 14.4MB を返す）
- login はトークン無しでも入口を通る（認証情報が無いので処理そのものは 401「ログインに失敗しました」）
- shop_list はトークン無しでも 200。セキュリティログに auth_missing（「トークンなし（通した）」）が残る。security_log_list で event=auth_missing に絞れる
- 顧客DB（注文）の予備
  - ② を止めて ① で処理：200・9,794,723 バイト・14.4秒。memory_limit は 128M で、超えなかった（以前は超えて落ちていた）
  - ② を直接呼んだ応答と**1バイトまで一致**。中身でも、顧客 27,167行・家族 3,701行・Hotlead 2,820行・担当 407行など、すべてのキーが一致
- Playwright（開発サーバー 3100）
  - 顧客DB（注文）が 26,590件で開く（② が処理）。ページのエラーなし
  - ② を止めても、① の予備だけで 26,590件で開く
  - セキュリティログ画面に「トークン無し（通した）」の行が出る
- 型チェック：frontend・backend-express とも通った。PHP は php -l で4ファイルとも通った
- リファクタリング：② の `AGGREGATE_EVENTS` に auth_missing を入れていなかった（「① と同じ」と書いてあるのに食い違っていた）のを直し、型チェック・① 経由・画面のテストをやり直して通った
- 後片付け：一時スタッフ 999999 を削除した。3100 番を停止した

## 未確認・残り
- K-Snap の写真登録は、本番データに書き込むので画面からは送っていない。k-snap_update は今回トークン必須の対象ではない（トークン無しでも通して記録するだけ）ので、付け忘れがあっても止まらない
- 段階2（全体を必須にする）は次の版。本番の「トークン無し（通した）」を1〜2週間見て、外部の request を `REQUEST_AUTH_PUBLIC` に足してから入れる
- staff.api_token は1人1つなので、別の端末でログインし直すと前の端末のトークンが無効になる。必須にした処理は、前の端末では 401 になる（② の処理ではもともと同じ動き）
