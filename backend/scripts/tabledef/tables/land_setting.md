---
table: land_setting
title: 土地仕入の設定
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の設定（1行が1つの設定）。
fy_start＝年度の始まりの年（6月始まり）、alert_lead_days＝買付の返答期日の既定（買付日の何日後）、alert_warn_days＝何日前から「もうすぐ」にするか。
書くところ：初期値、取り込み land:import（移行元の値）。読むところ：② の全部（loadSettings）。

## 列
- setting_key: 設定の名前
- setting_value: 値（文字で持つ）
- updated_at: 最後に直した日時
