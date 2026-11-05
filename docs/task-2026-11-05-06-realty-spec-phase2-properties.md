# 作業記録 2026-11-05-06　v2.2.250 不動産企画係：連動トリガー仕様書の ② のうち媒介物件

## 依頼
- 「続きを」 → v2.2.250（仕様書 ② の媒介物件の表）
- 利用者の決定（AskUserQuestion）
  - 媒介紐付の画面に、物件の項目を足す。マンションは建物名を必須にする
  - 今ある台帳から、SQL を1回流して媒介物件を作る
  - 突き合わせは、住所と種別で行う。地番は任意で持ち、入っていれば優先する
- 計画を見せ、「進めてよい」の了承を得てから実装した

## 調べたこと
- 台帳（有効196件）
  - 住所：市区町村は187件、番地は186件。種別は194件
  - 同じ住所の台帳が3組あった
- 売り反響（967件中433件）：一括査定の詳細（`raw_data.detail`）がある
  - msName（マンション名）・room（部屋）・land（土地面積）・area（建物面積）・built（築年）・layout（間取り）
- 地番は、どのデータにも無い

## 変えたこと
### DB（① SQL）
- **新規** `backend/scripts/sql/2026-11-05_realty_properties_1_schema.sql`
  - 表 `realty_properties` を作る。`match_key` は utf8mb4_bin の UNIQUE。表の照合順序は brokerage_listings と同じ utf8mb4_unicode_ci
  - `brokerage_listings.propertyId` の列と、その索引を足す
- **新規（作ったもの）** `backend/scripts/sql/2026-11-05_realty_properties_2_migrate.sql`：今ある台帳の移し替え
  - `backend/scripts/realty/build-property-sql.cjs` で作った（手で直さない）
  - 物件の ID は、`p` ＋ 突き合わせ用の文字列の MD5 の先頭16桁。何回流しても同じ結果になる

### ②（VPS）
- **新規** `backend-express/src/features/realty/propertyKeyRules.json`：住所の揺れをそろえる置き換え。② と SQL を作るスクリプトの両方がこれを読む
  - 空白・全角数字・ダッシュの類・県名（鹿児島・宮崎・熊本）
  - 「一丁目〜十丁目」を「1-〜10-」、「丁目・番地・番」を「-」、「号」を消す、「--」を「-」
- **新規** `backend-express/src/features/realty/propertyKey.ts`
  - `normPlace`（そろえて、最後の「-」を落とす）
  - `fullAddress`（addr2 が addr1 から始まれば addr2 だけ、ほかは addr1＋addr2）
  - `propertyKeyOf`
    - 地番がある：種別|c:地番
    - マンションで建物名がある：種別|a:住所|建物名|部屋
    - それ以外：種別|a:住所
    - **住所に数字（番地）が無い：末尾に |u:台帳 ID を付けて、ほかとまとめない**
  - `isUniqueKey`
- `backend-express/src/features/realty/ledgerLink.ts`（`planner:ledger_link`）
  - form に、地番・建物名・部屋番号・土地面積・建物面積・築年・間取りを足した。面積は `areaOf` で数にする
  - 前提条件に「マンションのときは建物名」を足した
  - 同じトランザクションの中で、次を行う
    - 物件を `match_key` で `FOR UPDATE` で探し、無ければ INSERT する
    - 台帳の INSERT と売り反響の UPDATE に、`propertyId` を入れる
  - 応答に `property: { id, isNew, pastLedgers }` を足した
  - 整理：はじめは台帳を作ったあとに、`propertyId` だけを別の UPDATE で入れていた。物件を先に決めて、台帳の INSERT 1回で済むようにした

### フロント
- `frontend/src/components/realty/common/leadLinks.ts`
  - `LedgerForm` に物件の7項目を足した
  - `detailOf`：raw_data.detail から読む。`ledgerFormOf` で初期値を入れる
  - 前提条件に「マンションのときは建物名」を足した
  - 型 `LinkedProperty` を足し、`LedgerLinkResult.property` を足した
- `frontend/src/components/realty/common/LedgerLinkModal.tsx`
  - 「媒介物件」の欄を足した（建物名は、マンションのとき必須の印）
  - 登録のあとに「新しい物件として登録しました」か「以前の台帳と同じ物件に紐づけました（台帳 No.○）」を出す
- `frontend/src/components/database/DatabaseBroker.tsx`
  - `propertyId` ごとに台帳 No. を数え（`ledgerNosByProperty`）、2件以上なら住所の横に「同じ物件の台帳 N件」を出す。押すと No. を並べる

### そのほか
- 版：2.2.250
- SQL：`2026-11-05_update_log_2.2.250.sql`（update_log とガイド）。ローカルに流した（no=349）
- 業務ガイド：`common/screen-247.md`
  - 媒介紐付の手順に、マンションの建物名と物件の欄を足した
  - 「媒介物件（同じ物件の履歴）」の節を足した

## テスト
- 移し替えの SQL（ローカル）
  - 最初の版は、照合順序が合わずに確認の SELECT でエラーになった → 表を brokerage_listings と同じ設定にして直した
  - 番地の無い「鹿児島市」4件・「南さつま市」2件が、1つにまとまってしまった → 番地が無ければその台帳だけの物件にする決まりを足した（② と SQL の両方）
  - 結果：物件194件。有効な台帳は196件中196件、売り反響は32件がつながった。同じ物件に台帳が2件あるのは2組
  - 2回流しても同じ結果
