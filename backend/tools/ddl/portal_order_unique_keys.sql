-- 注文事業のポータル反響取り込み（sync の *_order タスク）の UNIQUE キー。
--
-- ⚠️ **2026-09-04 に前提が変わった。この DDL はもう必須ではない。**
--
--   以前のハンドラは INSERT IGNORE / ON DUPLICATE KEY UPDATE を使っており、
--   これらのキーが無いと重複を一切防げなかった（実際に本番の homes_db /
--   inquiry_customer で重複が発生した）。
--
--   現在は core/bulk_upsert.php が **存在確認方式**（対象IDを1クエリで
--   まとめて SELECT し、未登録のものだけ INSERT）に変わっており、
--   UNIQUE キーが無くても重複しない。同一CSV内の重複も畳んでいる。
--
--   したがってこの DDL は「アプリが壊れたときの最後の砦」＝**多重防御**として
--   後から適用するものになった。重複データの掃除を待たずにアプリ側を
--   直せるようにするための設計変更である。
--
-- ⚠️⚠️ **inquiry_customer への UNIQUE 追加は影響範囲が広い。**
--   このテーブルはポータル4媒体以外（持ち家計画・土地新着ネット・SNS広告など）
--   からも書き込まれている。それらの取り込み経路が同じ inquiry_id を
--   再投入している場合、UNIQUE を張った瞬間にエラーで止まる。
--   手順1で他媒体の重複も必ず確認すること。
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
