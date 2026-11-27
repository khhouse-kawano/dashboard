---
table: land_member
title: 土地仕入の担当者
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の担当者（仕入れチームの人）。1行が1人。案件・アプローチなどは担当者をこの id で持つ。
書くところ：② land:member_save（仕入設定。スタッフとの結び付け・エリア・停止中）、取り込み land:import（名前で突き合わせる。記録にだけ出てくる名前は停止中で作る）。
読むところ：土地仕入の全部の画面（land_master）。
⚠️ name は移行元の表記（名字だけ。例 松窪）。⚠️ Dashboard のスタッフとは staff_id で結ぶ（取り込みのとき、スタッフの名前がこの名前で始まり、1人に決まれば自動で結ぶ）。

## 列
- id: 連番
- name: 担当者名（移行元の表記）
- area_id: エリア（land_area.id。NULL はその他）
- staff_id: Dashboard のスタッフ（staff.id）。ログインした人を自分の担当にする。1人のスタッフは1人の担当者にだけ
- active: 1＝稼働中 / 0＝停止中（選択肢とチームの目標から外す。過去の記録は残す）
- sort: 並び順
- created_at: 登録日時
- updated_at: 最後に直した日時