- ② の TypeScript の計算と SQL の計算を、全196件で突き合わせた：一致196、不一致0
- ① を通した確認：トークン無しの `planner:ledger_link` → 401
- Playwright（3100・Master）
  - A：全角で「２９７７番地１」と書いた住所 → 既存の物件（台帳 No.3・No.199）に紐づいた。反響と台帳の propertyId が同じ
  - B：マンションで、詳細の値（建物名・部屋・72.5・2005・3LDK）が入った状態で開いた
    - 建物名を空にすると止まった
    - 入れ直すと新しい物件ができた（キーは 種別|a:住所|建物名|305）
  - C：「鹿児島市」だけの住所 → 新しい物件（キーの末尾に |u:）
  - 一覧：「同じ物件の台帳 3件」（No.3・199・218）が出て、押すと No. が出た
  - ページのエラー：0
- 整理のあと
  - v2.2.250 のテストをもう一度流した
  - v2.2.248 のテスト（媒介紐付の必須・1トランザクション・リンク・編集画面）も流した
    - B（マンション）は、建物名が必須になったので、テストで建物名を入れるようにした
  - すべて通った
- 後片付け
  - テストの行・台帳・履歴・物件と、仮スタッフを消した（2,986件、台帳の最大 No.217、物件194件、行き先の無い紐づけ0件）
  - 開発サーバーを止めた

## 残したこと
- 物件の一覧の画面と、台帳の編集画面で物件の情報を参照して出すこと
- 買取案件との紐づけ（④）
- 住所の揺れのうち、漢数字の番地・「の」書き・建物名の表記違いは、そろえていない

## 新規ファイルの全文
### backend-express/src/features/realty/propertyKey.ts
```
import rules from './propertyKeyRules.json';

/**
 * 媒介物件の「同じ物件か」の突き合わせ（v2.2.250。連動トリガー仕様書 ②）。
 *
 * ─────────────────────────────────────────────
 *   突き合わせ用の文字列（match_key）＝ 種別 | 場所
 *     地番があるとき       … 種別|c:地番
 *     マンション（建物名あり）… 種別|a:住所|建物名|部屋番号
 *     それ以外             … 種別|a:住所
 *   住所・地番・建物名・部屋番号は、propertyKeyRules.json の置き換えでそろえ、最後の「-」を落とす
 * ─────────────────────────────────────────────
 *
 * ⚠️ 移し替えの SQL（backend/scripts/realty/build-property-sql.cjs が作る）も同じ規則で作る。⚠️ どちらかだけを変えない。
 * ⚠️ 2026-11-05 の利用者の決定: 住所＋種別で突き合わせる（地番は任意で持ち、あれば優先）。マンションは建物名＋部屋番号も。
 */

const REPLACE: [string, string][] = rules.replace.map(([from, to]) => [from, to]);

/** 書き方の揺れをそろえる（置き換えを順に・最後の「-」を落とす） */
export const normPlace = (v: unknown): string => {
  let s = String(v ?? '');
  for (const [from, to] of REPLACE) s = s.split(from).join(to);
  return s.replace(/-+$/, '');
};

/** 台帳の住所（市区町村 addr1 と番地まで addr2）を1つに。⚠️ addr2 が市区町村から始まっていれば addr2 だけ（重ねない） */
export const fullAddress = (addr1: unknown, addr2: unknown): string => {
  const a1 = String(addr1 ?? '');
  const a2 = String(addr2 ?? '');
  return a2.startsWith(a1) ? a2 : `${a1}${a2}`;
};

export type PlaceInput = { category: string; addr: string; chiban?: string; buildingName?: string; roomNo?: string };

/**
 * @param uniqueId 場所が見分けられないとき（地番・建物名が無く、住所に数字＝番地が無い）に付ける ID（台帳の ID）。
 *   ⚠️ 「鹿児島市」だけの住所どうしを同じ物件にまとめないため。その台帳だけの物件になる（キーの末尾 |u:ID）
 */
export const propertyKeyOf = (p: PlaceInput, uniqueId: string): string => {
  const cat = String(p.category ?? '');
  const chiban = normPlace(p.chiban);
  if (chiban) return `${cat}|c:${chiban}`;
  const addr = normPlace(p.addr);
  const building = normPlace(p.buildingName);
  if (cat === 'マンション' && building) return `${cat}|a:${addr}|${building}|${normPlace(p.roomNo)}`;
  if (!/[0-9]/.test(addr)) return `${cat}|a:${addr}|u:${uniqueId}`;
  return `${cat}|a:${addr}`;
};

/** 突き合わせ用の文字列が、ほかの物件とまとめないもの（場所が見分けられない）か */
export const isUniqueKey = (key: string): boolean => key.includes('|u:');
```
### backend-express/src/features/realty/propertyKeyRules.json
```
{
  "_comment": "媒介物件の突き合わせで、住所・地番・建物名・部屋番号の書き方の揺れをそろえる置き換え（v2.2.250）。上から順に、すべての出現を置き換える。⚠️ propertyKey.ts（②）と backend/scripts/realty/build-property-sql.cjs（移し替えの SQL）がこの1つを読む。⚠️ 変えたら、移し替えの SQL を作り直す（すでに作った物件の突き合わせ用の文字列は変わらないので、変えるときは利用者と相談）",
  "replace": [
    [" ", ""], ["　", ""], ["\t", ""],
    ["０", "0"], ["１", "1"], ["２", "2"], ["３", "3"], ["４", "4"], ["５", "5"], ["６", "6"], ["７", "7"], ["８", "8"], ["９", "9"],
    ["－", "-"], ["ー", "-"], ["‐", "-"], ["−", "-"], ["–", "-"], ["—", "-"], ["―", "-"], ["ｰ", "-"],
    ["鹿児島県", ""], ["宮崎県", ""], ["熊本県", ""],
    ["一丁目", "1-"], ["二丁目", "2-"], ["三丁目", "3-"], ["四丁目", "4-"], ["五丁目", "5-"], ["六丁目", "6-"], ["七丁目", "7-"], ["八丁目", "8-"], ["九丁目", "9-"], ["十丁目", "10-"],
    ["丁目", "-"], ["番地", "-"], ["番", "-"], ["号", ""],
    ["--", "-"], ["--", "-"]
  ]
}
```
### backend/scripts/realty/build-property-sql.cjs
```
#!/usr/bin/env node
/**
 * 媒介物件の移し替えの SQL を作る（v2.2.250）。
 *   node backend/scripts/realty/build-property-sql.cjs > backend/scripts/sql/2026-11-05_realty_properties_2_migrate.sql
 *
 * ⚠️ 住所のそろえ方は ② の backend-express/src/features/realty/propertyKeyRules.json（propertyKey.ts と同じ1つ）から作る。
 *   ⚠️ ここで SQL を手で直さない。規則を変えたら、このスクリプトで作り直す。
 * ⚠️ SQL の REPLACE は、JS の split/join と同じく「すべての出現を、左から重ならずに」置き換える。
 */
const path = require('path');
const rules = require(path.join(__dirname, '../../../backend-express/src/features/realty/propertyKeyRules.json')).replace;

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\t/g, '\\t')}'`;

