---
table: member_kaeru
title: 建売のホームページ会員登録
business: spec
source: 改修
---
かえるホームのホームページの会員登録メールを取り込んだ元の表。1行＝会員1人（メールアドレスで1行）。
書くもの：メールの取り込み（sync）が ① の request member_kaeru_update で送る（member_kaeru_update.php）。同じメールアドレスがあれば上書き（UPDATE）、無ければ `mk_` で始まる ID を作って INSERT。
続けて ① handlers/portal/member_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `hp_member_<id>` で写す（medium＝ホームページ反響・hp_campaign＝会員登録）。⚠️ 反響一覧へは INSERT IGNORE なので、会員の情報を上書きしても反響一覧は変わらない。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。

## 列
- no: 連番（自動採番）
- id: 会員の ID（`mk_` で始まる）。反響ID の末尾になる
- email: メールアドレス。⚠️ 同じ会員かどうかはこれで決める
- name: お名前
- name_kana: フリガナ
- zip: 郵便番号
- address: ご住所（反響一覧の building に入る）
- age: ご年齢
- tel: 電話番号（反響一覧の landline に入る）
- mobile: 携帯電話（反響一覧の mobile に入る）
- source: 何で知ったか（反響一覧の response_medium）
- desired_area_1: 希望エリア①（反響一覧の area）
- desired_area_2: 希望エリア②（反響一覧の area_2）
- desired_area_3: 希望エリア③（反響一覧の area_3）
- area_notes: エリアの補足（反響一覧の school_area）
- other_conditions: その他の希望条件（反響一覧の other_condition）
- registered_at: 登録日時（メール受信日時）
- remarks: 詳細メモ（メールの全項目をつないだ文。反響一覧の note）
