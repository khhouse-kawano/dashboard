---
table: before_interview
title: 面談前アンケートの回答
business: order
source: 改修
---
来場したお客様が面談の前に答えるアンケート（survey の面談前）。1行＝1回答。
書くのは ② survey/public.ts の面談前の保存（認証なし。旧 /survey/api/ の before_interview を移したもの）。同じ回答が30分以内にあれば2行目は入れない。
リンクの署名が正しく既存のお客様なら、あわせて customers.before_interview = 1 にし、master_data の連絡先・希望（25列）を更新する。新規のお客様（id = 'new'）は、あとで同期サービス（projects/sync）が name・shop で探す。
⚠️ 回答の行はいつも残す（上書きしない）。⚠️ 複数選択の値は「, 」区切り（master_data へは「,」区切りで写す）。

## 列
- no: 連番（自動採番）
- id: 顧客ID（master_data.id）。新規のお客様は 'new'
- name: お名前（前後の空白もそのまま。sync が名前で探すため）
- shop: 来場した店舗
- medium: 何でお知りになったか（複数選択。master_data.inquiry_reason へ写す）
- interest: 興味を持った理由（複数選択。master_data.customer_desired_order へ写す）
- opportunity: 検討のきっかけ（複数選択。master_data.house_hunting_motivation へ写す）
- plan: 新築計画（master_data.customer_desired_floor へ写す）
- period: 入居希望時期（master_data.customer_desired_period へ写す）
- estate: 土地の状況（master_data.customer_desired_estate へ写す）
- area: 建築希望地（master_data.planned_construction_site へ写す）
- importance: 重視すること（複数選択）
- budget: 予算（master_data.budget へ写す）
- support [推論]: （推定）相談したいこと・希望するサポート（複数選択）
- demand: ご要望（自由記述）
- kana: ふりがな
- phone: 電話番号
- mail: メールアドレス
- mobile: 携帯電話番号
- zip: 郵便番号
- address: 住所
- rent: 現在の家賃
- birth: 生年月日
- situation: 現在のお住まい（master_data.current_contract_type へ写す）
- family_member_1: 家族①（JSON の文字列）
- family_member_2: 家族②（JSON の文字列）
- family_member_3: 家族③（JSON の文字列）
- family_member_4: 家族④（JSON の文字列）
- employment: 勤務先（type・name・address・years・income を持つ JSON の文字列。master_data の勤務先・年収の列へ写す）
- created_at: 回答日時（日本時間）
