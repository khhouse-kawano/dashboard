---
table: event_calendar
title: イベントカレンダー
business: order
source: 改修
---
集客イベント（見学会・フェアなど）の予定。1イベント＝1行。店舗ごとのイベントと、全社のイベント（shop = 'khg'）がある。
登録・変更は画面「イベントカレンダー」（calendar/Calendar.tsx。① handlers/calendar.php・calendar_add.php・calendar_change.php）。v2.2.299 からはフォーム作成（EventFormBuilder.tsx・② eventForm/admin.ts）でも全社のイベントを1行足す。
読むのはイベントカレンダー、フォーム作成（shop = 'khg' AND flag = 1）、顧客DB・架電状況（全社のイベントの一覧）、集客イベントの集計（eventSummary.ts・eventBudget.ts。title で予算・反響と突き合わせる）。
⚠️ 削除は行を消さず flag = 0 にする。一覧は flag = 1 だけ読む。
⚠️ 実績の人数は reserved_calendar に入る。この表の new・reserved・registered・next は使っていない（新しい行は 0）。

## 列
- id: 連番（reserved_calendar.event_id・event_form.calendar_id から指す）
- startDate: 開始日
- endDate: 終了日
- category [推論]: （推定）イベントの種類（event・event_even・openhouse・medium）。⚠️ 今の画面は空で登録する
- title: イベント名（例「住まいるフェスティバル2026_出水阿久根」）。集客イベントの集計は予算の note・反響の名前とこの値の完全一致で結ぶ
- shop: 店舗名（KH霧島店 など）。全社のイベントは khg。係（鹿児島1係 など）の行もある
- flag: 1 = 表示、0 = 削除済み
- new [推論]: （推定）旧版の実績「有効新規数」。今は reserved_calendar に入るので使っていない
- reserved [推論]: （推定）旧版の実績「新規来場者」。今は使っていない
- registered [推論]: （推定）旧版の実績「管理客」。今は使っていない
- next [推論]: （推定）旧版の実績「次アポ数」。今は使っていない
- note: メモ
- url: イベントのページの URL。フォーム作成で作ったときは、空ならフォームの URL を入れる
