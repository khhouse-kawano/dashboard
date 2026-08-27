-- ============================================================================
-- 市況分析（Market）の着工データ基盤
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -plocal_password local_db < このファイル
--
-- 背景
--   Market.tsx は「KHGの着工棟数」を2系統から取っている。
--     注文 … contract_customer（契約者単位。スプレッドシート「受注完工【KHG】」由来）
--     建売 … kaeru_building  （物件単位。スプレッドシート「かえるホーム工程表」由来）
--   当初この2つを1本化する案だったが、実データを調べたところ統合できないと判明した。
--   建売は「物件を着工 → 完成 → 販売」の順で進むため、契約者一覧には
--   未販売の着工物件が構造上載らない（着工日の充足率が 11.7% しかない）。
--   よって2テーブル構成を維持し、それぞれをCSVの実態に合わせて作り直す。
--
-- 方針
--   既存テーブルは DROP せず _backup_20260826 にリネームして退避する。
--   取り込みは import-construction-csv.mjs / import-kaeru-csv.mjs が行う。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. 退避
--    RENAME は対象が無いとエラーになるため、存在するときだけ実行する。
--    （MariaDB に RENAME TABLE IF EXISTS が無いのでこの書き方になる）
-- ---------------------------------------------------------------------------
SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'contract_customer') > 0
  AND (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'contract_customer_backup_20260826') = 0,
  'RENAME TABLE `contract_customer` TO `contract_customer_backup_20260826`',
  'DO 0'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'kaeru_building') > 0
  AND (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'kaeru_building_backup_20260826') = 0,
  'RENAME TABLE `kaeru_building` TO `kaeru_building_backup_20260826`',
  'DO 0'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- 1. contract_customer … 注文住宅の契約者一覧
--
--    文字コードは utf8mb4。旧 utf8（3バイト）では「𠮷」「辻󠄀」等の
--    サロゲートペアを含む氏名 53件が格納できず、取り込みが失敗する。
--
--    日付列を text から date にする。元CSVには日付以外に
--    「未定」「解約」「未入力」「工程表無し」「-」が混在するため、
--    それらは日付列を NULL にしたうえで status 列に退避する。
--    値を捨てると「解約なのか単なる未入力なのか」が判別できなくなる。
-- ---------------------------------------------------------------------------
CREATE TABLE `contract_customer` (
  `id`               int(11)      NOT NULL AUTO_INCREMENT,
  `name`             varchar(255) NOT NULL DEFAULT ''  COMMENT '邸名（契約者名）',
  `contractDate`     date         DEFAULT NULL          COMMENT '契約計上年月日',
  `constructionDate` date         DEFAULT NULL          COMMENT '着工予定日（済は実績）',
  `completionDate`   date         DEFAULT NULL          COMMENT '完工予定日（済は実績）',
  `handoverDate`     date         DEFAULT NULL          COMMENT '引渡年月日（済は実績）',
  `status`           varchar(32)  NOT NULL DEFAULT ''   COMMENT '日付列に入っていた非日付値（解約/未定/未入力/工程表無し）',
  `staff`            varchar(128) NOT NULL DEFAULT ''   COMMENT '営業担当',
  `section`          varchar(64)  NOT NULL DEFAULT ''   COMMENT '営業所属課',
  `shop`             varchar(64)  NOT NULL DEFAULT ''   COMMENT '事業所',
  `category`         varchar(16)  NOT NULL DEFAULT ''   COMMENT '注文 / 建売。事業所に「かえる」を含むかで判定',
  `address`          varchar(255) NOT NULL DEFAULT ''   COMMENT '建築地',
  `pref`             varchar(32)  NOT NULL DEFAULT ''   COMMENT '県',
  `sourceRow`        int(11)      NOT NULL DEFAULT 0    COMMENT '元CSVの行番号（差し戻し調査用）',
  PRIMARY KEY (`id`),
  -- 市況表は「県・カテゴリ・着工日」で絞ってから件数を数えるだけなので、この3列で足りる
  KEY `idx_pref_category_construction` (`pref`, `category`, `constructionDate`),
  KEY `idx_construction` (`constructionDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- 2. kaeru_building … 建売（かえるホーム）の物件一覧
--
--    旧スキーマは (name, status, address, category, 日付3列) しか無く、
--    物件IDを持たないため差分更新ができなかった。物件名は2種が重複するので
--    キーには使えない。CSVの「物件ID」を主キーにする。
--
--    エリアは市区町村のみで県を持たない。取り込み時に population テーブルの
--    (pref, area) と突き合わせて pref を補完する。
--
--    旧 finishedDate は CSV の「引渡日」に対応するため handoverDate に改名した。
-- ---------------------------------------------------------------------------
CREATE TABLE `kaeru_building` (
  `property_id`      int(11)      NOT NULL              COMMENT '物件ID（CSV列0）',
  `name`             varchar(255) NOT NULL DEFAULT ''   COMMENT '物件名称',
  `use_code`         varchar(8)   NOT NULL DEFAULT ''   COMMENT '用途コード 0〜5（意味は未確認のため生値を保持）',
  `category`         varchar(16)  NOT NULL DEFAULT ''   COMMENT 'use_code から導出。建売 / 中古',
  `progress_status`  varchar(32)  NOT NULL DEFAULT ''   COMMENT '工程状況（完成済/着工前/建築中/その他）',
  `sales_status`     varchar(32)  NOT NULL DEFAULT ''   COMMENT '販売状況（引渡済/販売中/契約済/キャンセル 等）',
  `area`             varchar(64)  NOT NULL DEFAULT ''   COMMENT '市区町村',
  `pref`             varchar(32)  NOT NULL DEFAULT ''   COMMENT '県（population との突合で補完）',
  `constructionDate` date         DEFAULT NULL          COMMENT '基礎着工日。1970-01-01 は未入力とみなし NULL',
  `completionDate`   date         DEFAULT NULL          COMMENT '完工日',
  `handoverDate`     date         DEFAULT NULL          COMMENT '引渡日（旧 finishedDate）',
  `contractDate`     date         DEFAULT NULL          COMMENT '契約計上日',
  `staff`            varchar(128) NOT NULL DEFAULT ''   COMMENT '契約担当',
  PRIMARY KEY (`property_id`),
  KEY `idx_pref_area_construction` (`pref`, `area`, `constructionDate`),
  KEY `idx_construction` (`constructionDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- 3. population / households / households_c / building の索引
--    Market は毎回 (pref, area) で引くが索引が無く、全表走査になっていた。
--    ※ これらは e-Stat 由来の参照専用テーブル。列の変更はしない。
-- ---------------------------------------------------------------------------
ALTER TABLE `population`
  ADD INDEX IF NOT EXISTS `idx_pref_area_gender` (`pref`(32), `area`(64), `gender`(8));

ALTER TABLE `households`
  ADD INDEX IF NOT EXISTS `idx_pref_area` (`pref`(32), `area`(64));

ALTER TABLE `households_c`
  ADD INDEX IF NOT EXISTS `idx_pref_area_type` (`pref`(32), `area`(64), `type`(32));

ALTER TABLE `building`
  ADD INDEX IF NOT EXISTS `idx_pref_area_year` (`pref`(32), `area`(64), `year`(16));
