-- =====================================================================
-- アクセス解析：ページの閲覧（1ページ＝1行）と、消さない顧客ID（v2.2.203）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何度流しても安全（IF NOT EXISTS）。
-- ⚠️ 書くのは ② の公開の受け口（POST /api/track/pv。tracker.js がページを開くたびに送る）。
-- ⚠️ 行数の上限（② の features/tracking/maintenance.ts。50万行）を超えたら、tracking_keep_visitors に無い顧客ID の古い行から消す。
--   ⚠️ CV が起きた人（inquiry_customer.landing_params の khg_vid）と、有効名簿の人（master_data.landing_params の khg_vid）は消さない（MA 用）。
-- ⚠️ URL は ? 以降を保存しない（個人を特定できる値がパラメータに入ることがあるため）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS tracking_pageviews (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id     INT UNSIGNED    NOT NULL,
    visitor_id  CHAR(36)        NOT NULL COMMENT '顧客ID（khg_vid）',
    visit_id    CHAR(36)        NOT NULL COMMENT '訪問ID（30分以内の移動は同じ）',
    url         VARCHAR(2000)   NOT NULL COMMENT '見たページ（? 以降を除く）',
    title       VARCHAR(255)    DEFAULT NULL,
    prev_url    VARCHAR(2000)   DEFAULT NULL COMMENT '同じ訪問のひとつ前のページ（訪問の最初のページは NULL）',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tracking_pageviews_site_time (site_id, created_at),
    KEY idx_tracking_pageviews_visitor (visitor_id, created_at),
    KEY idx_tracking_pageviews_visit (visit_id),
    KEY idx_tracking_pageviews_url (site_id, url(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='アクセス解析：ページの閲覧1回=1行（v2.2.203）';

CREATE TABLE IF NOT EXISTS tracking_keep_visitors (
    visitor_id  CHAR(36)     NOT NULL,
    reason      VARCHAR(20)  NOT NULL COMMENT 'cv（反響あり）／ master（有効名簿）',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (visitor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='アクセス解析：閲覧の記録を消さない顧客ID（CV・有効名簿。v2.2.203）';

-- 確認（2行出ればよい）
SHOW TABLES LIKE 'tracking_pageviews';
SHOW TABLES LIKE 'tracking_keep_visitors';
