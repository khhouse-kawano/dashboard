# v2.2.136 ビルド＆デプロイ手順

⚠️⚠️ **このリリースは DB の変更を含む。** ⚠️ **SQL を最初に流すこと。**
⚠️ 列が無いまま PHP を上げると、⚠️ **メニューと失注一覧が `Unknown column` で開かなくなる。**

---

## このリリースの内容

| # | 内容 | 場所 |
|---|---|---|
| 1 | 広告費シミュレーターの試算軸（⚠️ **`total` を追加**・選んだ欄だけ編集可） | フロント |
| 2 | Google口コミ集計（⚠️ 「取得本文」列を削除・文言） | フロント |
| 3 | ⚠️ **勝因・敗因の入力**（⚠️ **`master_data` に5列追加**） | ⚠️ DB・フロント・①・② |
| 4 | ⚠️ 失注の「未入力箇所」に**価格差・今後の対策・敗因**を反映 | フロント・①・② |
| 5 | 判定の集約と ⚠️ **`音信普通` の誤字修正** | フロント・①・② |

### 今回**やること**（前回との違い）

⚠️⚠️ **v2.2.135 と違い、今回は ⚠️ ①の PHP も ②の Express も両方変わる。**

| 対象 | 変更 |
|---|---|
| ⚠️ **DB（①）** | ⚠️ **あり**（`master_data` に5列・`update_log` に1行） |
| ⚠️ **① `dashboard/api/gateway/` の PHP** | ⚠️ **あり（4ファイル）** |
| ⚠️ **② VPS の Express** | ⚠️ **あり（再ビルドが必要）** |
| フロント | ⚠️ **あり** |

### 今回**やらないこと**

- ⚠️ ① `khg-marketing.info/api/` の `index.php`（⚠️ **別作業**）
- ⚠️ 8サイトへの `form_get` 配布（⚠️ **別作業・引き続き最優先の宿題**）

---

## サーバーの区別

| 呼び方 | 実体 |
|---|---|
| **① レンタルサーバー** | Xserver 共用 / `khg-marketing.info`。⚠️ **サーバーパネル・phpMyAdmin・FTP** |
| **② VPS** | `162.43.5.127` / `api.khg-marketing.info`。⚠️ **SSH** |

---

## ⚠️ 実行順序

```
1. 【①】 phpMyAdmin で ALTER TABLE     ← ⚠️ 必ず最初
2. push → GitHub で PR マージ
3. 【② VPS】 Express を更新
4. 【①】 フロントを build → アップロード
5. 【①】 PHP 4ファイルをアップロード
6. 【①】 phpMyAdmin で update_log に1行
```

⚠️⚠️ **1 を飛ばさないこと。**
⚠️ 3・5 は ⚠️ **列が既にある前提**で動く。⚠️ 順番を入れ替えると画面が開かなくなる。

⚠️ ⚠️ **1 だけ先に流しても既存の画面は壊れない**（列が増えるだけ）。⚠️ 安全に前倒しできる。

---

## 1. 【① レンタルサーバー】列の追加

⚠️ phpMyAdmin で `backend/scripts/sql/2026-09-17_master_data_win_lose.sql` を実行する。

```sql
ALTER TABLE master_data
  ADD COLUMN competitor_win_reason      TEXT DEFAULT NULL COMMENT '勝因。契約済みのとき必須',
  ADD COLUMN competitor_price_gap       TEXT DEFAULT NULL COMMENT '競合との価格差。契約済み=任意／失注=必須',
  ADD COLUMN competitor_sales_person    TEXT DEFAULT NULL COMMENT '競合の営業担当。任意',
  ADD COLUMN competitor_countermeasure  TEXT DEFAULT NULL COMMENT '今後の対策。競合負けのとき必須',
  ADD COLUMN competitor_campaign        TEXT DEFAULT NULL COMMENT '他社のキャンペーン。任意';
```

⚠️⚠️ **対象は `master_data` だけ。** ⚠️ `master_data_kaeru` / `master_data_resale` には流さない
（⚠️ 入力欄を注文事業にしか出していないため）。

### 確認

```sql
SHOW COLUMNS FROM master_data LIKE 'competitor%';
```

⚠️ ⚠️ **5列とも `text` / `Null=YES` / `Default=NULL`** であること。

---

## 2. push → PR マージ

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git push origin v2.2.136
```

### ⚠️⚠️ `git push origin HEAD:production` は使わない

⚠️ PR のマージで `production` にマージコミットが付くため、ローカルのブランチは
`production` の子孫にならない。⚠️ **構造的に必ず reject される。**

1. `git push origin v2.2.136`
2. GitHub で `v2.2.136` → `production` の PR を作る
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
⚠️ 以前これで caddy が空の `ACME_EMAIL` で作り直され、443 が落ちた。

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git reset --hard FETCH_HEAD
```

