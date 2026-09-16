# v2.2.126 デプロイ手順

## このリリースの内容

コミットは4本（`79d994ca` / `4ba4980e` / `b50b5ad0` / `10fa5cdf`）。

| 変更 | 場所 |
|---|---|
| `customerTrend`（注文・建売）を Express へ移植 | ② VPS ＋ ① の PHP |
| `CustomerTrendOrder.tsx` の axios 本番URL直書きを `apiClient` へ | ① のフロント |
| 顧客一覧モーダル（`CustomerListModal.tsx`）を新規作成、KPIを clickable 化 | ① のフロント |
| 併売店まとめ（**注文のみ**） | ① のフロント ＋ ① の PHP |
| グラフ配色を Tableau 10 拡張のくすんだ18色へ | ① のフロント |
| `graphData` 等を useMemo 化 | ① のフロント |
| 建売のグラフ系列を表に合わせ、`medium_kaeru.show_graph` で制御 | **SQL** ＋ ① のフロント |
| 紹介反響に「重複」「ブラックリスト」の判定を追加 | **SQL** ＋ ② VPS ＋ ① のフロント |
| `version.ts` を `2.2.126` に更新 | ① のフロント |

### 今回**やること**（前回と違う点）

- ⚠️⚠️ **SQL が2本ある。** 前回（v2.2.125）は無かった。**最初に実行する。**
- ⚠️ `.env.prod` の追記は無い。npm 依存の追加も無い（`--renew-anon-volumes` 不要）。
- ⚠️ 第3のサーバー（`kh-house.jp`）への作業は無い。

---

## サーバーの区別（毎回確認する）

| 呼び方 | 実体 | 役割 |
|---|---|---|
| **① レンタルサーバー** | Xserver 共用 / `khg-marketing.info` | 本番DB・PHP・React。管理は**サーバーパネル**／phpMyAdmin |
| **② VPS** | `162.43.5.127` / `api.khg-marketing.info` | Docker（express-api / caddy / ssh-tunnel）。**SSH** |

---

## ⚠️⚠️ 実行順序は変えてはいけない

```
0. 【① phpMyAdmin】 SQL を2本流す        ← 最初
1. push → GitHub で PR マージ
2. 【② VPS】        Express を更新
3. 【①】            PHP をアップロード
4. 【①】            フロントを build → アップロード  ← 最後
```

**なぜこの順序なのか**

- **SQL を最初にする理由（今回の肝）**

  ⚠️ `medium_kaeru.show_graph` が無いと `Number(undefined)` が NaN になり、
  建売の**表が「全販促媒体 / ホームページ反響計」の2行だけ**、
  グラフも1系列だけになる。**エラーは一切出ない。**

  ⚠️ `inquiry_introductory.duplicate_tag` が無いと「重複」ボタンが
  ② で 500 になり、① へフォールバックして
  **「該当する処理がありません。」**という無関係なメッセージが出る。
  ⚠️ 2026-09-11 にローカルで実際にこれが起きた。原因が分かりにくい。

- **② を ① の PHP より先にする理由**

  ⚠️ ① の許可リストに `customerTrend` を入れた状態で ② が古いと、
  ② が「ループ検知」で 502 を返す。① がフォールバックするので画面は
  動くが、往復が無駄になりログが汚れる。

- **フロントを最後にする理由**

  ② と ① が揃う前にフロントを上げても壊れはしないが、
  「併売店をまとめる」を押しても何も起きないなど、
  **エラーが出ないまま機能だけ効かない**状態になり誤解を招く。

---

## 0. 【① レンタルサーバー】SQL を2本流す

サーバーパネル → phpMyAdmin。**SQL タブに貼って実行**する。

### 0-1. `medium_kaeru.show_graph`

ファイル: `backend/scripts/sql/2026-09-11_medium_kaeru_show_graph.sql`

⚠️⚠️ **先に中身の SELECT を実行して、実データの表記を目で見ること。**

```sql
SELECT `medium` FROM `medium_kaeru` ORDER BY `medium`;
```

⚠️ **`ALLGRIT` という値は存在しない。実データは `公式LINE`。**
画面で ALLGRIT と出ているのは `mediumFormate()` が表示名を差し替えているため。
⚠️ `アットホーム` が `athome` で入っている可能性もある。上の SELECT で確認する。

