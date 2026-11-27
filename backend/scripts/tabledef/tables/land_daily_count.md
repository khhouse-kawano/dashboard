---
table: land_daily_count
title: 土地仕入のまとめ入力
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の「まとめ入力」。1件ずつ記録しないアプローチの件数を、日ごとにまとめて入れる。1日・1担当者に1行（同じ日に保存すると上書き）。
書くところ：② land:daily_save（全部0で保存・削除で行を消す）、取り込み land:import。
読むところ：日次・アプローチ（land_daily）、仕入ダッシュボード（業者AP・情報取得の実績）。

## 列
- id: 連番
- legacy_id: 移行元の id（取り込んだ行だけ）
- count_date: 日付
- member_id: 担当者（land_member.id）
- cnt_visit: 訪問の件数
- cnt_call: 架電の件数
- cnt_recv: 受電の件数
- cnt_mail: メールの件数
- cnt_fax: FAX の件数
- cnt_direct: 直案件の件数
- cnt_bring: 業者持込の件数
- cnt_info: 情報取得の件数
- note: メモ
- updated_by: 最後に直した人
- created_at: 登録日時
- updated_at: 最後に直した日時
