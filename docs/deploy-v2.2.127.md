# v2.2.127 デプロイ手順

## ⚠️⚠️ まず v2.2.126 がデプロイ済みか確認する

`v2.2.126` は production にマージ済み（PR #34）だが、**サーバーへ反映したかは別**である。
未反映なら、このデプロイで **126 と 127 がまとめて出る**。

### 【① レンタルサーバー】phpMyAdmin で確認

```sql
SHOW COLUMNS FROM `medium_kaeru` WHERE `Field` = 'show_graph';
SHOW COLUMNS FROM `inquiry_introductory` WHERE `Field` IN ('duplicate_tag', 'blacklist_tag');
```

| 結果 | 意味 |
|---|---|
| 3行とも返る | ✅ 126 の SQL は実行済み。手順0を飛ばしてよい |
| ⚠️ 1行も返らない | **手順0を必ず実行する** |

⚠️ `show_graph` が無いまま 127 のフロントを上げると、建売の販促媒体別動向の
**表が2行だけ**になる（エラーは出ない）。

---

## このリリースの内容

`origin/production` に無いコミットは5本。

| 変更 | 場所 |
|---|---|
| `shop`（注文・建売）を Express へ移植 | ② VPS ＋ ① の PHP |
| `ShopOrder.tsx` の axios 本番URL直書きを `apiClient` へ | ① のフロント |
| 次アポ単価・次アポ数・次アポ率を追加、列を「数 → 率」に | ① のフロント |
| 単価の棒グラフをモーダルで表示（店舗数で全画面/xl） | ① のフロント |
| 併売店まとめを `ShopOrder.tsx` に追加 | ① のフロント ＋ ① の PHP |
| `ShopKaeru.tsx`（建売の店舗ランキング）を新規作成 | ① のフロント |
| メニューの「店舗別広告費」を建売でも表示 | ① のフロント |
| `inside:list` を Express へ移植、対象店舗に `PGH霧島店` を追加 | ② VPS ＋ ① の PHP |
| `version.ts` を `2.2.127` に更新 | ① のフロント |

### 今回**やらないこと**

- ⚠️ **127 に SQL の変更は無い。** 必要なのは 126 の2本だけ（上の確認参照）。
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
0. 【① phpMyAdmin】 126 の SQL を2本（未実行の場合のみ）  ← 最初
1. push → GitHub で PR マージ
2. 【② VPS】        Express を更新
3. 【①】            PHP を5ファイル
4. 【①】            フロントを build → アップロード       ← 最後
```

**なぜこの順序なのか**

- **② を ① の PHP より先にする理由**

  ⚠️ ① の許可リストに `shop::` と `inside:list` を入れた状態で ② が古いと、
  ② が「ループ検知」で 502 を返す。① がフォールバックするので画面は
  動くが、往復が無駄になりログが汚れる。

- **フロントを最後にする理由**

  ⚠️ `ShopKaeru.tsx`（建売の店舗ランキング）は **② にしか実装が無い**。
  ② が古いままフロントを上げると、建売でメニューから開いても
  **「該当する処理がありません。」**になる。

---

## 0. 【① レンタルサーバー】126 の SQL（未実行の場合のみ）

phpMyAdmin の SQL タブに貼って実行する。

### 0-1. `medium_kaeru.show_graph`

`backend/scripts/sql/2026-09-11_medium_kaeru_show_graph.sql`

⚠️⚠️ **先に中身の SELECT で実データの表記を目で見ること。**

```sql
SELECT `medium` FROM `medium_kaeru` ORDER BY `medium`;
```

⚠️ **`ALLGRIT` という値は存在しない。実データは `公式LINE`**（画面表示だけ
`mediumFormate()` が差し替えている）。`アットホーム` が `athome` の可能性もある。
⚠️ 表記が違うと **0行更新でもエラーが出ず**、建売の表が2行だけになる。

⚠️ 最後の確認クエリで **4行返ること**。

### 0-2. `inquiry_introductory` の判定列

`backend/scripts/sql/2026-09-11_inquiry_introductory_skip_tags.sql`

⚠️ 最後の確認クエリが **0行**であること。

---

## 1. push → PR マージ

### 【あなたのPC（PowerShell）で実行】

この手順書を含めてコミットする。

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git add docs/deploy-v2.2.127.md
git commit -m "add deploy doc for v2.2.127"
git push origin v2.2.127
```

### ⚠️⚠️ `git push origin HEAD:production` は使わない

PR のマージで `production` にマージコミットが付くため、ローカルのブランチは
`production` の子孫にならない。**構造的に必ず reject される。**

1. `git push origin v2.2.127`（ブランチまで）
2. GitHub で `v2.2.127` → `production` の PR を作る
3. PR をマージする

⚠️ `ReadMeClaude.md` は **.gitignore 済み**なのでコミットに混ざらない（v2.2.126 で対応）。

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

⚠️⚠️ **認証なしの curl では「認証が必要です。」しか返らない**（`auth: 'staff'`）。
**ログで確かめるのが確実。**

```bash
dcp logs --tail 400 express-api | grep -E "shop::|inside:list|customerTrend"
```

⚠️ 以下が出ること。

```
🔒 shop::            — 店舗ランキングの初期データ（既定=order）
🔒 shop::order       — 店舗ランキングの初期データ（order）
🔒 shop::spec        — 店舗ランキングの初期データ（spec）
🔒 inside:list:      — インサイドセールスの架電一覧と担当者
🔒 customerTrend::   — 販促媒体別動向の初期データ（既定=order）   ← 126 の分
🔒 customerTrend::order
🔒 customerTrend::spec
```

⚠️ **`shop::used` / `customerTrend::used` は出ないのが正常。** 画面も ① の PHP も
無いので意図的に登録していない。

