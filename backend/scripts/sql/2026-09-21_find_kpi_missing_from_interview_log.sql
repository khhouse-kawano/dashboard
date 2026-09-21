-- =====================================================================
-- 商談ステップ（interview_sheet）にあるのに KPI 日付が空の顧客を抽出する
--
-- ⚠️⚠️ **このファイルはデータを1件も書き換えない。**
--   ⚠️ 作業テーブル `tmp_steps` を作って消すだけで、⚠️ **UPDATE は無い。**
--
-- ⚠️⚠️ **なぜ起きたか**
--   ⚠️ 顧客詳細（InformationEdit / InformationEditKaeru / InformationEditResale）の
--     保存処理が ⚠️ **`actionMap[interview.action]` を素の文字列で引いていた。**
--   ⚠️ 自社契約・仲介契約・売買契約は TableInterview.tsx が
--     ⚠️ **`自社契約,物件名` という値**を option に出すため、
--     ⚠️ `actionMap` に無い文字列になり `undefined` が返っていた。
--     ⚠️ その結果 ⚠️ **`information['undefined']` に日付が書かれ、
--       master_data 系の KPI 列は空のまま**になっていた。
--   ⚠️ `interview_sheet` には記録されるので ⚠️ **「登録できた」ように見える。**
--     ⚠️ 歩留まりが合わない原因はこれである。
--   ⚠️ ⚠️ **物件名が登録されている顧客でだけ**起きるため、
--     ⚠️ 「登録されることもある」という分かりにくい出方をしていた。
--
--   ⚠️ 2026-09-21 に utils/interviewKpi.ts の `kpiColumnFor()` へ集約して修正した。
--     ⚠️ **今後は起きない。** これは**それまでの取りこぼしを洗い出す**ためのもの。
--
-- ⚠️⚠️ **ここに出た＝すべて不具合、とは限らない。**
--   ⚠️ 商談ステップを登録したあとに ⚠️ **営業が意図して KPI 日付を消した**場合も出る。
--   ⚠️ 埋め戻すかどうかは ⚠️ **一覧を見てから判断すること。**
--   ⚠️ 見分け方: `商談ステップの値` に ⚠️ **カンマ（物件名）が付いていれば今回の不具合**
--     の可能性が高い。
--
-- ⚠️⚠️ **対応表はフロントの actionMap と同じ内容にしてある。**
--   ⚠️ 建売でコメントアウトされている 物件案内 / 次回アクション /
--     事前取得（現金確認含む） / ローン事前承認済み は ⚠️ **入れていない。**
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 【0】から順に実行すること。⚠️ **【0】を飛ばすと以降が全部エラーになる。**
-- =====================================================================


-- ---------------------------------------------------------------------
-- 【0】商談ステップを1行ずつにほどいて作業テーブルに入れる
--
-- ⚠️⚠️ **必ず最初に流すこと。** 以降のクエリはこの表を使う。
-- ⚠️ ここで1回だけ展開する。⚠️ **クエリのたびに展開すると桁違いに遅い**
--   （interview_sheet 約18,000行 × seq 100 = 180万行の走査になる）。
--
-- ⚠️ `seq_0_to_99` は MariaDB の SEQUENCE エンジン。⚠️ **テーブルを作る必要は無い。**
--   ⚠️ 1顧客あたりの商談ステップが100件を超えるなら seq_0_to_999 にすること。
--
-- ⚠️ 日付は `YYYY-MM-DD` に揃えてから入れる（実データに `YYYY/MM/DD` が混在）。
-- ⚠️ `base_action` はカンマの前だけ。⚠️ **物件名を落としたもの**である。
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS tmp_steps;

CREATE TABLE tmp_steps (
  id          VARCHAR(64),
  base_action VARCHAR(64),
  raw_action  VARCHAR(255),
  day         CHAR(10),
  KEY idx_action (base_action),
  KEY idx_id (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tmp_steps (id, base_action, raw_action, day)
SELECT s.id,
       SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(s.interview_log, CONCAT('$[', q.seq, '].action'))), ',', 1),
       LEFT(JSON_UNQUOTE(JSON_EXTRACT(s.interview_log, CONCAT('$[', q.seq, '].action'))), 255),
       REPLACE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(s.interview_log, CONCAT('$[', q.seq, '].day'))), 10), '/', '-')
  FROM interview_sheet s
  JOIN seq_0_to_99 q ON q.seq < JSON_LENGTH(s.interview_log)
 WHERE s.interview_log IS NOT NULL;

