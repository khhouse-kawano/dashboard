---
table: resale_customers
title: 中古リノベの旧顧客一覧
business: used
source: 推論
---
（推定）中古住宅専門店が以前使っていた顧客管理（Dashboard より前のシステム）から取り込んだ顧客一覧。1行＝顧客1人（約3,500件。登録日は 2022-07〜2026-04）。shop はほぼすべて「国分ハウジンググループ中古住宅専門店」。
コードからの使用箇所なし（推定：master_data_resale へ移す前の元データ。開発用の個人情報の伏せ字 SQL（backend/scripts/sql/dev/mask_personal_info.sql）だけが触る）。
⚠️ category・action・budget は JSON（配列やオブジェクト）の文字列。⚠️ 2026-04 で更新が止まっている（推定）。

## 列
- no: 連番（自動採番）
- id_action: （推定）旧システムの対応履歴の ID
- staff: 担当営業
- shop: 担当店舗（ほぼ「国分ハウジンググループ中古住宅専門店」）
- id_related: （推定）旧システムの関連 ID
- name: お名前
- kana: フリガナ
- estate_name_1: （推定）関係する物件名①
- category: （推定）区分の一覧（JSON 配列）
- response: 反響の手段（例 ネット・メール・電話・来店・チラシ）
- medium: 反響媒体（例 中専HP(会員登録/ネット検索)・イエウール・SUUMO・折込チラシ）。「中専HP」は中古住宅専門店のホームページ
- case: 取引の区分（例「買:-」「売：中古一戸建」「仮:-」。書式の揺れがある）
- id_case: （推定）旧システムの案件 ID
- status: 追客の状況（例 追客終了・追客中・接触（通電・訪問）・来店あり・買付・リフォーム契約）
- mail: メールアドレス
- zip: 郵便番号
- address: 住所
- phone: 電話番号
- registered: 登録日時（YYYY/MM/DD HH:MM）
- reserved: （推定）来場予約・来店の日
- contract: （推定）契約日
- action: （推定）対応履歴（JSON 配列）
- budget: （推定）予算・資金の内訳（JSON）
- total: （推定）総額（万円）
- property: （推定）物件価格（万円）
- broker: （推定）仲介手数料（万円）
- renovation: （推定）リフォーム費用（万円）
- profit: （推定）粗利（万円）
- other: （推定）その他の費用（すべて 0）
- rank: 顧客ランク（S・A〜G。ほとんど空）
- flag: （推定）旧システムで「存在する」の印（exist か空）
