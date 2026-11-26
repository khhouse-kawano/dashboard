-- =====================================================================
-- v2.2.303 ランクの翌月・翌々月が「2026/13」になる不具合を直す ＋ 保存済みの対象月を直す ＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（mysql / phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.303', '2026-11-26', 'ランクの表で、12月の翌月・翌々月が「2026/13」と出ていたのを「2027/01」「2027/02」に直しました。「2026/13」で保存されていた対象月も「2027/01」に直しました。');

-- ---------------------------------------------------------------
-- 対象月（rank_period）の「YYYY/13」「YYYY/14」を翌年の 01・02 に直す（v2.2.302 までの画面が、12月・11月の翌月を月＋1・＋2 で作っていたため）
-- ⚠️ 2026-11-26 の本番のバックアップでは master_data に「2026/13」が36件。master_data_kaeru・master_data_resale は0件（念のため同じ式で直す）
-- 確認：SELECT rank_period, COUNT(*) FROM master_data WHERE rank_period REGEXP '^[0-9]{4}/1[34]$' GROUP BY rank_period;
-- ---------------------------------------------------------------
UPDATE master_data SET rank_period = CONCAT(LEFT(rank_period, 4) + 1, '/0', RIGHT(rank_period, 2) - 12) WHERE rank_period REGEXP '^[0-9]{4}/1[34]$';
UPDATE master_data_kaeru SET rank_period = CONCAT(LEFT(rank_period, 4) + 1, '/0', RIGHT(rank_period, 2) - 12) WHERE rank_period REGEXP '^[0-9]{4}/1[34]$';
UPDATE master_data_resale SET rank_period = CONCAT(LEFT(rank_period, 4) + 1, '/0', RIGHT(rank_period, 2) - 12) WHERE rank_period REGEXP '^[0-9]{4}/1[34]$';
