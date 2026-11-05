-- =====================================================================
-- v2.2.251 不動産企画係：売り反響・買い反響の電話番号・メールアドレスを、連絡先（contact）から入れる
--
--   原因：以前のアプリには連絡先の欄が contact の1つ（「電話 / メール」）しか無く、取り込みは contact だけを写した。
--         Dashboard の一覧・編集画面は phone・mail の列を見るので、ほぼ全件が「取れていない」ように見えていた。
--         （sync → ① handlers/portal/*.php・HOME'S の査定メール・画面からの登録は、phone・mail も入れている）
--
--   ・phone が空の行 … contact からメールアドレスの部分を除き、最初の「数字とハイフン類のかたまり」を数字だけにして入れる
--       0 から始まる 10〜11桁ならそのまま。50・70・80・90 から始まる 10桁は、先頭の 0 が落ちた携帯・IP電話とみて 0 を足す
--       （以前の取り込みに「9012345678」の形が 37件あった。表計算で数として扱われて 0 が消えたとみられる）。それ以外の形は入れない
--   ・mail が空の行  … contact の中のメールアドレスの形の最初のものを入れる
--   ・入っている値は変えない。contact も変えない
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 何回流しても同じ（2回目は何も変わらない）
-- ⚠️ 安全更新モード（ERROR 1175）でも通るよう、UPDATE の条件に主キー（internal_id）を入れている
-- ⚠️ 取り出し方は ② の features/realty/contactSplit.ts（phoneFromContact・mailFromContact）と同じ。⚠️ どちらかを変えたら両方を変える
-- ⚠️ 確認の SELECT は件数だけ（電話番号・メールアドレスは画面に出さない）
-- =====================================================================

-- 0. 直す前の値の控え（戻すときに使う。2回目以降は作らない）
CREATE TABLE IF NOT EXISTS brokerage_listings_bk_20261105_contact AS
  SELECT internal_id, id, kind, phone, mail
    FROM brokerage_listings
   WHERE kind IN ('leads', 'buyLeads');

-- 1. 作業用の表に、contact から取り出した値を入れる（同じ式を何度も書かないため。⚠️ 最後に消す）
--    ⚠️ 一時表（TEMPORARY）にしないのは、1つの UPDATE の中で2回読むため（一時表は2回開けない）
DROP TABLE IF EXISTS work_20261105_contact_split;
CREATE TABLE work_20261105_contact_split AS
  SELECT x.internal_id,
         CASE
           WHEN x.digits REGEXP '^0[0-9]{9,10}$' THEN x.digits
           WHEN x.digits REGEXP '^[5789]0[0-9]{8}$' THEN CONCAT('0', x.digits)
           ELSE ''
         END AS phone_new,
         x.mail_new
    FROM (
      SELECT internal_id,
             REGEXP_REPLACE(
               IFNULL(REGEXP_SUBSTR(
                 REGEXP_REPLACE(IFNULL(contact, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}', ' '),
                 '[0-9][-‐－⁻ー−0-9]{7,14}[0-9]'), ''),
               '[^0-9]', '') AS digits,
             IFNULL(REGEXP_SUBSTR(IFNULL(contact, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}'), '') AS mail_new
        FROM brokerage_listings
       WHERE kind IN ('leads', 'buyLeads')
    ) x;

-- 確認（前）
SELECT b.kind,
       COUNT(*) AS 件数,
       SUM(IFNULL(b.phone, '') = '') AS 電話が空,
       SUM(IFNULL(b.mail, '') = '') AS メールが空,
       SUM(IFNULL(b.phone, '') = '' AND t.phone_new <> '') AS 電話を入れられる,
       SUM(IFNULL(b.mail, '') = '' AND t.mail_new <> '') AS メールを入れられる
  FROM brokerage_listings b JOIN work_20261105_contact_split t ON t.internal_id = b.internal_id
 GROUP BY b.kind;

-- 2. 電話番号（⚠️ 安全更新モードでは JOIN の UPDATE が止まるので、主キーの IN と、副問い合わせで入れる）
UPDATE brokerage_listings
   SET phone = (SELECT t.phone_new FROM work_20261105_contact_split t WHERE t.internal_id = brokerage_listings.internal_id)
 WHERE internal_id > 0
   AND internal_id IN (SELECT t.internal_id FROM work_20261105_contact_split t WHERE t.phone_new <> '')
   AND IFNULL(phone, '') = '';

-- 3. メールアドレス
UPDATE brokerage_listings
   SET mail = (SELECT t.mail_new FROM work_20261105_contact_split t WHERE t.internal_id = brokerage_listings.internal_id)
 WHERE internal_id > 0
   AND internal_id IN (SELECT t.internal_id FROM work_20261105_contact_split t WHERE t.mail_new <> '')
   AND IFNULL(mail, '') = '';

-- 確認（後）: 「電話を入れられる」「メールを入れられる」が 0 ならよい
--   「連絡先も無い」は取り込み元にも連絡先が無い反響（取り戻せない）
--   「連絡先はあるが電話の形でない」は、桁が足りないなど（電話は入れていない。必要なら画面で直す）
SELECT b.kind,
       COUNT(*) AS 件数,
       SUM(IFNULL(b.phone, '') = '') AS 電話が空,
       SUM(IFNULL(b.mail, '') = '') AS メールが空,
       SUM(IFNULL(b.phone, '') = '' AND t.phone_new <> '') AS 電話を入れられる,
       SUM(IFNULL(b.mail, '') = '' AND t.mail_new <> '') AS メールを入れられる,
       SUM(IFNULL(b.contact, '') = '') AS 連絡先も無い,
       SUM(IFNULL(b.phone, '') = '' AND IFNULL(b.contact, '') REGEXP '[0-9]{4}') AS 連絡先はあるが電話の形でない
  FROM brokerage_listings b JOIN work_20261105_contact_split t ON t.internal_id = b.internal_id
 GROUP BY b.kind;

DROP TABLE IF EXISTS work_20261105_contact_split;

-- 戻すとき（必要なときだけ。⚠️ ふだんは流さない）
-- UPDATE brokerage_listings b JOIN brokerage_listings_bk_20261105_contact k ON k.internal_id = b.internal_id
--    SET b.phone = k.phone, b.mail = k.mail WHERE b.internal_id > 0;
-- 戻す必要が無くなったら、控えの表を消す
-- DROP TABLE brokerage_listings_bk_20261105_contact;
