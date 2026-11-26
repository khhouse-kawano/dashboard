---
table: homes_db_resale
title: HOME'S 反響の取り込み元（中古）
business: used
source: 改修
---
LIFULL HOME'S（中古住宅専門店）の問合せメールの内容。1行が1人の問合せ（userId＝問合せ番号）。形は homes_db_kaeru と同じ。
sync の runHomesResale.ts（メール）が1件ずつ ① の request homes_db_resale（handlers/homes_db_resale.php）へ送り、userId が既にあれば UPDATE、無ければ INSERT する。
そのあと portal/homes_resale.php が、その userId の最新の1行を反響一覧（inquiry_customer_resale。`homes_<userId>`・区分「買い:ポータル」）と
不動産CRMの買いリード（brokerage_listings。extId `homes:<userId>`）へ足す（どちらも INSERT だけ。上書きしない）。
② の realty/ieloveMatch.ts が、買いリードをいえらぶの台帳に結ぶのに companyId を読む。
⚠️ 以前は存在確認が homes_db_kaeru を見ていたため、同じ userId の行が積み上がっていた（今は直してある。下流は userId ごとに最新の1行だけを使う）。
⚠️ 照合順序が brokerage_listings（utf8mb4_unicode_ci）と違う。比べるときは COLLATE を付ける。

## 列
- no: 連番（自動採番）
- registered: システム受付日時（メールの受信日時。YYYY-MM-DD HH:MM:SS）。反響一覧の反響日・買いリードの受付日になる
- userUrl: ユーザー詳細URL（HOME'S の管理画面）
- propertyUrl: 物件詳細URL（反響一覧の url に入る）
- category: 物件種別（例 売買 一戸建て。買いリードでは 戸建／マンション／土地 に直す）
- propertyName: 物件名
- price: 価格（例 1,500万円。買いリードの budget に直す）
- area: 所在地（物件）
- railway: 交通
- large: 面積
- plan: 間取
- propertyId: 物件番号（HOME'S の番号）
- companyId: 自社管理番号（いえらぶの6桁の物件番号）。ieloveMatch.ts が台帳に結ぶのに使う
- userId: 問合せ番号。上書きの鍵
- name: 名前
- mail: メールアドレス
- mobile: 電話番号
- note: お問合せ内容
- remarks: メールの全項目を「見出し：値」で改行区切りにした文
