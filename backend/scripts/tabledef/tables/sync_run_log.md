---
table: sync_run_log
title: 自動取り込みの実行結果
business: common
source: 改修
---
sync（Heroku の自動取り込み。projects/sync）や ② の取り込みの、1回の呼び出しの1タスクが1行（v2.2.259〜）。
書くのは ② の features/syncLog.ts（sync_log:write。sync が ② へ直接送る。ログイン無し・合い言葉 SYNC_LOG_SECRET）と、② の中の取り込み（hotlead など。route = '② hotlead'）。
読むのは ② sync_log_list（Master だけ）→ 画面「システム管理 → 同期の実行結果」（header/system/SyncLog.tsx）。
⚠️ 180日より古い行は ② が起動の5分後と毎日消す。⚠️ 以前は失敗をメールで送っていたが届かなくなったため、この表に移した。

## 列
- id: 連番（自動採番）
- run_id: 1回の呼び出しの ID（同じ呼び出しで流れたタスクは同じ値）
- route: 呼ばれた入口（/api/portal_kaeru・/api/add_event・/api/breakaway・/api/update・② hotlead など）
- task: タスク名（property・suumo_resale など。入口だけの処理は入口名）
- status: success＝成功・partial＝最後まで動いたが途中で失敗あり・failure＝止まった
- message: 一行の結果
- errors: 失敗の理由（JSON の文字列の配列。1件4000字・50件まで）
- started_at: 開始（日本時間）
- finished_at: 終了（日本時間）
- duration_ms: かかった時間（ミリ秒）
- created_at: 行を書いた日時（DB の時刻）
