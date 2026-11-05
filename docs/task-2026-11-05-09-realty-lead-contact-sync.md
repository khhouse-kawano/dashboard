# 作業記録 v2.2.252　不動産企画係：反響の連絡先（contact）を電話・メールに合わせる

## 依頼
- 「今後の反響取込では contact にも値が入る？」への回答で見つけた抜けを直す（v2.2.251 はマージ済みのため v2.2.252 で）
  - 画面からの「反響を追加」（v2.2.247〜）と編集では、phone・mail だけを保存し、contact が空のまま・古いままになる
  - 架電キュー（`telOf`）・架電ナビは contact から電話番号を読むため、画面から登録した反響は「電話番号なし」、直した番号は古いまま出ていた
- アクセス解析の CV 数の調整は v2.2.253 に回す（利用者の指示）

## 経路ごとの contact（調査の結果）
| 経路 | contact |
|---|---|
| sync → ① `handlers/portal/*.php`（イエウール・イエイ・すまいステップ・アットホーム・SUUMO・HOME'S） | 入る（「電話 / メール」） |
| HOME'S 査定メール（② `homesAssessment.ts`） | 入る |
| 以前のアプリからの取り込み直し | 入る（以前のアプリの値） |
| 画面からの登録・編集 | **入らない／直らない → 今回直した** |

## 変えたもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/realty | **index.ts** | 追加：`LEAD_KINDS_WITH_CONTACT`・`has`・`trimStr`・**`withLeadContact`**。`runBrokerUpdate` で保存の前に通す |
| frontend/src/components/realty/callq | **callqLogic.ts** | 追加：`telIn`（もとの `telOf` の中身）。`telOf` は phone → contact の順に読む |
| frontend/src/components/realty/navi | **naviEngine.js** | `renderLeadBar` の電話番号を phone → contact の順に読む |
| frontend/src/utils | version.ts | 2.2.252 |
| backend/scripts/sql | **2026-11-05_realty_lead_contact_fill.sql**（新規） | 空の contact を「電話 / メール」で埋める（控えの表あり。何回流しても同じ） |
| backend/scripts/sql | **2026-11-05_update_log_2.2.252.sql**（新規） | 更新履歴＋業務ガイドの記事 |
| backend/scripts/guide/articles/common | screen-247.md | 記事「反響から商談案件へのつながり（不動産企画係）」の「反響を登録する」に2行（連絡先も入る・直る、架電キューの電話番号は「連絡先(電話)」を先に使う） |
| docs | realty-handoff.md | 版・進捗・次にやること（realty ③ は v2.2.254）・v2.2.252 で決まったこと |

- ⚠️ ① の PHP、`projects/sync`、GAS は変えていない
- ⚠️ ② の request は既存の `broker:update` だけ（express_proxy.php の変更なし）

## 決めたこと
- contact を作り直すのは、売り反響・買い反響（`leads`・`buyLeads`）で、phone か mail が**前の値から変わった**ときだけ
  - 編集画面はフェーズだけ変えても phone・mail を送る。そのたびに作り直すと、以前のアプリの連絡先にある2つ目の番号などの書き込みが消えるため
  - 新規登録（前の行が無い）は必ず作る
  - 画面が contact を送ってきたら、その値を使う（今は送る画面は無い）
  - phone・mail を両方消したら contact も空（NULL）
- 電話番号の正は phone。架電キュー・架電ナビは phone を先に読む（contact が古い番号のままの反響があるため。ローカルで contact に phone の番号が無い反響が68件）
- 埋める SQL は空の contact だけ。入っている contact は変えない

## テスト（ローカル）
- ① 経由（`localhost:8080`）
  - トークン無し `broker:update` → **401**
  - 新規登録（kind=leads、電話・メール） → contact「電話 / メール」
  - フェーズだけ（phone・mail は同じ値） → contact はそのまま（2つ目の番号の書き込みが残る）
  - 電話だけ変更 → 作り直す／メールだけ追加 → 前の電話と合わせる
  - contact を送ったとき → その値
  - 台帳（kind=ledger）で電話を変更 → contact は変えない
  - 電話・メールを両方消す → NULL
