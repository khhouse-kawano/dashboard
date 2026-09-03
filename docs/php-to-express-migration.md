# PHP → Express 移行ガイド

既存のPHPバックエンド（186ハンドラ / 約17,000行）を、**フロントエンドのコードを変更せずに**少しずつ Express へ移す仕組みと手順。

---

## 現状（2026-09-02 時点）

| | 数 |
|---|---|
| PHPハンドラ（`portal/` 除く） | 186ファイル / 約17,000行 |
| フロントが使う `request` の種類 | 72 |
| `roll` / `category` を含む実エンドポイント | 130以上 |
| Express へ移植済み | **7 request**（registry の登録は10件） |

### 移植済み一覧

いずれも ② VPS のコンテナ内で差分比較を行い、`✅ 差分なし` を確認したうえで
① の許可リスト（`backend/src/core/express_proxy.php`）に追加している。

| request | 画面 | 認証 | 移植元 |
|---|---|---|---|
| `menu` | メニューの通知バッジ | `none` | `handlers/menu.php` |
| `header` | ヘッダーの新着物件バッジ | `none` | `handlers/header.php` |
| `update_log` | カテゴリ切替の更新履歴と所属店舗 | `none` | `handlers/update_log.php` |
| `callStatusList` | 架電状況一覧（`order` / `spec` / `used` / 既定の4通りを登録） | `none` | `handlers/callStatusList.php` |
| `kpi_filter_master` | Claude分析の絞り込みマスタ | **`master`** | `handlers/kpi_filter_master.php` |
| `kpi_analysis_list` | 保存済み分析の一覧 | **`master`** | `handlers/kpi_analysis_list.php` |
| `kpi_analysis_get` | 保存済み分析の復元 | **`master`** | `handlers/kpi_analysis_get.php` |

⚠️ `auth` が `none` のものは、**移植元のPHPが認証していない**ためそう宣言している。
「せっかくだから厳しくする」をやると、これまで動いていた画面が突然 401 になる。

### 意図的に移植していないもの

| request | 理由 |
|---|---|
| `kpi_analyze` | Claude API 呼び出し（課金）＋ 2テーブルへ INSERT |
| `kpi_analysis_delete` | DELETE |
| `login` / `get_token` | 失敗すると全員がログインできず、**直すための画面にも入れなくなる**。最後に回す |
| `show_version` | 不一致で `window.location.reload()` するため、形が違うと全員が無限リロードになる |

⚠️ **書き込みを伴う request を ① の許可リストに入れてはいけない。**
自動フォールバックがあるため、② が処理を完了した直後に応答が失われると ① でも実行され、
**二重課金・二重INSERT・二重削除**になる。これらを移すには「フォールバック禁止」を
エントリごとに宣言できる仕組みが先に必要。

---

## Git 運用（2026-09-02 に決定）

⚠️ **GitHub の UI でマージしないこと。** ローカルからの push と混ぜると
リモートにマージコミットが残り、毎回 `production` が分岐する。

```bash
# 【あなたのPC】
git add .
git commit -m "..."
git push origin v2.2.111        # 履歴の保存
git push origin HEAD:production # 本番へ反映
```

`HEAD:production` は「今のブランチの先端をリモートの `production` に進める」という意味。
ローカルに `production` ブランチを持つ必要がない。バージョンを上げてもコマンドは変わらない。

⚠️ fast-forward できない場合は Git が自動で拒否する。**強制せず原因を調べること。**

```bash
# 【② VPS】
cd ~/dashboard && git fetch --depth 1 origin production && git reset --hard FETCH_HEAD && dcp build express-api && dcp up -d --force-recreate express-api
```

⚠️ ① レンタルサーバーは git の経路に乗っていない。**PHPの反映はFTPで手動**。

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

### なりすましも可能

`login.php` は Google の IDトークンを**署名検証していない**。
フロントが `jwtDecode` した結果のメールアドレスだけが届き、PHPはそれを `staff` テーブルと突合する。

```php
$mail = $data['mail'] ?? '';
$stmt = $pdo->prepare("SELECT * FROM staff WHERE mail = ?");
```