/** normPlace(x) と同じ SQL の式 */
const normSql = (expr) => {
  let e = expr;
  for (const [from, to] of rules) e = `REPLACE(${e}, ${q(from)}, ${q(to)})`;
  return `TRIM(TRAILING '-' FROM ${e})`;
};

/** fullAddress(addr1, addr2) と同じ式。⚠️ startsWith に合わせて BINARY で比べる（照合順序で全角半角が同じに扱われないように） */
const fullAddrSql = (t) =>
  `IF(BINARY LEFT(IFNULL(${t}.addr2, ''), CHAR_LENGTH(IFNULL(${t}.addr1, ''))) = BINARY IFNULL(${t}.addr1, ''), IFNULL(${t}.addr2, ''), CONCAT(IFNULL(${t}.addr1, ''), IFNULL(${t}.addr2, '')))`;

/**
 * 既存の台帳の突き合わせ用の文字列（地番・建物名は無いので 種別|a:住所）。
 * ⚠️ propertyKeyOf と同じく、住所に数字（番地）が無いときは、その台帳だけの物件にする（末尾に |u:台帳の ID）
 */
const keySql = (t) => {
  const n = normSql(fullAddrSql(t));
  return `CONCAT(IFNULL(${t}.category, ''), '|a:', ${n}, IF(${n} REGEXP '[0-9]', '', CONCAT('|u:', ${t}.id)))`;
};