- SQL（`--safe-updates`。本番の安全更新モードと同じ）
  - 空の contact を埋める（電話とメール／メールのみ）、入っている contact は変えない、台帳は対象外、2回流しても同じ
  - ローカル（本番の写し）では埋める対象は 0 件（v2.2.247 以降に画面から登録した反響が無いため）
- Playwright（3100）：今日の架電キュー
  - contact が空・phone あり → 「☎ phone の番号」
  - contact が古い番号・phone は新しい番号 → 「☎ phone の番号」
  - 画面のエラー 0
- テストの行・一時スタッフ（id 999999）・控えの表は消した。開発サーバーは止めた
- リファクタリング：整理するものは無かった（テストはそのまま）

## 追加・修正した関数（全文）

### backend-express/src/features/realty/index.ts
```ts
/** 連絡先（contact）を「電話 / メール」で作り直す反響の種類（v2.2.252） */
const LEAD_KINDS_WITH_CONTACT = ['leads', 'buyLeads'];

const has = (o: Record<string, unknown>, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const trimStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/**
 * ⚠️ v2.2.252: 売り反響・買い反響で電話・メールが**変わったとき**、連絡先（contact）を「電話 / メール」に作り直す。
 * - 画面に連絡先の欄が無く、登録・編集で contact が空のまま・古いままになっていた（架電キュー・架電ナビ・重複判定が読む）
 * - ⚠️ 編集画面はフェーズだけ変えても phone・mail を送ってくる。値が前と同じなら作り直さない
 *   （以前のアプリから来た連絡先には、2つ目の電話番号などの書き込みがあるため残す）
 * - 画面が contact を送ってきたときは、その値を使う
 * - 形は sync（handlers/portal/*.php）・HOME'S 査定メール（homesAssessment.ts）と同じ「電話 / メール」
 */
const withLeadContact = async (id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> => {
  if (has(data, 'contact') || (!has(data, 'phone') && !has(data, 'mail'))) return data;
  const prev = (await query<DynamicRow>('SELECT kind, phone, mail FROM brokerage_listings WHERE `id` = ?', [id]))[0];
  const kind = trimStr(has(data, 'kind') ? data.kind : prev?.kind);
  if (!LEAD_KINDS_WITH_CONTACT.includes(kind)) return data;

  const phone = trimStr(has(data, 'phone') ? data.phone : prev?.phone);
  const mail = trimStr(has(data, 'mail') ? data.mail : prev?.mail);
  if (prev && phone === trimStr(prev.phone) && mail === trimStr(prev.mail)) return data;
  return { ...data, contact: [phone, mail].filter(Boolean).join(' / ') };
};
```
`runBrokerUpdate` の変更箇所:
```ts
  const data = await withLeadContact(id, body.data !== null && typeof body.data === 'object' && !Array.isArray(body.data)
    ? (body.data as Record<string, unknown>)
    : {});
```

### frontend/src/components/realty/callq/callqLogic.ts
```ts
/** 文字列の中の電話番号。⚠️ 全角の数字・ハイフンも読む */
const telIn = (s: string): string => {
    const z = s.replace(/[０-９－―ー−]/g, c => {
        const i = '０１２３４５６７８９'.indexOf(c);
        return i >= 0 ? String(i) : '-';
    });
    const m = z.match(/0\d[\d-]{7,}/);
    return m ? m[0] : '';
};

/**
 * 電話番号（telOf）。
 * ⚠️ v2.2.252: 電話番号の欄（phone）を先に読み、無ければ連絡先（contact）から拾う。
 *   画面で直した番号は phone に入る。contact は以前のアプリの古い番号のままのことがある
 */
export const telOf = (l: Row): string => telIn(str(l.phone)) || telIn(str(l.contact));
```

### frontend/src/components/realty/navi/naviEngine.js（renderLeadBar の1行）
```js
 // ⚠️ v2.2.252: 電話番号の欄（phone）を先に読み、無ければ連絡先（contact）から拾う（callqLogic.ts の telOf と同じ順）
 const m=[l.phone,l.contact].map(v=>String(v||'').replace(/[０-９]/g,d=>String.fromCharCode(d.charCodeAt(0)-65248)).replace(/[－―ー−]/g,'-').match(/0\d[\d\-]{7,}/)).find(Boolean);
```

