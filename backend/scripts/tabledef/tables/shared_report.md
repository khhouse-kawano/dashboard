---
table: shared_report
title: 共有したレポート
business: common
source: 改修
---
レポートの共有URL（/report?k=…）が1行1本（v2.2.268〜）。② の features/sharedReport.ts が読み書きする。
shared_report_create（Claudeによる分析から＝実行した本人か Master／HTML の登録＝Master）、shared_report_get（共有URLの画面 report/SharedReportView.tsx。ログインしていれば誰でも見られる）、shared_report_list・shared_report_revoke（画面「システム管理 → 共有したレポート」header/system/SharedReports.tsx）。
⚠️ html は共有した時点の写し。元の分析を消しても見られる。共有を止めると html を消す（NULL）。⚠️ html は iframe（sandbox="allow-scripts" だけ）で出す。
⚠️ 日時は ② が日本時間で書く。

## 列
- id: 連番（自動採番）。画面に出すが、id では見られない
- share_key: 共有URLの k（128bit の乱数。base64url の22文字）。⚠️ 知っていてもログインが要る
- title: 題
- source: 元。ai_analysis（Claudeによる分析）/ upload（HTMLを登録）
- source_id: source = ai_analysis のときの ai_analysis_job.id
- html: レポートの HTML（共有した時点の写し。停止すると NULL）
- html_bytes: html の大きさ（バイト）。上限は 5MB
- staff_id: 共有した人（staff.id）
- staff_name: 共有した時点の staff.name
- created_at: 共有した日時
- revoked_at: 共有を止めた日時（NULL なら共有中）
- revoked_by: 止めた人（staff.id）
- view_count: 開かれた回数
- last_viewed_at: 最後に開かれた日時
