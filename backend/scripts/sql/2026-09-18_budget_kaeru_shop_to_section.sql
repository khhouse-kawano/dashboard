-- =====================================================================
-- budget テーブル：建売（section = 'spec'）の「かえる◇◇店」を「係」へ寄せる
--
-- ⚠️⚠️ **なぜ必要か**
--   建売の販促費は `budget.shop` に **「係」**（鹿児島1〜3係 / 宮崎係 /
--   大分係 / 熊本係 / 外販）で入っているのが正である。
--   ⚠️ ところが `かえる◇◇店` という**旧店舗名**の行が混ざっており、
--     ⚠️ `shop_list` では `show_flag = 0`（画面に出さない店舗）なので
--     ⚠️ **販促媒体別広告費（CustomerKaeru）の集計から丸ごと落ちていた。**
--   ⚠️ 店舗別広告費（ShopKaeru）には乗るため、⚠️ **2画面の総額が食い違っていた。**
--
-- ⚠️⚠️ **`section = 'spec'` だけを対象にすること**（2026-09-18 の指示）。
--   ⚠️ `use`（中古）と `order`（注文）にも「かえる◇◇店」の行が 19件
--     （¥600,368）あるが、⚠️ **それらは触らない。**
--     ⚠️ 中古・注文の販促費が建売の係名になってしまうため。
--
-- ⚠️ 実行前の件数（ローカル 2026-09-18 時点。① も同じ想定）
--     かえる鹿児島店  298件  ¥15,318,881
--     かえる宮崎店    136件  ¥1,463,104
--     かえる大分店     85件  ¥790,096
--     かえる熊本店     26件  ¥851,617
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 実行前に budget テーブルをエクスポートしておくこと。
-- =====================================================================

START TRANSACTION;

-- ---------------------------------------------------------------------
-- 1. 1対1で置き換えられるもの（宮崎・大分・熊本）
--
-- ⚠️ それぞれ係が1つしかないので、案分せずそのまま名前を変える。
-- ---------------------------------------------------------------------
UPDATE budget SET shop = '宮崎係' WHERE section = 'spec' AND shop = 'かえる宮崎店';
UPDATE budget SET shop = '大分係' WHERE section = 'spec' AND shop = 'かえる大分店';
UPDATE budget SET shop = '熊本係' WHERE section = 'spec' AND shop = 'かえる熊本店';

-- ---------------------------------------------------------------------
-- 2. かえる鹿児島店 → 鹿児島1係 / 2係 / 3係 に3等分
--
-- ⚠️⚠️ **順序が重要。** 先に 2係・3係ぶんの行を**複製してから**、
--   最後に元の行を1係へ書き換える。
--   ⚠️ 逆順にすると、1係へ変えた行が複製の対象から外れて **1/3 しか残らない。**
--
-- ⚠️ `id` は AUTO_INCREMENT なので列に含めない。
-- ⚠️ 金額は ROUND(budget_value / 3)。⚠️ **四捨五入の誤差は許容する**
--   （2026-09-18 の指示）。⚠️ 3行の合計が元の値と数円ずれることがある。
-- ---------------------------------------------------------------------
INSERT INTO budget
    (budget_period, shop, medium, budget_value, note, company, response_medium, category, section, order_section)
SELECT
    budget_period, '鹿児島2係', medium, ROUND(budget_value / 3), note, company, response_medium, category, section, order_section
  FROM budget
 WHERE section = 'spec' AND shop = 'かえる鹿児島店';

INSERT INTO budget
    (budget_period, shop, medium, budget_value, note, company, response_medium, category, section, order_section)
SELECT
    budget_period, '鹿児島3係', medium, ROUND(budget_value / 3), note, company, response_medium, category, section, order_section
  FROM budget
 WHERE section = 'spec' AND shop = 'かえる鹿児島店';

-- ⚠️ 最後に元の行を1係へ。⚠️ ここで初めて「かえる鹿児島店」が消える。
UPDATE budget
   SET shop = '鹿児島1係',
       budget_value = ROUND(budget_value / 3)
 WHERE section = 'spec' AND shop = 'かえる鹿児島店';

COMMIT;

-- =====================================================================
-- 確認用
-- ⚠️ `かえる` が1件も出ないこと（section = 'spec' の範囲で）
-- =====================================================================
SELECT shop, COUNT(*) AS c, SUM(budget_value) AS v
  FROM budget
 WHERE response_medium = 0 AND section = 'spec'
 GROUP BY shop
 ORDER BY v DESC;
