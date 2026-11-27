---
table: land_stock
title: 土地仕入の適正在庫
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の適正在庫（担当者 × 詳細エリアごとの適正在庫・在庫・販売）。手で入れる（自動では動かない。移行元と同じ）。
過不足＝在庫−適正在庫、充足率＝在庫÷適正在庫（画面で計算する）。
書くところ：取り込み land:import。画面は v2.2.312 の「仕入設定」・「仕入分析」。

## 列
- id: 連番
- fy: 年度（6月始まりの年）
- member_id: 担当者（land_member.id）
- area_name: 詳細エリア（霧島市など）
- proper: 適正在庫
- stock: 在庫
- sales: 販売
- sort: 並び順
- updated_at: 最後に直した日時