## 新規ファイル（全文）

### backend/scripts/sql/2026-11-05_realty_lead_contact_fill.sql
```sql
-- =====================================================================
-- v2.2.252 不動産企画係：売り反響・買い反響の連絡先（contact）が空のものを「電話 / メール」で埋める
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何回流しても同じ（空の連絡先だけを埋める）
-- ⚠️ 対象: v2.2.247 からの「反響を追加」で登録した反響など、電話・メールはあるが連絡先が空のもの
--   入っている連絡先は変えない（以前のアプリの書き込みを残す）
-- ⚠️ 安全更新モード（ERROR 1175）でも通るよう、WHERE に主キーの範囲（internal_id > 0）を入れる
-- ⚠️ 電話番号・メールアドレスそのものは出さない（件数だけ）
-- =====================================================================

-- 0. 確認（前）
SELECT kind,
  SUM(IFNULL(contact,'') = '' AND (IFNULL(phone,'') <> '' OR IFNULL(mail,'') <> '')) AS `連絡先を埋められる`,
  COUNT(*) AS `件数`
FROM brokerage_listings WHERE kind IN ('leads','buyLeads') GROUP BY kind;

-- 1. 控え（直す行の、直す前の値）
CREATE TABLE IF NOT EXISTS brokerage_listings_bk_20261105_contact_fill AS
SELECT internal_id, id, kind, contact FROM brokerage_listings WHERE 1 = 0;

INSERT INTO brokerage_listings_bk_20261105_contact_fill (internal_id, id, kind, contact)
SELECT b.internal_id, b.id, b.kind, b.contact FROM brokerage_listings b
WHERE b.kind IN ('leads','buyLeads')
  AND IFNULL(b.contact,'') = ''
  AND (IFNULL(b.phone,'') <> '' OR IFNULL(b.mail,'') <> '')
  AND b.internal_id NOT IN (SELECT internal_id FROM brokerage_listings_bk_20261105_contact_fill);

-- 2. 埋める（形は sync・HOME'S 査定メールと同じ「電話 / メール」）
UPDATE brokerage_listings
SET contact = CONCAT_WS(' / ', NULLIF(TRIM(phone),''), NULLIF(TRIM(mail),''))
WHERE internal_id > 0
  AND kind IN ('leads','buyLeads')
  AND IFNULL(contact,'') = ''
  AND (IFNULL(phone,'') <> '' OR IFNULL(mail,'') <> '');

-- 3. 確認（後）：「連絡先を埋められる」が 0 なら済み
SELECT kind,
  SUM(IFNULL(contact,'') = '' AND (IFNULL(phone,'') <> '' OR IFNULL(mail,'') <> '')) AS `連絡先を埋められる`,
  COUNT(*) AS `件数`
FROM brokerage_listings WHERE kind IN ('leads','buyLeads') GROUP BY kind;
SELECT COUNT(*) AS `控えた行` FROM brokerage_listings_bk_20261105_contact_fill;

-- 戻すとき（埋めた連絡先を空に戻す）:
-- UPDATE brokerage_listings SET contact = NULL
-- WHERE internal_id > 0 AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_contact_fill);
-- しばらくして問題が無ければ控えを消す:
-- DROP TABLE brokerage_listings_bk_20261105_contact_fill;
```

### backend/scripts/sql/2026-11-05_update_log_2.2.252.sql（冒頭。末尾は build-guide-sql.cjs が出した記事の SQL）
```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.252', '2026-11-05', '不動産企画係の売り反響・買い反響で、画面から登録・編集した電話番号・メールアドレスが連絡先の欄にも入るようにした。架電キューで電話番号が出なかった・古い番号が出ていたのを直した。');
```

