---
table: catalog_resale
title: 中古リノベのホームページ資料請求
business: used
source: 改修
---
中古住宅専門店（chuko-senmon.jp）の資料請求メールを取り込んだ元の表。1行＝資料請求メール1通。
書くもの：GAS（backend/scripts/gas/runCatalogResale.gs）がメールを読み、① の request catalog_resale_update で送る（catalog_resale_update.php。INSERT IGNORE）。
続けて ① handlers/portal/catalog_resale.php が反響一覧（inquiry_customer_resale）へ `hp_catalog_<no>` で写す（medium＝ホームページ反響・hp_campaign＝資料請求）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。

## 列
- no: 連番（自動採番）。反響ID の末尾になる
- catalog_request: 資料請求（まとめて資料請求のメールは「まとめて資料請求」）
- visit_reservation: 見学予約
- name: お名前。⚠️ 空の行は反響一覧に写さない
- nameKana: フリガナ
- email: メールアドレス
- tel: ご連絡先お電話番号（反響一覧の mobile に入る）
- zip: 郵便番号
- address: ご住所（反響一覧の building に入る）
- property: 資料請求対象不動産（住所・URL など）。⚠️ 反響一覧には remarks を通してだけ入る
- registered: メール受信日時
- remarks: 詳細メモ（メールの全項目をつないだ文。反響一覧の note）
