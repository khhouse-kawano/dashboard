# v2.2.133 デプロイ手順

⚠️⚠️ **v2.2.132 も一緒に出る。** `origin/production` は **v2.2.131** で止まっており、
`v2.2.133` ブランチには **132 の分（キャンペーンフォームの Express 化）も入っている**。
⚠️ 132 だけを先に出すことはできない（同じ枝の上にある）。

---

## このリリースの内容

| # | 内容 | 画面 |
|---|---|---|
| 1 | キャンペーンフォームの Express 化（`form_table`） | キャンペーン作成 |
| 2 | ⚠️ **公開フォームからのメールヘッダ注入を塞ぐ** | （サーバー側） |
| 3 | サンクスメール・通知メールの**文面編集** | キャンペーン作成 |
| 4 | 他社広告ライブラリの検索・集計 | 他社動向/他社広告ライブラリ |
| 5 | 失注一覧の Express 化（⚠️ 14.3MB → 1.5MB） | 失注一覧 |
| 6 | キャンペーン別集計の Express 化 | キャンペーン集計 |
| 7 | 「口コミ数」→「レビュー数」＋注意書き | Google 口コミ集計 |
| 8 | ⚠️ フォーム作成の**必須チェックが設定を読むように** | フォーム作成 |
| 9 | 失注先「不明」ボタン | 顧客詳細 |

### 今回**やらないこと**

- ⚠️ 8サイトへの `form-proxy.php` 配布（⚠️ **別作業**。この手順には含めない）
- ⚠️ `react/form_get` の再ビルドと配布（⚠️ **別作業**）
- ⚠️ ① `khg-marketing.info/api/` の `index.php` 改修（⚠️ **別作業**）

⚠️ これらを**やらなくてもこのデプロイは完結する**。⚠️ 公開フォームは今までどおり
① 経由で動き続ける。

---

## サーバーの区別（毎回確認する）

| 呼び方 | 実体 | 役割 |
|---|---|---|
| **① レンタルサーバー** | Xserver 共用 / `khg-marketing.info` | 本番DB・PHP・React。管理は**サーバーパネル**／phpMyAdmin |
| **② VPS** | `162.43.5.127` / `api.khg-marketing.info` | Docker（express-api / caddy / ssh-tunnel）。**SSH** |

---

## ⚠️ 実行順序

```
0. 【①】     DB に列を4つ足す        ← 最初
1. push → GitHub で PR マージ
2. 【② VPS】 .env.prod の CORS_ORIGINS
3. 【② VPS】 Express を更新
4. 【①】     PHP を3ファイル
5. 【①】     フロントを build → アップロード   ← 最後
```

⚠️⚠️ **0 を飛ばすと、キャンペーンフォームが全部落ちる。**
② の `campaign_form` は `thanks_subject` などを **SELECT する**。
列が無いと `Unknown column` で `list` / `detail` / `entry` すべてが 500 になる。
⚠️ **反響の受付（entry）も止まる。**

⚠️ 5 を先にやると、画面だけ新しくなって「取得できませんでした」が出る。

---

## 0. 【① レンタルサーバー】DB に列を足す

phpMyAdmin で本番DBを選び、`backend/scripts/sql/2026-09-16_form_mail_template.sql`
の中身を実行する。

```sql
ALTER TABLE form_table
  ADD COLUMN thanks_subject   TEXT     NOT NULL DEFAULT '' COMMENT 'サンクスメールの件名。空なら既定',
  ADD COLUMN thanks_body      LONGTEXT NOT NULL DEFAULT '' COMMENT 'サンクスメールの本文。空なら既定',
  ADD COLUMN internal_subject TEXT     NOT NULL DEFAULT '' COMMENT '社内通知メールの件名。空なら既定',
  ADD COLUMN internal_body    LONGTEXT NOT NULL DEFAULT '' COMMENT '社内通知メールの本文。空なら既定';
```

