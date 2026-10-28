-- =====================================================================
-- 不動産企画係: 取り込みを**取り消す**（控えに戻す）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️⚠️ 取り込みのあとに Dashboard で入った・直した内容（ポータルの取り込みを含む）も、控えの時点に戻る。
--   取り込みの結果がおかしいときだけ使う。流す前に開発に相談すること
-- ⚠️ 控え（2026-10-28_realty_import_1_backup.sql で作ったもの）が無いときは、1文目でエラーになって止まる（phpMyAdmin はエラーで止まる）
-- ⚠️ 控えが空のときは、DELETE の条件で何も消さない
-- =====================================================================

SELECT COUNT(*) AS 控えの件数 FROM brokerage_listings_bk_import;

START TRANSACTION;
DELETE FROM brokerage_listings WHERE (SELECT COUNT(*) FROM brokerage_listings_bk_import) > 0;
INSERT INTO brokerage_listings SELECT * FROM brokerage_listings_bk_import;
DELETE FROM app_state WHERE (SELECT COUNT(*) FROM app_state_bk_import) > 0;
INSERT INTO app_state SELECT * FROM app_state_bk_import WHERE NOT EXISTS (SELECT 1 FROM app_state);
COMMIT;

-- 確認: 本物と控えの件数が同じならよい
SELECT (SELECT COUNT(*) FROM brokerage_listings) AS 本物, (SELECT COUNT(*) FROM brokerage_listings_bk_import) AS 控え;
