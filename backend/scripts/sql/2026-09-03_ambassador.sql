-- =============================================================
-- Instagram 公式アンバサダー管理
--
--   ambassador_list     … アンバサダーの台帳
--   inquiry_ambassador  … アンバサダー経由の反響
--
-- 実行場所: ① レンタルサーバーの phpMyAdmin
--   ⚠️ 左サイドバーで対象DBを選んでから SQL タブを開くこと。
--     information_schema のままだと #1109 になる。
--
-- ⚠️ バックエンドは Express（② VPS）で実装している。PHPハンドラは無い。
--   そのため ② のDBユーザーに **INSERT / UPDATE 権限が必要**。
--   分析用に SELECT だけで作った場合は、① のサーバーパネルで権限を追加すること。
--     SHOW GRANTS FOR CURRENT_USER();
-- =============================================================

-- -------------------------------------------------------------
-- アンバサダー台帳
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ambassador_list` (
  `no`            INT          NOT NULL AUTO_INCREMENT,
  `name`          TEXT         DEFAULT NULL COMMENT '氏名',
  `kana`          TEXT         DEFAULT NULL COMMENT 'ふりがな',
  `address`       TEXT         DEFAULT NULL COMMENT '住所',
  `mobile`        TEXT         DEFAULT NULL COMMENT '電話番号',
  `mail`          TEXT         DEFAULT NULL COMMENT 'メールアドレス',
  `account`       TEXT         DEFAULT NULL COMMENT 'インスタグラムアカウント',
  `shop`          TEXT         DEFAULT NULL COMMENT '担当店舗',
  `staff`         TEXT         DEFAULT NULL COMMENT '担当営業',
  -- ⚠️ [{"date":"2026-09-03","note":"..."}] のJSON配列。
  --   MariaDB の JSON は LONGTEXT の別名であり、PDO も mysql2 も文字列で返す。
  --   画面側で JSON.parse する（backend-express の pool.ts は jsonStrings: true）。
  `remarks`       LONGTEXT     DEFAULT NULL COMMENT '備考。[{date, note}] のJSON配列',
  `registered_at` DATE         DEFAULT NULL COMMENT '登録日',
  PRIMARY KEY (`no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Instagram公式アンバサダーの台帳';

-- ⚠️ `inquiry`（反響数）の列は**作らない。**
--   inquiry_ambassador を数えて返す（features/ambassador/index.ts）。
--   列として保存すると、反響の登録・削除で更新を忘れた瞬間に実態とずれ、
--   どちらが正しいか分からなくなる。エラーにならないので気づけない。

-- -------------------------------------------------------------
-- アンバサダー経由の反響
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inquiry_ambassador` (
  `no`             INT         NOT NULL AUTO_INCREMENT,
  -- ⚠️ ambassador_list.no を持つ。account では紐づけない。
  --   アカウント名は変更されることがあり、変わった瞬間に過去の反響との
  --   紐づきが切れる（CallStatusList で同じ問題が起きていた）。
  `ambassador_no`  INT         DEFAULT NULL COMMENT 'ambassador_list.no',
  `name`           TEXT        DEFAULT NULL COMMENT '氏名',
  `kana`           TEXT        DEFAULT NULL COMMENT 'ふりがな',
  `zip`            TEXT        DEFAULT NULL COMMENT '郵便番号',
  `address`        TEXT        DEFAULT NULL COMMENT '住所',
  `mobile`         TEXT        DEFAULT NULL COMMENT '電話番号',
  `mail`           TEXT        DEFAULT NULL COMMENT 'メールアドレス',
  `account`        TEXT        DEFAULT NULL COMMENT 'インスタグラムアカウント（反響時点の値）',
  `shop`           TEXT        DEFAULT NULL COMMENT '担当店舗',
  `staff`          TEXT        DEFAULT NULL COMMENT '担当営業',
  `inquiry_date`   DATE        DEFAULT NULL COMMENT '反響日',
  `sync`           TINYINT     DEFAULT 0    COMMENT '同期状況。0=未同期 1=同期済み',
  -- ⚠️ 同期で作成した顧客のID。仕様に無いが追加した。
  --   これが無いと「どの反響がどの顧客になったか」を後から辿れず、
  --   二重同期や取り違えの調査ができない。
  --   inquiry_customer.pg_id と同じ役割。
  `master_data_id` VARCHAR(26) DEFAULT NULL COMMENT '同期で作成した master_data.id（ULID）',
  PRIMARY KEY (`no`),
  KEY `idx_ambassador_no` (`ambassador_no`),
  KEY `idx_sync` (`sync`),
  KEY `idx_inquiry_date` (`inquiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='アンバサダー経由の反響';

-- ⚠️ TEXT 列にはインデックスを張っていない（接頭辞長の指定が必要で、
--   このデータ量では効果が無い）。絞り込みは ambassador_no / sync / inquiry_date で行う。

-- -------------------------------------------------------------
-- 確認
-- -------------------------------------------------------------
-- SHOW COLUMNS FROM `ambassador_list`;
-- SHOW COLUMNS FROM `inquiry_ambassador`;
--
-- ⚠️ ② のDBユーザーの権限確認（INSERT / UPDATE が必要）
-- SHOW GRANTS FOR CURRENT_USER();
