-- =====================================================================
-- v2.2.227 担当事業の差し替えを戻す（2026-10-29_staff_shop_estate.sql の控え staff_shop_bk_227 から）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 控えにある人だけ、控えの担当事業に戻す。⚠️ 差し替えのあと権限編集で直した人も控えの値に戻る
-- =====================================================================
UPDATE staff s JOIN staff_shop_bk_227 b ON b.id = s.id SET s.shop = b.shop;

-- 確認: 控えと同じに戻ったか（0 ならよい）
SELECT COUNT(*) AS 戻っていない人 FROM staff s JOIN staff_shop_bk_227 b ON b.id = s.id WHERE s.shop <> b.shop;
