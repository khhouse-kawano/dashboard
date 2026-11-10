-- =====================================================================
-- v2.2.258 不動産企画係：媒介獲得台帳といえらぶの物件のつなぎ方の列
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② の更新より**前に**流す（② の突き合わせ・台帳の保存がこの列を使う）
-- ⚠️ 何回流しても同じ（IF NOT EXISTS）
-- =====================================================================

-- auto＝② が自動でつないだ、staff＝人が選んだ・外した、none＝「該当なし」にした、NULL＝まだ（② の突き合わせの対象）
ALTER TABLE brokerage_listings ADD COLUMN IF NOT EXISTS property_db_match VARCHAR(10) NULL COMMENT 'いえらぶの物件のつなぎ方（auto・staff・none。v2.2.258）' AFTER property_db_name;

-- すでにつながっている台帳（中古の画面で人が選んだもの）は「人が選んだ」にする
UPDATE brokerage_listings SET property_db_match = 'staff'
 WHERE kind = 'ledger' AND property_db_id IS NOT NULL AND property_db_id <> '' AND property_db_match IS NULL;

-- 確認（結果が返ればよい）
SHOW COLUMNS FROM brokerage_listings LIKE 'property_db_match';
