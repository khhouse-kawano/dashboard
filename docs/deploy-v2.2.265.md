# デプロイ手順 v2.2.265　広告運用の担当者向けの読み出し API

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `GET /api/export/tracking/touches`・`/conversions`（鍵で認証。読むだけ） | ② VPS（backend-express） |
| 2 | 鍵の環境変数 `TRACKING_EXPORT_KEYS` | ② VPS の `.env.prod` |
| 3 | 版の表示 2.2.265 | ① フロント（Dashboard） |
| 4 | 更新履歴 | ① DB `backend/scripts/sql/2026-11-13_update_log_2.2.265.sql` |

- ⚠️ ① の PHP・DB の表・画面は変わりません。
- エンジニアに渡す仕様書：`docs/api-tracking-export.md`

## 順序
```
0. GitHub で v2.2.265 を production へマージ（PR）
1. ② VPS：鍵を作って .env.prod に入れる → git pull → 作り直し
2. ① Dashboard のフロント（npm run build）
3. ① SQL：2026-11-13_update_log_2.2.265.sql      ← ⚠️ 1回だけ
```

### 手順1　【② VPS】
```bash
cd ~/dashboard && git pull

# 鍵を作る（使う人・ツールの数だけ。1つ64文字）
openssl rand -hex 32
```
`.env.prod` に1行足します（複数ならカンマでつなぐ。⚠️ 値はチャットやメールの本文に貼らない）。
```
TRACKING_EXPORT_KEYS=<作った鍵>
```
```bash
dcp up -d --build express-api
dcp ps express-api
```
- `STATUS` が `Up` で、数十秒たっても `Up` のままならよいです（`Restarting` なら `dcp logs --tail 60 express-api` で理由を見る）。
- ⚠️ `dcp` を使うこと（`--env-file .env.prod` を含む）。`docker compose -f docker-compose.prod.yml` だけで作り直すと DB の設定が渡らず、② が起動しません。

### 手順3　【① SQL】
phpMyAdmin で `2026-11-13_update_log_2.2.265.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.265 で、1行だけならよいです。

## 終わったら（動作確認。② VPS か手元の PC で）
```bash
# 鍵なし → 401
curl -s -o /dev/null -w '%{http_code}\n' https://api.khg-marketing.info/api/export/tracking/touches

# 鍵あり → 200 と JSON（シェルの履歴に鍵を残さないよう、read で入れる）
read -s KHG_TRACKING_KEY && export KHG_TRACKING_KEY
curl -s -H "Authorization: Bearer $KHG_TRACKING_KEY" 'https://api.khg-marketing.info/api/export/tracking/touches?limit=2'
curl -s -H "Authorization: Bearer $KHG_TRACKING_KEY" 'https://api.khg-marketing.info/api/export/tracking/conversions?limit=2'

# ② のログに目印が出る（鍵そのものは出ない）
dcp logs --since 10m express-api | grep "tracking export"
```
- 1つ目が `401`、2つ目・3つ目が `{"data":[…],"count":2,"next_after_id":…,"has_more":true}` ならよいです。
- 鍵を設定し忘れると、② のログに `TRACKING_EXPORT_KEYS が無いので、すべて 401 にします` が出ます。
- Dashboard の版の表示が ver2.2.265

## 鍵を渡す・止める
- 渡すとき：パスワードの共有の仕組みなどで、1人（1ツール）に1つ。仕様書 `docs/api-tracking-export.md` と一緒に渡す。
- 止める・入れ替える：`.env.prod` から消して（新しい鍵を足して）`dcp up -d express-api` → `dcp ps express-api`。詳しくは仕様書の「管理者向け」。

## 切り戻し
- ② を前の版に戻すと、この API は 404 になります（ほかの機能は変わりません）。`.env.prod` の `TRACKING_EXPORT_KEYS` は残しても害はありません。

## 知っておくこと
- `email_hash`・`tel_hash`（メール・電話の SHA-256）も渡します。電話番号は総当たりで元に戻せるので、受け取る側にも個人情報として扱ってもらう必要があります（仕様書に書いてあります）。
- 期間・件数の上限はありません。全件（着地 約13万件）を一度に取ると約100MB です。回数は同じ IP から1分に60回までです。
