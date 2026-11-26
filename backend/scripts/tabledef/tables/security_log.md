---
table: security_log
title: セキュリティログ
business: common
source: 改修
---
ログイン・ログアウト・認証の失敗・権限の不足・存在しない request・500/502 などの出来事が1行（v2.2.242〜）。
書くのは ① backend/src/core/security_log.php と ② backend-express/src/features/securityLog.ts。読むのは ② security_log_list（Master だけ）→ 画面「システム管理 → セキュリティログ」（header/system/SecurityLog.tsx）。
⚠️ 失敗の連打（auth_failed・forbidden・bad_request・unknown_request・auth_missing）は「同じ種類・同じ IP・同じ request・同じ人・同じ1分」を1行にまとめ、count を数える。ログイン・500・502 などはまとめない。
⚠️ 180日より古い行は、書くとき（ときどき）と一覧を開いたときに消す。⚠️ message にパスワード・トークン・メールアドレス・お客様の情報を入れない。⚠️ ① と ② でまとめ方・列の長さを揃える。

## 列
- id: 連番（自動採番）
- occurred_at: 最初に起きた日時（まとめた行は、その1分の最初）
- last_at: 最後に起きた日時（まとめた行で count が増えると更新）
- count: まとめた件数
- server: php（①）/ express（②）
- event: login / login_failed / logout / auth_failed / forbidden / bad_request / unknown_request / server_error / proxy_error / auth_missing（v2.2.272〜。① だけ。トークン無しで通した）
- status: 返した HTTP ステータス
- request: request（② の存在しないパスはパス）
- roll: request の roll（処理の種類）
- staff_id: 操作した人（staff.id）。分からなければ NULL
- staff_name: 操作した人の名前
- ip: 接続元（② では ① から渡された値）
- via_ip: 直接つないできた相手（① を経由したとき ① の IP。ip と違えば中継されている）
- user_agent: ブラウザなどの User-Agent
- path: どの画面から（Referer のパス）
- message: 補足の一行（例: ログインの失敗の理由）
- bucket: まとめる行の鍵（SHA1）。まとめない行は NULL。一意
