# Express / TypeScript バックエンド

既存の PHP バックエンド（`../backend`）を段階的に置き換えていくための API サーバーです。
**PHP は今までどおり 8080 番で動き続けます**。Express は 3001 番で並走し、移植が済んだ機能から
フロントエンドの向き先を 1 本ずつ切り替えていきます（ストラングラーフィグ・パターン）。

```
React (:3000)
 ├─→ :8080  php-web      … 既存API（backend/src/handlers/*.php、約180本）
 └─→ :3001  express-api  … 移植済みの機能だけ
            └─→ mariadb-db (:3307)  ← DBは共通
```

---

## 目次

1. [設計の全体像](#設計の全体像)
2. [API の設計原則](#api-の設計原則)
3. [機能を1つ追加する](#機能を1つ追加する)
4. [PHP ハンドラ → REST の対応づけ](#php-ハンドラ--rest-の対応づけ)
5. [エラーの扱い](#エラーの扱い)
6. [フロントエンドからの呼び出し](#フロントエンドからの呼び出し)
7. [起動と運用](#起動と運用)

---

## 設計の全体像

### 中心にある考え方

180 個の機能を「1機能ごとにルーター・コントローラ・サービス・リポジトリの4ファイル」で書くと
**720ファイル**になり保守できません。そこでこのプロジェクトでは、

> **1ドメイン＝1ファイルに「宣言」を書き、URL 割り当て・認証・入力検査は
> フレームワーク（`core/`）が自動で組み立てる**

という方式をとっています。機能を追加してもルーターやコントローラは書きません。

### ディレクトリ

```
src/
├── server.ts               起動のみ（DB疎通確認 → listen → 停止処理）
├── app.ts                  ミドルウェアの組み立て。登録順そのものが仕様
│
├── core/                   ← フレームワーク。機能追加時に触ることはない
│   ├── route.ts              route() … 1本のルートを定義する。型推論の入口
│   ├── feature.ts            defineFeature() … 機能のまとまりを定義する
│   ├── registry.ts           features → Express Router への自動変換
│   ├── schema.ts             使い回すzodスキーマ（ID・ページング等）
│   └── systemRouter.ts       /api/health, /api/v1/_routes
│
├── features/               ← 機能を足すときに触るのはここだけ
│   ├── index.ts              全機能の登録簿（追加時はここに1行）
│   ├── versions.ts           更新履歴
│   └── staff.ts              スタッフ
│
├── middlewares/
│   ├── auth.ts               Token認証
│   ├── requestContext.ts     リクエストID付与
│   ├── requestLogger.ts      アクセスログ
│   └── errorHandler.ts       全エラーの最終受け口
│
├── config/env.ts           環境変数の読み込みと検証
├── db/pool.ts              コネクションプールと query() / execute()
├── errors/AppError.ts      想定内エラーの表現
├── types/                  型定義
└── utils/logger.ts
```

**ファイル数の見込み**: 基盤14ファイル + ドメイン数（20前後）。180機能でも35ファイル程度に収まります。

### なぜ4層構成をやめたか

役割分担そのものは今も残っています。ただし**ファイルではなくファイル内のセクションで分ける**方式に変えました。

```
features/versions.ts
├── 上半分: SQL を書くセクション  （旧 repository 層）
└── 下半分: ルート定義セクション  （旧 route + controller + service 層）
```

1ファイルが 200 行を超えたら `features/versions/` ディレクトリに分割します。
「最初から分ける」のではなく「大きくなったら分ける」運用です。

---

## API の設計原則

### 1. 操作名は URL パス、パラメータは POST ボディ

採用しなかった方式とその理由:

| 方式 | 不採用の理由 |
|---|---|
| ヘッダに `{request:'login'}` | CORS preflight が毎回発生。プロキシがカスタムヘッダを落とすことがある。アクセスログに出ないため障害時に追跡できない |
| `GET ?request=login` | キャッシュ事故。URL に顧客名や電話番号が載り**アクセスログに個人情報が残る**。URL長制限。更新系をGETにするとプリフェッチで誤実行 |

### 2. REST の命名規則

```
GET    /api/v1/customers          一覧
GET    /api/v1/customers/:id      1件取得
POST   /api/v1/customers          新規作成（201を返す）
PATCH  /api/v1/customers/:id      部分更新
PUT    /api/v1/customers/:id      全体置換
DELETE /api/v1/customers/:id      削除
```

- リソース名は **複数形の名詞・ケバブケース**（`resale-listings`）
- **動詞は URL に入れない**。動作は HTTP メソッドで表す
- 親子関係はネストする: `POST /customers/:id/call-logs`

### 3. 名詞にできない操作の扱い

既存ハンドラには `list_resale_sync` や `budget_simulator` のように、
リソースの CRUD に当てはまらないものが多数あります。この場合は
**操作を名詞化してサブリソースにする**のが定石です。

```
POST /api/v1/resale-listings/sync        同期を「実行する」→ sync というサブリソースを作る
POST /api/v1/budget-simulations          シミュレーション「結果」というリソースを作る
GET  /api/v1/dashboard/summary           集計結果もリソースとして扱う
```

### 4. クエリ文字列は必ず文字列で届く

`?limit=50` の `50` は文字列 `"50"` です。数値として扱いたい場合は
`z.coerce.number()` を通してください。`core/schema.ts` によく使う形を用意しています。

---

## 機能を1つ追加する

### 手順

1. `features/<名前>.ts` を作る
2. `features/index.ts` に import と配列への追加（各1行）

これだけです。URL 割り当て・認証・入力検査・エラー処理は自動で組み上がります。

### テンプレート

```ts
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { defineFeature } from '../core/feature';
import { route } from '../core/route';
import { idParam, paginationQuery } from '../core/schema';
import { query, execute } from '../db/pool';
import { AppError } from '../errors/AppError';

// ── データ取得（SQL を書くのはこのセクションだけ）────────────────

interface CustomerRow extends RowDataPacket {
  id: number;
  name: string;
  shop: string;
}

// SELECT * は使わず、返してよい列を必ず明示する
const COLUMNS = 'id, customer_contacts_name AS name, in_charge_store AS shop';

const findById = async (id: number): Promise<CustomerRow | undefined> => {
  const rows = await query<CustomerRow>(
    `SELECT ${COLUMNS} FROM master_data WHERE id = ? LIMIT 1`, [id]
  );
  return rows[0];
};

// ── ルート定義 ──────────────────────────────────────────────

export const customers = defineFeature({
  name: '顧客',
  basePath: '/customers',
  routes: {
    'GET /': route({
      summary: '顧客を一覧取得',
      auth: true,
      query: paginationQuery.extend({ shop: z.string().optional() }),
      handler: async ({ query: q }) => {
        // q.limit は number、q.shop は string | undefined として型がつく
        return findAll(q.limit, q.offset, q.shop);
      },
    }),

    'GET /:id': route({
      summary: '顧客を1件取得',
      auth: true,
      params: idParam,
      handler: async ({ params }) => {
        const found = await findById(params.id);   // params.id は number
        if (found === undefined) {
          throw AppError.notFound(`顧客 id=${params.id} が見つかりません`);
        }
        return found;
      },
    }),

    'POST /': route({
      summary: '顧客を新規登録',
      auth: true,
      status: 201,
      body: z.object({
        name: z.string().min(1),
        shop: z.string().min(1),
      }),
      handler: async ({ body, ctx }) => {
        // ctx.staff で「誰が実行したか」が分かる（auth: true のとき必ず入る）
        const result = await execute(
          'INSERT INTO master_data (customer_contacts_name, in_charge_store) VALUES (?, ?)',
          [body.name, body.shop]
        );
        return { id: result.insertId };
      },
    }),
  },
});
```

### `route()` に書けること

| キー | 必須 | 内容 |
|---|:--:|---|
| `summary` | ○ | 何をするルートか。`/api/v1/_routes` の一覧に出る |
| `auth` | | `true` で Token 認証を要求し、`ctx.staff` が使えるようになる |
| `params` | | パスパラメータの zod スキーマ |
| `query` | | クエリ文字列の zod スキーマ |
| `body` | | リクエストボディの zod スキーマ |
| `status` | | 成功時のHTTPステータス（新規作成なら `201`）。省略時は 200 |
| `handler` | ○ | 実処理。返した値がそのまま JSON になる |

**`try-catch` は書きません。** Express 5 が例外を errorHandler まで自動で運びます。

### ルートの登録順は気にしなくてよい

`'GET /:id'` を `'GET /me'` より先に書いても、registry がパスパラメータの少ない順に
並べ替えるため `/me` が `/:id` に食われることはありません。

---

## PHP ハンドラ → REST の対応づけ

既存 180 ハンドラを移す際の指針です。

| PHP ハンドラ | REST | 考え方 |
|---|---|---|
| `customer.php` / `customers.php` | `GET /customers` | 一覧はリソースの複数形 |
| `insert_customer.php` | `POST /customers` | 動詞 insert は POST が表す |
| `estate_update.php` | `PATCH /estates/:id` | 動詞 update は PATCH が表す |
| `add_call_log.php` | `POST /customers/:id/call-logs` | 顧客に属するので子リソース |
| `add_interview_log.php` | `POST /customers/:id/interview-logs` | 同上 |
| `list_resale.php` | `GET /resale-listings` | list は複数形が表す |
| `list_resale_sync.php` | `POST /resale-listings/sync` | 名詞にできない操作はサブリソース化 |
| `budget_simulator.php` | `POST /budget-simulations` | 計算結果を「作る」と捉える |
| `menu.php` | `GET /dashboard/summary` | 集計結果もリソース |
| `geoCode.php` | `GET /geocode?address=...` | 副作用のない検索は GET でよい |
| `get_token.php` | `POST /auth/token` | 認証はまとめて `/auth` に |
| `header_staff_insert.php` | `POST /staff` | `header_` は画面都合の接頭辞なので落とす |
| `portal/suumo_kaeru.php` | `GET /portals/suumo/listings?brand=kaeru` | ポータルは1機能にまとめ、差分はクエリで |
| `show_version.php` | `GET /versions/latest` | 実装済み。`features/versions.ts` 参照 |

**接頭辞 `header_` / `list_` / `add_` は画面や動作の都合であって、リソース名ではありません。**
移植時は落として、対象リソース＋HTTPメソッドに読み替えてください。

---

## エラーの扱い

### 投げ方

```ts
throw AppError.badRequest('id は必須です');       // 400
throw AppError.unauthorized();                    // 401
throw AppError.forbidden();                       // 403
throw AppError.notFound('顧客が見つかりません');   // 404
throw AppError.conflict('既に登録済みです');       // 409
```

`AppError` 以外の例外（バグ・DB障害など）は自動的に 500 になり、
**スタックトレース付きで必ずサーバーログに記録されます**（レスポンスには本番では出しません）。

### レスポンスの形

全エンドポイントで統一されています。

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "顧客 id=999 が見つかりません",
    "requestId": "a51f78df-a366-429c-bb96-88f096e39415"
  }
}
```

バリデーション失敗時は、どの項目が悪いかまで返します。

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "入力内容に誤りがあります",
    "details": {
      "source": "query",
      "issues": [{ "field": "limit", "message": "Too big: expected number to be <=500" }]
    },
    "requestId": "..."
  }
}
```

`code` は `BAD_REQUEST` / `UNAUTHORIZED` / `FORBIDDEN` / `NOT_FOUND` / `CONFLICT` /
`PAYLOAD_TOO_LARGE` / `INTERNAL_ERROR` のいずれかです。

### requestId

1リクエストに1つ振られ、**アクセスログ・エラーログ・レスポンス・`X-Request-Id` ヘッダ**の
すべてに同じ値が載ります。「画面でエラーが出た」という報告からサーバーログの該当行を
一発で特定できます。

---

## フロントエンドからの呼び出し

### クライアントの用意

```ts
// src/utils/expressClient.ts
import axios from 'axios';

const expressClient = axios.create({
  baseURL: process.env.REACT_APP_EXPRESS_API,  // http://localhost:3001/api/v1
  headers: { 'Content-Type': 'application/json' },
});

expressClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Token'] = token;
  return config;
});

export default expressClient;
```

### 呼び出し

```ts
// 一覧（クエリはオブジェクトで渡せる）
const { data } = await expressClient.get('/customers', {
  params: { shop: '国分店', limit: 50 },
});

// 1件取得
const { data } = await expressClient.get(`/customers/${id}`);

// 新規作成
const { data } = await expressClient.post('/customers', { name, shop });

// 部分更新
await expressClient.patch(`/customers/${id}`, { status: '契約' });
```

### エラー処理

axios は非 2xx で自動的に throw するため、`catch` 側で分岐できます。

```ts
try {
  const { data } = await expressClient.get(`/customers/${id}`);
} catch (e) {
  const err = axios.isAxiosError(e) ? e.response?.data?.error : undefined;

  if (err?.code === 'NOT_FOUND')     { /* 見つからない場合の表示 */ }
  if (err?.code === 'UNAUTHORIZED')  { /* ログイン画面へ */ }
  if (err?.code === 'BAD_REQUEST')   { /* err.details.issues をフォームに反映 */ }

  console.error(err?.message, 'requestId:', err?.requestId);
}
```

### 実装済みAPIの確認

コードを読まなくても、ブラウザで一覧を確認できます（開発環境のみ）。

```
http://localhost:3001/api/v1/_routes
```

起動ログにも一覧が出ます。`🔒` は認証必須のルートです。

---

## 起動と運用

リポジトリのルート（`dashboard/`）で実行します。

```bash
docker compose up -d                        # 全サービス起動
docker compose up -d --no-deps express-api  # Express だけ再起動
docker compose logs -f express-api          # ログを追う
curl http://localhost:3001/api/health       # 疎通確認
```

### ⚠️ 初回起動（DBボリュームが空のとき）は5分ほどかかる

`docker compose down -v` などで `db-data` ボリュームを消すと、次回起動時に
`docker/mariadb/init/*.sql`（約15MB）の取り込みが走ります。この間 MariaDB は
TCP 接続を受け付けないため、`express-api` / `php-web` は待機状態になります。

`docker compose logs -f mariadb-db` に `ready for connections` が
**2回目**（`port: '3306'` 付き）出れば取り込み完了です。

compose の `healthcheck.start_period: 600s` はこの取り込み時間の猶予です。
短くすると取り込み中に unhealthy と判定され、
`dependency failed to start: container ... is unhealthy` で依存サービスが起動しません。

### ⚠️ npm パッケージを追加したときは `-V` が必要

`node_modules` はホスト側と衝突しないよう **匿名ボリューム** に隔離しています。
そのため `docker compose up --build` してもコンテナ内の `node_modules` は
**古いまま再利用されます**（`nodemon: not found` などの原因）。

```bash
docker compose up -d --no-deps --build -V express-api
```

`-V`（`--renew-anon-volumes`）が匿名ボリュームを作り直すオプションです。

### ホットリロード

Windows / macOS のバインドマウントでは、ファイル変更の通知（inotify イベント）が
コンテナ内に伝わりません。そのため Docker 内では `nodemon --legacy-watch`
（ポーリングで mtime を監視）を使っています。`src/` 以下の `.ts` を保存すると自動で再起動します。

### コマンド

```bash
npm run typecheck   # 型チェックのみ
npm run build       # dist/ に JavaScript を出力
npm start           # dist/server.js を実行（本番相当）
```

### 環境変数

`docker-compose.yml` の `express-api > environment` で設定します。

| 変数 | 既定値 | 内容 |
|---|---|---|
| `PORT` | 3001 | 待受ポート |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASS` | — | DB接続情報（必須） |
| `CORS_ORIGINS` | `http://localhost:3000` | 許可オリジン。カンマ区切り |
| `TRUST_PROXY` | 0 | Nginx 等の背後に置く場合は 1 |
| `BODY_LIMIT` | 10mb | リクエストボディ上限 |
| `REQUEST_TIMEOUT_MS` | 120000 | 1リクエストの最大処理時間 |

必須の変数が未設定の場合、起動時点でエラーを出して停止します
（後から原因不明の 500 になるのを防ぐため）。

---

## 補足: `any` について

`core/feature.ts` の `ErasedRoute.handler` で `any` を1箇所だけ使っています。
これは「各ルートの型引数を消して一律に扱う」ための型消去で、
入出力の型は `route()` を書いた時点で検証済みです。
**このプロジェクトで `any` を意図的に使っているのはここだけ**です。
