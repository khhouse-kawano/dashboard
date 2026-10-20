-- =====================================================================
-- 広告流入トラッキング（v2.2.199）の表を2つ作る
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。ローカルは docker exec で流す。
-- ⚠️ 何度流しても安全（CREATE TABLE IF NOT EXISTS）。⚠️ 既存の表（inquiry_customer など）は変えない。
-- ⚠️ 戻すとき: 2026-10-20_tracking_tables_rollback.sql
--
-- tracking_sites  … タグを貼るサイト（ダッシュボードの「反響管理 → トラッキング設定」で登録する）
-- tracking_touches … 広告などのパラメータ付きで着地した1回 = 1行（tracker.js → ② POST /api/track/touch）
--
-- ⚠️ 反響とは inquiry_customer.landing_params の khg_vid（無ければ gclid などのクリックID）で結びつける。
--   ⚠️ 外部キーは張らない（反響の表を変えないため）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS tracking_sites (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    site_key        VARCHAR(32)  NOT NULL COMMENT 'タグに埋め込むキー（s_＋16文字）。公開される識別子で、認証には使わない',
    name            VARCHAR(255) NOT NULL COMMENT 'サイト名',
    brand           VARCHAR(32)  DEFAULT NULL COMMENT 'ブランドキー（kh / djh / nagomi / fh / 2l / pg / jh / khf）',
    allowed_origins JSON         NOT NULL COMMENT '着地を受け付けるオリジン。例 ["https://kh-house.jp"]',
    is_active       TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0 = 無効（着地を保存しない）',
    memo            VARCHAR(500) NOT NULL DEFAULT '' COMMENT '社内メモ（設置場所など）',
    updated_by      VARCHAR(100) NOT NULL DEFAULT '' COMMENT '最後に登録・更新した人',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tracking_sites_key (site_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='広告流入トラッキング：タグを貼るサイト';

CREATE TABLE IF NOT EXISTS tracking_touches (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    site_id        BIGINT        NOT NULL COMMENT 'tracking_sites.id',
    visitor_id     CHAR(36)      NOT NULL COMMENT 'ブラウザの localStorage の khg_vid（UUID）',
    source         VARCHAR(200)  DEFAULT NULL COMMENT '流入元（フォームと同じ決め方：utm_source → Facebook/Instagram → Google → Yahoo → Flyer）',
    gclid          VARCHAR(500)  DEFAULT NULL,
    gbraid         VARCHAR(500)  DEFAULT NULL,
    wbraid         VARCHAR(500)  DEFAULT NULL,
    fbclid         VARCHAR(500)  DEFAULT NULL,
    yclid          VARCHAR(500)  DEFAULT NULL,
    gad_source     VARCHAR(100)  DEFAULT NULL,
    gad_campaignid VARCHAR(100)  DEFAULT NULL,
    utm_source     VARCHAR(500)  DEFAULT NULL,
    utm_medium     VARCHAR(500)  DEFAULT NULL,
    utm_campaign   VARCHAR(500)  DEFAULT NULL,
    utm_term       VARCHAR(500)  DEFAULT NULL,
    utm_content    VARCHAR(500)  DEFAULT NULL,
    flyer          VARCHAR(100)  DEFAULT NULL,
    landing_url    VARCHAR(2000) DEFAULT NULL COMMENT '着地したページ（? 以降を除く）',
    referrer       VARCHAR(2000) DEFAULT NULL,
    user_agent     VARCHAR(500)  DEFAULT NULL,
    ip_hash        CHAR(64)      DEFAULT NULL COMMENT 'IP は保存しない。SHA-256（ソルト付き）',
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tracking_touches_visitor (visitor_id),
    KEY idx_tracking_touches_gclid (gclid(100)),
    KEY idx_tracking_touches_fbclid (fbclid(100)),
    KEY idx_tracking_touches_yclid (yclid(100)),
    KEY idx_tracking_touches_site_time (site_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='広告流入トラッキング：パラメータ付きの着地1回=1行';

-- 確認（⚠️ information_schema は ① で使えないので SHOW を使う）
SHOW TABLES LIKE 'tracking_%';
