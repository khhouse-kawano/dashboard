# 作業記録 2026-11-05-08　v2.2.251 売り反響・買い反響の電話番号・メールアドレス

## 依頼
- 売り反響・買い反響で、電話番号とメールアドレスが取れていない顧客が多い。テーブル・API・`projects/sync` を確認して、原因を切り分け、遡って取得する
- 追加の指示：GAS と `projects/sync` は書き換えたくない。API を直し、データを書き換える SQL を用意する
- 「251を着手」（アクセス解析の CV の改修は v2.2.252 に回す）

## 原因の切り分け（ローカル＝本番の写し）
| 経路 | 結果 |
|---|---|
| **以前のアプリから取り込んだ反響**（売り907件・買い194件。ほぼ全件） | **原因**。以前のアプリは連絡先が `contact`（「電話 / メール」）の1欄だけで、取り込み（② `importer.ts`）は contact だけを写した。`phone`・`mail` は空 |
| sync → ① `handlers/portal/*.php`（イエウール・イエイ・すまいステップ・アットホーム・SUUMO・HOME'S） | 問題なし。`phone`・`mail`・`contact` を入れている |
| HOME'S の査定メール（② `homesAssessment.ts`） | 問題なし。3つとも入れている |
| 画面からの登録（v2.2.247〜） | 問題なし |

- 画面（一覧・編集画面）は `phone`・`mail` を見るため、「取れていない」ように見えていた
- contact の形はほぼ「電話 / メール」。中に、先頭の0が落ちた10桁（「9012345678」）が37件あった（表計算で数として扱われたとみられる）
- `contact` も空の反響（売り11件・買い13件）は、取り込み元にも連絡先が無い

## 変えたこと
- **新規** `backend/scripts/sql/2026-11-05_realty_lead_contact_split.sql`（① で1回）
  - 控えの表 `brokerage_listings_bk_20261105_contact` を作る
  - 作業用の表に、取り出した値を入れる（同じ式を何度も書かないため。最後に消す）
  - phone・mail が空の行だけを UPDATE する
  - 安全更新モードでも通る形にした（`internal_id > 0 AND internal_id IN (…)` と副問い合わせ。JOIN の UPDATE は安全更新モードで止まる）
- **新規** `backend-express/src/features/realty/contactSplit.ts`：`phoneFromContact`・`mailFromContact`（SQL と同じ取り出し方）
  - 電話：メールの部分を除き、最初の数字とハイフン類のかたまりを数字だけにする
    - 0から始まる10〜11桁なら、そのまま
    - 50・70・80・90から始まる10桁なら、0を足す
    - それ以外は入れない
- `backend-express/src/features/realty/importer.ts`（`runImportRecords`）
  - 売り反響・買い反響で、ファイルに phone・mail が無く contact があれば、取り出して入れる
  - すでに値がある行は上書きしない（`IF(IFNULL(col,'')='', VALUES(col), col)`）
- 版：2.2.251。update_log の SQL：`2026-11-05_update_log_2.2.251.sql`（ローカル no=350）
- 画面・① PHP・`projects/sync`・GAS は変えていない

## テスト
- SQL（ローカル。安全更新モードを入れて流した）
  - 最初の版は、先頭の0が落ちた番号から、途中の「0」で始まる誤った9桁を取り出していた → 取り出し方を直した
  - JOIN の UPDATE と、主キーの IN だけの条件は、安全更新モードで止まった（ERROR 1175）→ `internal_id > 0` を足した
  - 結果
    - 売り反響：電話の空 894件 → 15件、メールの空 894件 → 59件
    - 買い反響：電話の空 187件 → 21件、メールの空 182件 → 17件
    - 入れた電話はすべて0から始まる10〜11桁
  - 入っていた値が変わった行：0件。2回目は何も変わらない。作業用の表は消えている
- TypeScript と SQL の取り出し方の突き合わせ：2,157か所で一致、不一致0
- ① を通した取り込み（架空の値）
  - トークン無し → 401
  - 0の落ちた番号に0が足され、メールも入った
  - 電話が入っていた行は上書きされず、空のメールだけが入った
  - 電話の形が無い連絡先は空のまま
  - 台帳には触れていない
