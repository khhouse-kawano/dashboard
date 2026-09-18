-- =====================================================================
-- budget テーブル：`買い:中古リノベ` を建売（spec）から中古（use）へ移す
--
-- ⚠️⚠️ **なぜ必要か**
--   `買い:中古リノベ` は**中古リノベの店舗**だが、`section = 'spec'`（建売）で
--   登録された行が混ざっていた。⚠️ そのため
--     ・店舗別広告費（ShopKaeru）の建売の総額に乗っていた
--     ・中古の画面（ShopTrendResale）には出ていなかった
--   ⚠️ 中身も南日本リビング新聞社・アートハンズ・Amazonギフトカードなど
--     **中古の実費**である。
--
-- ⚠️ 実行前（ローカル 2026-09-18 時点）
--     section = 'spec' / response_medium = 0 … 55件  ¥2,350,309
--     section = 'spec' / response_medium = 1 … 36件  ¥706,431
--     ⚠️ 合計 91件  ¥3,056,740
--
-- ⚠️⚠️ **`order_section` も空にすること。**
--   ⚠️ 移す行は `不動産営業1課`(54件) / `鹿児島営業1課`(1件) 等が入っているが、
--     ⚠️ **既存の `use` 530件はすべて空**である。
--   ⚠️ 揃えないと、⚠️ 今後 ShopTrendResale に課の絞り込みを足したときに
--     utils/budgetFilter.ts の `order_section` を見る分岐へ入り、
--     ⚠️ **この55件だけ挙動が変わる。**
--
-- ⚠️ `section` の値は **'use'**。⚠️ **'used' ではない**
--   （backend-express/src/features/shopTrend/queries.ts の SECTION を参照）。
--
-- ⚠️ 画面への影響（⚠️ **不具合ではない**）
--     ShopTrendResale「中古リノベ全体」 ¥30,586,708 → ¥32,937,017
--     ShopTrendResale「買い:中古リノベ」 ¥1,284,466 → ¥3,634,775（約2.8倍）
--     ShopKaeru（建売の総額）           ¥301,241,513 → ¥298,891,204
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 実行前に budget テーブルをエクスポートしておくこと。
-- =====================================================================

START TRANSACTION;

-- ⚠️ `response_medium` は 0 / 1 の両方を移す。⚠️ 事業の区分であって費目ではない。
UPDATE budget
   SET section = 'use',
       order_section = ''
 WHERE section = 'spec'
   AND shop = '買い:中古リノベ';

COMMIT;

-- =====================================================================
-- 確認用
-- ⚠️ 1本目: spec に `買い:中古リノベ` が **1件も残らないこと**
-- ⚠️ 2本目: use 側の `order_section` が **すべて空**であること
-- =====================================================================
SELECT section, response_medium, COUNT(*) AS c, SUM(budget_value) AS v
  FROM budget
 WHERE shop = '買い:中古リノベ'
 GROUP BY section, response_medium;

SELECT COALESCE(NULLIF(order_section, ''), '(空)') AS os, COUNT(*) AS c, SUM(budget_value) AS v
  FROM budget
 WHERE section = 'use'
 GROUP BY os;
