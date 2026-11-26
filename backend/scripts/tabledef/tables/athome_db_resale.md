---
table: athome_db_resale
title: at home 反響の取り込み元（中古）
business: used
source: 改修
---
at home（中古住宅専門店）の問合せメールの内容。1行が1人（メールアドレスで見分ける）。形は athome_db_kaeru と同じ。
sync の runAtHomeKaeru.ts（Gmail を IMAP で読む）が、本文に「中古住宅専門店」とあるメールを ① の request athome_resale_update（handlers/athome_resale_update.php）へ1件ずつ送る。
同じメールアドレスの行があれば UPDATE、無ければ INSERT。そのあと portal/athome_resale.php が、その行を反響一覧（inquiry_customer_resale。`athome_<id>`・区分「買い:ポータル」）と
不動産CRMの買いリード（brokerage_listings。extId `athome:<物件番号>:<受付日>:<氏名>`）へ足す（どちらも INSERT だけ）。
② の realty/ieloveMatch.ts が、買いリードをいえらぶの台帳に結ぶのに company_property_id を読む。
⚠️ 同じ人が別の物件に問い合わせると、同じ行（同じ id）が上書きされる。買いリードは extId で見分けるので2件目も作られる。
⚠️ 照合順序が brokerage_listings（utf8mb4_unicode_ci）と違う。比べるときは COLLATE を付ける。

## 列
- no: 連番（自動採番）
- id: 行の ID（`ak_`＋uniqid。PHP が作る。建売と同じ接頭辞）。反響一覧の inquiry_id は `athome_` ＋この値
- inquiry_date: お問合わせ日時（例 2026年11月24日13時37分。本文のまま）
- property_type: 物件種目
- building_name: 建物名（反響一覧の property・買いリードの対象物件に入る）
- transportation: 交通
- station: 駅名
- walk_minutes: 徒歩（分）
- bus_stop: バス停名
- bus_ride_minutes: バス乗車分
- bus_walk_minutes: バス停歩分
- property_address: 所在地（物件。反響一覧の area に入る）
- price: 価格（例 1,600万円。買いリードの budget に直す）
- floor_plan: 間取り
- building_area: 専有・建物面積
- land_area: 土地面積
- athome_property_id: at home 物件番号。買いリードの extId に入る
- company_property_id: 貴社物件管理番号（355050000＋いえらぶの6桁）。ieloveMatch.ts が台帳に結ぶのに使う
- name: お名前。空なら買いリードは作らない
- email: メールアドレス。同じ人かどうかの鍵
- zip: 郵便番号
- address: 住所（お客様。反響一覧の building に入る）
- tel: 電話番号
- contact_time: 連絡希望の時間帯
- other_contact_method: その他の連絡方法
- gender: 性別
- move_in_timing: 入居希望時期
- tour_date_1: 第一希望日時（見学）。入っていれば買いリードの段階を「内見予約」にする
- registered_at: システム受付日時（メールの受信日時。YYYY-MM-DD HH:MM:SS）。反響日・買いリードの受付日になる
- remarks: メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）
