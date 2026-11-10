-- =====================================================================
-- v2.2.259 sync（Heroku の自動取り込み）の実行結果の表
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② の更新より**前に**流す（② が書き込む）
-- ⚠️ 何回流しても同じ（IF NOT EXISTS）
-- ⚠️ 180日より古い行は ② が毎日消す（features/syncLog）
-- =====================================================================

CREATE TABLE IF NOT EXISTS sync_run_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id       VARCHAR(40)  NOT NULL                 COMMENT '1回の呼び出しの ID（同じ呼び出しで流れたタスクは同じ値）',
  route        VARCHAR(100) NOT NULL                 COMMENT '呼ばれた入口（/api/portal_kaeru など）',
  task         VARCHAR(100) NOT NULL                 COMMENT 'タスク名（property・suumo_resale など。入口だけの処理は入口名）',
  status       VARCHAR(10)  NOT NULL                 COMMENT 'success＝成功・partial＝最後まで動いたが途中で失敗あり・failure＝止まった',
  message      VARCHAR(500) NULL                     COMMENT '一行の結果',
  errors       MEDIUMTEXT   NULL                     COMMENT '失敗の理由（JSON の文字列の配列）',
  started_at   DATETIME     NOT NULL                 COMMENT '開始（日本時間）',
  finished_at  DATETIME     NOT NULL                 COMMENT '終了（日本時間）',
  duration_ms  INT UNSIGNED NOT NULL DEFAULT 0       COMMENT 'かかった時間（ミリ秒）',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sync_run_log_task (task, started_at),
  KEY idx_sync_run_log_status (status, started_at),
  KEY idx_sync_run_log_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='sync の実行結果（v2.2.259。② の sync_log:write が書く）';

-- 確認（結果が返ればよい）
SHOW CREATE TABLE sync_run_log;
