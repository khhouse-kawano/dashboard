-- ============================================================================
-- brokerage_listings 拡張 + app_state 新設
--   目的: Supabase (records / app_state) の全フィールドを無損失で受け入れる
--   方針: 追加のみ。既存カラムの削除・改名は行わない。
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -plocal_password local_db < このファイル
--   冪等性: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS により再実行可能
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. leads: ホット度スコアの加点対象（売却理由・希望時期）
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD COLUMN IF NOT EXISTS `reason` VARCHAR(255) DEFAULT NULL COMMENT '売却理由(leads)',
  ADD COLUMN IF NOT EXISTS `timing` VARCHAR(255) DEFAULT NULL COMMENT '売却希望時期(leads)';

-- ---------------------------------------------------------------------------
-- 2. deals: 売上按分・媒介台帳との紐付け
--    subRatio は「協同担当の取り分(0-100)」。売上按分の計算に必須。
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD COLUMN IF NOT EXISTS `subStaff` VARCHAR(100) DEFAULT NULL COMMENT '協同担当(deals)',
  ADD COLUMN IF NOT EXISTS `subRatio` INT(11) DEFAULT NULL COMMENT '協同担当の取り分 0-100(deals)',
  ADD COLUMN IF NOT EXISTS `ledgerId` VARCHAR(100) DEFAULT NULL COMMENT '媒介台帳のid(deals)';

-- ---------------------------------------------------------------------------
-- 3. ledger: 媒介有効期限
--    expiryFix=1 のとき expiry は手入力で固定。0/NULL のときは
--    contractDate + 3ヶ月 で導出する（導出ロジックはアプリ側）。
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD COLUMN IF NOT EXISTS `expiry` DATE DEFAULT NULL COMMENT '媒介有効期限(ledger)',
  ADD COLUMN IF NOT EXISTS `expiryFix` TINYINT(1) DEFAULT NULL COMMENT '有効期限を手入力で固定 0:false 1:true(ledger)';

-- ---------------------------------------------------------------------------
-- 4. deals / ledger 共用: 協力会社（元付・客付）情報
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD COLUMN IF NOT EXISTS `coBroker` LONGTEXT
    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT '協力会社情報 JSON(deals/ledger)'
    CHECK (`coBroker` IS NULL OR json_valid(`coBroker`));

-- ---------------------------------------------------------------------------
-- 5. resales: 買取再販。金額はすべて「税込」で保持する。
--    粗利計算（rsCalc）の入力はこのブロックのカラムで完結する。
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD COLUMN IF NOT EXISTS `status` VARCHAR(100) DEFAULT NULL COMMENT '進捗ステータス(resales)',
  -- 仕入
  ADD COLUMN IF NOT EXISTS `buyPrice` BIGINT(20) DEFAULT NULL COMMENT '仕入価格(税込)(resales)',
  ADD COLUMN IF NOT EXISTS `buyBuilding` BIGINT(20) DEFAULT NULL COMMENT '仕入のうち建物価格(税込)(resales)',
  ADD COLUMN IF NOT EXISTS `buySellerReg` VARCHAR(100) DEFAULT NULL COMMENT '仕入先のインボイス登録有無(resales)',
  ADD COLUMN IF NOT EXISTS `buyStockAsset` TINYINT(1) DEFAULT NULL COMMENT '棚卸資産(宅建業者特例の対象) 0:false 1:true(resales)',
  ADD COLUMN IF NOT EXISTS `taxCheckDate` DATE DEFAULT NULL COMMENT '消費税確認日(resales)',
  ADD COLUMN IF NOT EXISTS `buyContractDate` DATE DEFAULT NULL COMMENT '仕入契約日(resales)',
  ADD COLUMN IF NOT EXISTS `buySettleDate` DATE DEFAULT NULL COMMENT '仕入決済日(resales)',
  -- 販売
  ADD COLUMN IF NOT EXISTS `listPrice` BIGINT(20) DEFAULT NULL COMMENT '売出価格(税込)(resales)',
  ADD COLUMN IF NOT EXISTS `listDate` DATE DEFAULT NULL COMMENT '売出日(resales)',
  ADD COLUMN IF NOT EXISTS `sellPrice` BIGINT(20) DEFAULT NULL COMMENT '成約価格(税込)(resales)',
  ADD COLUMN IF NOT EXISTS `sellBuilding` BIGINT(20) DEFAULT NULL COMMENT '成約のうち建物価格(税込)(resales)',
  ADD COLUMN IF NOT EXISTS `sellStaff` VARCHAR(100) DEFAULT NULL COMMENT '販売担当(resales)',
  ADD COLUMN IF NOT EXISTS `sellContractDate` DATE DEFAULT NULL COMMENT '売買契約日(resales)',
  ADD COLUMN IF NOT EXISTS `sellSettleDate` DATE DEFAULT NULL COMMENT '売買決済日(resales)',
  ADD COLUMN IF NOT EXISTS `targetGp` BIGINT(20) DEFAULT NULL COMMENT '目標粗利(resales)',
  ADD COLUMN IF NOT EXISTS `costs` LONGTEXT
    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT '原価明細の配列 JSON [{cat,label,key,tax,plan,actual}](resales)'
    CHECK (`costs` IS NULL OR json_valid(`costs`));

