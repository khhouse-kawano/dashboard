# v2.2.140 デプロイ手順（2026-09-21）

⚠️ **サーバーは2台ある。どちらで実行するか毎回確認すること。**

| 記号 | 何 | 場所 |
|---|---|---|
| ⚠️ **①** | レンタルサーバー（Xserver 共用） | `khg-marketing.info` / 本番DB・PHP・React |
| ⚠️ **②** | VPS | `162.43.5.127` / `api.khg-marketing.info` / Docker |

---

## ⚠️⚠️ この版は今までと違う。必ず先に読むこと

⚠️⚠️ **`competitor_pdf` テーブルの構造そのものを作り替える。**

⚠️ ⚠️ **SQL・② の Express・① の PHP・① のフロントを、続けて一度に上げること。**
⚠️ ⚠️ **途中で止めると、顧客詳細の「他社資料」が開けなくなる。**

| 順 | 何 | 止めるとどうなるか |
|---|---|---|
| 1 | ① SQL（テーブル作り替え） | ⚠️ **古い PHP が `pdf_path` 列を探して失敗する** |
| 2 | ② Express 再ビルド | ⚠️ **顧客詳細の他社資料が空になる** |
| 3 | ① PHP | 同上（② が落ちたときの受け皿が古いまま） |
| 4 | ① フロント | ⚠️ **古い画面は配列を1件のオブジェクトとして読む** |

⚠️ ⚠️ **利用者の少ない時間に、1〜4 を続けて行うこと。**

---

## リリース内容

| # | 内容 | 対象 |
|---|---|---|
| 1 | ⚠️⚠️ **面談のKPIが登録されない不具合の修正**（⚠️ 物件名つきのアクション） | ⚠️ フロント |
| 2 | ⚠️ **`competitor_pdf` を「1ファイル1行」に作り替え** | ⚠️ **① DB・① PHP・② Express・フロント** |
| 3 | ⚠️ 他社資料の画面を全画面のフォルダ表示に刷新 | ⚠️ フロント |
| 4 | ⚠️ 他社資料の画面から **チラシを登録** | ⚠️ フロント |
| 5 | ⚠️ 既存53ファイルの `company` / `category` を埋める | ⚠️ **① DB** |
| 6 | ⚠️ AIデジタル資金計画書の改修版（⚠️ **段取り表の予定日 `w_dates`**） | ⚠️ **① DB・② Express・フロント** |
| 7 | ⚠️ デジシキ作成を全ユーザーに開放 | ⚠️ フロント |
| 8 | ⚠️ **店舗別推移（注文）の広告単価の分母を修正** | ⚠️ フロント |
| 9 | ⚠️ ブラックリスト一覧の応答が包みごと返っていたのを修正 | ⚠️ **② Express** |

⚠️⚠️ **DB の変更が3つある**（⚠️ v2.2.139 は `update_log` だけだった）。

---

## ⚠️ 手順0　`production` ブランチの位置を確認する

```bash
git fetch origin
git log --oneline origin/production -1
```

⚠️ ⚠️ **v2.2.139 が入っていること。** 入っていなければ先にそちらを ⚠️ **PR でマージする。**

---

## 手順1　push（済み）

```bash
git push -u origin v2.2.140
```

⚠️⚠️ **`git push origin HEAD:production` は使わないこと。** ⚠️ **必ず GitHub の PR でマージする。**

---

## ⚠️ 手順2　PR → `main` と `production`（⚠️ **両方**）

⚠️ ⚠️ **`gh` コマンドはこのPCに入っていない。ブラウザで作ること。**

https://github.com/khhouse-kawano/dashboard/pull/new/v2.2.140

| # | base | head |
|---|---|---|
| 1 | `main` | `v2.2.140` |
| 2 | ⚠️ **`production`** | `v2.2.140` |

⚠️⚠️ **`production` への PR を飛ばすと ② の VPS に新しい Express が入らない。**
⚠️ ⚠️ **v2.2.138 で一度もれている。**

マージ後:

```bash
git fetch origin
git log --oneline origin/production -1
```

---

## ⚠️ 手順3　① で SQL を流す（⚠️ **この順番で**）

### 【① レンタルサーバー（phpMyAdmin）で実行】

⚠️⚠️ **順番を守ること。** ⚠️ 3-2 を飛ばして 3-3 を流すと ⚠️ **1件も更新されない。**

#### 3-1　資金計画書に `w_dates` 列を足す

⚠️ ファイル: `backend/scripts/sql/2026-09-21_funding_plan_w_dates.sql`

```sql
ALTER TABLE funding_plan
  ADD COLUMN w_dates LONGTEXT DEFAULT NULL
  COMMENT '⑨段取り表 STEP2〜7の予定日。FLOWと同じ長さの配列。空文字なら日数から自動計算';
```