const out = `-- =====================================================================
-- v2.2.250 不動産企画係：媒介物件の表（連動トリガー仕様書 ②）  ②　今ある台帳から媒介物件を作って紐づける
--
-- ⚠️ このファイルは backend/scripts/realty/build-property-sql.cjs で作った（手で直さない）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 先に 2026-11-05_realty_properties_1_schema.sql を流しておく
-- ⚠️ 何回流しても同じ（物件の ID は突き合わせ用の文字列から決まる。紐づけは propertyId が空の行だけ）
-- ⚠️ 住所に番地（数字）が無い台帳（「鹿児島市」だけなど）は、ほかとまとめず、その台帳だけの物件にする（propertyKey.ts と同じ）
-- =====================================================================

-- 1. 有効な台帳から、種別＋住所で媒介物件を作る（同じ物件の台帳は1つにまとまる）
INSERT IGNORE INTO realty_properties (id, match_key, category, addr, created_at, created_by)
SELECT CONCAT('p', LEFT(MD5(x.k), 16)), x.k, MIN(x.cat), MIN(x.addr), NOW(), '移し替え（v2.2.250）'
  FROM (
    SELECT ${keySql('l')} AS k, NULLIF(l.category, '') AS cat, ${fullAddrSql('l')} AS addr
      FROM brokerage_listings l
     WHERE l.kind = 'ledger' AND (l.show_dashboard IS NULL OR l.show_dashboard <> 0)
  ) x
 GROUP BY x.k;

-- 2. 台帳に物件をつなぐ
UPDATE brokerage_listings l
  JOIN realty_properties p ON p.match_key = ${keySql('l')}
   SET l.propertyId = p.id
 WHERE l.kind = 'ledger' AND (l.show_dashboard IS NULL OR l.show_dashboard <> 0) AND l.propertyId IS NULL;

-- 3. その台帳から作った売り反響にも同じ物件をつなぐ（売り反響の台帳 No. ＝ 台帳の No.）
UPDATE brokerage_listings s
  JOIN brokerage_listings g ON g.kind = 'ledger' AND (g.show_dashboard IS NULL OR g.show_dashboard <> 0)
                           AND CAST(g.no AS CHAR) = CAST(s.ledgerNo AS CHAR) AND g.propertyId IS NOT NULL
   SET s.propertyId = g.propertyId
 WHERE s.kind = 'leads' AND s.propertyId IS NULL AND s.ledgerNo IS NOT NULL AND s.ledgerNo <> '';

-- 確認
SELECT COUNT(*) AS 物件の数 FROM realty_properties;
SELECT SUM(propertyId IS NOT NULL) AS 物件につながった台帳, COUNT(*) AS 有効な台帳 FROM brokerage_listings WHERE kind = 'ledger' AND (show_dashboard IS NULL OR show_dashboard <> 0);
SELECT COUNT(*) AS 物件につながった売り反響 FROM brokerage_listings WHERE kind = 'leads' AND propertyId IS NOT NULL;
SELECT p.id, p.category, p.addr, COUNT(*) AS 台帳の数 FROM realty_properties p JOIN brokerage_listings l ON l.propertyId = p.id AND l.kind = 'ledger' GROUP BY p.id HAVING COUNT(*) > 1;
`;
process.stdout.write(out);
```
### backend/scripts/sql/2026-11-05_realty_properties_1_schema.sql
```
-- =====================================================================
-- v2.2.250 不動産企画係：媒介物件の表（連動トリガー仕様書 ②）  ①　表と列を足す
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② の更新より**前に**流す（② の媒介紐付がこの表・列を使う）
-- ⚠️ 何回流しても同じ（IF NOT EXISTS）
-- =====================================================================

-- 1. 媒介物件（自社が媒介・買取した物件そのもの。⚠️ property_db＝ポータルの掲載物件とは別物）
CREATE TABLE IF NOT EXISTS realty_properties (
  id            VARCHAR(40)  NOT NULL                                  COMMENT '物件 ID（移し替えは p + MD5 の先頭16桁、② は uid）',
  match_key     VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT '突き合わせ用（種別|c:地番 か 種別|a:住所[|建物名|部屋番号]。② の propertyKey.ts）',
  category      VARCHAR(30)  NULL                                      COMMENT '種別（台帳の区分と同じ値）',
  addr          VARCHAR(255) NULL                                      COMMENT '所在地（住居表示）',
  chiban        VARCHAR(100) NULL                                      COMMENT '地番（任意）',
  building_name VARCHAR(100) NULL                                      COMMENT '建物名（マンション）',
  room_no       VARCHAR(30)  NULL                                      COMMENT '部屋番号（マンション）',
  land_area     DECIMAL(10,2) NULL                                     COMMENT '土地面積（㎡）',
  building_area DECIMAL(10,2) NULL                                     COMMENT '建物面積（㎡）',
  built_year    VARCHAR(20)  NULL                                      COMMENT '築年（例: 1998・平成10年）',
  layout        VARCHAR(30)  NULL                                      COMMENT '間取り',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    VARCHAR(100) NULL,
  updated_at    DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_realty_properties_match_key (match_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='不動産企画係の媒介物件（v2.2.250。照合順序は brokerage_listings と同じ）';

-- 2. 台帳・売り反響（のちに買取案件も）から物件への紐づけ
ALTER TABLE brokerage_listings ADD COLUMN IF NOT EXISTS propertyId VARCHAR(40) NULL COMMENT '媒介物件（realty_properties.id。v2.2.250）';
ALTER TABLE brokerage_listings ADD INDEX IF NOT EXISTS idx_brokerage_listings_propertyId (propertyId);

-- 確認（どちらも結果が返ればよい）
SHOW CREATE TABLE realty_properties;
SHOW COLUMNS FROM brokerage_listings LIKE 'propertyId';
```

## 変更の差分（git diff）
```diff
diff --git a/backend-express/src/features/realty/ledgerLink.ts b/backend-express/src/features/realty/ledgerLink.ts
index 7702b7f83..f0f5493dd 100644
--- a/backend-express/src/features/realty/ledgerLink.ts
+++ b/backend-express/src/features/realty/ledgerLink.ts
@@ -4,6 +4,7 @@ import type { Tx } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
 import { jstNow, resolveMe, uid } from './calls';
 import { norm } from './index';
+import { fullAddress, isUniqueKey, propertyKeyOf } from './propertyKey';
 import type { Result } from './index';
 
 /**
@@ -19,6 +20,8 @@ import type { Result } from './index';
  *      ・台帳を作る（現況は「情報整理中」＝仕様書の「販売準備中」。docs/realty-trigger-spec.md の対応表）
  *      ・売り反響を「媒介受託」（＝仕様書の「媒介獲得」）にし、媒介契約日・台帳 No.・台帳 ID を入れる
  *      ・変更履歴（kind = logs）を積む（仕様書の監査ログ）
+ *      ・⚠️ v2.2.250: 媒介物件（realty_properties）を、種別＋住所（地番・マンションは建物名＋部屋番号）で探し、無ければ作る。
+ *        台帳と売り反響に propertyId を入れる（仕様書 ②「三者を紐づける」。突き合わせは propertyKey.ts）
  * ─────────────────────────────────────────────
  *
  * ⚠️ 段階・現況の名前は今のまま（2026-11-05 の利用者の決定）。仕様書の名前とは docs/realty-trigger-spec.md の「8」で読み替える。
@@ -56,6 +59,15 @@ export const maxExpiryOf = (contractDate: string): string => {
 type LedgerLinkForm = {
   baikaiDate: string; baikaiType: string; expiry: string; seller: string; contact: string; category: string;
   addr1: string; addr2: string; price: number; staff: string; freq: string; note: string; otherBrokers: string;
+  /** v2.2.250: 媒介物件の項目（すべて任意。マンションは建物名が必須） */
+  chiban: string; buildingName: string; roomNo: string; landArea: number | null; buildingArea: number | null; builtYear: string; layout: string;
+};
+
+/** 面積（㎡）。空・読めない・0 以下は null */
+const areaOf = (v: unknown): number | null => {
+  if (v === null || v === undefined || String(v).trim() === '') return null;
+  const n = Number(String(v).replace(/[,㎡\s]|m²/g, ''));
+  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
 };
 
 /** 画面から来た値を読む。⚠️ ① を通すと {} が [] になるので、画面は JSON の文字列で送る */
@@ -71,6 +83,8 @@ const formOf = (raw: unknown): LedgerLinkForm | null => {
     seller: str(r.seller).trim(), contact: str(r.contact).trim(), category: str(r.category).trim(),
     addr1: str(r.addr1).trim(), addr2: str(r.addr2).trim(), price: Number(r.price),
     staff: str(r.staff).trim(), freq: str(r.freq).trim(), note: str(r.note).trim(), otherBrokers: str(r.otherBrokers).trim(),
+    chiban: str(r.chiban).trim(), buildingName: str(r.buildingName).trim(), roomNo: str(r.roomNo).trim(),
+    landArea: areaOf(r.landArea), buildingArea: areaOf(r.buildingArea), builtYear: str(r.builtYear).trim(), layout: str(r.layout).trim(),
   };
 };
 
