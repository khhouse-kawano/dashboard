---
table: call_sheet
title: 架電記録
business: common
source: 改修
---
顧客ごとの架電（電話・連絡）の記録。1行＝1顧客（id は顧客台帳の id）。記録の中身は call_log に JSON 配列で持つ。
書くのは ② information の update_call_log（顧客の編集画面。有れば UPDATE・無ければ INSERT）と、中古の架電キュー（callq/usedQueue.ts。shop = '買い:中古リノベ' の顧客）。
読むのは顧客DB（初回通電日・次回架電日。ページの顧客の分だけ）、架電一覧（callStatusList.ts）、日報、毎日の行動（次回架電日）、記録の本文検索、分析 API など。
⚠️ text 列は NOT NULL で既定値が無い。INSERT では全列に値（空文字）を入れる。
⚠️ UPDATE では name を変えない（INSERT のときだけ入れる）。
⚠️ call_log の日本語は、生の UTF-8 と \uXXXX にエスケープしたものが混在する（① と ② で保存の形が違う）。検索は JSON_SEARCH を使う。

## 列
- no: 連番（自動採番）
- id: 顧客ID
- shop: 顧客の担当店舗（中古は取引区分。例 買い:中古リノベ）
- staff: 担当営業
- name: 顧客名（作ったときの値）
- status: 架電状況（call_status 表の status。未通電 / 継続 / 架電停止 / 来場済み / 来場アポ など）
- reserved_status [推論]: （推定）来場予約日（YYYY-MM-DD）
- call_log: 架電の JSON 配列。1件は day・time・action（通電・不通 など。call_status 表の action）・note・staff・status
