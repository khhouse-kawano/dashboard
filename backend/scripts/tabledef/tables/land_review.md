---
table: land_review
title: 土地仕入の月次レビュー
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の、担当者ごとの月次レビュー（育成フェーズ・ボトルネック・上長のコメント）。担当者 × 月に1行。
書くところ：取り込み land:import（移行元のキーは「YYYY-MM|名前」）。画面は v2.2.312 の「個人別実績」。

## 列
- id: 連番
- ym: 月（YYYY-MM）
- member_id: 担当者（land_member.id）
- phase: 育成フェーズ（land_option の phase）
- bottleneck: ボトルネック（land_option の bottleneck）
- good: 良かった事（本人）
- theme: 重点課題（翌月のテーマ）
- comment: 上長のコメント
- updated_by: 最後に直した人
- updated_at: 最後に直した日時
