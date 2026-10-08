-- =====================================================================
-- v2.2.175: 顧客マスタ3表に「次回アクション日」（next_action_date）を追加する
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ ⚠️ **② と ① PHP を出す前に流すこと**（保存の許可リストに入るため、列が無いと保存が落ちる）
-- ⚠️ 値は 'YYYY-MM-DD'（他の KPI 列と同じ TEXT）。⚠️ 商談ステップの「次回アクション日」から入る。
--   ⚠️ ⚠️ **他の KPI 列と違い「一番新しい日付」を入れる**（次の予定なので）。
-- =====================================================================

ALTER TABLE master_data        ADD COLUMN next_action_date TEXT DEFAULT NULL COMMENT '次回アクション日（商談ステップの最新の予定日）';
ALTER TABLE master_data_kaeru  ADD COLUMN next_action_date TEXT DEFAULT NULL COMMENT '次回アクション日（商談ステップの最新の予定日）';
ALTER TABLE master_data_resale ADD COLUMN next_action_date TEXT DEFAULT NULL COMMENT '次回アクション日（商談ステップの最新の予定日）';