@@ -92,6 +106,7 @@ export const problemsOf = (f: LedgerLinkForm, today: string): string[] => {
   if (!f.seller) p.push('売主');
   if (!f.addr2) p.push('物件の所在地');
   if (!f.category) p.push('物件の種別');
+  if (f.category === 'マンション' && !f.buildingName) p.push('建物名（マンションのとき）');
   return p;
 };
 
@@ -159,23 +174,50 @@ export const runLedgerLink = async (staff: AuthenticatedStaff, body: Record<stri
       ? `${form.note}${form.note ? '／' : ''}他の依頼先：${form.otherBrokers}`
       : form.note;
 
+    // ⚠️ v2.2.250: 媒介物件を探し、無ければ作る（同じ物件なら、以前の媒介・買取の台帳と同じ物件に紐づく）。
+    //   突き合わせ用の文字列の行を押さえて、同時に登録されても二重に作らない。場所が見分けられない住所（番地なし）は、この台帳だけの物件
+    const addr = fullAddress(form.addr1, form.addr2);
+    const key = propertyKeyOf({ category: form.category, addr, chiban: form.chiban, buildingName: form.buildingName, roomNo: form.roomNo }, ledgerId);
+    const [found] = isUniqueKey(key)
+      ? []
+      : await tx.query<DynamicRow>('SELECT id FROM realty_properties WHERE match_key = ? FOR UPDATE', [key]);
+    const propertyId = found ? str(found.id) : uid();
+    if (!found) {
+      await tx.execute(
+        `INSERT INTO realty_properties
+           (id, match_key, category, addr, chiban, building_name, room_no, land_area, building_area, built_year, layout, created_by)
+         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
+        [propertyId, key, form.category, addr, form.chiban || null, form.buildingName || null, form.roomNo || null,
+          form.landArea, form.buildingArea, form.builtYear || null, form.layout || null, by]
+      );
+    }
+    // 同じ物件の以前の台帳（この台帳はまだ作っていないので、すべてが「以前」）
+    const pastLedgers = found
+      ? (await tx.query<DynamicRow>(
+          `SELECT \`no\` FROM brokerage_listings
+            WHERE kind = 'ledger' AND propertyId = ? AND (show_dashboard IS NULL OR show_dashboard <> 0)
+            ORDER BY CAST(\`no\` AS UNSIGNED)`,
+          [propertyId]
+        )).map((r) => Number(r.no))
+      : [];
+
     await tx.execute(
       `INSERT INTO brokerage_listings
          (kind, \`id\`, \`no\`, staff, portal, source, contractDate, baikaiType, expiry, seller, contact, category,
           currentStatus, addr1, addr2, price, freq, lastReportDate, reinsDate, priceRevDate, propStatus, keyStatus, keyInfo,
-          note, createdAt, show_dashboard)
-       VALUES ('ledger', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '情報整理中', ?, ?, ?, ?, NULL, NULL, NULL, 'アクティブ', NULL, NULL, ?, ?, 1)`,
+          note, createdAt, propertyId, show_dashboard)
+       VALUES ('ledger', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '情報整理中', ?, ?, ?, ?, NULL, NULL, NULL, 'アクティブ', NULL, NULL, ?, ?, ?, 1)`,
       [ledgerId, no, abbr || null, abbr || null, str(lead.source) || null, form.baikaiDate, form.baikaiType, form.expiry,
         form.seller, form.contact || null, form.category, form.addr1 || null, form.addr2, form.price, form.freq || null,
-        note || null, now.date]
+        note || null, now.date, propertyId]
     );
 
     const fromPhase = str(lead.phase);
     await tx.execute(
       `UPDATE brokerage_listings
-          SET phase = '媒介受託', baikaiDate = ?, ledgerNo = ?, ledgerId = ?, endReason = NULL
+          SET phase = '媒介受託', baikaiDate = ?, ledgerNo = ?, ledgerId = ?, propertyId = ?, endReason = NULL
         WHERE \`id\` = ?`,
-      [form.baikaiDate, no, ledgerId, leadId]
+      [form.baikaiDate, no, ledgerId, propertyId, leadId]
     );
 
     const label = str(lead.seller) || str(lead.name) || str(lead.addr) || leadId;
