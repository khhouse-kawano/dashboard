# PHP → Express 移行ガイド

既存のPHPバックエンド（186ハンドラ / 約17,000行）を、**フロントエンドのコードを変更せずに**少しずつ Express へ移す仕組みと手順。

---

## 現状（2026-09-02）

| | 数 |
|---|---|
| PHPハンドラ（`portal/` 除く） | 186ファイル / 約17,000行 |
| フロントが使う `request` の種類 | 72 |
| `roll` / `category` を含む実エンドポイント | 130以上 |
| Express へ移植済み | **0**（土台のみ完成） |

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

## ⚠️ 最大の技術的落とし穴: 数値が文字列で返る

PHP の PDO は列を文字列として返す。`mysql2` は数値として返す。

```
PHP     : { "sync": "0", "category": "1", "id": "42" }
Express : { "sync": 0,   "category": 1,   "id": 42 }
```

フロントには両方の書き方が混在している。

```ts
item.sync === 1            // ← 型が変わると常に false になる
Number(item.category) === 1 // ← こちらは影響を受けない
```

**前者は画面が静かに壊れる。目視レビューでは気づけない。**

対策として `src/gateway/phpCompat.ts` に `toPhpRows()` を用意した。すべての値を文字列 / null に変換する。

⚠️ ただし「文字列にすれば必ず一致する」わけではない。

| 型 | PHP | Number 経由 |
|---|---|---|
| `DECIMAL(10,2)` の `1234.50` | `"1234.50"` | `"1234.5"` |
| `DATETIME` | `"2026-09-02 10:30:00"` | `toISOString()` だと9時間ずれる |

金額・小数・日付を含む列は必ず差分比較で確認すること。

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

⚠️ **必ずローカルの Express と本番の PHP を比較する。** 本番の Express と比較しても、まだ登録前なので転送されて同じ結果になり、意味がない。

```powershell
# 【作業者のPC（PowerShell）】
$env:PHP_BASE = "https://khg-marketing.info/dashboard/api/gateway/"
$env:EXPRESS_BASE = "http://localhost:3001/api/gateway"
$env:TOKEN = "<staff.api_token>"

cd backend-express
npm run compare -- --body '{\"request\":\"menu\"}'
```

`✅ 差分なし` になるまで直す。

⚠️ このスクリプトは名前に `insert` `update` `delete` `tag` 等を含むリクエストを自動で拒否する。ただし判定は名前だけなので、**PHPを読んで参照専用だと確認する責任は人間側にある。**

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
| 1 | 参照のみ・単純なもの（`menu` `header` `show_version` `callStatusList`） | 未 |
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