⚠️⚠️ **`DEFAULT ''` を削らないこと。**
① の `khg-marketing.info/api/` にある `form_post` は**この4列を知らないまま INSERT する**。
既定値が無いと **キャンペーンの新規登録がまるごと失敗する**。

⚠️ **既存の272件に本文を入れてはいけない。** 空＝既定という仕様。
入れてしまうと、⚠️ **将来ひな型を直しても古い本文が全件に残り続ける。**

### 確認

```sql
SHOW COLUMNS FROM form_table LIKE '%_subject';
SHOW COLUMNS FROM form_table LIKE '%_body';
```

⚠️ 4行出て、`Default` が空文字（`''`）になっていること。

```sql
SELECT COUNT(*) FROM form_table
 WHERE thanks_subject <> '' OR thanks_body <> ''
    OR internal_subject <> '' OR internal_body <> '';
```

⚠️ **0 であること。**

---

## 1. push → PR マージ

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git push origin v2.2.133
```

### ⚠️⚠️ `git push origin HEAD:production` は使わない

PR のマージで `production` にマージコミットが付くため、ローカルのブランチは
`production` の子孫にならない。**構造的に必ず reject される。**

1. `git push origin v2.2.133`（ブランチまで）
2. GitHub で `v2.2.133` → `production` の PR を作る
3. PR をマージする

⚠️ `v2.2.132` のブランチは push していない。⚠️ **不要**（133 に含まれている）。

---

## 2. 【② VPS】`.env.prod` の CORS_ORIGINS

```bash
ssh root@162.43.5.127
```

⚠️ `.env.prod` は**公開ディレクトリの外**にある。編集前に控えを取る。

```bash
cp ~/dashboard/.env.prod ~/env.prod.$(date +%Y%m%d)
```

現在の値（`.env.prod.example` と同じなら）:

```
CORS_ORIGINS=https://khg-marketing.info,https://k-snap.jp,https://kh-house.jp
```

⚠️ ここへ**足りない6サイト**を加える（カンマ区切り、⚠️ **既存の3つは消さない**）。

```
https://day-just-house.com
https://www.nagomi-koumuten.jp
https://furukomi-home.com
https://2lhome.net
https://miyazaki.pg-house.jp
https://jusfy-home.com
```

⚠️ `kh-house.jp` は**既に入っている**。⚠️ khg 共通フォームも同じドメイン配下
（`kh-house.jp/khg/form/`）なので、追加は要らない。

⚠️⚠️ **既にある3つを消さないこと。**
⚠️ `kh-house.jp` は**アンバサダー反響フォーム**が ② を直接叩いている。
消すと ⚠️ **反響が1件も届かなくなる**。しかも社内では何も起きないので気づけない。

⚠️ この段階では8オリジンはまだ使われない（公開フォームは ① 経由のまま）。
⚠️ **先に入れておく**のは、form_get を配布する日に慌てないため。

---

## 3. 【② VPS】Express の更新

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

### 3-1. 取り込み確認

```bash
dcp logs --tail 600 express-api | grep -E "campaign_form|meta_ads|lostList|campaignSummary"
```

⚠️ 以下の**11個**が出ること。

```
   🔒 campaign_form:detail:  — キャンペーンフォーム1件の設定（編集用）
      campaign_form:entry:   — 【書き込み・認証なし】公開フォームからの反響受付（inquiry_customer）
   🔒 campaign_form:insert:  — 【書き込み】キャンペーンフォームの新規登録
   🔒 campaign_form:list:    — キャンペーンフォームの一覧（ブランド別）
   🔒 campaign_form:master:  — ブランドごとのフォーム既定値（form_database）
      campaign_form:public:  — 【認証なし】公開フォームの設定（通知先は返さない）＋表示記録
   🔒 campaign_form:update:  — 【書き込み】キャンペーンフォームの更新
   🔒 campaignSummary::      — キャンペーン別の反響〜契約の集計
   🔒 lostList::             — 失注一覧（未入力の失注理由・失注先の確認用）
   🔒 meta_ads:bookmark:     — 【書き込み】他社広告のブックマーク
   🔒 meta_ads:list:         — 他社広告ライブラリの一覧（バナー・広告主・エリア）
