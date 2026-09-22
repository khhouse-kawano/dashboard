-- =====================================================================
-- マーケ用メモ欄（memo_marketing）を3つの顧客台帳に追加する
--
-- ⚠️ 面談シート（information/TableInterview.tsx）の上部に置くメモ欄。
--   ⚠️ 架電用メモ（memo_other_related_person）と同じ扱いにする。
--
-- ⚠️⚠️ **3テーブルすべてに入れること。**
--   ⚠️ 書き込みの許可リスト（allowed_columns.php）は ⚠️ **3テーブル共通**である。
--   ⚠️ ⚠️ **1つでも列が無いと、その事業の画面で保存がまるごと失敗する**
--     （`Unknown column` になる。⚠️ メモだけでなく他の項目も保存されない）。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================

ALTER TABLE master_data
  ADD COLUMN memo_marketing TEXT DEFAULT NULL
  COMMENT 'マーケ用メモ欄。面談シートの上部から入力する（架電用メモとは別）';

ALTER TABLE master_data_kaeru
  ADD COLUMN memo_marketing TEXT DEFAULT NULL
  COMMENT 'マーケ用メモ欄。面談シートの上部から入力する（架電用メモとは別）';

ALTER TABLE master_data_resale
  ADD COLUMN memo_marketing TEXT DEFAULT NULL
  COMMENT 'マーケ用メモ欄。面談シートの上部から入力する（架電用メモとは別）';

-- 確認（3テーブルとも1行ずつ返ればよい）
SHOW COLUMNS FROM master_data LIKE 'memo_marketing';
SHOW COLUMNS FROM master_data_kaeru LIKE 'memo_marketing';
SHOW COLUMNS FROM master_data_resale LIKE 'memo_marketing';
