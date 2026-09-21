-- =====================================================================
-- competitor_pdf テーブル：1ファイル1行に作り替える（案②）
--
-- ⚠️⚠️ **なぜ必要か**
--   ⚠️ 旧構造は「顧客1人につき1行」で、`pdf_path` に JSON 配列を持っていた。
--       [{"name":"...","path":"/uploads/competitors/xxx.pdf","staff":"..."}]
--   ⚠️ 他社資料一覧を **カテゴリ → 他社 → PDF** のフォルダ表示にするため、
--     ⚠️ **`company`（他社名）と `category`（種別）で絞り込めること**が要る。
--   ⚠️ JSON のままだと ⚠️ **9,333行を毎回パースしないと1件も絞り込めない。**
--
-- ⚠️⚠️ **移行対象は小さい。**（ローカル 2026-09-21 時点）
--       全 9,333行 … うち ⚠️ **PDF があるのは 32行 / 53ファイル**
--                    ⚠️ **9,301行は空**（顧客を開いただけで作られた行）
--
-- ⚠️⚠️ **`company` / `category` は空のまま移行する**（2026-09-21 の判断）。
--   ⚠️ 既存ファイルにはどちらの情報も無い。
--   ⚠️ ファイル名からの推測はしない。⚠️ **誤った分類が正しいものとして残る**ため。
--   ⚠️ 画面では「未分類」フォルダに入り、⚠️ **一覧から後で直せる。**
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️⚠️ **実行前に competitor_pdf をエクスポートすること。**
--   （⚠️ 旧テーブルは competitor_pdf_old_20260921 として残すが、二重に備える）
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 実行前の件数を控える
-- ---------------------------------------------------------------------
SELECT COUNT(*) AS rows_all,
       SUM(pdf_path IS NULL OR pdf_path IN ('', '[]')) AS empty_rows,
       SUM(pdf_path IS NOT NULL AND pdf_path NOT IN ('', '[]')) AS rows_with_pdf
  FROM competitor_pdf;

-- ---------------------------------------------------------------------
-- 1. 新しい形のテーブルを作る
--
-- ⚠️ `no` が主キー（AUTO_INCREMENT）。⚠️ **`id` は顧客ごとに重複する。**
-- ⚠️ `id` に索引を張る。顧客詳細が `WHERE id = ?` で毎回引くため。
-- ⚠️ `path` にも索引を張る。一覧から1件削除するときの手掛かりにする。
--   ⚠️ TEXT には長さを指定しないと索引を張れない（先頭191文字で足りる）。
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS competitor_pdf_v2;

CREATE TABLE competitor_pdf_v2 (
  no       INT(11)      NOT NULL AUTO_INCREMENT,
  id       VARCHAR(64)  NOT NULL                COMMENT 'master_data.id',
  name     TEXT         DEFAULT NULL            COMMENT '画面に出す表示名',
  path     TEXT         DEFAULT NULL            COMMENT '/uploads/competitors/xxx.pdf',
  staff    TEXT         DEFAULT NULL            COMMENT '登録した営業',
  company  TEXT         DEFAULT NULL            COMMENT '他社名。master_data.competitors_text から選ぶ',
  category TEXT         DEFAULT NULL            COMMENT 'カタログパンフレット/見積もり・提案書/チラシ/その他',
  created  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (no),
  KEY idx_id (id),
  KEY idx_path (path(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. JSON 配列を1行ずつにほどく
--
-- ⚠️⚠️ **`seq_0_to_99` は MariaDB の SEQUENCE エンジン。**
--   ⚠️ ① でも使える（10.11 で確認済み）。⚠️ **テーブルを作る必要は無い。**
--   ⚠️ 使えない環境なら、代わりに数字表を作るか PHP で流し込むこと。
--
-- ⚠️ 1顧客あたりのファイル数は実測で最大でも数件。⚠️ 100 まで見れば足りる。
-- ⚠️ `JSON_LENGTH` が NULL を返す（壊れた JSON）の行は JOIN されず落ちる。
--   ⚠️ **手順3の件数確認で気づけるようにしてある。**
-- ---------------------------------------------------------------------
INSERT INTO competitor_pdf_v2 (id, name, path, staff, company, category)
SELECT
  p.id,
  JSON_UNQUOTE(JSON_EXTRACT(p.pdf_path, CONCAT('$[', s.seq, '].name'))),
  JSON_UNQUOTE(JSON_EXTRACT(p.pdf_path, CONCAT('$[', s.seq, '].path'))),
  JSON_UNQUOTE(JSON_EXTRACT(p.pdf_path, CONCAT('$[', s.seq, '].staff'))),
  '',
  ''
FROM competitor_pdf p
JOIN seq_0_to_99 s ON s.seq < JSON_LENGTH(p.pdf_path)
WHERE p.pdf_path IS NOT NULL
  AND p.pdf_path NOT IN ('', '[]')
ORDER BY p.id, s.seq;

-- ---------------------------------------------------------------------
-- 3. 移行できた件数を確かめる
--
-- ⚠️⚠️ **`files_expected` と `rows_migrated` が一致すること。**
--   ⚠️ 合わなければ壊れた JSON がある。⚠️ **入れ替えずに調べること。**
-- ---------------------------------------------------------------------
SELECT
  (SELECT SUM(JSON_LENGTH(pdf_path))
     FROM competitor_pdf
    WHERE pdf_path IS NOT NULL AND pdf_path NOT IN ('', '[]')) AS files_expected,
  (SELECT COUNT(*) FROM competitor_pdf_v2)                     AS rows_migrated,
  (SELECT COUNT(*) FROM competitor_pdf_v2 WHERE path IS NULL OR path = '') AS rows_without_path;

-- ---------------------------------------------------------------------
-- 4. 入れ替える
--
-- ⚠️⚠️ **手順3が合っていることを確かめてから実行すること。**
-- ⚠️ 旧テーブルは残す。⚠️ **戻すときはこれを rename して戻す。**
-- ---------------------------------------------------------------------
RENAME TABLE competitor_pdf    TO competitor_pdf_old_20260921,
             competitor_pdf_v2 TO competitor_pdf;

-- ---------------------------------------------------------------------
-- 5. 確認
-- ⚠️ 53行前後（ローカルの実測値）。⚠️ **空行は1つも無いこと。**
-- ---------------------------------------------------------------------
SELECT COUNT(*) AS rows_now,
       COUNT(DISTINCT id) AS customers,
       SUM(company IS NULL OR company = '') AS company_blank,
       SUM(category IS NULL OR category = '') AS category_blank
  FROM competitor_pdf;
