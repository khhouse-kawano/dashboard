---
table: satbase_property_old
title: SatBase物件（入れ替え前の写し）
business: spec
source: 改修
copy_of: satbase_property
---
satbase_property（元の表）を CSV で丸ごと入れ替えたときの、入れ替え前の表（2026-09-29。v2.2.152）。
backend/scripts/sql/2026-09-29_satbase_property_reload.sql の RENAME で残る。画面を確かめてから DROP する手順だったが、消されずに残っている。
⚠️ 画面・処理からは使っていない（推定）。⚠️ customer_name に個人情報を含む（dev の個人情報マスクの対象）。

## 列
- property_id:
- property_name:
- usage_type:
- customer_name:
- contract_staff:
- progress_status:
- sales_status:
- area:
- site_staff:
- design_staff:
- construction_staff:
- foundation_start_date:
- completion_date:
- exterior_completion_date:
- payment_date:
- delivery_date:
- land_cost:
- sales_price:
- contract_recorded_date:
- land_id:
- permit_date:
- property_id_general:
- plan:
- ground_improvement:
- price_changed_date:
- previous_sales_price:
- desired_start_date:
- purchase_settlement_date:
- purchase_contract_date:
- lat_lng:
- property_id_manager:
- spec:
- prefecture:
- sales_period:
- portal_posted_date:
- kaeru_hp_posted_date:
- schedule_created:
- team:
