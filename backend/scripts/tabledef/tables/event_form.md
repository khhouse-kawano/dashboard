---
table: event_form
title: イベントの予約フォーム
business: order
source: 改修
---
「集客イベント → フォーム作成」で作ったイベントの予約フォーム（v2.2.298）。1フォーム＝1行。id がそのまま公開 URL の番号（https://khg-marketing.info/form/<id>/）。
登録・更新は EventFormBuilder.tsx（request event_form の list・save。② features/eventForm/admin.ts）。
公開フォームは request event_form_public（表示）・event_form_entry（申し込み。event_db に id = ef<番号>_… で1行入れ、メールを2通送る。eventForm/public.ts）。
⚠️ 申し込みのイベント名と通知先は必ずこの表から取る（送られてきた値は使わない）。

## 列
- id: フォームの番号（公開 URL の番号）
- title: event_db.title に入れるイベント名（「開始日_イベント名」例 2026-12-06_○○フェア）。⚠️ 作ったときの写しなので、あとでカレンダー側を直してもここは変わらない
- calendar_id: event_calendar.id（v2.2.299）。⚠️ v2.2.298 で作ったフォームは NULL
- mail_to: 反響の通知先（カンマ区切り）。⚠️ 公開フォームには返さない
- mail_cc: 反響の通知の Cc（カンマ区切り）
- fields: 入力欄ごとの「表示・必須」（JSON の文字列。eventForm/fields.ts）。⚠️ 氏名・携帯電話・メールアドレスは常に表示・必須（② が決める）
- active: 1 = 受付中、0 = 受付を止めた
- created_by: 作ったスタッフ
- created_at: 作った日時
- updated_by: 最後に保存したスタッフ
- updated_at: 最後に保存した日時