---

## 3. 【① レンタルサーバー】PHP のアップロード

サーバーパネル → ファイルマネージャ（または FTP）。
配置先は `dashboard/api/gateway/` 配下。

| ローカル | ① の配置先 | 由来 |
|---|---|---|
| `backend/src/core/express_proxy.php` | `core/express_proxy.php` | 126+127 |
| `backend/src/handlers/shopAction/shop_order.php` | `handlers/shopAction/shop_order.php` | 127 |
| `backend/src/handlers/insideAction/inside_list.php` | `handlers/insideAction/inside_list.php` | 127 |
| `backend/src/handlers/customerTrendAction/customerTrend_order.php` | `handlers/customerTrendAction/customerTrend_order.php` | 126 |
| `backend/src/handlers/customerTrendAction/customerTrend_spec.php` | `handlers/customerTrendAction/customerTrend_spec.php` | 126 |

⚠️ **この5つだけ。**
⚠️ 126 を既にアップロード済みなら、下2つは同じ内容なので省いてよい。

### ⚠️⚠️ `shop_order.php` と `customerTrend_*.php` は普段使われない。それでも上げること

② が処理するので、動くのは**転送が失敗したときだけ**である。
⚠️ 上げ忘れると、転送失敗時に**併売店まとめが黙って効かなくなる**
（画面はエラーを出さず、チェックしても数字が変わらないだけになる）。
⚠️ 2026-09-11 に実際に転送失敗（`Resolving timed out`）が起きている。

### ⚠️ `inside_list.php` は普段も使われる可能性がある

⚠️ こちらは `PGH霧島店` の追加が入っている。上げ忘れると、転送失敗時に
**霧島店の架電が一覧に出ない**。

### 確認【あなたのPC（PowerShell）で実行】

⚠️ **PowerShell の `-d "{\"...\"}"` は JSON が壊れる。** ファイル渡しにする。

```powershell
cd $env:TEMP
'{"request":"shop","category":"order"}' | Out-File -Encoding ascii shop.json
curl.exe -s -D - -o NUL -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" -d "@shop.json"
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

⚠️ まず **Ctrl + F5**。バージョン表示が **2.2.127** であること。

### 5-1. 店舗別広告費（注文）

- 列が **総反響 / 来場数 / 来場率 / 次アポ数 / 次アポ率 / 契約数 / 契約率** の順
  ⚠️ 「率 → 数」のままなら古い JS を読んでいる
- 「次アポ数」「次アポ率」の ▲▼ で並べ替えられること
- 単価の列に **次アポ単価** があること（契約単価の左隣）
- 「グラフを表示」でモーダルが開くこと
  - ⚠️ 店舗が12を超えていれば**全画面**、少なければ **xl**
  - ⚠️ 左上と右上の**両方**に閉じるボタン
  - ⚠️ 棒にホバーしたとき **反響 → 来場 → 次アポ → 契約** の順で出ること
    （値の大小で入れ替わらないこと）
  - ⚠️ 4色が**はっきり違う色**（青・緑・橙・赤）であること
- 「併売店をまとめる」があること
  ⚠️ `parent_shop` が未設定なら**押しても変わらないのが正常**

### 5-2. 店舗別広告費（建売）⚠️ 今回の新規

⚠️ 建売でログインし、メニューに **「店舗別広告費」** が出ること。

- 開けること（⚠️ 「該当する処理がありません。」なら ② が古い）
- 列が **総反響 / 接触率 / 接触数 / 来場・案内 / 申込数 / 契約率 / 契約数** であること
- ⚠️ 「併売店をまとめる」が**無い**こと（建売に併売店の概念は無い）
- グラフの系列が **反響単価 / 接触単価 / 申込単価 / 契約単価** であること

### 5-3. インサイドセールス

- ⚠️ **霧島店の架電データが一覧に出ること**（今回の追加）
- 担当者のセレクトに同じ名前が重複しないこと

### 5-4. 126 の分（未デプロイだった場合）

- 販促媒体別動向（建売）の表が **6行**（全販促媒体 / ホームページ反響計 / SUUMO / HOME'S / ALLGRIT / アットホーム）
  ⚠️ 2行しか無ければ手順0-1の SQL が効いていない
- 紹介キャンペーン反響一覧に **「重複」「ブラックリスト」** のタブ
- 販促媒体別動向の数字をクリックして顧客一覧モーダルが開くこと

---

## 参考: 未了の検証

⚠️ `shop` / `customerTrend` とも、**① と ② の応答をバイト単位で比較できていない。**
ローカルの MySQL では `company` のときのような検算ができなかった。

⚠️ 代わりに、**5-1 の数字がデプロイ前と変わらないこと**を目視で確かめれば実務上は足りる。
⚠️ ただし「次アポ数」は今回追加した列なので比較対象が無い。
   来場数・契約数が変わっていないことで判断する。

⚠️ `inside:list` は件数で検算済み（ローカル）。
   4店舗 2,702 → +PGH霧島店 2,924 → +表記ゆれ 2,925。

## ⚠️ 別途お願いしたいこと（データの修正）

`call_sheet` に店舗名の**表記ゆれ**がある（ローカルで確認）。

```sql
SELECT shop, COUNT(*) FROM call_sheet WHERE shop LIKE '%霧島%' GROUP BY shop;
```

⚠️ `PGH霧島店`（222件）と `PG HOUSE霧島店`（1件）の2通り。
今はコード側で両方拾っているが、本来はデータを直すのが筋である。

```sql
-- ⚠️ 実行は任意。直したら inside.ts と inside_list.php から
--    'PG HOUSE霧島店' の行を消してよい
UPDATE `call_sheet` SET `shop` = 'PGH霧島店' WHERE `shop` = 'PG HOUSE霧島店';
```