-- ⚠️ 日付として読めない行は落とす（空欄・書式違い）
DELETE FROM tmp_steps WHERE day IS NULL OR day NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

SELECT COUNT(*) AS 展開した商談ステップ数 FROM tmp_steps;


-- ---------------------------------------------------------------------
-- 【A】アクションごとの件数と、⚠️ **物件名が付いている数**
--
-- ⚠️⚠️ **`うち物件名つき` が今回の不具合に直接あたる。** ⚠️ ここが本命。
-- ---------------------------------------------------------------------
SELECT base_action AS アクション,
       COUNT(*)    AS 件数,
       SUM(raw_action LIKE '%,%') AS うち物件名つき
  FROM tmp_steps
 GROUP BY base_action
 ORDER BY うち物件名つき DESC, 件数 DESC;


-- ---------------------------------------------------------------------
-- 【B】取りこぼしの件数（事業・アクションごと）
--
-- ⚠️ 0件の行も出る。⚠️ **どこで起きているかを掴むために全部出している。**
-- ---------------------------------------------------------------------
SELECT '注文 / 資料送付' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '資料送付' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_catalog, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 0次接客' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '0次接客' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1WE8SKEES6VNN37B22, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 初回面談' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '初回面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 2回目以降面談' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '2回目以降面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 事前審査' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '事前審査' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / LINEグループ作成' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = 'LINEグループ作成' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 契約' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 接触（通話・返信）' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_kaeru m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '接触（通話・返信）' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 初回面談' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_kaeru m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '初回面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 2回目以降面談' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_kaeru m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '2回目以降面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 申し込み' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_kaeru m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '申し込み' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 自社契約' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_kaeru m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '自社契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 仲介契約' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_kaeru m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '仲介契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '')) IN ('', 'null')
UNION ALL
SELECT '中古 買い:中古リノベ / 初回来場' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '初回来場' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 物件案内' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '物件案内' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 2回目以降面談' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '2回目以降面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 2回目以降物件案内' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '2回目以降物件案内' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 事前審査' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '事前審査' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / リフォーム契約' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = 'リフォーム契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 売買契約' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '売買契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:ポータル / 初回来場' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '初回来場' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 物件案内' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '物件案内' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 2回目以降面談' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '2回目以降面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 2回目以降物件案内' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '2回目以降物件案内' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 事前審査' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '事前審査' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 売買契約' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '売買契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 売り:ポータル / 査定アポ' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '査定アポ' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '')) IN ('', 'null')
   AND m.in_charge_store = '売り:ポータル'
UNION ALL
SELECT '中古 売り:ポータル / 査定書提出' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '査定書提出' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1WE8SKEES6VNN37B22, '')) IN ('', 'null')
   AND m.in_charge_store = '売り:ポータル'
UNION ALL
SELECT '中古 売り:ポータル / 訪問査定' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '訪問査定' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN, '')) IN ('', 'null')
   AND m.in_charge_store = '売り:ポータル'
UNION ALL
SELECT '中古 売り:ポータル / 媒介取得' AS 区分, COUNT(*) AS 取りこぼし件数
  FROM master_data_resale m
  JOIN (SELECT id FROM tmp_steps WHERE base_action = '媒介取得' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '')) IN ('', 'null')
   AND m.in_charge_store = '売り:ポータル'
 ORDER BY 取りこぼし件数 DESC;


-- ---------------------------------------------------------------------
-- 【C】顧客の一覧（⚠️ CSV に書き出して営業に配れる形）
--
-- ⚠️ `入るはずの日付`   … 商談ステップから導ける ⚠️ **最も古い日付**
-- ⚠️ `商談ステップの値` … ⚠️ **カンマの後ろが物件名。** 付いていれば今回の不具合。
-- ---------------------------------------------------------------------
SELECT '注文 / 資料送付' AS 区分,
       'step_migration_item_catalog' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '資料送付' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_catalog, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 0次接客' AS 区分,
       'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '0次接客' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1WE8SKEES6VNN37B22, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 初回面談' AS 区分,
       'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '初回面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 2回目以降面談' AS 区分,
       'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '2回目以降面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 事前審査' AS 区分,
       'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '事前審査' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / LINEグループ作成' AS 区分,
       'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = 'LINEグループ作成' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN, '')) IN ('', 'null')
