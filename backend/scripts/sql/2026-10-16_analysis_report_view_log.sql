-- ===========================================================
-- 分析レポートの閲覧記録（analysis_report_view_log）
--
-- 2026-10-16 新規（v2.2.194）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 既存の表は変更しない（新規1表のみ）。
--
-- ─────────────────────────────────────────────
-- 何のテーブルか
--
--   「他社動向 → Claudeによる競合分析」「Claudeによる分析」の上部の一覧
--   （frontend/src/components/header/CompetitorAnalysisReports.tsx）でレポートを開いた人の記録。
--   ⚠️ ② の analysis_report_get（features/analysis/report.ts の logReportView）が、本文を返すたびに1行足す。
--
-- ⚠️⚠️ **画面には出さない**（2026-10-16 の指示。⚠️ 見るときは DB で見る）。
-- ⚠️⚠️ **authority が Master の人は記録しない**（指示。⚠️ 確認のたびに数が増えて現場の閲覧が分かりにくくなるため）。
-- ⚠️ 名前・権限・事業は開いた時点の写し（⚠️ あとで異動・改名しても当時の値が残る）。
-- ⚠️ レポートを消しても記録は消さない（⚠️ 外部キーを張らない）。
--
-- 見方の例:
--   SELECT v.report_no, r.title, v.staff_name, COUNT(*) AS 回数, MAX(v.viewed_at) AS 最終閲覧
--     FROM analysis_report_view_log v LEFT JOIN analysis_report r ON r.no = v.report_no
--    GROUP BY v.report_no, r.title, v.staff_name ORDER BY 最終閲覧 DESC;
-- ===========================================================

CREATE TABLE IF NOT EXISTS `analysis_report_view_log` (
   `no`         INT          NOT NULL AUTO_INCREMENT
  ,`report_no`  INT          NOT NULL COMMENT 'analysis_report.no'
  ,`staff_id`   INT          NOT NULL COMMENT 'staff.id'
  ,`staff_name` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '開いた時点の staff.name'
  ,`authority`  VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '開いた時点の権限（staff.brand。BrandAdmin / ordinary など）'
  ,`division`   VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '開いた時点の担当事業（staff.shop。order / spec / used / all）'
  ,`viewed_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,PRIMARY KEY (`no`)
  ,KEY `idx_report_view_report` (`report_no`, `viewed_at`)
  ,KEY `idx_report_view_staff` (`staff_id`, `viewed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='分析レポートの閲覧記録（Master は記録しない）';
