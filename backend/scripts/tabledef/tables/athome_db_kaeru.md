---
table: athome_db_kaeru
title: at home 反響の取り込み元（建売）
business: spec
source: 改修
---
at home（建売。国分ハウジング不動産＝かえるホーム）の問合せメールの内容。1行が1人（メールアドレスで見分ける）。
sync の runAtHomeKaeru.ts（Gmail を IMAP で読む）が、本文に「国分ハウジング不動産」とあるメールを ① の request athome_kaeru_update（handlers/athome_kaeru_update.php）へ1件ずつ送る。
同じメールアドレスの行があれば UPDATE、無ければ INSERT。そのあと portal/athome_kaeru.php が表全体を反響一覧（inquiry_customer_kaeru。`athome_<id>`・媒体 athome・ブランド かえる）へ INSERT IGNORE する。
⚠️ 同じ人が別の物件に問い合わせると、同じ行が上書きされる（1人1行）。反響一覧にも2件目は増えない。
⚠️ メール本文から取り出すので、空の項目に次の見出しが混ざることがある。

## 列
- no: 連番（自動採番）
- id: 行の ID（`ak_`＋uniqid。PHP が作る）。反響一覧の inquiry_id は `athome_` ＋この値
- inquiry_date: お問合わせ日時（例 2026年11月21日19時11分。本文のまま）
- property_type: 物件種目
- building_name: 建物名（反響一覧の property に入る）
- transportation: 交通
- station: 駅名
- walk_minutes: 徒歩（分）
- bus_stop: バス停名
- bus_ride_minutes: バス乗車分
- bus_walk_minutes: バス停歩分
- property_address: 所在地（物件。反響一覧の area に入る）
- price: 価格
- floor_plan: 間取り
- building_area: 専有・建物面積
- land_area: 土地面積
- athome_property_id: at home 物件番号
- company_property_id: 貴社物件管理番号
- name: お名前
- email: メールアドレス。同じ人かどうかの鍵
- zip: 郵便番号
- address: 住所（お客様。反響一覧の building に入る）
- tel: 電話番号
- contact_time: 連絡希望の時間帯
- other_contact_method: その他の連絡方法
- gender: 性別
- move_in_timing: 入居希望時期
- tour_date_1: 第一希望日時（見学）
- registered_at: システム受付日時（メールの受信日時。YYYY-MM-DD HH:MM:SS）。反響一覧の反響日になる
- remarks: メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）
