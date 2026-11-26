---
table: inquiry_customer
title: 反響一覧（注文住宅）
business: order
source: 改修
---
注文住宅の反響（問い合わせ・資料請求・来場予約）。1行が1件の反響。顧客DB（master_data）に取り込む前の受け皿。
書くところ（約40経路）
- ホームページのフォーム：② の campaign_form:entry・estimate・owners_house_reservation・kagosuma・kengakuCloud・housingBazar・memberEntry・myhomes・tochishinchaku（① に同名の予備）
- ポータル：① の portal/suumo_order.php・homes_order.php・townlife_order.php・allgrit_order.php（sync から）、pgh_order.php（GAS の資料請求メール）
- 更新：sync が inquiry_update（マイホームロボの ID・同期済み）、反響一覧の画面が list（担当店舗・担当営業・タグ・ブラックリスト・顧客DB への取り込み。features/list/save.ts）
読むところ：反響一覧（ListOrder.tsx。② の list）、分析（features/analysis）、日々の行動（dailyAction）、重複判定（inquiryDup。inquiry_dup_key を作る）、トラッキング（landing_params）など。
inquiry_id は媒体ごとの接頭辞＋元の ID（例 `suumo…`・`homes…`・`homes_reserve…`・`townlife…`・`allgrit…`・`form<日時>_<キャンペーンID>`・`pgh_hp_…`）。
⚠️ inquiry_id に UNIQUE キーが無い。書く側が既にあるかを SELECT してから入れる（INSERT IGNORE では防げない）。
⚠️ 既定値の無い NOT NULL の列が42列ある。INSERT では全部埋める（campaignForm/entry.ts の NOT_NULL_COLUMNS）。sync・delete_flag は数（空文字は不可）。
⚠️ 反響日（inquiry_date）は `YYYY/MM/DD`。ハイフンで入れるとメニューの未同期の数に出ない。
建売は inquiry_customer_kaeru、中古は inquiry_customer_resale（形はほぼ同じ）。

## 列
- id: 連番（自動採番）。inquiry_dup_key.src_id が指す
- inquiry_id: 反響の ID（媒体の接頭辞＋元の ID）。取り込み・更新の鍵
- pg_id: 取り込んだ顧客の id（master_data.id）。顧客DB に取り込むと入る
- mhl_id: マイホームロボの ID（sync の inquiry_update が入れる）
- mhl_url: マイホームロボの URL（sync の inquiry_update が入れる）
- mhl_mail [推論]: マイホームロボへ送ったメールの記録（推定。反響一覧が読むだけで、書く処理は見当たらない）
- inquiry_date: 反響日（YYYY/MM/DD）
- medium: 媒体（例 ホームページ反響・タウンライフ・HOME'S・ALLGRIT・SUUMO・カゴスマ・持ち家計画）。販促媒体別の集計に使う
- response_medium: 反響元の詳細（フォームの「ご予約のきっかけ」など。ポータルは媒体と同じ）
- first_name: 姓。⚠️ 名前の列名と逆（first_name に姓、last_name に名）。過去の行がすべてこの形なので入れ替えない
- last_name: 名（ポータルの一部は空で、first_name に氏名まとめて入る）
- first_name_kana: 姓（カナ）
- last_name_kana: 名（カナ）
- mobile: 携帯番号（電話の種別が分からない取り込みもここに入れる）
- landline: 固定電話
- mail: メールアドレス
- line_id: LINE ID
- zip: 郵便番号
- pref: 都道府県
- city: 市区
- town: 町村
- street: 番地
- building: 建物名（ポータルの多くは住所をまとめてここに入れる）
- brand: ブランド（例 KH・DJH・JH・Nagomi・PG HOUSE・PGH・2L・KHG）
- shop: 担当店舗（ブランドの接頭辞＋店舗名。決まらないときは「<ブランド>店舗未設定」）。反響一覧で変えられる
- sync: 顧客DB に取り込んだか（0=未同期 1=取り込み済み）
- staff: 担当営業。反響一覧で変えられる
- area: 建築予定地・希望エリア（ポータルの建設予定地など）
- reserved_date: 来場希望日
- reserved_time: 来場希望時間
- black_list: 旧タグ（空白区切りの文字列）。⚠️ 2026-09-02 からは書かない（*_flag の列へ移した。元データとして残している）
- hp_campaign: ホームページのキャンペーン名（PG HOUSE 九州の資料請求は「資料請求」）
- delete_flag: 削除の印（1=削除済み。集計から外す）
- duplicate: 重複の印（以前の「<店舗> <媒体> 重複」の文。⚠️ 2026-09-02 の duplicate_flag とは別物）
- note: 社内の申し送り（ポータルの全項目の文が入る取り込みもある）
- utm_source: UTM パラメータ（source）
- utm_medium: UTM パラメータ（medium）
- utm_campaign: UTM パラメータ（campaign）
- utm_term: UTM パラメータ（term）
- utm_content: UTM パラメータ（content）
- referrer [推論]: 参照元（推定。今の受付は空で入れる）
- first_visit [推論]: 初回訪問（推定。今の受付は空で入れる）
- hotlead_url [推論]: HOTLEAD の管理画面の URL（推定。反響一覧が読む。今のコードに書く処理は見当たらない）
- url_params: フォームを送信したページの URL パラメータ（?以降）
- landing_params: 最後に見たパラメータ付きページの URL パラメータ（?以降）。トラッキング（khg_vid・gclid など）で広告の着地と結ぶ
- remarks: お客様の自由記述（フォームのご質問など）・メール本文
- category: 区分。※注文事業では使用しない（全行 NULL）
- property: 物件。※建売分譲事業では使用しない（注文では全行 NULL）
- duplicate_flag: 重複クリック（反響一覧のタグ）
- gift_flag: ギフト券進呈済み（反響一覧のタグ）
- support_flag: 業者（反響一覧のタグ）
- black_flag: ブラックリスト（反響一覧のタグ）
