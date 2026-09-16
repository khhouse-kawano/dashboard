# キャンペーンフォームの Express 化 — デプロイ手順

作成: 2026-09-16

---

## 何を移したか

⚠️ 移植元は **dashboard のゲートウェイではない別API**（`https://khg-marketing.info/api/` の `index.php`）。
⚠️ ルーティングに `request` ではなく **`Authorization` ヘッダ**を使っていた。

| 旧（① の別API） | 新（② Express） | 認証 | 誰が呼ぶか |
|---|---|---|---|
| `form_list` | `campaign_form:list` | staff | 管理画面 |
| `form_edit` | `campaign_form:detail` | staff | 管理画面 |
| `form_post` | `campaign_form:insert` | staff | 管理画面 |
| `form_update` | `campaign_form:update` | staff | 管理画面 |
| `form_database` | `campaign_form:master` | staff | 管理画面 |
| `form_get` | `campaign_form:public` | ⚠️ **なし** | 公開フォーム |
| `form_register` | `campaign_form:entry` | ⚠️ **なし** | 公開フォーム |

---

## ⚠️ 退避先を消さないこと

```
通常   : フォーム ──▶ ② api.khg-marketing.info
② 失敗 : フォーム ──▶ ① 各サイトの form/api/（**移行前と同じ経路**）
```

⚠️⚠️ **① の `khg-marketing.info/api/index.php` と、8サイトの `form/api/index.php` を
消してはいけない。** ⚠️ 退避先が無くなる。

⚠️ 退避先へ回ったときは ① の PHP が動くので、
⚠️ **`docs/form-api-hotfix.md` の無害化を先に入れておくこと。**

---

## ⚠️ 実行順序

```
1. 【② VPS】 .env.prod に CORS_ORIGINS を追加   ← 先にやる
2. 【② VPS】 Express を更新
3. 【①】     express_proxy.php をアップロード
4. 【①】     ダッシュボードのフロントを build → アップロード
5. 【8サイト】公開フォームを build → 配布       ← 最後
```

⚠️ **1 を忘れると、公開フォームは毎回 ① へ落ちる。**
⚠️ 動いてしまうので気づけない。手順6-3で必ず確認すること。

---

## 1. 【② VPS】CORS_ORIGINS

⚠️ 公開フォームは**ブラウザから ② を直接叩く**ようになる。
⚠️ 移行前はサーバー間通信（プロキシ経由）だったため CORS は関係しなかった。

`~/dashboard/.env.prod` の `CORS_ORIGINS` に、**フォームを設置している8サイトの
オリジン**を足す（カンマ区切り、既存の値は消さない）。

```
https://kh-house.jp
https://day-just-house.com
https://www.nagomi-koumuten.jp
https://furukomi-home.com
https://2lhome.net
https://miyazaki.pg-house.jp
https://jusfy-home.com
```

⚠️ `khg` のフォームは `kh-house.jp` 配下なので、上の1つ目で足りる。
⚠️ `www` の有無は**実際に配信しているホスト名に合わせる**こと。
　 ⚠️ 違うと CORS が通らず、毎回 ① へ落ちる。

⚠️ この値は環境変数なので、**変更後は express-api の作り直しが要る**（手順2で行う）。

---

## 2. 【② VPS】Express の更新

```bash
ssh root@162.43.5.127
alias dcp='docker compose -f ~/dashboard/docker-compose.prod.yml --env-file ~/dashboard/.env.prod'
```

⚠️ 入り直したら毎回張り直す。⚠️ 素の `docker compose` を使わないこと（`.env.prod` を読まない）。

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git reset --hard FETCH_HEAD
dcp build express-api
dcp up -d --force-recreate express-api
dcp ps
```

### 取り込み確認

```bash
dcp logs --tail 400 express-api | grep -E "campaign_form"
```

⚠️ **7件**出ること。⚠️ `entry` と `public` にだけ 🔒 が**付かない**のが正常。

```
🔒 campaign_form:detail   🔒 campaign_form:insert   🔒 campaign_form:list
🔒 campaign_form:master   🔒 campaign_form:update
   campaign_form:entry       campaign_form:public
```

---

## 3. 【① レンタルサーバー】PHP

`dashboard/api/gateway/core/express_proxy.php` を上げる。

⚠️ 追加したのは **staff 系5件だけ**。
⚠️ `public` / `entry` は**入れていない**（公開フォームは ② を直接叩くため）。

### 確認【あなたのPC（PowerShell）で実行】

```powershell
cd $env:TEMP
'{"request":"campaign_form","roll":"list","brand":"kh"}' | Out-File -Encoding ascii cf.json
curl.exe -s -D - -o NUL -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" -d "@cf.json"
```

⚠️ `X-Handled-By: express` が出ること。
⚠️ 本文が `認証が必要です。` は**正常**（② まで届いた証拠）。

---

## 4. 【① レンタルサーバー】ダッシュボードのフロント

⚠️ **この手順は未実装。** 画面（NewCampaign / CampaignList）はまだ
`https://khg-marketing.info/api/` を直接叩いている。
⚠️ 手順2・3だけ実施しても**画面は今までどおり動く**（旧APIが生きているため）。