| | |
|---|---|
| 防げていること | 社外の無関係な人、`staff` から削除済みの退職者 |
| 防げていないこと | **在籍者のメールアドレスを知っている人が、その人になりすますこと** |

⚠️ 特に問題なのは**権限の昇格**。一般権限の人が Master 権限者のメールアドレスを送れば
Master のトークンが手に入る。メールアドレスは `氏名@kh-group.jp` の規則性があり社内では既知。

⚠️ したがって `auth: 'master'` で守っても「社内の誰でも到達できる」状態は変わらない。
**本命の対策は `login.php` の署名検証**であり、これは移行とは別タスク（`docs/auth-redesign-proposal.md`）。

### ゲートウェイでの認証の扱い（2026-09-02 に変更）

`GatewayAuth` は3段階。⚠️ **`'staff'` / `'master'` は環境変数に関係なく常に検証する。**
宣言したのに効かない状態が一番危険なため。

| 値 | 挙動 | 使う条件 |
|---|---|---|
| `'none'` | 認証しない | 移植元のPHPが認証していない |
| `'staff'` | `Token` でスタッフを特定できることを要求（`requireStaff()` 相当） | 移植元が `requireStaff()` を呼んでいる |
| `'master'` | さらに `staff.brand === 'Master'` を要求（`requireMaster()` 相当） | 移植元が `requireMaster()` を呼んでいる |

`GATEWAY_REQUIRE_AUTH` は意味を変えた。**「認証を有効にするか」ではない。**

| 値 | 挙動 |
|---|---|
| `false`（既定） | 宣言どおり。`'none'` は認証しない |
| `true` | **`'none'` のエントリにも `staff` 認証を要求する**（将来の一括強化用） |

⚠️ `true` にすると `menu` / `header` / `callStatusList` が 401 を返すようになる。
① の `core/db.php` を直すのと**同時に**切り替えるべきもの。

認証情報の受け口は2つ。どちらも実測で確認済み。

| ヘッダ | 備考 |
|---|---|
| `Token: <staff.api_token>` | フロント（`apiClient.ts`）が使う実運用の経路 |
| `Authorization: Bearer <staff.api_token>` | 標準形。今後の外部連携用 |

⚠️ `apiClient.ts` が送る `Authorization: 4081Kokubu` は固定文字列で認証情報ではない。
`Bearer` の形でないため誤認証は起きない。

⚠️ **エラーの形を PHP と1文字も違わないようにしている。** フロントは `response.data.message` を
画面に出すため、形が違うと「エラーメッセージが出ない」という分かりにくい不具合になる。

```
401 { "status": "error", "message": "認証が必要です。" }
403 { "status": "error", "message": "この操作を行う権限がありません。" }
```

実測で 401 のレスポンスは ① と ② で 39バイト完全一致した。

⚠️ **① の `express_proxy.php` は `Token` と `Authorization` を引き継がなければならない。**
落とすと `'staff'` / `'master'` のエンドポイントが必ず 401 になる。

---

## 認証が必要なエンドポイントの比較

⚠️ **トークンを渡さないと両方が 401 を返し、「差分なし」と表示される。これは合格ではない。**

実際にこの罠に2回かかった。比較ツールは 401 / 403 を受けたときに警告を出すようにしてある。

```bash
# 【② VPS】
TOKEN_VALUE='localStorage の token（F12 → Application → Local Storage）'
E="-e PHP_BASE=https://khg-marketing.info/dashboard/api/gateway/ -e EXPRESS_BASE=http://localhost:3001/api/gateway -e TOKEN=$TOKEN_VALUE"
dcp exec $E express-api node dist/cli/compareBackends.js --body '{"request":"kpi_filter_master"}'
```

⚠️ **`api_token` は `staff` テーブルに1列しかない。**

```php
UPDATE staff SET api_token = ? WHERE mail = ?
```

つまり1人につき有効なトークンは常に1本で、**ログインし直すと前のトークンは無効になる**。
ローカルと本番で別々にログインしていると、後からログインした方だけが有効。
「トークンが合っているのに 401」の原因はほぼこれ。

