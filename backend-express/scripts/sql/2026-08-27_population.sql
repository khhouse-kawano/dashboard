-- ============================================================================
-- 人口テーブルの作り直し
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db < このファイル
--
-- 背景
--   既存の population は5県・582行だった。福岡県を市況分析の対象に加えるため、
--   全国版CSV（population_all.csv）から対象県ぶんを取り込み直す。
--
--   このテーブルは市況表の「行」を決める土台になっている。
--   都道府県の選択肢も、他テーブルの絞り込みも、すべてここを基準にしているため、
--   対象県を増やすときは必ずここへ先に入れること。
--
-- 既存テーブルは DROP せず _backup_20260827 に退避する。
-- ============================================================================

SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'population') > 0
  AND (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'population_backup_20260827') = 0,
  'RENAME TABLE `population` TO `population_backup_20260827`',
  'DO 0'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE `population` (
  `no`        int(11)     NOT NULL AUTO_INCREMENT,
  `pref`      varchar(32) NOT NULL DEFAULT ''  COMMENT '都道府県名',
  `area`      varchar(64) NOT NULL DEFAULT ''  COMMENT '市区町村名。県全域は "-"',
  `gender`    varchar(8)  NOT NULL DEFAULT ''  COMMENT '計 / 男 / 女',
  `year`      varchar(16) NOT NULL DEFAULT ''  COMMENT '調査年',
  `amount`    int(11)     NOT NULL DEFAULT 0   COMMENT '総人口。年齢不詳を含むため世代の合計とは一致しない',
  `age_0_4`   int(11)     NOT NULL DEFAULT 0,
  `age_5_9`   int(11)     NOT NULL DEFAULT 0,
  `age_10_14` int(11)     NOT NULL DEFAULT 0,
  `age_15_19` int(11)     NOT NULL DEFAULT 0,
  `age_20_24` int(11)     NOT NULL DEFAULT 0,
  `age_25_29` int(11)     NOT NULL DEFAULT 0,
  `age_30_34` int(11)     NOT NULL DEFAULT 0,
  `age_35_39` int(11)     NOT NULL DEFAULT 0,
  `age_40_44` int(11)     NOT NULL DEFAULT 0,
  `age_45_49` int(11)     NOT NULL DEFAULT 0,
  `age_50_54` int(11)     NOT NULL DEFAULT 0,
  `age_55_59` int(11)     NOT NULL DEFAULT 0,
  `age_60_64` int(11)     NOT NULL DEFAULT 0,
  `age_65_69` int(11)     NOT NULL DEFAULT 0,
  `age_70_74` int(11)     NOT NULL DEFAULT 0,
  `age_75_79` int(11)     NOT NULL DEFAULT 0,
  `age_80_84` int(11)     NOT NULL DEFAULT 0,
  `age_85_89` int(11)     NOT NULL DEFAULT 0,
  `age_90_94` int(11)     NOT NULL DEFAULT 0,
  `age_95_99` int(11)     NOT NULL DEFAULT 0,
  `age_100_`  int(11)     NOT NULL DEFAULT 0,
  PRIMARY KEY (`no`),
  -- 同じ地域・性別が二重に入ると行が重複して表が壊れる。制約で止める。
  UNIQUE KEY `uq_pref_area_gender_year` (`pref`, `area`, `gender`, `year`),
  KEY `idx_pref_gender` (`pref`, `gender`),
  KEY `idx_area` (`area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
