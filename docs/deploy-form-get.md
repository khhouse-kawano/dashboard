# 公開フォーム（`react/form_get`）の配布手順

⚠️⚠️ **対象は8サイト。** ⚠️ 反響の入口そのものなので、⚠️ **止めると営業の機会が消える。**

⚠️⚠️ **このプロジェクトは git 管理外である。** ⚠️ 戻せるのは手元の `form_get/backup/` だけ。

---

## 何が変わるか

| # | 内容 |
|---|---|
| 1 | ⚠️ **転送プロキシ（`form/api/index.php`）を差し替える** |
| 2 | POST 先が ② になる（失敗したら今までどおり ① へ退避） |
| 3 | ⚠️ `basename` を置き場所から決めるようにした（⚠️ **1つのビルドで8サイト共通**） |
| 4 | ⚠️ 通知先アドレスをブラウザに持たせない |
| 5 | ⚠️ フォームが開けないとき理由を出す（今までは真っ白） |
| 6 | 未使用の `Menu.tsx` を撤去 |

---

## ⚠️ 配布先（8サイト）

| ブランド | フォームの場所 | プロキシの場所 |
|---|---|---|
| 国分ハウジング | `kh-house.jp/form/` | `kh-house.jp/form/api/` |
| デイジャストハウス | `day-just-house.com/form/` | 同 `/form/api/` |
| なごみ工務店 | `www.nagomi-koumuten.jp/form/` | 同 |
| フルコミホーム | `furukomi-home.com/form/` | 同 |
| ニーエルホーム | `2lhome.net/form/` | 同 |
| PG HOUSE | `miyazaki.pg-house.jp/form/` | 同 |
| ジャスフィーホーム | `jusfy-home.com/form/` | 同 |
| ⚠️ **KHG 共通** | `kh-house.jp/khg/form/` | `kh-house.jp/khg/form/api/` |

⚠️ ⚠️ **KHG は `kh-house.jp` の中にあるが別のディレクトリ。** ⚠️ 上書き先を間違えないこと。

---

## ⚠️ 実行順序

```
0. 【あなたのPC】 backup を取る          ← 最初
1. 【8サイト】    form/api/index.php を差し替え
2. 【あなたのPC】 form_get を build
3. 【8サイト】    index.html と assets/ を上書き
```

⚠️ **1 を先にやる理由**: ⚠️ プロキシの差し替えは**フロントと無関係に効く**。
⚠️ 今の版は**全リクエストのヘッダをサーバーログに書き続けており**、
⚠️ **メールの宛先も無害化していない**。⚠️ 先に塞ぐ。

⚠️ 1 だけやって 2〜3 をやらなくても、⚠️ **フォームは今までどおり動く。**
⚠️ 日を分けてよい。

---

## 0. 【あなたのPC】控えを取る

⚠️ ⚠️ **`form_get` は git 管理外。** ⚠️ 上書き前に必ず取る。

```powershell
cd C:\Users\shinji-kawano\react\form_get
Copy-Item -Recurse dist "backup\dist-$(Get-Date -Format yyyyMMdd)"
```

⚠️ ⚠️ **各サイトの現行ファイルも FTP で落としておく。**
⚠️ サイト側が戻せないと、こちらの控えだけでは復旧できない。

| 落とすもの | 置き場所 |
|---|---|
| `form/index.html` | 手元の任意のフォルダ（⚠️ サイトごとに分ける） |
| `form/assets/` 一式 | 同上 |
| ⚠️ `form/api/index.php` | 同上 |

---

## 1. 【8サイト】転送プロキシの差し替え

`backend/forms/form-proxy.php` を、各サイトの `form/api/index.php` として上書きする。

⚠️ ⚠️ **ファイル名は `index.php` のまま。** `form-proxy.php` という名前で置かない。

### ⚠️ 何が直るか

| # | 今の版の問題 |
|---|---|
| 1 | ⚠️ `error_log` で**全リクエストのヘッダをサーバーログに書き続けている**（3行） |
| 2 | ⚠️ `mail_to` / `mail_cc` を**無害化せず転送**。⚠️ ① 側で `Cc:` に入り、改行で `Bcc:` を足せる |

### 確認【あなたのPC（PowerShell）で実行】

