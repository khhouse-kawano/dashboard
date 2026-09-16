# v2.2.125 デプロイ手順

## このリリースの内容

コミットは `c97c1e34` の1本のみ（ブランチ `v2.2.125`）。

| 変更 | 場所 |
|---|---|
| shopTrend 3画面の顧客一覧モーダルに **初回来場日** と **商談ステップ** を追加、`size` を `xl` に | ① のフロント |
| ShopTrendOrder.tsx に **「併売店をまとめる」** を追加 | ① のフロント |
| `shop_list` の `multi` / `parent_shop` を order の SELECT に追加 | ② VPS ＋ ① の PHP |
| `CustomerTrendOrder.tsx` の型定義の構文誤りを修正 | ① のフロント |
| `version.ts` を `2.2.125` に更新 | ① のフロント |

### 今回**やらないこと**

- ⚠️ **SQL の変更は無い。** `parent_shop` 列は v2.2.124 で追加・確認済み。
  phpMyAdmin での作業は不要。
- ⚠️ **`.env.prod` の追記は無い。** 新しい環境変数は増えていない。
- ⚠️ **npm 依存の追加は無い。** そのため `--renew-anon-volumes` は不要。
- ⚠️ **DNS タイムアウト（`Resolving timed out`）の対策は入っていない。**
  利用者の判断で静観中。このデプロイとは無関係。

---

## サーバーの区別（毎回確認する）

| 呼び方 | 実体 | 役割 |
|---|---|---|
| **① レンタルサーバー** | Xserver 共用 / `khg-marketing.info` | 本番DB・PHP・React の配置先。管理は**サーバーパネル** |
| **② VPS** | `162.43.5.127` / `api.khg-marketing.info` | Docker（express-api / caddy / ssh-tunnel）。**SSH** |

⚠️ 今回 **第3のサーバー（`kh-house.jp`）への作業は無い。**

---

## 実行順序

```
1. コミット → push → GitHub で PR マージ
2. 【② VPS】   Express を更新
3. 【①】       PHP をアップロード
4. 【①】       フロントを build → アップロード   ← 最後
```

**なぜこの順序なのか**

⚠️ 今回は **順序を間違えても画面は壊れない。** 変更が「SELECT に2列足す」
だけで、列が無くても `undefined` になり「まとめが効かない」で済むためである。
それでも上の順序を守るのは、**途中で止めたときに中途半端な状態を残さない**
ためと、確認コマンドが順に効くようにするため。

⚠️ フロントを先に上げると、②/① が古い間は「併売店をまとめる」に
チェックを入れても**何も起きない**。エラーも出ないので、
「実装が壊れている」と誤解しやすい。だから最後にする。

---

## 0. 事前確認

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git branch --show-current
git status --short
```

⚠️ ブランチが `v2.2.125` であること。

**デプロイ前の現状（参考値）**

```powershell
curl.exe -s -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" `
  -d "{\"request\":\"shopTrend\",\"category\":\"order\"}" | findstr /C:"parent_shop"
```

| 確認項目 | デプロイ前 | デプロイ後の期待値 |
|---|---|---|
| `shopTrend` の応答に `parent_shop` | 出ない | 出る |
| `shopTrend` の `X-Handled-By` | `express`（v2.2.122 で移植済み） | `express`（変わらず） |

---

## 1. コミット → push → PR マージ

### 【あなたのPC（PowerShell）で実行】

この手順書を含めてコミットする。

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git add docs/deploy-v2.2.125.md
git commit -m "add deploy doc for v2.2.125"
git push origin v2.2.125
```

### ⚠️⚠️ `git push origin HEAD:production` は使わない

PR のマージで `production` にマージコミットが付くため、ローカルのブランチは
`production` の子孫にならない。**構造的に必ず reject される。**

**正しい手順**

1. `git push origin v2.2.125`（ブランチまで）
2. GitHub で `v2.2.125` → `production` の PR を作る
3. PR をマージする

⚠️ `ReadMeClaude.md` は**コミットしない**。利用者が次の依頼を書くファイルであり、
毎回上書きされる。

---

## 2. 【② VPS】Express の更新

### 2-1. SSH で入る

```bash
ssh root@162.43.5.127
```

### 2-2. `dcp` を用意する

```bash
alias dcp='docker compose -f ~/dashboard/docker-compose.prod.yml --env-file ~/dashboard/.env.prod'
```

⚠️⚠️ **素の `docker compose` を使わないこと。** `.env.prod` を読まない
（自動で読むのは `.env` という名前だけ）。以前これで caddy が空の
`ACME_EMAIL` で作り直され、クラッシュループして 443 が落ちた。

⚠️ alias はシェルを閉じると消える。入り直したら毎回張り直す。