⚠️⚠️ **この列が無いと、段取り表の予定日は ⚠️ 保存に成功したように見えて消える。**
⚠️ ⚠️ **エラーは出ない**（許可リストが「列として存在するものだけ」採用するため）。

#### ⚠️ 3-2　`competitor_pdf` を作り替える

⚠️ ファイル: `backend/scripts/sql/2026-09-21_competitor_pdf_one_row_per_file.sql`

⚠️⚠️ **旧テーブルは `competitor_pdf_old_20260921` という名前で残る。消さないこと。**

⚠️ 流し終わったら ⚠️ **件数を確認する。**

```sql
SELECT COUNT(*) AS 新, (SELECT COUNT(*) FROM competitor_pdf_old_20260921) AS 旧
  FROM competitor_pdf;
```

⚠️ ⚠️ **ローカルでは 9,333行 → 53行**（⚠️ **旧の9,301行は PDF が1件も無い空行**）。
⚠️ ⚠️ **本番の数は違う。** ⚠️ **大事なのは「PDFの実体があるものが1件も欠けていないこと」。**

```sql
-- ⚠️ 旧の JSON に入っていた PDF の総数と、新テーブルの行数が一致すること
SELECT SUM(JSON_LENGTH(pdf_path)) AS 旧のPDF数 FROM competitor_pdf_old_20260921
 WHERE pdf_path IS NOT NULL AND pdf_path <> '' AND JSON_VALID(pdf_path);
```

#### 3-3　53ファイルの `company` / `category` を埋める

⚠️ ファイル: `backend/scripts/sql/2026-09-21_competitor_pdf_fill_company_category.sql`

⚠️⚠️ **`no` ではなく `path` で更新している。** ⚠️ `no` は採番なので ⚠️ **① とローカルで一致しない。**

⚠️ 流し終わったら:

```sql
SELECT category, COUNT(*) AS c FROM competitor_pdf GROUP BY category ORDER BY c DESC;
```

⚠️ ⚠️ **見積もり・提案書 52 / チラシ 1** になること（⚠️ ローカル実測）。
⚠️ ⚠️ **本番とローカルで PDF に差があれば数は変わる。**

#### 3-4　`update_log`

⚠️ ファイル: `backend/scripts/sql/2026-09-21_update_log_2.2.140.sql`

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
ls -l backend-express/src/features/competitorPdf.ts
grep -c "w_dates" backend-express/src/features/fundingPlan/columns.ts
grep -c "competitor_pdf" backend-express/src/gateway/registry.ts
grep -n "return result.body" backend-express/src/gateway/registry.ts | head -3
```

⚠️ 1つめが ⚠️ **存在**、2つめが ⚠️ **1以上**、3つめが ⚠️ **1以上**であること。

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

⚠️⚠️ **ホストから `http://localhost:3001` は叩けない。**
⚠️ `docker-compose.prod.yml` が ⚠️ **3001番を `ports` に書いていない**ため
（⚠️ 書くと ⚠️ **Caddy を迂回できてしまう**）。⚠️ ⚠️ **`000` は正常である。**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.khg-marketing.info/api/gateway \
  -H "Content-Type: application/json" -d '{"request":"competitor_pdf"}'
