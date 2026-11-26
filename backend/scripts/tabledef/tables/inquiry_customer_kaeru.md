---
table: inquiry_customer_kaeru
title: 建売の反響
business: spec
source: 改修
---
建売（かえるホーム）の反響一覧。1行＝反響1件（同じお客様でも反響ごとに行がある）。注文の inquiry_customer・中古の inquiry_customer_resale と同じ形。
書くもの：ポータル・ホームページの取り込み（① handlers/portal/*.php が元の表から INSERT IGNORE。資料請求 catalog_kaeru・来場予約 reserve_kaeru・会員登録 member_kaeru・先取物件 pre_kaeru・ALLGRIT allGrit_kaeru・HOME'S・at home）、SUUMO は ② features/suumoKaeru.ts（v2.2.263〜反響ごとに1行）、紹介・アンバサダー・キャンペーンのフォーム（② campaignForm など）。
読む・直すもの：反響一覧（ListKaeru.tsx・② features/list）。店舗・担当の割り振り、顧客タグ、顧客DBへの取り込み（sync＝1・pg_id）、個人情報削除（privacy.ts）。
⚠️ 取り込み先は PG CLOUD ではなく Dashboard の顧客台帳（master_data_kaeru）。pg_id は列名が残っているだけ。
⚠️ inquiry_id が一意（INSERT IGNORE の重複防止）。⚠️ inquiry_date は text で「YYYY/MM/DD」と「YYYY-MM-DD」が混在する。
⚠️ 事業をまたいだ重複の件数は inquiry_dup_key（brand = spec・src_id = id）にある。

## 列
- id: 連番（自動採番）
- inquiry_id: 反響ID。接頭辞で出どころが分かる（hp_member_・hp_reserve_・hp_catalog_kaeru_・hp_pre_＝ホームページ、suumo_act_＝SUUMO の反響ごと、suumo_＝SUUMO の顧客ごと（v2.2.263 より前）、allgrit_・athome_・homes_）。⚠️ 一意
- pg_id: 取り込んだ顧客の ID（master_data_kaeru.id）。取り込み前は空
- mhl_id [推論]: （推定）注文の反響サービスの ID。建売では空
- mhl_url [推論]: （推定）注文の反響サービスの URL。建売では空
- mhl_mail [推論]: （推定）注文の反響サービスのメール。建売では空
- inquiry_date: 反響日（text。「/」と「-」の書式が混在）
- medium: 反響元（例 ホームページ反響・SUUMO・ALLGRIT・athome・HOME'S）
- response_medium: 反響媒体（何を見て知ったか。例 Instagram・Web検索・SUUMO）。⚠️ medium と同じでポータルの接頭辞なら顧客台帳の portal_flag を立てる（② list/portal.ts）
- first_name: 氏名（ホームページ・ポータルの取り込みは姓名をまとめてここに入れる）。⚠️ 空の行は反響一覧に出ない
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
- brand: ブランド。「かえる」
- shop: 担当店舗（係名）。反響一覧で割り振る
- sync: 顧客DBに取り込んだか。1＝取り込み済み（個人情報削除でも 1 になる）
- staff: 担当営業。反響一覧で割り振る
- property: 問い合わせ物件
- area: 希望エリア①（来場予約・会員登録・ポータル）。先取物件では先取物件の名前
- area_2: 希望エリア②（会員登録）
- area_3: 希望エリア③（会員登録）
- school_area: エリアの補足（会員登録の area_notes）
- other_condition: その他の希望条件（会員登録）
- reserved_date: 来場予約・希望日
- reserved_time: 来場予約・希望時間
- black_list: 旧・顧客タグ（空白区切りの文字列。出現回数の偶奇で ON/OFF）。⚠️ 2026-09-02 から書かない。下の *_flag が正
- hp_campaign: ホームページのキャンペーン名（例 資料請求・会員登録・先取物件、来場予約はイベント名）
- delete_flag: 削除の印（1＝削除）
- duplicate: 反響一覧で #タグ として出す文字列（重複など）
- note: 反響の内容（フォームの全項目をつないだ文。SUUMO は先頭に「同じお客様の反響あり」「予約キャンセル」の印が付く）
- utm_source [推論]: 流入の utm_source。建売では空（注文のフォーム用）
- utm_medium [推論]: 流入の utm_medium。建売では空
- utm_campaign [推論]: 流入の utm_campaign。建売では空
- utm_term [推論]: 流入の utm_term。建売では空
- utm_content [推論]: 流入の utm_content。建売では空
- referrer [推論]: 参照元。建売では空
- first_visit [推論]: 初回訪問の日時。建売では空
- hotlead_url [推論]: 注文のホットリードの URL。建売では空
- remarks: ポータルの取り込みの備考（HOME'S・at home などの全項目）
- url: 問い合わせ物件の URL（HOME'S の取り込み）
- category: 取引区分。⚠️ 建売分譲事業では使わない（空）
- duplicate_flag: 顧客タグ「重複」（1＝ON）
- gift_flag: 顧客タグ「ギフト券進呈済み」
- support_flag: 顧客タグ「業者」
- black_flag: 顧客タグ「ブラックリスト」（登録の理由は black_list テーブルの備考に残る）
- landing_params: サイトでの閲覧と結びついた流入の情報（khg_vid など。v2.2.205）。取り込みで顧客台帳へ引き継ぐ
