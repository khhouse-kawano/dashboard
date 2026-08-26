-- ============================================================================
-- 論理削除の監査カラム + 契約書の下書き保存カラム
--   実行: docker exec -i dashboard-mariadb-db-1 mariadb -ulocal_user -plocal_password local_db < このファイル
--   冪等性: ADD COLUMN IF NOT EXISTS により再実行可能
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 論理削除
--    削除は物理削除せず show_dashboard = 0 で隠す（既存の DatabaseBroker と同方式）。
--    「いつ・誰が」を残さないと、消えた理由を後から追えないため2列を追加する。
--    復活させるときは show_dashboard = 1 に戻し、この2列を NULL に戻すこと。
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME DEFAULT NULL COMMENT '論理削除した日時（NULL なら未削除）',
  ADD COLUMN IF NOT EXISTS `deleted_by` VARCHAR(100) DEFAULT NULL COMMENT '論理削除した担当者';

-- 一覧は毎回 show_dashboard で絞り込むため索引を張る
ALTER TABLE `brokerage_listings`
  ADD INDEX IF NOT EXISTS `idx_kind_show` (`kind`, `show_dashboard`);

-- ---------------------------------------------------------------------------
-- 2. 契約書（媒介契約書・重要事項説明書）の下書き
--    DocumentViewer のフォーム値をレコード単位で保持する。
--    印刷前の入力内容を失わないためのもので、確定した契約内容ではない。
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD COLUMN IF NOT EXISTS `docDraft` LONGTEXT
    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT '契約書フォームの下書き JSON（DocumentFormData）'
    CHECK (`docDraft` IS NULL OR json_valid(`docDraft`)),
  ADD COLUMN IF NOT EXISTS `docDraftAt` DATETIME DEFAULT NULL COMMENT '下書きを保存した日時',
  ADD COLUMN IF NOT EXISTS `docDraftBy` VARCHAR(100) DEFAULT NULL COMMENT '下書きを保存した担当者';

-- ---------------------------------------------------------------------------
-- 3. 監査ログ・通知の索引
--    logs / notices は件数が増え続けるうえ、entityId や to で毎回絞り込むため。
-- ---------------------------------------------------------------------------
ALTER TABLE `brokerage_listings`
  ADD INDEX IF NOT EXISTS `idx_entity` (`entity`, `entityId`),
  ADD INDEX IF NOT EXISTS `idx_notice_to` (`kind`, `to`, `read`);
