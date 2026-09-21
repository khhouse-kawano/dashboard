# v2.2.141 デプロイ手順（2026-09-22）

⚠️ **サーバーは2台ある。どちらで実行するか毎回確認すること。**

| 記号 | 何 | 場所 |
|---|---|---|
| ⚠️ **①** | レンタルサーバー（Xserver 共用） | `khg-marketing.info` / 本番DB・PHP・React |
| ⚠️ **②** | VPS | `162.43.5.127` / `api.khg-marketing.info` / Docker |

---

## リリース内容

| # | 内容 | 対象 |
|---|---|---|
| 1 | ⚠️⚠️ **Claudeによる競合分析**（他社動向メニュー） | ⚠️ **① DB・① PHP・② Express・フロント** |
| 2 | ⚠️ **MCP 用の分析API**（`/analysis/competitor`・`/analysis/report`） | ⚠️ **② Express** |
| 3 | ⚠️⚠️ **画面から Claude を実行する経路を廃止**（課金の発生源） | ⚠️ ① PHP・フロント |

⚠️⚠️ **この版のいちばんの目的は費用の削減である。**
⚠️ 画面から競合分析を実行すると ⚠️ **1回あたり数百円**かかっていた。
⚠️ ⚠️ **推論は各自の Claude アカウント（MCP）へ移した。会社の API キーは使わない。**

---

## ⚠️ この版で増えるもの・減るもの

| | |
|---|---|
| ⚠️ **増える** | ⚠️ `analysis_report` テーブル（⚠️ **HTML を本文ごと保存する。1件60KB前後**） |
| ⚠️ **減る** | ⚠️⚠️ **`kpi_analyze` の競合分析。もう実行できない** |

⚠️ ⚠️ **既に保存済みの競合分析（`kpi_analysis_history`）は今までどおり開ける。**
⚠️ 開くのは課金されないため、⚠️ **画面の描画は残してある。**

---

## ⚠️ 手順0　`production` ブランチの位置を確認する

```bash
git fetch origin
git log --oneline origin/production -1
```

⚠️ ⚠️ **v2.2.140 が入っていること。** 入っていなければ先にそちらを ⚠️ **PR でマージする。**

---

## 手順1　push

```bash
git push -u origin v2.2.141
```

⚠️⚠️ **`git push origin HEAD:production` は使わないこと。** ⚠️ **必ず GitHub の PR でマージする。**

---

## ⚠️ 手順2　PR → `main` と `production`（⚠️ **両方**）

⚠️ ⚠️ **`gh` コマンドはこのPCに入っていない。ブラウザで作ること。**

https://github.com/khhouse-kawano/dashboard/pull/new/v2.2.141

| # | base | head |
|---|---|---|
| 1 | `main` | `v2.2.141` |
| 2 | ⚠️ **`production`** | `v2.2.141` |

⚠️⚠️ **`production` への PR を飛ばすと ② の VPS に新しい Express が入らない。**

---

## ⚠️ 手順3　① で SQL を流す

### 【① レンタルサーバー（phpMyAdmin）で実行】

#### 3-1　`analysis_report` テーブルを作る

⚠️ ファイル: `backend/scripts/sql/2026-09-21_analysis_report.sql`

⚠️⚠️ **これを流さないと画面が開かない。** ⚠️ 一覧の取得で落ちる。

⚠️ 流し終わったら:

```sql
SHOW COLUMNS FROM analysis_report;
```

⚠️ ⚠️ **9列**あること（no / title / category / division / period / html / staff / data_as_of / created）。

#### 3-2　`update_log`

⚠️ ファイル: `backend/scripts/sql/2026-09-21_update_log_2.2.141.sql`

⚠️⚠️ **`no` は AUTO_INCREMENT なので指定しない。**

---

## ⚠️ 手順4　② VPS で Express を再ビルドする

### 【② VPS で実行】

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```

⚠️⚠️ **`git fetch --depth 1` はコミットが1つしか来ない（`grafted`）。**
⚠️ ⚠️ **`git log` で取り込みを確認しないこと。** ⚠️ **ファイルの中身を見る。**

```bash
ls -l backend-express/src/features/analysis/competitor.ts
ls -l backend-express/src/features/analysis/report.ts
grep -c "analysis_report_list" backend-express/src/gateway/registry.ts
```

⚠️ 前2つが ⚠️ **存在**、3つめが ⚠️ **1以上**であること。

```bash
dcp build express-api
dcp up -d express-api
dcp ps
```

⚠️⚠️ **`dcp` は alias である。**

```
docker compose -f ~/dashboard/docker-compose.prod.yml --env-file ~/dashboard/.env.prod
```

⚠️ ⚠️ **素の `docker compose` は `.env.prod` を読まない。** ⚠️ **必ず `dcp` を使うこと。**

### ⚠️ 疎通の確認（② で実行）

⚠️⚠️ **ホストから `http://localhost:3001` は叩けない。** ⚠️ **`000` は正常である。**

