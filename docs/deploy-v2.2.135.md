# v2.2.135 ビルド＆デプロイ手順

⚠️⚠️ **`origin/production` は v2.2.134 の途中（`fab3b026`）で止まっている。**
⚠️ したがって、⚠️ **なごみ・KHG のメール修正も一緒に出る。**
⚠️ [hotfix-nagomi-mail.md](hotfix-nagomi-mail.md) は**この手順で置き換わる**（別々にやらなくてよい）。

---

## このリリースの内容

| # | 内容 | 場所 |
|---|---|---|
| 1 | ⚠️ **なごみ・KHG でメールが1通も飛ばない不具合**の修正 | ② |
| 2 | ⚠️ 来場希望場所が空のとき **`KH店舗未設定`** を入れる | ② |
| 3 | 建売の販促媒体を `show_graph` でまとめる | フロント |
| 4 | 建売の販促費を**実績のある店舗**に限定（⚠️ **−6.9%**） | ② |
| 5 | 建売のメニューから**店舗別広告費**を外す | フロント |
| 6 | 建売のメニューに**販促媒体別広告費**を出す | フロント |

### 今回**やらないこと**

- ⚠️ DB の変更（⚠️ **無し**）
- ⚠️ ① `dashboard/api/gateway/` の PHP（⚠️ **変更無し**）
- ⚠️ ① `khg-marketing.info/api/` の `index.php`（⚠️ **別作業**）
- ⚠️ 8サイトへの `form_get` 配布（⚠️ **別作業**）

---

## サーバーの区別

| 呼び方 | 実体 |
|---|---|
| **① レンタルサーバー** | Xserver 共用 / `khg-marketing.info`。⚠️ **サーバーパネル** |
| **② VPS** | `162.43.5.127` / `api.khg-marketing.info`。⚠️ **SSH** |

---

## ⚠️ 実行順序

```
1. push → GitHub で PR マージ
2. 【② VPS】 Express を更新      ← メールの修正はここで効く
3. 【①】     フロントを build → アップロード
```

⚠️ ⚠️ **2 を先に。** ⚠️ なごみのメールが止まっているので、⚠️ **フロントより優先**。
⚠️ 3 をやらなくても 1・2・4 は効く。

⚠️ ⚠️ **DB は触らない。** ⚠️ 前回入れた4列（`thanks_subject` 等）はそのままでよい。

---

## 1. push → PR マージ

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git push origin v2.2.135
```

### ⚠️⚠️ `git push origin HEAD:production` は使わない

⚠️ PR のマージで `production` にマージコミットが付くため、ローカルのブランチは
`production` の子孫にならない。⚠️ **構造的に必ず reject される。**

1. `git push origin v2.2.135`
2. GitHub で `v2.2.135` → `production` の PR を作る
3. PR をマージする

⚠️ `v2.2.134` のブランチは**もう使わない**（134 の未マージ分は 135 に含まれている）。

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
⚠️ 以前これで caddy が空の `ACME_EMAIL` で作り直され、443 が落ちた。

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git reset --hard FETCH_HEAD
git log --oneline -1
```

⚠️⚠️ **`--depth 1` なのでコミットは1つしか来ない**（`grafted` と出る）。
⚠️ `git log -5` としても**1行しか出ない。それが正常である。**
⚠️ ⚠️ **コミットの一覧では取り込みを確認できない。**

### ⚠️ 取り込めたかは**ファイルの中身**で見る

```bash
grep -c "店舗未設定"     ~/dashboard/backend-express/src/features/campaignForm/entry.ts
grep -c "formTableBrand" ~/dashboard/backend-express/src/features/campaignForm/entry.ts
```

⚠️⚠️ **どちらも 1 以上なら取り込めている。**
⚠️ `0` なら古いまま。⚠️ 手順1（PR のマージ）が終わっていない。⚠️ **ここで止める。**

```bash
dcp build express-api
dcp up -d --force-recreate express-api
dcp ps
```

⚠️ `caddy` / `express-api` / `ssh-tunnel` の3つすべてが `Up` であること。

### 2-1. 起動の確認

```bash
dcp logs --tail 200 express-api | grep -iE "Unknown column|error"
```

⚠️ **何も出ないこと。**

---

## 3. 【① レンタルサーバー】フロントの build

```powershell
cd C:\Users\shinji-kawano\react\dashboard\frontend
npm run build
```

⚠️ `Compiled with warnings.` は正常。⚠️ `Failed to compile` なら止めて報告してほしい。

`frontend/build/` の中身を ① の公開ディレクトリへアップロードする。
⚠️ ⚠️ **`index.html` の上書き漏れに注意**（古い JS を読み続ける）。

