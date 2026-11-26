---
table: staff_access_log
title: 画面のアクセス記録
business: common
source: 改修
---
だれがどの画面をいつ開いたかの記録（v2.2.266。backend/scripts/sql/2026-11-13_staff_access_log.sql）。1行が「1人が1つの画面を開いた1回」。
② accessLog.ts が書く：画面を移ったとき access_log:open で1行足し、20秒ごとの heartbeat で last_seen_at を進める（呼ぶのは ActiveUser.tsx）。
画面はヘッダーの「システム管理 → アクセス記録」（access_log_list。Master だけ）。
⚠️ 同じ人が同じ画面を3秒以内にもう一度開いたら同じ行とみなす。⚠️ 13か月より古い行は ② が毎日消す。
⚠️ 日時は日本時間を ② で作って書く（DB の NOW() は使わない）。

## 列
- id: 連番（heartbeat の access_id）
- staff_id: staff.id
- staff_name: 開いた時点の staff.name
- authority: 開いた時点の権限（staff.brand。Master / BrandAdmin / ordinary など）
- division: 開いた時点の担当事業（staff.shop。order / spec / used / all）
- path: 開いた画面（/company など）。⚠️ ? と # から後ろは残さない（お客様の ID が入ることがあるため）
- opened_at: 開いた日時
- last_seen_at: 最後に heartbeat が届いた日時。NULL は 20秒以内に離れた
- ip: 接続元（① を経由したときは ① が渡した値）
- user_agent: 端末（ブラウザ）
