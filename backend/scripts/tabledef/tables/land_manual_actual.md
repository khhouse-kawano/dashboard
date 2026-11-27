---
table: land_manual_actual
title: 土地仕入の手入力の実績
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の、手で入れる実績。担当者 × 月 × KPI に1行。自動で数えた実績に足す（calc = manual の KPI はこれだけ）。
書くところ：取り込み land:import（移行元の月次入力）。画面からの入力は v2.2.312 の「目標・月次入力」。読むところ：land_summary（logic.ts の computeActual）。

## 列
- id: 連番
- ym: 月（YYYY-MM）
- member_id: 担当者（land_member.id）
- kpi_key: KPI（land_kpi_def.kpi_key）
- value: 足す値
- updated_by: 最後に直した人
- updated_at: 最後に直した日時
