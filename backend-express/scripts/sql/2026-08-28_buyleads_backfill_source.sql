-- ============================================================================
-- brokerage_listings: 反響媒体（source / portal）の穴埋め
--
--   背景
--     ・売りリード(kind='leads')は source に媒体が入っているが、
--       買いリード(kind='buyLeads')は portal にだけ入っていて source が空だった。
--     ・さらに、ポータル同期ハンドラの初期バージョンは portal も入れていなかった
--       ため、そのバージョンで取り込まれた行は **source も portal も NULL**。
--       （例: extId='suumo:0140243280' / portal=NULL / source=NULL）
--
--   ⚠ v1 からの変更点
--     v1 は portal の値だけを見て source を埋めていたため、portal が NULL の行を
--     まったく拾えなかった。本版は **extId の接頭辞を第一の判定材料**にし、
--     portal はフォールバックとして使う。これで両方の欠損を埋められる。
--
--   extId 接頭辞と媒体の対応
--     ieul→イエウール / sumai→すまいステップ / anken,iei→イエイ / mikata→HOME's （売り）
--     athome→アットホーム / suumo→SUUMO / homes→HOME'S               （買い）
--
--   ⚠ HOME'S の表記を使い分けている（取り違えると集計が割れる）
--     portal … buyPortals マスタ準拠の HOME'S（大文字S）。portalCosts の引き当てキー
--     source … sources    マスタ準拠の HOME's（小文字s）。売り31件と合流させる
--
--   実行: docker exec -i dashboard-mariadb-db-1 \
--           mariadb --default-character-set=utf8mb4 \
--           -ulocal_user -plocal_password local_db < このファイル
--
--   冪等性: いずれも「IS NULL の列だけ」を更新するため再実行しても安全。
--           手で入れた値を上書きしない。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 手順1. 実行前の状態
-- ---------------------------------------------------------------------------
SELECT
    kind                                                       AS `種別`,
    CASE WHEN extId IS NULL OR extId = '' THEN '(extIdなし)'
         ELSE SUBSTRING_INDEX(extId, ':', 1) END               AS `接頭辞`,
    COUNT(*)                                                   AS `件数`,
    SUM(source IS NULL)                                        AS `sourceが空`,
    SUM(portal IS NULL AND kind = 'buyLeads')                  AS `portalが空(買い)`
FROM   brokerage_listings
WHERE  kind IN ('leads', 'buyLeads')
GROUP  BY `種別`, `接頭辞`
ORDER  BY `種別`, `件数` DESC;

-- ---------------------------------------------------------------------------
-- 手順2. 買いリードの portal を extId から補完
--
--   portal は広告費(portalCosts)の引き当てキー。空だと反響費用が0で出る。
--   source より先に埋める（手順3のフォールバックに使うため）。
-- ---------------------------------------------------------------------------
UPDATE brokerage_listings
SET    portal = CASE SUBSTRING_INDEX(extId, ':', 1)
                    WHEN 'athome' THEN 'アットホーム'
                    WHEN 'suumo'  THEN 'SUUMO'
                    WHEN 'homes'  THEN 'HOME''S'      -- buyPortals マスタ表記（大文字S）
                END
WHERE  kind = 'buyLeads'
  AND  portal IS NULL
  AND  SUBSTRING_INDEX(IFNULL(extId, ''), ':', 1) IN ('athome', 'suumo', 'homes');

-- ---------------------------------------------------------------------------
-- 手順3. source を補完
--
--   第一候補: extId の接頭辞（売り・買いの全媒体をカバー）
--   第二候補: portal の値（extId が無い手入力の行のため）
--   どちらでも決まらない行（'その他' や extId なし）は NULL のまま残す。
-- ---------------------------------------------------------------------------
UPDATE brokerage_listings
SET    source = COALESCE(
           CASE SUBSTRING_INDEX(IFNULL(extId, ''), ':', 1)
               -- 売り
               WHEN 'ieul'   THEN 'イエウール'
               WHEN 'sumai'  THEN 'すまいステップ'
               WHEN 'anken'  THEN 'イエイ'
               WHEN 'iei'    THEN 'イエイ'
               WHEN 'mikata' THEN 'HOME''s'
               -- 買い
               WHEN 'athome' THEN 'アットホーム'
               WHEN 'suumo'  THEN 'SUUMO'
               WHEN 'homes'  THEN 'HOME''s'          -- sources マスタ表記（小文字s）
           END,
           CASE portal
               WHEN 'アットホーム' THEN 'アットホーム'
               WHEN 'SUUMO'        THEN 'SUUMO'
               WHEN 'HOME''S'      THEN 'HOME''s'
               WHEN '楽待'         THEN '楽待'
           END
       )
WHERE  kind IN ('leads', 'buyLeads')
  AND  source IS NULL;

-- ---------------------------------------------------------------------------
-- 手順4. 結果確認
-- ---------------------------------------------------------------------------
SELECT
    kind                        AS `種別`,
    IFNULL(source, '(NULL)')    AS `source`,
    IFNULL(portal, '(NULL)')    AS `portal`,
    COUNT(*)                    AS `件数`
FROM   brokerage_listings
WHERE  kind IN ('leads', 'buyLeads')
GROUP  BY `種別`, `source`, `portal`
ORDER  BY `種別`, `件数` DESC;

-- 残った未判定。extId も portal も無い手入力の行だけのはず
SELECT
    id            AS `id`,
    kind          AS `種別`,
    IFNULL(extId, '(なし)')  AS `extId`,
    IFNULL(portal, '(なし)') AS `portal`,
    name          AS `氏名`,
    receivedDate  AS `反響日`
FROM   brokerage_listings
WHERE  kind IN ('leads', 'buyLeads')
  AND  source IS NULL
ORDER  BY receivedDate DESC;

-- 媒体別の横断集計
SELECT
    IFNULL(source, '(NULL)') AS `反響媒体`,
    SUM(kind = 'leads')      AS `売り`,
    SUM(kind = 'buyLeads')   AS `買い`,
    COUNT(*)                 AS `合計`
FROM   brokerage_listings
WHERE  kind IN ('leads', 'buyLeads')
GROUP  BY source
ORDER  BY `合計` DESC;
