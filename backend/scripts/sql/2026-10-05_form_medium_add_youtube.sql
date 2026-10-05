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
