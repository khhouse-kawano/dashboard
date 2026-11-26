---
table: staff_count
title: 店舗ごとの人員数（経理）
business: common
source: 改修
---
店舗ごと・月ごとの人員数。1行が「1店舗 × 1か月」。
① budget_accounting.php がそのまま全件を返し、経理の予算画面（BudgetAccounting.tsx）が人員あたりの費用などに使う。
⚠️ 書き込む処理はコードに無い（手で入れている。推定）。ローカルの写しでは 2025/06〜2026/02 だけで、それより後の月は入っていない。

## 列
- id: 連番
- date: 対象月（text。'YYYY/MM'）
- shop: 店舗名（例 KH鹿児島店。shop_list_accounting.shop と同じ表記）
- count: 人員数