```

⚠️⚠️ **`entry` と `public` にだけ 🔒 が付かないのが正常。**
公開フォームが叩くので `auth: 'none'`。⚠️ ここに 🔒 が付いていたら**反響が止まる**。

### 3-2. ⚠️ DB の列が見えているか

```bash
dcp logs --tail 200 express-api | grep -i "Unknown column"
```

⚠️ **何も出ないこと。** 出たら手順0 が未実施。

---

## 4. 【① レンタルサーバー】PHP のアップロード

| ローカル | ① の配置先 | 含まれる変更 |
|---|---|---|
| `backend/src/core/express_proxy.php` | `dashboard/api/gateway/core/express_proxy.php` | 許可リストに9件追加 |
| `backend/src/handlers/customer_address.php` | `dashboard/api/gateway/handlers/customer_address.php` | 更新行数を返す |
| `backend/src/handlers/geoCode.php` | `dashboard/api/gateway/handlers/geoCode.php` | ⚠️ コメントのみ |

⚠️ 許可リスト（`expressProxyRequests()`）に増えるのは次の**9つ**。

```
campaign_form:list
campaign_form:detail
campaign_form:insert
campaign_form:update
campaign_form:master
meta_ads:list
meta_ads:bookmark
lostList
campaignSummary
```

⚠️⚠️ **`meta_ads:bookmark` は `expressProxyExclusive()` にも入っている**（フォールバック禁止）。
⚠️ ① に `meta_ads.php` が実在し、⚠️ 転送に失敗して ① にも流れると
**ブックマークが二重に更新される経路**ができるため。⚠️ 片方だけ写さないこと。

⚠️ ⚠️ **`campaign_form:public` と `campaign_form:entry` は入れないこと。**
⚠️ あの2つは公開フォームが ② を直接叩くためのもので、
⚠️ ここに入れても使われず、**認証なしの口を ① 側にも増やすだけ**になる。

⚠️ 上げ忘れると ① が転送せず、**404「該当する処理がありません。」**になる
（② に実装があっても届かない）。

⚠️⚠️ **`backend/forms/` の2つは ① には置かない。**
`form-proxy.php` は**8サイト用**、`khg-api-form-register.snippet.php` は
**下書き**である。⚠️ ダッシュボードのサーバーへ置かないこと。

### 確認【あなたのPC（PowerShell）で実行】

```powershell
cd $env:TEMP
'{"request":"lostList"}' | Out-File -Encoding ascii ll.json
curl.exe -s -D - -o NUL -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" -d "@ll.json"
```

⚠️ 応答ヘッダに **`X-Handled-By: express`** が出ること。
本文が `認証が必要です。` になるのは正常（② まで届いた証拠）。

⚠️ `該当する処理がありません。` なら ① の `express_proxy.php` が古い。

---

## 5. 【① レンタルサーバー】フロントの build

```powershell
cd C:\Users\shinji-kawano\react\dashboard\frontend
npm run build
```

⚠️ `Compiled with warnings.` は正常。`Failed to compile` なら止めて報告してほしい。

`frontend/build/` の中身を ① の公開ディレクトリへアップロードする。
⚠️ `index.html` の上書き漏れに注意（古い JS を読み続ける）。

⚠️ 画面右下（またはメニュー）のバージョンが **2.2.133** になっていること。

---

## 6. 動作確認

### 6-1. キャンペーン作成

1. キャンペーン一覧が**カード2列**で出る
2. ⚠️ **既存のキャンペーンで「修正」を押す** → 設定が**全部入った状態**で開く
   - ⚠️ 空で開いたら止める（⚠️ v2.2.132 で直した不具合の再発）
3. 「サンクスメールの文面」「通知メールの文面」が出て、⚠️ **「既定の文面」**のバッジが付く
4. 本文に `{{お名前}}` と打つ → バッジが「このキャンペーン専用」に変わる
5. ⚠️ `{{でたらめ}}` と打つ → ⚠️ **「差し込めない語があります」**が出る
6. 「既定に戻す」で空に戻り、バッジが「既定の文面」に戻る

### 6-2. ⚠️ 反響が止まっていないこと（最重要）

⚠️ **公開フォームから実際に1件送る**（テスト用のキャンペーンで）。

| 確認 | 期待 |
|---|---|
| `inquiry_customer` に入る | ⚠️ 1件増える |
| サンクスメール | ⚠️ 届く。⚠️ **本文が今までと同じ** |
| 社内通知メール | ⚠️ 届く。⚠️ **Cc も今までどおり** |

⚠️⚠️ **文面が変わっていたら止めて報告してほしい。**
⚠️ 既定の文面は ① の PHP と**1文字も変わらないよう**に作ってあるので、
変わっているなら差し込みのどこかがおかしい。

### 6-3. フォーム作成（HTML生成）

1. ブランドとキャンペーンを選ぶ
2. ⚠️ **「必須」に、キャンペーン設定どおりのチェックが入る**
   - ⚠️ 以前は姓・名・電話・メールだけだった。⚠️ **来場希望場所や住所にも入るのが正**

### 6-4. 他社広告ライブラリ

1. 全画面で開く
2. 見出しで検索できる
3. 広告主別・見出し別・月別の集計が出る
4. ⚠️ 収集開始（2026-06-23）より前の月がグラフに**出ない**こと

### 6-5. 失注一覧

1. 開く。⚠️ **件数が今までと変わらない**こと
2. ⚠️ 読み込みが**目に見えて速い**（14.3MB → 1.5MB）

### 6-6. キャンペーン集計

1. 開く。⚠️ 件数・数値が今までと変わらないこと

### 6-7. Google 口コミ集計

1. 見出しが **「レビュー数」**
2. 表の上に**注意書き**が出る

---

## ⚠️ ロールバック

### 画面だけ戻す

⚠️ 一番軽い。⚠️ ① のフロントを前のビルドに戻す。

### ② を戻す

```bash
cd ~/dashboard
git reset --hard <前のコミット>
dcp build express-api && dcp up -d --force-recreate express-api
```

### ⚠️ DB の列は戻さなくてよい

⚠️ 4列とも `DEFAULT ''` で、⚠️ **古いコードは存在を知らないまま動く**。
⚠️ 消すほうが危ない（途中で誰かが文面を入れていたら消える）。

---

## ⚠️ このデプロイのあとに残る宿題

| # | 内容 | 優先 |
|---|---|---|
| 1 | ⚠️ 8サイトの `form/api/index.php` を `form-proxy.php` へ差し替え | ⚠️ **最優先** |
| 2 | ⚠️ ① `khg-marketing.info/api/` の `index.php` にメール差分を反映 | 高 |
| 3 | ⚠️ `react/form_get` の再ビルドと8サイトへの配布 | 高 |
| 4 | ⚠️ **DBパスワードの変更**（平文でソースに入っている） | 高 |
| 5 | ⚠️ `projects/sync` の `git push heroku main`（経緯度の修正） | 高 |
| 6 | ⚠️ `form_table.mail_cc` の khg 14件がプレースホルダのまま | 中 |

⚠️ 1 は ⚠️ **フロントの再ビルドが要らず5分で終わる**。
⚠️ 今の8サイトの版は ⚠️ **全リクエストのヘッダをサーバーログに書き続けており**、
⚠️ **メールの宛先も無害化していない**。