```bash
# 画面用（gateway）。⚠️ 401 が返れば登録されている
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.khg-marketing.info/api/gateway \
  -H "Content-Type: application/json" -d '{"request":"analysis_report_list"}'

# MCP用。⚠️ Bearer 無しなので 401 が返れば登録されている
curl -s -o /dev/null -w "%{http_code}\n" https://api.khg-marketing.info/api/v1/analysis/competitor
```

⚠️⚠️ **どちらも `401`。**
⚠️ ⚠️ **`404` なら未登録**（⚠️ ビルドが古い。⚠️ `dcp build` からやり直す）。
⚠️ ⚠️ **`502` ならコンテナが起動していない**（⚠️ `dcp ps` と `dcp logs express-api`）。

---

## ⚠️ 手順5　① へ PHP を上げる

| ファイル | なぜ |
|---|---|
| ⚠️ **`backend/src/core/express_proxy.php`** | ⚠️ `analysis_report_*` を ② へ転送する |
| ⚠️ **`backend/src/handlers/kpi_analyze.php`** | ⚠️⚠️ **競合分析の分岐を消した**（課金の発生源） |
| ⚠️ **`backend/src/core/kpi.php`** | ⚠️ 競合分析の節を消した |

⚠️⚠️ **手順4（② の再ビルド）より先に上げないこと。**
⚠️ ② に request が無い状態で許可リストだけ足すと、⚠️ **502 が返って画面にエラーが出る。**

---

## ⚠️ 手順6　① へフロントを上げる

⚠️ ビルド済み: `frontend/build/`

| 何 | 備考 |
|---|---|
| `index.html` | ⚠️ **必ず差し替える**（JSのハッシュが変わっている） |
| `static/js/` | ⚠️ 新しい `main.*.js` |
| `static/css/` | ⚠️ 新しい `main.*.css` |

---

## ⚠️ 手順7　MCP サーバーに道具を足す（⚠️ **別作業**）

⚠️⚠️ **ここはまだ出来ていない。** ⚠️ **② の口を用意しただけである。**

⚠️ Claude Desktop から使うには、MCP サーバーに以下を呼ぶ道具を足す必要がある。

| 呼ぶ先 | 用途 |
|---|---|
| `GET https://api.khg-marketing.info/api/v1/analysis/competitor?division=order&months=12` | データの取得 |
| `GET https://api.khg-marketing.info/api/v1/analysis/report/spec` | ⚠️ **HTML の書き方** |
| `POST https://api.khg-marketing.info/api/v1/analysis/report` | ⚠️ **HTML の保存** |

⚠️ 認証は ⚠️ **`Authorization: Bearer <分析APIキー>`**。
⚠️ ⚠️ **キーは Master のスタッフに紐づく。** ⚠️ 権限が Master でなくなると使えなくなる。

⚠️ ⚠️ **道具が無くても、画面から HTML を手で上げれば使える。**

---

## ⚠️ 手順8　動作確認

### ⚠️ 8-1　画面（他社動向 →〈ロゴ〉による競合分析）

| # | 確認 | 期待 |
|---|---|---|
| 1 | Master で開く | ⚠️ **全画面。左に一覧・右に本文** |
| 2 | ⚠️ **Master 以外** | ⚠️ **メニューに出ない** |
| 3 | ⚠️ **レポートを登録** | ⚠️ HTMLを選ぶ → ⚠️ **見出しが自動で入る** → 登録できる |
| 4 | 一覧 | ⚠️ 事業・期間・登録日・登録者の札が出る |
| 5 | ⚠️⚠️ **開く** | ⚠️ **5段の経過が出てから本文が出る** |
| 6 | ⚠️ **もう一度開く** | ⚠️⚠️ **演出が飛んですぐ出る** |
| 7 | ⚠️ **データの時点** | ⚠️⚠️ **本文の外に常時出ている** |
| 8 | ⚠️ グラフ入りの HTML | ⚠️ **中でスクリプトが動く** |
| 9 | 削除 | ⚠️ 確認ダイアログののち消える |

⚠️⚠️ **5 と 7 は必ず確認すること。**
⚠️ 演出で「いま推論した」ように見えるため、⚠️ **時点の表示が消えると誤解を招く。**

