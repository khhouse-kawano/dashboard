---
table: realty_properties
title: 媒介物件
business: realty
source: 改修
---
不動産企画係が媒介・買取した物件そのもの。1物件 = 1行（v2.2.250）。⚠️ property_db（ポータルの掲載物件）とは別物。
台帳・売り反響・買い反響は brokerage_listings.propertyId でこの表の id を指す。
作るのは ② planner:ledger_link（売り反響の媒介紐付。features/realty/ledgerLink.ts）で、種別＋住所（地番・マンションは建物名＋部屋番号）の match_key で探し、無ければ足す。既存の台帳からの移し替えは backend/scripts/realty/build-property-sql.cjs と 2026-11-05_realty_properties_2_migrate.sql。
読むのは ② いえらぶの物件の突き合わせ（ieloveMatch.ts）。
⚠️ match_key は一意（utf8mb4_bin）。作り方は ② の propertyKey.ts と同じにする。

## 列
- id: 物件 ID（移し替えは p + MD5 の先頭16桁、② は uid）
- match_key: 突き合わせ用（種別|c:地番 か 種別|a:住所[|建物名|部屋番号]。② の propertyKey.ts）。⚠️ 一意
- category: 種別（台帳の区分と同じ値。戸建・マンション・住宅用地・賃収・事業用 など）
- addr: 所在地（住居表示）
- chiban: 地番（任意）
- building_name: 建物名（マンション）
- room_no: 部屋番号（マンション）
- land_area: 土地面積（㎡）
- building_area: 建物面積（㎡）
- built_year: 築年（例: 1998・平成10年）
- layout: 間取り
- created_at: 作成日時
- created_by: 作成した担当者
- updated_at: 更新日時（行を更新すると自動で入る）