@@ -189,6 +231,6 @@ export const runLedgerLink = async (staff: AuthenticatedStaff, body: Record<stri
     });
 
     const [saved] = await tx.query<DynamicRow>('SELECT * FROM brokerage_listings WHERE `id` = ?', [leadId]);
-    return ok({ status: 'success', no, ledgerId, lead: saved ?? null });
+    return ok({ status: 'success', no, ledgerId, lead: saved ?? null, property: { id: propertyId, isNew: !found, pastLedgers } });
   });
 };
diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
index ebf639ae1..bb0d91d2c 100644
--- a/backend/scripts/guide/articles/common/screen-247.md
+++ b/backend/scripts/guide/articles/common/screen-247.md
@@ -29,9 +29,18 @@ summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談
    - 有効期間の満了日：最初は「契約日の3か月後の前日」が入ります。専属専任媒介・専任媒介は3か月を超えられません（宅建業法）。一般媒介は超えると確かめる画面が出ます
    - 売出価格（1円以上）
    - 担当者・売主・物件の所在地・物件の種別
+   - 種別がマンションのときは、**建物名**も必須です
+   - 下の「媒介物件」の欄（地番・建物名・部屋番号・土地面積・建物面積・築年・間取り）も確かめます。一括査定の詳細にあった値は、初めから入っています
 4. 「**登録**」を押すと、媒介獲得台帳に1行が作られ（台帳の No. は自動・現況は「情報整理中」）、売り反響の段階が「媒介受託」になります。台帳と段階は**必ず一緒に**保存されます（片方だけが保存されることはありません）
 5. 「**媒介獲得台帳で No.〇 を開く**」を押すと、媒介獲得台帳でその行が黄色で出ます
 
+### 媒介物件（同じ物件の履歴）
+登録すると、台帳は「媒介物件」（物件そのもの）に紐づきます。**以前に同じ物件を媒介・買取していれば、その物件に紐づき**、登録の画面に「以前の台帳と同じ物件に紐づけました（台帳 No.〇）」と出ます。
+- 同じ物件かどうかは、**種別と住所**で見ます。住所の空白・全角半角・「丁目・番地・番・号」と「-」の違いは、そろえて比べます
+- マンションは、建物名と部屋番号も比べます。地番を入れたときは、地番で比べます
+- 住所に番地が無いとき（「鹿児島市」だけなど）は、ほかの物件とまとめません
+- 媒介獲得台帳の一覧では、同じ物件に台帳が2件以上あると、住所の横に「**同じ物件の台帳 N件**」と出ます。押すと、その台帳の No. が出ます
+
 - 足りない項目があると、画面の上に赤で項目の名前が出て、登録できません
 - 一般媒介で、明示型のときは「他の依頼先」も入れられます（台帳の備考に入ります）
 - 「キャンセル」を押すと、何も変わりません。一覧で媒介受託を選んだときは段階も元に戻り、編集画面からのときは段階以外の項目だけが保存されています
diff --git a/frontend/src/components/database/DatabaseBroker.tsx b/frontend/src/components/database/DatabaseBroker.tsx
index 59d878502..f6df789db 100644
--- a/frontend/src/components/database/DatabaseBroker.tsx
+++ b/frontend/src/components/database/DatabaseBroker.tsx
@@ -43,6 +43,8 @@ export interface BrokerData {
     /** 有効期間の満了日（v2.2.248 の媒介紐付から入る）。直近の販売報告日（v2.2.249 から期限の計算に使う） */
     expiry?: string | null;
     lastReportDate?: string | null;
+    /** 媒介物件（v2.2.250。realty_properties.id。同じ物件の台帳は同じ値） */
+    propertyId?: string | null;
     currentStatus?: string | null;
     /** つないだ商談案件（売側）の id（v2.2.246 の買付登録。以前のアプリの l.dealId） */
     dealId?: string | null;
@@ -226,6 +228,16 @@ const DatabaseBroker = () => {
         return filtered;
     }, [originalData, sortConfig, searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus]);
 
