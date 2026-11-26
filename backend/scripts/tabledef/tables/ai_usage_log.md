---
table: ai_usage_log
title: Claude APIの利用記録（旧KPI分析）
business: common
source: 改修
---
Claude API を呼んだ1回が1行。どのキー（api_credential）に課金され、誰が・何の機能で・いくらかかったかを残す。
① の kpi_analyze.php（KPI分析の実行。1人1日20回の上限をここで数える）と credential_verify.php（キーの疎通確認）が書く。kpi_analysis_history.usage_log_id から参照される。
⚠️ 旧「KPI分析」の仕組み。今の「Claudeによる分析」は ai_analysis_job に費用を持ち、この表には書かない。kpi_analyze・credential_* は画面から呼ばれていない（2026-10 以降の行が無い）。

## 列
- id: 連番（自動採番）
- credential_id: どのキーに課金されたか（api_credential.id）
- staff_id: 誰が実行したか（staff.id）
- feature: 機能。kpi_analyze / kpi_analyze:order / kpi_analyze:kaeru / credential_verify。⚠️ 'kpi_analyze:order' などの値は変えない（core/kpi.php の注記）
- model: 使ったモデル（例: claude-opus-5）。疎通確認は '-'
- input_tokens: 入力のトークン数。疎通確認は NULL
- output_tokens: 出力のトークン数。疎通確認は NULL
- cost_usd: 算出したドル金額
- duration_ms: 所要時間（ミリ秒）
- status: ok＝成功 / error＝失敗 / rate_limited＝API の回数制限
- error_message: 失敗の理由
- created_at: 実行した日時
