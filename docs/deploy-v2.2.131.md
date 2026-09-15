# v2.2.131 デプロイ手順

## このリリースの内容

⚠️ **v2.2.130 はデプロイ済み**（2026-09-15 に確認）。このリリースはその続き。

| 変更 | 場所 |
|---|---|
| **Google 口コミ集計の画面を新設**（ヘッダー → Google口コミ → 口コミ集計） | ① フロント ＋ ② ＋ ① PHP |
| ② に `google_review:summary` を新設（クチコミ本文＋店舗マスタ＋課マスタ） | ② ＋ ① PHP |
| `version.ts` を `2.2.131` に更新 | ① フロント |

### 今回**やらないこと**

- ⚠️ **SQL の変更は無い。**
- ⚠️ `.env.prod` の追記は無い。npm 依存の追加も無い（`--renew-anon-volumes` 不要）。
- ⚠️ ① へ上げる PHP は **`express_proxy.php` の1つだけ**。

---

## ⚠️ この画面は「表示のみ」である

⚠️ データを作るのは **projects/sync の `google_review` タスク**（v2.2.130 で用意した）。
この画面は溜まったものを見るだけで、**書き込みは一切しない。**

⚠️⚠️ **クチコミ本文は Google の仕様で最大5件ずつしか取れない。**
毎回5件を取り、まだ持っていないものを足して溜める形である。
⚠️ そのため **口コミ数（例: 74件）と、表示される本文の数（例: 13件）は一致しない。**
⚠️ 画面にも注記を出してあるが、問い合わせが来たらこの仕様を説明すること。

---

## サーバーの区別（毎回確認する）

| 呼び方 | 実体 | 役割 |
|---|---|---|
| **① レンタルサーバー** | Xserver 共用 / `khg-marketing.info` | 本番DB・PHP・React。管理は**サーバーパネル**／phpMyAdmin |
| **② VPS** | `162.43.5.127` / `api.khg-marketing.info` | Docker（express-api / caddy / ssh-tunnel）。**SSH** |

---

## ⚠️ 実行順序

```
1. push → GitHub で PR マージ
2. 【② VPS】 Express を更新
3. 【①】     PHP を1ファイル（express_proxy.php）
4. 【①】     フロントを build → アップロード   ← 最後
```

**なぜこの順序なのか**

⚠️ フロントは `google_review:summary` が**ある前提**で書いてある。
② と ① の PHP が古いままフロントを上げると、
⚠️ **「口コミを取得できませんでした。」**が出るだけになる。

---

## 1. push → PR マージ

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git push origin v2.2.131
```

### ⚠️⚠️ `git push origin HEAD:production` は使わない

PR のマージで `production` にマージコミットが付くため、ローカルのブランチは
`production` の子孫にならない。**構造的に必ず reject される。**

1. `git push origin v2.2.131`（ブランチまで）
2. GitHub で `v2.2.131` → `production` の PR を作る
3. PR をマージする

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

⚠️ `caddy` / `express-api` / `ssh-tunnel` の3つすべてが `Up` であること。

### 2-1. 取り込み確認

```bash
dcp logs --tail 400 express-api | grep -E "google_review"
```

⚠️ 以下の**3つ**が出ること。

```
   google_review:list:     — Google クチコミ取得の対象店舗と Place ID（本文は返さない）
   google_review:save:     — 【書き込み・フォールバック禁止】Google クチコミの保存（増えた分だけ追記）
