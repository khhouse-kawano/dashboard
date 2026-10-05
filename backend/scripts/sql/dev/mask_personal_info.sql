-- =====================================================================
-- 個人情報のマスク（自宅の開発環境用）
--
-- ⚠️⚠️⚠️ **本番では絶対に実行しないこと。** ⚠️ 元に戻せない。
--   ⚠️ 顧客の氏名・かな・メールアドレス・電話番号を `*` に書き換える。
--   ⚠️ バックアップからしか復元できない。
--
-- ⚠️ 実行環境: 自宅の Ubuntu の Docker（dashboard-mariadb-db-1 の local_db）
--
-- 実行方法（⚠️ 2行目の SET を付けないと安全装置で止まる）:
--
--   docker cp backend/scripts/sql/dev/mask_personal_info.sql dashboard-mariadb-db-1:/tmp/mask.sql
--   docker exec -i dashboard-mariadb-db-1 sh -c \
--     'mariadb --default-character-set=utf8mb4 -uroot -p"$MARIADB_ROOT_PASSWORD" local_db \
--        -e "SET @confirm_mask = '"'"'YES'"'"'; source /tmp/mask.sql;"'
--
-- ─────────────────────────────────────────────
-- ⚠️⚠️ 安全装置（2つとも満たさないと何もせずに止まる）
--   1. 接続先のDB名が `local_db` であること
--      （⚠️ 本番のDB名は local_db ではない。⚠️ 誤って本番に流しても、ここで止まる）
--   2. 実行前に `SET @confirm_mask = 'YES';` を打っていること
--      （⚠️ ⚠️ **会社のPCのローカルDBも `local_db` という名前**なので、
--        1つ目だけでは会社の開発データを消してしまう。⚠️ 意図した実行だと明示させる）
--
-- ⚠️ 全体を1つのブロック・1つのトランザクションにしてある。⚠️ 途中で失敗したら**何も変わらない**。
--   ⚠️ 対象の表はすべて InnoDB（2026-10-05 確認）。
-- ─────────────────────────────────────────────
-- 書き換え方
--   氏名・かな … 同じ文字数の `*`（例: 山田 太郎 → *****）。空は空のまま
--   メール     … `@` と `.` だけ残す（例: taro@example.com → ****@*******.***）
--     ⚠️ 一意制約のある4表（catalog_kaeru / catalog_resale / reserve_kaeru / reserve_resale）は
--       ⚠️ 同じ形だと重複して失敗するため、`********<no>@****.***` にする
--   電話・FAX  … 数字（半角・全角）だけ `*`（例: 090-1234-5678 → ***-****-****）
--
-- ⚠️⚠️ 対象外にしたもの（意図的）
--   ⚠️ スタッフの氏名（staff / staff_list / created_by_name など）
--     ⚠️ 営業別の集計などで**顧客の担当営業と突合している**ため。⚠️ 伏せると画面が壊れる
--   ⚠️ call_achievement.name（98件すべてスタッフ名）/ company_achievement.name（3割がスタッフ名）
--   ⚠️ funding_plan.x_tel（⚠️ 電話番号ではなく家計の通信費。decimal）
--   ⚠️ 物件名・会社名・キャンペーン名・店舗名
--   ⚠️ form_table / form_database の mail_to / mail_cc（社内の通知先）
--
-- ⚠️⚠️ **伏せていないもの（残る個人情報）**
--   ⚠️ 住所（zip / pref / city / town / street など）
--   ⚠️ 自由記述（remarks / note / interview_log / master_data_log など）
--     ⚠️ 本文に氏名や電話番号が書かれていることがある
--   ⚠️ 判定できなかった列: introductory.name / spreadSheet.name / registered_estate.name /
--     hotlead_db.client_user_name
--
-- 生成: 2026-10-05（v2.2.163）。⚠️ 64表・261列。
--   ⚠️ 列を足すときは docs/task-2026-10-05-01-*.md の手順で作り直すこと。
-- =====================================================================