## git diff（コード）
```diff
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
@@ -195,6 +195,32 @@ const toSqlValue = (value: unknown): SqlValue => {
   return String(value);
 };
 
+/** 連絡先（contact）を「電話 / メール」で作り直す反響の種類（v2.2.252） */
+const LEAD_KINDS_WITH_CONTACT = ['leads', 'buyLeads'];
+
+const has = (o: Record<string, unknown>, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
+const trimStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
+
+/** （上の全文と同じ） */
+const withLeadContact = async (id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> => {
+  if (has(data, 'contact') || (!has(data, 'phone') && !has(data, 'mail'))) return data;
+  const prev = (await query<DynamicRow>('SELECT kind, phone, mail FROM brokerage_listings WHERE `id` = ?', [id]))[0];
+  const kind = trimStr(has(data, 'kind') ? data.kind : prev?.kind);
+  if (!LEAD_KINDS_WITH_CONTACT.includes(kind)) return data;
+
+  const phone = trimStr(has(data, 'phone') ? data.phone : prev?.phone);
+  const mail = trimStr(has(data, 'mail') ? data.mail : prev?.mail);
+  if (prev && phone === trimStr(prev.phone) && mail === trimStr(prev.mail)) return data;
+  return { ...data, contact: [phone, mail].filter(Boolean).join(' / ') };
+};
+
@@ -203,9 +229,9 @@ export const runBrokerUpdate = async (body: Record<string, unknown>): Promise<Re
-  const data = body.data !== null && typeof body.data === 'object' && !Array.isArray(body.data)
+  const data = await withLeadContact(id, body.data !== null && typeof body.data === 'object' && !Array.isArray(body.data)
     ? (body.data as Record<string, unknown>)
-    : {};
+    : {});

diff --git a/frontend/src/components/realty/callq/callqLogic.ts b/frontend/src/components/realty/callq/callqLogic.ts
-/** 電話番号（telOf）。⚠️ 全角の数字・ハイフンも読む */
-export const telOf = (l: Row): string => {
-    const z = str(l.contact).replace(/[０-９－―ー−]/g, c => {
+/** 文字列の中の電話番号。⚠️ 全角の数字・ハイフンも読む */
+const telIn = (s: string): string => {
+    const z = s.replace(/[０-９－―ー−]/g, c => {
         const i = '０１２３４５６７８９'.indexOf(c);
         return i >= 0 ? String(i) : '-';
     });
@@
     return m ? m[0] : '';
 };
 
+/**
+ * 電話番号（telOf）。
+ * ⚠️ v2.2.252: 電話番号の欄（phone）を先に読み、無ければ連絡先（contact）から拾う。
+ *   画面で直した番号は phone に入る。contact は以前のアプリの古い番号のままのことがある
+ */
+export const telOf = (l: Row): string => telIn(str(l.phone)) || telIn(str(l.contact));

diff --git a/frontend/src/components/realty/navi/naviEngine.js b/frontend/src/components/realty/navi/naviEngine.js
- const m=String(l.contact||'').replace(/[０-９]/g,d=>String.fromCharCode(d.charCodeAt(0)-65248)).replace(/[－―ー−]/g,'-').match(/0\d[\d\-]{7,}/);
+ // ⚠️ v2.2.252: 電話番号の欄（phone）を先に読み、無ければ連絡先（contact）から拾う（callqLogic.ts の telOf と同じ順）
+ const m=[l.phone,l.contact].map(v=>String(v||'').replace(/[０-９]/g,d=>String.fromCharCode(d.charCodeAt(0)-65248)).replace(/[－―ー−]/g,'-').match(/0\d[\d\-]{7,}/)).find(Boolean);

diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
-export const newVersion = '2.2.251';
+export const newVersion = '2.2.252';

diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
+- 入れた電話番号・メールアドレスは、一覧の「連絡先」にも「電話 / メール」の形で入ります。あとで編集画面で電話番号・メールアドレスを直したときも、連絡先は同じ形に作り直されます（電話番号・メールアドレスを変えずに保存したときは、連絡先はそのままです）
+- 今日の架電キュー・架電ナビに出る電話番号は、反響の「連絡先(電話)」を先に使います。空のときは連絡先から拾います
```

## 業務ガイド
- 記事「反響から商談案件へのつながり（不動産企画係）」（common/screen-247.md）
  - 「反響を登録する」に、連絡先にも電話・メールが入り編集で直ること、架電キュー・架電ナビの電話番号は「連絡先(電話)」を先に使うことを足した
  - SQL は `2026-11-05_update_log_2.2.252.sql` の末尾。ローカルに流した