- Playwright：売り反響・買い反響の一覧の連絡先の欄に、電話・メールが出る（件数だけを数えた）。ページのエラー 0
- 後片付け：テストの行・仮スタッフを消した。開発サーバーを止めた

## 反省（記録）
- ブランチを切ったあと、update_log の SQL を作らずに作業を進め、ローカルの画面が真っ白になった（4度目）
  - 利用者から「ブランチを切って必ず最初にすること」と指摘を受けた
  - メモを強めた。次からは、ブランチを切る同じ操作の中で次の4つまで行う
    - version.ts を書き換える
    - SQL を作る
    - ローカルに流す
    - 確認する

## 新規ファイルの全文
### backend-express/src/features/realty/contactSplit.ts
```ts
/**
 * 売り反響・買い反響の連絡先（contact「電話 / メール」）から、電話番号とメールアドレスを取り出す（v2.2.251）。
 *
 * ─────────────────────────────────────────────
 *   以前のアプリには連絡先の欄が contact の1つしか無く、取り込み（importer.ts）は contact だけを写していた。
 *   Dashboard の一覧・編集画面は phone・mail の列を見るので、取り込みのときに phone・mail も入れる。
 *
 *   電話 … メールアドレスの部分を除き、最初の「数字とハイフン類のかたまり」を数字だけにする
 *          0 から始まる 10〜11桁ならそのまま。50・70・80・90 から始まる 10桁は、先頭の 0 が落ちた携帯・IP電話とみて 0 を足す。
 *          それ以外の形は '' （入れない）
 *   メール … メールアドレスの形の最初のもの
 * ─────────────────────────────────────────────
 *
 * ⚠️ backend/scripts/sql/2026-11-05_realty_lead_contact_split.sql（今あるデータを直す SQL）と同じ取り出し方。⚠️ どちらかを変えたら両方を変える
 */

const MAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}/;
const MAIL_PATTERN_ALL = new RegExp(MAIL_PATTERN.source, 'g');
/** 数字とハイフン類のかたまり（SQL の '[0-9][-‐－⁻ー−0-9]{7,14}[0-9]' と同じ） */
const PHONE_RUN = /[0-9][-‐－⁻ー−0-9]{7,14}[0-9]/;

export const phoneFromContact = (contact: unknown): string => {
  const text = String(contact ?? '').replace(MAIL_PATTERN_ALL, ' ');
  const digits = (text.match(PHONE_RUN)?.[0] ?? '').replace(/[^0-9]/g, '');
  if (/^0[0-9]{9,10}$/.test(digits)) return digits;
  if (/^[5789]0[0-9]{8}$/.test(digits)) return `0${digits}`;
  return '';
};

export const mailFromContact = (contact: unknown): string => String(contact ?? '').match(MAIL_PATTERN)?.[0] ?? '';
```
### backend/scripts/sql/2026-11-05_realty_lead_contact_split.sql
```sql
-- =====================================================================
-- v2.2.251 不動産企画係：売り反響・買い反響の電話番号・メールアドレスを、連絡先（contact）から入れる
--
--   原因：以前のアプリには連絡先の欄が contact の1つ（「電話 / メール」）しか無く、取り込みは contact だけを写した。
--         Dashboard の一覧・編集画面は phone・mail の列を見るので、ほぼ全件が「取れていない」ように見えていた。
--         （sync → ① handlers/portal/*.php・HOME'S の査定メール・画面からの登録は、phone・mail も入れている）
--
--   ・phone が空の行 … contact からメールアドレスの部分を除き、最初の「数字とハイフン類のかたまり」を数字だけにして入れる
--       0 から始まる 10〜11桁ならそのまま。50・70・80・90 から始まる 10桁は、先頭の 0 が落ちた携帯・IP電話とみて 0 を足す
--       （以前の取り込みに「9012345678」の形が 37件あった。表計算で数として扱われて 0 が消えたとみられる）。それ以外の形は入れない
--   ・mail が空の行  … contact の中のメールアドレスの形の最初のものを入れる
--   ・入っている値は変えない。contact も変えない
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 何回流しても同じ（2回目は何も変わらない）
-- ⚠️ 安全更新モード（ERROR 1175）でも通るよう、UPDATE の条件に主キー（internal_id）を入れている
-- ⚠️ 取り出し方は ② の features/realty/contactSplit.ts（phoneFromContact・mailFromContact）と同じ。⚠️ どちらかを変えたら両方を変える
-- ⚠️ 確認の SELECT は件数だけ（電話番号・メールアドレスは画面に出さない）
-- =====================================================================

-- 0. 直す前の値の控え（戻すときに使う。2回目以降は作らない）
CREATE TABLE IF NOT EXISTS brokerage_listings_bk_20261105_contact AS
  SELECT internal_id, id, kind, phone, mail
    FROM brokerage_listings
   WHERE kind IN ('leads', 'buyLeads');

-- 1. 作業用の表に、contact から取り出した値を入れる（同じ式を何度も書かないため。⚠️ 最後に消す）
--    ⚠️ 一時表（TEMPORARY）にしないのは、1つの UPDATE の中で2回読むため（一時表は2回開けない）
DROP TABLE IF EXISTS work_20261105_contact_split;
CREATE TABLE work_20261105_contact_split AS
  SELECT x.internal_id,
         CASE
           WHEN x.digits REGEXP '^0[0-9]{9,10}$' THEN x.digits
           WHEN x.digits REGEXP '^[5789]0[0-9]{8}$' THEN CONCAT('0', x.digits)
           ELSE ''
         END AS phone_new,
         x.mail_new
    FROM (
      SELECT internal_id,
             REGEXP_REPLACE(
               IFNULL(REGEXP_SUBSTR(
                 REGEXP_REPLACE(IFNULL(contact, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}', ' '),
                 '[0-9][-‐－⁻ー−0-9]{7,14}[0-9]'), ''),
               '[^0-9]', '') AS digits,
             IFNULL(REGEXP_SUBSTR(IFNULL(contact, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}'), '') AS mail_new
        FROM brokerage_listings
       WHERE kind IN ('leads', 'buyLeads')
    ) x;

-- 確認（前）
SELECT b.kind,
       COUNT(*) AS 件数,
       SUM(IFNULL(b.phone, '') = '') AS 電話が空,
       SUM(IFNULL(b.mail, '') = '') AS メールが空,
       SUM(IFNULL(b.phone, '') = '' AND t.phone_new <> '') AS 電話を入れられる,
       SUM(IFNULL(b.mail, '') = '' AND t.mail_new <> '') AS メールを入れられる
  FROM brokerage_listings b JOIN work_20261105_contact_split t ON t.internal_id = b.internal_id
 GROUP BY b.kind;

-- 2. 電話番号（⚠️ 安全更新モードでは JOIN の UPDATE が止まるので、主キーの IN と、副問い合わせで入れる）
UPDATE brokerage_listings
   SET phone = (SELECT t.phone_new FROM work_20261105_contact_split t WHERE t.internal_id = brokerage_listings.internal_id)
 WHERE internal_id > 0
   AND internal_id IN (SELECT t.internal_id FROM work_20261105_contact_split t WHERE t.phone_new <> '')
   AND IFNULL(phone, '') = '';

-- 3. メールアドレス
UPDATE brokerage_listings
   SET mail = (SELECT t.mail_new FROM work_20261105_contact_split t WHERE t.internal_id = brokerage_listings.internal_id)
 WHERE internal_id > 0
   AND internal_id IN (SELECT t.internal_id FROM work_20261105_contact_split t WHERE t.mail_new <> '')
   AND IFNULL(mail, '') = '';

-- 確認（後）: 「電話を入れられる」「メールを入れられる」が 0 ならよい
--   「連絡先も無い」は取り込み元にも連絡先が無い反響（取り戻せない）
--   「連絡先はあるが電話の形でない」は、桁が足りないなど（電話は入れていない。必要なら画面で直す）
SELECT b.kind,
       COUNT(*) AS 件数,
       SUM(IFNULL(b.phone, '') = '') AS 電話が空,
       SUM(IFNULL(b.mail, '') = '') AS メールが空,
       SUM(IFNULL(b.phone, '') = '' AND t.phone_new <> '') AS 電話を入れられる,
       SUM(IFNULL(b.mail, '') = '' AND t.mail_new <> '') AS メールを入れられる,
       SUM(IFNULL(b.contact, '') = '') AS 連絡先も無い,
       SUM(IFNULL(b.phone, '') = '' AND IFNULL(b.contact, '') REGEXP '[0-9]{4}') AS 連絡先はあるが電話の形でない
  FROM brokerage_listings b JOIN work_20261105_contact_split t ON t.internal_id = b.internal_id
 GROUP BY b.kind;

DROP TABLE IF EXISTS work_20261105_contact_split;

-- 戻すとき（必要なときだけ。⚠️ ふだんは流さない）
-- UPDATE brokerage_listings b JOIN brokerage_listings_bk_20261105_contact k ON k.internal_id = b.internal_id
--    SET b.phone = k.phone, b.mail = k.mail WHERE b.internal_id > 0;
-- 戻す必要が無くなったら、控えの表を消す
-- DROP TABLE brokerage_listings_bk_20261105_contact;
```

