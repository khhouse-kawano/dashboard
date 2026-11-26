---
table: iei_db
title: イエイ 査定依頼の取り込み元
business: used
source: 改修
---
イエイ（売却査定サイト。中古住宅専門店）の査定依頼メールの内容。1行が1人（メールアドレスで見分ける）。
sync の runIei.ts（Gmail を IMAP で読む）が、1件ずつ ① の request iei_resale_update（handlers/iei_resale_update.php）へ送る。同じメールアドレスの行があれば UPDATE、無ければ INSERT。
そのあと portal/iei_resale.php が、その行を反響一覧（inquiry_customer_resale。`iei_<id>`・区分「売り:ポータル」）と
不動産CRMの売却リード（brokerage_listings。extId `iei:<受付日>:<氏名>`。以前の `anken:` の行とも氏名＋受付日で重複を見る）へ足す（どちらも INSERT だけ）。
⚠️ メール本文から取り出すので、空の項目に次の見出しが混ざる列がある（rent・requests はほぼ全行）。下流では混ざらない列だけを使う。
⚠️ イエイの案件番号は取り出していない。

## 列
- no: 連番（自動採番）
- id: 行の ID（`iei_`＋uniqid。PHP が作る）。反響一覧の inquiry_id は `iei_` ＋この値
- assessment_method: 査定方法
- assessment_type: 査定種別
- property_type: 物件種別（反響一覧の property に入る。売却リードでは 戸建／マンション／土地 に直す）
- property_address: 物件所在地（反響一覧の area・売却リードの所在地に入る）
- building_area: 建物（専有）面積
- land_area: 土地面積
- floor_plan: 間取り
- built_year: 築年
- current_status: 現況
- rent: 賃料。⚠️ 次の見出しが混ざる
- ownership: ご名義
- reason: ご依頼理由（売却リードの reason に入る）
- sale_timing: 売却時期（売却リードの timing に入る）
- contact_date: 連絡希望日
- contact_time: 希望連絡時間
- hopes: 希望など
- requests: ご要望など。⚠️ 次の見出しが混ざる
- name: 姓名
- name_kana: 姓名（カナ）
- age: 年齢
- address: 住所（お客様。反響一覧の building に入る）
- tel1: 電話番号1（反響一覧の mobile に入る）
- tel2: 電話番号2（反響一覧の landline に入る）
- email: E-mailアドレス。同じ人かどうかの鍵
- registered_at: システム受付日時（メールの受信日時）。反響日・売却リードの受付日になる
- remarks: メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）
