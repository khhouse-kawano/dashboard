---
table: reserve_resale
title: 中古リノベのホームページ来場予約
business: used
source: 改修
---
中古住宅専門店のホームページのイベント・物件の予約メールを取り込んだ元の表。1行＝予約メール1通。
書くもの：メールの取り込みが ① の request reserve_resale_update で送る（reserve_resale_update.php。INSERT IGNORE）。
続けて ① handlers/portal/reserve_resale.php が反響一覧（inquiry_customer_resale）へ `hp_resale_<no>` で写す（medium＝ホームページ反響・category＝買い:中古リノベ・hp_campaign＝イベント名）。
⚠️ category を 買い:中古リノベ にしないと、要確認の中古の未同期に出ない（v2.2.175）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。

## 列
- no: 連番（自動採番）。反響ID の末尾になる
- event: ご希望イベント／物件番号（反響一覧の hp_campaign）
- date: ご来店・参加希望日（反響一覧の reserved_date）
- time: ご来店・参加希望時間（反響一覧の reserved_time）
- name: お名前。⚠️ 空の行は反響一覧に写さない
- nameKana: フリガナ
- email: メールアドレス
- tel: お電話番号（反響一覧の mobile に入る）
- zip: 郵便番号
- address: ご住所（反響一覧の building に入る）
- source: ご予約のきっかけ（反響一覧の response_medium）
- note: その他お問い合わせ
- registered: メール受信日時
- remarks: 詳細メモ（メールの全項目をつないだ文。反響一覧の note）
