---
table: homes_summary_db
title: HOME'S 掲載物件のサマリー
business: common
source: 改修
---
LIFULL HOME'S に掲載している自社物件の一覧（掲載状況・閲覧数・問合せ数）。1行が1物件（company_management_number）。
sync の summary の処理（runHomesSummary.ts）が ① の request homes_summary_db（handlers/homes_summary_db.php）へ送り、company_management_number で上書き（ON DUPLICATE KEY UPDATE）する。
同じ行を ② の property_db_portal（features/propertyPortal.ts）にも送り、物件DB（property_db）の空の列を埋める（docs/property-db-portal.md）。
画面は物件DB（DatabaseProperty.tsx）・物件のサマリー（PropertySummary.tsx）。② の property_list / property_detail が company_management_number ＝ property_db.property_id で結ぶ。
⚠️ アカウントの列が無い。建売と中古の物件が1つの表に混ざる。⚠️ 列はすべて文字列。

## 列
- no: 連番
- property_id: 物件ID（HOME'S の番号。いえらぶの番号とは関係しない）
- company_management_number: 自社管理番号（いえらぶの6桁の物件番号）。上書きの鍵・物件DB と結ぶ鍵
- property_name: 物件名
- room_section: 部屋／区画
- address: 物件所在地
- railway_line: 路線
- station: 駅
- walk_minutes: 徒歩分
- bus_minutes: バス乗車分
- price_rent: 価格/賃料（例 900万）
- common_service_fee: 共益費
- layout: 間取り
- exclusive_area: 専有面積
- property_type: 物件種別（例 一戸建て・マンション・土地）
- construction_year: 築年（例「48年」。築年数で、建築年月ではない）
- created_date: 物件作成日
- updated_date: 情報更新日
- status: 状態
- floor_plan_image: 間取図
- exterior_image: 外観図
- lifull_homes_published: LIFULL HOME'S掲載
- special_ad_impressions: 特別広告表示回数
- special_ad_clicks: 特別広告クリック数
- detail_page_views: 物件詳細閲覧数
- inquiries_count: 物件問合せ数
- inquiry_rate: 物件問合せ率
