---
table: land_audit
title: 土地仕入の更新履歴
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の更新履歴（誰が・いつ・何を）。② の保存のたびに1行足す（書けなくても本体の保存は止めない）。
書くところ：② features/landAcquisition（audit）、取り込み land:import（移行元の履歴も入れる）。画面は v2.2.312 の「仕入設定」。

## 列
- id: 連番
- at: 日時（日本時間）
- user_name: した人（Dashboard のスタッフ名。移行元の行は移行元の担当者名）
- act: 操作（create・update・delete・status・reply・lost・daily・report・target・member・import・system）
- target: 対象（案件・業者・アプローチ・まとめ入力・日報・担当者・移行）
- name: 対象の名前（業者名など）
- note: 内容（ステータスの「前 → 後」など）
