---
table: member_resale
title: 中古リノベのホームページ会員登録
business: used
source: 改修
---
中古住宅専門店（chuko-senmon.jp）の会員登録メールを取り込んだ元の表。1行＝会員1人（メールアドレスで1行）。
書くもの：GAS（backend/scripts/gas/runMemberResale.gs）がメールを読み、① の request member_resale_update で送る（member_resale_update.php）。同じメールアドレスがあれば上書き、無ければ `rm_` で始まる ID を作って INSERT。
続けて ① handlers/portal/member_resale.php が反響一覧（inquiry_customer_resale）へ `hp_member_<id>` で写す（category＝買い:中古リノベ・hp_campaign＝会員登録）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。

## 列
- no: 連番（自動採番）
- id: 会員の ID（`rm_` で始まる）。反響ID の末尾になる
- email: メールアドレス。⚠️ 同じ会員かどうかはこれで決める
- name: お名前
- name_kana: フリガナ
- address: ご住所（反響一覧の building に入る）
- tel: 電話番号（反響一覧の landline に入る）
- mobile: 携帯電話（反響一覧の mobile に入る）
- email_send_flag: メール配信の希望（メールの項目のまま）
- source: 何で知ったか（反響一覧の response_medium）
- registered_at: 登録日時（メール受信日時）
- remarks: 詳細メモ（メールの全項目をつないだ文。反響一覧の note）
