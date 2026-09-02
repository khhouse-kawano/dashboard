# PHP → Express 移行ガイド

既存のPHPバックエンド（186ハンドラ / 約17,000行）を、**フロントエンドのコードを変更せずに**少しずつ Express へ移す仕組みと手順。

---

## 現状（2026-09-02）

| | 数 |
|---|---|
| PHPハンドラ（`portal/` 除く） | 186ファイル / 約17,000行 |
| フロントが使う `request` の種類 | 72 |
| `roll` / `category` を含む実エンドポイント | 130以上 |
| Express へ移植済み | **1**（`menu`。差分比較でバイト単位一致を確認済み） |

---

## なぜ互換ゲートウェイが必要か

フロントエンドは全ての通信を「**1つのURLへのPOST**」で行っている。

```ts
// frontend/src/utils/apiClient.ts
apiClient.post('', { request: 'list', roll: 'tag', category: 'order', ... })
```

対して Express の `features/*` は REST 形式である。

```
GET /api/v1/analysis/pivot?groupBy=month,store
```

**形式が違うため、Express に機能を足してもフロントからは呼べない。**
「フロントを変更しない」という制約のもとで移行するには、Express 側が PHP と同じ形式を受ける入口を持つ必要がある。

### 構成

```
フロントエンド（変更なし）
   │ POST /api/gateway  { request, roll, category, ... }
   ▼
┌──────────────────────────────────────┐
│ src/gateway/                          │
│   registry.ts  … 移植済みかを引く      │
│   index.ts     … 振り分け              │
│   phpFallback  … 未移植は ① へ転送     │
└───────────────┬──────────────────────┘
                │ 同じ関数を呼ぶ
                ▼
┌──────────────────────────────────────┐
│ src/features/*  … 業務ロジック         │
│   REST でも公開（将来の正式な形）       │
└──────────────────────────────────────┘
```

**業務ロジックは1つ、入口を2つ**にしている。将来フロントを REST へ移すときに、ゲートウェイだけを捨てられる。

### フォールバックが移行の鍵

未移植のリクエストは ① レンタルサーバーの PHP へそのまま転送される。

⚠️ **これがあるので、186個すべてを移し終わるまで切り替えを待つ必要がない。**
1つ移植 → 差分比較 → 登録 → 本番へ、を繰り返せる。問題が起きたらそのエントリを登録解除するだけで即座に PHP に戻る。

⚠️ 転送は**素通し**にしている。JSONをパースして組み直すと、数値が文字列で返るといった PHP 固有の形が崩れてフロントが壊れるため。

---

## ⚠️ 発見した問題: 現状のAPIは実質無認証

`backend/src/core/db.php` を読むと、`Authorization` ヘッダは**変数に代入されるだけで検証されていない**。

```php
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
// ↑ この後どこからも参照されない
```

認証を行っているのは `requireStaff()` / `requireMaster()` を明示的に呼んでいる一部の新しいハンドラのみ。

つまり **URLを知っていれば誰でも顧客の氏名・電話番号・住所を取得できる**状態にある。

```
POST https://khg-marketing.info/dashboard/api/gateway/
{ "request": "list", "category": "order" }
```

### 移行での扱い

`GATEWAY_REQUIRE_AUTH` で切り替えられるようにした。

| 値 | 挙動 |
|---|---|
| `false`（既定） | PHP と同じ。移植済みエンドポイントも認証しない |
| `true` | 移植済みエンドポイントに `Token` ヘッダを要求する |

⚠️ **既定を `false` にしている理由**は、移植と認証強化を同時に行うと、画面が壊れたときに「移植の失敗」か「認証で弾かれた」かの切り分けができなくなるため。

⚠️ **未移植の転送分には認証をかけていない。** 転送先のPHPが自前で判断するべきであり、Express 側で先に弾くとこれまで動いていた画面が突然 401 になる。

**認証強化は移行とは独立した課題として、別途対応すること。** 移行が終わるまで放置してよい問題ではない。

---

## 型の扱い（実測で確認済み）

### ⚠️ 値を変換しないこと。そのまま返すのが正しい

① レンタルサーバーの `core/db.php` は以下を設定している。

```php
PDO::ATTR_EMULATE_PREPARES => false,
```

これにより mysqlnd がネイティブ型を返すため、**PHP側も INT を数値で返す**。`mysql2` と最初から一致している。

```
PHP     : { "sync": 0, "duplicate_flag": 0, "id": 42 }
mysql2  : { "sync": 0, "duplicate_flag": 0, "id": 42 }   ← 一致
```

⚠️ **`phpCompat.ts` の `toPhpRows()` は使わない。** 当初「PDOは全て文字列で返す」という前提で用意したが誤りだった。`menu` の移植時に文字列化したところ、17,700行 × 4列すべてが差分になった。

