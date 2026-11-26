---
table: kaeru_building_backup_20260827
title: 建売の物件（旧形式の写し）
business: spec
source: 改修
copy_of: kaeru_building
---
kaeru_building（元の表）を今の形に作り替える前の、旧形式の写し（2026-08-27）。⚠️ 画面・処理からは使っていない（推定）。
旧形式は物件IDを持たず（name・status・address・category・日付3列）、差分更新ができなかったため作り替えた（2026-08-26_market_construction.sql。SQL の退避先の名前は _20260826 だが、実物はこの _20260827）。
⚠️ 列の形が元の表と違う。同じ名前の列も型は text。

## 列
- no: 連番（旧形式の行番号）
- name:
- status: 旧形式の工程の状況（例 着工前・着工～引渡し・完成済・引渡し・解約。今の progress_status・sales_status に分かれる前の値）
- address: 所在地（今は area・pref に分かれる）
- category: 区分（旧形式の値。text）
- constructionDate: 着工日（text）
- completionDate: 完工日（text）
- finishedDate: 引渡日（今の handoverDate）
