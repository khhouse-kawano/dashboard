---
table: catalog_kaeru
title: 建売のホームページ資料請求
business: spec
source: 改修
---
かえるホームのホームページの資料請求メールを取り込んだ元の表。1行＝資料請求メール1通。
書くもの：メールの取り込み（sync）が ① の request catalog_kaeru_update で送る（catalog_kaeru_update.php。INSERT IGNORE）。
続けて ① handlers/portal/catalog_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `hp_catalog_kaeru_<no>` で写す（medium＝ホームページ反響・hp_campaign＝資料請求）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。

## 列
- no: 連番（自動採番）。反響ID の末尾になる
- property: 物件情報（資料を請求した物件）
- note: お問い合わせ内容
- date: ご希望日（反響一覧の reserved_date）
- time: ご希望時間（反響一覧の reserved_time）
- name: お名前。⚠️ 空の行は反響一覧に写さない
- nameKana: フリガナ
- email: メールアドレス
- zip: 郵便番号
- address: ご住所（反響一覧の building に入る）
- age: ご年齢
- tel: 電話番号（反響一覧の mobile に入る）
- source: 何を見てかえるホームをお知りになりましたか？（反響一覧の response_medium）
- registered: メール受信日時
- remarks: 詳細メモ（メールの全項目をつないだ文。反響一覧の note）
