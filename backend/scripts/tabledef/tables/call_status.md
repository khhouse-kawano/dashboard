---
table: call_status
title: 架電ステータス・アクションの選択肢
business: common
source: 改修
---
架電の記録で選ぶ「架電ステータス」と「架電アクション」の選択肢（v2.2.293〜）。1行＝1つの選択肢。
書くのは ② callStatusMaster.ts（管理画面で追加・変更）。読むのは顧客の編集画面などの選択肢（flag = 1 で、ログイン中の事業か all のものを sort 順に出す）。
⚠️ 選んだ文字列がそのまま顧客の call_status・call_sheet の status・架電記録の action に入る。名前を変えても過去の記録は変わらない（集計で旧名と新名が分かれる）。

## 列
- no: 連番（自動採番）
- kind: status（架電ステータス）/ action（架電アクション）
- name: 画面に出す名前（⚠️ 顧客の call_status・架電記録の action にこの文字列がそのまま入る）
- division: order / spec / used / all
- flag: 1 = 選択肢に出す / 0 = 出さない
- sort: 並び順（小さい順）
- updated_at: 最後に変えた日時
