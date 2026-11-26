---
table: homes_db
title: HOME'S 反響の取り込み元（注文住宅）
business: order
source: 改修
---
LIFULL HOME'S（注文住宅。KH・DJH・JH・PG HOUSE）の反響の生データ。1行が1件の問合せ、または1件の来場予約。
sync の runHomesOrder.ts が「問合せメール一覧」と「来場予約一覧」の CSV を落とし、① の request homes_db_order（handlers/homes_db_order.php）へ500件ずつ送る。
同じ処理で反響一覧（inquiry_customer）に行を足す（portal/homes_order.php。媒体 HOME'S）。inquiry_id は問合せが `homes<番号>`、来場予約が `homes_reserve<番号>`。
⚠️ 鍵は id_homes だが UNIQUE キーは無い。PHP が既にある番号を SELECT してから入れる（core/bulk_upsert.php）。
⚠️ 来場予約の行は、問合せと同じ列に違う意味の値が入る（income_homes＝来場先、age_homes＝問合せ種別）。

## 列
- id: 連番（自動採番）
- id_homes: 問合せ番号。来場予約は `reserve_` ＋来場予約問合せ番号（問合せと番号が重なるため）
- name_homes: 氏名（半角スペースで姓と名に分けて反響一覧に入れる）
- kana_homes: シメイ（カナ）。来場予約には無い
- zip_homes: 郵便番号
- address_homes: 住所
- mail_homes: メールアドレス
- phone_homes: 電話番号
- period_homes: 建設予定時期。来場予約には無い
- estate_homes: 土地所有の有無
- status_homes: 現在の検討状況
- budget_detail_homes: 建築予算
- income_homes: 世帯年収。⚠️ 来場予約の行では「来場先」
- age_homes: 年齢。⚠️ 来場予約の行では「問合せ種別」
- place_homes: 建築予定地（市区町村）。店舗判定の第1優先。反響一覧の area に入る
- shop_homes: 取り込んだアカウントのブランド（KH / DJH / JH / PG HOUSE）。店舗名ではない
- date_homes: 問合せ日時（反響一覧の inquiry_date は空白の前の日付だけ）
