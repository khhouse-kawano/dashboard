-- ============================================================================
-- Claude KPI分析の実行結果を保存するテーブル
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db < このファイル
--
-- 背景
--   kpi_analyze は1回あたり40〜60秒・十数円かかる。にもかかわらず結果は
--   画面を閉じた時点で失われていた。同じ分析を見返すためだけに再課金する
--   のは無駄なので、結果を保存して後から復元できるようにする。
--
-- なぜ HTML ではなく JSON で持つのか
--   結果画面のグラフは Recharts が kpi スナップショット（数値JSON）から
--   描画している。HTML を固めて保存すると、その時点の見た目は残っても
--   グラフのインタラクションは失われ、過去分析同士の比較にも使えない。
--   analysis（Claudeの解釈）と kpi（数値）を JSON のまま持てば、
--   既存の ClaudeAnalysisResult に渡すだけで同一の画面が復元できる。
--
--   ⚠️ kpi_json には顧客個人情報は含まれない。kpi.php が集計値しか
--     作らないため（full_address は都道府県・市区町村まで丸め済み）。
-- ============================================================================

CREATE TABLE IF NOT EXISTS `kpi_analysis_history` (
  `id`            bigint(20)   NOT NULL AUTO_INCREMENT,
  `staff_id`      int(11)      NOT NULL                COMMENT '実行者。staff.id',
  `usage_log_id`  bigint(20)   DEFAULT NULL            COMMENT 'ai_usage_log.id。コスト追跡用',

  -- 一覧表示用。例: 2026年8月27日 注文事業_鹿児島営業1課 反響推移の分析
  `title`         varchar(255) NOT NULL                COMMENT '一覧に出す見出し',
  `headline`      text         NOT NULL                COMMENT 'Claudeの総括1〜2文。一覧のサブテキスト',

  -- 復元と再実行に必要な条件
  `analysis_type` varchar(32)  NOT NULL                COMMENT 'inquiry_trend / shop / medium',
  `division`      varchar(16)  NOT NULL                COMMENT 'order / kaeru',
  `scope_section` varchar(100) DEFAULT NULL            COMMENT 'shop_list.section',
  `scope_shop`    varchar(100) DEFAULT NULL            COMMENT 'shop_list.shop',
  `scope_staff`   varchar(100) DEFAULT NULL            COMMENT 'staff_list.name',
  `scope_label`   varchar(255) NOT NULL DEFAULT ''     COMMENT '例: 注文事業 › 鹿児島営業1課',

  -- 画面の復元に使う本体。一覧では SELECT しないこと（重い）
  `analysis_json` longtext     NOT NULL                COMMENT 'StructuredAnalysis',
  `kpi_json`      longtext     NOT NULL                COMMENT 'AnySnapshot。グラフの元データ',

  `model`         varchar(64)  NOT NULL                COMMENT '例: claude-opus-5',
  `created_at`    datetime     NOT NULL DEFAULT current_timestamp(),

  PRIMARY KEY (`id`),
  KEY `idx_hist_staff` (`staff_id`, `created_at`),
  KEY `idx_hist_scope` (`division`, `analysis_type`, `created_at`),
  -- 実行者が退職して staff から消える運用は想定していないが、
  -- 消えたときに履歴まで巻き添えで消えないよう ON DELETE は付けない。
  CONSTRAINT `fk_hist_staff` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Claude KPI分析の保存結果';