---

## 5. 【8サイト】公開フォームの配布

```powershell
cd C:\Users\shinji-kawano\react\form_get
npx vite build
```

`dist/` の中身を各サイトの `/form/` へ配布する（8サイト）。

⚠️ **index.html の上書き漏れに注意**（古い JS を読み続ける）。

---

## 6. 動作確認

### 6-1. フォームが開くこと

⚠️ 実際のフォームURLを開き、項目が出ること。

⚠️ 開かない場合は**真っ白ではなく**
「フォームを読み込めませんでした。」が出る。
⚠️ 以前は「フォーム読み込み中」が永久に回り続けていた。

### 6-2. 1件送信してみる

- `inquiry_customer` に1行増えること（⚠️ `inquiry_id` が **`form`** で始まる）
- `pgcloud` / `form_cv` にも1行ずつ
- 顧客にサンクスメールが届くこと
- ⚠️ **社内通知が今までどおりの宛先に届くこと**（Cc 含む）
- サンクスページへ遷移すること

### 6-3. ⚠️ ② が使われているかの確認（重要）

⚠️ **① へ落ちていても動いてしまう**ので、必ず確かめる。

| 見る場所 | ② が使われている | ⚠️ ① に落ちている |
|---|---|---|
| `inquiry_customer.inquiry_id` | **`form`** で始まる | ⚠️ `homepage` で始まる |
| ブラウザの Console | 何も出ない | ⚠️ `[form] ② への送信に失敗` |
| ② のログ | `campaign_form:entry を受け付けました` | 何も出ない |

⚠️ `homepage` で始まっていたら、**CORS_ORIGINS を疑う**（手順1）。

---

## ⚠️ 二重登録について

⚠️ ② が保存したあとに応答が返らなかった場合、フォームは ① へ回すため
**同じ反響が2件登録される**（顧客にサンクスメールが2通届く）。

⚠️ これは「反響が消えて誰も気づかない」ほうが損失が大きいという判断による。
⚠️ **無断で変えないこと**（`form_get/src/api/gateway.ts` に同じ注意を書いてある）。

### 見つけ方

⚠️ ② は `form`、① は `homepage` で始まるため、
同じ人が両方にいれば重複である。

```sql
SELECT a.id, b.id, a.mail, a.inquiry_date
  FROM inquiry_customer a
  JOIN inquiry_customer b
    ON a.mail = b.mail
   AND a.inquiry_date = b.inquiry_date
   AND a.mail <> ''
 WHERE a.inquiry_id LIKE 'form%'
   AND b.inquiry_id LIKE 'homepage%';
```

---

## ⚠️ 戻し方

⚠️ **5 → 3 → 2 の逆順**で戻す。

⚠️ いちばん速いのは `form_get/src/api/gateway.ts` の `EXPRESS_URL` を
壊れた値にして配り直すこと（⚠️ 必ず ① へ落ちる）。
⚠️ ただし 8サイトへの配布が要るので、**①の PHP を生かしておくことが前提**である。

---

## この移行で直した本番の不具合

| # | 内容 |
|---|---|
| 1 | ⚠️ **任意の宛先へメールを送れた**（`mail_cc` のヘッダインジェクション）。通知先を DB から引く形にした |
| 2 | ⚠️ **通知先がブラウザに露出していた**（`form_get` が `SELECT *`）。返さないようにした |
| 3 | ⚠️ **なごみの反響で brand が空になっていた**（`nagomi` と `なごみ` の食い違い・実データで20件） |
| 4 | ⚠️ **`sync` / `delete_flag` が数値列**。42列の NOT NULL をすべて埋めるようにした |
| 5 | ⚠️ **キャンペーンIDが違うとフォームが真っ白**になり、原因も出なかった |
| 6 | ⚠️ **更新が0行でも「修正に成功しました」**と出ていた |
| 7 | ⚠️ **別ブランドの同じIDを巻き込んで更新**していた（`form_update` に brand 条件が無かった） |
| 8 | ⚠️ アンケートURLが空でも「▼事前アンケート…」だけ届いていた |
| 9 | ⚠️ 会員登録メールの**署名が本文に入っていなかった**（文字列が孤立していた） |
| 10 | ⚠️ `inquiry_date` の形式が2種類あった（`Y/m/d` に統一） |
