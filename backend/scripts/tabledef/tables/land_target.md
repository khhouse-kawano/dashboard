---
table: land_target
title: 土地仕入の目標
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の目標。担当者 × 期間 × KPI に1行（縦に持つので、KPI を足しても列は増えない）。
書くところ：取り込み land:import（移行元の月間目標・年間目標）。画面からの入力は v2.2.312 の「目標・月次入力」。
読むところ：仕入ダッシュボード（land_summary）。⚠️ チームの目標は稼働中の担当者だけを足す（移行元と同じ）。

## 列
- id: 連番
- period_type: month＝月間目標 / year＝年間目標
- period: month は YYYY-MM、year は年度の始まりの年（6月始まり。例 2026）
- member_id: 担当者（land_member.id）
- kpi_key: KPI（land_kpi_def.kpi_key）
- value: 目標の値
- updated_by: 最後に直した人
- updated_at: 最後に直した日時
