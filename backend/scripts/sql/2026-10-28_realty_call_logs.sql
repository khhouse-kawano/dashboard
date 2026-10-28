-- =====================================================================
-- 不動産企画係: 架電ナビの通話記録と、ロープレ練習の記録（v2.2.226）
--
-- 以前のアプリ（Supabase）の call_logs・practice_logs と同じ中身。
--   realty_call_logs     … 架電ナビの「記録して次へ」1回 = 1行（文字起こし・ヒアリングの詳細）
--   realty_practice_logs … ロープレ練習1回 = 1行（⚠️ v2.2.226 では以前の記録の取り込みだけ。練習の画面は移行中）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ローカルにも流す
-- ⚠️ 書き込むのは ② planner:navi_save（架電ナビ）と planner:call_logs_import / practice_logs_import（CSV の取り込み。マスターだけ）
-- ⚠️ 読むのは ② planner:call_logs（架電ナビの「履歴・分析」。不動産企画係の全員）
-- ⚠️ 文字起こし・ヒアリングの詳細は反響（brokerage_listings）には入れない（以前のアプリと同じ）
-- ⚠️ 日時は日本時間。⚠️ JSON の列（hearing など）は文字列のまま持つ
-- ⚠️ 2回流しても壊れない（IF NOT EXISTS）
-- =====================================================================
CREATE TABLE IF NOT EXISTS realty_call_logs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  src_id        VARCHAR(64)  NULL DEFAULT NULL COMMENT '以前のアプリ（Supabase）の id。CSV の取り込みの二重防止。Dashboard で記録した行は NULL',
  created_at    DATETIME     NOT NULL COMMENT '記録した日時（日本時間）',
  created_by    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '記録した人（Dashboard のログイン名。取り込みは空）',
  lead_id       VARCHAR(100) NULL DEFAULT NULL COMMENT '売り反響の id（brokerage_listings.id）。反響を選ばずに始めた通話は NULL',
  lead_kind     VARCHAR(20)  NULL DEFAULT NULL,
  staff         VARCHAR(64)  NOT NULL DEFAULT '' COMMENT 'ナビの画面の担当者（略称）',
  customer      VARCHAR(100) NOT NULL DEFAULT '',
  media         VARCHAR(100) NOT NULL DEFAULT '',
  address       VARCHAR(255) NOT NULL DEFAULT '',
  ms_name       VARCHAR(255) NOT NULL DEFAULT '',
  room          VARCHAR(50)  NOT NULL DEFAULT '',
  station       VARCHAR(100) NOT NULL DEFAULT '',
  prop_type     VARCHAR(20)  NOT NULL DEFAULT '',
  area          VARCHAR(50)  NOT NULL DEFAULT '',
  built         VARCHAR(50)  NOT NULL DEFAULT '',
  owner         VARCHAR(255) NOT NULL DEFAULT '',
  occupancy     VARCHAR(255) NOT NULL DEFAULT '',
  loan          VARCHAR(20)  NOT NULL DEFAULT '',
  loan_amount   VARCHAR(50)  NOT NULL DEFAULT '',
  wish_price    VARCHAR(100) NOT NULL DEFAULT '',
  wish_time     VARCHAR(100) NOT NULL DEFAULT '',
  temperature   VARCHAR(50)  NOT NULL DEFAULT '',
  reason        VARCHAR(20)  NOT NULL DEFAULT '',
  asker         VARCHAR(50)  NOT NULL DEFAULT '',
  status        VARCHAR(50)  NOT NULL DEFAULT '',
  outcome       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '通話結果（訪問アポ獲得・不在・不通 など）',
  next_action   TEXT         NULL,
  appt_at       DATETIME     NULL DEFAULT NULL COMMENT 'アポの日時（日本時間）',
  appt_place    VARCHAR(255) NULL DEFAULT NULL,
  started_at    DATETIME     NULL DEFAULT NULL COMMENT '通話開始（日本時間）',
  duration_sec  INT          NOT NULL DEFAULT 0,
  max_step      INT          NOT NULL DEFAULT 0 COMMENT 'どこまで進んだか（1〜9）',
  hearing       MEDIUMTEXT   NULL COMMENT 'ヒアリング（JSON。{項目: メモ}）',
  rebuttals     TEXT         NULL COMMENT '表示した切り返しの id（JSON 配列）',
  events        MEDIUMTEXT   NULL COMMENT '操作の記録（JSON 配列）',
  transcript    MEDIUMTEXT   NULL COMMENT '文字起こし（JSON 配列 [{t, x}]）',
  memo          TEXT         NULL COMMENT '通話メモ',
  app_ver       VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_realty_call_logs_src (src_id),
  KEY idx_realty_call_logs_created (created_at),
  KEY idx_realty_call_logs_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='不動産企画係: 架電ナビの通話記録（v2.2.226）';

CREATE TABLE IF NOT EXISTS realty_practice_logs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  src_id        VARCHAR(64)  NULL DEFAULT NULL COMMENT '以前のアプリ（Supabase）の id。CSV の取り込みの二重防止',
  created_at    DATETIME     NOT NULL COMMENT '練習した日時（日本時間）',
  staff         VARCHAR(64)  NOT NULL DEFAULT '',
  mode          VARCHAR(10)  NOT NULL DEFAULT '' COMMENT 'full＝通し練習 / kiwa＝引き際トレーニング',
  level         INT          NULL DEFAULT NULL,
  persona       TEXT         NULL COMMENT '売主の設定（JSON）',
  total         INT          NULL DEFAULT NULL,
  max_total     INT          NULL DEFAULT NULL,
  scores        TEXT         NULL COMMENT 'JSON',
  checklist     TEXT         NULL COMMENT 'JSON',
  result        MEDIUMTEXT   NULL COMMENT '採点の結果（JSON）',
  judge         MEDIUMTEXT   NULL COMMENT 'ナビ上の動き（JSON）',
  transcript    MEDIUMTEXT   NULL COMMENT '会話（JSON）',
  duration_sec  INT          NOT NULL DEFAULT 0,
  max_step      INT          NULL DEFAULT NULL,
  rebuttals     TEXT         NULL COMMENT 'JSON',
  appointment   TINYINT(1)   NULL DEFAULT NULL,
  app_ver       VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_realty_practice_logs_src (src_id),
  KEY idx_realty_practice_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='不動産企画係: ロープレ練習の記録（v2.2.226）';

-- 確認: 2行出ればよい
SELECT 'realty_call_logs' AS 表, COUNT(*) AS 件数 FROM realty_call_logs
UNION ALL
SELECT 'realty_practice_logs', COUNT(*) FROM realty_practice_logs;
