-- =====================================================================
-- v2.2.250 不動産企画係：媒介物件の表（連動トリガー仕様書 ②）  ①　表と列を足す
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② の更新より**前に**流す（② の媒介紐付がこの表・列を使う）
-- ⚠️ 何回流しても同じ（IF NOT EXISTS）
-- =====================================================================

-- 1. 媒介物件（自社が媒介・買取した物件そのもの。⚠️ property_db＝ポータルの掲載物件とは別物）
CREATE TABLE IF NOT EXISTS realty_properties (
  id            VARCHAR(40)  NOT NULL                                  COMMENT '物件 ID（移し替えは p + MD5 の先頭16桁、② は uid）',
  match_key     VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT '突き合わせ用（種別|c:地番 か 種別|a:住所[|建物名|部屋番号]。② の propertyKey.ts）',
  category      VARCHAR(30)  NULL                                      COMMENT '種別（台帳の区分と同じ値）',
  addr          VARCHAR(255) NULL                                      COMMENT '所在地（住居表示）',
  chiban        VARCHAR(100) NULL                                      COMMENT '地番（任意）',
  building_name VARCHAR(100) NULL                                      COMMENT '建物名（マンション）',
  room_no       VARCHAR(30)  NULL                                      COMMENT '部屋番号（マンション）',
  land_area     DECIMAL(10,2) NULL                                     COMMENT '土地面積（㎡）',
  building_area DECIMAL(10,2) NULL                                     COMMENT '建物面積（㎡）',
  built_year    VARCHAR(20)  NULL                                      COMMENT '築年（例: 1998・平成10年）',
  layout        VARCHAR(30)  NULL                                      COMMENT '間取り',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    VARCHAR(100) NULL,
  updated_at    DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_realty_properties_match_key (match_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='不動産企画係の媒介物件（v2.2.250。照合順序は brokerage_listings と同じ）';

-- 2. 台帳・売り反響（のちに買取案件も）から物件への紐づけ
ALTER TABLE brokerage_listings ADD COLUMN IF NOT EXISTS propertyId VARCHAR(40) NULL COMMENT '媒介物件（realty_properties.id。v2.2.250）';
ALTER TABLE brokerage_listings ADD INDEX IF NOT EXISTS idx_brokerage_listings_propertyId (propertyId);

-- 確認（どちらも結果が返ればよい）
SHOW CREATE TABLE realty_properties;
SHOW COLUMNS FROM brokerage_listings LIKE 'propertyId';
