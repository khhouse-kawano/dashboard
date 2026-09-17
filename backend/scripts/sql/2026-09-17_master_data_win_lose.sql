-- ---------------------------------------------------------------------------
-- 勝因・敗因の入力欄で使う列を master_data に追加する（2026-09-17 の指示）
--
-- ⚠️⚠️ **対象は master_data だけ**（注文事業）。
--   ⚠️ 入力欄は `TableStatus.tsx` にあるが、**あの画面は3事業で共有**している。
--     ⚠️ そのため画面側で `category === 'order'` のときだけ出している。
--   ⚠️ 建売（master_data_kaeru）・中古（master_data_resale）へ広げるときは、
--     ⚠️ **この SQL を各テーブルにも流してから**画面の条件を外すこと。
--     ⚠️ 列が無いまま出すと `Unknown column` で**保存がまるごと失敗する**
--       （列の許可リストは3テーブル共通のため）。
--
-- ⚠️⚠️ **DEFAULT NULL にすること**（指示）。
--   ⚠️ 既存 18,000 行以上に既定値を書き込ませない。
--   ⚠️ 「まだ聞いていない」と「空と答えた」を区別できるようにするため。
--
-- ⚠️⚠️ **`価格差` も TEXT である。**
--   ⚠️ 画面は `input type="number"` だが、既存の金額系の列がすべて TEXT で、
--     ⚠️ ここだけ数値型にすると**集計側で型が割れる。**
--
-- ⚠️ 「敗因」は**列を増やしていない**（指示）。
--   ⚠️ 既存の `customized_input_01JSE7H4MQES619NBWX6PQDFRH` をそのまま使う。
--   ⚠️ ラベルが変わるだけなので、**過去の入力もそのまま活きる。**
--
-- ⚠️ 「競合を選択」も列を増やしていない。既存の `competitor_name` を使う
--   （失注先と同じ列・同じUI）。
--
-- ⚠️ 実行先は ⚠️ **① レンタルサーバー（Xserver）の phpMyAdmin**。
-- ---------------------------------------------------------------------------

ALTER TABLE master_data
  ADD COLUMN competitor_win_reason      TEXT DEFAULT NULL COMMENT '勝因。契約済みのとき必須',
  ADD COLUMN competitor_price_gap       TEXT DEFAULT NULL COMMENT '競合との価格差。契約済み=任意／失注=必須',
  ADD COLUMN competitor_sales_person    TEXT DEFAULT NULL COMMENT '競合の営業担当。任意',
  ADD COLUMN competitor_countermeasure  TEXT DEFAULT NULL COMMENT '今後の対策。競合負けのとき必須',
  ADD COLUMN competitor_campaign        TEXT DEFAULT NULL COMMENT '他社のキャンペーン。任意';
