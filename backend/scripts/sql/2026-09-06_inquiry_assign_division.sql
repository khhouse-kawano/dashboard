-- 反響の担当割り当てと事業区分。
--
-- 対象は2つの反響テーブル。
--   inquiry_introductory … 担当・同期の列がまだ無いため一式を追加する
--   inquiry_ambassador   … 担当・同期は既にあるので division だけを追加する
--
-- ⚠️ `division`（事業区分）を持たせる理由。
--   同期先のテーブルが事業区分ごとに違う。
--     注文 → master_data
--     建売 → master_data_kaeru
--     中古 → master_data_resale
--   どれに入れたかを反響側に残さないと、同期後に「この反響はどの事業の顧客に
--   なったのか」が追えなくなる（master_data_id だけでは、3つのうちどの
--   テーブルの id なのか分からない）。
--
-- ⚠️ 既定値は '注文'。両機能とも当初は注文事業のみを前提に作られており、
--   既存行はすべて注文事業として同期されている（または未同期）。
--   NULL にすると「未選択」と「注文」の区別がつかず、画面側で分岐が増える。

-- ============================================================
-- 1. inquiry_introductory（お友達紹介キャンペーン）
-- ============================================================

ALTER TABLE `inquiry_introductory`
  ADD COLUMN `division` VARCHAR(8) NOT NULL DEFAULT '注文'
      COMMENT '事業区分。注文／建売／中古。同期先のテーブルが変わる' AFTER `referrerType`,
  ADD COLUMN `shop` VARCHAR(64) DEFAULT NULL
      COMMENT '担当店舗。⚠️ 反響時点では必ず未設定。社内で割り振る' AFTER `guideStaff`,
  ADD COLUMN `staff` VARCHAR(128) DEFAULT NULL
      COMMENT '担当営業。空なら同期時に「<店舗> 管理」になる' AFTER `shop`,
  ADD COLUMN `sync` TINYINT NOT NULL DEFAULT 0
      COMMENT '顧客として取り込んだか。1=取り込み済み。⚠️ 1 の行は担当変更も同期も拒否する' AFTER `staff`,
  ADD COLUMN `master_data_id` VARCHAR(64) DEFAULT NULL
      COMMENT '作成した顧客の id。⚠️ どのテーブルの id かは division を見る' AFTER `sync`;

-- ============================================================
-- 2. inquiry_ambassador（Instagram 公式アンバサダー）
-- ============================================================

-- ⚠️ shop / staff / sync / master_data_id は 2026-09-03_ambassador.sql で
--   既に作られている。ここで追加するのは division だけ。
ALTER TABLE `inquiry_ambassador`
  ADD COLUMN `division` VARCHAR(8) NOT NULL DEFAULT '注文'
      COMMENT '事業区分。注文／建売／中古。同期先のテーブルが変わる' AFTER `sync`;
