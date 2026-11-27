---
table: land_report
title: 土地仕入の簡易日報
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の簡易日報。1日・1担当者に1本（同じ日に保存すると上書き）。
書くところ：② land:report_save（削除で行を消す）、取り込み land:import。読むところ：日次・アプローチ（land_daily）。

## 列
- id: 連番
- legacy_id: 移行元の id（取り込んだ行だけ）
- report_date: 日付
- member_id: 担当者（land_member.id）
- done: 本日の活動
- info: 取得情報・進捗
- issue: 課題・相談事項
- next_plan: 明日の予定
- created_by: 書いた人
- updated_by: 最後に直した人
- created_at: 登録日時
- updated_at: 最後に直した日時