`toPhpRows()` を使うのは、PHP側が `number_format()` や `sprintf()` で**明示的に文字列を組み立てている**ハンドラだけ。使う前に必ず移植元のPHPを読むこと。

### 一致している他の型

| 型 | 扱い |
|---|---|
| `DATE` / `DATETIME` | `pool.ts` の `dateStrings: true` により文字列のまま返る。PHPと一致 |
| `DECIMAL` | mysql2 も PDO も文字列で返す。一致 |
| `TINYINT(1)` | 両方とも数値（`0` / `1`）。真偽値に変換されない |

⚠️ 自分で `new Date()` を挟むとタイムゾーンでずれる。DBから来た日付文字列はそのまま渡すこと。

### ⚠️ タイムゾーン

コンテナの既定は UTC。`docker-compose.prod.yml` で `TZ=Asia/Tokyo` を設定している。

**これが無いと、日時を書き込むハンドラ（`login` / `get_token` / `heartbeat`）で9時間ずれる。** PHP は ① のタイムゾーン（JST）で `date('Y-m-d H:i:s')` を書き込んでいる。

### 型は推測せず必ず比較する

一致するかどうかは**実測しないと分からない**。上記の結論も、差分比較を実行して初めて判明した。移植のたびに `compareBackends` を通すこと。

---

## 移植の手順（1エンドポイントごと）

### 1. 移植元のPHPを読む

```
backend/src/handlers/<request>.php
backend/src/handlers/<request>Action/<request>_<roll>.php
```

⚠️ `roll` / `category` による分岐を全て把握する。1つの `request` が複数のPHPファイルに散っていることがある。

⚠️ **`SELECT` のみか、書き込みを伴うかを必ず確認する。** 書き込み系は差分比較スクリプトが使えない（本番データが2回書き換わる）。

### 2. features/ に業務ロジックを書く

`src/features/<domain>.ts` に置く。REST ルートとしても公開する。

⚠️ ゲートウェイのファイルに SQL を書かないこと。ゲートウェイは振り分けだけを担う。

### 3. 差分比較（参照系のみ）

**② VPS のコンテナ内で実行する。これが唯一の正しい方法。**

⚠️ **作業者のPCから実行してはいけない。** ローカルの Express は `docker-compose.yml` により `local_db`（過去のダンプ）を見ている。本番PHPと比べると**データそのものが違う**ため、件数差が出て移植の正否を判断できない。

実際に `menu` で PHP=17,743件 / Express=17,700件 という差が出て、原因の切り分けに時間を要した。

```bash
# 【② VPS】
dcp exec \
  -e PHP_BASE=https://khg-marketing.info/dashboard/api/gateway/ \
  -e EXPRESS_BASE=http://localhost:3001/api/gateway \
  express-api node dist/cli/compareBackends.js --body '{"request":"menu"}'
```

| 変数 | 値 | 理由 |
|---|---|---|
| `PHP_BASE` | ① のゲートウェイURL | 正解となる側 |
| `EXPRESS_BASE` | `http://localhost:3001/api/gateway` | **コンテナ自身**。Caddy を経由せずCORSの影響を受けない |

⚠️ `tsx` は不要。CLIは `src/cli/` にあるため `npm run build` で `dist/cli/` にコンパイルされる。本番イメージ（`--omit=dev`）でもそのまま実行できる。

⚠️ 比較する前に、そのエンドポイントを `registry.ts` に**登録してビルド・再起動**しておく必要がある。未登録だと Express 側も PHP へ転送してしまい、同じ結果になって比較の意味がない。

`✅ 差分なし` になるまで直す。理想はバイト数まで一致すること（`menu` は 15,792,984 bytes で完全一致した）。

⚠️ このスクリプトは名前に `insert` `update` `delete` `tag` 等を含むリクエストを自動で拒否する。ただし判定は名前だけなので、**PHPを読んで参照専用だと確認する責任は人間側にある。**

#### 差分が出たときの読み方

同じ原因の差分が数万件出るため、配列の添字を潰して種類ごとに集約表示する。

```
❌ 差分 5000 件以上（上限に達したため打ち切り） / 原因は 2 種類

  ×    1  $.inquiry: 件数が違う  PHP=17743  Express=17700
  ×17700  $.inquiry[].sync: 型が違う
         例: $.inquiry[0].sync: 型が違う  PHP=number(0)  Express=string(0)
```

**「17,700件の差分」ではなく「原因は1種類」と読む。**

| 差分 | 判断 |
|---|---|
| 件数が数件違う | ⚠️ 許容。比較の一瞬に反響が入った場合がある |
| 件数が数十件以上違う | ❌ 別のDBを見ている |
| 型が違う | ❌ 値を変換している。変換をやめる |
| 順序が違う | ⚠️ PHPのSQLに `ORDER BY` が無い。**足さないこと**（PHPと違う並びになりかえって差が広がる）。フロントが順序に依存していないかを確認する |

