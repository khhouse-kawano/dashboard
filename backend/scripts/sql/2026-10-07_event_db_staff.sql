-- =====================================================================
-- event_db に staff（担当スタッフ）を追加する（v2.2.171）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️⚠️ **② と ① PHP を出す前に流すこと。**（② は SELECT * なので列が無くても落ちないが、
--   ⚠️ 保存時に Unknown column になる）
--
-- ⚠️ 入力は反響一覧（EventList.tsx）から。⚠️ 自由入力の TEXT。
-- =====================================================================

ALTER TABLE event_db ADD COLUMN staff TEXT DEFAULT NULL COMMENT '担当スタッフ（反響一覧で入力）' AFTER remarks;

-- 確認（⚠️ information_schema は ① で使えないため SHOW COLUMNS）
-- SHOW COLUMNS FROM event_db LIKE 'staff';
