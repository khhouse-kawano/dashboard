# デプロイ手順 v2.2.206（PHP から ② へ寄せる 段階0：ログインの古い経路の削除・K-SNAP の書き込みを ② へ）

⚠️ v2.2.205 は main にマージ済み。このブランチは main から切ってある。
⚠️ 計画の全体は `docs/plan-2026-10-21-php-to-express.md`。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ログイン：Google の本人確認を通らないログインを 401 に（メールアドレスだけで入れる古い経路を削除） | ① PHP `backend/src/handlers/login.php` |
| 2 | K-SNAP：k-snap_login を ② へ転送／k-snap_show・k-snap_customer_update を ② だけで処理 | ① PHP `backend/src/core/express_proxy.php`（＋ k-snap_show.php・k-snap_customer_update.php はコメントだけ） |
| 3 | kyusyu.pg-house.jp のフォームを ② で受ける | ⚠️ **② VPS の .env.prod**（CORS_ORIGINS。v2.2.205 で調べた件。済んでいれば飛ばす） |
| 4 | 画面の版 | ① フロント |
| 5 | 更新履歴 | ① DB |

- ⚠️ **② の再ビルドは不要。** K-SNAP の処理は 2026-09-03 から ② にある（2026-10-21 に本番の ② で k-snap_login・k-snap_show が応答することを確認済み）。
- ⚠️ DB の変更なし。

## 順序
```
0. GitHub で v2.2.206 を main → production へマージ
1. ① PHP（login.php・express_proxy.php・k-snap_show.php・k-snap_customer_update.php）
2. ② CORS_ORIGINS（済んでいれば不要）
3. ① フロント
4. ① SQL（更新履歴）
```
- 1〜4 はどの順でも壊れない（1 を先にするのが目的）。

## 手順1　【① FTP】PHP
上書きする4ファイル（`/dashboard/api/gateway/` の下）:
- `handlers/login.php`
- `core/express_proxy.php`
- `handlers/k-snap_show.php`（コメントだけ）
- `handlers/k-snap_customer_update.php`（コメントだけ）

確認（ログインしていないブラウザ、または端末で）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"login","mail":"test@example.com"}'
```
⚠️ `ログインに失敗しました` が返ればよい（以前はメールアドレスが登録済みなら入れた）。
- 画面で Google ログインできることを確認する（自分のアカウントで）。
- K-SNAP（スタッフの写真の編集画面）で公開／非公開の切り替えができること。公開ギャラリーでログインできること。

⚠️ 切り戻し：
- ログインが全員できなくなった → 旧 login.php に戻す（git の main の版）。
- K-SNAP の保存が 502 → express_proxy.php の expressProxyExclusive() の末尾の `'k-snap_show'`・`'k-snap_customer_update'` の2行を消して上書き（① の PHP が処理する）。

## 手順2　【② VPS で実行】CORS_ORIGINS（kyusyu）
⚠️ `docs/task-2026-10-21-04-pg-kyusyu-cors.md` の手順。`https://kyusyu.pg-house.jp/` の末尾の `/` を消してから:
```bash
dcp up -d express-api
```

## 手順3　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.0d91622e.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順4　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-21_update_log_2.2.206.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```
⚠️ 2.2.206 が1行ならよい。

## ⚠️ 今夜の PHP の修正版（コードでは対応できない）
- 2026-10-21 23:00（日本時間）に PHP の修正版が出る（php2shell。Critical 2件）。
- ① のレンタルサーバーの事業者の告知を確認し、サーバーパネルで PHP のバージョンを選べるなら修正版へ切り替える。WAF を有効にしておく。
- ② の VPS には PHP が無い（caddy・express-api・ssh-tunnel だけ）。
