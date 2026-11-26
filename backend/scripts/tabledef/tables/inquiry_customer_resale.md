---
table: inquiry_customer_resale
title: 中古リノベの反響
business: used
source: 改修
---
中古リノベ（国分ハウジンググループ中古住宅専門店）の反響一覧。1行＝反響1件。注文の inquiry_customer・建売の inquiry_customer_kaeru と同じ形に category（取引区分）がある。
書くもの：ポータル・ホームページの取り込み（① handlers/portal/*.php が元の表から INSERT IGNORE。資料請求 catalog_resale・来場予約 reserve_resale・会員登録 member_resale・カエール kaeeru_db・すまいステップ・イエウール・イエイ・SUUMO・HOME'S・at home）、紹介・アンバサダー（② inquirySync.ts）。
読む・直すもの：反響一覧（ListResale.tsx・② features/list）。店舗・担当の割り振り、顧客タグ、顧客DBへの取り込み（master_data_resale。sync＝1・pg_id）、個人情報削除、要確認（dailyAction.ts の中古の未同期は category = 買い:中古リノベ だけ数える）。
⚠️ inquiry_id が一意（INSERT IGNORE の重複防止）。⚠️ inquiry_date は text。
⚠️ 事業をまたいだ重複の件数は inquiry_dup_key（brand = used・src_id = id）にある。

## 列
- id: 連番（自動採番）
- inquiry_id: 反響ID。接頭辞で出どころが分かる（hp_catalog_・hp_member_・hp_resale_＝ホームページ、kaeeru_assess_＝カエール、sumai・ieuru・iei・athome・suumo・homes＝各ポータル）。⚠️ 一意
- category: 取引区分（買い:中古リノベ／売り:ポータル／買い:ポータル）。取り込みで顧客台帳の in_charge_store・category に入る。⚠️ ホームページの反響は 買い:中古リノベ、査定サイト（カエールなど）は 売り:ポータル
- pg_id: 取り込んだ顧客の ID（master_data_resale.id）。取り込み前は空
- mhl_id [推論]: （推定）注文の反響サービスの ID。中古では空
- mhl_url [推論]: （推定）注文の反響サービスの URL。中古では空
- mhl_mail [推論]: （推定）注文の反響サービスのメール。中古では空
- inquiry_date: 反響日（text）
- medium: 反響元（例 ホームページ反響・すまいステップ・イエウール・athome・SUUMO・HOME'S・イエイ・カエール）
- response_medium: 反響媒体（何を見て知ったか。ご予約のきっかけ など）
- first_name: 氏名（取り込みは姓名をまとめてここに入れる）。⚠️ 空の行は反響一覧に出ない
- last_name: 姓（取り込みによっては空）
- first_name_kana: ふりがな
- last_name_kana: ふりがな（姓。取り込みによっては空）
- mobile: 電話番号（携帯。電話の項目が1つのフォームはここに入れる）
- landline: 電話番号（固定）
- mail: メールアドレス
- line_id: LINE ID
- zip: 郵便番号
- pref: 都道府県
- city: 市区町村
- town: 町名
- street: 番地
- building: 建物名。⚠️ ホームページ・ポータルの取り込みは住所全体をここに入れる
- brand: ブランド。「中古住宅専門店」
- shop: 担当店舗。反響一覧で割り振る
- sync: 顧客DBに取り込んだか。1＝取り込み済み
- staff: 担当営業。反響一覧で割り振る
- property: 問い合わせ物件
- area: エリア（カエールは査定物件の所在地）
- reserved_date: 来場予約・希望日
- reserved_time: 来場予約・希望時間
- black_list: 旧・顧客タグ（空白区切りの文字列）。⚠️ 2026-09-02 から書かない。下の *_flag が正
- hp_campaign: キャンペーン名（例 資料請求・会員登録・カエール、来場予約はイベント名）
- delete_flag: 削除の印（1＝削除）
- duplicate: 反響一覧で #タグ として出す文字列（重複など）
- note: 反響の内容（フォームの全項目をつないだ文。カエールは査定の種別・面積・現況などをつないだ文）
- utm_source [推論]: 流入の utm_source。中古では空（注文のフォーム用）
- utm_medium [推論]: 流入の utm_medium。中古では空
- utm_campaign [推論]: 流入の utm_campaign。中古では空
- utm_term [推論]: 流入の utm_term。中古では空
- utm_content [推論]: 流入の utm_content。中古では空
- referrer [推論]: 参照元。中古では空
- first_visit [推論]: 初回訪問の日時。中古では空
- hotlead_url [推論]: 注文のホットリードの URL。中古では空
- remarks: ポータルの取り込みの備考（全項目）
- url: 問い合わせ物件の URL（ポータルの取り込み）
- duplicate_flag: 顧客タグ「重複」（1＝ON）
- gift_flag: 顧客タグ「ギフト券進呈済み」
- support_flag: 顧客タグ「業者」
- black_flag: 顧客タグ「ブラックリスト」
