-- =====================================================================
-- analysis_report: Claude が書いた分析レポート（HTML）を保存する
--
-- ⚠️⚠️ **本文（HTML）をこの表に丸ごと入れる**（2026-09-21 の指示）。
--   ⚠️ ファイルとして ① に置く案もあったが、利用者が DB を選んだ。
--   ⚠️ ⚠️ **1件60KB前後になる。** ⚠️ 溜まってきたら古い版の整理を検討すること。
--
-- ⚠️ 入り口は2つある:
--   ⚠️ 1. ② の `POST /api/v1/analysis/report`（MCP から。⚠️ analysisKey 認証）
--   ⚠️ 2. 画面からの手動アップロード（他社動向 → Claudeによる競合分析）
--
-- ⚠️⚠️ **この HTML は画面で iframe の中に出す。**
--   ⚠️ ⚠️ **`sandbox="allow-scripts"` を必ず付け、`allow-same-origin` は付けないこと。**
--     ⚠️ 付けると、レポートの中のスクリプトから
--       ⚠️ **ダッシュボードのログイン情報を読めてしまう。**
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================

CREATE TABLE IF NOT EXISTS analysis_report (
  no          INT(11)      NOT NULL AUTO_INCREMENT,
  -- 画面の一覧に出す見出し。例: 競合別 勝因・敗因分析（前期）
  title       VARCHAR(255) NOT NULL,
  -- 分析の種類。いまは 'competitor' のみ。増えたら足す
  category    VARCHAR(64)  NOT NULL DEFAULT 'competitor',
  -- 'order'（注文事業）/ 'kaeru'（建売分譲事業）/ ''（全社）
  division    VARCHAR(32)  NOT NULL DEFAULT '',
  -- 分析の対象期間。⚠️ 自由記述（例: 2025/06〜2026/05）
  period      VARCHAR(64)  NOT NULL DEFAULT '',
  -- ⚠️⚠️ **HTML の本文そのもの**
  html        LONGTEXT     NOT NULL,
  -- 登録者（スタッフ名、または 'MCP'）
  staff       VARCHAR(128) NOT NULL DEFAULT '',
  -- ⚠️ 分析に使ったデータの時点。⚠️ **画面に必ず出す**（最新だと誤解させないため）
  data_as_of  DATE         DEFAULT NULL,
  created     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (no),
  KEY idx_category (category),
  KEY idx_created (created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