⚠️⚠️ **`--depth 1` なのでコミットは1つしか来ない**（`grafted` と出る）。
⚠️ `git log -5` としても**1行しか出ない。それが正常である。**
⚠️ ⚠️ **コミットの一覧では取り込みを確認できない。**

### ⚠️ 取り込めたかは**ファイルの中身**で見る

```bash
grep -c "competitor_win_reason"  ~/dashboard/backend-express/src/features/information/masterDataColumns.ts
grep -c "LOST_REQUIRED_COLUMNS"  ~/dashboard/backend-express/src/features/menu.ts
grep -c "competitor_countermeasure" ~/dashboard/backend-express/src/features/lostList.ts
```

⚠️⚠️ **3つとも 1 以上なら取り込めている。**
⚠️ `0` なら古いまま。⚠️ 手順2（PR のマージ）が終わっていない。⚠️ **ここで止める。**

```bash
dcp build express-api
dcp up -d --force-recreate express-api
dcp ps
```

⚠️ `caddy` / `express-api` / `ssh-tunnel` の3つすべてが `Up` であること。

### 3-1. 起動の確認

```bash
dcp logs --tail 200 express-api | grep -iE "Unknown column|error"
```

⚠️ **何も出ないこと。**
⚠️⚠️ **`Unknown column` が出たら手順1（ALTER TABLE）が流れていない。**

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

⚠️ 画面のバージョンが **2.2.136** になっていること。

---

## 5. 【① レンタルサーバー】PHP のアップロード

⚠️⚠️ **4ファイル。** ⚠️ **`allowed_columns.php` を忘れないこと。**

| 手元 | ① の置き場所 | 内容 |
|---|---|---|
| ⚠️ `backend/src/core/allowed_columns.php` | `dashboard/api/gateway/core/allowed_columns.php` | ⚠️ **5列を書き込み許可**（⚠️ **これが無いと退避時に勝因が保存されない**） |
| `backend/src/handlers/menu.php` | `dashboard/api/gateway/handlers/menu.php` | 失注バッジの条件 |
| `backend/src/handlers/lostList.php` | `dashboard/api/gateway/handlers/lostList.php` | 2列を返す |
| `backend/src/handlers/databaseAction/database_order.php` | `dashboard/api/gateway/handlers/databaseAction/database_order.php` | 2列を返す |

⚠️⚠️ **PHP を上げ忘れると、② が落ちて ① へ退避したときだけ挙動が変わる。**
⚠️ ⚠️ **再現しにくい食い違い**になるので必ず上げること。

---

## 6. 【① レンタルサーバー】更新履歴の追加

