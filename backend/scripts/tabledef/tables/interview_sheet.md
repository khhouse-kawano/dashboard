---
table: interview_sheet
title: 商談ステップ（面談の記録）
business: common
source: 改修
---
顧客ごとの商談ステップ（面談・アクションの記録）。1行＝1顧客（id は master_data・master_data_kaeru・master_data_resale の id）。記録の中身は interview_log に JSON 配列で持つ。
書くのは ② information の update_interview_log（顧客の編集画面）と interviewLog（商談ステップ画面。保存と同じトランザクションで顧客台帳の工程の日付も更新する。interviewKpi.ts）。
読むのは顧客の編集画面、日報（dailyReport.ts）、毎日の行動（次回アクション日）、記録の本文検索（recordSearch.ts）、担当営業の契約率（staffContract.ts）、分析 API、ギフトの判定、紹介集計など。
⚠️ PRIMARY は no だけで id に索引が無い。⚠️ id が空の行がある。空の id で検索しない（他人の記録が返る）。
⚠️ 顧客が3事業のどこにも居なくても保存する。

## 列
- no: 連番（自動採番）
- name: 顧客名（作ったときの値）
- id: 顧客ID
- shop: 顧客の担当店舗（保存のたびに更新）
- interview_log: 記録の JSON 配列。1件は day（日付）・action（初回面談・2回目以降面談・契約 などのアクション）・note（本文）・staff（実施した担当）
