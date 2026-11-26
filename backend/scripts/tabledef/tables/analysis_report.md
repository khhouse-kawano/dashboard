---
table: analysis_report
title: 分析レポート（HTML）
business: common
source: 改修
---
Claude が書いた分析レポート（HTML）が1行1本。本文を丸ごと html に持つ。
入口は2つ。② の POST /api/v1/analysis/report（MCP から。分析APIのキーで認証）と、画面からの手動アップロード（analysis_report_upload）。
読む画面：他社動向 →「Claudeによる競合分析」（header/competitor/CompetitorAnalysisReports.tsx。category = competitor）、金利の画面（header/market/LoanRates.tsx。category = loan_rate）。処理は ② の features/analysis/report.ts。
開いた人は analysis_report_view_log に残る。
⚠️ html は iframe（sandbox="allow-scripts"）の中でだけ出す。allow-same-origin は付けない。⚠️ 1件60KB前後になる。

## 列
- no: 連番（自動採番）。analysis_report_view_log.report_no から参照される
- title: 画面の一覧に出す見出し（例: 競合別 勝因・敗因分析（前期））
- category: 分析の種類。competitor＝競合分析 / loan_rate＝金融機関の金利（period は YYYY-MM）
- division: order（注文事業）/ kaeru（建売分譲事業）/ 空＝全社
- period: 分析の対象期間。⚠️ 自由記述（例: 2025/06〜2026/05）
- html: レポートの HTML 本文そのもの
- staff: 登録者（スタッフ名、または 'MCP'）
- data_as_of: 分析に使ったデータの時点。⚠️ 画面に必ず出す（最新だと誤解させないため）
- created: 登録した日時
