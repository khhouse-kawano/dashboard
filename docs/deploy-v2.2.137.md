# v2.2.137 ビルド＆デプロイ手順

⚠️⚠️ **v2.2.136 が本番に入っていることが前提。** ⚠️ まだなら [deploy-v2.2.136.md](deploy-v2.2.136.md) を先に。

⚠️ このリリースは ⚠️ **フロント・DB・② VPS・① の PHP のすべてが対象**である。
⚠️ ⚠️ **当初は「フロントと DB だけ」だったが、競合サマリーの Express 化で ② と ① も対象になった。**

---

## このリリースの内容

| # | 内容 | 場所 |
|---|---|---|
| 1 | ⚠️ **建売の販促媒体の表記ゆれを統一**（`medium_kaeru` を基準に寄せる） | フロント |
| 2 | ⚠️ **Instagram・Web検索 を独立した行に出す** | ⚠️ **DB** |
| 3 | KPI を 総反響 → 接触 → **来場** → **申込** → 契約 に。⚠️ **来場率・申込率を追加** | フロント |
| 4 | ⚠️ **契約率の分母を「申込」に変更**（従来は接触数） | フロント |
| 5 | ⚠️ **来場単価を追加**（表・グラフとも） | フロント |
| 6 | ⚠️ **競合サマリーを全画面に**（左上に閉じるボタン・Saas 風の見た目） | フロント |
| 7 | ⚠️ **競合サマリーに総数行**を追加 | フロント |
| 8 | ⚠️ **契約列・失注列をクリックで案件カード**（勝因／敗因） | フロント |
| 9 | ⚠️ **競合サマリーの Express 化** | ⚠️ **② と ①** |

### ⚠️⚠️ 前提（v2.2.136 の DB 変更）

⚠️⚠️ **本番の `master_data` に勝因・敗因の5列が入っていること。**
⚠️ 入っていないと ⚠️ **競合サマリーが `Unknown column` で開かなくなる**（⚠️ **② も ① も同じく失敗する**）。

```sql
SHOW COLUMNS FROM master_data LIKE 'competitor%';
```

⚠️ `competitor_win_reason` / `competitor_price_gap` / `competitor_sales_person` /
`competitor_countermeasure` / `competitor_campaign` が ⚠️ **5つとも見えること。**
⚠️ 無ければ ⚠️ **`2026-09-17_master_data_win_lose.sql` を先に流す**（[deploy-v2.2.136.md](deploy-v2.2.136.md)）。

### 今回**やらないこと**

| 対象 | 変更 |
|---|---|
| ⚠️ `shop/ShopKaeru.tsx`（店舗別広告費） | ⚠️ **無し**（⚠️ 契約率の分母は**接触数のまま**） |
| ⚠️ 注文事業の集計画面 | ⚠️ **無し** |

---

## サーバーの区別

| 呼び方 | 実体 |
|---|---|
| **① レンタルサーバー** | Xserver 共用 / `khg-marketing.info`。⚠️ **phpMyAdmin・FTP** |
| **② VPS** | `162.43.5.127` / `api.khg-marketing.info`。⚠️ **SSH** |

---

## ⚠️ 実行順序

```
0. 【①】 v2.2.136 の5列が入っているか確認   ← ⚠️ 入っていなければ先に流す
1. 【①】 phpMyAdmin で medium_kaeru を更新   ← ⚠️ 先に流してよい
2. push → GitHub で PR マージ
3. 【② VPS】 Express を更新                 ← ⚠️ 競合サマリーの Express 化
4. 【①】 フロントを build → アップロード
5. 【①】 PHP 2ファイルをアップロード
6. 【①】 phpMyAdmin で update_log に1行
```

⚠️ ⚠️ **3 と 5 はどちらが先でもよい。** ⚠️ 競合サマリーは**参照のみ**で、
⚠️ ② が古くても ① へ退避して動く（⚠️ **二重登録の心配は無い**）。

