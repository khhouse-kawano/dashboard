---
table: suumo_db_kaeru
title: SUUMO 顧客の取り込み元（建売）
business: spec
source: 改修
---
SUUMO（建売。かえるホーム。kr-hometour.suumo.jp）の「お客様」画面の CSV。1行が SUUMO 上の顧客1人（customer_id）。
sync（suumoKaeruCsv.ts）が過去3日に動きのあった顧客だけを ① の request suumo_db_kaeru（handlers/suumo_db_kaeru.php）へ送り、customer_id で上書き（ON DUPLICATE KEY UPDATE）する。
② の suumo_kaeru:actions（features/suumoKaeru.ts）が、反響ごとの CSV（suumo_action_kaeru）をどの顧客の反響か結ぶのに読む（初回・最新の予約ID/反響ID、氏名・電話・メール）。
⚠️ v2.2.263 から、この表からは反響一覧（inquiry_customer_kaeru）に行を足さない。反響一覧の行は suumo_action_kaeru から作る。以前の行は `suumo_<顧客ID>`。
⚠️ 日時の列はすべて文字列（YYYY/MM/DD HH:MM:SS）。

## 列
- no: 連番（自動採番）
- customer_id: SUUMO の顧客ID。上書きの鍵
- registered_at: 登録日時
- name: 氏名
- name_kana: 氏名カナ
- email: メールアドレス
- phone: 電話
- fax: FAX
- address: 住所
- staff: お客様担当（SUUMO 上の担当）
- follow_status: 追客状況
- first_reaction_date: 初回反響日
- first_reaction_method: 初回反響方法
- first_reaction_media: 初回反響媒体
- memo: メモ（SUUMO 上のメモ）
- first_reaction_reserve_id: 初回反響の予約ID。反響を顧客に結ぶのに使う
- first_reaction_id: 初回反響の反響ID。反響を顧客に結ぶのに使う
- first_reaction_received_at: 初回反響の受付日時
- first_reaction_type: 初回反響の反響種別
- first_reaction_property_type: 初回反響の物件種別
- first_reaction_property_code: 初回反響の物件コード
- first_reaction_property_name: 初回反響の物件名
- first_reaction_property_price: 初回反響の物件価格
- first_reaction_property_address: 初回反響の物件所在地
- latest_reaction_reserve_id: 最新反響の予約ID
- latest_reaction_id: 最新反響の反響ID
- latest_reaction_received_at: 最新反響の受付日時
- latest_reaction_type: 最新反響の反響種別
- latest_reaction_property_type: 最新反響の物件種別
- latest_reaction_property_code: 最新反響の物件コード
- latest_reaction_property_name: 最新反響の物件名
- latest_reaction_property_price: 最新反響の物件価格
- latest_reaction_property_address: 最新反響の物件所在地
- first_visit_datetime: 初回来場の来場日時
- first_visit_input_method: 初回来場の入力方法
- first_visit_schedule_type: 初回来場の予定種別
- first_visit_property_type: 初回来場の物件種別
- first_visit_property_code: 初回来場の物件コード
- first_visit_property_name: 初回来場の物件名
- first_visit_property_price: 初回来場の物件価格
- first_visit_property_address: 初回来場の物件所在地
- latest_visit_datetime: 最新来場の来場日時
- latest_visit_input_method: 最新来場の入力方法
- latest_visit_schedule_type: 最新来場の予定種別
- latest_visit_property_type: 最新来場の物件種別
- latest_visit_property_code: 最新来場の物件コード
- latest_visit_property_name: 最新来場の物件名
- latest_visit_property_price: 最新来場の物件価格
- latest_visit_property_address: 最新来場の物件所在地
- contract_date: 成約日
- contract_price: 成約価格
- contract_fee_status: 仲介手数料ステータス
- contract_fee_amount: 仲介手数料（万円。数に直して入れる）
- contract_additional_status: 付帯工事額・紹介料収入ステータス
- contract_additional_amount: 付帯工事額・紹介料収入（万円。数に直して入れる）
- contract_property_type: 成約の物件種別
- contract_property_code: 成約の物件コード
- contract_property_name: 成約の物件名
- contract_property_price: 成約の物件価格
- contract_property_address: 成約の物件所在地
- contract_status: 成約ステータス
- reaction_count: 反響回数
- visit_count: 来場回数
- contract_flag: 成約フラグ
- remarks: CSV の全項目を「見出し：値」で改行区切りにした文
