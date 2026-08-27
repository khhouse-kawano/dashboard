-- ============================================================================
-- 建築着工（月次）テーブルの作り直し
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db < このファイル
--
-- 背景
--   既存の building は 5県・2025-01〜2025-10 の 1,483行しか無かった。
--   全都道府県・2025-01〜2026-06 の CSV（32,021行）を受領したので入れ替える。
--
--   e-Stat の API には「月次 × 市区町村（町村含む）× 利用関係別」の統計表が無いため、
--   このテーブルだけは今後も CSV での更新になる。
--
-- 既存テーブルは DROP せず _backup_20260827 に退避する。
-- ============================================================================

SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'building') > 0
  AND (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'building_backup_20260827') = 0,
  'RENAME TABLE `building` TO `building_backup_20260827`',
  'DO 0'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- 列は旧 building と同じ。型と索引だけ整える。
--
--   year は 'YYYY/MM' の文字列のまま。旧実装や既存クエリが
--   この書式に依存しているため、ここで変えると影響範囲が広がる。
--   API 側で 'YYYY-MM' に直して返している。
--
--   (pref, area, year) に UNIQUE を張らない点に注意。
--   政令市の同名区（横浜市南区と相模原市南区など）が同じ (県, 区名) で
--   別々の行として存在するため、一意にならない。九州5県には区が無いので
--   実害は無いが、制約を張ると取り込みが落ちる。
-- ---------------------------------------------------------------------------
CREATE TABLE `building` (
  `no`           int(11)     NOT NULL AUTO_INCREMENT,
  `pref`         varchar(32) NOT NULL DEFAULT ''  COMMENT '都道府県名',
  `area`         varchar(64) NOT NULL DEFAULT ''  COMMENT '市区町村名。郡・区の行も含む',
  `year`         varchar(16) NOT NULL DEFAULT ''  COMMENT '"YYYY/MM"',
  `amount`       int(11)     NOT NULL DEFAULT 0   COMMENT '新設住宅 合計戸数',
  `owner`        int(11)     NOT NULL DEFAULT 0   COMMENT '持家。注文住宅のシェアの分母',
  `rent`         int(11)     NOT NULL DEFAULT 0   COMMENT '貸家',
  `employer`     int(11)     NOT NULL DEFAULT 0   COMMENT '給与住宅',
  `condominiums` int(11)     NOT NULL DEFAULT 0   COMMENT '分譲住宅。建売のシェアの分母',
  PRIMARY KEY (`no`),
  KEY `idx_pref_year` (`pref`, `year`),
  KEY `idx_area` (`area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
