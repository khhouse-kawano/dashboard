-- =====================================================================
-- v2.2.222 brokerage_listings に、本番の不動産企画係アプリ（V14.11〜）で増えた商談の項目を足す
--
--   reformPrice … リフォーム受注額（円）。売上には含めない参考値
--   reformGp    … リフォーム粗利（円）。売上計上額＝仲介手数料＋リフォーム粗利
--   reformNote  … リフォームの内容・備考
--   createdAt   … 商談リストへの登録日（YYYY-MM-DD）。朝礼用アラートの「直近14日の新規商談」に使う
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 何度流しても同じ（IF NOT EXISTS）
-- ⚠️ 既存の行は NULL のまま（今の DB の商談には入っていない。切り替えの日に本番アプリから取り込む）
-- =====================================================================
ALTER TABLE brokerage_listings
  ADD COLUMN IF NOT EXISTS `reformPrice` BIGINT NULL COMMENT 'リフォーム受注額（円・参考値）' AFTER `delivery`,
  ADD COLUMN IF NOT EXISTS `reformGp` BIGINT NULL COMMENT 'リフォーム粗利（円）' AFTER `reformPrice`,
  ADD COLUMN IF NOT EXISTS `reformNote` TEXT NULL COMMENT 'リフォームの内容・備考' AFTER `reformGp`,
  ADD COLUMN IF NOT EXISTS `createdAt` VARCHAR(32) NULL COMMENT '商談リストへの登録日（YYYY-MM-DD）' AFTER `reformNote`;
