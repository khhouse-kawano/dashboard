---
table: suumo_db_resale
title: SUUMO 反響の取り込み元（中古）
business: used
source: 改修
---
SUUMO（中古住宅専門店）の反響 CSV の生データ。1行が1件の反響（連番 sequence_no）。列は CSV の見出しそのまま。
sync の runSuumoResale.ts が CSV 全件を ① の request suumo_db_resale（handlers/suumo_db_resale.php）へ500件ずつ送り、上書き（ON DUPLICATE KEY UPDATE）する。
書き込みのあとに portal/suumo_resale.php が、表全体から未取込の行を
反響一覧（inquiry_customer_resale。`suumo_<連番>`・区分「買い:ポータル」）と不動産CRMの買いリード（brokerage_listings。extId `suumo:<連番>`）へ足す。
② の realty/ieloveMatch.ts が、買いリードをいえらぶの台帳に結ぶのに company_property_code を読む。
⚠️ received_at は `2026/7/02 12:06:19` のように月が0埋めされない。⚠️ 氏名が姓の列にまとめて入る行、電話が phone_1 に全部入る行がある。

## 列
- id: 連番（自動採番）
- received_at: 受付日時（文字列。月が0埋めされない）
- sequence_no: 連番（SUUMO 側の反響の番号）。反響一覧・買いリードの鍵
- source_campaign: 発生元キャンペーン
- recipient_type: 宛先種別
- recipient_code: 宛先コード
- spare_1: 予備1
- spare_2: 予備2
- spare_3: 予備3
- spare_4: 予備4
- spare_5: 予備5
- last_name_kanji: 氏名（漢字）姓。⚠️ 姓名まとめて入る行がある
- first_name_kanji: 氏名（漢字）名
- last_name_kana: 氏名（カナ）姓
- first_name_kana: 氏名（カナ）名
- zip_code_1: 郵便番号1（上3桁）
- zip_code_2: 郵便番号2（下4桁）
- address_1: 住所1（反響一覧の pref に入る）
- address_2: 住所2（反響一覧の city に入る）
- address_3: 住所3（反響一覧の street に入る）
- email: メールアドレス
- phone_1: 電話番号1。⚠️ 全部入る行がある
- phone_2: 電話番号2
- phone_3: 電話番号3
- fax_1: FAX1
- fax_2: FAX2
- fax_3: FAX3
- current_residence: 現住居形態
- planned_occupants: 入居予定人数
- eldest_child_lifestage: 第一子ライフステージ
- parking_available: 駐車場の有無
- annual_income: 年収
- birth_date: 生年月日
- age: 年齢
- desired_move_in: 入居希望時期
- preferred_area_1: 希望エリア1
- preferred_area_2: 希望エリア2
- preferred_area_3: 希望エリア3
- budget_rent: 予算/賃料
- preferred_layout_1: 希望間取り1
- preferred_layout_2: 希望間取り2
- preferred_layout_3: 希望間取り3
- preferred_layout_4: 希望間取り4
- preferred_layout_5: 希望間取り5
- preferred_layout_6: 希望間取り6
- preferred_living_area: 希望専有面積
- other_property_type_1: その他希望物件種別1
- other_property_type_2: その他希望物件種別2
- other_property_type_3: その他希望物件種別3
- other_property_type_4: その他希望物件種別4
- inquiry_unit: 反響単位
- other: その他
- preferred_contact_method: 希望連絡方法
- preferred_contact_time: 希望連絡時間帯
- inquiry_content_1: お問い合わせ内容1
- inquiry_content_2: お問い合わせ内容2
- inquiry_content_3: お問い合わせ内容3
- inquiry_content_4: お問い合わせ内容4
- inquiry_content_5: お問い合わせ内容5
- inquiry_comment: お問い合わせコメント（買いリードの note に入る）
- inquiry_other: その他のお問い合わせ
- reserve_1: 予約1
- reserve_2: 予約2
- reserve_3: 予約3
- reserve_4: 予約4
- reserve_5: 予約5
- customer_notes: 顧客メモ
- sale_assessment_info: 売却査定情報
- commercial_info: 事業用情報
- company_name: 会社名（自社）
- branch_name: 支店名
- company_location: 会社所在地
- company_tel: 会社電話番号
- media_name: 媒体名
- media_type: 媒体種別
- issue: 発行
- page: ページ
- property_type: 物件種別
- status: ステータス
- property_code: 物件コード（SUUMO の番号）
- property_name_1: 物件名1（反響一覧の property に入る）
- property_name_2: 物件名2
- company_property_code: 自社物件コード（いえらぶの6桁の物件番号）。ieloveMatch.ts が台帳に結ぶのに使う
- contact_person: 担当者
- inquiry_unit_detail: 反響単位詳細
- line_name: 沿線名
- nearest_station: 最寄り駅
- bus_or_walk: バス・徒歩
- property_location: 物件所在地（反響一覧の area に入る）
- price_or_rent: 価格/賃料（例 3490万円。買いリードの budget に直す）
- layout: 間取り
- area_building_area: 専有面積/建物面積
- land_area: 土地面積
- free_1: フリー項目1（反響一覧の url に入る）
- free_2: フリー項目2
- created_at: 行を作った日時
- remarks: CSV の全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）