⚠️ ⚠️ **1 を先に流しても、今の画面は壊れない。**
⚠️ 「販促媒体別広告費」の行が2つ増え、⚠️ **「ホームページ反響」の数字がその分だけ減る**だけである。

⚠️ ⚠️ **1 を流さないと、表記を統一しても Instagram と Web検索 が行に出ない**
（⚠️ **大きな販促費が「ホームページ反響」に埋もれたまま**になる）。

---

## 1. 【① レンタルサーバー】`medium_kaeru` の更新

⚠️ phpMyAdmin で `backend/scripts/sql/2026-09-18_medium_kaeru_show_graph_web.sql` を実行する。

```sql
UPDATE medium_kaeru
   SET show_graph = 1
 WHERE medium IN ('Instagram', 'Web検索');
```

### 確認

```sql
SELECT no, medium, show_graph FROM medium_kaeru ORDER BY show_graph DESC, no;
```

⚠️ ⚠️ **`show_graph = 1` が6件**であること。

| 期待される6件 |
|---|
| SUUMO / HOME'S / Instagram / Web検索 / アットホーム / 公式LINE |

⚠️ ⚠️ **`Instagram` と `Web検索` が本番の `medium_kaeru` に無い場合は更新が0件になる。**
⚠️ その場合は ⚠️ **止めて報告してほしい**（⚠️ **行が出ない**）。

---

## 2. push → PR マージ

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git push origin v2.2.137
```

### ⚠️⚠️ `git push origin HEAD:production` は使わない

⚠️ PR のマージで `production` にマージコミットが付くため、ローカルのブランチは
`production` の子孫にならない。⚠️ **構造的に必ず reject される。**

1. `git push origin v2.2.137`
2. GitHub で `v2.2.137` → `production` の PR を作る
3. PR をマージする

---

## 3. 【② VPS】Express の更新

```bash
ssh root@162.43.5.127
```

⚠️ 入り直したら毎回張り直す。

```bash
alias dcp='docker compose -f ~/dashboard/docker-compose.prod.yml --env-file ~/dashboard/.env.prod'
```

⚠️⚠️ **素の `docker compose` を使わないこと。** `.env.prod` を読まない。

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git reset --hard FETCH_HEAD
```

⚠️⚠️ **`--depth 1` なのでコミットは1つしか来ない**（`grafted` と出る）。
⚠️ ⚠️ **コミットの一覧では取り込みを確認できない。ファイルの中身で見る。**

```bash
grep -c "runCompetitor" ~/dashboard/backend-express/src/gateway/registry.ts
ls ~/dashboard/backend-express/src/features/competitor.ts
```

⚠️⚠️ **1以上、かつファイルが見つかれば取り込めている。**
⚠️ `0` やファイルが無ければ手順2（PR のマージ）が終わっていない。⚠️ **ここで止める。**

```bash
dcp build express-api
dcp up -d --force-recreate express-api
dcp ps
```

⚠️ `caddy` / `express-api` / `ssh-tunnel` の3つすべてが `Up` であること。

```bash
dcp logs --tail 200 express-api | grep -iE "Unknown column|error"
```

⚠️ **何も出ないこと。**
⚠️⚠️ **`Unknown column` が出たら手順0（v2.2.136 の5列）が入っていない。**

---

