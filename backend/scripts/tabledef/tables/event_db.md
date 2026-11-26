---
table: event_db
title: 集客イベントの来場予約
business: order
source: 改修
---
集客イベントの来場予約（反響）。1予約＝1行。イベントは title で分ける（住まいるフェスティバル・おうちづくりフェスタ2026・フォーム作成のイベントなど）。
書くのは公開の予約フォーム：フェスタの LP（② features/event/reservation.ts。id = festa2026_＋16文字をブラウザが採番）、フォーム作成のフォーム（eventForm/public.ts。id = ef<フォーム番号>_＋16桁）。
読む・直すのは「集客イベント」の反響一覧（EventList.tsx・FestaDashboard.tsx。request list の event。② list/event.ts）、受付の QR 読み取り（event/checkin.ts）、集客イベントの集計（eventSummary.ts）。
⚠️ 氏名・連絡先以外は来場者本人が入力した原本。社内で直せるのは name・phone・mail・kana・check_in_time・check_out_time・remarks・staff・sync だけ（list/event.ts の ALLOWED_COLUMNS）。
⚠️ id は UNIQUE（uk_event_db_id）。

## 列
- no: ユニークNo（連番）
- id: 予約ID（festa2026_… / ef<番号>_… / 古いイベントは接頭辞なしの16文字）。受付の QR に入る
- time: 来場希望時間
- date: 来場希望日
- name: お名前
- kana: ふりがな（2026-09-07 追加。古い予約は NULL）
- zip: 郵便番号
- address: 住所（都道府県・市区・町村）
- street: 住所（番地・建物名）
- phone: 携帯電話
- age: 年代（26～30歳代 などの選択肢）
- adult: 来場人数（大人）
- child: 来場人数（子ども）
- house: 現在のお住まい
- interview: 相談内容（カンマ区切り）
- request: マイホームのご検討。⚠️ interview と同じくカンマ区切りで複数保存する
- medium: ご予約のきっかけ
- area: 建築希望エリア
- site: 建築予定地（v2.2.298 フォームから）
- question: 事前にお聞きしたいこと
- agree: 個人情報の取り扱いへの同意。1=同意。⚠️ NULL は同意欄が無かった頃の予約
- reserved_at: 予約を受け付けた日時。⚠️ 公開フォーム経由の反響を時系列で追うために使う
- status: ステータス。non-reserve＝当日来場（予約なし。来場済みとして保存）。それ以外は空・NULL
- check_in_time: チェックイン時間（YYYY/MM/DD HH:MM:SS の文字列）。受付の QR 読み取りで入る。反響一覧の「来場状況」はこれで決まる
- check_out_time: チェックアウト時間
- remarks: ※備考欄（社内メモ）
- staff: 担当スタッフ（反響一覧で入力。v2.2.171）
- festa: おうちづくりフェスタ2026 の営業入力（JSON。キーごとに JSON_SET で書く）
- shop: 店舗名。⚠️ フェスタでは顧客に同期した店舗をカンマ区切りで足していく（sync_shop）。他のイベントでは「イベントの店舗」
- title: イベント名（フォーム作成のイベントは「開始日_イベント名」）
- sync: 同期。1 = 顧客に取り込み済み（行の色・反響一覧の「同期済み」）
- mail: メールアドレス