確認できたらファイルの内容を実行する。

⚠️ **最後の確認クエリで4行返ること。** 4行に満たなければ表記が違う。
0行更新でもエラーは出ないので、必ず目で確かめる。

### 0-2. `inquiry_introductory` の判定列

ファイル: `backend/scripts/sql/2026-09-11_inquiry_introductory_skip_tags.sql`

⚠️ `duplicate_tag` / `blacklist_tag` を追加する。既存行の値は変えない。
⚠️ 最後の確認クエリが **0行**であること（顧客が作られているのにタグが付いた行）。

---

## 1. push → PR マージ

### 【あなたのPC（PowerShell）で実行】

この手順書を含めてコミットする。

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git add docs/deploy-v2.2.126.md
git commit -m "add deploy doc for v2.2.126"
git push origin v2.2.126
```

### ⚠️⚠️ `git push origin HEAD:production` は使わない

PR のマージで `production` にマージコミットが付くため、ローカルのブランチは
`production` の子孫にならない。**構造的に必ず reject される。**

1. `git push origin v2.2.126`（ブランチまで）
2. GitHub で `v2.2.126` → `production` の PR を作る
3. PR をマージする

⚠️ `ReadMeClaude.md` は**コミットしない**。

---

## 2. 【② VPS】Express の更新

```bash
ssh root@162.43.5.127
```

⚠️ 入り直したら毎回張り直す。

```bash
alias dcp='docker compose -f ~/dashboard/docker-compose.prod.yml --env-file ~/dashboard/.env.prod'
```

⚠️⚠️ **素の `docker compose` を使わないこと。** `.env.prod` を読まない。
以前これで caddy が空の `ACME_EMAIL` で作り直され、443 が落ちた。

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git reset --hard FETCH_HEAD
git log --oneline -1
```

⚠️ 手順1の PR マージが**終わってから**実行する。

```bash
dcp build express-api
dcp up -d --force-recreate express-api
dcp ps
```

⚠️ npm 依存を追加していないので `--renew-anon-volumes` は不要。
⚠️ `caddy` / `express-api` / `ssh-tunnel` の3つすべてが `Up` であること。

### 2-1. 取り込み確認

⚠️⚠️ **`shopTrend` や `customerTrend` に認証なしで curl しても
「認証が必要です。」しか返らない**（`auth: 'staff'`）。
v2.2.125 のときこれで手間取った。**ビルド成果物を直接見るのが確実。**

```bash
dcp exec express-api grep -c "customerTrend" dist/gateway/registry.js
dcp exec express-api grep -c "runInquiryIntroductoryTag" dist/gateway/registry.js
```

⚠️ どちらも **1以上**であること。0 なら `git reset --hard` が効いていない。

```bash
dcp logs --tail 300 express-api | grep -E "customerTrend|inquiry_introductory"
```

⚠️ `customerTrend` が3件（既定=order / order / spec）、
`inquiry_introductory` が4件（一覧 / update / sync / **tag**）出ること。

⚠️ **`customerTrend::used` は出ないのが正常。** ① に
`customerTrend_used.php` が無く、そもそも動いていない経路なので
意図的に登録していない。

---

## 3. 【① レンタルサーバー】PHP のアップロード

サーバーパネル → ファイルマネージャ（または FTP）。
配置先は `dashboard/api/gateway/` 配下。

| ローカル | ① の配置先 |
|---|---|
| `backend/src/core/express_proxy.php` | `core/express_proxy.php` |
| `backend/src/handlers/customerTrendAction/customerTrend_order.php` | `handlers/customerTrendAction/customerTrend_order.php` |
| `backend/src/handlers/customerTrendAction/customerTrend_spec.php` | `handlers/customerTrendAction/customerTrend_spec.php` |

⚠️ **この3つだけ。**

⚠️⚠️ `customerTrend_*.php` は普段使われない（② が処理するため）。
動くのは**転送が失敗したときだけ**である。上げ忘れると、
転送失敗時に**併売店まとめが黙って効かなくなる**。
⚠️ 2026-09-11 に実際に転送失敗（`Resolving timed out`）が起きている。