## 4. 【① レンタルサーバー】フロントの build

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard\frontend
npm run build
```

⚠️ `Compiled with warnings.` は正常。⚠️ `Failed to compile` なら止めて報告してほしい。

`frontend/build/` の中身を ① の公開ディレクトリへアップロードする。
⚠️ ⚠️ **`index.html` の上書き漏れに注意**（古い JS を読み続ける）。

⚠️ 画面のバージョンが **2.2.137** になっていること。

---

## 5. 【① レンタルサーバー】PHP のアップロード

⚠️ **2ファイル。**

| 手元 | ① の置き場所 | 内容 |
|---|---|---|
| `backend/src/core/express_proxy.php` | `dashboard/api/gateway/core/express_proxy.php` | ⚠️ 許可リストに `'competitor'` |
| `backend/src/handlers/competitor.php` | `dashboard/api/gateway/handlers/competitor.php` | ⚠️ **6列を追加** |

⚠️⚠️ **`competitor.php` を上げ忘れると、② が落ちて ① へ退避したときだけ
カードの中身が空になる**（⚠️ 列が返らないため）。⚠️ **再現しにくいので必ず上げること。**

---

## 6. 【① レンタルサーバー】更新履歴の追加

⚠️ phpMyAdmin で `backend/scripts/sql/2026-09-18_update_log_2.2.137.sql` を実行する。

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.137', '2026-09-18', '販促媒体別広告費の販促媒体名を統一(建売)。\r\nKPIに来場率・申込率・来場単価を追加(建売)。');
```

⚠️⚠️ **`no` は指定しない**（AUTO_INCREMENT）。

⚠️ 流す前に確認する。

```sql
SELECT `no`, version, date FROM update_log ORDER BY `no` DESC LIMIT 3;
```

⚠️ **既に 2.2.137 があれば実行しない**（重複して2行出る）。

---

## 7. ⚠️ 動作確認

### ⚠️ 7-0. 競合サマリー（他社動向 → 競合サマリー）

| # | 確認 | 期待 |
|---|---|---|
| 1 | 開く | ⚠️ **全画面**／⚠️ **左上に「閉じる」**（⚠️ 右上の × は無い） |
| 2 | 横スクロール | ⚠️ **競合他社名の列と見出し2段が固定されたまま** |
| 3 | ⚠️ **総数行** | ⚠️ 見出しのすぐ下・青い帯・⚠️ **`注文営業全体`** |
| 4 | 営業課／店舗を選ぶ | ⚠️ **`〇〇営業課全体` / `〇〇全体`** に変わる |
| 5 | ⚠️ **契約の数字** | ⚠️ 勝因がある競合だけ**点線の下線が付き押せる** |
| 6 | 契約をクリック | ⚠️ 見出し **`〇〇 契約一覧`**／⚠️ **勝因・価格差（万円）・他社営業**のカード |
| 7 | 失注をクリック | ⚠️ 見出し **`〇〇 失注一覧`**／⚠️ **他決理由・敗因・価格差・他社営業・今後の対策・他社のキャンペーン**のカード |
| 8 | ⚠️ カードの上部 | ⚠️ **店舗と反響媒体の札**（⚠️ **お客様名と担当営業は出ない**） |
| 9 | ページ送り・検索 | ⚠️ **今までどおり** |

⚠️⚠️ **`Unknown column` や真っ白になる場合は手順0（v2.2.136 の5列）が入っていない。**

---

⚠️ ここから下は **建売分譲事業 → 販促媒体別広告費** の画面。

### 7-1. ⚠️ 行が8つになること（最優先）

| 期待される行 |
|---|
| 総反響 / SUUMO / HOME'S / ⚠️ **Instagram** / ⚠️ **Web検索** / アットホーム / 公式LINE / ホームページ反響 |

⚠️⚠️ **同じ名前の行が2つ出ていないこと。**
⚠️ 出ていたら ⚠️ **止めて報告してほしい**（⚠️ **二重計上の疑い**）。

### 7-2. ⚠️ 数字の目安（ローカルの実測・全期間）

⚠️ 本番とは件数が違うが、⚠️ **桁と傾向**を見るのに使ってほしい。

| 行 | 総反響 | 総予算 |
|---|---|---|
| 総反響 | 8,391 | ¥262,924,157 |
| ⚠️ **Web検索** | ⚠️ **5,127** | ⚠️ **¥92,749,561** |
| ⚠️ **Instagram** | 265 | ⚠️ **¥84,719,298** |
| SUUMO | 1,043 | ¥64,510,348 |
| ホームページ反響 | 399 | ¥2,773,222 |

