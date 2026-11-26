---
table: inquiry_ambassador
title: アンバサダー経由の反響
business: common
source: 改修
---
Instagram 公式アンバサダーの紹介ページ（kh-house.jp/ambassador/?id=<アンバサダーの no>）から届いた反響。1行が1件の反響。
受付：公開フォームが ② の request ambassador_inquiry（features/ambassador/inquiry.ts）へ直接送る。ログイン無しの書き込み口なので、値は信用せず長さを切り、流量を制限する（middlewares/publicFormRateLimit.ts）。保存のあとお客様へのお礼と社内への通知のメールを送る。
画面：アンバサダーの反響（header/ambassador/InquiryAmbassador.tsx）。② の ambassador（features/ambassador/index.ts）が一覧・担当の割り当て・顧客DB への取り込み（同期）を扱い、kpi.ts が集計する。
取り込み先は division で決まる（注文 master_data／建売 master_data_kaeru／中古 master_data_resale）。
⚠️ ② だけの機能（① に PHP は無い）。② が止まると画面も受付も動かない。
⚠️ 受付では shop・staff・sync・master_data_id を受け取らない（同期済みに偽装されないように）。

## 列
- no: 連番（自動採番）
- ambassador_no: 紹介したアンバサダー（ambassador_list.no）
- ambassador_id: アンバサダーの id
- name: 氏名
- kana: ふりがな
- zip: 郵便番号
- address: 住所
- build_area: 建築希望地
- message: ご質問やご要望（任意入力。顧客本人が記入）
- mobile: 電話番号
- mail: メールアドレス
- account: インスタグラムアカウント（反響時点の値）
- shop: 担当店舗（社内で割り振る）
- staff: 担当営業（社内で割り振る）
- inquiry_date: 反響日
- sync: 同期状況。0=未同期 1=同期済み
- division: 事業区分。注文／建売／中古。同期先のテーブルが変わる
- agreed: 進呈条件への同意。1=同意 0=未同意
- mail_sent: 顧客宛サンクスメール。1=成功 0=失敗 NULL=未送信
- notify_sent: 社内宛通知メール。1=成功 0=失敗 NULL=未送信
- master_data_id: 同期で作成した顧客の id（ULID。どの表かは division を見る）
