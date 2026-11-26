---
table: pre_kaeru
title: 建売の先取物件の申し込み
business: spec
source: 改修
---
かえるホームのホームページの「先取物件」（公開前の物件情報）の申し込みメールを取り込んだ元の表。1行＝申し込み1人（メールアドレスで1行）。
書くもの：メールの取り込み（sync）が ① の request pre_kaeru_update で送る（pre_kaeru_update.php）。同じメールアドレスがあれば上書き、無ければ `pk_` で始まる ID を作って INSERT。
続けて ① handlers/portal/pre_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `hp_pre_<id>` で写す（medium＝ホームページ反響・response_medium＝Web検索・hp_campaign＝先取物件）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。

## 列
- id: 申し込みの ID（`pk_` で始まる）。反響ID の末尾になる
- email: メールアドレス。⚠️ 同じ人かどうかはこれで決める
- name: お名前
- name_kana: フリガナ
- tel: 電話番号（反響一覧の mobile に入る）
- zip: 郵便番号
- address: ご住所（反響一覧の building に入る）
- pre_properties: 申し込んだ先取物件（反響一覧の area に入る）
- questions: ご質問など
- registered_at: 受付日時
- remarks: メモ（メールの全項目をつないだ文。反響一覧の note）
