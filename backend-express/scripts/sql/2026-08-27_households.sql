-- ============================================================================
-- 世帯総数テーブルの作り直し
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db < このファイル
--
-- 背景
--   既存の households は 5県・190行で、しかも同じ (pref, area) が2回入っていた。
--   year 列が空のまま新旧2世代が積まれていたのが原因で、
--   API 側で「no が小さい方を採る」という当て推量で回避していた。
--
--   全国版の CSV（households_all.csv）を受領したので入れ替える。
--   この CSV も2世代が連結されているが、
--     新しい世代 … 県全域行の area が '-'
--     古い世代   … 県全域行の area が県名（例「佐賀県」）
--   と区別がつくため、取り込み時に新しい方だけを採れる。
--   取り込み後は (pref, area) が一意になり、当て推量が不要になる。
--
-- 既存テーブルは DROP せず _backup_20260827 に退避する。
-- ============================================================================

SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'households') > 0
  AND (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'households_backup_20260827') = 0,
  'RENAME TABLE `households` TO `households_backup_20260827`',
  'DO 0'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE `households` (
  `no`              int(11)     NOT NULL AUTO_INCREMENT,
  `pref`            varchar(32) NOT NULL DEFAULT ''  COMMENT '都道府県名',
  `area`            varchar(64) NOT NULL DEFAULT ''  COMMENT '市区町村名。県全域は "-"',
  `year`            varchar(16) NOT NULL DEFAULT ''  COMMENT '調査年。元データに無いため空',
  `amount`          int(11)     NOT NULL DEFAULT 0   COMMENT '一般世帯総数',
  `one_person`      int(11)     NOT NULL DEFAULT 0   COMMENT '単独世帯',
  `more_two_people` int(11)     NOT NULL DEFAULT 0   COMMENT '2人以上の世帯',
  `live_together`   int(11)     NOT NULL DEFAULT 0   COMMENT '間借り・同居など',
  PRIMARY KEY (`no`),
  -- 取り込み時に新旧2世代のうち新しい方だけを残すので、これで一意になる。
  -- 重複が入ると世帯数が二重に見えるため、制約で止める。
  UNIQUE KEY `uq_pref_area` (`pref`, `area`),
  KEY `idx_area` (`area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
