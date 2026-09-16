# 緊急修正　なごみ・KHG でメールが届かない

⚠️ 対象コミット: **`60c23997`**（`a5d09741` も一緒に出るが、⚠️ **ドキュメントだけ**）

---

## ⚠️ すでに終わっていること

| | |
|---|---|
| `form_table` への列追加（4列） | ⚠️ **済** |
| PR #39（`v2.2.134` → `production`）のマージ | ⚠️ **済**（`fab3b026`） |

⚠️⚠️ **ただし PR #39 には、なごみの修正が入っていない。**
⚠️ マージ時点のリモートは `fe2295e3`（差出人名まで）だった。
⚠️ **`60c23997` はその後のコミット**である。

---

## ⚠️ 何が直るか

| 症状 | |
|---|---|
| ⚠️ なごみのフォームで**反響メール・通知メールが1通も届かない** | ⚠️ 直る |
| ⚠️ **KHG 共通フォーム（14件）も同じ理由で届いていない** | ⚠️ 直る |
| ⚠️ KHG の**店舗別 Cc の上書きが効いていない** | ⚠️ 直る |

⚠️ 反響そのものは**保存されている**ので、⚠️ **データの取りこぼしは無い。**

⚠️ 原因は、公開フォームが送信直前に `brand` を書き換える（`nagomi`→`なごみ`、`khg`→店舗のブランド）のに対し、
⚠️ ② がその値のまま `form_table` を引いていたこと。⚠️ 行が見つからず**メール送信ごと飛ばされていた**。

---

## ⚠️ 触る範囲

⚠️⚠️ **② だけ。** ⚠️ ① の PHP もフロントも DB も**触らない**。

| 変わるファイル | |
|---|---|
| `backend-express/src/features/campaignForm/brands.ts` | `formTableBrand()` を追加 |
| `backend-express/src/features/campaignForm/entry.ts` | 引くキーを正規化 |
| `docs/…` | ドキュメントのみ |

---

## 手順

### 1. 【あなたのPC（PowerShell）で実行】push

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git push origin v2.2.134
```

⚠️ ⚠️ **`git push origin HEAD:production` は使わない。** ⚠️ 構造的に必ず reject される。

### 2. 【GitHub】PR を作ってマージ

⚠️ `v2.2.134` → `production` の PR を**もう一度**作ってマージする。

⚠️ PR #39 は既にマージ済みなので、⚠️ **新しい PR になる**（差分は2コミットだけ）。

⚠️ マージ後、先頭が `60c23997` を含んでいることを確認する。

### 3. 【② VPS で実行】

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
git log --oneline -3
```

⚠️ ⚠️ **`find the campaign settings when the form rewrote the brand` が見えること。**
⚠️ 見えなければ手順2が終わっていない。⚠️ ここで止める。

```bash
dcp build express-api
dcp up -d --force-recreate express-api
dcp ps
```

⚠️ `caddy` / `express-api` / `ssh-tunnel` の3つすべてが `Up` であること。

---

## 4. ⚠️ 動作確認

### 4-1. 起動が通っていること

```bash
dcp logs --tail 100 express-api | grep -iE "Unknown column|error"
```

⚠️ **何も出ないこと。** ⚠️ `Unknown column` が出たら列追加が反映されていない。

### 4-2. ⚠️ なごみのフォームから実際に1件送る

⚠️ 送ったあと、⚠️ **すぐログを見る。**

```bash
dcp logs --tail 50 express-api | grep -E "campaign_form"
```

| 出る行 | 判定 |
|---|---|
| `campaign_form:entry を受け付けました …` のみ | ⚠️ **成功** |
| ⚠️ `form_table に無い組み合わせです … 引いたキー="…"` | ⚠️ **失敗**。⚠️ **引いたキーを控えて報告してほしい** |
| `campaign_form: 社内通知の宛先がありません` | `form_table.mail_to` が空 |
| `SMTP が未設定のためメールを送信しません。` | ⚠️ `.env.prod` の SMTP 設定が空 |
| `メール送信に失敗しました to=…` | SMTP へは繋いだが拒否された |

⚠️ ⚠️ **「引いたキー」は今回の修正で足した表示である。** ⚠️ 前は出なかった。

### 4-3. メール2通

| | 期待 |
|---|---|
| サンクスメール（顧客宛） | ⚠️ 届く |
| 社内通知メール | ⚠️ 届く。⚠️ **Cc も今までどおり** |
| ⚠️ 差出人名 | ⚠️ **なごみ工務店**（⚠️ `国分ハウジング` ではない） |

### 4-4. ⚠️ KHG 共通フォームも確認する

⚠️⚠️ **同じ原因で止まっていたので、必ず別に確認する。**
⚠️ 店舗を**2つ**選んで2回送る（店舗で `brand` と Cc が変わるため）。

```
https://kh-house.jp/khg/form/?id=<campaign_id>&brand=khg
```

| | 期待 |
|---|---|
| ログに `form_table に無い組み合わせ` | ⚠️ **出ないこと** |
| 通知メールの Cc | ⚠️ **選んだ店舗のもの**になっていること |
| 差出人名 | ⚠️ **選んだ店舗のブランド名** |

### 4-5. 他のブランドが壊れていないこと

⚠️ DJH か 2L で1件送って、⚠️ **今までどおりメールが届く**こと。
⚠️ この2つは元から動いていたので、⚠️ **後退が無いことの確認**になる。

---

## ⚠️ ロールバック

```bash
cd ~/dashboard
git reset --hard fab3b026
dcp build express-api && dcp up -d --force-recreate express-api
```

⚠️ 戻すと ⚠️ **なごみと KHG のメールがまた飛ばなくなる**（反響の保存は続く）。

⚠️ ⚠️ **DB の列は戻さないこと。** ⚠️ `DEFAULT ''` なので古いコードでも動く。

---

## ⚠️ この修正に含まれないもの

| # | 内容 |
|---|---|
| 1 | ⚠️ ① `khg-marketing.info/api/` の `index.php`（⚠️ **退避時だけ古い文面・誤字で届く**） |
| 2 | ⚠️ 8サイトの `form/assets/` に残る**古い `index-*.js` の削除** |
| 3 | ⚠️ `form/.htaccess` の設置（⚠️ キャッシュ事故の再発防止） |
| 4 | ⚠️ `form_table.mail_cc` の khg 14件が `※ここは編集しない` のまま |

⚠️ 4 は ⚠️ **今回の修正で KHG_CC が効くようになるため実害は消える**が、
⚠️ 設定画面には壊れた値が見えたままなので、いずれ直すこと。
