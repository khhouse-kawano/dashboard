-- =====================================================================
-- v2.2.252 不動産企画係：担当者の表記を「空白なしの氏名」にそろえる
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何回流しても同じ（そろった値はもう変わらない）
-- ⚠️ 対象: 売り反響・買い反響・媒介獲得台帳・商談案件・買取再販案件の 担当（staff）・共同担当（subStaff）・販売担当（sellStaff）
--   - 媒介獲得台帳の略称（「時任」）→ 設定の担当者の氏名（「時任聡一朗」）。対応は設定（app_state）の担当者の 略称 → 氏名 を読む
--   - 空白入りの氏名（「時任 聡一朗」。台帳の編集画面のスタッフ表の名前）→ 空白を除く
--   - 設定に居ない人（退職者など。例「大坪」）は空白を除くだけ
-- ⚠️ 安全更新モード（ERROR 1175）でも通るよう、UPDATE の WHERE に主キーの範囲（internal_id > 0）を入れる
-- ⚠️ JSON_TABLE は使わない（MariaDB 10.6 から。① の版が分からないため JSON_SEARCH で読む）
-- =====================================================================

-- 0. 確認（前）：種類・担当ごとの件数
SELECT kind, staff, COUNT(*) AS `件数` FROM brokerage_listings
WHERE kind IN ('leads','buyLeads','ledger','deals','resales') AND IFNULL(staff,'') <> ''
GROUP BY kind, staff ORDER BY kind, staff;

-- 1. 直す行と、直す前・後の値（この表が控えになる。⚠️ 消さない）
CREATE TABLE IF NOT EXISTS brokerage_listings_bk_20261105_staff (
  internal_id BIGINT NOT NULL PRIMARY KEY,
  kind VARCHAR(32),
  staff_old TEXT, staff_new TEXT,
  sub_old TEXT, sub_new TEXT,
  sell_old TEXT, sell_new TEXT
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT IGNORE INTO brokerage_listings_bk_20261105_staff (internal_id, kind, staff_old, staff_new, sub_old, sub_new, sell_old, sell_new)
SELECT x.internal_id, x.kind, x.staff, x.staff_new, x.subStaff, x.sub_new, x.sellStaff, x.sell_new
FROM (
  SELECT b.internal_id, b.kind, b.staff, b.subStaff, b.sellStaff,
    -- 空白を除いた値が設定の略称なら、その人の氏名（空白を除く）。違えば空白を除いた値
    CASE WHEN IFNULL(b.staff,'') = '' THEN b.staff ELSE COALESCE(
      NULLIF(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(s.st, REPLACE(JSON_UNQUOTE(JSON_SEARCH(s.st, 'one', REPLACE(REPLACE(b.staff,' ',''),'　',''), NULL, '$[*].abbr')), '.abbr', '.name'))),' ',''),'　',''), ''),
      REPLACE(REPLACE(b.staff,' ',''),'　','')) END AS staff_new,
    CASE WHEN IFNULL(b.subStaff,'') = '' THEN b.subStaff ELSE COALESCE(
      NULLIF(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(s.st, REPLACE(JSON_UNQUOTE(JSON_SEARCH(s.st, 'one', REPLACE(REPLACE(b.subStaff,' ',''),'　',''), NULL, '$[*].abbr')), '.abbr', '.name'))),' ',''),'　',''), ''),
      REPLACE(REPLACE(b.subStaff,' ',''),'　','')) END AS sub_new,
    CASE WHEN IFNULL(b.sellStaff,'') = '' THEN b.sellStaff ELSE COALESCE(
      NULLIF(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(s.st, REPLACE(JSON_UNQUOTE(JSON_SEARCH(s.st, 'one', REPLACE(REPLACE(b.sellStaff,' ',''),'　',''), NULL, '$[*].abbr')), '.abbr', '.name'))),' ',''),'　',''), ''),
      REPLACE(REPLACE(b.sellStaff,' ',''),'　','')) END AS sell_new
  FROM brokerage_listings b
  CROSS JOIN (SELECT JSON_EXTRACT(`data`, '$.staff') AS st FROM app_state WHERE `key` = 'settings') s
  WHERE b.kind IN ('leads','buyLeads','ledger','deals','resales')
) x
WHERE BINARY IFNULL(x.staff,'') <> BINARY IFNULL(x.staff_new,'')
   OR BINARY IFNULL(x.subStaff,'') <> BINARY IFNULL(x.sub_new,'')
   OR BINARY IFNULL(x.sellStaff,'') <> BINARY IFNULL(x.sell_new,'');

-- 2. 直す（控えの表の値で。⚠️ 値が今も直す前のままの行だけ）
UPDATE brokerage_listings
SET staff = (SELECT t.staff_new FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id)
WHERE internal_id > 0
  AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_staff WHERE BINARY IFNULL(staff_old,'') <> BINARY IFNULL(staff_new,''))
  AND BINARY IFNULL(staff,'') = BINARY IFNULL((SELECT t.staff_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),'');

UPDATE brokerage_listings
SET subStaff = (SELECT t.sub_new FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id)
WHERE internal_id > 0
  AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_staff WHERE BINARY IFNULL(sub_old,'') <> BINARY IFNULL(sub_new,''))
  AND BINARY IFNULL(subStaff,'') = BINARY IFNULL((SELECT t.sub_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),'');

UPDATE brokerage_listings
SET sellStaff = (SELECT t.sell_new FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id)
WHERE internal_id > 0
  AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_staff WHERE BINARY IFNULL(sell_old,'') <> BINARY IFNULL(sell_new,''))
  AND BINARY IFNULL(sellStaff,'') = BINARY IFNULL((SELECT t.sell_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),'');

-- 3. 確認（後）：種類・担当ごとの件数（台帳も氏名になり、空白入りが無ければ済み）
SELECT kind, staff, COUNT(*) AS `件数` FROM brokerage_listings
WHERE kind IN ('leads','buyLeads','ledger','deals','resales') AND IFNULL(staff,'') <> ''
GROUP BY kind, staff ORDER BY kind, staff;
SELECT kind, COUNT(*) AS `直した行` FROM brokerage_listings_bk_20261105_staff GROUP BY kind;

-- 戻すとき（控えの表の直す前の値に戻す）:
-- UPDATE brokerage_listings SET
--   staff = (SELECT t.staff_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),
--   subStaff = (SELECT t.sub_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id),
--   sellStaff = (SELECT t.sell_old FROM brokerage_listings_bk_20261105_staff t WHERE t.internal_id = brokerage_listings.internal_id)
-- WHERE internal_id > 0 AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_staff);
-- しばらくして問題が無ければ控えを消す:
-- DROP TABLE brokerage_listings_bk_20261105_staff;
