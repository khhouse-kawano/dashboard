# デプロイ手順 v2.2.267　HOTLEAD の取り込みを ② VPS から

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | HOTLEAD の追客情報を ② が30分ごと（:00・:30）に取り込み、① の `hotlead` へ送る（KH・DJH の2アカウント）。結果は「ポータル連携ログ」に出る | ② VPS（backend-express） |
| 2 | HOTLEAD の認証情報 `HOTLEAD_ID`・`HOTLEAD_PASS`・`HOTLEAD_ID_2`・`HOTLEAD_PASS_2` | ② VPS の `.env.prod` |
| 3 | sync の定期の呼び出しから `hotlead`・`hotlead_2` を外す | sync を呼んでいる側（利用者） |
| 4 | 版の表示 2.2.267 | ① フロント（Dashboard） |
| 5 | 更新履歴 | ① DB `backend/scripts/sql/2026-11-13_update_log_2.2.267.sql` |

- ⚠️ ① の PHP（hotlead.php）・DB の表・画面は変わりません。
- ⚠️ HOTLEAD の管理画面で、許可する IP に **162.43.5.127**（② VPS）を登録しておくこと。

## 順序
```
0. HOTLEAD に 162.43.5.127 を登録 ／ GitHub で v2.2.267 を production へマージ（PR）
1. ② VPS：.env.prod に HOTLEAD_* → fetch・checkout → 作り直し
2. sync の呼び出しから hotlead・hotlead_2 を外す
3. ① Dashboard のフロント（npm run build）
4. ① SQL：2026-11-13_update_log_2.2.267.sql      ← ⚠️ 1回だけ
```

### 手順1　【② VPS】
`.env.prod` に4行足します。値は Heroku（sync）の Config Vars の同じ名前の値と同じです（⚠️ 値をチャットやメールに貼らない）。
```
HOTLEAD_ID=…
HOTLEAD_PASS=…
HOTLEAD_ID_2=…
HOTLEAD_PASS_2=…
```
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
git log -1 --oneline
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
dcp ps express-api
dcp logs express-api | grep hotlead
```
- `git log` が v2.2.267 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ログに `hotlead: 自動取り込みを始めます（30分ごと。アカウント hotlead・hotlead_2）` が出ればよいです。
  - `HOTLEAD_ID / HOTLEAD_PASS が無いため` が出たら、`.env.prod` の名前・値を見直して `dcp up -d express-api` をやり直す。
- ⚠️ `git pull` は使わない（VPS はブランチに付いていない形なので失敗し、古いコードのまま作り直される）。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順2　【sync を呼んでいる側】
30分ごとに sync（`/api/portal` か `/api/portal_kaeru`）を呼んでいる仕組みの `targetTasks` から、`hotlead` と `hotlead_2` を外します。
- 外さないと、sync からも HOTLEAD を呼び、IP の制限で失敗が記録され続けます（② の取り込みには影響しません）。

### 手順4　【① SQL】
phpMyAdmin で `2026-11-13_update_log_2.2.267.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```

## 終わったら（動作確認）
次の :00 か :30 を過ぎてから。
```bash
dcp logs --since 40m express-api | grep hotlead
```
- `hotlead: hotlead N件（新規 …・更新 …・失敗 0）` と `hotlead_2 …` が出ればよいです。
- 「システム管理 → ポータル連携ログ」で、タスク `hotlead`・`hotlead_2` の入口が `② hotlead` の行が成功になっている。
- 失敗のときは、ポータル連携ログの「理由を見る」で確かめる（例：`トークンを取れませんでした（401）` → 認証情報、`チケットを取れませんでした（403）` → IP の登録）。

## 切り戻し
- ② を前の版に戻すと取り込みは止まります。sync の呼び出しに `hotlead`・`hotlead_2` を戻せば、以前の形に戻ります（ただし IP の制限が始まっていれば sync からは失敗します）。

## 知っておくこと
- 1回の取り込みは、その日（日本時間）に更新されたチケットをすべて ① へ送り直します（以前の sync と同じ。① の hotlead.php が新規・更新を判断する）。
  - ⚠️ 以前は Heroku の時計（UTC）で「今日」を決めていたため、日本時間の 0〜9時は前日の分を取っていました。② では日本時間の今日です。
- ② を落とさない作り：通信はすべて時間切れ（30〜60秒）で打ち切る、前の回が終わっていなければ次の回は飛ばす、1件の失敗で止めない、例外を外に出さない、認証情報が無ければ何もしない。
- ② を再起動した直後には取り込みません（次の :00・:30 から）。
