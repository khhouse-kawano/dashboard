-- ============================================================================
-- 反響一覧の顧客タグを、文字列連結からフラグカラムへ移行する
--
--   対象: inquiry_customer / inquiry_customer_kaeru / inquiry_customer_resale
--   実行: ① レンタルサーバーの phpMyAdmin
--         ⚠️ 左サイドバーで対象DBを選択してから SQL タブで実行すること
--
-- ----------------------------------------------------------------------------
-- 背景
--
--   これまでタグは black_list カラムに空白区切りで「追記」され、
--   ON/OFF は出現回数の偶奇で判定していた。
--
--     UPDATE ... SET black_list = CONCAT(black_list, ' ', 'duplicate')
--     bl.split('duplicate').length % 2 === 0   // ← ONの意味
--
--   この方式には以下の問題がある。
--     ・OFFにするたびに文字列が伸び続ける（削除されない）
--     ・split().length は「出現回数+1」なので、%2===0 がONという直感に反する形になる
--     ・楽観更新と非同期POSTの二重送信で偶奇が反転し、表示と実体がずれる
--     ・SQLから「業者を除く」といった絞り込みができない
--     ・同じ判定ロジックが画面ごとに散在する
--
-- ----------------------------------------------------------------------------
-- カラム名について
--
--   ⚠️ inquiry_customer には既に別用途の `duplicate` カラムがある
--     （反響一覧で #タグ として表示している方）。衝突を避けるため
--     すべて `_flag` を付けた名前にしている。
--
--   ⚠️ NOT NULL DEFAULT 0 を明示している。staff_list のように
--     デフォルト値なしで定義すると、カラムを列挙しない INSERT が
--     1364 (Field doesn't have a default value) で失敗するため。
--
-- ----------------------------------------------------------------------------
-- 旧 black_list カラムの扱い
--
--   このマイグレーション後、アプリケーションは black_list に書き込まない。
--   カラム自体は残す（移行後に問題が出たとき元データから再移行できるように）。
--   数ヶ月運用して安定したら DROP する。
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. カラム追加
-- ---------------------------------------------------------------------------
ALTER TABLE `inquiry_customer`
  ADD COLUMN `duplicate_flag` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '重複クリック',
  ADD COLUMN `gift_flag`      TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ギフト券進呈済み',
  ADD COLUMN `support_flag`   TINYINT(1) NOT NULL DEFAULT 0 COMMENT '業者',
  ADD COLUMN `black_flag`     TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ブラックリスト';

ALTER TABLE `inquiry_customer_kaeru`
  ADD COLUMN `duplicate_flag` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '重複クリック',
  ADD COLUMN `gift_flag`      TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ギフト券進呈済み',
  ADD COLUMN `support_flag`   TINYINT(1) NOT NULL DEFAULT 0 COMMENT '業者',
  ADD COLUMN `black_flag`     TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ブラックリスト';

ALTER TABLE `inquiry_customer_resale`
  ADD COLUMN `duplicate_flag` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '重複クリック',
  ADD COLUMN `gift_flag`      TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ギフト券進呈済み',
  ADD COLUMN `support_flag`   TINYINT(1) NOT NULL DEFAULT 0 COMMENT '業者',
  ADD COLUMN `black_flag`     TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ブラックリスト';


-- ---------------------------------------------------------------------------
-- 2. 既存データの移行
--
--   出現回数 = (元の長さ - 置換後の長さ) / 検索語の長さ
--   旧仕様では「出現回数が奇数 = ON」なので、% 2 = 1 を 1 にする。
--
--   検索語の長さ: duplicate=9 / gift=4 / support=7 / black=5
-- ---------------------------------------------------------------------------
UPDATE `inquiry_customer` SET
  `duplicate_flag` = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'duplicate', ''))) / 9) MOD 2,
  `gift_flag`      = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'gift',      ''))) / 4) MOD 2,
  `support_flag`   = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'support',   ''))) / 7) MOD 2,
  `black_flag`     = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'black',     ''))) / 5) MOD 2
WHERE `black_list` IS NOT NULL AND `black_list` <> '';

UPDATE `inquiry_customer_kaeru` SET
  `duplicate_flag` = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'duplicate', ''))) / 9) MOD 2,
  `gift_flag`      = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'gift',      ''))) / 4) MOD 2,
  `support_flag`   = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'support',   ''))) / 7) MOD 2,
  `black_flag`     = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'black',     ''))) / 5) MOD 2
WHERE `black_list` IS NOT NULL AND `black_list` <> '';

UPDATE `inquiry_customer_resale` SET
  `duplicate_flag` = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'duplicate', ''))) / 9) MOD 2,
  `gift_flag`      = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'gift',      ''))) / 4) MOD 2,
  `support_flag`   = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'support',   ''))) / 7) MOD 2,
  `black_flag`     = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`, 'black',     ''))) / 5) MOD 2
WHERE `black_list` IS NOT NULL AND `black_list` <> '';


-- ---------------------------------------------------------------------------
-- 3. 移行結果の確認
--
--   旧方式の判定と新カラムが一致しているかを数える。
--   「不一致」が 0 であること。
-- ---------------------------------------------------------------------------
SELECT
  '重複'   AS タグ,
  SUM(`duplicate_flag` = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`,'duplicate',''))) / 9) MOD 2) AS 一致,
  SUM(`duplicate_flag` <> ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`,'duplicate',''))) / 9) MOD 2) AS 不一致,
  SUM(`duplicate_flag`) AS ON件数
FROM `inquiry_customer`
UNION ALL
SELECT 'ギフト',
  SUM(`gift_flag` = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`,'gift',''))) / 4) MOD 2),
  SUM(`gift_flag` <> ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`,'gift',''))) / 4) MOD 2),
  SUM(`gift_flag`)
FROM `inquiry_customer`
UNION ALL
SELECT '業者',
  SUM(`support_flag` = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`,'support',''))) / 7) MOD 2),
  SUM(`support_flag` <> ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`,'support',''))) / 7) MOD 2),
  SUM(`support_flag`)
FROM `inquiry_customer`
UNION ALL
SELECT 'ブラック',
  SUM(`black_flag` = ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`,'black',''))) / 5) MOD 2),
  SUM(`black_flag` <> ((LENGTH(`black_list`) - LENGTH(REPLACE(`black_list`,'black',''))) / 5) MOD 2),
  SUM(`black_flag`)
FROM `inquiry_customer`;


-- ---------------------------------------------------------------------------
-- 参考: 移行をやり直したい場合
--
--   black_list は残してあるので、2 の UPDATE をもう一度実行すれば
--   何度でも同じ結果に戻せる（冪等）。
--
-- 参考: 旧カラムを削除する場合（数ヶ月安定してから）
--
--   ALTER TABLE `inquiry_customer`        DROP COLUMN `black_list`;
--   ALTER TABLE `inquiry_customer_kaeru`  DROP COLUMN `black_list`;
--   ALTER TABLE `inquiry_customer_resale` DROP COLUMN `black_list`;
--
--   ⚠️ 削除前に、black_list を SELECT しているPHPが残っていないか
--     grep で確認すること。
-- ---------------------------------------------------------------------------
