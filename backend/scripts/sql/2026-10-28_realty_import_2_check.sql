-- =====================================================================
-- 不動産企画係: 以前のアプリのデータを取り込んだ**あと**の確認（読むだけ。何も変えない）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 先に 2026-10-28_realty_import_1_backup.sql で控えを作ってあること（控えと比べる）
-- =====================================================================

-- 1. 種類ごとの件数（取り込み前 → 取り込み後）。表示中・非表示に分けて
SELECT k.kind AS 種類,
       IFNULL(b.cnt, 0) AS 取り込み前,
       IFNULL(a.cnt, 0) AS 取り込み後,
       IFNULL(a.visible, 0) AS うち表示中,
       IFNULL(a.hidden_import, 0) AS うち以前のアプリで削除,
       IFNULL(a.hidden_not_in_app, 0) AS うち以前のアプリに無い行,
       IFNULL(a.hidden_dup, 0) AS うち重複で非表示
  FROM (SELECT DISTINCT kind FROM brokerage_listings) k
  LEFT JOIN (SELECT kind, COUNT(*) cnt FROM brokerage_listings_bk_import GROUP BY kind) b ON b.kind = k.kind
  LEFT JOIN (SELECT kind, COUNT(*) cnt,
                    SUM(show_dashboard IS NULL OR show_dashboard <> 0) visible,
                    SUM(deleted_by = '以前のアプリで削除') hidden_import,
                    SUM(deleted_by = '以前のアプリに無い行') hidden_not_in_app,
                    SUM(deleted_by = '以前のアプリと重複') hidden_dup
               FROM brokerage_listings GROUP BY kind) a ON a.kind = k.kind
 ORDER BY k.kind;

-- 2. 中身が変わった行の数（種類ごと）
SELECT n.kind AS 種類, COUNT(*) AS 変わった行
  FROM brokerage_listings n
  JOIN brokerage_listings_bk_import o ON o.internal_id = n.internal_id
 WHERE NOT (o.raw_data <=> n.raw_data) OR NOT (o.id <=> n.id) OR NOT (o.show_dashboard <=> n.show_dashboard)
 GROUP BY n.kind;

-- 3. id をそろえた行（Dashboard のポータル取り込みの行を、以前のアプリの id に付け替えた）
SELECT n.kind AS 種類, o.id AS 前のid, n.id AS 今のid, n.extId AS 反響番号, n.name AS 名前
  FROM brokerage_listings n
  JOIN brokerage_listings_bk_import o ON o.internal_id = n.internal_id
 WHERE o.id <> n.id;

-- 4. 設定・週報・コンプライアンスの大きさと更新日時（前 → 後）
SELECT n.`key`, LENGTH(o.`data`) AS 前の大きさ, LENGTH(n.`data`) AS 今の大きさ, o.updated_at AS 前の更新, n.updated_at AS 今の更新
  FROM app_state n LEFT JOIN app_state_bk_import o ON o.`key` = n.`key`;

-- 5. 最新の受信日（以前のアプリの最近の入力が入ったか）
SELECT kind AS 種類, MAX(receivedDate) AS 最新の受信日, MAX(contractDate) AS 最新の契約日
  FROM brokerage_listings
 WHERE show_dashboard IS NULL OR show_dashboard <> 0
 GROUP BY kind;
