---
table: customers
title: 旧顧客一覧（注文）
business: order
source: 改修
---
注文住宅の顧客の旧い一覧（スプレッドシート時代の形と推定）。1行＝1顧客。id は master_data.id と同じ値。
⚠️ 2026-07-22 を最後に中身が更新されていない（docs/deploy-v2.2.270.md）。顧客の正は master_data。v2.2.270 で面談アンケートのお客様検索も master_data に切り替えた。
今も書くのは2か所だけ。反響の取り込み（sync → inquiry_update:new_customer。無いときだけ master_data と一緒に1行入れる）と、面談前・面談後アンケートの回答（survey/public.ts が before_interview・after_interview を 1 にする）。
⚠️ trash 以外の列は NOT NULL で既定値が無い。行を入れるときは全列を書く（inquiryUpdate.ts の CUSTOMERS_COLUMNS。① inquiry_update.php と同じ内容にそろえる）。
多くの列はコードで読んでいないので、意味は列名と値から推している。

## 列
- no: 連番（自動採番）
- id: 顧客ID（master_data.id と同じ）
- name: 顧客名
- date [推論]: （推定）反響・登録の日時
- status: 顧客の状態（見込み / 会社管理 / 失注 / 重複 / 契約済み）
- rank [推論]: ランク（Aランク〜Eランク）
- rank_period [推論]: ランクの見込み時期
- register [推論]: （推定）反響日
- reserve [推論]: （推定）来場予約日
- shop: 担当店舗
- staff: 担当営業
- medium [推論]: 反響媒体
- estate [推論]: 土地の有無（有 / 無）
- place [推論]: （推定）建築予定地・希望地
- budget [推論]: 予算
- loan [推論]: （推定）借入・ローンの状況
- repayment [推論]: （推定）月々の返済額。全件空
- contract [推論]: （推定）契約日
- meeting [推論]: （推定）面談日。全件空
- rank_history [推論]: ランクの履歴（「日付:ランク」の連なり）
- section: 担当の営業課
- appointment [推論]: （推定）次回アポの日付
- second_reserve [推論]: （推定）2回目の来場予約日
- line_group [推論]: （推定）LINEグループ作成日
- screening [推論]: （推定）事前審査日
- rival [推論]: （推定）競合
- period [推論]: （推定）入居希望時期
- survey [推論]: （推定）面談時のヒアリングメモ
- importance [推論]: （推定）重視項目
- note [推論]: 備考
- sales_meeting [推論]: （推定）営業会議でのランク・状態の記録（「日付 ランク」など）
- before_survey: 1 = 事前アンケートの回答あり
- before_interview: 1 = 面談前アンケートの回答あり（survey/public.ts が入れる）
- after_interview: 1 = 面談後アンケートの回答あり（survey/public.ts が入れる）
- call_status [推論]: 架電状況
- reserved_status [推論]: （推定）来場予約の日付（YYYY-MM-DD）
- phone_number: 電話番号
- full_address: 住所
- zip: 郵便番号
- lat_lng [推論]: 住所の緯度経度
- response_status [推論]: （推定）反響の種類・媒体（ホームページ反響 / タウンライフ / HOME'S など）
- campaign [推論]: （推定）HP のキャンペーン名
- trash [推論]: （推定）表示の印。ほぼ全件 1（master_data.show_dashboard と同じく 1 = 表示と推定）
- cancel_status [推論]: 来場キャンセルの理由
- ice_world [推論]: ぶるぶるアイスワールドの利用予約日時
- gift [推論]: （推定）ギフト進呈の印。全件空
