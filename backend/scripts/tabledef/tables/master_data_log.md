---
table: master_data_log
title: 顧客の変更履歴
business: common
source: 改修
---
顧客（注文 master_data・建売 master_data_kaeru・中古 master_data_resale）を直したときの履歴。1行＝1回の保存（または1件の変更）。
書くのは ② information の log（顧客の編集画面が保存のたびに送る）、資金計画書の保存（fundingPlan）、個人情報削除（privacy.ts。誰がいつ消したか）。① の information_log.php も同じ形で入れる。
⚠️ 上書きせず積み上げる。UNIQUE キーが無いので、同じ書き込みを2回送ると2行になる（log は ① へのフォールバック禁止に登録してある）。
⚠️ log 列の本文には "funding_plan" という語が大量に入るので、LIKE で消すと監査ログを壊す（記憶メモ master-data-log-contains-funding-plan.md）。

## 列
- no: 連番（自動採番）
- id: 顧客ID（master_data などの id）
- customer: そのときの顧客名
- staff: 保存したスタッフ名
- updated_at: 保存日時（'YYYY/MM/DD HH:mm'・日本時間。text）
- log: 変更内容の説明（どの項目を何から何へ変えたか）
