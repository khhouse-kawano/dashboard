---
table: reserved_calendar
title: イベントカレンダーの実績
business: order
source: 改修
---
イベントカレンダーで入れる実績の人数。店舗×イベント×日×区分＝1行。
書くのはイベントカレンダーの実績の入力（calendar/Calendar.tsx → ① handlers/calendar_change.php の roll response_change。core/calendar.php の calendarSaveReserved）。読むのも同じ画面（店舗表示の合計など）。
⚠️ 一意キーが無い。書くときは shop・event・date・category で先に探し、あれば UPDATE・無ければ INSERT（影響行数で判断すると二重になる）。
⚠️ event_id はほとんど 0。イベントとの突き合わせは店舗・イベント名・日付で行う。

## 列
- id: 連番
- event_id: event_calendar.id。⚠️ ほとんど 0（常設イベントなどカレンダーに無い行もある）
- shop: 店舗名
- event: イベント名（event_calendar.title。常設の「常設EV・モデル見学」もある）
- date: 実績の日。⚠️ 0000-00-00 の行がある
- count: 人数
- category: 区分。reserved＝新規来場者、new＝有効新規数、next＝次アポ数、registered＝管理客（title・空の行も少しある）
