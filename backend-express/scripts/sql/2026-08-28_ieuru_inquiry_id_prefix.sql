-- ============================================================================
-- inquiry_customer_resale: イエウール由来の inquiry_id の接頭辞を修正
--
--   背景
--     portal/ieuru_resale.php はイエイ用ファイルからのコピペで作られており、
--     inquiry_id を CONCAT('iei_', id) で組み立てていた。
--     イエウールの元IDは 'ie_xxx'、イエイは 'iei_xxx' なので
--       イエウール由来 … iei_ie_xxx
--       イエイ由来     … iei_iei_xxx
--     となり、値としては衝突しないが接頭辞が誤っている。
--
--   ハンドラ側を CONCAT('ieuru_', id) に直したため、既存行も合わせて改名する。
--   改名しないと突合キーが変わり、次回POST時に INSERT IGNORE をすり抜けて
--   同じ反響が二重に登録される。
--
--   実行: docker exec -i dashboard-mariadb-db-1 \
--           mariadb -ulocal_user -plocal_password local_db < このファイル
--
--   冪等性: WHERE で 'iei_ie_' 始まりのみを対象にしているため再実行しても安全
--           （1回目で 'ieuru_ie_' になり、2回目以降は0件）。
-- ============================================================================

-- 実行前の確認用。'ieuru_' が既に存在する場合は改名先が衝突していないか要確認
-- （inquiry_id には UNIQUE 制約がある）。
SELECT
    SUM(inquiry_id LIKE 'iei\_ie\_%')    AS `改名対象(イエウール由来)`,
    SUM(inquiry_id LIKE 'iei\_iei\_%')   AS `対象外(イエイ由来)`,
    SUM(inquiry_id LIKE 'ieuru\_%')      AS `改名先に既存(0であること)`
FROM inquiry_customer_resale;

UPDATE inquiry_customer_resale
SET    inquiry_id = CONCAT('ieuru_', SUBSTRING(inquiry_id, 5))
WHERE  inquiry_id LIKE 'iei\_ie\_%'
  -- 接頭辞だけでなく媒体でも絞る。イエイ由来を巻き込まないための二重の安全策
  AND  medium = 'イエウール';

SELECT
    SUM(inquiry_id LIKE 'ieuru\_%')      AS `改名後(イエウール由来)`,
    SUM(inquiry_id LIKE 'iei\_iei\_%')   AS `イエイ由来(不変)`,
    SUM(inquiry_id LIKE 'iei\_ie\_%')    AS `未改名(0であること)`
FROM inquiry_customer_resale;