### 確認【あなたのPC（PowerShell）で実行】

⚠️ **PowerShell の `-d "{\"...\"}"` は JSON が壊れる。** ファイル渡しにする。
（v2.2.125 のとき 400「不正なリクエストです。」になった）

```powershell
cd $env:TEMP
'{"request":"customerTrend","category":"order"}' | Out-File -Encoding ascii ct.json
curl.exe -s -D - -o NUL -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" -d "@ct.json"
```

⚠️ 応答ヘッダに **`X-Handled-By: express`** が出ること。
本文が `認証が必要です。` になるのは正常（② まで届いた証拠）。

---

## 4. 【① レンタルサーバー】フロントの build

```powershell
cd C:\Users\shinji-kawano\react\dashboard\frontend
npm run build
```

⚠️ `Compiled with warnings.` は正常。`Failed to compile` なら止めて報告してほしい。

`frontend/build/` の中身を ① の公開ディレクトリへアップロードする。
⚠️ `index.html` の上書き漏れに注意（古い JS を読み続ける）。

---

## 5. 動作確認

⚠️ まず **Ctrl + F5**。バージョン表示が **2.2.126** であること。

### 5-1. 販促媒体別動向（注文）

- ⚠️ グラフの色が**くすんだ色**になっていること
- 数字をクリックして顧客一覧モーダルが開くこと（初回来場日・商談ステップ付き）
- 顧客名をクリックして顧客詳細が開くこと
- 「併売店をまとめる」があること
  ⚠️ `parent_shop` が未設定なら**押しても変わらないのが正常**
- ⚠️ 「ポータル反響のみ表示」を切り替えてグラフが**即座に**変わること
  （以前は1テンポ遅れていた。直った側の挙動）

### 5-2. 販促媒体別動向（建売）

- ⚠️⚠️ **表の行が「全販促媒体 / ホームページ反響計 / SUUMO / HOME'S /
  ALLGRIT / アットホーム」の6行あること。**
  2行しか無ければ **手順0-1 の SQL が効いていない**（0行更新だった）。
- グラフの系列が5つで、表の数字と一致すること
- ⚠️ 「物件案内数推移」ボタンが**消えている**こと
- ⚠️ 「併売店をまとめる」が**無い**こと（建売に併売店の概念は無い）

### 5-3. 紹介キャンペーン反響一覧

- ⚠️ テーブルの左右に余白ができて読みやすくなっていること
- 「同期」ボタンの下に **「重複」「ブラックリスト」** の小さいタブがあること
- 「重複」を押すと未同期から外れること
  ⚠️ **顧客は作られない。**「同期済み」バッジにはならず「解除」になること
- 「解除」を押すと未同期に戻ること
- ⚠️ 絞り込みの「担当店舗」の並びが、行ごとの担当店舗の並びと**揃っている**こと

---

## 参考: Express と ① の出力のバイト比較（未了）

⚠️ `customerTrend` は移植したが、**① と ② の応答をバイト単位で比較できていない。**
ローカルの MySQL に接続できず（`caching_sha2_password.dll` が無い）、
`company` のときのような検算ができなかった。

⚠️ 実施するには `auth: 'staff'` を通す **Token が必要**である。
ブラウザの開発者ツール → Network から、ログイン済みの
`inquiry_introductory` などのリクエストヘッダに付いている `Token` を
コピーして使う。⚠️ **Token は他人に見える場所に貼らないこと。**
（caddy のログでは `Token` ヘッダを削除する設定になっている）

比較する対象:

- ① `https://khg-marketing.info/dashboard/api/gateway/`（`EXPRESS_PROXY_DISABLED=1` を
  一時的に `.htaccess` へ入れれば ① 自身が処理する）
- ② `https://api.khg-marketing.info/api/gateway`

⚠️ 実施しない場合は、**5-1 / 5-2 の画面の数字がデプロイ前と変わらないこと**を
目視で確かめれば実務上は足りる。
⚠️ ただし建売は今回**グラフの判定を表と揃えた**ため、
**グラフの数字は意図的に変わる**（表と一致する方向）。表の数字で比べること。