### 2-3. コードを取得

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git reset --hard FETCH_HEAD
git log --oneline -1
```

⚠️ 手順1の PR マージが**終わってから**実行する。

### 2-4. ビルドして再作成

```bash
dcp build express-api
dcp up -d --force-recreate express-api
```

⚠️ 今回は npm 依存を追加していないため `--renew-anon-volumes` は不要。

### 2-5. 起動確認

```bash
dcp ps
```

⚠️ `caddy` / `express-api` / `ssh-tunnel` の3つすべてが `Up` であること。
`Restarting (1)` なら失敗。10秒待って再実行すると確実。

### 2-6. ② に直接投げて確認

```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway \
  -H 'Content-Type: application/json' -H 'Authorization: 4081Kokubu' \
  -d '{"request":"shopTrend","category":"order"}' \
  | head -c 300; echo
```

⚠️ 先頭付近の `"shop":[{...}]` に **`"parent_shop"` と `"multi"` が含まれる**こと。
含まれなければ手順2-3の取得が古い。

⚠️ **`http://localhost:3001` は使えない。** express-api はポートを公開して
いない。VPS の中からでも届かない。必ず `https://api.khg-marketing.info` を使う。

⚠️ `category` を `spec` / `used` にすると `parent_shop` は**出ないのが正常**。
併売店まとめは注文事業（ShopTrendOrder.tsx）だけの機能である。

---

## 3. 【① レンタルサーバー】PHP のアップロード

サーバーパネル → ファイルマネージャ（または FTP）。
配置先は `dashboard/api/gateway/` 配下。

| ローカル | ① の配置先 |
|---|---|
| `backend/src/handlers/shopTrendAction/shopTrend_order.php` | `handlers/shopTrendAction/shopTrend_order.php` |

⚠️ **このファイル1つだけ。** 他の PHP は変更していない。

### ⚠️⚠️ このファイルは普段は使われない。それでも上げること

`shopTrend` は v2.2.122 で ② へ移植済みなので、正常時は ② が処理し、
この PHP は動かない。**動くのは ② への転送が失敗したときだけ**である。

⚠️ 上げ忘れると、転送失敗時に**「併売店をまとめる」が黙って効かなくなる**。
画面はエラーを出さず、チェックを入れても数字が変わらないだけになる。

⚠️ 2026-09-11 に実際に転送失敗（`Resolving timed out`）が発生している。
「どうせ使われない」ではなく、**現に使われる経路**だと考えること。

⚠️ 転送が生きている限り、この PHP が正しいかは**外から確認できない**。
アップロードしたこと自体を、ファイルマネージャ上の更新日時で確かめる。

---

## 4. 【① レンタルサーバー】フロントの build

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard\frontend
npm run build
```

⚠️ `Compiled with warnings.` は正常（既存の警告のみ）。
`Failed to compile` なら止めて報告してほしい。

`frontend/build/` の中身を ① の公開ディレクトリへアップロードする。

⚠️ `index.html` の上書き漏れに注意。漏れると**古い JS を読み続ける**ため、
新機能が出てこない。

---

## 5. 動作確認

### 5-1. バージョン

⚠️ 画面のバージョン表示が **2.2.125** になっていること。
古いままなら手順4のアップロード漏れ（または強制リロード `Ctrl + F5` が必要）。

### 5-2. 顧客一覧モーダル（3画面すべて）

店舗別動向の **注文 / 建売 / 中古** それぞれで、数字をクリックして一覧を開く。

- ⚠️ 列が **No / 顧客名 / 店舗 / 担当営業 / 初回来場日 / ステータス / ランク / 販促媒体 / 商談ステップ** の9つ
- ⚠️ 「来場予約者」「キャンセル」の一覧では、**初回来場日が `-`** になる行があること
  （まだ来場していない顧客なので、これが正しい）
- ⚠️ 「商談ステップ」の**表示**ボタンを押すと InterviewLog が開くこと。
  ⚠️ 3画面とも同じ `InterviewLog` を使うが、**選択肢は顧客の事業に応じて
  サーバが返す**。建売で「申し込み」、中古で「売買契約」が選べること

### 5-3. 併売店をまとめる（注文のみ）

⚠️ **`shop_list.parent_shop` が1件も設定されていなければ、チェックを入れても
何も変わらないのが正常。** これは不具合ではない。

設定してから確認する場合:

1. phpMyAdmin で子店舗の行に `multi = 1`、`parent_shop` に**親店舗名**を入れる
2. 画面で「併売店をまとめる」にチェック
3. ⚠️ 子店舗の**行が消え**、親店舗の数字に合算されること
4. ⚠️ **「注文営業」（合計行）の数字が変わらないこと**
5. ⚠️ 「店舗を選択」のプルダウンからも子店舗が消えること
6. ⚠️ 「広告費を表示」をONにして、親店舗の**総額が子の分だけ増える**こと

⚠️ 手順4が最重要である。合計が減っていたら、どこにも合算されず
**顧客が消えている**。親店舗名の打ち間違い（注文事業に存在しない店舗名）を疑う。

---

## 参考: 実データでの検算が未了

ローカルの MySQL に接続できず（`caching_sha2_password.dll` が無い）、
本番の `shop_list` で検算できていない。合成データでは
「合計が保存される／誤設定でも行が消えない」を確認済み
（`scratchpad/check_multi_merge.cjs`）。

⚠️ 上の 5-3 の手順4を、**本番で必ず実施すること。**
