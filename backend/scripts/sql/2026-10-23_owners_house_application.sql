-- =====================================================================
-- オーナーズハウス募集（オーナー様が自宅を見学先として登録するフォーム）の受付を残す表（v2.2.215）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ローカルにも流す
-- ⚠️ 書き込むのは:
--   - ① handlers/owners_house_application.php（フォームからの受付。写真は /dashboard/api/images/）
--   - ② owners_house_application_import（過去の通知メールの取り込み。GAS OwnersHouseMailImport）
-- ⚠️ 読むのは ② owners_house_application_list（Dashboard の「反響管理 → オーナーズハウス募集」）
-- ⚠️ 2回流しても壊れない（IF NOT EXISTS）
-- =====================================================================
CREATE TABLE IF NOT EXISTS owners_house_application (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    received_at DATETIME NOT NULL COMMENT '受付日時（日本時間）',
    source VARCHAR(10) NOT NULL DEFAULT 'form' COMMENT 'form＝フォーム / mail＝過去の通知メールから取り込み',
    mail_message_id VARCHAR(100) NULL DEFAULT NULL COMMENT '取り込んだ通知メールの Gmail の ID（二重取り込みの防止）',
    name VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'お施主様名',
    zip VARCHAR(10) NOT NULL DEFAULT '' COMMENT '郵便番号',
    shop VARCHAR(60) NOT NULL DEFAULT '' COMMENT 'ご契約店舗（フォームの選択肢の文字のまま。例 国分ハウジング霧島店）',
    staff VARCHAR(60) NOT NULL DEFAULT '' COMMENT '担当営業（自由入力）',
    photo_mode VARCHAR(20) NOT NULL DEFAULT '' COMMENT '撮影を依頼する / 写真を添付する',
    photos TEXT NULL DEFAULT NULL COMMENT '添付写真のファイル名の JSON 配列（/dashboard/api/images/ の中）',
    title VARCHAR(200) NOT NULL DEFAULT '' COMMENT 'ご自宅のタイトル',
    feature1 VARCHAR(300) NOT NULL DEFAULT '' COMMENT 'ご自宅の見どころ①',
    feature2 VARCHAR(300) NOT NULL DEFAULT '',
    feature3 VARCHAR(300) NOT NULL DEFAULT '',
    feature4 VARCHAR(300) NOT NULL DEFAULT '',
    feature5 VARCHAR(300) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_owners_house_application_mail (mail_message_id),
    KEY idx_owners_house_application_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='オーナーズハウス募集の受付';
