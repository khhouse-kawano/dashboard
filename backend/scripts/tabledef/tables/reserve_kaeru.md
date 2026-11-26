---
table: reserve_kaeru
title: 建売のホームページ来場予約
business: spec
source: 改修
---
かえるホームのホームページの来場予約メールを取り込んだ元の表。1行＝予約メール1通。
書くもの：メールの取り込み（sync）が ① の request reserve_kaeru_update で送る（reserve_kaeru_update.php。INSERT IGNORE で、同じメールアドレス・受信日時の2通目は入らない）。
続けて ① handlers/portal/reserve_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `hp_reserve_<no>` で写す（medium＝ホームページ反響・hp_campaign＝イベント名）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。

## 列
- no: 連番（自動採番）。反響ID の末尾になる
- area: 希望エリア（反響一覧の area）
- date: ご来場希望日（反響一覧の reserved_date）
- time: ご来場希望時間（反響一覧の reserved_time）
- name: お名前。⚠️ 空の行は反響一覧に写さない
- nameKana: フリガナ
- age: ご年齢
- email: メールアドレス
- tel: 電話番号（反響一覧の mobile に入る）
- zip: 郵便番号
- address: ご住所（反響一覧の building に入る）
- event: 予約したイベント（反響一覧の hp_campaign）
- source: 何で知ったか（反響一覧の response_medium）
- purpose [推論]: 来場の目的
- note: その他お問い合わせ
- registered: メール受信日時
- remarks: 詳細メモ（メールの全項目をつないだ文。反響一覧の note）