## 変更の差分（git diff）
```diff
diff --git a/backend-express/src/features/realty/importer.ts b/backend-express/src/features/realty/importer.ts
index 6d9244e31..900ae889e 100644
--- a/backend-express/src/features/realty/importer.ts
+++ b/backend-express/src/features/realty/importer.ts
@@ -1,6 +1,7 @@
 import type { RowDataPacket } from 'mysql2/promise';
 import { executeLarge, query, withTransaction } from '../../db/pool';
 import type { Result } from './index';
+import { mailFromContact, phoneFromContact } from './contactSplit';
 
 /**
  * 以前の不動産企画係アプリ（khf-eigyokanri.netlify.app）のバックアップを取り込む（v2.2.224。② だけ。マスターだけ）。
@@ -25,6 +26,8 @@ import type { Result } from './index';
  *     ⚠️ v2.2.225: 全面差し替え（hideScope = all）では、Dashboard で入った行もファイルに無ければ非表示（HideScope の注記）
  * ⚠️ Dashboard だけの列（show_dashboard・deleted_*・master_data_id・property_db_*）は取り込みで上書きしない。
  *   ⚠️ ただし、この取り込みで非表示にした行がファイルに戻ってきたら、表示に戻す。
+ * ⚠️ v2.2.251: 売り反響・買い反響は、連絡先（contact「電話 / メール」）から電話番号（phone）・メールアドレス（mail）も入れる
+ *   （contactSplit.ts）。⚠️ ただし、すでに phone・mail が入っている行（Dashboard で直した・sync が入れた）は上書きしない
  * ─────────────────────────────────────────────
  */
 
@@ -358,8 +361,19 @@ export const runImportRecords = async (body: Record<string, unknown>): Promise<R
         row.extId = null;
         warn('ファイルの中で反響番号が重複しているため、反響番号の列は空にしました（原本には残っています）');
       }
+      // ⚠️ v2.2.251: 反響の電話・メールは、ファイルに無ければ連絡先から取り出す。入っている値は上書きしない（下の updates）
+      const fillOnly = new Set<string>();
+      if ((rec.kind === 'leads' || rec.kind === 'buyLeads') && row.contact != null) {
+        for (const [col, value] of [['phone', phoneFromContact(row.contact)], ['mail', mailFromContact(row.contact)]] as const) {
+          if ((row[col] == null || row[col] === '') && value !== '') {
+            row[col] = value;
+            fillOnly.add(col);
+          }
+        }
+      }
       const cols = Object.keys(row);
-      const updates = cols.filter((c) => c !== 'id').map((c) => `\`${c}\` = VALUES(\`${c}\`)`);
+      const updates = cols.filter((c) => c !== 'id').map((c) =>
+        fillOnly.has(c) ? `\`${c}\` = IF(IFNULL(\`${c}\`, '') = '', VALUES(\`${c}\`), \`${c}\`)` : `\`${c}\` = VALUES(\`${c}\`)`);
       // ⚠️ この取り込みで非表示にした行が戻ってきたら表示に戻す。⚠️ deleted_by は最後に（左から順に評価される）
       updates.push(
         'show_dashboard = IF(deleted_by IN (?, ?), 1, show_dashboard)',
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 7f6ccf105..1ef7574b0 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.250';
+export const newVersion = '2.2.251';
```
