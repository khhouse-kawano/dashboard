-- =====================================================================
-- v2.2.189: フォームを埋め込んだページの URL パラメータ（? 以降）の列を追加する
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ローカルも同じSQL。
-- ⚠️ ② VPS・① PHP より **先に** 流すこと。
--   （⚠️ ② が url_params を保存・取得しに行ったとき、列が無いと Unknown column で反響ごと保存できない）
-- ⚠️ 何度流しても壊れない（ADD COLUMN IF NOT EXISTS）。
--
-- url_params     … 送信したページの ? 以降（# より前）をそのまま
-- landing_params … フォームを見た中で最後のパラメータ付きページの ? 以降（ページを移ってから送ったときのため）
-- ⚠️ どちらも空なら NULL。注文（inquiry_customer → master_data）だけ。かえる・中古は対象外。
-- =====================================================================

ALTER TABLE inquiry_customer
    ADD COLUMN IF NOT EXISTS url_params TEXT DEFAULT NULL COMMENT 'フォームを送信したページのURLパラメータ（?以降）' AFTER hotlead_url,
    ADD COLUMN IF NOT EXISTS landing_params TEXT DEFAULT NULL COMMENT '最後に見たパラメータ付きページのURLパラメータ（?以降）' AFTER url_params;

ALTER TABLE master_data
    ADD COLUMN IF NOT EXISTS url_params TEXT DEFAULT NULL COMMENT 'フォームを送信したページのURLパラメータ（?以降）' AFTER line_id,
    ADD COLUMN IF NOT EXISTS landing_params TEXT DEFAULT NULL COMMENT '最後に見たパラメータ付きページのURLパラメータ（?以降）' AFTER url_params;

-- ---------------------------------------------------------------------
-- 確認（⚠️ information_schema は ① で使えないので使わない）。⚠️ どれも 0（まだ値が無い）
-- ---------------------------------------------------------------------
SELECT 'inquiry_customer' AS t, COUNT(url_params) AS url_params, COUNT(landing_params) AS landing_params FROM inquiry_customer
UNION ALL
SELECT 'master_data', COUNT(url_params), COUNT(landing_params) FROM master_data;
