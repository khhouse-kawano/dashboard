-- =====================================================================
-- event_db に festa（営業入力）を追加する（v2.2.172）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️⚠️ **② と ① PHP とフロントを出す前に流すこと。**
--
-- ⚠️ 中身は JSON（例: {"KH_interview": true, "KH_next": false}）。
--   ⚠️ キーは「ブランド_interview（面談）／ブランド_next（次アポ）」。⚠️ 無いキーは FALSE 扱い。
-- ⚠️ 書き込みは ② が JSON_SET で1項目ずつ行う（⚠️ 同時に押しても他の人の値を消さない）。
-- =====================================================================

ALTER TABLE event_db ADD COLUMN festa LONGTEXT DEFAULT NULL COMMENT 'おうちづくりフェスタ2026 の営業入力（JSON）' AFTER staff;

-- 確認（⚠️ information_schema は ① で使えないため SHOW COLUMNS）
-- SHOW COLUMNS FROM event_db LIKE 'festa';