🔒 google_review:summary:  — 口コミ集計画面の初期データ（クチコミ本文＋店舗マスタ）
```

⚠️ `summary` にだけ 🔒 が付くのが正常。
画面から呼ぶので `auth: 'staff'`。⚠️ `list` / `save` は projects/sync が
認証ヘッダを送らないため `auth: 'none'`。

---

## 3. 【① レンタルサーバー】PHP のアップロード

配置先は `dashboard/api/gateway/` 配下。

| ローカル | ① の配置先 | 含まれる変更 |
|---|---|---|
| `backend/src/core/express_proxy.php` | `core/express_proxy.php` | 許可リストへの `google_review:summary` 追加 |

⚠️ **この1つだけ。**

⚠️ 上げ忘れると ① が `google_review:summary` を知らず、
**404「該当する処理がありません。」**になる（② に実装があっても転送しない）。

### 確認【あなたのPC（PowerShell）で実行】

```powershell
cd $env:TEMP
'{"request":"google_review","roll":"summary"}' | Out-File -Encoding ascii gs.json
curl.exe -s -D - -o NUL -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" -d "@gs.json"
```

⚠️ 応答ヘッダに **`X-Handled-By: express`** が出ること。
本文が `認証が必要です。` になるのは正常（② まで届いた証拠）。

⚠️ `該当する処理がありません。` なら ① の `express_proxy.php` が古い。

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

⚠️ まず **Ctrl + F5**。バージョン表示が **2.2.131** であること。

### 5-1. メニューに出ること

⚠️ ヘッダーのメニューに **「Google口コミ」** があり、その中に **「口コミ集計」**。

### 5-2. 画面が開くこと

- ⚠️ **全画面**で開くこと（xl だと表の本文の列が潰れる）
- ⚠️ 左右に余白があり、**中央に寄っている**こと
  ⚠️ 横幅いっぱいに広がっていたら古い JS を読んでいる
- ⚠️ 表の**見出しが固定**され、**表だけがスクロール**すること
  ⚠️ 画面外に表が出ていたら CSS が効いていない

### 5-3. 件数

- ⚠️ **31店舗**が並ぶこと
- KPI が「店舗数 31 / 口コミ総数 / 平均評価」
- ⚠️ 平均評価は**口コミ数で加重**した値（単純平均ではない）

### 5-4. 絞り込みの並び順

⚠️ **事業区分**のプルダウンを開く。

| 期待 | 判断 |
|---|---|
| 注文事業 → 建売分譲事業 → 中古リノベ | ✅ `section_list.no` 順 |
| ⚠️ 建売分譲事業 → 中古リノベ → 注文事業 | ⚠️ 名前順のまま。古い JS |

⚠️ **営業課**も `鹿児島営業1課 → 2課 → 3課 → 宮崎 → 大分 → 熊本 → 佐賀・久留米` の順。

### 5-5. 並べ替え

⚠️ **見出しをクリック**して並べ替わること（select は無い）。

- 同じ列を押すと ▲▼ が入れ替わる
- 別の列は▼（降順）から始まる
- ⚠️ 「事業区分」で並べたとき、⚠️ **「国分ハウジング不動産」（マスタ未登録）が
  昇順・降順どちらでも末尾に来て、消えない**こと

### 5-6. クチコミ本文

- 「レビューを読む（13）」で行の下に展開すること
- ⚠️ 日付の**降順**（新しいものが上）
- ⚠️ 本文の改行が反映されていること（`<br>` という文字が**そのまま見えていない**こと）
- 星が**小数第一位**まで見た目に出ること（4.9 と 4.3 で塗りが違う）

### 5-7. ⚠️ 店舗名の表記

⚠️ Google の登録名ではなく **`shop_list` の表記**になっていること。

| Google 側 | 画面 |
|---|---|
| 国分ハウジング 薩摩川内店 | **KH薩摩川内店** |
| PG HOUSE（ピージーハウス）宮崎 | **PGH宮崎店** |
| かえるホーム 国分ハウジンググループ | **鹿児島係** |
| 国分ハウジング不動産 | KH不動産（⚠️ 「店舗マスタ未登録」の印が付く） |

⚠️ ローカル実データで31件すべて検証済み（一致29 / 手当て1 / 絞込外1、重複0）。

---

## ⚠️ ロールバック

① の `core/express_proxy.php` から次の1行を消す。

```php
'google_review:summary',
```

⚠️ これで ① が転送しなくなり、画面は「取得できませんでした」を出すが、
⚠️ **他の機能には影響しない。** ② もフロントも触らなくてよい。

⚠️ メニューごと消したい場合はフロントを前のバージョンに戻す。

---

## 参考: この画面が使うデータの作られ方

```
projects/sync（google_review タスク）
   ↓ Places API (New) で31店舗ぶん取得（本文は最大5件）
   ↓ google_review:save へ送る
   ② が既存と突き合わせ、増えた分だけ追記
   ↓
google_review テーブル
   ↑ google_review:summary
この画面
```

⚠️⚠️ **`reviews` を取ると Place Details Enterprise SKU になり単価が上がる。**
31店舗 × 実行回数ぶん課金されるので、取得は **1日1回程度**にすること。

⚠️ 取得が止まると本文は増えないが、**画面は最後に取得した内容を出し続ける**
（エラーにはならない）。⚠️ 「取得本文」の列が増えないときは sync 側を疑うこと。
