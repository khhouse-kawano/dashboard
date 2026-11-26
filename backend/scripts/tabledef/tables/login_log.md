---
table: login_log
title: ログインの記録（旧）
business: common
source: 改修
---
Dashboard にログインした1回が1行。① の handlers/login.php がログインのたびに書く（2025-05 から）。
⚠️ 書くだけで、読む画面・処理は無い。request 'login_log'（ActiveUser.tsx）の名前は同じだが、読むのは staff.heartbeat で、この表ではない。
⚠️ 列がすべて text で、日時も文字列。ログインの記録を見るなら security_log（event = login。v2.2.242〜）のほうが詳しい。

## 列
- id: 連番（自動採番）
- timestamp: ログインした日時の文字列（'YYYY/MM/DD HH:MM'。① のサーバーの時刻）
- staff: ログインした人の名前（staff.name）