### ⚠️ 8-2　課金が発生しないこと

| # | 確認 | 期待 |
|---|---|---|
| 1 | ⚠️ ヘッダーの「Claudeによる分析」 | ⚠️⚠️ **「競合分析」がグレーアウト（準備中）** |
| 2 | ⚠️ その状態で押す | ⚠️ **押せない** |
| 3 | ⚠️ **`ai_usage_log`** | ⚠️⚠️ **競合分析の行が増えない** |

```sql
SELECT feature, COUNT(*) c, SUM(cost_usd) usd
  FROM ai_usage_log
 WHERE created_at >= CURDATE()
 GROUP BY feature;
```

### 8-3　変わっていないことの確認

| # | 画面 | 期待 |
|---|---|---|
| 1 | ⚠️ **保存済みの分析（履歴）** | ⚠️⚠️ **今までどおり開ける**（⚠️ 競合分析の履歴も） |
| 2 | 反響推移・店舗別・販促媒体別の分析 | ⚠️ **今までどおり実行できる** |
| 3 | 他社資料・競合サマリー | ⚠️ **変わらない** |
| 4 | バージョン表示 | ⚠️ **2.2.141** |

---

## ⚠️ 戻し方

| 何 | どう戻すか |
|---|---|
| ⚠️ **フロント** | ⚠️ 1つ前の `main.*.js` と `index.html` に戻す |
| ⚠️ **② Express** | ⚠️ 1つ前のコミットを checkout して `dcp build` |
| ⚠️ **`analysis_report_*` の request** | ⚠️ ① の `express_proxy.php` から4行を消す（⚠️ **2か所とも**） |
| ⚠️ `analysis_report` テーブル | ⚠️ **残しておいてよい**（他に影響しない） |

⚠️⚠️ **画面内の競合分析を戻したい場合は、`kpi.php` と `kpi_analyze.php` を
1つ前のコミットへ戻すこと。** ⚠️ **ただし課金も戻る。**

---

## ⚠️ この版で入っていないもの

| 何 | なぜ |
|---|---|
| ⚠️⚠️ **MCP サーバー側の道具** | ⚠️ **② の口を用意しただけ**（手順7） |
| ⚠️ `consulting` 権限で全レスポンスを伏字にする | ⚠️ 利用者の判断で次の版へ |
| ⚠️ Express `/analysis` の既存エンドポイントの建売対応 | ⚠️ 同上（⚠️ **競合分析だけは建売に対応済み**） |

---

## ⚠️ 長期の宿題

| # | 内容 |
|---|---|
| 1 | ⚠️ **8サイトの `form/api/index.php` を `form-proxy.php` へ** — ⚠️ **最優先** |
| 2 | ⚠️ 8サイトの古い `index-*.js` 削除 / `form/.htaccess` 設置 |
| 3 | ⚠️ ① `khg-marketing.info/api/` の `index.php` へ差分反映 |
| 4 | ⚠️ **DBパスワードの変更** |
| 5 | ⚠️ `projects/sync` の `git push heroku main` |
| 6 | ⚠️ `medium_kaeru` に `タウンライフ` `電話` `来店` `メール` `LINE` を足すか |
| 7 | ⚠️ 複数選択（`Instagram、Web検索` 等 約50件）の数え方 |
| 8 | ⚠️ `ShopKaeru.tsx` に来場率・申込率・来場単価も足すか |
| 9 | ⚠️ 契約済み935件・競合負け582件の勝因/敗因をいつ埋めるか |
| 10 | ⚠️ 建売の `order_section` が空の 353件 / ¥32,992,445 |
| 11 | ⚠️ `use` に残る「かえる◇◇店」18件 / ¥560,368 |
| 12 | ⚠️ `ShopTrendResale` で「中古住宅専門店」¥24,180,174 が内訳の行に出ない |
| 13 | ⚠️ 期間フィルタが6画面以上に写してある — 共通化するか |
| 14 | ⚠️ `EditBlackList` で9桁以下の電話番号を登録できてしまう |
| 15 | ⚠️ **版ごとに `main` と `production` の両方へ PR を出す運用を徹底する** |
| 16 | ⚠️ `competitor_pdf_old_20260921` をいつ消すか |
| 17 | ⚠️ `customer_info.php` と `information_*_add/update.php` に旧 PDF のブロックが残っている |
| 18 | ⚠️⚠️ **建売分譲事業は競合の記録が実質ゼロ**（実測5件）。⚠️ 入力運用から |
| 19 | ⚠️ `analysis_report` は1件60KB。⚠️ **溜まってきたら古い版の整理を検討** |
