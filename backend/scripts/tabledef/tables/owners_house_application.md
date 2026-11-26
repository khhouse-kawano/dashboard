---
table: owners_house_application
title: オーナーズハウス募集の受付
business: order
source: 改修
---
オーナーズハウス募集（お施主様が自宅を見学先として登録するフォーム）の受付（v2.2.215）。1受付＝1行。
書くのは ① handlers/owners_house_application.php（フォームからの受付。写真は /dashboard/api/images/）と、② request owners_house_application_import（過去の通知メールの取り込み。GAS OwnersHouseMailImport.gs）。
読むのは「反響管理 → オーナーズハウス募集」（header/inquiry/OwnersHouseApplication.tsx。request owners_house_application_list）。
⚠️ 物件として公開するのは ownershouse（管理画面で別に登録する）。

## 列
- id: 連番
- received_at: 受付日時（日本時間）
- source: form＝フォーム / mail＝過去の通知メールから取り込み
- mail_message_id: 取り込んだ通知メールの Gmail の ID（二重取り込みの防止。UNIQUE）
- name: お施主様名
- zip: 郵便番号
- shop: ご契約店舗（フォームの選択肢の文字のまま。例 国分ハウジング霧島店）
- staff: 担当営業（自由入力）
- photo_mode: 撮影を依頼する / 写真を添付する
- photos: 添付写真のファイル名の JSON 配列（/dashboard/api/images/ の中）
- title: ご自宅のタイトル
- feature1: ご自宅の見どころ①
- feature2: ご自宅の見どころ②
- feature3: ご自宅の見どころ③
- feature4: ご自宅の見どころ④
- feature5: ご自宅の見どころ⑤
- created_at: 行を作った日時
