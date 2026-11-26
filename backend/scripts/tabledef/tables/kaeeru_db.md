---
table: kaeeru_db
title: カエールの査定依頼
business: used
source: 改修
---
不動産査定サイト「カエール」からの査定依頼メールを取り込んだ元の表。1行＝依頼者1人（メールアドレスで1行）。
書くもの：メールの取り込みが ① の request kaeeru_update で送る（kaeeru_update.php）。同じメールアドレスがあれば上書き、無ければ INSERT。
続けて ① handlers/portal/kaeeru.php が中古の反響一覧（inquiry_customer_resale）へ `kaeeru_assess_<id>` で写す（medium・response_medium・hp_campaign＝カエール、category＝売り:ポータル、査定の項目は note につなぐ）。
⚠️ 表の名前は「かえる」ではなく「カエール」。建売ではなく中古（売却の相談）の反響。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。

## 列
- id: ID（自動採番）。反響ID の末尾になる
- type: 種別（査定する不動産の種別）
- location: 所在地（査定する不動産。反響一覧の area に入る）
- area: 土地面積
- status: 現況
- schedule: 売却予定
- relation: 査定対象不動産とご自身の関係
- price: 査定額
- name: お名前
- name_kana: フリガナ
- email: メールアドレス。⚠️ 同じ人かどうかはこれで決める
- address: 住所（依頼者の住所。反響一覧の building に入る）
- tel: ご連絡先（反響一覧の mobile に入る）
- registered: メール受信日時
- remarks: 反響内容のまとめ（メールの全項目をつないだ文）
