-- =====================================================================
-- 不動産企画係: 以前のアプリのデータを取り込む**前に**流す（控えを作る）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 取り込みのたびに流す。⚠️ 前回の控えは消して作り直す（控えのテーブルだけを消す。本物の表には触らない）
-- ⚠️ 戻すときは 2026-10-28_realty_import_3_restore.sql
-- =====================================================================

DROP TABLE IF EXISTS brokerage_listings_bk_import;
CREATE TABLE brokerage_listings_bk_import LIKE brokerage_listings;
INSERT INTO brokerage_listings_bk_import SELECT * FROM brokerage_listings;

DROP TABLE IF EXISTS app_state_bk_import;
CREATE TABLE app_state_bk_import LIKE app_state;
INSERT INTO app_state_bk_import SELECT * FROM app_state;

-- 確認: 2行とも「本物」と「控え」の件数が同じならよい
SELECT 'brokerage_listings' AS 表, (SELECT COUNT(*) FROM brokerage_listings) AS 本物, (SELECT COUNT(*) FROM brokerage_listings_bk_import) AS 控え
UNION ALL
SELECT 'app_state', (SELECT COUNT(*) FROM app_state), (SELECT COUNT(*) FROM app_state_bk_import);
