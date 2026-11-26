---
table: allGrit_kaeru
title: ALLGRIT（公式LINE）の顧客
business: spec
source: 改修
---
かえるホームの公式LINE（ALLGRIT）の顧客一覧の書き出しを取り込んだ表。1行＝LINE の友だち1人。
書くもの：sync（Node.js）が ALLGRIT の書き出しを読み、① の request allGrit_kaeru で送る（allGrit_kaeru.php。INSERT … ON DUPLICATE KEY UPDATE で上書き。列は sync の headerMap に合わせてある）。
続けて ① handlers/portal/allgrit_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `allgrit_<line_uid>` で写す（medium・response_medium＝ALLGRIT）。
⚠️ 反響一覧へ写すかどうか・重複の判定は line_uid。line_uid が空の行は写さない。
⚠️ 建売の販促媒体（medium_kaeru）では「公式LINE」。画面の表示だけ ALLGRIT に差し替えている（CustomerTrendKaeru.tsx）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。

## 列
- no: 連番（自動採番）
- customer_id: ALLGRIT の顧客ID
- line_uid: LINE のユーザーID。⚠️ 反響ID（allgrit_<line_uid>）の元。同じ人の判定に使う
- line_registered_at: 友だち登録日時（反響一覧の inquiry_date）
- customer_type [推論]: 顧客の種類
- company_name [推論]: 会社名
- lead_status [推論]: 見込みの状況
- delivery_date [推論]: （推定）配信日
- line_display_name: LINE の表示名
- last_name: 姓（反響一覧の first_name に姓名をつないで入れる）
- first_name: 名
- name_kana: フリガナ
- birth_date: 生年月日
- gender: 性別
- email: メールアドレス
- phone: 電話番号（反響一覧の mobile に入る）
- zip_code: 郵便番号
- address: 住所（反響一覧の building に入る）
- budget: 予算
- available_time [推論]: 連絡のつく時間帯
- land_search_status [推論]: 土地探しの状況
- motivation: 住まい探しの動機
- desired_pref: 希望の県
- desired_city_1: 希望の市区町村①
- desired_city_2: 希望の市区町村②
- desired_city_3: 希望の市区町村③
- document_request_status [推論]: 資料請求の状況
- other_conditions: その他の希望条件
- friend_add_status [推論]: 友だち追加の状況
- friend_add_route [推論]: 友だち追加の経路
- staff [推論]: ALLGRIT 上の担当
- visit_reservation [推論]: 来場予約
- message_received [推論]: 受け取ったメッセージ
- owner_id [推論]: ALLGRIT 上の担当者の ID
- source_campaign [推論]: 流入のキャンペーン
- source_media [推論]: 流入の媒体
- source_site [推論]: 流入のサイト
- gclid [推論]: Google 広告のクリック ID
- tags [推論]: ALLGRIT のタグ
- desired_pref_alt [推論]: 希望の県（別の項目）
- desired_area_detail [推論]: 希望エリアの詳細
- desired_area_1 [推論]: 希望エリア①
- desired_area_2 [推論]: 希望エリア②
- desired_area_3 [推論]: 希望エリア③
- remarks: 全項目をつないだ文（反響一覧の note）
