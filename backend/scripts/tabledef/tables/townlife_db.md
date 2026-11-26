---
table: townlife_db
title: タウンライフ 反響の取り込み元（注文住宅）
business: order
source: 改修
---
タウンライフ家づくり（注文住宅。KH・DJH・Nagomi・PG HOUSE・JH）の反響の生データ。1行が1件の問い合わせ（問い合わせID）。
sync の runTownlifeOrder.ts が管理画面の CSV を落とし（「取消処理されました」の行は除く）、① の request townlife_db_order（handlers/townlife_db_order.php）へ500件ずつ送る。
同じ処理で反響一覧（inquiry_customer）に `townlife<問い合わせID>` の行を足す（portal/townlife_order.php。媒体 タウンライフ）。
⚠️ 鍵は id_townlife だが UNIQUE キーは無い。PHP が既にある ID を SELECT してから入れる（core/bulk_upsert.php）。
⚠️ 列はすべて text。⚠️ 住所・電話・郵便番号は CSV の Excel の数式記号（="…"）を外してから入れる。

## 列
- id: 連番（自動採番）
- id_townlife: 問い合わせID。反響一覧の inquiry_id は `townlife` ＋この値
- name_townlife: 顧客氏名（全角スペースで姓と名に分けて反響一覧に入れる）
- kana_townlife: ふりがな
- age_townlife: 年齢
- zip_townlife: 郵便番号
- pref_townlife: 住所都道府県
- city_townlife: 住所市区町村。建設予定地詳細で店舗が決まらないとき、店舗判定に使う
- address_townlife: 住所詳細
- mail_townlife: メールアドレス
- phone_townlife: 電話番号
- place_townlife: 建設予定地
- place_detail_townlife: 建設予定地詳細。店舗判定の第1優先。反響一覧の area に入る
- floor_townlife: 希望階数
- adult_townlife: 予定人数（大人）
- child_townlife: 予定人数（子ども）
- ldk_townlife: 間取り（LDK）
- budget_townlife: 建物予算
- large_townlife: 土地の大きさ
- budget_estate_townlife: 土地予算
- demand_estate_townlife: 土地に関するご希望
- image_townlife: 敷地図・土地図面等の添付
- demand_house_townlife: 家のこだわり
- note_townlife: その他
- response_date_townlife: お問合せ日時（反響一覧の反響日になる）
- shop_townlife: 取り込んだアカウントのブランド（KH / DJH / Nagomi / PG HOUSE / JH など）。店舗名ではない
- status_townlife: 状況（タウンライフ上の確認状況。例「未読」「<日時>確認済み」）
- duplicate: 他の媒体からの重複の印。同じメール・同じブランドでタウンライフ以外の反響が反響一覧にあると、取り込みのときに記録する（portalTownlifeMarkDuplicates）
