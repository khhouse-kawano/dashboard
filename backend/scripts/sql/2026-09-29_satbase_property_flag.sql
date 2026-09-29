-- =====================================================================
-- satbase_property_flag: SatBaseサマリーの「画面から入れた値」を分離する
--
-- ⚠️⚠️ **ねらい**
--   ⚠️ 元データ（スプレッドシート）を ⚠️ **CSVでまるごと入れ替えられるようにする**。
--   ⚠️ ⚠️ **これまでは `satbase_property` に画面の値が同居していた**ため、
--     ⚠️ **入れ替えるとトグルがゼロに戻っていた。**
--
-- ⚠️⚠️ **これ以降の持ち主**
--   ⚠️ `satbase_property`      … ⚠️⚠️ **SatBaseの写し。丸ごと入れ替えてよい**
--   ⚠️ `satbase_property_flag` … ⚠️⚠️ **Dashboardが持つ。取り込みで触らない**
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ ⚠️ **上から順に流すこと。**（手順3で列を消すので、手順2を飛ばすと値が消える）
-- =====================================================================


-- ---------------------------------------------------------------------
-- 手順1　⚠️ 受け皿を作る
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS satbase_property_flag (
  property_id      INT(11)      NOT NULL COMMENT '物件ID。⚠️ satbase_property.property_id と対応する',
  ad_posted        TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '広告出稿状況。⚠️ 画面のトグル（0=未出稿 / 1=出稿済み）',
  instagram_posted TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Instagram投稿状況。⚠️ 画面のトグル（0=未投稿 / 1=投稿済み）',
  updated          DATETIME     DEFAULT NULL COMMENT '画面から最後に更新した日時',
  updated_by       VARCHAR(128) DEFAULT NULL COMMENT '画面から最後に更新したスタッフ名',
  PRIMARY KEY (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='SatBaseサマリーの画面入力値。⚠️ CSV取り込みで触らないこと';


-- ---------------------------------------------------------------------
-- 手順2　⚠️⚠️ **いまの値を移す（手順3の前に必ず流すこと）**
--
-- ⚠️ 両方0で更新履歴も無い行は移さない（⚠️ 既定値と同じなので持つ意味がない）。
-- ---------------------------------------------------------------------
INSERT INTO satbase_property_flag
  (property_id, ad_posted, instagram_posted, updated, updated_by)
SELECT property_id, ad_posted, instagram_posted, updated, updated_by
  FROM satbase_property
 WHERE ad_posted = 1
    OR instagram_posted = 1
    OR updated IS NOT NULL
ON DUPLICATE KEY UPDATE
  ad_posted        = VALUES(ad_posted),
  instagram_posted = VALUES(instagram_posted),
  updated          = VALUES(updated),
  updated_by       = VALUES(updated_by);


-- ---------------------------------------------------------------------
-- 手順3　⚠️⚠️ **元の4列を落とす**
--
-- ⚠️ ⚠️ **手順2の件数を確かめてから流すこと。**
--   ⚠️ 確認: SELECT COUNT(*) FROM satbase_property_flag;
--
-- ⚠️⚠️ **落とさないと `SELECT p.*, f.ad_posted ...` で同じ名前の列が2つ出て、
--   ⚠️ どちらが採られるかが分からなくなる。**
-- ---------------------------------------------------------------------
ALTER TABLE satbase_property
  DROP COLUMN ad_posted,
  DROP COLUMN instagram_posted,
  DROP COLUMN updated,
  DROP COLUMN updated_by;