UNION ALL
SELECT '注文 / 契約' AS 区分,
       'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 接触（通話・返信）' AS 区分,
       'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_kaeru m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '接触（通話・返信）' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 初回面談' AS 区分,
       'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_kaeru m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '初回面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 2回目以降面談' AS 区分,
       'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_kaeru m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '2回目以降面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 申し込み' AS 区分,
       'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_kaeru m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '申し込み' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 自社契約' AS 区分,
       'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_kaeru m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '自社契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '')) IN ('', 'null')
UNION ALL
SELECT '建売 / 仲介契約' AS 区分,
       'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_kaeru m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '仲介契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '')) IN ('', 'null')
UNION ALL
SELECT '中古 買い:中古リノベ / 初回来場' AS 区分,
       'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '初回来場' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 物件案内' AS 区分,
       'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '物件案内' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 2回目以降面談' AS 区分,
       'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '2回目以降面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 2回目以降物件案内' AS 区分,
       'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '2回目以降物件案内' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 事前審査' AS 区分,
       'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '事前審査' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / リフォーム契約' AS 区分,
       'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = 'リフォーム契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:中古リノベ / 売買契約' AS 区分,
       'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '売買契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:中古リノベ'
UNION ALL
SELECT '中古 買い:ポータル / 初回来場' AS 区分,
       'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '初回来場' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 物件案内' AS 区分,
       'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '物件案内' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 2回目以降面談' AS 区分,
       'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '2回目以降面談' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 2回目以降物件案内' AS 区分,
       'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '2回目以降物件案内' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 事前審査' AS 区分,
       'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '事前審査' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 買い:ポータル / 売買契約' AS 区分,
       'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '売買契約' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '')) IN ('', 'null')
   AND m.in_charge_store = '買い:ポータル'
UNION ALL
SELECT '中古 売り:ポータル / 査定アポ' AS 区分,
       'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '査定アポ' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '')) IN ('', 'null')
   AND m.in_charge_store = '売り:ポータル'
UNION ALL
SELECT '中古 売り:ポータル / 査定書提出' AS 区分,
       'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '査定書提出' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01J82Z5F1WE8SKEES6VNN37B22, '')) IN ('', 'null')
   AND m.in_charge_store = '売り:ポータル'
UNION ALL
SELECT '中古 売り:ポータル / 訪問査定' AS 区分,
       'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '訪問査定' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN, '')) IN ('', 'null')
   AND m.in_charge_store = '売り:ポータル'
UNION ALL
SELECT '中古 売り:ポータル / 媒介取得' AS 区分,
       'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0' AS 空のままの列,
       m.id, m.customer_contacts_name AS 顧客名,
       m.in_charge_store AS 店舗, m.in_charge_user AS 担当, m.status AS ステータス,
       t.day AS 入るはずの日付, t.raw_action AS 商談ステップの値
  FROM master_data_resale m
  JOIN (SELECT id, MIN(day) AS day, MIN(raw_action) AS raw_action
          FROM tmp_steps WHERE base_action = '媒介取得' GROUP BY id) t
    ON t.id = m.id
 WHERE TRIM(COALESCE(m.step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '')) IN ('', 'null')
   AND m.in_charge_store = '売り:ポータル'
 ORDER BY 区分, 入るはずの日付 DESC;


-- ---------------------------------------------------------------------
-- 【D】'undefined' という列が生えていないかの確認
--
-- ⚠️ 不具合は `information['undefined']` にも書いていた。
-- ⚠️⚠️ **許可リスト（core/allowed_columns.php）が弾くので列は増えていないはず**だが、
--   念のため見ておくこと。⚠️ **1行でも返ったら報告すること。**
-- ---------------------------------------------------------------------
SHOW COLUMNS FROM master_data        LIKE '%undefined%';
SHOW COLUMNS FROM master_data_kaeru  LIKE '%undefined%';
SHOW COLUMNS FROM master_data_resale LIKE '%undefined%';


-- ---------------------------------------------------------------------
-- 【E】後片付け
--
-- ⚠️⚠️ **作業テーブルを必ず消すこと。** ⚠️ 残すと次回 CREATE でエラーになる
--   （【0】の DROP で消えるが、本番に不要な表を残さない）。
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS tmp_steps;
