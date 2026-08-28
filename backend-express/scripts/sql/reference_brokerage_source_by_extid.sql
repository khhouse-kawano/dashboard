-- ============================================================================
-- brokerage_listings: 反響媒体の判定・診断（参照専用。UPDATE/DELETE は無し）
--
--   ⚠ `id` からは媒体を判定できない
--     id はアプリ採番のランダム値で、媒体の情報を含まない。
--       'x' + Date.now().toString(36) + Math.random().toString(36).slice(2,7) + 連番
--     判定に使えるのは **extId の接頭辞** と `source` / `portal` の3つ。
--
--   extId 接頭辞と媒体の対応（実データから確認）
--     ┌────────────┬──────────────┬──────────┐
--     │ 接頭辞      │ 媒体          │ 売/買     │
--     ├────────────┼──────────────┼──────────┤
--     │ ieul       │ イエウール      │ 売り      │
--     │ sumai      │ すまいステップ   │ 売り      │
--     │ anken      │ イエイ         │ 売り      │  ← 旧形式。案件番号
--     │ iei        │ イエイ         │ 売り      │  ← 新形式。受付日:姓名
--     │ mikata     │ HOME's        │ 売り      │  ← 売却査定の反響
--     │ athome     │ アットホーム    │ 買い      │
--     │ suumo      │ SUUMO         │ 買い      │
--     │ homes      │ HOME'S        │ 買い      │  ← 物件問合せ
--     └────────────┴──────────────┴──────────┘
--
--     ※ HOME'S は売り・買いの両方に存在し、**表記が違う**
--          売り(sources マスタ)    … HOME's  小文字s
--          買い(buyPortals マスタ) … HOME'S  大文字S
--
--   実行: docker exec -i dashboard-mariadb-db-1 \
--           mariadb --default-character-set=utf8mb4 \
--           -ulocal_user -plocal_password local_db < このファイル
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. extId 接頭辞から媒体を判定して一覧表示
--
--    「本来こうあるべき媒体」を接頭辞から導き、実際の source / portal と
--    並べて表示する。取り込みの取りこぼしや取り違えはここに出る。
-- ---------------------------------------------------------------------------
SELECT
    b.kind                                            AS `種別`,
    CASE
        WHEN b.extId IS NULL OR b.extId = '' THEN '(extIdなし)'
        ELSE SUBSTRING_INDEX(b.extId, ':', 1)
    END                                               AS `接頭辞`,
    CASE SUBSTRING_INDEX(IFNULL(b.extId, ''), ':', 1)
        WHEN 'ieul'   THEN 'イエウール'
        WHEN 'sumai'  THEN 'すまいステップ'
        WHEN 'anken'  THEN 'イエイ'
        WHEN 'iei'    THEN 'イエイ'
        WHEN 'mikata' THEN 'HOME''s'
        WHEN 'athome' THEN 'アットホーム'
        WHEN 'suumo'  THEN 'SUUMO'
        WHEN 'homes'  THEN 'HOME''S'
        ELSE NULL
    END                                               AS `接頭辞から判定した媒体`,
    IFNULL(b.source, '(NULL)')                        AS `source`,
    IFNULL(b.portal, '(NULL)')                        AS `portal`,
    COUNT(*)                                          AS `件数`
FROM   brokerage_listings b
WHERE  b.kind IN ('leads', 'buyLeads')
GROUP  BY `種別`, `接頭辞`, `接頭辞から判定した媒体`, `source`, `portal`
ORDER  BY `種別`, `件数` DESC;

-- ---------------------------------------------------------------------------
-- 2. 不整合の検出
--
--    接頭辞から判定できる媒体と、実際に入っている source が食い違う行。
--    ここが0件なら媒体データは揃っている。
-- ---------------------------------------------------------------------------
SELECT
    b.id                                    AS `id`,
    b.kind                                  AS `種別`,
    b.extId                                 AS `extId`,
    IFNULL(b.source, '(NULL)')              AS `実際のsource`,
    CASE SUBSTRING_INDEX(b.extId, ':', 1)
        WHEN 'ieul'   THEN 'イエウール'
        WHEN 'sumai'  THEN 'すまいステップ'
        WHEN 'anken'  THEN 'イエイ'
        WHEN 'iei'    THEN 'イエイ'
        WHEN 'mikata' THEN 'HOME''s'
        WHEN 'athome' THEN 'アットホーム'
        WHEN 'suumo'  THEN 'SUUMO'
        WHEN 'homes'  THEN 'HOME''S'
    END                                     AS `あるべきsource`,
    b.name                                  AS `氏名`,
    b.receivedDate                          AS `反響日`
