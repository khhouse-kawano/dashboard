-- =====================================================================
-- v2.2.243 budget に「詳細」（remarks）を足し、請求先（company）の括弧書きを remarks へ移す
--
--   例: 'フルキャスト(派遣スタッフ)' → company = 'フルキャスト'・remarks = '派遣スタッフ'
--       'リビング新聞社(折込料）'   → company = 'リビング新聞社'・remarks = '折込料'（⚠️ 半角・全角の混在も対象）
--
-- ⚠️ 対象は「括弧より前に文字があり、末尾が閉じ括弧で終わる」値だけ。
--   ⚠️ 最初の開き括弧から最後の閉じ括弧までを remarks にする。
--   ⚠️ '(株)〇〇' のように括弧より前が空の値・括弧の後ろに文字が続く値は分けない。
-- ⚠️ 何度流しても同じ結果になる（列は IF NOT EXISTS。分割は remarks が NULL で括弧の残っている行だけ）。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② のデプロイより先に流すこと
--   （② の広告費入力は remarks を読み書きするので、列が無いと画面がエラーになる）
-- =====================================================================

-- 1. 列を足す（請求先の右）
ALTER TABLE budget ADD COLUMN IF NOT EXISTS remarks TEXT NULL DEFAULT NULL COMMENT '詳細（メモ）。v2.2.243' AFTER company;

-- 2. 流す前の確認（分ける行の一覧。⚠️ ここに出た行だけが変わる）
SELECT id, company,
       TRIM(REGEXP_REPLACE(company, '^(.+?)[[:space:]]*[(（](.*)[)）][[:space:]]*$', '\\1')) AS new_company,
       TRIM(REGEXP_REPLACE(company, '^(.+?)[[:space:]]*[(（](.*)[)）][[:space:]]*$', '\\2')) AS new_remarks
  FROM budget
 WHERE remarks IS NULL
   AND company REGEXP '^[^(（]*[^(（[:space:]][^(（]*[(（].*[)）][[:space:]]*$'
 ORDER BY id;

-- 3. 分ける（⚠️ remarks を先に入れる。company を先に書き換えると remarks の元が消える）
UPDATE budget
   SET remarks = TRIM(REGEXP_REPLACE(company, '^(.+?)[[:space:]]*[(（](.*)[)）][[:space:]]*$', '\\2')),
       company = TRIM(REGEXP_REPLACE(company, '^(.+?)[[:space:]]*[(（](.*)[)）][[:space:]]*$', '\\1'))
 WHERE remarks IS NULL
   AND company REGEXP '^[^(（]*[^(（[:space:]][^(（]*[(（].*[)）][[:space:]]*$';

-- 4. 確かめる（括弧の残った company が 0 行、remarks の入った行の数が 2 の行数と同じならよい）
SELECT
  (SELECT COUNT(*) FROM budget WHERE company REGEXP '[(（].*[)）][[:space:]]*$') AS company_with_paren,
  (SELECT COUNT(*) FROM budget WHERE remarks IS NOT NULL) AS rows_with_remarks;
