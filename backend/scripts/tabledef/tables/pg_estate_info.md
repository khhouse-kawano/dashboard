---
table: pg_estate_info
title: PG CLOUD の物件情報（未使用）
business: common
source: 推論
---
（推定）PG CLOUD から書き出した物件情報（土地・建売など）を入れるための表。1物件 = 1行。列はすべて文字列で、CSV をそのまま入れる形。
コードからの使用箇所なし（推定：estate_info の前に PG CLOUD の物件を取り込もうとした名残）。⚠️ ローカルは 0 件。

## 列
- id: 連番（主キー）
- portal: （推定）掲載しているポータル
- property_type: 物件種別
- property_name: 物件名
- price: 価格（文字列）
- address: 所在地
- property_rank: （推定）物件のランク
- land_tsubo: 土地の坪数
- land_tsubo_unit_price: 土地の坪単価
- land_area: 土地面積
- real_estate_company: 不動産会社（元付け）
- nearest_station: 最寄り駅
- station_walk_minutes: 駅からの徒歩（分）
- info_registered_at: 情報の登録日（文字列）
- info_updated_at: 情報の更新日（文字列）
- data_acquirer: （推定）情報を取得した担当者
- csv_id: （推定）書き出し元の物件番号
- status: 状況
- school_elementary: 小学校区
- school_junior: 中学校区
- brand: （推定）PG CLOUD のブランド
- shop_name: 担当の店舗
- staff_name: 担当者
- seller: 売主
- parking: 駐車場
- parking_spaces: 駐車場の台数
- built_year_month: 築年月
- city_planning: 都市計画
- building_conditions: 建築条件の有無
- transaction_type: 取引態様
- property_name_public: （推定）物件名を公開するか
- external_import: （推定）外部から取り込んだ物件か
- total_floor_area: 延床面積
- exclusive_area: 専有面積
- management_number: 管理番号
- website_publication: （推定）自社サイトへの掲載の有無
- info_registrant: 情報を登録した人
- info_updater: 情報を更新した人
