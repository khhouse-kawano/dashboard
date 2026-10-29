-- =====================================================================
-- v2.2.228 担当事業 estate（v2.2.227 で足した「建売・中古・不動産企画係」）をなくす前の後始末
--
-- v2.2.228 で担当事業の入れる範囲を「order 注文／spec 建売／used・realty 中古・不動産企画係」にし、estate はなくした。
-- estate の人が残っていると、v2.2.228 ではどの事業にも入れなくなるので、元の担当事業に戻す。
--
-- 本番の状況（2026-10-29）: 2026-10-29_staff_shop_estate.sql を流したあと、2026-10-29_staff_shop_estate_restore.sql で戻した。
--   → ふつうは estate の人は 0 人で、このファイルを流しても何も変わらない（念のための確かめと後始末）。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ v2.2.228 の ② と ① PHP・フロントを出す**前**に流す
-- ⚠️ 2回流しても壊れない（estate の人だけを戻す）
-- ⚠️ 控えの表 staff_shop_bk_227 は 2026-10-29_staff_shop_estate.sql が作ったもの。
--   無い環境（estate の SQL を一度も流していない）では 1) と 2) が「Table ... doesn't exist」になる。そのときは 3) だけ流せばよい
-- =====================================================================

-- 1) 確認: いま estate の人と、控えにある元の担当事業（0行ならよい。2) は何も変えない）
SELECT s.id, s.name, s.brand, s.shop AS 今, b.shop AS 控えの元の担当事業
  FROM staff s
  LEFT JOIN staff_shop_bk_227 b ON b.id = s.id
 WHERE s.shop = 'estate'
 ORDER BY s.id;

-- 2) 控えにある人を元の担当事業に戻す（estate の人だけ）
UPDATE staff s JOIN staff_shop_bk_227 b ON b.id = s.id
   SET s.shop = b.shop
 WHERE s.shop = 'estate';

-- 3) 確認: まだ estate の人（0行ならよい）。⚠️ 出たら、控えに無い人（あとから権限編集で estate にした人）。
--    ヘッダーの「システム管理 → 権限編集」で、order / spec / used / realty / all のどれかに直す
SELECT id, name, brand, shop FROM staff WHERE shop = 'estate' ORDER BY id;

-- 4) 確認: 担当事業ごとの人数（estate が出なければよい）
SELECT shop AS 担当事業, COUNT(*) AS 人数 FROM staff GROUP BY shop ORDER BY shop;
