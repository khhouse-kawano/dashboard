-- ============================================================================
-- 世帯数内訳テーブルの作り直し
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db < このファイル
--
-- 背景
--   既存の households_c は 5県・470行だった。全国版の CSV
--   （households_c_all.csv、1,282地域 × 5種別 = 6,410行）を受領したので入れ替える。
--
--   delete_key は全行 '00_総数' で意味を持っていなかったため列ごと落とす。
--
-- 既存テーブルは DROP せず _backup_20260827 に退避する。
-- ============================================================================

SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'households_c') > 0
  AND (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'households_c_backup_20260827') = 0,
  'RENAME TABLE `households_c` TO `households_c_backup_20260827`',
  'DO 0'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE `households_c` (
  `no`                        int(11)     NOT NULL AUTO_INCREMENT,
  `pref`                      varchar(32) NOT NULL DEFAULT '' COMMENT '都道府県名',
  `area`                      varchar(64) NOT NULL DEFAULT '' COMMENT '市区町村名。県全域は households と同じく "-"',
  `type`                      varchar(16) NOT NULL DEFAULT '' COMMENT '住宅の建て方（総数/一戸建/長屋建/共同住宅/その他）',
  `amount`                    int(11)     NOT NULL DEFAULT 0  COMMENT '一般世帯数',
  `one_person_under65`        int(11)     NOT NULL DEFAULT 0,
  `one_person_under30`        int(11)     NOT NULL DEFAULT 0,
  `one_person_30_64`          int(11)     NOT NULL DEFAULT 0,
  `one_person_over65`         int(11)     NOT NULL DEFAULT 0,
  `wife_husband`              int(11)     NOT NULL DEFAULT 0,
  `wife_husband_over65`       int(11)     NOT NULL DEFAULT 0,
  `wife_husband_child_under3` int(11)     NOT NULL DEFAULT 0,
  `wife_husband_child_3_5`    int(11)     NOT NULL DEFAULT 0,
  `wife_husband_child_6_9`    int(11)     NOT NULL DEFAULT 0,
  `wife_husband_child_10_17`  int(11)     NOT NULL DEFAULT 0,
  `wife_husband_child_18_24`  int(11)     NOT NULL DEFAULT 0,
  `wife_husband_child_over25` int(11)     NOT NULL DEFAULT 0,
  PRIMARY KEY (`no`),
  -- 同じ地域・同じ建て方が二重に入ると世帯構成のグラフが倍になる。制約で止める。
  UNIQUE KEY `uq_pref_area_type` (`pref`, `area`, `type`),
  KEY `idx_area_type` (`area`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
