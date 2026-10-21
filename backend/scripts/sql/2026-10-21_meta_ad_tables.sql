-- =====================================================================
-- Meta 広告（自社）の成果を取り込む表（v2.2.203）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何度流しても安全（IF NOT EXISTS）。
-- ⚠️ 取り込みは ②（backend-express/src/features/metaAds/）。.env の META_ACCESS_TOKEN・META_AD_ACCOUNTS（キャンペーンID）を使う。
-- ⚠️ 既存の meta_ads は他社の広告ライブラリ（週1の収集）。名前が似ているが別物。
-- ⚠️ 広告ID は tracking_touches.utm_content（Meta の URL パラメータ {{ad.id}}）と同じ値。
-- =====================================================================

CREATE TABLE IF NOT EXISTS meta_ad_items (
    ad_id          VARCHAR(32)   NOT NULL COMMENT 'Meta の広告ID',
    brand          VARCHAR(20)   NOT NULL DEFAULT '' COMMENT 'ブランドキー（META_AD_ACCOUNTS の左側。tracking_sites.brand と同じ）',
    campaign_id    VARCHAR(32)   NOT NULL DEFAULT '',
    campaign_name  VARCHAR(255)  NOT NULL DEFAULT '',
    adset_id       VARCHAR(32)   NOT NULL DEFAULT '',
    adset_name     VARCHAR(255)  NOT NULL DEFAULT '',
    ad_name        VARCHAR(255)  NOT NULL DEFAULT '',
    status         VARCHAR(40)   NOT NULL DEFAULT '' COMMENT 'effective_status（ACTIVE・PAUSED など）',
    thumbnail_url  TEXT          DEFAULT NULL COMMENT '⚠️ 数日で期限が切れる。取り込みのたびに上書き',
    image_url      TEXT          DEFAULT NULL,
    imported_at    DATETIME      NOT NULL,
    PRIMARY KEY (ad_id),
    KEY idx_meta_ad_items_brand (brand),
    KEY idx_meta_ad_items_campaign (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Meta 広告（自社）の一覧（v2.2.203）';

CREATE TABLE IF NOT EXISTS meta_ad_daily (
    ad_id        VARCHAR(32)    NOT NULL,
    day          DATE           NOT NULL,
    impressions  INT UNSIGNED   NOT NULL DEFAULT 0,
    clicks       INT UNSIGNED   NOT NULL DEFAULT 0 COMMENT 'リンクのクリック（inline_link_clicks）',
    spend        DECIMAL(12,2)  NOT NULL DEFAULT 0 COMMENT '費用（円）',
    imported_at  DATETIME       NOT NULL,
    PRIMARY KEY (ad_id, day),
    KEY idx_meta_ad_daily_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Meta 広告（自社）の日別の数字（v2.2.203。直近35日を取り込むたびに上書き）';

-- 確認（2行出ればよい）
SHOW TABLES LIKE 'meta_ad_items';
SHOW TABLES LIKE 'meta_ad_daily';