⚠️ 差し替えたサイトごとに、⚠️ **転送が生きていること**だけ見る。

```powershell
cd $env:TEMP
'{"brand":"kh","campaign_id":"__test__"}' | Out-File -Encoding ascii fg.json
curl.exe -s -X POST https://kh-house.jp/form/api/ `
  -H "Content-Type: application/json" -H "Authorization: form_get" -d "@fg.json"
```

⚠️ `{"status":"empty","data":null}` が返れば正常（⚠️ **① まで届いた証拠**）。

⚠️ `Missing Authorization header` は ⚠️ **サーバーが `Authorization` を渡していない**サイン。
⚠️ そのサイトだけ `.htaccess` の設定が要る。⚠️ 止めて報告してほしい。

---

## 2. 【あなたのPC】build

```powershell
cd C:\Users\shinji-kawano\react\form_get
npm run build
```

⚠️ `✓ built in ...` が出れば成功。⚠️ `error TS` が出たら止めて報告してほしい。

### ⚠️ ビルド後に必ず確認する

```powershell
Select-String -Path dist\assets\*.js -Pattern '"/khg/form"','"/form"' -AllMatches |
  Select-Object -ExpandProperty Matches | Select-Object -ExpandProperty Value | Sort-Object -Unique
```

⚠️ ⚠️ **`/form` と `/khg/form` の両方が出ること。**
⚠️ 片方しか無ければ `App.tsx` が壊れている。⚠️ **配ってはいけない。**

```powershell
Select-String -Path dist\assets\*.js -Pattern 'kh-group\.jp','mkt@kh-house\.jp'
```

⚠️ ⚠️ **何も出ないこと。** ⚠️ 出たら通知先がブラウザに漏れている。

---

## 3. 【8サイト】フロントの上書き

⚠️ アップロードするのは **2つだけ**。

```
dist/index.html      → <サイト>/form/index.html
dist/assets/         → <サイト>/form/assets/
```

### ⚠️⚠️ 絶対にやってはいけないこと

⚠️ ⚠️ **`form/` を「同期」「ミラー」しないこと。**

⚠️ `form/` の中には ⚠️ **`api/index.php` が入っている**（手順1で差し替えたもの）。
⚠️ 同期すると**消える**。⚠️ 消えると ⚠️ **② が落ちたときの退避先が全滅する。**

⚠️ FTP ソフトの「ディレクトリ同期」「余分なファイルを削除」は**使わない**。

### ⚠️⚠️ 古い `index-*.js` は必ず消すこと

⚠️⚠️ **「ハッシュが付くから残しても害はない」は誤り。** ⚠️ 2026-09-16 に実際に事故った。

⚠️ `index.html` に `Cache-Control` が無いと、⚠️ **ブラウザが古い `index.html` を掴み続ける**。
⚠️ 古い `index.html` は**古い JS** を指し、⚠️ **それがサーバーに残っていると普通に読めてしまう**。

⚠️ その結果 ⚠️ **移行前のフォームが動き続け、送信が関係のない置き場所へ飛び、メールも届かなかった。**
⚠️ 配布した側は新しい画面が出ているので**気づけない**。

⚠️ `form/assets/` に残す資材は **2つだけ**。

```
index-<今回のハッシュ>.js
index-<今回のハッシュ>.css
```

⚠️ それ以外の `index-*.js` は**削除する**。
⚠️ 古い `index.html` を掴んだ人は白画面になるが、⚠️ **再読み込みで必ず直る**。
⚠️ 「古いフォームが動き続ける」ほうがはるかに危ない。

### ⚠️ `.htaccess` を置く（恒久対応）

⚠️ `backend/forms/form-htaccess.txt` を `form/.htaccess` として置く
（⚠️ **ファイル名を `.htaccess` に変えること**）。

| 効果 | |
|---|---|
| `index.html` を毎回確かめさせる | ⚠️ **上の事故が再発しない** |
| `assets/` は長期キャッシュ | 表示が速い |
| `Authorization` を PHP へ渡す | ⚠️ `Missing Authorization header` の予防 |

⚠️ ⚠️ **`index.html` の上書き漏れがいちばん多い事故。** ⚠️ 古い JS を読み続け、
⚠️ 見た目は変わらないのに挙動だけ古いままになる。

---

## 4. 動作確認（⚠️ サイトごとに1回ずつ）

### 4-1. ⚠️ 画面が出ること

⚠️ 実際のキャンペーンURLを開く。

```
https://kh-house.jp/form/?id=<campaign_id>&brand=kh
https://kh-house.jp/khg/form/?id=<campaign_id>&brand=khg
```

⚠️ ⚠️ **真っ白なら `basename` が合っていない。** ⚠️ 手順2の確認に戻る。

⚠️ ブラウザの開発者ツール（F12）の Console に
`No routes matched location` が出ていないこと。

### 4-2. ⚠️ ② を叩いていること

⚠️ F12 → Network を開いてページを再読み込みする。

| 期待 | |
|---|---|
| `api.khg-marketing.info/api/gateway` へ POST | ⚠️ **200** |
| `<サイト>/form/api/` へ POST | ⚠️ **出ないのが正常**（② が成功しているため） |

⚠️ ⚠️ **`api.khg-marketing.info` が CORS で失敗していたら**、
⚠️ ② の `.env.prod` の `CORS_ORIGINS` にそのサイトが入っていない。
⚠️ [deploy-v2.2.133.md](deploy-v2.2.133.md) の手順2を見る。

⚠️ このとき ⚠️ **フォーム自体は ① へ退避して動く**ので、
⚠️ **画面を見ているだけでは気づけない。** ⚠️ 必ず Network を見ること。

### 4-3. ⚠️ 実際に1件送る（最重要）

⚠️ テスト用のキャンペーンで**本当に送信する**。

| 確認 | 期待 |
|---|---|
| 完了画面／リダイレクト | 出る |
| `inquiry_customer` | ⚠️ **1件増える** |
| ⚠️ `brand` / `shop` | ⚠️ **空でないこと**（⚠️ なごみは特に注意） |
| サンクスメール | ⚠️ 届く。⚠️ **本文が今までと同じ** |
| 社内通知メール | ⚠️ 届く。⚠️ **Cc も今までどおり** |

⚠️ ⚠️ **KHG 共通フォームは店舗を変えて2回送る。**
⚠️ 店舗によって `brand` と Cc が変わる作りなので、1回では確かめられない。

### 4-4. 郵便番号

⚠️ 郵便番号を入れると住所が自動で入ること（`zipcloud`）。

---

## ⚠️ ロールバック

⚠️ 手順0で落としたファイルを戻す。⚠️ **2つだけ戻せばよい。**

```
form/index.html
form/assets/
```

⚠️ ⚠️ **`form/api/index.php` は戻さないこと。**
⚠️ 新しいプロキシは**転送処理が同じ**で、⚠️ 古いフロントからでも動く。
⚠️ 戻すとログ垂れ流しとメールの穴が復活する。

---

## ⚠️ よくある失敗

| 症状 | 原因 |
|---|---|
| ⚠️ **画面が真っ白** | ⚠️ `basename` が合っていない／`index.html` が古い |
| ⚠️ **送信だけ失敗する／メールが届かない** | ⚠️ **ブラウザが古い `index.html` を掴んでいる**。⚠️ ハード再読み込み（`Ctrl+Shift+R`）で確認し、⚠️ **古い `index-*.js` をサーバーから消す** |
| ⚠️ **フォールバックが全滅** | ⚠️ `form/` を同期して `api/` を消した |
| ⚠️ 見た目が変わらない | ⚠️ `index.html` の上書き漏れ |
| ⚠️ ② に行かず ① へ退避し続ける | ⚠️ `CORS_ORIGINS` にそのサイトが無い |
| ⚠️ `Missing Authorization header` | ⚠️ そのサイトが `Authorization` を通していない |

---

## ⚠️ この作業のあとに残る宿題

⚠️ ① `khg-marketing.info/api/` の `index.php` はまだ改修していない。

⚠️ そのため ⚠️ **② が落ちて ① へ退避したときだけ、キャンペーン設定で編集した
メール文面が効かない**（既定の文面が飛ぶ）。

⚠️ 差分は [khg-api-form-register.snippet.php](../backend/forms/khg-api-form-register.snippet.php) に用意してある。