⚠️ トークンはコマンド履歴と ② のプロセス一覧に残る。検証後は一度ログアウトして
再ログインすれば `login.php` が再発行して無効化される。

権限判定が効いているかは以下で確認できる。

```bash
# 【② VPS】期待値: token無し= 401 不正なtoken= 401 Tokenヘッダ= 200 Bearer= 200
dcp exec $E express-api node -e "
const t=process.env.TOKEN;
const post=(h)=>fetch('http://localhost:3001/api/gateway',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},h),body:'{\"request\":\"kpi_filter_master\"}'}).then(r=>r.status);
Promise.all([post({}),post({Token:'invalid'}),post({Token:t}),post({Authorization:'Bearer '+t})])
  .then(([a,b,c,d])=>console.log('token無し=',a,'不正なtoken=',b,'Tokenヘッダ=',c,'Bearer=',d));
"
```

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

### ⚠️ JSON型の列は文字列で返す（`jsonStrings: true`）

mysql2 は既定で JSON 型の列を `JSON.parse` してオブジェクトにするが、**PDO は文字列のまま返す**。

```
PHP     : "family_info": "[{\"name\":\"...\"}]"   ← 文字列
mysql2  : "family_info": [{"name":"..."}]          ← 配列（既定）
```

`callStatusList` の差分比較で `family_info.family_info` の **3,086件**がこれに該当した。
`pool.ts` に `jsonStrings: true` を設定して解決している。

⚠️ フロントは `JSON.parse(family.family_info)` を実行している（`FamilyInfo.tsx`）。
オブジェクトを渡すと例外になる。**この設定を外してはいけない。**

### 一致している他の型

| 型 | 扱い |
|---|---|
| `DATE` / `DATETIME` | `pool.ts` の `dateStrings: true` により文字列のまま返る。PHPと一致 |
| `DECIMAL` | mysql2 も PDO も文字列で返す。一致 |
| `TINYINT(1)` | 両方とも数値（`0` / `1`）。真偽値に変換されない |
| `JSON` | `pool.ts` の `jsonStrings: true` により文字列のまま返る。PHPと一致 |

⚠️ 自分で `new Date()` を挟むとタイムゾーンでずれる。DBから来た日付文字列はそのまま渡すこと。

### 浮動小数点の表記は違うが問題ない

① の PHP は double の**正確な10進展開**を出力する（`php.ini` の `serialize_precision` が大きい）。

```
PHP     : "interview_rate_pct": 27.10000000000000142108547152020037174224853515625
Express : "interview_rate_pct": 27.1
```

⚠️ **パースすれば完全に同じ double になる。** `27.1000...5625` は「27.1 に最も近い double の
正確な値」であり、`JSON.parse` はどちらも同じ数値にする。フロントへの影響はない。

`kpi_analysis_get` で PHP 11,931文字 / Express 9,093文字（24%差）が出たが、原因はこれだけだった。

⚠️ **比較ツールは両方をパースしてから比べるため、この違いを検出できない。**
文字数が大きく違うのに「差分なし」と出たら、必ず次のように実体を確認すること。
推測で片付けてはいけない。

```bash
# 【② VPS】最初に食い違う位置とその前後を出す
dcp exec $E express-api node -e "
const body=JSON.stringify({request:'kpi_analysis_get',id:1});
const h={'Content-Type':'application/json',Token:process.env.TOKEN};
Promise.all([
  fetch(process.env.PHP_BASE,{method:'POST',headers:Object.assign({'X-Forwarded-By':'diag'},h),body}).then(r=>r.text()),
  fetch(process.env.EXPRESS_BASE,{method:'POST',headers:h,body}).then(r=>r.text()),
]).then(([p,e])=>{
  let i=0; while(i<p.length && i<e.length && p[i]===e[i]) i++;
  console.log('最初に違う位置', i);
  console.log('PHP     :', JSON.stringify(p.slice(Math.max(0,i-60), i+80)));
  console.log('Express :', JSON.stringify(e.slice(Math.max(0,i-60), i+80)));
});
"
```

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