+    // ⚠️ v2.2.250: 媒介物件ごとの台帳 No.（同じ物件に台帳が2件以上あるとき、一覧に「同じ物件の台帳 N件」を出す）
+    const ledgerNosByProperty = useMemo(() => {
+        const m: Record<string, string[]> = {};
+        for (const d of originalData) {
+            if (!d.propertyId) continue;
+            (m[d.propertyId] = m[d.propertyId] ?? []).push(String(d.no ?? '―'));
+        }
+        return m;
+    }, [originalData]);
+
     // ⚠️ v2.2.248: ?ledgerNo= の行が一覧に出たら、見えるところまで動かす（1回だけ）
     const [focusedNo, setFocusedNo] = useState('');
     useEffect(() => {
@@ -508,6 +520,17 @@ const DatabaseBroker = () => {
                                                 </td>
                                                 <td className="text-start text-truncate" style={{ maxWidth: '200px' }} title={addressParsed.cleanText}>
                                                     {addressParsed.cleanText || '-'}
+                                                    {(() => {
+                                                        const nos = item.propertyId ? ledgerNosByProperty[item.propertyId] ?? [] : [];
+                                                        if (nos.length < 2) return null;
+                                                        const list = nos.map(n => `No.${n}`).join('・');
+                                                        return (
+                                                            <button type="button" className="badge bg-info text-dark border-0 ms-1" style={{ fontSize: '9px', cursor: 'pointer' }}
+                                                                title={`同じ物件の台帳：${list}`} onClick={() => alert(`同じ物件（媒介物件）の台帳：${list}`)}>
+                                                                同じ物件の台帳 {nos.length}件
+                                                            </button>
+                                                        );
+                                                    })()}
                                                 </td>
                                                 <td className="text-end fw-bold text-danger">
                                                     {displayPrice > 0 ? displayPrice.toLocaleString() : '-'}
diff --git a/frontend/src/components/realty/common/LedgerLinkModal.tsx b/frontend/src/components/realty/common/LedgerLinkModal.tsx
index a9a181369..f03b9ec99 100644
--- a/frontend/src/components/realty/common/LedgerLinkModal.tsx
+++ b/frontend/src/components/realty/common/LedgerLinkModal.tsx
@@ -95,6 +95,14 @@ const LedgerLinkModal = ({ lead, staffNames, onClose, onSubmit }: Props) => {
                                 ? <>この売り反響は、すでに <b>媒介獲得台帳 No.{done.no}</b> につながっています（新しくは作っていません）。</>
                                 : <><b>媒介獲得台帳 No.{done.no}</b> を作り、売り反響を「媒介受託」にしました。</>}
                         </p>
+                        {/* ⚠️ v2.2.250: 媒介物件（同じ物件の以前の台帳があれば、その No.） */}
+                        {done.property && (
+                            <p className="mb-2">
+                                {done.property.isNew
+                                    ? '媒介物件：新しい物件として登録しました。'
+                                    : <>媒介物件：<b>以前の台帳と同じ物件</b>に紐づけました（{done.property.pastLedgers.length > 0 ? done.property.pastLedgers.map(n => `台帳 No.${n}`).join('・') : '以前の台帳なし'}）。</>}
+                            </p>
+                        )}
                         <p className="text-muted mb-0" style={{ fontSize: '11px' }}>媒介獲得台帳で、レインズ登録日・鍵の預かりなどを続けて入れてください。</p>
                     </Modal.Body>
                     <Modal.Footer>
@@ -156,6 +164,24 @@ const LedgerLinkModal = ({ lead, staffNames, onClose, onSubmit }: Props) => {
                                     <option value="">選択してください</option>
                                     {withCurrent(LEDGER_CATEGORIES, form.category).map(o => <option key={o} value={o}>{o}</option>)}
                                 </select></div>
+                            {/* ⚠️ v2.2.250: 媒介物件（仕様書 ②）。一括査定の詳細にあれば入れてある。マンションは建物名が必須（同じ物件の突き合わせに使う） */}
+                            <div className="col-12" style={{ ...label, fontSize: '11px', borderTop: '1px solid #e9ecef', paddingTop: '6px', marginTop: '4px' }}>
+                                媒介物件（同じ物件を以前に媒介・買取していれば、その物件に紐づきます）
+                            </div>
+                            <div className="col-md-4"><div style={label}>地番（任意。あれば優先して突き合わせ）</div>
+                                <input className="form-control form-control-sm" value={form.chiban} onChange={e => set({ chiban: e.target.value })} /></div>
+                            <div className="col-md-5"><div style={label}>建物名 {form.category === 'マンション' ? req : '（マンション）'}</div>
+                                <input className="form-control form-control-sm" value={form.buildingName} onChange={e => set({ buildingName: e.target.value })} /></div>
+                            <div className="col-md-3"><div style={label}>部屋番号</div>
+                                <input className="form-control form-control-sm" value={form.roomNo} onChange={e => set({ roomNo: e.target.value })} /></div>
+                            <div className="col-md-3"><div style={label}>土地面積（㎡）</div>
+                                <input className="form-control form-control-sm" inputMode="decimal" value={form.landArea} onChange={e => set({ landArea: e.target.value })} /></div>
+                            <div className="col-md-3"><div style={label}>建物面積（㎡）</div>
+                                <input className="form-control form-control-sm" inputMode="decimal" value={form.buildingArea} onChange={e => set({ buildingArea: e.target.value })} /></div>
+                            <div className="col-md-3"><div style={label}>築年</div>
+                                <input className="form-control form-control-sm" placeholder="1998・平成10年" value={form.builtYear} onChange={e => set({ builtYear: e.target.value })} /></div>
+                            <div className="col-md-3"><div style={label}>間取り</div>
+                                <input className="form-control form-control-sm" placeholder="4LDK" value={form.layout} onChange={e => set({ layout: e.target.value })} /></div>
                             <div className="col-md-8"><div style={label}>備考</div>
                                 <input className="form-control form-control-sm" value={form.note} onChange={e => set({ note: e.target.value })} /></div>
                             <div className="col-12 text-muted mt-2">
diff --git a/frontend/src/components/realty/common/leadLinks.ts b/frontend/src/components/realty/common/leadLinks.ts
index 4b74680d9..b2eb661df 100644
--- a/frontend/src/components/realty/common/leadLinks.ts
+++ b/frontend/src/components/realty/common/leadLinks.ts
@@ -67,6 +67,22 @@ export const maxExpiryOf = (contractDate: string): string => {
 export type LedgerForm = {
     baikaiDate: string; baikaiType: string; expiry: string; seller: string; contact: string; category: string;
     addr1: string; addr2: string; price: number | null; staff: string; freq: string; note: string; otherBrokers: string;
+    /** v2.2.250: 媒介物件の項目（仕様書 ②）。すべて任意。⚠️ 種別がマンションのときは建物名が必須（同じ物件の突き合わせに使う） */
+    chiban: string; buildingName: string; roomNo: string; landArea: string; buildingArea: string; builtYear: string; layout: string;
+};
+
+/**
+ * 売り反響の一括査定の詳細（以前のアプリの lead.detail。取り込みで raw_data に入っている）の1項目。無ければ ''。
+ * 例: msName（マンション名）・room（部屋）・land（土地面積）・area（建物面積）・built（築年）・layout（間取り）
+ */
+const detailOf = (lead: Rec, key: string): string => {
+    const raw = lead.raw_data;
+    let o: unknown = raw;
+    if (typeof raw === 'string') {
+        try { o = JSON.parse(raw); } catch { return ''; }
+    }
+    const d = o && typeof o === 'object' ? (o as Rec).detail : null;
+    return d && typeof d === 'object' ? str((d as Rec)[key]).trim() : '';
 };
 
 /** 売り反響の値を台帳の項目に写す（媒介契約日が無ければ今日。満了日は3か月後の前日） */
@@ -87,6 +103,14 @@ export const ledgerFormOf = (lead: Rec): LedgerForm => {
         freq: '1か月',
         note: `反響リードより転記（${str(lead.source) || '反響元未設定'}）`,
         otherBrokers: '',
+        // ⚠️ v2.2.250: 一括査定の詳細（以前のアプリの lead.detail。raw_data に入っている）にあれば入れておく
+        chiban: '',
+        buildingName: detailOf(lead, 'msName'),
+        roomNo: detailOf(lead, 'room'),
+        landArea: detailOf(lead, 'land'),
+        buildingArea: detailOf(lead, 'area'),
+        builtYear: detailOf(lead, 'built'),
+        layout: detailOf(lead, 'layout'),
     };
 };
 
@@ -111,6 +135,7 @@ export const ledgerFormProblems = (f: LedgerForm, today: string = todayStr()): s
     if (!f.seller.trim()) p.push('売主');
     if (!f.addr2.trim()) p.push('物件の所在地');
     if (!f.category) p.push('物件の種別');
+    if (f.category === 'マンション' && !f.buildingName.trim()) p.push('建物名（マンションのとき）');
     return p;
 };
 
@@ -120,7 +145,9 @@ export const ledgerFormWarning = (f: LedgerForm): string | null =>
         ? `有効期間が3か月（${maxExpiryOf(f.baikaiDate)}まで）を超えています。このまま登録しますか？`
         : null;
 
-export type LedgerLinkResult = { status: 'success' | 'exists'; no: number; ledgerId: string | null; lead: Rec | null };
+/** v2.2.250: 紐づけた媒介物件。isNew = 新しく作った、pastLedgers = 同じ物件の以前の台帳 No. */
+export type LinkedProperty = { id: string; isNew: boolean; pastLedgers: number[] };
+export type LedgerLinkResult = { status: 'success' | 'exists'; no: number; ledgerId: string | null; lead: Rec | null; property: LinkedProperty | null };
 
 /**
  * 売り反響 → 媒介獲得台帳（② の planner:ledger_link）。
@@ -135,6 +162,7 @@ export const linkLedger = async (leadId: string, form: LedgerForm): Promise<Ledg
         no: Number(d.no),
         ledgerId: typeof d.ledgerId === 'string' ? d.ledgerId : null,
         lead: d.lead && typeof d.lead === 'object' ? (d.lead as Rec) : null,
+        property: d.property && typeof d.property === 'object' ? (d.property as LinkedProperty) : null,
     };
 };
 
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index a3eae3e6e..7f6ccf105 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.249';
+export const newVersion = '2.2.250';
```
