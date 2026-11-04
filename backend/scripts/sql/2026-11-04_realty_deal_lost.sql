-- =====================================================================
-- v2.2.244 不動産企画係：商談案件の失注理由を列にする・元のアプリにないフェーズの値を直す
--
--   1. brokerage_listings に lostReason（失注理由）・lostDate（失注日）・lostNote（失注の詳細）を足す
--      （商談案件管理で「失注」にするときに必須。以前のアプリ v14.25〜 と同じ項目）
--   2. 取り込み済みの商談案件の失注理由を、原本（raw_data）から列へ写す
--      ⚠️ 失注・他決の分析（LostAnalysis.tsx の rowOf）は列を優先して読むため、写さないと分析から消える
--   3. 買い反響のフェーズ「内見済み」を「内見済」に直す（Dashboard の編集画面で入った、以前のアプリにない値）
--
-- ⚠️ 何度流しても同じ結果になる（列は IF NOT EXISTS。写すのは列が空の行だけ）。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② のデプロイより先に流すこと
-- =====================================================================

-- 1. 列を足す
ALTER TABLE brokerage_listings
  ADD COLUMN IF NOT EXISTS lostReason VARCHAR(100) NULL DEFAULT NULL COMMENT '商談の失注理由（v2.2.244）' AFTER reformNote,
  ADD COLUMN IF NOT EXISTS lostDate DATE NULL DEFAULT NULL COMMENT '商談の失注日（v2.2.244）' AFTER lostReason,
  ADD COLUMN IF NOT EXISTS lostNote TEXT NULL DEFAULT NULL COMMENT '商談の失注の詳細（v2.2.244）' AFTER lostDate;

-- 2. 原本から写す（⚠️ 列が空の行だけ。⚠️ 日付は YYYY-MM-DD の形のときだけ）
UPDATE brokerage_listings
   SET lostReason = JSON_VALUE(raw_data, '$.lostReason')
 WHERE kind = 'deals' AND lostReason IS NULL AND JSON_VALID(raw_data)
   AND COALESCE(JSON_VALUE(raw_data, '$.lostReason'), '') <> '';
UPDATE brokerage_listings
   SET lostDate = JSON_VALUE(raw_data, '$.lostDate')
 WHERE kind = 'deals' AND lostDate IS NULL AND JSON_VALID(raw_data)
   AND JSON_VALUE(raw_data, '$.lostDate') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
UPDATE brokerage_listings
   SET lostNote = JSON_VALUE(raw_data, '$.lostNote')
 WHERE kind = 'deals' AND lostNote IS NULL AND JSON_VALID(raw_data)
   AND COALESCE(JSON_VALUE(raw_data, '$.lostNote'), '') <> '';

-- 3. 以前のアプリにないフェーズの値
UPDATE brokerage_listings SET phase = '内見済' WHERE kind = 'buyLeads' AND phase = '内見済み';

-- 4. 確かめる（naiken_mi が 0、lost_with_reason が失注の行のうち理由のある数）
SELECT
  (SELECT COUNT(*) FROM brokerage_listings WHERE kind = 'buyLeads' AND phase = '内見済み') AS naiken_mi,
  (SELECT COUNT(*) FROM brokerage_listings WHERE kind = 'deals' AND phase = '失注') AS lost_deals,
  (SELECT COUNT(*) FROM brokerage_listings WHERE kind = 'deals' AND lostReason IS NOT NULL) AS lost_with_reason;