-- ---------------------------------------------------------------------------
-- 6. logs / notices: 監査ログと通知
--    `at` `to` `from` `read` は SQL の予約語と衝突しやすいため、
--    参照時は必ずバッククォートで囲むこと。
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD COLUMN IF NOT EXISTS `at` VARCHAR(40) DEFAULT NULL COMMENT '発生日時 ISO8601(logs/notices)',
  ADD COLUMN IF NOT EXISTS `to` VARCHAR(100) DEFAULT NULL COMMENT '通知先/変更後の担当(logs/notices)',
  ADD COLUMN IF NOT EXISTS `from` TEXT DEFAULT NULL COMMENT '変更前の値(logs)',
  ADD COLUMN IF NOT EXISTS `field` VARCHAR(100) DEFAULT NULL COMMENT '変更したフィールド名(logs)',
  ADD COLUMN IF NOT EXISTS `label` VARCHAR(255) DEFAULT NULL COMMENT '変更対象の表示名(logs)',
  ADD COLUMN IF NOT EXISTS `entity` VARCHAR(50) DEFAULT NULL COMMENT '対象種別 lead/buy/deal/ledger/resale(logs/notices)',
  ADD COLUMN IF NOT EXISTS `entityId` VARCHAR(100) DEFAULT NULL COMMENT '対象のid(logs/notices)',
  ADD COLUMN IF NOT EXISTS `entityNo` INT(11) DEFAULT NULL COMMENT '対象の管理番号(logs)',
  ADD COLUMN IF NOT EXISTS `title` VARCHAR(255) DEFAULT NULL COMMENT '通知タイトル(notices)',
  ADD COLUMN IF NOT EXISTS `body` TEXT DEFAULT NULL COMMENT '通知本文(notices)',
  ADD COLUMN IF NOT EXISTS `read` TINYINT(1) DEFAULT NULL COMMENT '既読 0:false 1:true(notices)';

-- ---------------------------------------------------------------------------
-- 7. 無損失保持用の原本カラム
--    Supabase records.data をそのまま JSON 文字列で保持する。
--    将来フィールドが増えてもデータを失わないための保険であり、
--    アプリからの参照は個別カラムを使うこと（raw_data は参照用の最終手段）。
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD COLUMN IF NOT EXISTS `raw_data` LONGTEXT
    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT 'Supabase records.data の原本 JSON（無損失保持）'
    CHECK (`raw_data` IS NULL OR json_valid(`raw_data`));

-- ---------------------------------------------------------------------------
-- 8. 型の修正
--    nextNote は「次回アクションのメモ（自由テキスト）」だが DATE 型で定義
--    されており、保存すると必ず NULL に落ちていた。TEXT に修正する。
--    既存値はすべて NULL のため、データ損失は発生しない。
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  MODIFY COLUMN `nextNote` TEXT
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
    COMMENT '次回アクションのメモ（自由テキスト）';

-- ---------------------------------------------------------------------------
-- 9. app_state: Supabase app_state テーブルの移行先
--    settings / weekly / compliance の3キーのみ。1キー1行のJSON。
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
