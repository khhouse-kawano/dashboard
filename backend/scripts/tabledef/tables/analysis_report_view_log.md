---
table: analysis_report_view_log
title: 分析レポートの閲覧記録
business: common
source: 改修
---
分析レポート（analysis_report）を開いた1回が1行（v2.2.194〜）。② の features/analysis/report.ts が analysis_report_get で本文を返すたびに書く。
⚠️ Master が開いたときは記録しない。⚠️ 画面には出さない（指示）。見方は backend/scripts/sql/2026-10-16_analysis_report_view_log.sql の先頭。
⚠️ 書けなくてもレポートは開ける（失敗は ② のログだけ）。

## 列
- no: 連番（自動採番）
- report_no: 開いたレポート（analysis_report.no）
- staff_id: 開いた人（staff.id）
- staff_name: 開いた時点の staff.name
- authority: 開いた時点の権限（staff.brand。BrandAdmin / ordinary など）
- division: 開いた時点の担当事業（staff.shop。order / spec / used / all）
- viewed_at: 開いた日時
