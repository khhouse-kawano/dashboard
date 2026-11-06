-- =====================================================================
-- v2.2.253 不動産企画係：売り反響・買い反響の連絡先（電話・メール）が消えた原因を調べる（読むだけ。書き込みなし）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何回流してもよい
-- ⚠️ 電話番号・メールアドレスそのものは出さない（件数と日時だけ）
-- ⚠️ information_schema は使わない（① では #1044）
-- 結果は 1〜8 の表をそのまま貼ってください
-- =====================================================================

-- 1. 今の件数（表示中の行）。phone/mail が空・contact が空・以前のアプリの原本（raw_data）がある
SELECT kind,
  COUNT(*) AS `表示中`,
  SUM(IFNULL(phone,'') = '') AS `電話が空`,
  SUM(IFNULL(mail,'') = '') AS `メールが空`,
  SUM(IFNULL(contact,'') = '') AS `連絡先が空`,
  SUM(IFNULL(phone,'') = '' AND IFNULL(contact,'') <> '') AS `電話が空で連絡先あり`,
  SUM(raw_data IS NOT NULL) AS `原本あり`,
  SUM(IFNULL(phone,'') = '' AND IFNULL(contact,'') = '' AND raw_data IS NOT NULL
      AND IFNULL(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.contact')),'') NOT IN ('', 'null')) AS `電話も連絡先も空で原本に連絡先あり`
FROM brokerage_listings
WHERE kind IN ('leads','buyLeads') AND (show_dashboard IS NULL OR show_dashboard <> 0)
GROUP BY kind;

-- 2. 非表示（論理削除）にされた行の理由と日（直近）。取り込みの全面差し替え・重複の非表示が無いか
SELECT kind, IFNULL(deleted_by,'(なし)') AS `理由`, DATE(deleted_at) AS `日`, COUNT(*) AS `件数`,
  SUM(IFNULL(phone,'') <> '') AS `うち電話あり`
FROM brokerage_listings
WHERE kind IN ('leads','buyLeads') AND show_dashboard = 0
GROUP BY kind, deleted_by, DATE(deleted_at)
ORDER BY `日` DESC
LIMIT 30;

-- 3. 電話が空の表示中の行は、いつ最後に更新されたか（一度にまとめて変わった時刻があるか）
SELECT kind, DATE_FORMAT(updated_at, '%Y-%m-%d %H:00') AS `更新の時刻`, COUNT(*) AS `電話が空の行`
FROM brokerage_listings
WHERE kind IN ('leads','buyLeads') AND (show_dashboard IS NULL OR show_dashboard <> 0) AND IFNULL(phone,'') = ''
GROUP BY kind, DATE_FORMAT(updated_at, '%Y-%m-%d %H:00')
ORDER BY `更新の時刻` DESC
LIMIT 20;

-- 4. 電話が空の表示中の行は、いつ作られたか（取り込みで行が作り直されていないか）
SELECT kind, DATE(created_at) AS `作成日`, COUNT(*) AS `電話が空の行`, SUM(raw_data IS NOT NULL) AS `うち原本あり`
FROM brokerage_listings
WHERE kind IN ('leads','buyLeads') AND (show_dashboard IS NULL OR show_dashboard <> 0) AND IFNULL(phone,'') = ''
GROUP BY kind, DATE(created_at)
ORDER BY `作成日` DESC
LIMIT 20;

-- 5. 画面で電話・メール・連絡先を変えた履歴（直近14日。日・項目・操作した人ごと）
SELECT DATE(`at`) AS `日`, field AS `項目`, `by` AS `操作した人`, COUNT(*) AS `件数`,
  SUM(`to` = '（未設定）') AS `空にした件数`
FROM brokerage_listings
WHERE kind = 'logs' AND field IN ('phone','mail','contact') AND `at` >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
GROUP BY DATE(`at`), field, `by`
ORDER BY `日` DESC
LIMIT 30;

-- 6. v2.2.251 の SQL の控えの表にある行（v2.2.251 を流した時点の売り・買い反響）が、今どうなっているか
--    ⚠️ 控えの表が無いと「Table doesn't exist」になる。その場合は 6 を飛ばして 7 から
SELECT l.kind,
  COUNT(*) AS `v2.2.251の時点の行`,
  SUM(l.show_dashboard = 0) AS `いま非表示`,
  SUM((l.show_dashboard IS NULL OR l.show_dashboard <> 0) AND IFNULL(l.phone,'') = '') AS `いま表示中で電話が空`,
  SUM((l.show_dashboard IS NULL OR l.show_dashboard <> 0) AND IFNULL(l.mail,'') = '') AS `いま表示中でメールが空`
FROM brokerage_listings_bk_20261105_contact b
JOIN brokerage_listings l ON l.internal_id = b.internal_id
GROUP BY l.kind;

-- 7. 控えの表にない行（v2.2.251 のあとにできた行）の数
SELECT kind, COUNT(*) AS `件数`, MIN(created_at) AS `最初`, MAX(created_at) AS `最後`
FROM brokerage_listings
WHERE kind IN ('leads','buyLeads') AND created_at >= '2026-11-05'
GROUP BY kind;

-- 8. 版の記録（どの版まで入っているか）
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 5;
