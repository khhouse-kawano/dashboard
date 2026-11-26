---
table: shop_list_accounting
title: 店舗マスタ（経理）
business: common
source: 改修
---
経理の予算画面（BudgetAccounting.tsx）用の店舗の一覧。1行が1店舗。shop_list とは別の表で、課の表記も違う（1課〜4課・不動産）。
① budget_accounting.php が全件をそのまま返す（旧APIの shop_list_accounting を移植したもの）。
⚠️ 書き込む処理はコードに無い（手で入れている。推定）。

## 列
- id: 連番
- brand: ブランド（KH / DJH / なごみ / かえる など）
- shop: 店舗名
- section: 経理上の課（1課〜4課・不動産）。⚠️ section_list の課名とは違う
- resister_goal [推論]: （推定）登録数の目標。⚠️ 綴りは resister。画面の型は register_goal と書いてあり読んでいない
- reserve_goal [推論]: （推定）来場予約数の目標