-- ⚠️⚠️⚠️ **UPDATE はすべて、この1つのブロック（BEGIN NOT ATOMIC … END）の中に置くこと。**
--
--   ⚠️ 2026-10-05 の検証で、⚠️⚠️ **安全装置をブロックの外の UPDATE の前に置く形では止まらなかった。**
--     ⚠️ `source` で読み込んだファイルは、⚠️ **エラーが出ても次の文へ進む。**
--     ⚠️ 安全装置は「STOP」と表示したのに、⚠️ **その後の文がそのまま実行された。**
--   ⚠️ ブロックの中なら、⚠️ SIGNAL で残りがすべて打ち切られる。
--   ⚠️ ⚠️ **ブロックの外に UPDATE を書き足すと、安全装置が効かない。**
--
-- ⚠️ 途中で失敗した場合は、下の EXIT HANDLER がロールバックして ⚠️ **何も変わらない。**

DELIMITER //
BEGIN NOT ATOMIC
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  -- ---- 安全装置 ------------------------------------------------------
  IF DATABASE() IS NULL OR DATABASE() <> 'local_db' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'STOP: database is not local_db. Nothing was changed.';
  END IF;
  IF @confirm_mask IS NULL OR @confirm_mask <> 'YES' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'STOP: run SET @confirm_mask = ''YES''; first. Nothing was changed.';
  END IF;

  START TRANSACTION;

  UPDATE `after_interview` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `allGrit_db` SET
    `mail_allGrit` = REGEXP_REPLACE(`mail_allGrit`, '[^@.]', '*'),
    `phone_allGrit` = REGEXP_REPLACE(`phone_allGrit`, '[0-9０-９]', '*');
  
  UPDATE `allGrit_kaeru` SET
    `line_display_name` = CASE WHEN `line_display_name` IS NULL OR `line_display_name` = '' THEN `line_display_name` ELSE REPEAT('*', CHAR_LENGTH(`line_display_name`)) END,
    `last_name` = CASE WHEN `last_name` IS NULL OR `last_name` = '' THEN `last_name` ELSE REPEAT('*', CHAR_LENGTH(`last_name`)) END,
    `first_name` = CASE WHEN `first_name` IS NULL OR `first_name` = '' THEN `first_name` ELSE REPEAT('*', CHAR_LENGTH(`first_name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `ambassador_list` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `athome_db_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `athome_db_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `before_interview` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `before_survey` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `black_list` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `brokerage_listings` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `call_sheet` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `catalog_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = CASE WHEN `email` IS NULL OR `email` = '' THEN `email` ELSE CONCAT('********', `no`, '@****.***') END,
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `catalog_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = CASE WHEN `email` IS NULL OR `email` = '' THEN `email` ELSE CONCAT('********', `no`, '@****.***') END,
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `contract_customer` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `contract_customer_backup_20260827` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `customers` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `phone_number` = REGEXP_REPLACE(`phone_number`, '[0-9０-９]', '*');
  
  UPDATE `event_db` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `family_info` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `funding_plan` SET
    `k_name` = CASE WHEN `k_name` IS NULL OR `k_name` = '' THEN `k_name` ELSE REPEAT('*', CHAR_LENGTH(`k_name`)) END,
    `k_kana` = CASE WHEN `k_kana` IS NULL OR `k_kana` = '' THEN `k_kana` ELSE REPEAT('*', CHAR_LENGTH(`k_kana`)) END,
    `k_h_name` = CASE WHEN `k_h_name` IS NULL OR `k_h_name` = '' THEN `k_h_name` ELSE REPEAT('*', CHAR_LENGTH(`k_h_name`)) END,
    `k_w_name` = CASE WHEN `k_w_name` IS NULL OR `k_w_name` = '' THEN `k_w_name` ELSE REPEAT('*', CHAR_LENGTH(`k_w_name`)) END,
    `k_mail` = REGEXP_REPLACE(`k_mail`, '[^@.]', '*'),
    `k_tel` = REGEXP_REPLACE(`k_tel`, '[0-9０-９]', '*');
  
  UPDATE `homes_db` SET
    `name_homes` = CASE WHEN `name_homes` IS NULL OR `name_homes` = '' THEN `name_homes` ELSE REPEAT('*', CHAR_LENGTH(`name_homes`)) END,
    `kana_homes` = CASE WHEN `kana_homes` IS NULL OR `kana_homes` = '' THEN `kana_homes` ELSE REPEAT('*', CHAR_LENGTH(`kana_homes`)) END,
    `mail_homes` = REGEXP_REPLACE(`mail_homes`, '[^@.]', '*'),
    `phone_homes` = REGEXP_REPLACE(`phone_homes`, '[0-9０-９]', '*');
  
  UPDATE `homes_db_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `homes_db_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `hotlead_db` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `iei_db` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*');
  
  UPDATE `ieuru_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_ambassador` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_customer` SET
    `first_name` = CASE WHEN `first_name` IS NULL OR `first_name` = '' THEN `first_name` ELSE REPEAT('*', CHAR_LENGTH(`first_name`)) END,
    `last_name` = CASE WHEN `last_name` IS NULL OR `last_name` = '' THEN `last_name` ELSE REPEAT('*', CHAR_LENGTH(`last_name`)) END,
    `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
    `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mhl_mail` = REGEXP_REPLACE(`mhl_mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
    `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_customer_kaeru` SET
    `first_name` = CASE WHEN `first_name` IS NULL OR `first_name` = '' THEN `first_name` ELSE REPEAT('*', CHAR_LENGTH(`first_name`)) END,
    `last_name` = CASE WHEN `last_name` IS NULL OR `last_name` = '' THEN `last_name` ELSE REPEAT('*', CHAR_LENGTH(`last_name`)) END,
    `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
    `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mhl_mail` = REGEXP_REPLACE(`mhl_mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
    `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_customer_resale` SET
    `first_name` = CASE WHEN `first_name` IS NULL OR `first_name` = '' THEN `first_name` ELSE REPEAT('*', CHAR_LENGTH(`first_name`)) END,
    `last_name` = CASE WHEN `last_name` IS NULL OR `last_name` = '' THEN `last_name` ELSE REPEAT('*', CHAR_LENGTH(`last_name`)) END,
    `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
    `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `mhl_mail` = REGEXP_REPLACE(`mhl_mail`, '[^@.]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
    `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*');
  
  UPDATE `inquiry_introductory` SET
    `registrantName` = CASE WHEN `registrantName` IS NULL OR `registrantName` = '' THEN `registrantName` ELSE REPEAT('*', CHAR_LENGTH(`registrantName`)) END,
    `friendName` = CASE WHEN `friendName` IS NULL OR `friendName` = '' THEN `friendName` ELSE REPEAT('*', CHAR_LENGTH(`friendName`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*'),
    `fax` = REGEXP_REPLACE(`fax`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*'),
    `friendTel` = REGEXP_REPLACE(`friendTel`, '[0-9０-９]', '*');
  
  UPDATE `interview_sheet` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END;
  
  UPDATE `kaeeru_db` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `khf_customers` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `maillist` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*');
  
  UPDATE `master_data` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_2` = CASE WHEN `customer_contacts_name_2` IS NULL OR `customer_contacts_name_2` = '' THEN `customer_contacts_name_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_2`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
    `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `master_data_kaeru` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_2` = CASE WHEN `customer_contacts_name_2` IS NULL OR `customer_contacts_name_2` = '' THEN `customer_contacts_name_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_2`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
    `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `master_data_kana_backup_20260925` SET
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END;
  
  UPDATE `master_data_planner` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_2` = CASE WHEN `customer_contacts_name_2` IS NULL OR `customer_contacts_name_2` = '' THEN `customer_contacts_name_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_2`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
    `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `master_data_resale` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_name_2` = CASE WHEN `customer_contacts_name_2` IS NULL OR `customer_contacts_name_2` = '' THEN `customer_contacts_name_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_2`)) END,
    `customer_contacts_name_kana_2` = CASE WHEN `customer_contacts_name_kana_2` IS NULL OR `customer_contacts_name_kana_2` = '' THEN `customer_contacts_name_kana_2` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana_2`)) END,
    `introduction_person_name` = CASE WHEN `introduction_person_name` IS NULL OR `introduction_person_name` = '' THEN `introduction_person_name` ELSE REPEAT('*', CHAR_LENGTH(`introduction_person_name`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `member_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `member_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `mhr_db` SET
    `sei_kana_mhr` = CASE WHEN `sei_kana_mhr` IS NULL OR `sei_kana_mhr` = '' THEN `sei_kana_mhr` ELSE REPEAT('*', CHAR_LENGTH(`sei_kana_mhr`)) END,
    `mei_kana_mhr` = CASE WHEN `mei_kana_mhr` IS NULL OR `mei_kana_mhr` = '' THEN `mei_kana_mhr` ELSE REPEAT('*', CHAR_LENGTH(`mei_kana_mhr`)) END,
    `mail_mhr` = REGEXP_REPLACE(`mail_mhr`, '[^@.]', '*'),
    `phone_mhr` = REGEXP_REPLACE(`phone_mhr`, '[0-9０-９]', '*');
  
  UPDATE `mochiie_db` SET
    `sei_kana_mochiie` = CASE WHEN `sei_kana_mochiie` IS NULL OR `sei_kana_mochiie` = '' THEN `sei_kana_mochiie` ELSE REPEAT('*', CHAR_LENGTH(`sei_kana_mochiie`)) END,
    `mei_kana_mochiie` = CASE WHEN `mei_kana_mochiie` IS NULL OR `mei_kana_mochiie` = '' THEN `mei_kana_mochiie` ELSE REPEAT('*', CHAR_LENGTH(`mei_kana_mochiie`)) END,
    `mail_mochiie` = REGEXP_REPLACE(`mail_mochiie`, '[^@.]', '*'),
    `phone_mochiie` = REGEXP_REPLACE(`phone_mochiie`, '[0-9０-９]', '*');
  
  UPDATE `nexus` SET
    `customer_contacts_name` = CASE WHEN `customer_contacts_name` IS NULL OR `customer_contacts_name` = '' THEN `customer_contacts_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name`)) END,
    `customer_contacts_name_kana` = CASE WHEN `customer_contacts_name_kana` IS NULL OR `customer_contacts_name_kana` = '' THEN `customer_contacts_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`customer_contacts_name_kana`)) END,
    `customer_contacts_email` = REGEXP_REPLACE(`customer_contacts_email`, '[^@.]', '*'),
    `customer_contacts_phone_number` = REGEXP_REPLACE(`customer_contacts_phone_number`, '[0-9０-９]', '*'),
    `customer_contacts_mobile_phone_number` = REGEXP_REPLACE(`customer_contacts_mobile_phone_number`, '[0-9０-９]', '*');
  
  UPDATE `pgcloud` SET
    `姓` = CASE WHEN `姓` IS NULL OR `姓` = '' THEN `姓` ELSE REPEAT('*', CHAR_LENGTH(`姓`)) END,
    `名` = CASE WHEN `名` IS NULL OR `名` = '' THEN `名` ELSE REPEAT('*', CHAR_LENGTH(`名`)) END,
    `セイ` = CASE WHEN `セイ` IS NULL OR `セイ` = '' THEN `セイ` ELSE REPEAT('*', CHAR_LENGTH(`セイ`)) END,
    `メイ` = CASE WHEN `メイ` IS NULL OR `メイ` = '' THEN `メイ` ELSE REPEAT('*', CHAR_LENGTH(`メイ`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `携帯番号` = REGEXP_REPLACE(`携帯番号`, '[0-9０-９]', '*');
  
  UPDATE `pgcloud_data` SET
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `landline` = REGEXP_REPLACE(`landline`, '[0-9０-９]', '*'),
    `mobile` = REGEXP_REPLACE(`mobile`, '[0-9０-９]', '*');
  
  UPDATE `pre_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `raclear_djh` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `raclear_furukomi` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `raclear_kh` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `raclear_nagomi` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `raclear_nieru` SET
    `名前(漢字)` = CASE WHEN `名前(漢字)` IS NULL OR `名前(漢字)` = '' THEN `名前(漢字)` ELSE REPEAT('*', CHAR_LENGTH(`名前(漢字)`)) END,
    `名前(かな)` = CASE WHEN `名前(かな)` IS NULL OR `名前(かな)` = '' THEN `名前(かな)` ELSE REPEAT('*', CHAR_LENGTH(`名前(かな)`)) END,
    `メールアドレス` = REGEXP_REPLACE(`メールアドレス`, '[^@.]', '*'),
    `電話番号` = REGEXP_REPLACE(`電話番号`, '[0-9０-９]', '*'),
    `携帯電話番号` = REGEXP_REPLACE(`携帯電話番号`, '[0-9０-９]', '*');
  
  UPDATE `resale_customers` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `reserve_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = CASE WHEN `email` IS NULL OR `email` = '' THEN `email` ELSE CONCAT('********', `no`, '@****.***') END,
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `reserve_resale` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `email` = CASE WHEN `email` IS NULL OR `email` = '' THEN `email` ELSE CONCAT('********', `no`, '@****.***') END,
    `tel` = REGEXP_REPLACE(`tel`, '[0-9０-９]', '*');
  
  UPDATE `satbase_property` SET
    `customer_name` = CASE WHEN `customer_name` IS NULL OR `customer_name` = '' THEN `customer_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_name`)) END;
  
  UPDATE `satbase_property_old` SET
    `customer_name` = CASE WHEN `customer_name` IS NULL OR `customer_name` = '' THEN `customer_name` ELSE REPEAT('*', CHAR_LENGTH(`customer_name`)) END;
  
  UPDATE `smile_fes` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `sumai_step_db` SET
    `sei_kana` = CASE WHEN `sei_kana` IS NULL OR `sei_kana` = '' THEN `sei_kana` ELSE REPEAT('*', CHAR_LENGTH(`sei_kana`)) END,
    `mei_kana` = CASE WHEN `mei_kana` IS NULL OR `mei_kana` = '' THEN `mei_kana` ELSE REPEAT('*', CHAR_LENGTH(`mei_kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');
  
  UPDATE `suumo_db` SET
    `sei_kana_suumo` = CASE WHEN `sei_kana_suumo` IS NULL OR `sei_kana_suumo` = '' THEN `sei_kana_suumo` ELSE REPEAT('*', CHAR_LENGTH(`sei_kana_suumo`)) END,
    `mei_kana_suumo` = CASE WHEN `mei_kana_suumo` IS NULL OR `mei_kana_suumo` = '' THEN `mei_kana_suumo` ELSE REPEAT('*', CHAR_LENGTH(`mei_kana_suumo`)) END,
    `mail_suumo` = REGEXP_REPLACE(`mail_suumo`, '[^@.]', '*'),
    `phone_suumo` = REGEXP_REPLACE(`phone_suumo`, '[0-9０-９]', '*');
  
  UPDATE `suumo_db_kaeru` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `name_kana` = CASE WHEN `name_kana` IS NULL OR `name_kana` = '' THEN `name_kana` ELSE REPEAT('*', CHAR_LENGTH(`name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*'),
    `fax` = REGEXP_REPLACE(`fax`, '[0-9０-９]', '*');
  
  UPDATE `suumo_db_resale` SET
    `last_name_kanji` = CASE WHEN `last_name_kanji` IS NULL OR `last_name_kanji` = '' THEN `last_name_kanji` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kanji`)) END,
    `first_name_kanji` = CASE WHEN `first_name_kanji` IS NULL OR `first_name_kanji` = '' THEN `first_name_kanji` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kanji`)) END,
    `last_name_kana` = CASE WHEN `last_name_kana` IS NULL OR `last_name_kana` = '' THEN `last_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`last_name_kana`)) END,
    `first_name_kana` = CASE WHEN `first_name_kana` IS NULL OR `first_name_kana` = '' THEN `first_name_kana` ELSE REPEAT('*', CHAR_LENGTH(`first_name_kana`)) END,
    `email` = REGEXP_REPLACE(`email`, '[^@.]', '*'),
    `phone_1` = REGEXP_REPLACE(`phone_1`, '[0-9０-９]', '*'),
    `phone_2` = REGEXP_REPLACE(`phone_2`, '[0-9０-９]', '*'),
    `phone_3` = REGEXP_REPLACE(`phone_3`, '[0-9０-９]', '*'),
    `fax_1` = REGEXP_REPLACE(`fax_1`, '[0-9０-９]', '*'),
    `fax_2` = REGEXP_REPLACE(`fax_2`, '[0-9０-９]', '*'),
    `fax_3` = REGEXP_REPLACE(`fax_3`, '[0-9０-９]', '*');
  
  UPDATE `townlife_db` SET
    `name_townlife` = CASE WHEN `name_townlife` IS NULL OR `name_townlife` = '' THEN `name_townlife` ELSE REPEAT('*', CHAR_LENGTH(`name_townlife`)) END,
    `kana_townlife` = CASE WHEN `kana_townlife` IS NULL OR `kana_townlife` = '' THEN `kana_townlife` ELSE REPEAT('*', CHAR_LENGTH(`kana_townlife`)) END,
    `mail_townlife` = REGEXP_REPLACE(`mail_townlife`, '[^@.]', '*'),
    `phone_townlife` = REGEXP_REPLACE(`phone_townlife`, '[0-9０-９]', '*');
  
  UPDATE `townlife_db_khf` SET
    `name` = CASE WHEN `name` IS NULL OR `name` = '' THEN `name` ELSE REPEAT('*', CHAR_LENGTH(`name`)) END,
    `kana` = CASE WHEN `kana` IS NULL OR `kana` = '' THEN `kana` ELSE REPEAT('*', CHAR_LENGTH(`kana`)) END,
    `mail` = REGEXP_REPLACE(`mail`, '[^@.]', '*'),
    `phone` = REGEXP_REPLACE(`phone`, '[0-9０-９]', '*');

  COMMIT;

  -- ---- 確認（⚠️ どれも 0 になっていれば伏せ終わっている） ----------------
  SELECT 'inquiry_customer の電話に数字が残っている行' AS 確認, COUNT(*) AS 件数
    FROM inquiry_customer WHERE mobile REGEXP '[0-9]' OR landline REGEXP '[0-9]'
  UNION ALL
  SELECT 'inquiry_customer のメールに英数字が残っている行', COUNT(*)
    FROM inquiry_customer WHERE mail REGEXP '[A-Za-z0-9]'
  UNION ALL
  SELECT 'master_data の顧客名が伏せられていない行', COUNT(*)
    FROM master_data WHERE customer_contacts_name <> '' AND customer_contacts_name NOT REGEXP '^[*]+$'
  UNION ALL
  SELECT 'master_data の電話に数字が残っている行', COUNT(*)
    FROM master_data WHERE customer_contacts_mobile_phone_number REGEXP '[0-9]'
                        OR customer_contacts_phone_number REGEXP '[0-9]';
END //
DELIMITER ;

SET @confirm_mask = NULL;
