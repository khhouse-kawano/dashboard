---
table: nexus
title: Nexus 連携の顧客の写し
business: order
source: 推論
---
（推定）Nexus（自社の別システム）へ連携・移行した注文住宅の顧客の一覧。1行が1人。列名は顧客DB（master_data）と同じ。
コードからの使用箇所なし（推定：2025/7/14 に一度だけ顧客DB から書き出した写し。画面の「Nexus」の印は frontend/src/utils/nexusUtils.ts が顧客DB の値から判定しており、この表は読まない）。
144件すべてが同じ日時で、141件は顧客DB の id と一致する。
⚠️ 個人情報を含む。使わないなら整理の対象（推定）。

## 列
- id: 顧客の id（master_data.id と同じ ULID）
- date: 書き出した日時（全行 2025/7/14）
- customer_contacts_name: 顧客名
- in_charge_store: 担当店舗
- in_charge_user: 担当営業
- reaction_date: 反響日
- first_interviewed_date: 初回面談日
- full_address: 住所
- sales_promotion_name: 販促媒体
- status: 状況（例 見込み・重複・失注）
- category: 事業（全行「注文」）
- has_owned_land: 土地の有無
- customer_contacts_name_kana: 顧客名のフリガナ
- customer_tags: 顧客のタグ
- customized_input_01J82Z5F366ZQ897PXWF6H5ZAM: 顧客ランク（master_data の同じ列。② の顧客DB では rank の別名で読む）
- customer_contacts_phone_number: 電話番号（固定）
- customer_contacts_mobile_phone_number: 携帯番号
- customer_contacts_email: メールアドレス
- customer_contacts_gender: 性別
- customer_contacts_count: （推定）連絡先の数
- brand: ブランド（例 国分ハウジング・デイジャストハウス・なごみ工務店・PG HOUSE・ニーエルホーム）
