-- =====================================================================
-- v2.2.252 不動産企画係：売り反響・買い反響の連絡先（contact）が空のものを「電話 / メール」で埋める
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何回流しても同じ（空の連絡先だけを埋める）
-- ⚠️ 対象: v2.2.247 からの「反響を追加」で登録した反響など、電話・メールはあるが連絡先が空のもの
--   入っている連絡先は変えない（以前のアプリの書き込みを残す）
-- ⚠️ 安全更新モード（ERROR 1175）でも通るよう、WHERE に主キーの範囲（internal_id > 0）を入れる
-- ⚠️ 電話番号・メールアドレスそのものは出さない（件数だけ）
-- =====================================================================

-- 0. 確認（前）
SELECT kind,
  SUM(IFNULL(contact,'') = '' AND (IFNULL(phone,'') <> '' OR IFNULL(mail,'') <> '')) AS `連絡先を埋められる`,
  COUNT(*) AS `件数`
FROM brokerage_listings WHERE kind IN ('leads','buyLeads') GROUP BY kind;

-- 1. 控え（直す行の、直す前の値）
CREATE TABLE IF NOT EXISTS brokerage_listings_bk_20261105_contact_fill AS
SELECT internal_id, id, kind, contact FROM brokerage_listings WHERE 1 = 0;

INSERT INTO brokerage_listings_bk_20261105_contact_fill (internal_id, id, kind, contact)
SELECT b.internal_id, b.id, b.kind, b.contact FROM brokerage_listings b
WHERE b.kind IN ('leads','buyLeads')
  AND IFNULL(b.contact,'') = ''
  AND (IFNULL(b.phone,'') <> '' OR IFNULL(b.mail,'') <> '')
  AND b.internal_id NOT IN (SELECT internal_id FROM brokerage_listings_bk_20261105_contact_fill);

-- 2. 埋める（形は sync・HOME'S 査定メールと同じ「電話 / メール」）
UPDATE brokerage_listings
SET contact = CONCAT_WS(' / ', NULLIF(TRIM(phone),''), NULLIF(TRIM(mail),''))
WHERE internal_id > 0
  AND kind IN ('leads','buyLeads')
  AND IFNULL(contact,'') = ''
  AND (IFNULL(phone,'') <> '' OR IFNULL(mail,'') <> '');

-- 3. 確認（後）：「連絡先を埋められる」が 0 なら済み
SELECT kind,
  SUM(IFNULL(contact,'') = '' AND (IFNULL(phone,'') <> '' OR IFNULL(mail,'') <> '')) AS `連絡先を埋められる`,
  COUNT(*) AS `件数`
FROM brokerage_listings WHERE kind IN ('leads','buyLeads') GROUP BY kind;
SELECT COUNT(*) AS `控えた行` FROM brokerage_listings_bk_20261105_contact_fill;

-- 戻すとき（埋めた連絡先を空に戻す）:
-- UPDATE brokerage_listings SET contact = NULL
-- WHERE internal_id > 0 AND internal_id IN (SELECT internal_id FROM brokerage_listings_bk_20261105_contact_fill);
-- しばらくして問題が無ければ控えを消す:
-- DROP TABLE brokerage_listings_bk_20261105_contact_fill;