⚠️ 画面のバージョンが **2.2.135** になっていること。

---

## 4. ⚠️ 動作確認

### 4-1. ⚠️ なごみのフォームから1件送る（最優先）

⚠️ 送ったらすぐログを見る。

```bash
dcp logs --tail 50 express-api | grep campaign_form
```

| 出る行 | 判定 |
|---|---|
| `campaign_form:entry を受け付けました …` のみ | ⚠️ **成功** |
| ⚠️ `form_table に無い組み合わせです … 引いたキー="…"` | ⚠️ **失敗。引いたキーを控えて報告してほしい** |

| | 期待 |
|---|---|
| サンクスメール | ⚠️ 届く |
| 社内通知メール | ⚠️ 届く。⚠️ **Cc も今までどおり** |
| ⚠️ 差出人名 | ⚠️ **なごみ工務店**（⚠️ `国分ハウジング` ではない） |

### 4-2. ⚠️ KHG 共通フォームも確認する

⚠️⚠️ **同じ原因で止まっていたので必ず別に確認する。**
⚠️ 店舗を**2つ**選んで2回送る（店舗で `brand` と Cc が変わるため）。

| | 期待 |
|---|---|
| `form_table に無い組み合わせ` | ⚠️ **出ないこと** |
| Cc | ⚠️ **選んだ店舗のもの** |
| 差出人名 | ⚠️ **選んだ店舗のブランド名** |

### 4-3. ⚠️ 来場希望場所を聞かないフォームで1件送る

⚠️ 対象は89件ある（kh 49 / djh 28 / pg 6 / 2l 2 / jh 2 / なごみ 2）。

| | 期待 |
|---|---|
| `inquiry_customer.shop` | ⚠️ **`KH店舗未設定`** のようになる |
| ⚠️ 空文字 | ⚠️ **ならないこと** |

⚠️ 反響一覧の画面で店舗欄に出るので、⚠️ **そこで確認できる。**

### 4-4. 他ブランドで後退が無いこと

⚠️ DJH か 2L で1件送り、⚠️ **今までどおりメールが届く**こと。

### 4-5. 建売（spec）の画面

| 確認 | 期待 |
|---|---|
| メニュー | ⚠️ **店舗別広告費が消えている** |
| メニュー | ⚠️ **販促媒体別広告費が出ている** |
| 販促媒体別広告費の行 | ⚠️ **総反響 / SUUMO / HOME'S / アットホーム / 公式LINE / ホームページ反響** の6行 |
| 販促費（総反響の行） | ⚠️ **今までより約6.9%少ない** |

⚠️⚠️ **媒体ごとの数字はまだあてにしないこと。**
⚠️ 反響の**71%**、販促費の**72%**が `medium_kaeru` に無い名前で、どの媒体行にも乗らない。
⚠️ 表記の整理は利用者側で対応中（[task-2026-09-16-16](task-2026-09-16-16-kaeru-media-grouping.md)）。

### 4-6. 注文事業（order）が変わっていないこと

⚠️ 販促媒体別広告費・店舗別広告費を開き、⚠️ **数字が今までと同じ**こと。
⚠️ ⚠️ **order の販促費 SQL は変えていない。** 変わっていたら止めて報告してほしい。

---

## ⚠️ ロールバック

### ② を戻す

```bash
cd ~/dashboard
git reset --hard fab3b026
dcp build express-api && dcp up -d --force-recreate express-api
```

⚠️ ⚠️ **戻すとなごみ・KHG のメールがまた飛ばなくなる。**（反響の保存は続く）

### 画面だけ戻す

⚠️ ① のフロントを前のビルドに戻す。⚠️ ② はそのままでよい。

---

## ⚠️ このデプロイのあとに残る宿題

| # | 内容 | 優先 |
|---|---|---|
| 1 | ⚠️ 8サイトの `form/api/index.php` を `form-proxy.php` へ | ⚠️ **最優先** |
| 2 | ⚠️ 8サイトの `form/assets/` から**古い `index-*.js` を削除** | ⚠️ **高** |
| 3 | ⚠️ `form/.htaccess` の設置（キャッシュ事故の再発防止） | 高 |
| 4 | ⚠️ ① `khg-marketing.info/api/` の `index.php`（⚠️ メール文面・誤字・`khgShopValue`） | 高 |
| 5 | ⚠️ **DBパスワードの変更** | 高 |
| 6 | ⚠️ `projects/sync` の `git push heroku main`（経緯度の修正） | 高 |
| 7 | ⚠️ 建売の販促媒体の表記整理（⚠️ **複数選択の数え方**を決める） | 中 |
| 8 | ⚠️ `form_table.mail_cc` の khg 14件が `※ここは編集しない` | 中 |
