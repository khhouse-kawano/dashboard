-- 注文事業のポータル反響取り込み（sync の *_order タスク）で必要な UNIQUE キー。
--
-- ハンドラは INSERT ... ON DUPLICATE KEY UPDATE / INSERT IGNORE で重複を防ぐため、
-- これらのキーが無いと実行のたびに重複行が増える。適用前に必ず下の重複確認を実施すること。
--
-- 対象カラムはすべて TEXT 型のため、インデックスには接頭辞長 191 を指定している
-- （utf8mb4 で 191 * 4 = 764 バイト。InnoDB の 767 バイト制限に収まる）。

-- ============================================================
-- 手順 1: 重複の有無を確認する（0 件であることを確認してから手順 2 へ）
-- ============================================================

SELECT 'suumo_db' AS table_name, id_suumo AS dup_key, COUNT(*) AS cnt
  FROM suumo_db     GROUP BY id_suumo     HAVING cnt > 1
UNION ALL
SELECT 'homes_db', id_homes, COUNT(*)
  FROM homes_db     GROUP BY id_homes     HAVING COUNT(*) > 1
UNION ALL
SELECT 'townlife_db', id_townlife, COUNT(*)
  FROM townlife_db  GROUP BY id_townlife  HAVING COUNT(*) > 1
UNION ALL
SELECT 'allGrit_db', id_allGrit, COUNT(*)
  FROM allGrit_db   GROUP BY id_allGrit   HAVING COUNT(*) > 1
UNION ALL
SELECT 'inquiry_customer', inquiry_id, COUNT(*)
  FROM inquiry_customer GROUP BY inquiry_id HAVING COUNT(*) > 1;

-- ============================================================
-- 手順 2: 重複が残っている場合のクリーニング（必要な場合のみ）
--         同じキーの行のうち id が最大のもの（最新）を残し、それ以外を削除する。
--         ※ 実行前に必ずバックアップを取得すること。
-- ============================================================

-- DELETE t FROM suumo_db t
--   JOIN (SELECT id_suumo, MAX(id) AS keep_id FROM suumo_db GROUP BY id_suumo HAVING COUNT(*) > 1) d
--     ON t.id_suumo = d.id_suumo AND t.id <> d.keep_id;

-- DELETE t FROM homes_db t
--   JOIN (SELECT id_homes, MAX(id) AS keep_id FROM homes_db GROUP BY id_homes HAVING COUNT(*) > 1) d
--     ON t.id_homes = d.id_homes AND t.id <> d.keep_id;

-- DELETE t FROM townlife_db t
--   JOIN (SELECT id_townlife, MAX(id) AS keep_id FROM townlife_db GROUP BY id_townlife HAVING COUNT(*) > 1) d
--     ON t.id_townlife = d.id_townlife AND t.id <> d.keep_id;

-- DELETE t FROM allGrit_db t
--   JOIN (SELECT id_allGrit, MAX(id) AS keep_id FROM allGrit_db GROUP BY id_allGrit HAVING COUNT(*) > 1) d
--     ON t.id_allGrit = d.id_allGrit AND t.id <> d.keep_id;

-- DELETE t FROM inquiry_customer t
--   JOIN (SELECT inquiry_id, MAX(id) AS keep_id FROM inquiry_customer GROUP BY inquiry_id HAVING COUNT(*) > 1) d
--     ON t.inquiry_id = d.inquiry_id AND t.id <> d.keep_id;

-- ============================================================
-- 手順 3: UNIQUE キーを追加する
-- ============================================================

-- 備考: HOME'S の来場予約は「来場予約問合せ番号」が問合せメールの「問合せ番号」と
--       別採番のため、id_homes に `reserve_` を付けて保存する（inquiry_id は
--       'homes<番号>' / 'homes_reserve<番号>'）。したがって単一の UNIQUE キーで足りる。
--       なお新方式の初回実行時、過去に 'homes<番号>' として登録済みだった来場予約は
--       'homes_reserve<番号>' として新規登録されるため、一度だけ重複が発生し得る。

ALTER TABLE `suumo_db`         ADD UNIQUE KEY `uk_suumo_db_id`        (`id_suumo`(191));
ALTER TABLE `homes_db`         ADD UNIQUE KEY `uk_homes_db_id`        (`id_homes`(191));
ALTER TABLE `townlife_db`      ADD UNIQUE KEY `uk_townlife_db_id`     (`id_townlife`(191));
ALTER TABLE `allGrit_db`       ADD UNIQUE KEY `uk_allgrit_db_id`      (`id_allGrit`(191));
ALTER TABLE `inquiry_customer` ADD UNIQUE KEY `uk_inquiry_customer_id`(`inquiry_id`(191));
