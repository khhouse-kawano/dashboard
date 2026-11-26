---
table: staff
title: ログイン権限（アカウント）
business: common
source: 改修
---
Dashboard にログインする人のアカウント。1行が1人。ログイン（login.php・Google 認証）、トークンの確認（② gateway/auth.ts・middlewares/auth.ts、① token.php）、権限・担当事業の判定に使う。
画面はヘッダーの「システム管理 → ログイン権限」（header/system/EditAuth.tsx。② staffAdmin.ts の header_edit_auth / header_auth_insert / header_auth_update）。
⚠️ 人事マスタの staff_list とは別の表で、連携していない（片方に登録してももう片方には入らない）。
⚠️ password・api_token の値は SELECT で返さない・画面に出さない（列を明示して読む。`SELECT *` 禁止）。
⚠️ 入場できない相談は、まず shop（担当事業）が空・想定外の値でないかを見る。

## 列
- id: 連番。staff_access_log.staff_id・kpi_analysis_history.staff_id などから参照される
- name: 氏名。⚠️ staff_list.name とは表記（空白の有無）が揃っていないことがある
- brand: 権限（店舗のブランドではない）。Master / BrandAdmin / Manager / ordinary / Consulting。ほかに insideSales（ISカレンダーの判定）・綴り違いの BrandAdimn・空が実データに残る。⚠️ 画面からは AUTH_BRANDS の値だけ保存できる
- shop: 担当事業（店舗名ではない）。order 注文 / spec 建売 / used 中古 / realty 不動産企画係 / all 全事業。⚠️ 空だとどの事業にも入れない（Category.tsx）。実データに construction もある
- mail: ログインのメールアドレス。⚠️ 重複させない（login.php がメールだけで本人を決める）
- password: パスワード。⚠️ 値は見ない。Google 認証へ移行後は読む処理なし。新しく書くときは bcrypt のハッシュ（古い行は平文のまま残る）
- api_token: ログイン中のトークン。⚠️ 値は見ない・返さない。ログインで発行、ログアウトで空にする（logout.php）
- timestamp: 最後にトークンを確かめた日時（get_token。画面を移るたびに書く）
- url: get_token のときに開いていた画面の URL
- heartbeat: 最後に在席の合図が届いた日時（20秒ごと。② accessLog.ts の heartbeat、予備は ① heartbeat.php）。オンラインの表示に使う
- log: 以前のアクセス記録（JSON の配列。{time,…}）。⚠️ v2.2.266 から書き足していない（今の記録は staff_access_log）。合計で数百MB あるので一覧で読まない。総アクセス時間の計算（header_auth_access_time）だけが1人ずつ読む
- flag: 1 = 有効。② staff.ts の一覧は flag = 1 だけを返す。画面から作ると 1
- check_daily_action: 注文営業の「要確認」モーダルで「確認しました」を押した日。今日なら出さない。NULL は一度も押していない（daily_action）
- last_login_at: 最後にログインした日時（v2.2.242）
- last_logout_at: 最後にログアウトした日時（v2.2.242）