FROM   brokerage_listings b
WHERE  b.kind IN ('leads', 'buyLeads')
  AND  b.extId IS NOT NULL AND b.extId <> ''
  AND  SUBSTRING_INDEX(b.extId, ':', 1)
       IN ('ieul','sumai','anken','iei','mikata','athome','suumo','homes')
  AND  IFNULL(b.source, '') <> CASE SUBSTRING_INDEX(b.extId, ':', 1)
        WHEN 'ieul'   THEN 'イエウール'
        WHEN 'sumai'  THEN 'すまいステップ'
        WHEN 'anken'  THEN 'イエイ'
        WHEN 'iei'    THEN 'イエイ'
        WHEN 'mikata' THEN 'HOME''s'
        WHEN 'athome' THEN 'アットホーム'
        WHEN 'suumo'  THEN 'SUUMO'
        WHEN 'homes'  THEN 'HOME''S'
       END
ORDER  BY b.receivedDate DESC;

-- ---------------------------------------------------------------------------
-- 3. 媒体別サマリー（売り・買いの横断集計）
--
--    KPIサマリーの「反響費用」はこの source / portal を単価表に引き当てて出す。
-- ---------------------------------------------------------------------------
SELECT
    IFNULL(b.source, '(NULL)')      AS `反響媒体`,
    SUM(b.kind = 'leads')           AS `売り`,
    SUM(b.kind = 'buyLeads')        AS `買い`,
    COUNT(*)                        AS `合計`,
    MIN(b.receivedDate)             AS `最古`,
    MAX(b.receivedDate)             AS `最新`
FROM   brokerage_listings b
WHERE  b.kind IN ('leads', 'buyLeads')
GROUP  BY b.source
ORDER  BY `合計` DESC;

-- ---------------------------------------------------------------------------
-- 4. 売り／買いの妥当性チェック
--
--    kind が正しいかを、埋まっている列の傾向から判断する材料。
--      売りリード … addr(物件住所) / visitDate(訪問査定日) / reason(売却理由)
--      買いリード … targetProperty(希望物件) / budget(予算) / viewDate(内見日)
--
--    「売りに分類されているのに希望物件・予算を持つ」行があれば kind の誤りを疑う。
-- ---------------------------------------------------------------------------
SELECT
    b.kind                                                  AS `種別`,
    IFNULL(b.source, '(NULL)')                              AS `反響媒体`,
    COUNT(*)                                                AS `件数`,
    SUM(b.addr IS NOT NULL)                                 AS `物件住所`,
    SUM(b.visitDate IS NOT NULL)                            AS `訪問査定日`,
    SUM(b.reason IS NOT NULL)                               AS `売却理由`,
    SUM(b.targetProperty IS NOT NULL)                       AS `希望物件`,
    SUM(b.budget IS NOT NULL)                               AS `予算`,
    SUM(b.viewDate IS NOT NULL)                             AS `内見日`
FROM   brokerage_listings b
WHERE  b.kind IN ('leads', 'buyLeads')
GROUP  BY b.kind, b.source
ORDER  BY b.kind, `件数` DESC;

-- ---------------------------------------------------------------------------
-- 5. 種別が疑わしい行の抽出
--
--    売りリードなのに希望物件か予算を持つ／
--    買いリードなのに訪問査定日か売却理由を持つ行。
-- ---------------------------------------------------------------------------
SELECT
    b.id            AS `id`,
    b.kind          AS `種別`,
    b.extId         AS `extId`,
    b.source        AS `反響媒体`,
    b.name          AS `氏名`,
    b.receivedDate  AS `反響日`,
    b.targetProperty AS `希望物件`,
    b.budget        AS `予算`,
    b.visitDate     AS `訪問査定日`,
    b.reason        AS `売却理由`
FROM   brokerage_listings b
WHERE  (b.kind = 'leads'    AND (b.targetProperty IS NOT NULL OR b.budget IS NOT NULL))
   OR  (b.kind = 'buyLeads' AND (b.visitDate      IS NOT NULL OR b.reason IS NOT NULL))
ORDER  BY b.kind, b.receivedDate DESC;
