-- ============================================================================
-- 本番用 スキーマ初期化
--
--   対象テーブル: brokerage_listings / app_state
--   文字コード  : utf8mb4 / utf8mb4_unicode_ci
--
-- 実行方法（本番サーバー上で）:
--   mysql -u <user> -p <dbname> < production_init.sql
--
-- 投入するデータは backend/src/handlers/data.json と app_state.json に置き、
-- addTale.php で取り込む。このファイルは器を作るだけでデータは入れない。
--
-- ⚠ このファイルは DROP TABLE を含まない。既存テーブルがある環境で
--   作り直したい場合は、必ずバックアップを取ってから手動で DROP すること。
--   CREATE TABLE IF NOT EXISTS のため、既存テーブルには何も起きない。
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- brokerage_listings
--
--   売り反響 / 買い反響 / 媒介台帳 / 商談 / 買取再販 / 更新 / 精算書 /
--   監査ログ / 通知 を `kind` で区別して1つのテーブルに保持する。
--   Supabase の records テーブル（id / kind / data JSONB）をフラットに
--   展開した形であり、`id` が両者を突き合わせるキーになる。
--
--   `id` はクライアント生成の文字列 ID（例: xmsbtyw0p36）。UUID ではない。
--   採番方式を変えると既存データと突合できなくなるため変更しないこと。
--
--   kind の値:
--     leads / buyLeads / ledger / deals / resales / renewals /
--     settlements / logs / notices / docs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `brokerage_listings` (
  `internal_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
  `kind` VARCHAR(100) DEFAULT NULL COMMENT 'レコード種別 leads/buyLeads/ledger/deals/resales/renewals/settlements/logs/notices',
  `id` VARCHAR(100) NOT NULL COMMENT 'システムID (例: xmsbtyw0p36)。UUIDではない',

  -- 共通 ------------------------------------------------------------------
  `no` INT(11) DEFAULT NULL COMMENT '管理番号',
  `freq` VARCHAR(100) DEFAULT NULL COMMENT '報告周期',
  `note` TEXT DEFAULT NULL COMMENT '備考',
  `staff` VARCHAR(100) DEFAULT NULL COMMENT '担当',
  `category` VARCHAR(100) DEFAULT NULL COMMENT '物件区分',
  `phase` VARCHAR(100) DEFAULT NULL COMMENT 'フェーズ',
  `priority` VARCHAR(100) DEFAULT NULL,
  `type` VARCHAR(100) DEFAULT NULL COMMENT '売/買/買取',

  -- 物件・所在 --------------------------------------------------------------
  `addr1` VARCHAR(255) DEFAULT NULL,
  `addr2` VARCHAR(255) DEFAULT NULL,
  `addr` VARCHAR(255) DEFAULT NULL,
  `property` VARCHAR(255) DEFAULT NULL COMMENT '物件名',
  `targetProperty` VARCHAR(255) DEFAULT NULL COMMENT '希望物件(buyLeads)',
  `propName` TEXT DEFAULT NULL COMMENT '物件名(settlements)',

  -- 金額 --------------------------------------------------------------------
  `price` BIGINT(20) DEFAULT NULL COMMENT '価格',
  `budget` BIGINT(20) DEFAULT NULL COMMENT '予算',
  `fee` BIGINT(20) DEFAULT NULL COMMENT '仲介手数料',
  `feeManual` TINYINT(1) DEFAULT 0 COMMENT '手数料を手入力したか 0:false, 1:true',

  -- 顧客・反響元 ------------------------------------------------------------
  `portal` VARCHAR(100) DEFAULT NULL,
  `seller` VARCHAR(100) DEFAULT NULL COMMENT '売主',
  `buyer` TEXT DEFAULT NULL COMMENT '買主',
  `customer` VARCHAR(100) DEFAULT NULL,
  `name` VARCHAR(100) DEFAULT NULL,
  `source` VARCHAR(100) DEFAULT NULL COMMENT '反響元',
  `contact` VARCHAR(255) DEFAULT NULL,
  `phone` TEXT DEFAULT NULL COMMENT '電話番号',
  `mail` TEXT DEFAULT NULL COMMENT 'メールアドレス',

  -- 媒介台帳 ----------------------------------------------------------------
  `keyInfo` TEXT DEFAULT NULL COMMENT '鍵情報',
  `keyStatus` VARCHAR(100) DEFAULT NULL,
  `baikaiType` VARCHAR(100) DEFAULT NULL COMMENT '専任媒介/一般媒介/買取',
  `propStatus` VARCHAR(100) DEFAULT NULL COMMENT 'アクティブ/成約完了/媒介終了',
  `currentStatus` VARCHAR(100) DEFAULT NULL COMMENT '現況',
  `expiry` DATE DEFAULT NULL COMMENT '媒介有効期限(ledger)',
  `expiryFix` TINYINT(1) DEFAULT NULL COMMENT '有効期限を手入力で固定 0:false 1:true(ledger)',
  `reinsDate` DATE DEFAULT NULL COMMENT 'REINS登録日',
  `priceRevDate` DATE DEFAULT NULL COMMENT '価格改定日',
  `lastReportDate` DATE DEFAULT NULL COMMENT '最終報告日',

  -- 商談・紐付け ------------------------------------------------------------
  `endReason` TEXT DEFAULT NULL COMMENT '追客終了理由',
  `ledgerNo` VARCHAR(100) DEFAULT NULL COMMENT '媒介台帳の管理番号',
  `ledgerId` VARCHAR(100) DEFAULT NULL COMMENT '媒介台帳のid(deals)',
  `extId` VARCHAR(100) DEFAULT NULL COMMENT 'CSV取込の重複判定キー (例: ieul:123)',
  `dealId` VARCHAR(100) DEFAULT NULL,
  `dealNo` TEXT DEFAULT NULL,
  `subStaff` VARCHAR(100) DEFAULT NULL COMMENT '協同担当(deals)',
  `subRatio` INT(11) DEFAULT NULL COMMENT '協同担当の取り分 0-100(deals)',
  `coBroker` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT '協力会社情報 JSON(deals/ledger)'
    CHECK (`coBroker` IS NULL OR json_valid(`coBroker`)),
  `delivery` TEXT DEFAULT NULL COMMENT '引渡(settlements)',

  -- 日付 --------------------------------------------------------------------
  `receivedDate` DATE DEFAULT NULL COMMENT '受信日',
  `connectDate` DATE DEFAULT NULL COMMENT '通電日',
  `contactDate` DATE DEFAULT NULL COMMENT '接触日',
  `visitDate` DATE DEFAULT NULL COMMENT '訪問査定日',
  `viewDate` DATE DEFAULT NULL COMMENT '内見日',
  `baikaiDate` DATE DEFAULT NULL COMMENT '媒介契約日',
  `contractDate` DATE DEFAULT NULL COMMENT '契約日',
  `settleDate` DATE DEFAULT NULL COMMENT '決済日',
  `followDate` DATE DEFAULT NULL COMMENT 'フォロー日',
  `inputDate` DATE DEFAULT NULL COMMENT '入力日(renewals)',
  `renewDate` DATE DEFAULT NULL COMMENT '更新日(renewals)',
  `applicationDate` TEXT DEFAULT NULL COMMENT '物件の申込日',
  `nextDate` DATE DEFAULT NULL COMMENT '次回連絡日',
  `nextNote` TEXT DEFAULT NULL COMMENT '次回アクションのメモ（自由テキスト）',

  -- 追客 --------------------------------------------------------------------
  `callDates` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT '架電/LINE/メールの履歴 JSON [{date,type,staff}]'
    CHECK (`callDates` IS NULL OR json_valid(`callDates`)),
  `reason` VARCHAR(255) DEFAULT NULL COMMENT '売却理由(leads)',
  `timing` VARCHAR(255) DEFAULT NULL COMMENT '売却希望時期(leads)',

  -- 買取再販（金額はすべて税込） ----------------------------------------------
  `status` VARCHAR(100) DEFAULT NULL COMMENT '進捗ステータス(resales)',
  `buyPrice` BIGINT(20) DEFAULT NULL COMMENT '仕入価格(税込)(resales)',
  `buyBuilding` BIGINT(20) DEFAULT NULL COMMENT '仕入のうち建物価格(税込)(resales)',
  `buySellerReg` VARCHAR(100) DEFAULT NULL COMMENT '仕入先のインボイス登録有無(resales)',
  `buyStockAsset` TINYINT(1) DEFAULT NULL COMMENT '棚卸資産(宅建業者特例の対象) 0:false 1:true(resales)',
  `taxCheckDate` DATE DEFAULT NULL COMMENT '消費税確認日(resales)',
  `buyContractDate` DATE DEFAULT NULL COMMENT '仕入契約日(resales)',
  `buySettleDate` DATE DEFAULT NULL COMMENT '仕入決済日(resales)',
  `listPrice` BIGINT(20) DEFAULT NULL COMMENT '売出価格(税込)(resales)',
  `listDate` DATE DEFAULT NULL COMMENT '売出日(resales)',
  `sellPrice` BIGINT(20) DEFAULT NULL COMMENT '成約価格(税込)(resales)',
  `sellBuilding` BIGINT(20) DEFAULT NULL COMMENT '成約のうち建物価格(税込)(resales)',
  `sellStaff` VARCHAR(100) DEFAULT NULL COMMENT '販売担当(resales)',
  `sellContractDate` DATE DEFAULT NULL COMMENT '売買契約日(resales)',
  `sellSettleDate` DATE DEFAULT NULL COMMENT '売買決済日(resales)',
  `targetGp` BIGINT(20) DEFAULT NULL COMMENT '目標粗利(resales)',
  `costs` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT '原価明細の配列 JSON [{cat,label,key,tax,plan,actual}](resales)'
    CHECK (`costs` IS NULL OR json_valid(`costs`)),

  -- 監査ログ(logs) / 通知(notices) ------------------------------------------
  -- `at` `to` `from` `read` は SQL の予約語と衝突しやすい。
  -- 参照するときは必ずバッククォートで囲むこと。
  `at` VARCHAR(40) DEFAULT NULL COMMENT '発生日時 ISO8601(logs/notices)',
  `to` VARCHAR(100) DEFAULT NULL COMMENT '通知先/変更後の担当(logs/notices)',
  `from` TEXT DEFAULT NULL COMMENT '変更前の値(logs)',
  `field` VARCHAR(100) DEFAULT NULL COMMENT '変更したフィールド名(logs)',
  `label` VARCHAR(255) DEFAULT NULL COMMENT '変更対象の表示名(logs)',
  `entity` VARCHAR(50) DEFAULT NULL COMMENT '対象種別 lead/buy/deal/ledger/resale(logs/notices)',
  `entityId` VARCHAR(100) DEFAULT NULL COMMENT '対象のid(logs/notices)',
  `entityNo` INT(11) DEFAULT NULL COMMENT '対象の管理番号(logs)',
  `title` VARCHAR(255) DEFAULT NULL COMMENT '通知タイトル(notices)',
  `body` TEXT DEFAULT NULL COMMENT '通知本文(notices)',
  `read` TINYINT(1) DEFAULT NULL COMMENT '既読 0:false 1:true(notices)',
  `by` TEXT DEFAULT NULL COMMENT '実施者',
  `data` TEXT DEFAULT NULL COMMENT '精算書のフォーム値 JSON(settlements)',
  `updatedAt` TEXT DEFAULT NULL COMMENT '更新日時(settlements。アプリ側が入れる文字列)',

  -- 契約書の下書き ------------------------------------------------------------
  `docDraft` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT '契約書フォームの下書き JSON（DocumentFormData）'
    CHECK (`docDraft` IS NULL OR json_valid(`docDraft`)),
  `docDraftAt` DATETIME DEFAULT NULL COMMENT '下書きを保存した日時',
  `docDraftBy` VARCHAR(100) DEFAULT NULL COMMENT '下書きを保存した担当者',

  -- 外部DB連携 ----------------------------------------------------------------
  `master_data_id` TEXT DEFAULT NULL COMMENT '※master_data_resaleと連携しているid',
  `property_db_id` TEXT DEFAULT NULL COMMENT '※property_dbと連携するid',
  `property_db_name` TEXT DEFAULT NULL COMMENT '※property_dbと連携する物件名',

  -- 表示制御・論理削除 ---------------------------------------------------------
  -- 削除は物理削除せず show_dashboard = 0 で隠す。
  -- いつ誰が消したか残らないと復旧の判断ができないため deleted_* も持つ。
  `show_dashboard` TINYINT(1) DEFAULT 1 COMMENT '一覧への表示 1:表示 0:非表示(論理削除)',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '論理削除した日時（NULL なら未削除）',
  `deleted_by` VARCHAR(100) DEFAULT NULL COMMENT '論理削除した担当者',

  -- 原本 ----------------------------------------------------------------------
  -- Supabase records.data をそのまま保持する保険。
  -- 個別カラムに受け皿が無いフィールドが増えても、ここに残っていれば復元できる。
  -- アプリからの参照は個別カラムを使い、ここは最終手段とする。
  `raw_data` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT 'Supabase records.data の原本 JSON（無損失保持）'
    CHECK (`raw_data` IS NULL OR json_valid(`raw_data`)),

  -- タイムスタンプ --------------------------------------------------------------
  `created_at` DATETIME DEFAULT current_timestamp() COMMENT '作成日時',
  `updated_at` DATETIME DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '更新日時',

  PRIMARY KEY (`internal_id`),
  -- `id` での UPSERT（ON DUPLICATE KEY UPDATE）が成立する土台。
  -- これが無いと addTale.php の取り込みが毎回重複行を作る。
  UNIQUE KEY `uk_id` (`id`),
  -- 一覧は kind と表示フラグで毎回絞り込む
  KEY `idx_kind_show` (`kind`, `show_dashboard`),
  -- 変更履歴を案件ごとに引く
  KEY `idx_entity` (`entity`, `entityId`),
  -- 通知を担当者ごと・未読で引く
  KEY `idx_notice_to` (`kind`, `to`, `read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='不動産CRMの全レコード（kind で種別を区別）';

-- ---------------------------------------------------------------------------
-- app_state
--
--   アプリ全体の設定。1キー1行の JSON。
--     settings   … 担当者マスタ / 会社情報 / 反響元 / 原価セット など
--     weekly     … 週次行動計画（'YYYY-MM' ごとの目標と実績）
--     compliance … コンプライアンスチェック項目
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `app_state` (
  `key` VARCHAR(100) NOT NULL COMMENT 'settings / weekly / compliance',
  `data` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
    COMMENT '設定値の JSON'
    CHECK (json_valid(`data`)),
  `updated_at` DATETIME DEFAULT current_timestamp() ON UPDATE current_timestamp()
    COMMENT '更新日時',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='アプリ全体設定（Supabase app_state 由来）';
