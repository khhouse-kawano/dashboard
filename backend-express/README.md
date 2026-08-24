# Express / TypeScript バックエンド

既存の PHP バックエンド（`../backend`）を段階的に置き換えていくための新しい API サーバーです。
**PHP は今までどおり 8080 番で動き続けます**。Express は 3001 番で並走し、移植が済んだ機能から
フロントエンドの向き先を 1 本ずつ切り替えていきます（ストラングラーフィグ・パターン）。

```
React (:3000)
 ├─→ :8080  php-web      … 既存API（backend/src/handlers/*.php、約180本）
 └─→ :3001  express-api  … 移植済みの機能だけ
            └─→ mariadb-db (:3307)  ← DBは共通
```

---

## 起動

リポジトリのルート（`dashboard/`）で実行します。

```bash
# 全サービス起動（初回・通常）
docker compose up -d

# Express だけ再起動したいとき（PHP と DB には触らない）
docker compose up -d --no-deps express-api

# ログを追う
docker compose logs -f express-api
```

動作確認:

```bash
curl http://localhost:3001/api/health
```

`{"status":"ok", ... "database":"connected"}` が返れば成功です。

### ⚠️ npm パッケージを追加したときは `-V` が必要

`node_modules` はホスト側と衝突しないよう **匿名ボリューム** に隔離しています。
そのため `docker compose up --build` しても、コンテナ内の `node_modules` は
**古いまま再利用されます**（`nodemon: not found` などの原因）。

```bash
# 依存関係を追加・変更した後はこちら
docker compose up -d --no-deps --build -V express-api
```

`-V`（`--renew-anon-volumes`）が匿名ボリュームを作り直すオプションです。

### ホットリロードについて

Windows / macOS のバインドマウントでは、ファイル変更の通知（inotify イベント）が
コンテナ内に伝わりません。そのため Docker 内では `nodemon --legacy-watch`
（＝ポーリングで mtime を監視）を使っています（`npm run dev:docker`）。

`src/` 以下の `.ts` を保存すると自動で再起動します。

---

## エンドポイント

| メソッド | パス | 認証 | 内容 |
|---|---|---|---|
| GET | `/api/health` | 不要 | 疎通確認（DB 接続まで確認する） |
| GET | `/api/v1/version` | 不要 | 最新バージョン取得（`show_version.php` の移植） |
| GET | `/api/v1/me` | 必要 | トークンに紐づくスタッフ情報 |

認証は `Token` ヘッダに `staff.api_token` を載せます（既存の `src/utils/apiClient.ts` と同じ形式）。
`Authorization: Bearer xxx` も受け付けます。

---

## ディレクトリ構成と役割分担

「1 ファイルに全部書く」PHP の handlers と違い、**責務ごとに層を分けて**います。
どこに何を書くか迷ったら、下の表のとおりに置いてください。

```
src/
├── server.ts                  起動（listen）だけ。DB疎通を確認してから listen する
├── app.ts                     Express本体の組み立て（ミドルウェアの登録順が重要）
│
├── config/env.ts              環境変数の読み込みと検証。未設定なら起動時に落とす
├── db/pool.ts                 コネクションプールと query() / execute() ヘルパー
├── errors/AppError.ts         「想定内のエラー」を表すクラス
│
├── middlewares/
│   ├── auth.ts                requireApiToken … トークン認証（PHPの token.php 相当）
│   ├── errorHandler.ts        全エラーの最終受け口。ログ出力とレスポンス整形
│   └── requestLogger.ts       アクセスログ
│
├── routes/                    URL と処理の対応づけ「だけ」
├── controllers/               HTTPの入口と出口だけ（req から値を取り、res で返す）
├── services/                  業務ルール・判断ロジック（HTTPもSQLも知らない）
├── repositories/              SQLを書く唯一の場所
└── types/                     型定義
```

| 層 | やること | やらないこと |
|---|---|---|
| routes | URL とハンドラの紐付け、ミドルウェアの適用 | 処理そのもの |
| controllers | `req` から値を取る / `res.json()` で返す | SQL、業務判断 |
| services | 「レコードが無ければエラー」等の判断 | `req` / `res` を触ること、SQL |
| repositories | SQL の発行 | 業務判断 |

### try-catch は書かなくてよい

Express 5 は `async` 関数内で throw された例外を自動的に `errorHandler` まで運びます。
そのため各コントローラで `try-catch` を書く必要はありません
（＝エラーを握りつぶす書き方になりにくい）。

想定内のエラーは `AppError` を投げます:

```ts
throw AppError.notFound('該当する顧客が見つかりません');  // → 404
throw AppError.badRequest('id は必須です');                // → 400
```

`AppError` 以外の例外（バグ、DB障害など）は自動的に 500 になり、
スタックトレース付きでサーバーログに記録されます（レスポンスには本番だと出しません）。

---

## PHP から 1 本移植する手順

例として `backend/src/handlers/customer.php` を移す場合:

1. **repositories/customer.repository.ts** … PHP の SQL をそのまま移す。
   `SELECT *` は列を明示する形に直す。プレースホルダは必ず `?` を使う。
2. **services/customer.service.ts** … 「見つからなければ 404」などの判断を書く。
3. **controllers/customer.controller.ts** … `req.body` / `req.query` から値を取り、`res.json()` で返す。
4. **routes/customer.route.ts** … `router.get('/', getCustomer)` のように紐付ける。
5. **routes/index.ts** の `v1Router` に `v1Router.use('/customers', customerRouter)` を追加。
6. フロント側で、その機能の呼び出し先を `REACT_APP_API_BASE_URL`（PHP）から
   Express の URL に切り替える。
7. 動作確認できたら、対応する PHP の handler を削除する（**先に消さない**）。

移植の第1号として `show_version.php` → `/api/v1/version` を実装済みです。
4ファイルの流れを追うと、層の分け方がそのまま読み取れます。

---

## ローカル（Docker を使わず）で動かす場合

DB は Docker の MariaDB（ホストからは `3307` 番）を使います。

```bash
cd backend-express
npm install

DB_HOST=127.0.0.1 DB_PORT=3307 DB_NAME=local_db DB_USER=local_user DB_PASS=local_password \
  npm run dev
```

## その他のコマンド

```bash
npm run typecheck   # 型チェックのみ（コンパイル成果物を出さない）
npm run build       # dist/ に JavaScript を出力
npm start           # dist/server.js を実行（本番相当）
```
