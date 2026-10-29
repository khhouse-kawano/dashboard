-- =====================================================================
-- v2.2.229 顧客DB の「削除済み」の印（delete_dashboard）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 実行順: ② の再ビルドより**前**に流す（② が delete_dashboard を読むため。無いと顧客DB・集計が 500 になる）
--
-- 1) master_data・master_data_kaeru・master_data_resale に delete_dashboard（TINYINT DEFAULT 0）を足す
--    ⚠️ IF NOT EXISTS なので2回流しても壊れない
-- 2) v2.2.227〜228 の個人情報削除で show_dashboard = 0（非表示）にした顧客を、
--    delete_dashboard = 1（削除済み）・show_dashboard = 1（集計に数える）に直す
--    対象: 顧客の変更履歴（master_data_log）に「個人情報削除」（source = privacy_erase）がある顧客のうち、
--          まだ非表示で、伏せ字（********）の列がある顧客
--    ⚠️ 2回目以降は対象 0 件（delete_dashboard = 0 の条件があるため）
-- =====================================================================

-- 1) 列を足す
ALTER TABLE master_data        ADD COLUMN IF NOT EXISTS delete_dashboard TINYINT DEFAULT 0;
ALTER TABLE master_data_kaeru  ADD COLUMN IF NOT EXISTS delete_dashboard TINYINT DEFAULT 0;
ALTER TABLE master_data_resale ADD COLUMN IF NOT EXISTS delete_dashboard TINYINT DEFAULT 0;

-- 2) 直す前の確認（件数だけ）
SELECT 'master_data' AS tbl, COUNT(*) AS cnt FROM master_data m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address)
UNION ALL
SELECT 'master_data_kaeru', COUNT(*) FROM master_data_kaeru m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address)
UNION ALL
SELECT 'master_data_resale', COUNT(*) FROM master_data_resale m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address);

-- 3) 直す
UPDATE master_data m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  SET m.delete_dashboard = 1, m.show_dashboard = 1
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address);
UPDATE master_data_kaeru m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  SET m.delete_dashboard = 1, m.show_dashboard = 1
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address);
UPDATE master_data_resale m
  JOIN (SELECT DISTINCT id FROM master_data_log WHERE JSON_VALID(log) AND JSON_VALUE(log, '$.source') = 'privacy_erase') l ON l.id = m.id
  SET m.delete_dashboard = 1, m.show_dashboard = 1
  WHERE m.delete_dashboard = 0 AND m.show_dashboard = 0
    AND '********' IN (m.customer_contacts_name, m.customer_contacts_phone_number, m.customer_contacts_mobile_phone_number, m.customer_contacts_email, m.full_address);

-- 4) 終わったあとの確認（削除済みの件数。2) の件数ぶん増えていればよい）
SELECT 'master_data' AS tbl, SUM(delete_dashboard = 1) AS deleted FROM master_data
UNION ALL SELECT 'master_data_kaeru', SUM(delete_dashboard = 1) FROM master_data_kaeru
UNION ALL SELECT 'master_data_resale', SUM(delete_dashboard = 1) FROM master_data_resale;
