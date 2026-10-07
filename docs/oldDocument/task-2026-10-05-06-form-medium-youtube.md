# 2026-10-05-06　公開フォームの「ご予約のきっかけ」に YouTube を追加するSQL

## 依頼

> form_databaseおよびform_tableの全mediumカラムに'YouTube'の項目を追加するsql書いて

## ⚠️ 調べてわかったこと

### medium 列は JSON

```json
{"bool":true,"required":true,"text":"ご予約のきっかけを選択してください。","mediumName":["チラシ", … ,"公式LINE"]}
```

⚠️ 選択肢は `mediumName` の配列。⚠️ 289件＋8件すべて正しいJSON。⚠️ 2表とも InnoDB。

### ⚠️⚠️ 媒体ではない選択肢に mediumName を使っているフォームが8件ある

| mediumName | 件数 |
|---|---|
| 【A】にこにこセット / 【B】わんぱくセット（わくわくセット）/ 【C】おたすけセット | 6 |
| UMK住まい博 | 2 |

⚠️ 「全mediumカラム」に足すと ⚠️ **プレゼントの選択肢に YouTube が並ぶ。**
⚠️ ⚠️ **「チラシ」を含む配列（＝通常の媒体一覧）だけを対象にした。**

### ⚠️⚠️ 既存データの表記は `Youtube`（t が小文字）

| どこ | 表記 |
|---|---|
| medium_list（販促媒体マスタ） | ⚠️ `Youtube`（category=ポータル, list_medium=1） |
| inquiry_customer.response_medium | ⚠️ `Youtube`（2件） |
| master_data.sales_promotion_name | ⚠️ `Youtube`（1件） |

⚠️ 画面の集計（JavaScript の `===`）は大文字・小文字を区別する。
⚠️ ご依頼どおり `YouTube` で書いたが、⚠️ SQL の先頭 `SET @new_medium = 'YouTube';` を ⚠️ **1か所変えれば `Youtube` にできる。**

## 作ったファイル

| ディレクトリ | ファイル |
|---|---|
| `backend/scripts/sql/` | ⚠️ **2026-10-05_form_medium_add_youtube.sql**（新規） |

⚠️ 中身: 流す前の確認 → 2表の UPDATE（`JSON_ARRAY_APPEND` で末尾に追加）→ 流した後の確認。
⚠️ ⚠️ **何度流しても重複しない**（⚠️ 同じ表記が既にある配列は対象外）。
⚠️ 実行環境: ⚠️ **① レンタルサーバー（phpMyAdmin）**。⚠️ DBの構造は変えない。

## 動作確認（ローカル・⚠️ トランザクション内で流してロールバック）

| 確認 | 結果 |
|---|---|
| 対象 | form_table 281件 / form_database 8件 |
| 流した後の「未追加」「壊れたJSON」 | ⚠️ **0 / 0** |
| ⚠️ 末尾の要素 | ⚠️ **281件すべて YouTube** |
| ⚠️ プレゼント選択・UMK住まい博 | ⚠️ **変わらない**（末尾は【C】おたすけセット・UMK住まい博のまま） |
| ⚠️ 2回目に流したとき | ⚠️ **0件**（重複しない） |
| shopName を持つフォーム（10件） | ⚠️ キーが残っている |
| ⚠️ ロールバック後 | ⚠️ **0件**（⚠️ ローカルDBは変えていない） |

⚠️ 確認で `$.mediumName[last]` を使うと ⚠️ **多くの行で NULL** になった（⚠️ MariaDB 側の扱い）。⚠️ 要素数から位置を計算して確かめ直した。

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **表記（YouTube / Youtube）は流す前に決めること。** ⚠️ 流した後に変えると、⚠️ 両方が並ぶ（⚠️ 重複防止は表記が完全一致のときだけ効く） |
| 2 | ⚠️ 選択肢は ⚠️ **末尾**（公式LINE の後）に入る |
| 3 | ⚠️⚠️ **新しく作るフォームに YouTube が入るかは未確認。** ⚠️ 選択肢の一覧（「ヒーローショーを見て」など）は ⚠️ **このリポジトリには見つからなかった**。⚠️ 別のプロジェクトにあるか、既存のフォームを複製して作っている可能性がある |

## SQL（全文）

