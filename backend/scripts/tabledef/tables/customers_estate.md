---
table: customers_estate
title: 顧客の希望土地条件
business: order
source: 改修
---
顧客ごとの土地探しの条件。1行＝1顧客（id は master_data.id）。土地の一覧（Estate.tsx）で条件を保存し、次に開いたときにその条件で物件を絞る。
書くのは ① estate_area.php（有れば UPDATE・無ければ INSERT）、読むのは ① estate.php（request: estate）。

## 列
- no: 連番（自動採番）
- id: 顧客ID（master_data.id）
- budget: 土地の予算の上限（万円）。物件の価格が「予算−499〜予算」に入るものを出す
- pref: 県
- town: 市区町村・町名（住所に含むかで絞る）
- area: 希望エリアの語の配列（JSON 文字列。どれかを住所に含めば出す）
- land_area: 必要な土地面積の下限
- walk: 駅徒歩の上限（分）
- for_house: 1 = 住宅用地だけ出す
