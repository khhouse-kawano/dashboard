-- =====================================================================
-- v2.2.250 不動産企画係：媒介物件の表（連動トリガー仕様書 ②）  ②　今ある台帳から媒介物件を作って紐づける
--
-- ⚠️ このファイルは backend/scripts/realty/build-property-sql.cjs で作った（手で直さない）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 先に 2026-11-05_realty_properties_1_schema.sql を流しておく
-- ⚠️ 何回流しても同じ（物件の ID は突き合わせ用の文字列から決まる。紐づけは propertyId が空の行だけ）
-- ⚠️ 住所に番地（数字）が無い台帳（「鹿児島市」だけなど）は、ほかとまとめず、その台帳だけの物件にする（propertyKey.ts と同じ）
-- =====================================================================

-- 1. 有効な台帳から、種別＋住所で媒介物件を作る（同じ物件の台帳は1つにまとまる）
INSERT IGNORE INTO realty_properties (id, match_key, category, addr, created_at, created_by)
SELECT CONCAT('p', LEFT(MD5(x.k), 16)), x.k, MIN(x.cat), MIN(x.addr), NOW(), '移し替え（v2.2.250）'
  FROM (
    SELECT CONCAT(IFNULL(l.category, ''), '|a:', TRIM(TRAILING '-' FROM REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IF(BINARY LEFT(IFNULL(l.addr2, ''), CHAR_LENGTH(IFNULL(l.addr1, ''))) = BINARY IFNULL(l.addr1, ''), IFNULL(l.addr2, ''), CONCAT(IFNULL(l.addr1, ''), IFNULL(l.addr2, ''))), ' ', ''), '　', ''), '\t', ''), '０', '0'), '１', '1'), '２', '2'), '３', '3'), '４', '4'), '５', '5'), '６', '6'), '７', '7'), '８', '8'), '９', '9'), '－', '-'), 'ー', '-'), '‐', '-'), '−', '-'), '–', '-'), '—', '-'), '―', '-'), 'ｰ', '-'), '鹿児島県', ''), '宮崎県', ''), '熊本県', ''), '一丁目', '1-'), '二丁目', '2-'), '三丁目', '3-'), '四丁目', '4-'), '五丁目', '5-'), '六丁目', '6-'), '七丁目', '7-'), '八丁目', '8-'), '九丁目', '9-'), '十丁目', '10-'), '丁目', '-'), '番地', '-'), '番', '-'), '号', ''), '--', '-'), '--', '-')), IF(TRIM(TRAILING '-' FROM REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IF(BINARY LEFT(IFNULL(l.addr2, ''), CHAR_LENGTH(IFNULL(l.addr1, ''))) = BINARY IFNULL(l.addr1, ''), IFNULL(l.addr2, ''), CONCAT(IFNULL(l.addr1, ''), IFNULL(l.addr2, ''))), ' ', ''), '　', ''), '\t', ''), '０', '0'), '１', '1'), '２', '2'), '３', '3'), '４', '4'), '５', '5'), '６', '6'), '７', '7'), '８', '8'), '９', '9'), '－', '-'), 'ー', '-'), '‐', '-'), '−', '-'), '–', '-'), '—', '-'), '―', '-'), 'ｰ', '-'), '鹿児島県', ''), '宮崎県', ''), '熊本県', ''), '一丁目', '1-'), '二丁目', '2-'), '三丁目', '3-'), '四丁目', '4-'), '五丁目', '5-'), '六丁目', '6-'), '七丁目', '7-'), '八丁目', '8-'), '九丁目', '9-'), '十丁目', '10-'), '丁目', '-'), '番地', '-'), '番', '-'), '号', ''), '--', '-'), '--', '-')) REGEXP '[0-9]', '', CONCAT('|u:', l.id))) AS k, NULLIF(l.category, '') AS cat, IF(BINARY LEFT(IFNULL(l.addr2, ''), CHAR_LENGTH(IFNULL(l.addr1, ''))) = BINARY IFNULL(l.addr1, ''), IFNULL(l.addr2, ''), CONCAT(IFNULL(l.addr1, ''), IFNULL(l.addr2, ''))) AS addr
      FROM brokerage_listings l
     WHERE l.kind = 'ledger' AND (l.show_dashboard IS NULL OR l.show_dashboard <> 0)
  ) x
 GROUP BY x.k;

