-- =====================================================================
-- アクセス解析：自社のフォームでないサイトの CV（v2.2.205。まずはかえるホーム kaeruhome.jp）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何度流しても安全（IF NOT EXISTS）。
-- ⚠️ 書くのは ② の公開の受け口（POST /api/track/cv。GTM で入れた cv.js が「確認画面へ」を押したときに送る）。
-- ⚠️ メールアドレス・電話番号は**保存しない**。ブラウザで SHA-256 にした値だけを持つ（突き合わせのため）。
-- ⚠️ ② が5分ごとに反響（inquiry_customer_kaeru）のメール・電話を同じ方法でハッシュにして突き合わせ、
--   一致したら反響の landing_params に顧客ID（khg_vid）と着地の広告の情報を書く（features/tracking/cvMatch.ts）。
-- ⚠️ 14日たっても結びつかない行は ② が消す（確認画面で止めた人など）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS tracking_conversions (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id             INT UNSIGNED    NOT NULL,
    visitor_id          CHAR(36)        NOT NULL COMMENT '顧客ID（khg_vid）',
    form                VARCHAR(50)     NOT NULL DEFAULT '' COMMENT 'フォームの種類（ページのパスの1段目。member・shop_reserve など）',
    email_hash          CHAR(64)        NOT NULL DEFAULT '' COMMENT 'メールアドレス（小文字・前後の空白なし）の SHA-256。無ければ空',
    tel_hash            CHAR(64)        NOT NULL DEFAULT '' COMMENT '電話番号（数字だけ）の SHA-256。無ければ空',
    landing_params      VARCHAR(2000)   DEFAULT NULL COMMENT '送ったときにブラウザが覚えていた流入の情報（対象のキーと khg_vid だけ）',
    page_url            VARCHAR(2000)   DEFAULT NULL COMMENT 'フォームのページ（? 以降を除く）',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最後に送った日時',
    matched_inquiry_id  VARCHAR(255)    DEFAULT NULL COMMENT '結びついた反響の inquiry_id',
    matched_at          DATETIME        DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tracking_conversions (site_id, visitor_id, email_hash, tel_hash),
    KEY idx_tracking_conversions_open (matched_at, created_at),
    KEY idx_tracking_conversions_email (email_hash),
    KEY idx_tracking_conversions_tel (tel_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='アクセス解析：自社のフォームでないサイトの CV（v2.2.205）';

-- かえるホームの反響に、結びついた流入の情報（注文の inquiry_customer.landing_params と同じ形）
ALTER TABLE inquiry_customer_kaeru
    ADD COLUMN IF NOT EXISTS landing_params TEXT DEFAULT NULL COMMENT 'v2.2.205 サイトでの閲覧と結びついた流入の情報（khg_vid など）';

-- かえるホームの顧客にも（反響を顧客DBへ取り込むときに引き継ぐ。顧客情報の「HP閲覧履歴」が読む。2026-10-21 の追加の指示）
ALTER TABLE master_data_kaeru
    ADD COLUMN IF NOT EXISTS landing_params TEXT DEFAULT NULL COMMENT 'v2.2.205 反響から引き継いだ流入の情報（khg_vid など）';

SHOW TABLES LIKE 'tracking_conversions';
SHOW COLUMNS FROM inquiry_customer_kaeru LIKE 'landing_params';
SHOW COLUMNS FROM master_data_kaeru LIKE 'landing_params';
