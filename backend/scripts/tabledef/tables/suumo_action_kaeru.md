---
table: suumo_action_kaeru
title: SUUMO（建売）の反響ごとの記録
business: spec
source: 改修
---
SUUMO（建売。かえるホーム）の管理画面「反響」の CSV を取り込んだ表。1行＝反響1件（予約ID か 反響ID で1行。v2.2.263）。
書くもの：sync が CSV を ② の suumo_kaeru:actions へ直接送る（features/suumoKaeru.ts。① を通さない。合い言葉 SYNC_LOG_SECRET）。action_id で上書き。
同じ処理が反響一覧（inquiry_customer_kaeru）へ `suumo_act_<action_id>` で1反響1行を足す。キャンセルの予約は足さない（すでにある行は備考の先頭に「予約キャンセル」を付ける）。
⚠️ 顧客ごとの CSV は今までどおり ① が suumo_db_kaeru に入れる（顧客ID・追客状況・成約はそちらにしか無い）。
⚠️ 以前の `suumo_<顧客ID>` の行と同じ反響（初回の予約ID・反響ID が同じ）は反響一覧に足さない。

## 列
- no: 連番（自動採番）
- action_id: 予約ID または 反響ID（予約ID は英数8桁・反響ID は数字10桁。どちらか一方）。⚠️ 一意
- action_kind: reserve（予約ID）／ inquiry（反響ID）
- received_at: 受付日時（YYYY/MM/DD HH:MM:SS）
- reaction_type: 反響種別（例 資料請求・即時予約）
- name: お名前
- name_kana: フリガナ
- address: ご住所
- email: メールアドレス
- phone: 電話番号
- fax: FAX
- staff: お客様担当
- reserve_status: 予約ステータス（確定・キャンセル）
- guide_at: 案内日時（反響一覧の来場予約の日・時間）
- other_wish: その他のご希望日時
- meeting_place: 集合場所
- message: 連絡事項
- canceled_at: キャンセル日時
- cancel_route: キャンセル経路
- cancel_reason: キャンセル理由
- property_type: 物件種別
- property_code: SUUMO の物件コード
- project_code: SUUMO のプロジェクトコード
- property_name: 物件名（反響一覧の property）
- property_price: 価格
- property_address: 物件の所在地（反響一覧の area）
- listing_plan: 掲載企画
- company_property_code: 貴社物件コード
- transaction_type: 取引態様
- origin_company: 元付会社
- company_staff: 貴社ご担当
- traffic: 交通
- layout: 間取り
- exclusive_area: 専有面積
- building_area: 建物面積
- land_area: 土地面積
- customer_id: suumo_db_kaeru の顧客ID（② が結ぶ。候補が1人のときだけ。結べなければ NULL）
- customer_match: 結び方（id ／ name ／ mail ／ phone）
- remarks: CSV の全項目をつないだ文（反響一覧の note）
- created_at: 作成日時
- updated_at: 更新日時（上書きで変わる）
