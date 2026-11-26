---
table: inquiry_introductory
title: お友達紹介キャンペーンの反響
business: common
source: 改修
---
お友達紹介キャンペーン（オーナー様・社員・業者様からの紹介）の反響。1行が1件の紹介の届け出。
受付：GAS（Gmail を監視）が通知メールを読み、① の request introductory（handlers/introductory.php）へ送る。重複は dedupKey の UNIQUE キーで弾く。
画面：紹介の反響（header/introductory/InquiryIntroductory.tsx）。② の inquiry_introductory（features/introductory/index.ts）が一覧・担当の割り当て・顧客DB への取り込み（同期）・重複／ブラックリストのタグを扱う。② が止まるとこの画面は動かない（① の予備は無い）。
取り込み先は division で決まる（注文 master_data／建売 master_data_kaeru／中古 master_data_resale）。お知らせ（information）・店舗の集計（shop/queries.ts）・紹介の集計（introductory/summary.ts）も読む。
⚠️ 受付は ① に置いている（GAS は送り直さないので、② が止まっている間の反響を失わないため）。
⚠️ 列名は GAS の key 名そのまま（キャメルケース）。
⚠️ 本当に取り込み済みか は sync = 1 かつ master_data_id あり で見る。タグを付けた行も sync = 1 になるが master_data_id は NULL（同期不要）。

## 列
- no: 連番
- dedupKey: 重複判定キー（SHA-256）。同じメールが複数通届くため。UNIQUE
- campaignName: キャンペーン名
- referrerType: 紹介者区分。owner=オーナー様 employee=社員 partner=業者様
- division: 事業区分。注文／建売／中古。同期先のテーブルが変わる
- brand: ブランド
- registrantName: 名前（紹介者）
- registrantKana: ふりがな（紹介者）
- mail: メールアドレス（紹介者）
- companyName: 会社情報（業者様のとき）
- postalCode: 郵便番号
- area: 住所
- tel: 電話番号
- fax: FAX番号
- mobile: 携帯番号
- mailPermission: メール配信可否
- salesStaff: 担当営業。キャンペーンによって設問名が「担当希望営業」の場合もある
- friendName: 【お友達】氏名（漢字）
- friendKana: 【お友達】氏名（かな）
- friendTel: 【お友達】電話番号
- friendLineId: 【お友達】LINE ID
- note: ご希望内容。複数行になり得る
- guideStaff: ご案内担当者
- shop: 担当店舗。⚠️ 反響時点では必ず未設定。社内で割り振る
- staff: 担当営業。空なら同期時に「<店舗> 管理」になる
- sync: 顧客として取り込んだか。1=取り込み済み（タグを付けた行も 1）。⚠️ 1 の行は担当変更も同期も拒否する
- master_data_id: 作成した顧客の id。⚠️ どのテーブルの id かは division を見る
- registered: システム受付日時。GAS が通知メールの受信日時から生成する。一覧はこの順に並べる
- remarks: GAS が生成した「ラベル：値」形式の全項目テキスト
- createdAt: 当システムへの登録日時
- duplicate_tag: 重複客（1 にすると sync も 1。顧客は作らない）
- blacklist_tag: ブラックリスト客（1 にすると sync も 1。顧客は作らない）