```

⚠️⚠️ **`401` が返れば登録されている。**
⚠️ ⚠️ **`404` なら未登録**（⚠️ ビルドが古い。⚠️ `dcp build` からやり直す）。
⚠️ ⚠️ **`502` ならコンテナが起動していない**（⚠️ `dcp ps` と `dcp logs express-api`）。

---

## ⚠️ 手順5　① へ PHP を上げる

| ファイル | 置き場所 | なぜ |
|---|---|---|
| ⚠️ `backend/src/core/express_proxy.php` | ① の同じパス | ⚠️ `competitor_pdf` を ② へ転送する |
| ⚠️ `backend/src/handlers/competitor_pdf.php` | ① の同じパス | ⚠️ **新しい列に合わせた**（② が落ちたときの受け皿） |
| ⚠️ **`backend/src/handlers/competitor_pdf_upload.php`** | ① の同じパス | ⚠️⚠️ **全消し→入れ直し＋トランザクション。`company`/`category` を保存** |
| ⚠️ `backend/src/handlers/informationAction/information_order.php` | ① の同じパス | ⚠️ **PDF を配列で返す** |
| ⚠️ `backend/src/handlers/informationAction/information_spec.php` | ① の同じパス | 同上 |
| ⚠️ `backend/src/handlers/informationAction/information_used.php` | ① の同じパス | 同上 |

⚠️⚠️ **`competitor_pdf_upload.php` は ② へ移していない。**
⚠️ ⚠️ **ファイルの実体が ① の `uploads/competitors/` にあり、② からは書けない。**

---

## ⚠️ 手順6　① へフロントを上げる

⚠️ ビルド済み: `frontend/build/`

| 何 | 備考 |
|---|---|
| `index.html` | ⚠️ **必ず差し替える**（JSのハッシュが変わっている） |
| `static/js/` | ⚠️ 新しい `main.*.js` |
| `static/css/` | ⚠️ 新しい `main.*.css` |
| ⚠️ **`funding-plan/index.html`** | ⚠️⚠️ **今回まるごと差し替わっている**（改修版の統合） |

⚠️⚠️ **`funding-plan/index.html` を忘れないこと。** ⚠️ **段取り表の予定日はこのファイルの機能である。**

---

## ⚠️ 手順7　動作確認

### ⚠️ 7-1　面談のKPI（⚠️ **この版の主目的**）

⚠️ 顧客詳細 → 面談シート。

| # | 確認 | 期待 |
|---|---|---|
| 1 | ⚠️ **物件名つきのアクション**（`自社契約,○○邸` など）を選んで日付を入れ保存 | ⚠️⚠️ **顧客の該当KPI欄に日付が入る** |
| 2 | 物件名なしのアクション | ⚠️ **今までどおり入る**（変わらない） |
| 3 | ⚠️ **中古**で物件名つきのアクション | ⚠️⚠️ **保存が最後まで通る**（⚠️ 以前は途中で止まっていた） |
| 4 | 歩留まりの画面 | ⚠️ **新しく登録した分が数に入る** |

⚠️⚠️ **過去の取りこぼしは自動では直らない。**
⚠️ ⚠️ **`backend/scripts/sql/2026-09-21_find_kpi_missing_from_interview_log.sql` で
一覧を出せる（⚠️ 抽出のみ。⚠️ 書き換えはしない）。**
⚠️ ⚠️ **【E】で作業テーブル `tmp_steps` を必ず DROP すること。**

### ⚠️ 7-2　顧客詳細の他社資料（⚠️ **テーブルを作り替えた画面**）

| # | 確認 | 期待 |
|---|---|---|
| 1 | ⚠️ **PDF が登録済みの顧客**を開く | ⚠️⚠️ **今までどおり一覧が出る**（⚠️ **消えていないこと**） |
| 2 | 他社名・種別のセレクト | ⚠️ **選べる。既存の値が入っている** |
| 3 | ⚠️ PDF を追加して保存 | ⚠️ **追加される。既存が消えない** |
| 4 | ⚠️ **PDF を1件消して保存** | ⚠️ **その1件だけ消える** |
| 5 | ⚠️ 他社名を変えて保存 → 開き直す | ⚠️ **残っている** |

⚠️⚠️ **4 は必ず確認すること。** ⚠️ **全消し→入れ直し方式なので、ここが壊れると全部消える。**

### ⚠️ 7-3　他社資料の画面（⚠️ **新しい画面**）

⚠️ ヘッダー → 他社動向 → 他社資料。

| # | 確認 | 期待 |
|---|---|---|
| 1 | 開く | ⚠️ **全画面。左上に閉じるボタン** |
| 2 | 既定の表示 | ⚠️ **フォルダ**（種別が4つ＋未分類） |
| 3 | 「見積もり・提案書」を開く | ⚠️ **他社ごとのフォルダが出る** |
| 4 | ⚠️ **0件のフォルダ** | ⚠️ **薄く出る**（⚠️ 消えない） |
| 5 | リストに切り替え | ⚠️ **全件が1枚の表になる** |
| 6 | ⚠️ **検索** | ⚠️⚠️ **フォルダを開いていても全件から探す** |
| 7 | PDFのリンク | ⚠️ **① の URL で開く** |

### ⚠️ 7-4　チラシの登録（⚠️ **新機能**）

| # | 確認 | 期待 |
|---|---|---|
| 1 | 「チラシを登録」 | ⚠️ 入力パネルが開く |
| 2 | PDF を複数選ぶ | ⚠️ **選んだ数だけ行が増える。表示名は拡張子なしのファイル名** |
| 3 | ⚠️ **社名を打つ** | ⚠️⚠️ **候補が手前に出る**（⚠️ **読み仮名でも引ける**） |
| 4 | 登録 | ⚠️ **「N 件のチラシを登録しました。」** |
| 5 | ⚠️ **続けてもう一度登録** | ⚠️⚠️ **前のチラシが消えないこと** |
| 6 | 一覧 | ⚠️ **チラシフォルダに入り、お客様名の欄が「社内登録」** |
| 7 | ⚠️ PDF 以外を選ぶ | ⚠️ **「PDF以外の N 件は登録できないため外しました。」** |

⚠️⚠️ **5 は必ず確認すること。** ⚠️ 登録ごとに id を変えている前提が崩れると ⚠️ **前の分が消える。**

### ⚠️ 7-5　AIデジタル資金計画書

| # | 確認 | 期待 |
|---|---|---|
| 1 | ⚠️ **⑨段取り表の予定日**を入れて保存 → 開き直す | ⚠️⚠️ **予定日が残っている** |
| 2 | 日数を変える | ⚠️ 予定日が自動で計算される |
| 3 | ⚠️ **既存の資金計画書**を開く | ⚠️ **今までどおり開ける**（⚠️ 予定日は空でよい） |
| 4 | ⚠️ **KH久留米店以外のユーザー** | ⚠️⚠️ **デジシキを作成できる** |

⚠️⚠️ **1 が保存されないときは 3-1 の ALTER が流れていない。**

### ⚠️ 7-6　店舗別推移（注文）の広告単価

⚠️ 店舗別推移 → 注文 → ⚠️ **広告費を ON**。

| # | 確認 | 期待 |
|---|---|---|
| 1 | ⚠️ **来場単価・契約単価** | ⚠️⚠️ **今までより安くなる**（⚠️ 分母が増えるため） |
| 2 | ⚠️ **1セルを電卓で検算** | ⚠️⚠️ **総額 ÷ すぐ上の「実来場」件数 と一致する** |
| 3 | 契約単価も同様 | ⚠️ **総額 ÷ すぐ上の「契約」件数** |
| 4 | 昨対 | ⚠️ **同じ考え方で合う** |
| 5 | ⚠️ **まとめ表示（親店舗）** | ⚠️ **上下の数が合う** |
| 6 | ⚠️ 建売・中古の同じ画面 | ⚠️⚠️ **何も変わらない**（⚠️ 元から正しい） |

⚠️ ローカル実測（2026/08・全社）: ⚠️ **実来場の分母 87 → 381**、⚠️ **契約 7 → 54**。

### ⚠️ 7-7　ブラックリスト設定

| # | 確認 | 期待 |
|---|---|---|
| 1 | ヘッダー → 反響管理 → ブラックリスト設定 | ⚠️⚠️ **一覧が出る**（⚠️ 空でないこと） |

### 7-8　変わっていないことの確認

| # | 画面 | 期待 |
|---|---|---|
| 1 | 反響一覧（3事業） | ⚠️ **変わらない** |
| 2 | 建売・中古の広告費 | ⚠️ **変わらない** |
| 3 | 架電状況 | ⚠️ **変わらない** |
| 4 | バージョン表示 | ⚠️ **2.2.140** |

---

## ⚠️ 戻し方

| 何 | どう戻すか |
|---|---|
| ⚠️ **フロント** | ⚠️ 1つ前の `main.*.js` と `index.html` に戻す |
| ⚠️ **② Express** | ⚠️ 1つ前のコミットを checkout して `dcp build` |
| ⚠️ **`competitor_pdf` の request** | ⚠️ ① の `express_proxy.php` から `'competitor_pdf',` の1行を消すだけで ① に戻る |
| ⚠️⚠️ **`competitor_pdf` テーブル** | ⚠️⚠️ **旧テーブルが `competitor_pdf_old_20260921` として残っている** |

```sql
-- ⚠️ テーブルを元に戻す場合（⚠️ PHP とフロントも同時に戻すこと）
RENAME TABLE competitor_pdf TO competitor_pdf_v2_ng,
             competitor_pdf_old_20260921 TO competitor_pdf;
```

⚠️⚠️ **`funding_plan.w_dates` は足しただけなので戻す必要は無い**（⚠️ 古いコードは無視する）。

---

## ⚠️ この版で入っていないもの

| 何 | なぜ |
|---|---|
| ⚠️ 他社資料の画面での ⚠️ **削除・編集** | ⚠️ 指示で「今回は登録だけ」と決めた |
| ⚠️ ⚠️ **`20250218_再来場CP DM.pdf`（自社DM）の扱い** | ⚠️⚠️ **削除するかの判断待ち**（⚠️ 他社資料ではない） |
| ⚠️ `company` が空の7件 | ⚠️ **PDF に社名が無く判断できなかった**（⚠️ 画面から後で入れられる） |

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
| 16 | ⚠️ ⚠️ **`competitor_pdf_old_20260921` をいつ消すか**（⚠️ しばらく残す） |
| 17 | ⚠️ `customer_info.php` と `information_*_add/update.php` に ⚠️ **旧 PDF のブロックが残っている** — ⚠️ 現行のフロントは通らないが、⚠️ **`pdf_path` 列が消えたので触ると壊れる** |