-- 2. 台帳に物件をつなぐ
UPDATE brokerage_listings l
  JOIN realty_properties p ON p.match_key = CONCAT(IFNULL(l.category, ''), '|a:', TRIM(TRAILING '-' FROM REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IF(BINARY LEFT(IFNULL(l.addr2, ''), CHAR_LENGTH(IFNULL(l.addr1, ''))) = BINARY IFNULL(l.addr1, ''), IFNULL(l.addr2, ''), CONCAT(IFNULL(l.addr1, ''), IFNULL(l.addr2, ''))), ' ', ''), '　', ''), '\t', ''), '０', '0'), '１', '1'), '２', '2'), '３', '3'), '４', '4'), '５', '5'), '６', '6'), '７', '7'), '８', '8'), '９', '9'), '－', '-'), 'ー', '-'), '‐', '-'), '−', '-'), '–', '-'), '—', '-'), '―', '-'), 'ｰ', '-'), '鹿児島県', ''), '宮崎県', ''), '熊本県', ''), '一丁目', '1-'), '二丁目', '2-'), '三丁目', '3-'), '四丁目', '4-'), '五丁目', '5-'), '六丁目', '6-'), '七丁目', '7-'), '八丁目', '8-'), '九丁目', '9-'), '十丁目', '10-'), '丁目', '-'), '番地', '-'), '番', '-'), '号', ''), '--', '-'), '--', '-')), IF(TRIM(TRAILING '-' FROM REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IF(BINARY LEFT(IFNULL(l.addr2, ''), CHAR_LENGTH(IFNULL(l.addr1, ''))) = BINARY IFNULL(l.addr1, ''), IFNULL(l.addr2, ''), CONCAT(IFNULL(l.addr1, ''), IFNULL(l.addr2, ''))), ' ', ''), '　', ''), '\t', ''), '０', '0'), '１', '1'), '２', '2'), '３', '3'), '４', '4'), '５', '5'), '６', '6'), '７', '7'), '８', '8'), '９', '9'), '－', '-'), 'ー', '-'), '‐', '-'), '−', '-'), '–', '-'), '—', '-'), '―', '-'), 'ｰ', '-'), '鹿児島県', ''), '宮崎県', ''), '熊本県', ''), '一丁目', '1-'), '二丁目', '2-'), '三丁目', '3-'), '四丁目', '4-'), '五丁目', '5-'), '六丁目', '6-'), '七丁目', '7-'), '八丁目', '8-'), '九丁目', '9-'), '十丁目', '10-'), '丁目', '-'), '番地', '-'), '番', '-'), '号', ''), '--', '-'), '--', '-')) REGEXP '[0-9]', '', CONCAT('|u:', l.id)))
   SET l.propertyId = p.id
 WHERE l.kind = 'ledger' AND (l.show_dashboard IS NULL OR l.show_dashboard <> 0) AND l.propertyId IS NULL;

-- 3. その台帳から作った売り反響にも同じ物件をつなぐ（売り反響の台帳 No. ＝ 台帳の No.）
UPDATE brokerage_listings s
  JOIN brokerage_listings g ON g.kind = 'ledger' AND (g.show_dashboard IS NULL OR g.show_dashboard <> 0)
                           AND CAST(g.no AS CHAR) = CAST(s.ledgerNo AS CHAR) AND g.propertyId IS NOT NULL
   SET s.propertyId = g.propertyId
 WHERE s.kind = 'leads' AND s.propertyId IS NULL AND s.ledgerNo IS NOT NULL AND s.ledgerNo <> '';

-- 確認
SELECT COUNT(*) AS 物件の数 FROM realty_properties;
SELECT SUM(propertyId IS NOT NULL) AS 物件につながった台帳, COUNT(*) AS 有効な台帳 FROM brokerage_listings WHERE kind = 'ledger' AND (show_dashboard IS NULL OR show_dashboard <> 0);
SELECT COUNT(*) AS 物件につながった売り反響 FROM brokerage_listings WHERE kind = 'leads' AND propertyId IS NOT NULL;
SELECT p.id, p.category, p.addr, COUNT(*) AS 台帳の数 FROM realty_properties p JOIN brokerage_listings l ON l.propertyId = p.id AND l.kind = 'ledger' GROUP BY p.id HAVING COUNT(*) > 1;
