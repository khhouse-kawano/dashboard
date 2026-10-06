-- =====================================================================
-- call_sheet / interview_sheet の空の shop を、マスタの担当店舗で埋める（v2.2.167）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ **全文を1回で流すこと**
--   （一時テーブルは同じ接続の中でしか見えない。分けて流すと UPDATE が空振りする）。
-- ⚠️⚠️ **本番データの書き換え。** 流す前に「① 確認」だけを先に流して件数を控えること。
--
-- 目的: 月次日報（daily_report）を「事業の店舗」で絞って返すようにしたため、
--   shop が空の行は**どの事業にも入らず、日報から消える。** 先に埋めておく。
--
-- ⚠️ 埋めるのは **shop が空の行だけ**。入っている行は触らない。
-- ⚠️ マスタ側の担当店舗（in_charge_store）も空なら埋めない（そのまま残る）。
-- ⚠️ 同じ id がマスタに複数あり担当店舗が食い違うものは埋めない
--   （2026-10-06 時点で master_data_resale に重複 id が1件ある）。
-- ⚠️ id はマスタ3表の間で重複しない（2026-10-06 にローカルで確認）。
--
-- ⚠️⚠️ 各表の id は TEXT でインデックスが無い。表どうしを直接 JOIN すると
--   ローカルでも5分以上かかった（phpMyAdmin ではタイムアウトする）。
--   そのため id に主キーを付けた一時テーブルを経由する。
--
-- ローカル（2026-10-06）: call_sheet 空 1,658 → 566 ／ interview_sheet 空 3,595 → 3,054
-- =====================================================================

-- ① 確認（流す前）: shop が空の行数
SELECT 'call_sheet 空', COUNT(*) FROM call_sheet WHERE TRIM(shop) = ''
UNION ALL
SELECT 'interview_sheet 空', COUNT(*) FROM interview_sheet WHERE TRIM(shop) = '';

-- id → 担当店舗（マスタ3表）。⚠️ 担当店舗が1つに決まる id だけ
DROP TEMPORARY TABLE IF EXISTS tmp_customer_store;
CREATE TEMPORARY TABLE tmp_customer_store (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  store VARCHAR(255) NOT NULL
) DEFAULT CHARSET = utf8mb4;

INSERT INTO tmp_customer_store (id, store)
SELECT id, MAX(store) FROM (
  SELECT id, TRIM(in_charge_store) AS store FROM master_data
  WHERE TRIM(IFNULL(in_charge_store, '')) <> ''
  UNION ALL
  SELECT id, TRIM(in_charge_store) FROM master_data_kaeru
  WHERE TRIM(IFNULL(in_charge_store, '')) <> ''
  UNION ALL
  SELECT id, TRIM(in_charge_store) FROM master_data_resale
  WHERE TRIM(IFNULL(in_charge_store, '')) <> ''
) s
WHERE CHAR_LENGTH(id) <= 191
GROUP BY id
HAVING COUNT(DISTINCT store) = 1;

UPDATE call_sheet c
JOIN tmp_customer_store m ON m.id = c.id
SET c.shop = m.store
WHERE TRIM(c.shop) = '';

UPDATE interview_sheet c
JOIN tmp_customer_store m ON m.id = c.id
SET c.shop = m.store
WHERE TRIM(c.shop) = '';

DROP TEMPORARY TABLE IF EXISTS tmp_customer_store;

-- ② 確認（流した後）: shop が空の行数（⚠️ ① より減っていること）
SELECT 'call_sheet 空', COUNT(*) FROM call_sheet WHERE TRIM(shop) = ''
UNION ALL
SELECT 'interview_sheet 空', COUNT(*) FROM interview_sheet WHERE TRIM(shop) = '';