```sql
-- =====================================================================
-- 公開フォームの「ご予約のきっかけ」に YouTube を追加する
--   対象: form_table / form_database の medium 列
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ DBの構造は変えない（⚠️ 値の書き換えだけ）
--
-- ─────────────────────────────────────────────
-- ⚠️ medium 列は JSON。⚠️ 選択肢は "mediumName" の配列に入っている。
--   例: {"bool":true,"required":true,"text":"ご予約のきっかけを…","mediumName":["チラシ", … ,"公式LINE"]}
--   ⚠️ 末尾に1つ足す（⚠️ 既存の選択肢の順は変えない）。
--
-- ⚠️⚠️ **媒体の一覧ではないフォームには足さない。**
--   ⚠️ form_table には mediumName を ⚠️ **別の用途に使っているフォームが8件ある**
--     （2026-10-05 ローカルで確認）:
--       【A】にこにこセット / 【B】わんぱくセット / 【C】おたすけセット … 6件（プレゼントの選択）
--       UMK住まい博 … 2件
--   ⚠️ そこに足すと ⚠️ **プレゼントの選択肢に YouTube が並ぶ。**
--   ⚠️ そのため ⚠️ **「チラシ」を含む配列（＝通常の媒体一覧）だけ**を対象にしている。
--
-- ⚠️⚠️ **表記に注意（大文字・小文字）。**
--   ⚠️ 既存のデータはすべて ⚠️ **`Youtube`（t が小文字）**:
--     medium_list（販促媒体マスタ）… Youtube（category=ポータル, list_medium=1）
--     inquiry_customer.response_medium … Youtube（2件）
--     master_data.sales_promotion_name … Youtube（1件）
--   ⚠️ 画面の集計（JavaScript の ===）は大文字・小文字を ⚠️ **区別する。**
--   ⚠️ `YouTube` で足すと、⚠️ **これからの反響だけ別の媒体として数えられる**おそれがある。
--   ⚠️ 下の @new_medium を変えれば表記を切り替えられる（⚠️ 1か所だけ）。
--
-- ⚠️ 何度流しても重複しない（⚠️ 同じ表記が既にある配列は対象外）。
-- ─────────────────────────────────────────────
-- =====================================================================

-- ⚠️ 追加する表記。⚠️ 既存データに合わせるなら 'Youtube' に変える
SET @new_medium = 'YouTube';

-- ---------------------------------------------------------------------
-- 1. 流す前の確認（⚠️ 「対象」が下の UPDATE で書き換わる件数）
-- ---------------------------------------------------------------------
SELECT 'form_table' AS 表,
       COUNT(*) AS 全件,
       SUM(JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), '"チラシ"')) AS 媒体一覧,
       SUM(JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), '"チラシ"')
           AND NOT JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), JSON_QUOTE(@new_medium))) AS 対象
  FROM form_table
UNION ALL
SELECT 'form_database',
       COUNT(*),
       SUM(JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), '"チラシ"')),
       SUM(JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), '"チラシ"')
           AND NOT JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), JSON_QUOTE(@new_medium)))
  FROM form_database;

-- ---------------------------------------------------------------------
-- 2. 追加
-- ---------------------------------------------------------------------
UPDATE form_table
   SET medium = JSON_ARRAY_APPEND(medium, '$.mediumName', @new_medium)
 WHERE JSON_VALID(medium)
   AND JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), '"チラシ"')
   AND NOT JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), JSON_QUOTE(@new_medium));

UPDATE form_database
   SET medium = JSON_ARRAY_APPEND(medium, '$.mediumName', @new_medium)
 WHERE JSON_VALID(medium)
   AND JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), '"チラシ"')
   AND NOT JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), JSON_QUOTE(@new_medium));

-- ---------------------------------------------------------------------
-- 3. 流した後の確認（⚠️ 「未追加」と「壊れたJSON」が 0 なら完了）
-- ---------------------------------------------------------------------
SELECT 'form_table' AS 表,
       SUM(JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), JSON_QUOTE(@new_medium))) AS 追加済み,
       SUM(JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), '"チラシ"')
           AND NOT JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), JSON_QUOTE(@new_medium))) AS 未追加,
       SUM(NOT JSON_VALID(medium)) AS 壊れたJSON
  FROM form_table
UNION ALL
SELECT 'form_database',
       SUM(JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), JSON_QUOTE(@new_medium))),
       SUM(JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), '"チラシ"')
           AND NOT JSON_CONTAINS(JSON_EXTRACT(medium, '$.mediumName'), JSON_QUOTE(@new_medium))),
       SUM(NOT JSON_VALID(medium))
  FROM form_database;
```