⚠️ phpMyAdmin で `backend/scripts/sql/2026-09-17_update_log_2.2.136.sql` を実行する。

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.136', '2026-09-17', '広告費シミュレーターの試算軸を追加(共通)。\r\nGoogle口コミ集計の表示調整(共通)。');
```

⚠️⚠️ **`no` は指定しない**（AUTO_INCREMENT）。

⚠️ 流す前に確認する。

```sql
SELECT `no`, version, date FROM update_log ORDER BY `no` DESC LIMIT 3;
```

⚠️ **既に 2.2.136 があれば実行しない**（重複して2行出る）。

⚠️ ⚠️ **note の文面は勝因・敗因の分も足したい場合は書き換えてよい。**

---

## 7. ⚠️ 動作確認

### 7-1. ⚠️ 勝因の入力（最優先）

⚠️ 注文事業の顧客詳細を開き、ステータスを **契約済み** にする。

| | 期待 |
|---|---|
| 「勝因の入力」 | ⚠️ **出る** |
| 勝因を空のまま保存 | ⚠️ **「必須項目が未入力です:勝因」で止まる** |
| 勝因を入れて保存 | ⚠️ **保存できる** |
| もう一度開く | ⚠️ **入れた値が残っている** |
| 「競合」の選択 | ⚠️ **失注先とまったく同じUI**（候補チップ／入力＋候補／失注先不明） |

### 7-2. ⚠️ 敗因の入力

⚠️ ステータスを **失注** → 失注理由を **競合負け** にする。

| | 期待 |
|---|---|
| 「失注情報の入力」 | ⚠️ **出る**（⚠️ **競合負け以外では出ない**） |
| 空のまま保存 | ⚠️ **敗因 → 価格差 → 今後の対策 の順で止まる** |
| 見出し | ⚠️ **「価格差」「敗因」「今後の対策」「他社のキャンペーン」**（⚠️ キー名が出ていないこと） |

### 7-3. ⚠️⚠️ 建売・中古が壊れていないこと

⚠️⚠️ **必ず確認する。** ⚠️ 列が `master_data` にしか無いため。

| | 期待 |
|---|---|
| 建売（かえる）の顧客詳細 | ⚠️ **新しい欄が出ない** |
| ⚠️ 建売で**保存**する | ⚠️ **保存できる**（⚠️ 500 にならないこと） |
| 中古の顧客詳細 | ⚠️ **同上** |

### 7-4. ⚠️ 失注の「要回答」

| | 期待 |
|---|---|
| 反響一覧（注文）のバッジ | ⚠️ **件数が増える**（⚠️ ローカルでは 39件 → 108件） |
| メニューの失注バッジ | ⚠️ **反響一覧と同じ件数** |
| 失注リスト → **失注登録** | ⚠️ 「価格差未入力」「今後の対策未入力」「敗因未入力」が**出る** |
| 未入力ラベルの並び | ⚠️ **横に折り返す**（行が縦に伸びない） |
| 失注リスト → **失注顧客一覧** | ⚠️ **敗因が空の顧客が出てこない** |
| 1件を埋めて保存 | ⚠️ **どちらの件数も1件減る** |

### 7-5. ⚠️ 失注理由の誤字

| | 期待 |
|---|---|
| 失注リストで **「音信不通」** を選ぶ | ⚠️ **件数が出る**（⚠️ 従来は「音信普通」で必ず0件だった） |
| 顧客詳細の失注理由の選択肢 | ⚠️ **6つとも従来どおり** |

### 7-6. 広告費シミュレーター

| 操作 | 期待 |
|---|---|
| 軸のボタン | ⚠️ **3つ**（広告費総額を修正／反響数を修正／KPI単価を修正） |
| 軸を切り替える | ⚠️ **押した軸の欄だけ入力でき、ほかはグレー＋鍵アイコン** |
| 「広告費総額を修正」で倍 | ⚠️ **4つの件数が倍**／⚠️ **KPI単価は不変** |
| 「反響数を修正」で総反響を倍 | ⚠️ **広告費とほかの件数も倍**／⚠️ **単価は不変** |
| 「KPI単価を修正」で反響単価を半分 | ⚠️ **総反響が倍**／⚠️ **広告費は不変** |

### 7-7. Google口コミ集計

| | 期待 |
|---|---|
| 表 | ⚠️ **「取得本文」列が無い**／⚠️ **右端がずれていない** |
| ボタン | ⚠️ **「取得したレビューを読む（n）」**／⚠️ はみ出していない |

### 7-8. ⚠️ ① への退避（余裕があれば）

⚠️ ② を止めた状態でメニューと失注一覧を開く。

| | 期待 |
|---|---|
| メニューの失注バッジ | ⚠️ **② のときと同じ件数** |
| ⚠️ 顧客詳細の保存 | ⚠️ **502 になる**（⚠️ **これは正しい挙動**。二重登録を防ぐため） |

---

## ⚠️ ロールバック

### 画面だけ戻す（⚠️ 推奨）

⚠️ ① のフロントを前のビルドに戻す。⚠️ **これだけで入力欄は消える。**
⚠️ ⚠️ **列は残してよい。** ⚠️ 余分な列があっても既存の処理は動く。

### ② を戻す

```bash
cd ~/dashboard
git reset --hard <v2.2.135 のコミット>
dcp build express-api && dcp up -d --force-recreate express-api
```

### ⚠️⚠️ 列は消さないこと

⚠️ `DROP COLUMN` は ⚠️ **入力済みの勝因・敗因がすべて消える。**
⚠️ 戻したいだけなら**画面を戻すだけでよい。**

---

## ⚠️ このデプロイのあとに残る宿題

| # | 内容 | 優先 |
|---|---|---|
| 1 | ⚠️ 8サイトの `form/api/index.php` を `form-proxy.php` へ | ⚠️ **最優先** |
| 2 | ⚠️ 8サイトの `form/assets/` から**古い `index-*.js` を削除** | ⚠️ **高** |
| 3 | ⚠️ `form/.htaccess` の設置 | 高 |
| 4 | ⚠️ ① `khg-marketing.info/api/` の `index.php`（メール文面・誤字・`khgShopValue`） | 高 |
| 5 | ⚠️ **DBパスワードの変更** | 高 |
| 6 | ⚠️ `projects/sync` の `git push heroku main`（経緯度の修正） | 高 |
| 7 | ⚠️ 建売の販促媒体の表記整理（⚠️ **複数選択の数え方**） | 中 |
| 8 | ⚠️ `form_table.mail_cc` の khg 14件が `※ここは編集しない` | 中 |
| 9 | ⚠️ 失注理由が NULL の1,179件の扱い（⚠️ **DB の中身**） | 中 |
| 10 | ⚠️ 既に契約済みの935件・競合負けの582件を**いつ埋めるか** | 中 |

⚠️ ⚠️ **10 について**: 今の実装では ⚠️ **開いて保存しようとしたときだけ**必須が効く。
⚠️ 開かなければ何も起きないが、⚠️ **面談・架電の記録を足すだけでも同じ保存ボタンを通る。**
⚠️ 現場から「保存できない」と言われる場合は、⚠️ **「今回ステータスを変えたときだけ必須」**に変更できる
（⚠️ 判定は `statusRequiredError()` の1関数に閉じている）。
