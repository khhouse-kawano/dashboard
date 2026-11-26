---
table: property_list_kaeru
title: 物件一覧（旧）
business: spec
source: 推論
---
（推定）いえらぶの物件一覧を取り込んでいた古い表。property_db と同じ項目を別の列名で持つ（約500件）。今の物件DB は property_db。
コードからの使用箇所なし（推定：property_db に置き換わった旧表）。① geoCode.php だけが latitude・longitude を書くが、2026-09-15 以降は呼ばれていない（以前は物件番号の取り違えで常に 0 行更新だった）。
⚠️ geoCode.php を復活させない（Geocoding の二重取得に戻る。物件の経緯度は property_db.lat_lng）。

## 列
- no: 連番（自動採番）
- property_number: 物件番号（いえらぶ。property_db.property_id にあたる）
- management_code: 管理コード
- in_charge_store: 担当店舗名
- property_staff: 物件担当者
- transaction_type: 取引態様
- property_type: 物件種別
- address: 所在地
- property_name: 物件名
- room_number: 空き物件内容（部屋番号）
- land_area: 土地面積
- building_area: 建物面積
- floor_plan: 間取り
- building_age: 築年数
- price: 価格
- gross_yield: 表面利回り
- transport_1: 交通1
- handling_company: 取扱業者
- staff_in_charge: 担当者
- phone_number: 電話番号
- activity_report_date: 活動報告日
- scheduled_activity_report_date: 活動報告予定日
- assumed_yield: 想定利回り
- total_units: 総戸数・総区画数
- building_structure: 建物構造
- zoning: 用途地域
- zoning_2: 用途地域2
- seller: 売主
- owner: 所有者
- original_item_1: （推定）いえらぶの独自項目1
- price_unitless: 価格（単位なし）
- latitude: 緯度（geoCode.php が書くはずだった。読む処理は無い）
- longitude: 経度（同上）
