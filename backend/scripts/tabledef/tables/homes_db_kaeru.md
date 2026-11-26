---
table: homes_db_kaeru
title: HOME'S 反響の取り込み元（建売）
business: spec
source: 改修
---
LIFULL HOME'S（建売。かえるホーム）の問合せメールの内容。1行が1人の問合せ（userId＝問合せ番号）。
GAS（backend/scripts/gas/runHomesKaeru.gs。問合せメールと新築一戸建て見学予約メール）と sync の runHomesKaeru.ts（IMAP）が、1件ずつ ① の request homes_db_kaeru（handlers/homes_db_kaeru.php）へ送る。
userId が既にあれば UPDATE、無ければ INSERT。そのあと portal/homes_kaeru.php が、表全体を反響一覧（inquiry_customer_kaeru。`homes_<userId>`・媒体 HOME'S・ブランド かえる）へ INSERT IGNORE する。
⚠️ 見学予約メールにしか無い項目（フリガナ・見学希望日・連絡時間帯）は remarks にだけ入る。

## 列
- no: 連番（自動採番）
- userUrl: ユーザー詳細URL（HOME'S の管理画面）
- registered: システム受付日時（メールの受信日時。YYYY-MM-DD HH:MM:SS）。反響一覧の反響日になる
- propertyUrl: 物件詳細URL（反響一覧の url に入る）
- category: 物件種別（例 売買 一戸建て・新築一戸建て見学予約）
- propertyName: 物件名（反響一覧の property に入る）
- price: 価格
- area: 所在地（物件。反響一覧の area に入る）
- railway: 交通
- large: 面積
- plan: 間取
- propertyId: 物件番号（HOME'S の番号）
- companyId: 自社管理番号
- userId: 問合せ番号。上書きの鍵
- name: 名前
- mail: メールアドレス
- mobile: 電話番号
- note: お問合せ内容（反響一覧の remarks に入る）
- remarks: メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）
