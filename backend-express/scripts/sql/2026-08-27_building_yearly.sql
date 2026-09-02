-- ============================================================================
-- 建築着工（年次）テーブル
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -p<PASS> local_db < このファイル
--
-- 背景
--   既存の building は月次だが 2025-01〜2025-10 の10か月分しか無く、経年比較ができない。
--   e-Stat の API を調べたところ、
--     ・月次 × 市区町村 × 利用関係別（持家/分譲）の統計表は存在しない
--       （月次で利用関係別があるのは市部のみ、町村を含むものは床面積のみ）
--     ・年次 × 市区町村 × 利用関係別なら統計表 0003114522 が 2011〜2024 を持つ
--   という状況だった。
--   そこで月次の building はそのまま残し、経年比較用に年次を別テーブルで持つ。
--   画面側で「月次／年次」を切り替える。
--
-- building との違い
--   ・year が 'YYYY/MM' ではなく西暦の整数
--   ・area = '-' の県全域行がある（building には無く、市区町村の足し上げで代用していた）
--   ・areaCode（e-Stat の全国地方公共団体コード）を持つので、市町村合併があっても追える
-- ============================================================================

CREATE TABLE IF NOT EXISTS `building_yearly` (
  `id`           int(11)      NOT NULL AUTO_INCREMENT,
  `pref`         varchar(32)  NOT NULL DEFAULT ''  COMMENT '都道府県名',
  `area`         varchar(64)  NOT NULL DEFAULT ''  COMMENT '市区町村名。県全域は building と同じく "-"',
  `areaCode`     varchar(8)   NOT NULL DEFAULT ''  COMMENT 'e-Stat の地域コード（例 46201=鹿児島市）',
  `year`         smallint(6)  NOT NULL             COMMENT '西暦',
  `amount`       int(11)      NOT NULL DEFAULT 0   COMMENT '新設住宅 合計戸数',
  `owner`        int(11)      NOT NULL DEFAULT 0   COMMENT '持家。注文住宅のシェアの分母',
  `rent`         int(11)      NOT NULL DEFAULT 0   COMMENT '貸家',
  `employer`     int(11)      NOT NULL DEFAULT 0   COMMENT '給与住宅',
  `condominiums` int(11)      NOT NULL DEFAULT 0   COMMENT '分譲住宅。建売のシェアの分母',
  PRIMARY KEY (`id`),
  -- 同じ地域・同じ年が二重に入らないようにする。再取り込みは UPSERT で行う。
  UNIQUE KEY `uq_area_year` (`areaCode`, `year`),
  KEY `idx_pref_year` (`pref`, `year`),
  KEY `idx_area` (`area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
