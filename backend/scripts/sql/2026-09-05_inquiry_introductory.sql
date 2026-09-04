-- お友達紹介キャンペーンの反響受付テーブル。
--
-- GAS（Gmail 監視スクリプト）が受信メールを解析し、
-- POST /api/gateway/ { request: 'introductory', ... } で送ってくる。
-- カラム名は GAS 側の introductoryColumnNameMap の key 名をそのまま使い、
-- コメントには同マップの日本語ラベルを入れている（対応を追いやすくするため）。
--
-- ⚠️ 既存の `introductory` テーブル（紹介元区分のマスタ。callStatusList.php /
--    database_order.php が参照）とは**まったく別物**。名前が似ているので注意。
--
-- ⚠️ 同じ登録通知メールが1回の登録で5通前後届く（複数の担当者が受信するため）。
--    さらに GAS の検索条件が `newer_than:1d` のため、トリガーが回るたびに
--    同じメールが再送されてくる。したがって重複排除は**サーバー側の責務**であり、
--    dedupKey の UNIQUE キーがその唯一の砦になっている。消してはいけない。

CREATE TABLE `inquiry_introductory` (
  `no`             INT AUTO_INCREMENT PRIMARY KEY COMMENT '連番',
  `dedupKey`       VARCHAR(64)  NOT NULL COMMENT '重複判定キー（SHA-256）。同じメールが複数通届くため',
  `campaignName`   VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'キャンペーン名',
  `referrerType`   VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '紹介者区分。owner=オーナー様 employee=社員 partner=業者様',
  `brand`          VARCHAR(64)  NOT NULL DEFAULT '' COMMENT 'ブランド',
  `registrantName` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '名前',
  `registrantKana` VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'ふりがな',
  `mail`           VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'メールアドレス',
  `companyName`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '会社情報',
  `postalCode`     VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '郵便番号',
  `area`           VARCHAR(255) NOT NULL DEFAULT '' COMMENT '住所',
  `tel`            VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '電話番号',
  `fax`            VARCHAR(32)  NOT NULL DEFAULT '' COMMENT 'FAX番号',
  `mobile`         VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '携帯番号',
  `mailPermission` VARCHAR(32)  NOT NULL DEFAULT '' COMMENT 'メール配信可否',
  `salesStaff`     VARCHAR(128) NOT NULL DEFAULT '' COMMENT '担当営業。キャンペーンによって設問名が「担当希望営業」の場合もある',
  `friendName`     VARCHAR(128) NOT NULL DEFAULT '' COMMENT '【お友達】氏名(漢字)',
  `friendKana`     VARCHAR(128) NOT NULL DEFAULT '' COMMENT '【お友達】氏名(かな)',
  `friendTel`      VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '【お友達】電話番号',
  `friendLineId`   VARCHAR(128) NOT NULL DEFAULT '' COMMENT '【お友達】LINE ID',
  `note`           TEXT         DEFAULT NULL COMMENT 'ご希望内容。複数行になり得る',
  `guideStaff`     VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'ご案内担当者',
  `registered`     DATETIME     DEFAULT NULL COMMENT 'システム受付日時。GAS が通知メールの受信日時から生成する',
  `remarks`        TEXT         DEFAULT NULL COMMENT 'GAS が生成した「ラベル：値」形式の全項目テキスト',
  `createdAt`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '当システムへの登録日時',
  UNIQUE KEY `uk_inquiry_introductory_dedup` (`dedupKey`),
  KEY `idx_inquiry_introductory_registered` (`registered`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='お友達紹介キャンペーンの反響。⚠️ introductory（紹介元区分マスタ）とは別物';
