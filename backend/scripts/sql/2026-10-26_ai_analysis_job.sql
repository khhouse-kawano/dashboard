-- =====================================================================
-- v2.2.217 「Claudeによる分析」（Dashboard からの自由分析）の実行記録と結果
--
-- 1行が分析1回。② が受け付けた時点で queued、Claude が動いている間は running、
-- レポートが届いたら done、失敗したら error になる。
-- 画面は status を数秒ごとに読みに来る（ai_analysis_status）。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。② も同じ DB を使う。
-- ⚠️ html は Claude が書いた HTML。画面では iframe（sandbox）の中でしか表示しない。
-- =====================================================================
CREATE TABLE IF NOT EXISTS ai_analysis_job (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_id        INT          NOT NULL COMMENT '実行した人（staff.id）',
  staff_name      VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '実行した人の名前（staff.name の写し）',
  status          ENUM('queued','running','done','error') NOT NULL DEFAULT 'queued',
  prompt          TEXT         NOT NULL COMMENT '利用者が書いた依頼文',
  division        VARCHAR(16)  NOT NULL COMMENT 'order（注文）/ kaeru（建売）',
  section         VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '課。空は事業部全体',
  shop            VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '店舗。空は課（または事業部）全体',
  period_from     CHAR(7)      NOT NULL COMMENT 'YYYY-MM',
  period_to       CHAR(7)      NOT NULL COMMENT 'YYYY-MM',
  progress        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '画面に出す途中経過（例: 店舗別の実績を集計中）',
  tool_calls      INT          NOT NULL DEFAULT 0 COMMENT 'Claude がデータを取りに行った回数',
  title           VARCHAR(255) NOT NULL DEFAULT '',
  summary         TEXT         NULL COMMENT '一覧に出す要約（1〜3文）',
  html            LONGTEXT     NULL COMMENT 'レポート本文',
  model           VARCHAR(64)  NOT NULL DEFAULT '',
  input_tokens    INT          NULL,
  output_tokens   INT          NULL,
  cost_usd        DECIMAL(10,5) NULL,
  error_message   VARCHAR(500) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at      DATETIME     NULL,
  finished_at     DATETIME     NULL,
  deleted_at      DATETIME     NULL COMMENT '削除した日時。⚠️ 行は消さない（消すと1日の実行回数が減り、上限をすり抜けられる）',
  PRIMARY KEY (id),
  KEY idx_staff_created (staff_id, created_at),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Claudeによる分析（v2.2.217）';