### ⚠️ 移植済みを比較すると「PHP側」も Express になる（偽の合格）

① の `express_proxy.php` は許可リストにある request を ② へ転送する。
その状態で素のまま比較すると **Express 同士を比較して必ず「差分なし」になる。**

比較ツールは PHP 側に `X-Forwarded-By: compare-tool` を付けるようにしてある。
このヘッダがあると ① は転送せず自分で処理するため、移植済みでも本来のPHPと比較できる。

⚠️ 手で curl するときも同じヘッダを付けること。忘れると ② の応答を ② と比べることになる。

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
  auth: 'none',   // ⚠️ 移植元が認証していないので 'none'
  handler: async () => runMenu(),
});
```

⚠️ `auth` は**移植元のPHPに合わせる。** `requireStaff()` を呼んでいれば `'staff'`、
`requireMaster()` なら `'master'`、何も呼んでいなければ `'none'`。
ここで勝手に厳しくすると、これまで動いていた画面が突然 401 になる。

⚠️ `roll` / `category` ごとに1件ずつ登録する。ワイルドカードは用意していない。「どれが移植済みか」が曖昧になり、未移植のものが誤って Express に流れる事故を防ぐため。

### 5. ① の許可リストに追加する

`registry.ts` への登録だけでは、**フロントからのリクエストは ② に来ない。**
フロントは今も ① にPOSTしているため、① 側でも転送を許可する必要がある。

```php
// backend/src/core/express_proxy.php
function expressProxyRequests(): array
{
    return [
        'menu',
        // ここに1行足して、このファイルだけをFTPで ① にアップロードする
    ];
}
```

⚠️ **参照のみの request だけを書くこと。** 書き込み系は自動フォールバックで二重実行になる。

確認はレスポンスヘッダで行う。

| ヘッダ | 意味 |
|---|---|
| `X-Handled-By: express` | ② が処理した |
| ヘッダなし | ① が処理した（フォールバックした可能性） |

切り戻しはこの行を消して再アップロードするだけ。**フロントの再ビルドは不要で数秒で戻る。**
全停止は `.htaccess` に `SetEnv EXPRESS_PROXY_DISABLED 1` の1行。

### 6. デプロイして確認

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

### 7. 問題が起きたら

**まず ① の `expressProxyRequests()` から該当行を消してアップロードする。** これが最速（数秒）。

`registry.ts` の `register()` を消して再デプロイする方法もあるが、ビルドが必要で数分かかる。
急いでいるときは ① 側で止めること。

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
| **1** | 参照のみ・単純なもの | `menu` `header` `update_log` `callStatusList` **完了** |
| **1.5** | 認証の宣言を効かせる（`'staff'` / `'master'`） | **完了** |
| **2** | KPI分析の参照系 | `kpi_filter_master` `kpi_analysis_list` `kpi_analysis_get` **完了** |
| 3 | 一覧系（`list` `database` `inside` `shop`） | 未 |
| 4 | 集計系（`rank` `shopTrend` `customerTrend` `company` `survey`） | 未 |
| 5 | 更新系（`information` の add / update、`kpi_analyze`）| 未 |
| 6 | 外部連携（`suumo` `athome` `homes` `allgrit` `meta_ads`） | 未 |
| 7 | `login` / `get_token` / `show_version` | **最後** |

⚠️ **更新系を最後にする理由**は、失敗したときにデータが壊れるため。参照系なら間違っても画面表示が変になるだけで済む。

⚠️ フェーズ5には763行のPHPファイル（`information_used_add.php`）が含まれる。1ファイルで数日かかる規模であり、安易に着手しないこと。

⚠️ フェーズ5に着手する前に「フォールバック禁止」をエントリごとに宣言できる仕組みが必要。
現状のまま更新系を許可リストに入れると二重実行になる。

### フェーズ5の前提: フォールバック禁止の仕組み

書き込み系を安全に転送するには、失敗時に ① で実行し直さず**エラーを返す**選択肢が必要になる。

| | 参照系（現状） | 書き込み系（必要な挙動） |
|---|---|---|
| ② が失敗 | ① で処理する | **エラーを返す**（① では実行しない） |
| 利用者から見て | 気づかない | エラー表示。再実行は本人の判断 |

⚠️ トレードオフは明確で、**「二重実行のリスク」と「② の障害が画面に出る」の交換**である。
書き込みでは後者を選ぶべき。

---

## 未着手の課題

| | 内容 | 影響 |
|---|---|---|
| 1 | `login.php` が Google IDトークンを検証していない | **なりすましと権限昇格が可能**。`docs/auth-redesign-proposal.md` |
| 2 | `core/db.php` が `Authorization` を検証していない | URLを知っていれば顧客情報が取得できる |
| 3 | サーバー側でトークンの有効期限を判定していない | 漏れたトークンが無期限に使える |
| 4 | `server.ts` の起動時 `pingDatabase()` が失敗で終了する | SSHトンネル断で **PHPへの転送すら止まる** |
| 5 | `.gitignore` に conflict marker（`=======`）が残っている | 後ろのルールが勝つため動いてはいる |
| 6 | Linuxを操作できる人が1人 | 障害時に復旧できる人が不在になりうる |

⚠️ 4 はゲートウェイができた今、設計上の弱点になっている。DBに繋がらなくても
**PHPへの転送だけは続けられるべき**なので、起動時は警告のみにする選択肢がある（未決定）。

---

## ファイル構成

```
backend-express/src/
├── gateway/
│   ├── types.ts        … 型定義とキーの組み立て
│   ├── registry.ts     … 移植済みエンドポイントの登録表
│   ├── index.ts        … 振り分けルーター
│   ├── auth.ts         … PHP と同形の 401 / 403 を返す認証・認可
│   ├── phpFallback.ts  … ① レンタルサーバーへの転送
│   └── phpCompat.ts    … PHP と同じ形のJSONを作るヘルパー
├── cli/
│   └── compareBackends.ts … 差分比較スクリプト
└── features/           … 業務ロジック
    ├── menu.ts
    ├── header.ts
    ├── updateLog.ts
    ├── callStatusList.ts
    └── kpi/
        ├── divisions.ts … 部門定義のみ（core/kpi.php 685行は移植していない）
        ├── master.ts    … kpi_filter_master
        └── history.ts   … kpi_analysis_list / kpi_analysis_get