⚠️⚠️ **「ホームページ反響」が大きく減る**（⚠️ 中身が Instagram と Web検索 に移ったため）。
⚠️ **総反響の行は変わらない。**

### 7-3. ⚠️ 列の並び

| 期待 |
|---|
| 販促媒体名 / 総反響 / 接触率 / 接触数 / ⚠️ **来場率** / ⚠️ **来場** / ⚠️ **申込率** / ⚠️ **申込** / 契約率 / ⚠️ **契約** / S / A / B / C / 総予算 / 反響単価 / 接触単価 / ⚠️ **来場単価** / 申込単価 / 契約単価 |

⚠️ ⚠️ **率は「ひとつ左の工程」が分母**である（見出しにマウスを乗せると出る）。

### 7-4. ⚠️ 契約率が変わっていること

⚠️ ⚠️ **分母が「接触数」から「申込」に変わったので、数字は大きくなる。**
⚠️ ローカルでは総反響の行で **10% → 57%**。⚠️ **不具合ではない。**

### 7-5. 並べ替え・グラフ

| 確認 | 期待 |
|---|---|
| 来場率・申込率・来場単価の▲▼ | ⚠️ **並べ替えが効く** |
| 「グラフを表示」 | ⚠️ **5本**（反響／接触／⚠️ **来場**／申込／契約） |

### 7-6. ⚠️⚠️ 変わっていないことの確認

| 画面 | 期待 |
|---|---|
| ⚠️ 注文事業の「販促媒体別広告費」 | ⚠️ **何も変わっていない** |
| ⚠️ 建売の「店舗別広告費」（ShopKaeru） | ⚠️ **何も変わっていない**（⚠️ 契約率の分母は**接触数のまま**） |
| ⚠️ 建売の反響推移 | ⚠️ **何も変わっていない** |

⚠️ ⚠️ **同じ「契約率」でも画面によって数字が違う状態になる。**
⚠️ 揃えたい場合は ⚠️ **別途ご指示ください**（`ShopKaeru.tsx` の改修になる）。

---

## ⚠️ ロールバック

### 画面だけ戻す（⚠️ 推奨）

⚠️ ① のフロントを前のビルドに戻す。⚠️ **これだけで表記統一もKPIも元に戻る。**

### ⚠️ 行を元に戻す

```sql
UPDATE medium_kaeru SET show_graph = 0 WHERE medium IN ('Instagram', 'Web検索');
```

⚠️ ⚠️ **フロントを戻すなら、こちらも戻すこと。**
⚠️ 古いフロントのままだと ⚠️ **Instagram と Web検索 の行が出るが、表記が統一されていないため
中身がほとんど空になる。**

---

## ⚠️ このデプロイのあとに残る宿題

| # | 内容 | 優先 |
|---|---|---|
| 1 | ⚠️ 8サイトの `form/api/index.php` を `form-proxy.php` へ | ⚠️ **最優先** |
| 2 | ⚠️ 8サイトの `form/assets/` から**古い `index-*.js` を削除** | ⚠️ **高** |
| 3 | ⚠️ `form/.htaccess` の設置 | 高 |
| 4 | ⚠️ ① `khg-marketing.info/api/` の `index.php` | 高 |
| 5 | ⚠️ **DBパスワードの変更** | 高 |
| 6 | ⚠️ `projects/sync` の `git push heroku main`（経緯度の修正） | 高 |
| 7 | ⚠️ **複数選択（`Instagram、Web検索` 等）の数え方**（⚠️ 約50件） | 中 |
| 8 | ⚠️ `電話` / `来店` / `メール` / `LINE` を `medium_kaeru` に足すか（⚠️ 計約470件） | 中 |
| 9 | ⚠️ **`ShopKaeru.tsx` の契約率を揃えるか** | 中 |
| 10 | ⚠️ 既に契約済みの935件・競合負けの582件を**いつ埋めるか**（v2.2.136 の宿題） | 中 |
