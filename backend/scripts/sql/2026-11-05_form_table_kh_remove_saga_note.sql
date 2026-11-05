-- =====================================================================
-- form_table（brand = 'kh'）の attention から、佐賀店の特典の注記の行を消す（2026-11-05 利用者の依頼）
--
--   消す行（text_red の最後の行。どちらも行ごと消す）
--     ・「※佐賀店は特典進呈額が異なります」          … 81件（ローカル）
--     ・「※八代店/佐賀店は特典進呈額が異なります」    … 21件（ローカル。「/」が「\/」で入っている行も含む）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 何回流しても同じ（2回目は何も変わらない）
-- ⚠️ attention は JSON の文字列。改行は「\n」（バックスラッシュと n）の2文字で入っている。
--   JSON を組み直さず（他の書き方を変えないように）、その部分の文字だけを取り除く。バックスラッシュは CHAR(92) で書く
-- ⚠️ brand = 'kh' だけ。jh・khg にも同じ注記があるが、今回は対象外
-- =====================================================================

-- 0. 直す前の値の控え（戻すときに使う。2回目以降は作らない）
CREATE TABLE IF NOT EXISTS form_table_bk_20261105_attention AS
  SELECT id, brand, attention FROM form_table WHERE brand = 'kh';

-- 確認（前）: 対象の件数
SELECT
  SUM(attention LIKE '%佐賀店は特典進呈額が異なります%') AS 佐賀店の注記がある,
  COUNT(*) AS khの件数
FROM form_table WHERE brand = 'kh';

-- 1. 消す（3つの書き方。前に付いている改行「\n」も一緒に消す）
UPDATE form_table
   SET attention = REPLACE(
                     REPLACE(
                       REPLACE(attention,
                         CONCAT(CHAR(92), 'n※佐賀店は特典進呈額が異なります'), ''),
                       CONCAT(CHAR(92), 'n※八代店', CHAR(92), '/佐賀店は特典進呈額が異なります'), ''),
                     CONCAT(CHAR(92), 'n※八代店/佐賀店は特典進呈額が異なります'), '')
 WHERE brand = 'kh'
   AND attention LIKE '%佐賀店は特典進呈額が異なります%';

-- 確認（後）: 佐賀店の注記が 0 件、JSON として正しい行が全件ならよい
SELECT
  SUM(attention LIKE '%佐賀店は特典進呈額が異なります%') AS 佐賀店の注記が残っている,
  SUM(JSON_VALID(attention)) AS JSONとして正しい,
  COUNT(*) AS khの件数
FROM form_table WHERE brand = 'kh';

-- 確認（後）: text_red の最後の行（「※未成年者へ…」などになっていればよい）
SELECT COUNT(*) AS 件数, SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(attention, '$.text_red')), CHAR(10), -1) AS 最後の行
  FROM form_table WHERE brand = 'kh' GROUP BY 最後の行;

-- 戻すとき（必要なときだけ。⚠️ ふだんは流さない）
-- UPDATE form_table f JOIN form_table_bk_20261105_attention b ON b.id = f.id SET f.attention = b.attention;
-- 戻す必要が無くなったら、控えの表を消す
-- DROP TABLE form_table_bk_20261105_attention;