```

① 側:

```
backend/src/
├── index.php            … 転送の判定を3行追加
└── core/
    └── express_proxy.php … 許可リストと転送処理（切り戻しはここ1ファイル）
```

## 環境変数

| 変数 | 既定 | 説明 |
|---|---|---|
| `PHP_GATEWAY_URL` | なし | 未移植の転送先。**① レンタルサーバーのURL** |
| `PHP_GATEWAY_TIMEOUT_MS` | 120000 | 転送のタイムアウト |
| `GATEWAY_REQUIRE_AUTH` | false | **`'none'` のエントリにも認証を要求するか**（`'staff'`/`'master'` は常に検証） |

⚠️ `PHP_GATEWAY_URL` に ② VPS 自身のURL（`api.khg-marketing.info`）を設定すると**無限ループ**になる。

① 側（`.htaccess` の `SetEnv`）:

| 変数 | 既定 | 説明 |
|---|---|---|
| `EXPRESS_API_URL` | `https://api.khg-marketing.info/api/gateway` | 転送先。通常は変更不要 |
| `EXPRESS_PROXY_DISABLED` | なし | `1` にすると転送を全停止。**緊急停止用** |

---

## ループ検知（両側）

① が ② へ転送し、② が未登録のものを ① へ転送し返すため、対策が無いと無限ループになる。

| 側 | 対策 |
|---|---|
| ① | `X-Forwarded-By` が付いていたら転送しない |
| ② | `X-Forwarded-By` に `xserver-php` が含まれ、かつ未登録なら **502 を返す**（転送し返さない） |

⚠️ ② が 502 を返すと ① が自動フォールバックするため、**画面は止まらない。**

⚠️ 実際に起こりうるのは「① の許可リストには入れたが ② のビルドが古い」状態。
**デプロイは必ず ② → ① の順**で行うこと。
