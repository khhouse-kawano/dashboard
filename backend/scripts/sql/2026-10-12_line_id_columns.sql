-- =====================================================================
-- v2.2.188: LINE ID（line_id）の列を追加する
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ローカルも同じSQL。
-- ⚠️ ② VPS・① PHP・フロントより **先に** 流すこと。
--   （⚠️ ② が line_id を保存・取得しに行ったとき、列が無いと Unknown column で保存ごと失敗する）
-- ⚠️ 何度流しても壊れない（ADD COLUMN IF NOT EXISTS）。⚠️ 既存の行は列を足したときに既定値で埋まる。
--
-- 1. form_database / form_table … フォームの項目設定（JSON）。⚠️ mail と同じ形の列を mail の次に。
--    ⚠️ 既定値の JSON で既存の全フォームが「表示・任意」になる。line_id を送らない古い保存処理でも INSERT は落ちない。
-- 2. 反響3テーブル・顧客3テーブル … 値（文字列）。⚠️ 空でよい（NULL）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. フォームの項目設定
-- ---------------------------------------------------------------------
ALTER TABLE form_database
    ADD COLUMN IF NOT EXISTS line_id LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
        DEFAULT '{"bool":true,"required":false,"text":"LINE IDをご入力ください"}'
        CHECK (json_valid(line_id))
        AFTER mail;

ALTER TABLE form_table
    ADD COLUMN IF NOT EXISTS line_id LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
        DEFAULT '{"bool":true,"required":false,"text":"LINE IDをご入力ください"}'
        CHECK (json_valid(line_id))
        AFTER mail;

-- ---------------------------------------------------------------------
-- 2. 反響（inquiry_customer*）・顧客（master_data*）
-- ---------------------------------------------------------------------
ALTER TABLE inquiry_customer        ADD COLUMN IF NOT EXISTS line_id TEXT DEFAULT NULL COMMENT 'LINE ID' AFTER mail;
ALTER TABLE inquiry_customer_kaeru  ADD COLUMN IF NOT EXISTS line_id TEXT DEFAULT NULL COMMENT 'LINE ID' AFTER mail;
ALTER TABLE inquiry_customer_resale ADD COLUMN IF NOT EXISTS line_id TEXT DEFAULT NULL COMMENT 'LINE ID' AFTER mail;

ALTER TABLE master_data        ADD COLUMN IF NOT EXISTS line_id TEXT DEFAULT NULL COMMENT 'LINE ID' AFTER customer_contacts_email;
ALTER TABLE master_data_kaeru  ADD COLUMN IF NOT EXISTS line_id TEXT DEFAULT NULL COMMENT 'LINE ID' AFTER customer_contacts_email;
ALTER TABLE master_data_resale ADD COLUMN IF NOT EXISTS line_id TEXT DEFAULT NULL COMMENT 'LINE ID' AFTER customer_contacts_email;

-- ---------------------------------------------------------------------
-- 確認（⚠️ information_schema は ① で使えないので使わない）
-- ---------------------------------------------------------------------
SELECT 'form_database' AS t, COUNT(*) AS rows_all, SUM(JSON_EXTRACT(line_id, '$.bool') = 'true') AS line_on FROM form_database
UNION ALL
SELECT 'form_table', COUNT(*), SUM(JSON_EXTRACT(line_id, '$.bool') = 'true') FROM form_table;

SELECT 'inquiry_customer' AS t, COUNT(line_id) AS filled FROM inquiry_customer
UNION ALL SELECT 'inquiry_customer_kaeru', COUNT(line_id) FROM inquiry_customer_kaeru
UNION ALL SELECT 'inquiry_customer_resale', COUNT(line_id) FROM inquiry_customer_resale
UNION ALL SELECT 'master_data', COUNT(line_id) FROM master_data
UNION ALL SELECT 'master_data_kaeru', COUNT(line_id) FROM master_data_kaeru
UNION ALL SELECT 'master_data_resale', COUNT(line_id) FROM master_data_resale;