### 4. registry.ts に登録する

```ts
register({
  request: 'menu',
  summary: 'メニューの件数バッジ',
  phpSource: 'backend/src/handlers/menu.php',
  auth: 'staff',
  handler: async () => runMenu(),
});
```

⚠️ `roll` / `category` ごとに1件ずつ登録する。ワイルドカードは用意していない。「どれが移植済みか」が曖昧になり、未移植のものが誤って Express に流れる事故を防ぐため。

### 5. デプロイして確認

```bash
# 【② VPS】
cd ~/dashboard && git fetch --depth 1 origin production && git reset --hard FETCH_HEAD && dcp build express-api && dcp up -d --force-recreate express-api
```

起動ログに登録内容が出る。

```
PHP互換ゲートウェイ: 移植済み 1 件 / 未移植の転送先 https://khg-marketing.info/...
  🔒 menu::  — メニューの件数バッジ
```

移植済み一覧は開発環境でのみ確認できる（本番では内部構造を晒さないため無効）。

```
GET http://localhost:3001/api/gateway/_routes
```

### 6. 問題が起きたら

`registry.ts` から `register()` の呼び出しを消して再デプロイする。**PHP へ転送される状態に即座に戻る。**

---

## 切り替え手順（フロントの向き先を変える）

⚠️ **移植が0件の状態でも切り替えられる。** 全リクエストが PHP へ転送されるだけで挙動は変わらない。まずこの状態で転送が正しく動くことを確認してから移植を始めるのが安全。

`frontend/.env.production` の1行を変えるだけ。

```
REACT_APP_XSERVER_API=https://api.khg-marketing.info/api/gateway
```

**フロントエンドのコード変更は不要。** `apiClient.ts` が `process.env.REACT_APP_XSERVER_API` を `baseURL` にしているため。

⚠️ 切り替え前に以下を確認すること。

| 確認 | 理由 |
|---|---|
| ② VPS の `.env.prod` に `PHP_GATEWAY_URL` が設定されているか | 未設定だと未移植のリクエストが全て 400 になる |
| Caddy の CORS / ヘッダ設定 | ブラウザから直接叩くようになるため。現状 `CORS_ORIGINS=` は空 |
| ② VPS のスペックが全トラフィックを受けられるか | 現在は分析APIのみ（1日数十リクエスト）だが、切り替えると全画面分が来る |

⚠️ **`CORS_ORIGINS` が空のままではブラウザから使えない。** 分析APIはサーバー間通信（MCPサーバー）だけを想定して空にしてある。切り替え時には `https://khg-marketing.info` を許可する必要がある。

---

## 移植の順序（提案）

| フェーズ | 内容 | 状態 |
|---|---|---|
| **0** | 互換ゲートウェイ / フォールバック / 差分比較 | **完了** |
| 1 | 参照のみ・単純なもの | `menu` **完了** / `header` `show_version` `callStatusList` 未 |
| 2 | 一覧系（`list` `database` `inside` `shop`） | 未 |
| 3 | 集計系（`rank` `shopTrend` `customerTrend` `company` `survey`） | 未 |
| 4 | 更新系（`information` の add / update）| 未 |
| 5 | 外部連携（`suumo` `athome` `homes` `allgrit` `meta_ads`） | 未 |

⚠️ **更新系を最後にする理由**は、失敗したときにデータが壊れるため。参照系なら間違っても画面表示が変になるだけで済む。

⚠️ フェーズ4には763行のPHPファイル（`information_used_add.php`）が含まれる。1ファイルで数日かかる規模であり、安易に着手しないこと。

---

## ファイル構成

```
backend-express/src/
├── gateway/
│   ├── types.ts        … 型定義とキーの組み立て
│   ├── registry.ts     … 移植済みエンドポイントの登録表
│   ├── index.ts        … 振り分けルーター
│   ├── phpFallback.ts  … ① レンタルサーバーへの転送
│   └── phpCompat.ts    … PHP と同じ形のJSONを作るヘルパー
├── cli/
│   └── compareBackends.ts … 差分比較スクリプト
└── features/           … 業務ロジック（REST でも公開）
```

## 環境変数

| 変数 | 既定 | 説明 |
|---|---|---|
| `PHP_GATEWAY_URL` | なし | 未移植の転送先。**① レンタルサーバーのURL** |
| `PHP_GATEWAY_TIMEOUT_MS` | 120000 | 転送のタイムアウト |
| `GATEWAY_REQUIRE_AUTH` | false | 移植済みに Token 認証を要求するか |

⚠️ `PHP_GATEWAY_URL` に ② VPS 自身のURL（`api.khg-marketing.info`）を設定すると**無限ループ**になる。
