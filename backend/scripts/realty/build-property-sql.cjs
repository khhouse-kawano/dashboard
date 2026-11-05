#!/usr/bin/env node
/**
 * 媒介物件の移し替えの SQL を作る（v2.2.250）。
 *   node backend/scripts/realty/build-property-sql.cjs > backend/scripts/sql/2026-11-05_realty_properties_2_migrate.sql
 *
 * ⚠️ 住所のそろえ方は ② の backend-express/src/features/realty/propertyKeyRules.json（propertyKey.ts と同じ1つ）から作る。
 *   ⚠️ ここで SQL を手で直さない。規則を変えたら、このスクリプトで作り直す。
 * ⚠️ SQL の REPLACE は、JS の split/join と同じく「すべての出現を、左から重ならずに」置き換える。
 */
const path = require('path');
const rules = require(path.join(__dirname, '../../../backend-express/src/features/realty/propertyKeyRules.json')).replace;

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\t/g, '\\t')}'`;

/** normPlace(x) と同じ SQL の式 */
const normSql = (expr) => {
  let e = expr;
  for (const [from, to] of rules) e = `REPLACE(${e}, ${q(from)}, ${q(to)})`;
  return `TRIM(TRAILING '-' FROM ${e})`;
};

/** fullAddress(addr1, addr2) と同じ式。⚠️ startsWith に合わせて BINARY で比べる（照合順序で全角半角が同じに扱われないように） */
const fullAddrSql = (t) =>
  `IF(BINARY LEFT(IFNULL(${t}.addr2, ''), CHAR_LENGTH(IFNULL(${t}.addr1, ''))) = BINARY IFNULL(${t}.addr1, ''), IFNULL(${t}.addr2, ''), CONCAT(IFNULL(${t}.addr1, ''), IFNULL(${t}.addr2, '')))`;

/**
 * 既存の台帳の突き合わせ用の文字列（地番・建物名は無いので 種別|a:住所）。
 * ⚠️ propertyKeyOf と同じく、住所に数字（番地）が無いときは、その台帳だけの物件にする（末尾に |u:台帳の ID）
 */
const keySql = (t) => {
  const n = normSql(fullAddrSql(t));
  return `CONCAT(IFNULL(${t}.category, ''), '|a:', ${n}, IF(${n} REGEXP '[0-9]', '', CONCAT('|u:', ${t}.id)))`;
};

const out = `-- =====================================================================
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
    SELECT ${keySql('l')} AS k, NULLIF(l.category, '') AS cat, ${fullAddrSql('l')} AS addr
      FROM brokerage_listings l
     WHERE l.kind = 'ledger' AND (l.show_dashboard IS NULL OR l.show_dashboard <> 0)
  ) x
 GROUP BY x.k;

-- 2. 台帳に物件をつなぐ
UPDATE brokerage_listings l
  JOIN realty_properties p ON p.match_key = ${keySql('l')}
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
`;
process.stdout.write(out);
